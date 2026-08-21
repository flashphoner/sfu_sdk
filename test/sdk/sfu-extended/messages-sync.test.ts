import {TEST_USER_0, TEST_USER_1, MESSAGE_REACTION} from "../../util/constants";
import {
    ChatCursor,
    DeliveryStatus,
    GetMessagesDifferenceConfig,
    Message,
    MessageCursorEvent,
    MessagesDifferenceEvent,
    MessageState,
    MessageStatus,
    MessageTargetEntityType,
    SfuEvent,
    UserSpecificChatInfo
} from "../../../src/sdk/constants";
import {SfuExtended} from "../../../src";
import {
    EntitySyncStatus,
    entityKey,
    MessagesSyncApi,
    MessagesSynchronizer,
    MessagesSyncStore,
    MessagesSyncUpdate,
    StoredCursor,
    SyncEntity
} from "../../../src/sdk/messages-sync";
import {connect, waitForEvent, waitForUsers, waitUntil} from "../../util/utils";

const MESSAGE_BODY = "test message";

//a run costs a summary and a difference round trip on top of the messages the test itself sends
jest.setTimeout(30000);

/**
 * Stand in for the persistent cache of the client
 */
class MemoryStore implements MessagesSyncStore {
    messages: Map<string, Map<string, Message>> = new Map<string, Map<string, Message>>();
    cursors: Map<string, StoredCursor> = new Map<string, StoredCursor>();
    resyncs = 0;

    getCursors(): Array<StoredCursor> {
        return Array.from(this.cursors.values());
    }

    applyMessages(update: MessagesSyncUpdate) {
        const key = entityKey(update);
        if (update.resync) {
            this.resyncs++;
            this.messages.set(key, new Map<string, Message>());
        }
        if (!this.messages.has(key)) {
            this.messages.set(key, new Map<string, Message>());
        }
        update.messages.forEach((msg) => this.messages.get(key).set(msg.id, msg));
    }

    saveCursor(cursor: StoredCursor) {
        this.cursors.set(entityKey(cursor), cursor);
    }

    get(entity: SyncEntity, messageId: string): Message {
        const stored = this.messages.get(entityKey(entity));
        return stored ? stored.get(messageId) : undefined;
    }

    size(entity: SyncEntity): number {
        const stored = this.messages.get(entityKey(entity));
        return stored ? stored.size : 0;
    }

    cursor(entity: SyncEntity): number {
        const stored = this.cursors.get(entityKey(entity));
        return stored ? stored.cursor : 0;
    }
}

const chatEntity = (chatId: string): SyncEntity => ({
    targetEntityType: MessageTargetEntityType.CHAT,
    targetEntityId: {chatId}
});

/**
 * The transport of the synchronizer with the difference requests counted: the live cursor is only worth
 * something as long as it keeps the client from asking for a difference
 */
const countingApi = (sfu: SfuExtended) => {
    const calls = {differences: 0, summaries: 0};
    const api: MessagesSyncApi = {
        getChatsSyncSummary: () => {
            calls.summaries++;
            return sfu.getChatsSyncSummary();
        },
        getMessagesDifference: (config: GetMessagesDifferenceConfig) => {
            calls.differences++;
            return sfu.getMessagesDifference(config);
        },
        loadMessages: (params: any) => sfu.loadMessages(params)
    };
    return {api, calls};
};

