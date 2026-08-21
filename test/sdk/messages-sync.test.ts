import {
    ChatsSyncSummaryEvent,
    DeliveryStatus,
    GetMessagesDifferenceConfig,
    Message,
    MessageCursorEvent,
    MessagesDifferenceEvent,
    MessageState,
    MessageTargetEntityId,
    MessageTargetEntityType,
    MessageType,
    MAX_CACHED_RANGES,
    SfuEvent
} from "../../src/sdk/constants";
import {
    CachedWindow,
    EntitySyncStatus,
    entityKey,
    GapDetected,
    MessagesSyncApi,
    MessagesSyncEvent,
    MessagesSynchronizer,
    MessagesSyncOptions,
    MessagesSyncStore,
    MessagesSyncUpdate,
    StoredCursor,
    SyncEntity
} from "../../src/sdk/messages-sync";

const CHAT: SyncEntity = {
    targetEntityType: MessageTargetEntityType.CHAT,
    targetEntityId: {chatId: "chat-1"}
};

const CHANNEL: SyncEntity = {
    targetEntityType: MessageTargetEntityType.CHANNEL,
    targetEntityId: {spaceId: "space-1", channelId: "channel-1"}
};

const message = (id: string, overrides: Partial<Message> = {}): Message => ({
    id,
    type: MessageType.REGULAR,
    targetEntityType: CHAT.targetEntityType,
    targetEntityId: CHAT.targetEntityId,
    date: 1,
    from: "alice",
    status: MessageState.FULL_DELIVERY_FULL_READ,
    body: "body of " + id,
    attachments: [],
    deliveryStatus: {},
    privateMessage: false,
    edited: false,
    dateOfEdit: 0,
    reactions: [],
    ...overrides
});

const difference = (overrides: Partial<MessagesDifferenceEvent> = {}): MessagesDifferenceEvent => ({
    type: SfuEvent.MESSAGES_DIFFERENCE,
    roomId: "",
    internalMessageId: "id",
    targetEntityType: CHAT.targetEntityType,
    targetEntityId: CHAT.targetEntityId,
    messages: [],
    newCursor: 0,
    hasMore: false,
    resyncRequired: false,
    ...overrides
});

const cursorEvent = (entity: SyncEntity, cursor: number, messageId = "m1"): MessageCursorEvent => ({
    targetEntityType: entity.targetEntityType,
    targetEntityId: entity.targetEntityId,
    messageId,
    cursor,
    sourceEvent: SfuEvent.MESSAGE
});

const summary = (cursors: Array<{ entity: SyncEntity, currentCursor: number }>): ChatsSyncSummaryEvent => ({
    type: SfuEvent.CHATS_SYNC_SUMMARY,
    roomId: "",
    internalMessageId: "id",
    cursors: cursors.map(({entity, currentCursor}) => ({
        targetEntityType: entity.targetEntityType,
        targetEntityId: entity.targetEntityId,
        currentCursor
    }))
});

/**
 * Local cache of the client: messages upserted by id and cursors per entity
 */
class TestStore implements MessagesSyncStore {
    messages: { [key: string]: Map<string, Message> } = {};
    cursors: { [key: string]: number } = {};
    updates: Array<MessagesSyncUpdate> = [];
    savedCursors: Array<StoredCursor> = [];

    constructor(seed: Array<StoredCursor> = []) {
        seed.forEach((item) => this.cursors[entityKey(item)] = item.cursor);
    }

    getCursors(): Array<StoredCursor> {
        return Object.entries(this.cursors).map(([key, cursor]) => {
            const [type, ids] = key.split(":");
            const parts = ids.split("/");
            const id: MessageTargetEntityId = type === MessageTargetEntityType.CHAT
                ? {chatId: parts[0]}
                : {spaceId: parts[0], channelId: parts[1], threadId: parts[2]};
            return {
                targetEntityType: type as MessageTargetEntityType,
                targetEntityId: id,
                cursor
            };
        });
    }

    applyMessages(update: MessagesSyncUpdate) {
        this.updates.push(update);
        const key = entityKey(update);
        if (update.resync || !this.messages[key]) {
            this.messages[key] = new Map<string, Message>();
        }
        //replacement by id, the order of the updates does not matter
        update.messages.forEach((msg) => this.messages[key].set(msg.id, msg));
    }

    saveCursor(cursor: StoredCursor) {
        this.savedCursors.push(cursor);
        this.cursors[entityKey(cursor)] = cursor.cursor;
    }

    entityMessages(entity: SyncEntity): Array<Message> {
        const stored = this.messages[entityKey(entity)];
        return stored ? Array.from(stored.values()) : [];
    }
}

/**
 * A store that caches a contiguous range of every entity rather than its whole history
 */
class WindowedStore extends TestStore {
    windowRequests: Array<SyncEntity> = [];
    window: CachedWindow | (() => CachedWindow) = {from: 100, to: 200};

    getCachedWindow(entity: SyncEntity): CachedWindow {
        this.windowRequests.push(entity);
        return typeof this.window === "function" ? this.window() : this.window;
    }
}