describe("messages sync", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    let chat: UserSpecificChatInfo;
    let entity: SyncEntity;

    /**
     * The account of the test user keeps the chats of every other suite, and a run without a filter would read
     * all of them from the beginning of their journals. Every run here is about the chat of the test.
     */
    const onlyThisChat = (cursor: ChatCursor) => !!cursor.targetEntityId && cursor.targetEntityId.chatId === chat.id;

    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
        chat = await bob.createChat({members: [TEST_USER_1.username]});
        entity = chatEntity(chat.id);
    });

    afterEach(async () => {
        try {
            await bob.deleteChat({id: chat.id});
        } catch (e) {
        }
        await bob.disconnect();
        await alice.disconnect();
    });

    describe("transport", () => {
        it("Should return a cursor of every entity of the user", async () => {
            await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            const summary = await bob.getChatsSyncSummary();

            expect(summary).toBeTruthy();
            expect(summary.type).toEqual(SfuEvent.CHATS_SYNC_SUMMARY);
            expect(Array.isArray(summary.cursors)).toBe(true);
            const cursor = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
            expect(cursor).toBeTruthy();
            expect(cursor.targetEntityType).toEqual(MessageTargetEntityType.CHAT);
            expect(cursor.currentCursor).toBeGreaterThan(0);
        });

        it("Should return the difference from an empty cursor", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            const difference: MessagesDifferenceEvent = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });

            expect(difference.type).toEqual(SfuEvent.MESSAGES_DIFFERENCE);
            expect(difference.targetEntityId.chatId).toEqual(chat.id);
            expect(difference.resyncRequired).toBe(false);
            expect(difference.newCursor).toBeGreaterThan(0);
            expect(difference.messages.map((m) => m.id)).toContain(sent.id);
        });

        it("Should return nothing for an up to date cursor", async () => {
            await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const first = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });

            const second = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: first.newCursor
            });

            expect(second.messages.length).toEqual(0);
            expect(second.hasMore).toBe(false);
            expect(second.newCursor).toBeGreaterThanOrEqual(first.newCursor);
        });

        it("Should paginate by limit", async () => {
            for (let i = 0; i < 3; i++) {
                await bob.sendMessage({
                    body: MESSAGE_BODY + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
            }

            const page = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0,
                limit: 1
            });

            expect(page.messages.length).toEqual(1);
            expect(page.hasMore).toBe(true);
            expect(page.newCursor).toBeGreaterThan(0);
        });

        it("Should deliver a read mark to the author of the message", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const before = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });

            await alice.markMessageRead({
                id: sent.id,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            let read: Message;
            await waitUntil(async () => {
                const difference = await bob.getMessagesDifference({
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id},
                    sinceCursor: before.newCursor,
                    cachedRanges: [{from: sent.date, to: sent.date}]
                });
                read = difference.messages.find((m) => m.id === sent.id);
                return !!read;
            });

            expect(read.deliveryStatus[TEST_USER_1.username]).toEqual(DeliveryStatus.READ);
        });

        it("Should not deliver a status change of a message outside the cached ranges", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const before = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });

            await alice.markMessageRead({
                id: sent.id,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            //the client holds an older range of the chat only, the change has nothing to update there
            await waitUntil(async () => {
                const summary = await bob.getChatsSyncSummary();
                const cursor = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
                return !!cursor && cursor.currentCursor > before.newCursor;
            });

            const difference = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: before.newCursor,
                cachedRanges: [{from: 1, to: sent.date - 1}]
            });

            expect(difference.messages.map((m) => m.id)).not.toContain(sent.id);
            //the cursor still moves over the filtered out records, the client does not read them twice
            expect(difference.newCursor).toBeGreaterThan(before.newCursor);
        });

        it("Should not deliver a status change of a message of another user", async () => {
            const sent = await alice.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const before = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });
            expect(before.messages.map((m) => m.id)).toContain(sent.id);

            //bob is the reader here, the status of the message belongs to its author
            await bob.markMessageRead({
                id: sent.id,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(async () => {
                const summary = await bob.getChatsSyncSummary();
                const cursor = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
                return !!cursor && cursor.currentCursor > before.newCursor;
            });

            const difference = await bob.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: before.newCursor,
                cachedRanges: [{from: sent.date, to: sent.date}]
            });

            expect(difference.messages.map((m) => m.id)).not.toContain(sent.id);
        });

        it("Should not deliver private messages of other users", async () => {
            await bob.sendMessage({
                body: "private for bob",
                to: TEST_USER_0.username,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            const difference = await alice.getMessagesDifference({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                sinceCursor: 0
            });

            expect(difference.messages.filter((m) => m.body === "private for bob").length).toEqual(0);
        });
    });

    describe("synchronizer", () => {
        it("Should fill an empty cache from an empty cursor", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});

            const result = await sync.sync();

            expect(store.get(entity, sent.id)).toBeTruthy();
            expect(store.get(entity, sent.id).body).toEqual(MESSAGE_BODY);
            expect(store.cursor(entity)).toBeGreaterThan(0);
            expect(sync.getCursor(entity)).toEqual(store.cursor(entity));
            expect(result.entities.find((e) => e.targetEntityId.chatId === chat.id).status)
                .toEqual(EntitySyncStatus.SYNCED);
        });

        it("Should deliver an edit of an old message after a fresh cursor", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});
            await sync.sync();
            const cursorAfterFirstRun = store.cursor(entity);

            //the message is old, only its journal record is fresh
            await bob.editMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id,
                body: "edited body"
            });
            await sync.sync();

            const stored = store.get(entity, sent.id);
            expect(stored.body).toEqual("edited body");
            expect(stored.edited).toBe(true);
            expect(store.cursor(entity)).toBeGreaterThan(cursorAfterFirstRun);
            //replacement by id, not an append
            expect(store.size(entity)).toEqual(1);
        });

        it("Should deliver a reaction as an updated message state", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});
            await sync.sync();

            await alice.addReactionOnMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id,
                reaction: MESSAGE_REACTION
            });
            await sync.sync();

            const stored = store.get(entity, sent.id);
            expect(stored.reactions.length).toBeGreaterThan(0);
            expect(stored.reactions[0].reaction).toEqual(MESSAGE_REACTION);
            expect(stored.reactions[0].reactedUsers).toContain(TEST_USER_1.username);
        });

        it("Should deliver a deletion as an updated message state", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});
            await sync.sync();

            await bob.deleteMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id
            });
            await sync.sync();

            const stored = store.get(entity, sent.id);
            expect(stored).toBeTruthy();
            expect(stored.status).toEqual(MessageState.DELETED);
        });

        it("Should catch up what was missed while the socket was down", async () => {
            const store = new MemoryStore();
            let sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});
            await sync.sync();
            const cursorBefore = store.cursor(entity);

            await bob.disconnect();
            const missed = await alice.sendMessage({
                body: "sent while bob was away",
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            bob = await connect(TEST_USER_0);
            sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat});
            await sync.sync();

            expect(store.get(entity, missed.id)).toBeTruthy();
            expect(store.get(entity, missed.id).body).toEqual("sent while bob was away");
            expect(store.cursor(entity)).toBeGreaterThan(cursorBefore);
            expect(store.resyncs).toEqual(0);
        });

        it("Should keep applying live messages while a background difference is running", async () => {
            //a fair amount of history to make the background run take more than one page
            for (let i = 0; i < 20; i++) {
                await bob.sendMessage({
                    body: MESSAGE_BODY + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
            }
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, limit: 1, entityFilter: onlyThisChat});

            const live = waitForEvent<Message>(bob, SfuEvent.MESSAGE, (msg) => msg.body === "live one");
            const background = sync.sync();
            const sent = await alice.sendMessage({
                body: "live one",
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            //the live notification arrives without waiting for the background run to finish
            const delivered = await live;
            expect(delivered.id).toEqual(sent.id);

            const result = await background;
            expect(result.entities.find((e) => e.targetEntityId.chatId === chat.id).pages)
                .toBeGreaterThan(1);
        });

        it("Should keep the cursor of an entity nobody tracks untouched", async () => {
            const store = new MemoryStore();
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat}).attach(bob);
            //no run, so the chat is unknown to the synchronizer, and a live event may not invent a cursor for it
            //the waiter is registered before the send: the notification may arrive before sendMessage resolves
            const delivered = waitForEvent<Message>(bob, SfuEvent.MESSAGE, (msg) => msg.body === MESSAGE_BODY);
            await alice.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await delivered;

            expect(sync.hasCursor(entity)).toBe(false);
            expect(store.cursor(entity)).toEqual(0);
            sync.detach();
        });

        it("Should sync on connect when attached", async () => {
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            const store = new MemoryStore();
            await bob.disconnect();

            bob = await connect(TEST_USER_0);
            const sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat}).attach(bob);
            //attach covers the reconnects, the run of the connect that already happened is triggered here
            await sync.sync();

            await waitUntil(() => !!store.get(entity, sent.id));
            expect(store.cursor(entity)).toBeGreaterThan(0);
            sync.detach();
        });
    });

    /**
     * The cursor follows the live stream, so a client that works without a disconnect has nothing to catch up
     * on afterwards. Needs a server with a replica set, otherwise the journal seq degrades to a striped lock
     * and consecutive numbers are not guaranteed.
     *
     * One action does not mean one seq: a message of somebody else is journaled along with the delivery
     * status entries it produces, and those are addressed to the authors of the messages they concern. What
     * is asserted here is therefore convergence with the server cursor and the absence of difference
     * requests, not an exact step — the step is the server's business, the cost is the client's.
     */
    describe("live cursor", () => {
        let store: MemoryStore;
        let sync: MessagesSynchronizer;
        let calls: { differences: number, summaries: number };

        /**
         * Journal position of the chat as the server sees it. Read through bob's own connection rather than
         * through the counted api, so checking it is not itself a difference request.
         */
        const serverCursor = async () => {
            const summary = await bob.getChatsSyncSummary();
            const current = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
            return current ? current.currentCursor : 0;
        };

        /**
         * Waits until the local cursor catches up with the server one, which is what the live cursor is for
         */
        const converged = () => waitUntil(async () => sync.getCursor(entity) === await serverCursor());

        /**
         * A synchronizer that already knows the chat, with the difference requests counted from that point on
         */
        const tracking = async () => {
            //an entity without journal records is not part of a run, so seed it with a message first
            await bob.sendMessage({
                body: "seed",
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            store = new MemoryStore();
            const counting = countingApi(bob);
            calls = counting.calls;
            sync = new MessagesSynchronizer(counting.api, {store, entityFilter: onlyThisChat}).attach(bob);
            await sync.sync();
            expect(sync.hasCursor(entity)).toBe(true);
            return sync.getCursor(entity);
        };

        afterEach(() => {
            if (sync) {
                sync.detach();
                sync = null;
            }
        });

        it("Should move the cursor by an incoming message without a difference request", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;

            await alice.sendMessage({
                body: "live one",
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(() => sync.getCursor(entity) > before);
            await converged();

            expect(store.cursor(entity)).toEqual(sync.getCursor(entity));
            expect(calls.differences).toEqual(differencesBefore);
        });

        it("Should move the cursor by an own reaction", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;
            const sent = await alice.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(() => sync.getCursor(entity) > before);
            const afterMessage = sync.getCursor(entity);

            //an own change answers a pending promise instead of reaching the subscribers, the cursor moves anyway
            await bob.addReactionOnMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id,
                reaction: MESSAGE_REACTION
            });
            await waitUntil(() => sync.getCursor(entity) > afterMessage);
            await converged();

            expect(store.cursor(entity)).toEqual(sync.getCursor(entity));
            expect(calls.differences).toEqual(differencesBefore);
        });

        /**
         * The remaining half of §2.2: an own send and an own edit are both answered with MESSAGE_STATE, and it
         * carries the journal seq, so the cursor of the acting client keeps up with its own writes instead of
         * stalling until the next change of somebody else.
         */
        it("Should move the cursor by an own message and edit", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(() => sync.getCursor(entity) > before);
            const afterSend = sync.getCursor(entity);

            await bob.editMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id,
                body: "edited body"
            });
            await waitUntil(() => sync.getCursor(entity) > afterSend);
            await converged();

            expect(store.cursor(entity)).toEqual(sync.getCursor(entity));
            expect(calls.differences).toEqual(differencesBefore);
        });

        /**
         * Regression: sending a message journals the message first and its delivery statuses right after,
         * while the seq of the message itself reaches its author only with the answer. A watermark sent in
         * between carried the author past its own message, and a client that fills its cache from the
         * journal never saw that message again — the difference starts beyond it, and nothing in the
         * protocol reports the hole.
         *
         * What the author must observe is therefore an order: the seq of its own message arrives before any
         * watermark that covers it.
         */
        it("Should not let a watermark overtake the answer to an own send", async () => {
            await tracking();
            const seen: Array<MessageCursorEvent> = [];
            const collect = (event: MessageCursorEvent) => {
                if (entityKey(event) === entityKey(entity)) {
                    seen.push(event);
                }
            };
            bob.on(SfuEvent.MESSAGE_CURSOR, collect);
            try {
                await bob.sendMessage({
                    body: "own message that must survive",
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
                await converged();
            } finally {
                bob.off(SfuEvent.MESSAGE_CURSOR, collect);
            }

            const own = seen.find((event) => !event.watermark);
            expect(own).toBeTruthy();
            const overtaking = seen.slice(0, seen.indexOf(own)).filter((event) => event.cursor >= own.cursor);
            expect(overtaking).toEqual([]);
        });

        /**
         * The last gap of §2.2 and it is not in the SDK's hands: an own deleteMessage is answered with a bare ACK.
         * It does carry the journal seq, but nothing else — no target entity, no message id — so there is nothing
         * to attribute the cursor to. Unskip once zapp-server answers an own deletion with CHAT_MESSAGE_DELETED
         * (or stamps the entity onto the ACK). Until then the cursor of the deleting client stalls until the next
         * change, which reads as a gap and is closed by a single difference request.
         */
        it.skip("Should move the cursor by an own deletion", async () => {
            const before = await tracking();
            const sent = await bob.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(() => sync.getCursor(entity) > before);
            const afterSend = sync.getCursor(entity);

            await bob.deleteMessage({
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id},
                messageId: sent.id
            });
            await waitUntil(() => sync.getCursor(entity) > afterSend);

            expect(sync.getCursor(entity)).toEqual(afterSend + 1);
        });

        /**
         * A read mark is journaled and consumes a seq, but the status event it produces goes to the author of
         * the message alone. The reader would be left behind by exactly that seq, and the next change of
         * anybody else would read as a gap — the watermark is what carries it over instead.
         */
        it("Should move the cursor of the reader by a watermark of a read status", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;
            const sent = await alice.sendMessage({
                body: MESSAGE_BODY,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await waitUntil(() => sync.getCursor(entity) > before);
            const afterMessage = sync.getCursor(entity);

            const status = waitForEvent(alice, SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS);
            await bob.markMessageRead({
                id: sent.id,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await status;
            await waitUntil(() => sync.getCursor(entity) > afterMessage);
            await converged();

            expect(store.cursor(entity)).toEqual(sync.getCursor(entity));
            expect(calls.differences).toEqual(differencesBefore);
        });

        /**
         * A range mark reserves one consecutive seq range for the whole batch, so the members it does not
         * reach are carried over it by a single watermark rather than one per touched message.
         */
        it("Should move the cursor over a bulk read mark without a difference request", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;
            let last: MessageStatus;
            for (let i = 0; i < 5; i++) {
                last = await alice.sendMessage({
                    body: MESSAGE_BODY + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
            }
            await waitUntil(() => sync.getCursor(entity) > before);
            await converged();
            const afterMessages = sync.getCursor(entity);

            const status = waitForEvent(alice, SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS);
            await bob.markMessageRead({
                id: last.id,
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });
            await status;
            await waitUntil(() => sync.getCursor(entity) > afterMessages);
            await converged();

            expect(calls.differences).toEqual(differencesBefore);
        });

        it("Should converge with the server after a reconnect", async () => {
            await tracking();
            await bob.disconnect();
            const missed = await alice.sendMessage({
                body: "sent while bob was away",
                targetEntityType: MessageTargetEntityType.CHAT,
                targetEntityId: {chatId: chat.id}
            });

            bob = await connect(TEST_USER_0);
            sync.detach();
            sync = new MessagesSynchronizer(bob, {store, entityFilter: onlyThisChat}).attach(bob);
            await sync.sync();

            expect(store.get(entity, missed.id)).toBeTruthy();
            const summary = await bob.getChatsSyncSummary();
            const current = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
            expect(sync.getCursor(entity)).toEqual(current.currentCursor);
        });

        it("Should have nothing to catch up on after a session without disconnects", async () => {
            const before = await tracking();
            for (let i = 0; i < 3; i++) {
                await alice.sendMessage({
                    body: MESSAGE_BODY + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
                await waitUntil(() => sync.getCursor(entity) >= before + i + 1);
            }
            await waitUntil(async () => {
                const summary = await bob.getChatsSyncSummary();
                const current = summary.cursors.find((c) => c.targetEntityId && c.targetEntityId.chatId === chat.id);
                return sync.getCursor(entity) === current.currentCursor;
            });
            const differencesBefore = calls.differences;

            //this is what the whole thing is for: a start after an uninterrupted session finds nothing to pull
            await sync.sync();

            expect(calls.differences).toEqual(differencesBefore);
        });

        /**
         * The whole point, on the traffic the feature exists for: a conversation where both sides send and
         * read. Every read mark journals an entry addressed to somebody else, so without the watermarks this
         * costs a difference request per exchange.
         */
        it("Should keep up with a two-sided conversation without a single difference request", async () => {
            const before = await tracking();
            const differencesBefore = calls.differences;

            for (let i = 0; i < 3; i++) {
                const fromAlice = await alice.sendMessage({
                    body: "alice " + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
                await bob.markMessageRead({
                    id: fromAlice.id,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
                const fromBob = await bob.sendMessage({
                    body: "bob " + i,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
                await alice.markMessageRead({
                    id: fromBob.id,
                    targetEntityType: MessageTargetEntityType.CHAT,
                    targetEntityId: {chatId: chat.id}
                });
            }
            await waitUntil(() => sync.getCursor(entity) > before);
            await converged();

            expect(store.cursor(entity)).toEqual(sync.getCursor(entity));
            expect(calls.differences).toEqual(differencesBefore);
        });
    });
});