/**
 * A store whose cache of an entity is a set of intervals rather than one contiguous range
 */
class RangedStore extends TestStore {
    rangeRequests: Array<SyncEntity> = [];
    ranges: Array<CachedWindow> | (() => Array<CachedWindow>) = [{from: 100, to: 200}, {from: 500, to: 0}];

    getCachedRanges(entity: SyncEntity): Array<CachedWindow> {
        this.rangeRequests.push(entity);
        return typeof this.ranges === "function" ? this.ranges() : this.ranges;
    }
}

class TestApi implements MessagesSyncApi {
    summaryResponse: ChatsSyncSummaryEvent = summary([]);
    differences: Array<MessagesDifferenceEvent> = [];
    loadedMessages: Array<Message> = [];
    differenceRequests: Array<GetMessagesDifferenceConfig> = [];
    loadRequests: Array<SyncEntity> = [];
    summaryRequests = 0;

    async getChatsSyncSummary(): Promise<ChatsSyncSummaryEvent> {
        this.summaryRequests++;
        return this.summaryResponse;
    }

    async getMessagesDifference(config: GetMessagesDifferenceConfig): Promise<MessagesDifferenceEvent> {
        this.differenceRequests.push(config);
        const response = this.differences.shift();
        if (!response) {
            throw new Error("Unexpected getMessagesDifference call: " + JSON.stringify(config));
        }
        return response;
    }

    async loadMessages(params: any): Promise<Array<Message>> {
        this.loadRequests.push(params);
        return this.loadedMessages;
    }
}

describe("messages sync", () => {

    describe("entity key", () => {
        it("should distinguish chats, channels and threads", () => {
            expect(entityKey(CHAT)).toEqual("CHAT:chat-1");
            expect(entityKey(CHANNEL)).toEqual("CHANNEL:space-1/channel-1");
            expect(entityKey({
                targetEntityType: MessageTargetEntityType.THREAD,
                targetEntityId: {spaceId: "space-1", channelId: "channel-1", threadId: "thread-1"}
            })).toEqual("THREAD:space-1/channel-1/thread-1");
        });
    });

    describe("summary", () => {
        it("should request a difference only for diverging entities", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 42}, {...CHANNEL, cursor: 3}]);
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 42},
                {entity: CHANNEL, currentCursor: 7}
            ]);
            api.differences = [difference({
                targetEntityType: CHANNEL.targetEntityType,
                targetEntityId: CHANNEL.targetEntityId,
                newCursor: 7
            })];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].targetEntityId).toEqual(CHANNEL.targetEntityId);
            expect(api.differenceRequests[0].sinceCursor).toEqual(3);
            expect(result.entities.length).toEqual(1);
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
        });

        it("should read an entity without a local cursor from the beginning of the journal", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 5})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests[0].sinceCursor).toEqual(0);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1"]);
        });

        it("should skip entities without journal records", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 0}]);

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(0);
            expect(result.entities.length).toEqual(0);
        });

        it("should skip entities rejected by the entity filter", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHANNEL, cursor: 3}]);
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 5},
                {entity: CHANNEL, currentCursor: 7}
            ]);
            api.differences = [difference({
                targetEntityType: CHANNEL.targetEntityType,
                targetEntityId: CHANNEL.targetEntityId,
                newCursor: 7
            })];

            //a client that loads entities without a local cursor lazily keeps them out of the run
            const result = await new MessagesSynchronizer(api, {
                store,
                entityFilter: (cursor, localCursor) => localCursor > 0
            }).sync();

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].targetEntityId).toEqual(CHANNEL.targetEntityId);
            expect(result.entities.length).toEqual(1);
        });

        it("should sync the active entity first", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 5},
                {entity: CHANNEL, currentCursor: 5}
            ]);
            api.differences = [
                difference({newCursor: 5}),
                difference({newCursor: 5})
            ];

            await new MessagesSynchronizer(api, {store})
                .setActiveEntity(CHANNEL)
                .sync();

            expect(api.differenceRequests[0].targetEntityId).toEqual(CHANNEL.targetEntityId);
            expect(api.differenceRequests[1].targetEntityId).toEqual(CHAT.targetEntityId);
        });
    });

    describe("cursor", () => {
        it("should store the new cursor after the response is applied", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 57}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 57})];

            const sync = new MessagesSynchronizer(api, {store});
            await sync.sync();

            expect(sync.getCursor(CHAT)).toEqual(57);
            expect(store.cursors[entityKey(CHAT)]).toEqual(57);
            //applied before the cursor was saved
            expect(store.updates.length).toEqual(1);
            expect(store.savedCursors.length).toEqual(1);
        });

        it("should not move the cursor backwards", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 42}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 57}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 10})];

            const sync = new MessagesSynchronizer(api, {store});
            await sync.sync();

            expect(sync.getCursor(CHAT)).toEqual(42);
            expect(store.cursors[entityKey(CHAT)]).toEqual(42);
            expect(store.savedCursors.length).toEqual(0);
        });

        it("should keep the cursor when the difference request fails", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 42}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 57}]);
            api.differences = [];

            const sync = new MessagesSynchronizer(api, {store});
            const result = await sync.sync();

            expect(result.entities[0].status).toEqual(EntitySyncStatus.FAILED);
            expect(sync.getCursor(CHAT)).toEqual(42);
            expect(store.cursors[entityKey(CHAT)]).toEqual(42);
        });

        it("should not let a failed entity stop the others", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 5},
                {entity: CHANNEL, currentCursor: 5}
            ]);
            api.getMessagesDifference = async (config: GetMessagesDifferenceConfig) => {
                api.differenceRequests.push(config);
                if (config.targetEntityType === MessageTargetEntityType.CHAT) {
                    throw new Error("boom");
                }
                return difference({
                    targetEntityType: CHANNEL.targetEntityType,
                    targetEntityId: CHANNEL.targetEntityId,
                    newCursor: 5
                });
            };

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(result.entities.map((e) => e.status))
                .toEqual([EntitySyncStatus.FAILED, EntitySyncStatus.SYNCED]);
        });
    });

    describe("pagination", () => {
        it("should pull the next page with sinceCursor of the previous one while hasMore is set", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 30}]);
            api.differences = [
                difference({messages: [message("m1")], newCursor: 10, hasMore: true}),
                difference({messages: [message("m2")], newCursor: 20, hasMore: true}),
                difference({messages: [message("m3")], newCursor: 30, hasMore: false})
            ];

            const sync = new MessagesSynchronizer(api, {store, limit: 1});
            const result = await sync.sync();

            expect(api.differenceRequests.map((r) => r.sinceCursor)).toEqual([0, 10, 20]);
            expect(api.differenceRequests.every((r) => r.limit === 1)).toBe(true);
            expect(sync.getCursor(CHAT)).toEqual(30);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
            expect(result.entities[0].pages).toEqual(3);
            expect(result.entities[0].appliedMessages).toEqual(3);
        });

        it("should stop paginating when hasMore is set but the cursor does not move", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 30}]);
            api.differences = [
                difference({newCursor: 0, hasMore: true}),
                difference({newCursor: 0, hasMore: true})
            ];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(1);
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
        });

        it("should stop paginating on the page limit", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 100}]);
            api.getMessagesDifference = async (config: GetMessagesDifferenceConfig) => {
                api.differenceRequests.push(config);
                return difference({newCursor: config.sinceCursor + 1, hasMore: true});
            };

            const sync = new MessagesSynchronizer(api, {store, maxPagesPerEntity: 3});
            await sync.sync();

            expect(api.differenceRequests.length).toEqual(3);
            expect(sync.getCursor(CHAT)).toEqual(3);
        });
    });

    describe("cached window", () => {
        it("should send the window of the entity in every difference request, pages included", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api.differences = [
                difference({messages: [message("m1")], newCursor: 5, hasMore: true}),
                difference({messages: [message("m2")], newCursor: 9})
            ];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(2);
            //a single window travels as a list of one interval, there is no other way to declare a coverage
            api.differenceRequests.forEach((request) => {
                expect(request.cachedRanges).toEqual([{from: 100, to: 200}]);
            });
        });

        it("should send no coverage at all when the store reports no window", async () => {
            const api = new TestApi();
            //TestStore has no getCachedWindow, the client caches entities in full
            const store = new TestStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 5})];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests[0].cachedRanges).toBeUndefined();
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1"]);
        });

        it("should read the window once per entity and keep it for the whole pagination", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api.differences = [
                difference({newCursor: 5, hasMore: true}),
                difference({newCursor: 7, hasMore: true}),
                difference({newCursor: 9})
            ];
            let reads = 0;
            //a window narrowing between the pages must not be picked up mid entity
            store.window = () => ({from: 100 + (reads++) * 10, to: 200});

            await new MessagesSynchronizer(api, {store}).sync();

            expect(store.windowRequests.length).toEqual(1);
            expect(store.windowRequests[0].targetEntityId).toEqual(CHAT.targetEntityId);
            expect(api.differenceRequests.length).toEqual(3);
            expect(api.differenceRequests.map((request) => request.cachedRanges[0].from)).toEqual([100, 100, 100]);
        });

        it("should read the window of every entity of the run", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}, {...CHANNEL, cursor: 1}]);
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 5},
                {entity: CHANNEL, currentCursor: 5}
            ]);
            api.differences = [difference({newCursor: 5}), difference({newCursor: 5})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(store.windowRequests.map((entity) => entityKey(entity)).sort())
                .toEqual([entityKey(CHANNEL), entityKey(CHAT)]);
        });

        it("should synchronize without the window when the store fails to report one", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}]);
            store.getCachedWindow = () => {
                throw new Error("the local cache is not readable right now");
            };
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 5})];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].cachedRanges).toBeUndefined();
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1"]);
        });

        it("should send the window of a gap check as well", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 5}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            const sync = new MessagesSynchronizer(api, {store, gapCheckDelayMs: 10, gapCheckMinIntervalMs: 10});
            await sync.sync();
            api.differences = [difference({newCursor: 9})];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].cachedRanges).toEqual([{from: 100, to: 200}]);
        });
    });

    describe("cached ranges", () => {
        it("should send the list in every difference request, pages included", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api.differences = [
                difference({messages: [message("m1")], newCursor: 5, hasMore: true}),
                difference({messages: [message("m2")], newCursor: 9})
            ];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(2);
            api.differenceRequests.forEach((request) => {
                expect(request.cachedRanges).toEqual([{from: 100, to: 200}, {from: 500, to: 0}]);
            });
        });

        it("should prefer the list to the window when the store reports both", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            (store as any).getCachedWindow = () => ({from: 1, to: 2});
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({newCursor: 5})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests[0].cachedRanges).toEqual([{from: 100, to: 200}, {from: 500, to: 0}]);
        });

        it("should read the list once per entity and keep it for the whole pagination", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api.differences = [
                difference({newCursor: 5, hasMore: true}),
                difference({newCursor: 7, hasMore: true}),
                difference({newCursor: 9})
            ];
            let reads = 0;
            //a coverage narrowing between the pages must not be picked up mid entity
            store.ranges = () => [{from: 100 + (reads++) * 10, to: 200}];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(store.rangeRequests.length).toEqual(1);
            expect(api.differenceRequests.length).toEqual(3);
            expect(api.differenceRequests.map((request) => request.cachedRanges))
                .toEqual([[{from: 100, to: 200}], [{from: 100, to: 200}], [{from: 100, to: 200}]]);
        });

        it("should treat an empty list as no coverage", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = [];
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 5})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests[0].cachedRanges).toBeUndefined();
        });

        it("should ignore a malformed list instead of declaring a narrower coverage", async () => {
            const malformed: Array<Array<CachedWindow>> = [
                [{from: 100, to: 200}, null],
                [{from: 100, to: 200}, undefined],
                [{from: -1, to: 200}],
                [{from: 300, to: 200}],
                [{from: 100, to: Number.NaN}]
            ];
            for (const ranges of malformed) {
                const api = new TestApi();
                const store = new RangedStore([{...CHAT, cursor: 1}]);
                store.ranges = ranges;
                api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
                api.differences = [difference({messages: [message("m1")], newCursor: 5})];

                const result = await new MessagesSynchronizer(api, {store}).sync();

                //an unusable list is read as the whole history: extra records cost traffic, a narrower
                //coverage would lose changes
                expect(api.differenceRequests[0].cachedRanges).toBeUndefined();
                expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
            }
        });

        it("should fall back to the envelope when the list is longer than the maximum", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = Array.from({length: MAX_CACHED_RANGES + 1},
                (unused, i) => ({from: 100 + i * 10, to: 105 + i * 10}));
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({newCursor: 5})];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            const last = 100 + MAX_CACHED_RANGES * 10 + 5;
            expect(api.differenceRequests[0].cachedRanges).toEqual([{from: 100, to: last}]);
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
        });

        it("should synchronize without a coverage when the store fails to report the list", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.getCachedRanges = () => {
                throw new Error("the local cache is not readable right now");
            };
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1")], newCursor: 5})];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests[0].cachedRanges).toBeUndefined();
            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1"]);
        });

        it("should send the list of a gap check as well", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 5}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            const sync = new MessagesSynchronizer(api, {store, gapCheckDelayMs: 10, gapCheckMinIntervalMs: 10});
            await sync.sync();
            api.differences = [difference({newCursor: 9})];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].cachedRanges).toEqual([{from: 100, to: 200}, {from: 500, to: 0}]);
        });
    });

    describe("resync", () => {
        it("should fully reload the entity and take the cursor from the summary", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, messages: [], newCursor: 0})];
            api.loadedMessages = [message("m1"), message("m2")];

            const sync = new MessagesSynchronizer(api, {store});
            const result = await sync.sync();

            expect(api.loadRequests.length).toEqual(1);
            expect(api.loadRequests[0]).toEqual(expect.objectContaining({
                targetEntityType: CHAT.targetEntityType,
                targetEntityId: CHAT.targetEntityId,
                timeFrame: {start: 0, end: -1}
            }));
            expect(store.updates[0].resync).toBe(true);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1", "m2"]);
            expect(sync.getCursor(CHAT)).toEqual(900);
            expect(result.entities[0].status).toEqual(EntitySyncStatus.RESYNCED);
        });

        it("should read the cursor from a summary when an entity is synced on its own", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];
            api.loadedMessages = [message("m1")];

            const sync = new MessagesSynchronizer(api, {store});
            const result = await sync.syncEntity(CHAT);

            expect(result.status).toEqual(EntitySyncStatus.RESYNCED);
            expect(sync.getCursor(CHAT)).toEqual(900);
            expect(api.summaryRequests).toEqual(1);
        });

        it("should keep the local cursor when the entity is missing from the summary", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 7}]);
            api.summaryResponse = summary([]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];

            const sync = new MessagesSynchronizer(api, {store});
            //the local cursor is only seeded by a run, so it starts from 0 here
            const result = await sync.syncEntity(CHAT);

            expect(result.status).toEqual(EntitySyncStatus.RESYNCED);
            expect(sync.getCursor(CHAT)).toEqual(0);
            expect(store.cursors[entityKey(CHAT)]).toEqual(7);
        });

        it("should reload the cached range only when the store reports a window", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];
            api.loadedMessages = [message("m1")];

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.loadRequests[0]).toEqual(expect.objectContaining({
                timeFrame: {start: 100, end: 200}
            }));
            expect(result.entities[0].status).toEqual(EntitySyncStatus.RESYNCED);
        });

        it("should reload the whole entity when the window has no bounds", async () => {
            const api = new TestApi();
            const store = new WindowedStore([{...CHAT, cursor: 1}]);
            //the cache reaches both the beginning of the entity and the present
            store.window = {from: 0, to: 0};
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.loadRequests[0]).toEqual(expect.objectContaining({
                timeFrame: {start: 0, end: -1}
            }));
        });

        it("should reload every cached interval and clear the entity with the first batch only", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = [{from: 100, to: 200}, {from: 500, to: 700}];
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];
            api.loadMessages = async (params: any) => {
                api.loadRequests.push(params);
                return params.timeFrame.start === 100 ? [message("m1"), message("m2")] : [message("m5")];
            };

            const result = await new MessagesSynchronizer(api, {store}).sync();

            expect(api.loadRequests.map((r: any) => r.timeFrame))
                .toEqual([{start: 100, end: 200}, {start: 500, end: 700}]);
            //only the first batch drops the stale content, otherwise every interval would erase the previous
            expect(store.updates.map((update) => update.resync)).toEqual([true, false]);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m1", "m2", "m5"]);
            expect(result.entities[0].appliedMessages).toEqual(3);
            expect(result.entities[0].status).toEqual(EntitySyncStatus.RESYNCED);
        });

        it("should reload an open ended interval to the present", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = [{from: 0, to: 200}, {from: 500, to: 0}];
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.loadRequests.map((r: any) => r.timeFrame))
                .toEqual([{start: 0, end: 200}, {start: 500, end: -1}]);
        });

        it("should store the cursor read before the reload once every interval is loaded", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = [{from: 100, to: 200}, {from: 500, to: 700}];
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];
            api.loadMessages = async (params: any) => {
                api.loadRequests.push(params);
                //a change happens while the reload is running, the summary of the entity moves on
                api.summaryResponse = summary([{entity: CHAT, currentCursor: 950}]);
                //no cursor is stored before the last interval is in
                expect(store.savedCursors.length).toEqual(0);
                return [];
            };

            const sync = new MessagesSynchronizer(api, {store});
            await sync.sync();

            //the change of the reload window is not declared as applied, the next difference brings it
            expect(sync.getCursor(CHAT)).toEqual(900);
            expect(store.savedCursors.map((c) => c.cursor)).toEqual([900]);
            expect(api.loadRequests.length).toEqual(2);
        });

        it("should keep the cursor when an interval of the reload fails", async () => {
            const api = new TestApi();
            const store = new RangedStore([{...CHAT, cursor: 1}]);
            store.ranges = [{from: 100, to: 200}, {from: 500, to: 700}];
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, newCursor: 0})];
            api.loadMessages = async (params: any) => {
                api.loadRequests.push(params);
                if (params.timeFrame.start === 500) {
                    throw new Error("the connection went away in the middle of the reload");
                }
                return [message("m1")];
            };

            const sync = new MessagesSynchronizer(api, {store});
            const result = await sync.sync();

            expect(result.entities[0].status).toEqual(EntitySyncStatus.FAILED);
            //storing the cursor here would leave the second interval looking synchronized forever
            expect(store.savedCursors.length).toEqual(0);
            expect(sync.getCursor(CHAT)).toEqual(1);
        });

        it("should not try to page through the journal after a resync", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 900}]);
            api.differences = [difference({resyncRequired: true, hasMore: true, newCursor: 0})];

            await new MessagesSynchronizer(api, {store}).sync();

            expect(api.differenceRequests.length).toEqual(1);
        });
    });

    describe("applying", () => {
        it("should be idempotent on a repeated message state", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const edited = message("m1", {body: "edited", edited: true, dateOfEdit: 100});
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [message("m1"), edited, edited], newCursor: 5})];

            await new MessagesSynchronizer(api, {store}).sync();

            const stored = store.entityMessages(CHAT);
            expect(stored.length).toEqual(1);
            expect(stored[0]).toEqual(edited);
        });

        it("should replace a message by id whatever the order of the runs", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const deleted = message("m1", {status: MessageState.DELETED, body: ""});
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [deleted], newCursor: 5})];
            await new MessagesSynchronizer(api, {store}).sync();

            //a later run repeats a message already seen live, the newest state wins
            const api2 = new TestApi();
            api2.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api2.differences = [difference({messages: [deleted], newCursor: 9})];
            await new MessagesSynchronizer(api2, {store}).sync();

            expect(store.entityMessages(CHAT).length).toEqual(1);
            expect(store.entityMessages(CHAT)[0].status).toEqual(MessageState.DELETED);
            expect(store.cursors[entityKey(CHAT)]).toEqual(9);
        });

        it("should apply a message changed in its delivery status only", async () => {
            const api = new TestApi();
            const store = new WindowedStore();
            const sent = message("m1", {
                from: "bob",
                status: MessageState.FULL_DELIVERY_NO_READ,
                deliveryStatus: {alice: DeliveryStatus.DELIVERED}
            });
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({messages: [sent], newCursor: 5})];
            await new MessagesSynchronizer(api, {store}).sync();

            //the read mark of the addressee travels through the journal like any other change
            const read = message("m1", {
                from: "bob",
                status: MessageState.FULL_DELIVERY_FULL_READ,
                deliveryStatus: {alice: DeliveryStatus.READ}
            });
            const api2 = new TestApi();
            api2.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            api2.differences = [difference({messages: [read], newCursor: 9})];
            await new MessagesSynchronizer(api2, {store}).sync();

            expect(store.updates[store.updates.length - 1].messages).toEqual([read]);
            expect(store.entityMessages(CHAT).length).toEqual(1);
            expect(store.entityMessages(CHAT)[0].deliveryStatus).toEqual({alice: DeliveryStatus.READ});
            expect(store.entityMessages(CHAT)[0].status).toEqual(MessageState.FULL_DELIVERY_FULL_READ);
        });
    });

    describe("live cursor", () => {
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        /**
         * A synchronizer that already tracks CHAT at the given cursor, with the timers shortened so that a
         * gap check happens within a test rather than within a session
         */
        const tracking = async (api: TestApi, store: TestStore, cursor: number,
                                options: Partial<MessagesSyncOptions> = {}) => {
            api.summaryResponse = summary([{entity: CHAT, currentCursor: cursor}]);
            api.differences = [difference({newCursor: cursor})];
            const sync = new MessagesSynchronizer(api, {
                store,
                gapCheckDelayMs: 10,
                gapCheckMinIntervalMs: 10,
                ...options
            });
            await sync.sync();
            //the state of the seeding run is of no interest to the assertions
            api.differenceRequests.length = 0;
            store.savedCursors.length = 0;
            return sync;
        };

        it("should advance the cursor by the next seq of the live stream", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);

            sync.applyLiveCursor(cursorEvent(CHAT, 6));

            expect(sync.getCursor(CHAT)).toEqual(6);
            expect(store.cursors[entityKey(CHAT)]).toEqual(6);
            expect(store.savedCursors.map((c) => c.cursor)).toEqual([6]);
            //the whole point: no difference request is needed to move the cursor
            expect(api.differenceRequests.length).toEqual(0);
        });

        it("should follow a run of consecutive seqs", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);

            sync.applyLiveCursor(cursorEvent(CHAT, 6));
            sync.applyLiveCursor(cursorEvent(CHAT, 7));
            sync.applyLiveCursor(cursorEvent(CHAT, 8));

            expect(sync.getCursor(CHAT)).toEqual(8);
            expect(store.savedCursors.map((c) => c.cursor)).toEqual([6, 7, 8]);
            expect(api.differenceRequests.length).toEqual(0);
        });

        it("should ignore a seq that is already covered", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);

            sync.applyLiveCursor(cursorEvent(CHAT, 5));
            sync.applyLiveCursor(cursorEvent(CHAT, 4));
            await wait(30);

            expect(sync.getCursor(CHAT)).toEqual(5);
            expect(store.savedCursors.length).toEqual(0);
            expect(api.differenceRequests.length).toEqual(0);
        });

        it("should ignore an event without a journal seq", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);

            //cursor 0 means the change was not journaled, it is applied but never moves the cursor
            sync.applyLiveCursor(cursorEvent(CHAT, 0));
            await wait(30);

            expect(sync.getCursor(CHAT)).toEqual(5);
            expect(store.savedCursors.length).toEqual(0);
            expect(api.differenceRequests.length).toEqual(0);
        });

        it("should not create a cursor for an untracked entity", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);

            //accepting seq 1 here would claim the whole history of the channel is already cached
            sync.applyLiveCursor(cursorEvent(CHANNEL, 1));
            await wait(30);

            expect(sync.hasCursor(CHANNEL)).toBe(false);
            expect(sync.getCursor(CHANNEL)).toEqual(0);
            expect(store.savedCursors.length).toEqual(0);
            expect(api.differenceRequests.length).toEqual(0);
        });

        it("should leave a gap to a difference request instead of jumping over it", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            api.differences = [difference({messages: [message("m9")], newCursor: 9})];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            //the cursor stays put until the difference confirms what is in between
            expect(sync.getCursor(CHAT)).toEqual(5);

            await wait(50);

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].sinceCursor).toEqual(5);
            expect(sync.getCursor(CHAT)).toEqual(9);
            expect(store.entityMessages(CHAT).map((m) => m.id)).toEqual(["m9"]);
        });

        it("should check a burst of gaps with a single difference", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            api.differences = [difference({newCursor: 20})];

            [9, 11, 14, 17, 20].forEach((cursor) => sync.applyLiveCursor(cursorEvent(CHAT, cursor)));
            await wait(50);

            expect(api.differenceRequests.length).toEqual(1);
            expect(sync.getCursor(CHAT)).toEqual(20);
        });

        it("should not check the same entity more often than the throttle allows", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5, {gapCheckDelayMs: 10, gapCheckMinIntervalMs: 300});
            api.differences = [difference({newCursor: 9}), difference({newCursor: 30})];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            await wait(50);
            expect(api.differenceRequests.length).toEqual(1);

            //gaps are routine in a chat with a private correspondence going on, they must not flood the server
            sync.applyLiveCursor(cursorEvent(CHAT, 30));
            await wait(50);
            expect(api.differenceRequests.length).toEqual(1);

            await wait(350);
            expect(api.differenceRequests.length).toEqual(2);
            expect(sync.getCursor(CHAT)).toEqual(30);
        });

        it("should close a jump left by a read mark of another user with a single check", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            //one click of another member marked forty messages of the channel as read, none of them addressed
            //to this client, so the whole batch is invisible to it and only moves the cursor of the entity
            api.differences = [difference({messages: [], newCursor: 46})];

            sync.applyLiveCursor(cursorEvent(CHAT, 46));
            await wait(50);

            expect(api.differenceRequests.length).toEqual(1);
            expect(api.differenceRequests[0].sinceCursor).toEqual(5);
            expect(sync.getCursor(CHAT)).toEqual(46);
            expect(store.updates.length).toEqual(0);

            //the entity is caught up, the next live event moves the cursor without another check
            sync.applyLiveCursor(cursorEvent(CHAT, 47));
            await wait(30);

            expect(api.differenceRequests.length).toEqual(1);
            expect(sync.getCursor(CHAT)).toEqual(47);
        });

        it("should report a gap through GAP_DETECTED", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            api.differences = [difference({newCursor: 9})];
            const gaps: Array<GapDetected> = [];
            sync.on(MessagesSyncEvent.GAP_DETECTED, (event) => gaps.push(event));

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            await wait(50);

            expect(gaps.length).toEqual(1);
            expect(gaps[0].targetEntityId).toEqual(CHAT.targetEntityId);
            expect(gaps[0].localCursor).toEqual(5);
            expect(gaps[0].eventCursor).toEqual(9);
        });

        it("should keep the cursor when the gap difference fails", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            api.differences = [];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            await wait(50);

            expect(api.differenceRequests.length).toEqual(1);
            expect(sync.getCursor(CHAT)).toEqual(5);
        });

        it("should leave the cursor to the difference in flight", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 5}]);
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 9}]);
            let release: (difference: MessagesDifferenceEvent) => void;
            api.getMessagesDifference = (config: GetMessagesDifferenceConfig) => {
                api.differenceRequests.push(config);
                return new Promise<MessagesDifferenceEvent>((resolve) => release = resolve);
            };

            const sync = new MessagesSynchronizer(api, {store, gapCheckDelayMs: 10, gapCheckMinIntervalMs: 10});
            const run = sync.sync();
            await wait(20);

            //the newCursor of the response was read from the journal before this event was even written
            sync.applyLiveCursor(cursorEvent(CHAT, 6));
            expect(sync.getCursor(CHAT)).toEqual(5);

            release(difference({newCursor: 9}));
            await run;
            expect(sync.getCursor(CHAT)).toEqual(9);

            //the entity is open to the live stream again
            sync.applyLiveCursor(cursorEvent(CHAT, 10));
            expect(sync.getCursor(CHAT)).toEqual(10);
        });

        it("should move the cursor by the events of the attached source", async () => {
            const api = new TestApi();
            const store = new TestStore([{...CHAT, cursor: 5}]);
            api.summaryResponse = summary([]);
            const handlers: { [key: string]: Array<Function> } = {};
            const source = {
                on: (event: SfuEvent, cb: Function) => {
                    handlers[event] = handlers[event] || [];
                    handlers[event].push(cb);
                },
                off: (event: SfuEvent, cb: Function) => {
                    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
                }
            };
            const sync = new MessagesSynchronizer(api, {
                store,
                gapCheckDelayMs: 10,
                gapCheckMinIntervalMs: 10
            }).attach(source);
            await sync.sync();

            handlers[SfuEvent.MESSAGE_CURSOR].forEach((h) => h(cursorEvent(CHAT, 6)));
            expect(sync.getCursor(CHAT)).toEqual(6);

            //a gap is scheduled and then dropped together with the subscription
            handlers[SfuEvent.MESSAGE_CURSOR].forEach((h) => h(cursorEvent(CHAT, 20)));
            sync.detach();

            expect(handlers[SfuEvent.MESSAGE_CURSOR].length).toEqual(0);
            await wait(50);
            expect(api.differenceRequests.length).toEqual(0);
            expect(sync.getCursor(CHAT)).toEqual(6);
        });

        it("should drop the pending gap checks on stop", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5);
            api.differences = [difference({newCursor: 9})];

            sync.applyLiveCursor(cursorEvent(CHAT, 9));
            sync.stop();
            await wait(50);

            expect(api.differenceRequests.length).toEqual(0);
            expect(sync.getCursor(CHAT)).toEqual(5);
        });

        it("should leave the cursors alone when the live cursor is off", async () => {
            const api = new TestApi();
            const store = new TestStore();
            const sync = await tracking(api, store, 5, {liveCursor: false});

            sync.applyLiveCursor(cursorEvent(CHAT, 6));
            await wait(30);

            expect(sync.getCursor(CHAT)).toEqual(5);
            expect(store.savedCursors.length).toEqual(0);
            expect(api.differenceRequests.length).toEqual(0);
        });
    });

    describe("run control", () => {
        it("should reuse the run in progress instead of starting a second one", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            api.differences = [difference({newCursor: 5})];

            const sync = new MessagesSynchronizer(api, {store});
            const [first, second] = await Promise.all([sync.sync(), sync.sync()]);

            expect(api.summaryRequests).toEqual(1);
            expect(first).toBe(second);
        });

        it("should keep the entities of a stopped run for the next one", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([
                {entity: CHAT, currentCursor: 5},
                {entity: CHANNEL, currentCursor: 5}
            ]);
            const sync = new MessagesSynchronizer(api, {store});
            api.getMessagesDifference = async (config: GetMessagesDifferenceConfig) => {
                api.differenceRequests.push(config);
                sync.stop();
                return difference({
                    targetEntityType: config.targetEntityType,
                    targetEntityId: config.targetEntityId,
                    newCursor: 5
                });
            };

            const result = await sync.sync();

            expect(api.differenceRequests.length).toEqual(1);
            expect(result.cancelled).toBe(true);
            expect(result.entities[1].status).toEqual(EntitySyncStatus.CANCELLED);
        });

        it("should let a reconnect start a run while the dropped one still hangs", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([{entity: CHAT, currentCursor: 5}]);
            //the connection went away, the request of the dropped run is never answered
            let requestSent: () => void;
            const firstRequestSent = new Promise<void>((resolve) => requestSent = resolve);
            api.getMessagesDifference = async (config: GetMessagesDifferenceConfig) => {
                api.differenceRequests.push(config);
                if (api.differenceRequests.length === 1) {
                    requestSent();
                    return new Promise<MessagesDifferenceEvent>(() => {
                    });
                }
                return difference({newCursor: 5});
            };

            const sync = new MessagesSynchronizer(api, {store});
            const dropped = sync.sync();
            await firstRequestSent;
            sync.stop();

            const reconnected = sync.sync();
            expect(reconnected).not.toBe(dropped);
            const result = await reconnected;

            expect(result.entities[0].status).toEqual(EntitySyncStatus.SYNCED);
            expect(sync.getCursor(CHAT)).toEqual(5);
        });

        it("should sync on every connect of the attached source", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.summaryResponse = summary([]);
            const handlers: { [key: string]: Array<Function> } = {};
            const source = {
                on: (event: SfuEvent, cb: Function) => {
                    handlers[event] = handlers[event] || [];
                    handlers[event].push(cb);
                },
                off: (event: SfuEvent, cb: Function) => {
                    handlers[event] = (handlers[event] || []).filter((h) => h !== cb);
                }
            };

            const sync = new MessagesSynchronizer(api, {store}).attach(source);
            const completed: Array<any> = [];
            sync.on(MessagesSyncEvent.SYNC_COMPLETED, (result) => completed.push(result));

            handlers[SfuEvent.CONNECTED].forEach((h) => h());
            await sync.sync();
            handlers[SfuEvent.CONNECTED].forEach((h) => h());
            await sync.sync();

            expect(api.summaryRequests).toEqual(2);
            expect(completed.length).toEqual(2);

            sync.detach();
            expect(handlers[SfuEvent.CONNECTED].length).toEqual(0);
        });

        it("should report a failed summary through SYNC_FAILED", async () => {
            const api = new TestApi();
            const store = new TestStore();
            api.getChatsSyncSummary = async () => {
                throw new Error("boom");
            };

            const sync = new MessagesSynchronizer(api, {store});
            const failures: Array<any> = [];
            sync.on(MessagesSyncEvent.SYNC_FAILED, (event) => failures.push(event));

            await expect(sync.sync()).rejects.toThrow("boom");
            expect(failures.length).toEqual(1);
            //the run is released, a later attempt can start
            api.getChatsSyncSummary = async () => summary([]);
            await expect(sync.sync()).resolves.toEqual({entities: [], cancelled: false});
        });
    });
});
