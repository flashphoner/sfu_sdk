import {
    ChatCursor,
    ChatsSyncSummaryEvent,
    DEFAULT_MESSAGES_DIFFERENCE_LIMIT,
    GetMessagesDifferenceConfig,
    MAX_CACHED_RANGES,
    Message,
    MessageCursorEvent,
    MessagesDifferenceEvent,
    MessageTargetEntityId,
    MessageTargetEntityType,
    SfuEvent
} from "./constants";
import {Notifier} from "./notifier";
import Logger, {Verbosity} from "./logger";

/**
 * Catch up synchronization layer.
 *
 * Live notifications ({@link SfuEvent.MESSAGE} and friends) and the message journal are two independent
 * delivery paths. This layer drives the journal one: on start and on every reconnect it asks the server for
 * the cursor summary, compares it with the locally known cursors and pulls the difference of every diverging
 * entity in the background.
 *
 * The layer keeps cursors of the current session in memory only, persisting them is up to the client through
 * {@link MessagesSyncStore}. Applying a difference means replacing the local copy of every message by its id:
 * the server sends the actual state of the message, not a description of the change, so the order in which
 * responses are applied does not matter.
 *
 * Live notifications carry the journal seq of the change as well ({@link SfuEvent.MESSAGE_CURSOR}), so the
 * cursor of an entity moves along with the live stream instead of freezing between reconnects. A client that
 * worked a whole day without a disconnect starts the next session with nothing to catch up on.
 */

/**
 * Entity of the message journal: a direct chat, a channel or a thread
 */
export type SyncEntity = {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
}

/**
 * Locally stored cursor of an entity
 */
export type StoredCursor = SyncEntity & {
    cursor: number;
}

/**
 * A batch of messages to upsert into the local cache
 *
 * @param messages actual state of every changed message, replace the local copy by id
 * @param resync batch is the result of a full reload, the previous content of the entity is stale
 */
export type MessagesSyncUpdate = SyncEntity & {
    messages: Array<Message>;
    resync: boolean;
}

/**
 * Bounds of a contiguous range of messages the client holds for an entity: the whole cache of the entity
 * for {@link MessagesSyncStore.getCachedWindow}, one interval of it for
 * {@link MessagesSyncStore.getCachedRanges}.
 *
 * Both bounds are server dates of messages ({@link Message.date}), not client ones.
 */
export type CachedWindow = {
    /** Server date of the oldest cached message, 0 — the cache reaches the beginning of the entity */
    from: number;
    /** Server date of the newest cached message, 0 — the cache reaches the present */
    to: number;
}

/**
 * Hooks to the local cache of the client.
 *
 * Every method may be synchronous or return a promise, the synchronizer awaits the result before moving
 * the cursor further.
 */
export interface MessagesSyncStore {
    /**
     * Cursors known to the client, read once per synchronization run
     */
    getCursors(): Array<StoredCursor> | Promise<Array<StoredCursor>>;

    /**
     * Upsert messages by id. Called once per difference page, and once per entity on a full resync.
     */
    applyMessages(update: MessagesSyncUpdate): void | Promise<void>;

    /**
     * Persist the new cursor of an entity. Called after the whole difference page is applied.
     */
    saveCursor(cursor: StoredCursor): void | Promise<void>;

    /**
     * Bounds of the contiguous range of messages the client holds for the entity, read once per entity and
     * per synchronization run.
     *
     * Changes outside the window are not sent: the client has nothing to update, and it will read that
     * range in its current state whenever it loads it. Not implementing the method means the whole
     * history, which is only correct for a client that caches entities in full.
     *
     * Ignored when {@link getCachedRanges} is implemented.
     */
    getCachedWindow?(entity: SyncEntity): CachedWindow | Promise<CachedWindow>;

    /**
     * Every interval of the entity the client holds, for a cache that is not one contiguous range: a jump
     * to a search result or to a quotation leaves the cache with a hole no single window can describe.
     *
     * Read once per entity and per synchronization run, exactly like {@link getCachedWindow}, and takes
     * priority over it. The intervals must be sorted by {@link CachedWindow.from} and must not overlap,
     * and there must be at most {@link MAX_CACHED_RANGES} of them: the client collapses the excess ones
     * by gluing the small holes shut, which always widens the coverage rather than narrows it.
     *
     * An interval must not appear here before its messages are loaded. The cursor of the entity has long
     * passed the journal records of a newly cached range, so the difference will never return them and the
     * protocol carries no sign of the loss: a range joins the coverage and gets loaded by a
     * {@link MessagesSyncApi.loadMessages} of its own as a single operation. Dropping a range out of the
     * coverage needs no such care.
     */
    getCachedRanges?(entity: SyncEntity): Array<CachedWindow> | Promise<Array<CachedWindow>>;
}

export enum MessagesSyncEvent {
    /** Used to receive {@link SyncStarted} */
    SYNC_STARTED = "SYNC_STARTED",
    /** Used to receive {@link EntitySyncResult} */
    ENTITY_SYNCED = "ENTITY_SYNCED",
    /** Used to receive {@link SyncResult} */
    SYNC_COMPLETED = "SYNC_COMPLETED",
    /** Used to receive {@link SyncFailed} */
    SYNC_FAILED = "SYNC_FAILED",
    /** Used to receive {@link GapDetected} */
    GAP_DETECTED = "GAP_DETECTED"
}

export enum EntitySyncStatus {
    /** Difference was pulled and applied */
    SYNCED = "SYNCED",
    /** Entity was fully reloaded because the client fell behind the journal retention */
    RESYNCED = "RESYNCED",
    /** Difference request failed, the cursor is left where it was */
    FAILED = "FAILED",
    /** Synchronization was stopped before the entity was processed */
    CANCELLED = "CANCELLED"
}

export type EntitySyncResult = SyncEntity & {
    status: EntitySyncStatus;
    /** Cursor of the entity after the run */
    cursor: number;
    /** Number of difference pages requested */
    pages: number;
    /** Number of messages handed over to {@link MessagesSyncStore.applyMessages} */
    appliedMessages: number;
    error?: any;
}

export type SyncStarted = {
    entities: number;
}

export type SyncResult = {
    entities: Array<EntitySyncResult>;
    /** Run was interrupted by {@link MessagesSynchronizer.stop} or by a disconnect */
    cancelled: boolean;
}

export type SyncFailed = {
    error: any;
}

/**
 * A live event brought a journal seq the local cursor cannot reach in one step.
 *
 * Purely informational: a gap is not a loss. Records are numbered atomically but delivered out of order, and
 * changes addressed to other members consume numbers this client never sees. The synchronizer checks such an
 * entity with a difference request of its own, see {@link MessagesSyncOptions.gapCheckDelayMs}.
 *
 * A server that sends cursor watermarks closes the second kind on its own, so what is left here is genuinely
 * out of order delivery — rare, and worth a difference request.
 */
export type GapDetected = SyncEntity & {
    localCursor: number;
    eventCursor: number;
}

/**
 * Transport used by the synchronizer, implemented by SfuExtended
 */
export interface MessagesSyncApi {
    getChatsSyncSummary(): Promise<ChatsSyncSummaryEvent>;

    getMessagesDifference(config: GetMessagesDifferenceConfig): Promise<MessagesDifferenceEvent>;

    loadMessages(params: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
        timeFrame?: {
            start: number,
            end: number,
            limit?: number
        }
    }): Promise<Array<Message>>;
}

/**
 * Event source used by {@link MessagesSynchronizer.attach}, implemented by SfuExtended
 */
export interface MessagesSyncEventSource {
    on(event: SfuEvent, callback: (arg0?: any) => void): unknown;

    off(event: SfuEvent, callback: (arg0?: any) => void): unknown;
}

export type MessagesSyncOptions = {
    store: MessagesSyncStore;
    /**
     * Decides whether a diverging entity takes part in a run, called once per entity of the summary.
     *
     * An entity the client has no cursor for would otherwise be read from the beginning of the journal,
     * which is a whole history rather than a catch up. A client that loads such entities lazily, on
     * opening them, filters them out here and lets a full loadMessages seed the cursor instead.
     *
     * @param cursor entity and its current server cursor
     * @param localCursor cursor of the entity known to the synchronizer, 0 when there is none
     */
    entityFilter?: (cursor: ChatCursor, localCursor: number) => boolean;
    /** Page size of a difference request, 0 to use the server default */
    limit?: number;
    /** How many entities are pulled at the same time. Kept low to leave the connection to the live stream. */
    concurrency?: number;
    /** Safety limit of difference pages per entity and per run */
    maxPagesPerEntity?: number;
    /** Advance cursors from live events. Default true. */
    liveCursor?: boolean;
    /** Debounce before a gap in the live stream is checked with a difference request. Default 300 ms. */
    gapCheckDelayMs?: number;
    /** Minimum interval between gap triggered difference requests of the same entity. Default 30000 ms. */
    gapCheckMinIntervalMs?: number;
    logLevel?: Verbosity;
}

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_PAGES_PER_ENTITY = 1000;
const DEFAULT_GAP_CHECK_DELAY_MS = 300;
//an older server sends no watermarks, and there delivery status changes consume journal numbers this
//client never sees, which makes gaps a routine event rather than a sign of a lost record
const DEFAULT_GAP_CHECK_MIN_INTERVAL_MS = 30000;

/**
 * A single synchronization run and its cancellation flag.
 *
 * A run is cancelled per instance rather than through a shared flag: a disconnect drops the run whose
 * requests will never be answered, while the run started by the following connect keeps going.
 */
type SyncRun = {
    promise: Promise<SyncResult>;
    cancelled: boolean;
}


// TODO zapp-1260 ?
/**
 * Envelope of the declared intervals: the narrowest single window covering all of them.
 *
 * Used to collapse a list the store let grow past {@link MAX_CACHED_RANGES}. The asymmetry it relies on:
 * declaring a coverage wider than it is only brings records the client drops, declaring a narrower one
 * loses changes with no sign of the loss.
 */
function coverageEnvelope(ranges: Array<CachedWindow>): CachedWindow {
    let from = ranges[0].from;
    let to = ranges[0].to;
    for (const range of ranges) {
        //0 is the open end on both sides: the beginning of the entity for from, the present for to
        from = from === 0 || range.from === 0 ? 0 : Math.min(from, range.from);
        to = to === 0 || range.to === 0 ? 0 : Math.max(to, range.to);
    }
    return {from, to};
}

/**
 * Key of an entity, stable across sessions. Handy as a key of a cursor map on the client side too.
 */
export function entityKey(entity: SyncEntity): string {
    const id = entity.targetEntityId || {};
    switch (entity.targetEntityType) {
        case MessageTargetEntityType.CHAT:
            return `${MessageTargetEntityType.CHAT}:${id.chatId}`;
        case MessageTargetEntityType.CHANNEL:
            return `${MessageTargetEntityType.CHANNEL}:${id.spaceId}/${id.channelId}`;
        case MessageTargetEntityType.THREAD:
            return `${MessageTargetEntityType.THREAD}:${id.spaceId}/${id.channelId}/${id.threadId}`;
        default:
            return `${entity.targetEntityType}:${id.chatId}/${id.spaceId}/${id.channelId}/${id.threadId}`;
    }
}

export class MessagesSynchronizer {

    #api: MessagesSyncApi;
    #store: MessagesSyncStore;
    #entityFilter: (cursor: ChatCursor, localCursor: number) => boolean;
    #limit: number;
    #concurrency: number;
    #maxPagesPerEntity: number;
    #liveCursor: boolean;
    #gapCheckDelayMs: number;
    #gapCheckMinIntervalMs: number;
    #logger: Logger = new Logger();
    #notifier: Notifier<MessagesSyncEvent, object> = new Notifier<MessagesSyncEvent, object>();

    #cursors: Map<string, number> = new Map<string, number>();

    #syncing: Map<string, number> = new Map<string, number>();

    /** Pending gap checks, at most one per entity */
    #gapTimers: Map<string, ReturnType<typeof setTimeout>> = new Map<string, ReturnType<typeof setTimeout>>();
    /** When the last gap triggered difference of an entity was started */
    #lastGapCheck: Map<string, number> = new Map<string, number>();
    #activeEntityKey: string = null;
    #run: SyncRun = null;
    #source: MessagesSyncEventSource = null;
    #onConnected = () => {
        this.sync().catch(() => {
            //error is reported through MessagesSyncEvent.SYNC_FAILED
        });
    };
    #onDisconnected = () => {
        this.stop();
    };
    #onMessageCursor = (event: MessageCursorEvent) => {
        this.applyLiveCursor(event);
    };

    constructor(api: MessagesSyncApi, options: MessagesSyncOptions) {
        if (!api) {
            throw new TypeError("No api provided");
        }
        if (!options || !options.store) {
            throw new TypeError("No store provided");
        }
        this.#api = api;
        this.#store = options.store;
        this.#entityFilter = options.entityFilter;
        this.#limit = options.limit !== undefined ? options.limit : DEFAULT_MESSAGES_DIFFERENCE_LIMIT;
        this.#concurrency = options.concurrency && options.concurrency > 0 ? options.concurrency : DEFAULT_CONCURRENCY;
        this.#maxPagesPerEntity = options.maxPagesPerEntity && options.maxPagesPerEntity > 0
            ? options.maxPagesPerEntity
            : DEFAULT_MAX_PAGES_PER_ENTITY;
        this.#liveCursor = options.liveCursor !== undefined ? !!options.liveCursor : true;
        this.#gapCheckDelayMs = options.gapCheckDelayMs !== undefined && options.gapCheckDelayMs >= 0
            ? options.gapCheckDelayMs
            : DEFAULT_GAP_CHECK_DELAY_MS;
        this.#gapCheckMinIntervalMs = options.gapCheckMinIntervalMs !== undefined && options.gapCheckMinIntervalMs >= 0
            ? options.gapCheckMinIntervalMs
            : DEFAULT_GAP_CHECK_MIN_INTERVAL_MS;
        this.#logger.setVerbosity(options.logLevel ? options.logLevel : Verbosity.ERROR);
    }

    /**
     * Run the synchronization on every connect and reconnect of the passed source, and move cursors along
     * with the live stream of that source.
     *
     * The first run happens on the nearest {@link SfuEvent.CONNECTED}, so attach before connecting.
     */
    public attach(source: MessagesSyncEventSource): MessagesSynchronizer {
        if (!source) {
            throw new TypeError("No source provided");
        }
        this.detach();
        this.#source = source;
        source.on(SfuEvent.CONNECTED, this.#onConnected);
        source.on(SfuEvent.DISCONNECTED, this.#onDisconnected);
        source.on(SfuEvent.CONNECTION_FAILED, this.#onDisconnected);
        if (this.#liveCursor) {
            source.on(SfuEvent.MESSAGE_CURSOR, this.#onMessageCursor);
        }
        return this;
    }

    public detach(): MessagesSynchronizer {
        if (this.#source) {
            this.#source.off(SfuEvent.CONNECTED, this.#onConnected);
            this.#source.off(SfuEvent.DISCONNECTED, this.#onDisconnected);
            this.#source.off(SfuEvent.CONNECTION_FAILED, this.#onDisconnected);
            this.#source.off(SfuEvent.MESSAGE_CURSOR, this.#onMessageCursor);
            this.#source = null;
        }
        this.#cancelGapChecks();
        return this;
    }

    /**
     * Entity to synchronize first, normally the chat the user is looking at
     */
    public setActiveEntity(entity: SyncEntity): MessagesSynchronizer {
        this.#activeEntityKey = entity ? entityKey(entity) : null;
        return this;
    }

    /**
     * Cursor of an entity as it is known to the current session
     */
    public getCursor(entity: SyncEntity): number {
        const cursor = this.#cursors.get(entityKey(entity));
        return cursor === undefined ? 0 : cursor;
    }

    /**
     * Whether the entity is tracked at all.
     *
     * {@link getCursor} returns 0 both for an entity standing at the beginning of the journal and for an
     * entity that was never synchronized. The difference matters: a cursor of an untracked entity claims a
     * history the client does not have, so nothing but a difference response may create one.
     */
    public hasCursor(entity: SyncEntity): boolean {
        return this.#cursors.has(entityKey(entity));
    }

    /**
     * Cursors of the current session
     */
    public cursors(): Map<string, number> {
        return new Map(this.#cursors);
    }

    /**
     * Stop the run in progress. The already applied pages and their cursors stay, the rest of the entities
     * is left for the next run.
     *
     * The run is released right away, so a run started after it, for instance by a reconnect, is not held
     * back by a request the dropped connection will never answer.
     */
    public stop(): MessagesSynchronizer {
        if (this.#run) {
            this.#run.cancelled = true;
            this.#run = null;
        }
        this.#cancelGapChecks();
        return this;
    }

    public on(event: MessagesSyncEvent, callback: (arg0?: any) => void): MessagesSynchronizer {
        this.#notifier.add(event, callback);
        return this;
    }

    public off(event: MessagesSyncEvent, callback: (arg0?: any) => void): MessagesSynchronizer {
        this.#notifier.remove(event, callback);
        return this;
    }

    /**
     * Ask the server for the cursor summary and pull the difference of every diverging entity.
     *
     * Calling it while a run is in progress returns the promise of that run instead of starting a second one.
     */
    public sync(): Promise<SyncResult> {
        if (this.#run) {
            return this.#run.promise;
        }
        const run: SyncRun = {promise: null, cancelled: false};
        this.#run = run;
        run.promise = this.#sync(run);
        const release = () => {
            if (this.#run === run) {
                this.#run = null;
            }
        };
        run.promise.then(release, release);
        return run.promise;
    }

    /**
     * Pull the difference of a single entity, out of the regular run. Used to check an entity on demand,
     * for instance when a gap in the live stream is suspected.
     *
     * @param currentCursor server cursor of the entity, only needed to store it after a full resync.
     *                      When omitted, a resync reads it from a cursor summary.
     */
    public syncEntity(entity: SyncEntity, currentCursor?: number): Promise<EntitySyncResult> {
        return this.#syncEntity({
            targetEntityType: entity.targetEntityType,
            targetEntityId: entity.targetEntityId
        }, currentCursor);
    }

    /**
     * Move the cursor of an entity by a live event. Wired automatically by {@link attach}, exposed for
     * clients that dispatch live events themselves.
     *
     * Applying the change itself is none of this layer's business: the client does that in its regular
     * handler of {@link SfuEvent.MESSAGE} and friends, whatever happens to the cursor here.
     *
     * The cursor only follows the live stream when the sequence is unbroken. An event of an untracked entity,
     * an event received while a difference of the same entity is in flight, and an already covered seq are
     * ignored; a seq further than the next one is a gap and is checked with a difference request instead.
     *
     * A watermark ({@link MessageCursorEvent.watermark}) is the exception: the server states there that
     * everything meant for this client up to that seq has been sent, so the cursor takes it in one step. That
     * is what keeps the records addressed to somebody else — delivery statuses of other members' messages,
     * their private messages — from turning every live change into a difference request.
     */
    public applyLiveCursor(event: MessageCursorEvent): void {
        if (!this.#liveCursor || !event) {
            return;
        }
        const cursor = event.cursor;
        if (!Number.isFinite(cursor) || cursor <= 0) {
            return; //the change was not journaled, the event carries no seq
        }
        const entity: SyncEntity = {
            targetEntityType: event.targetEntityType,
            targetEntityId: event.targetEntityId
        };
        const key = entityKey(entity);
        if (!this.#cursors.has(key)) {
            //untracked entity: accepting a seq would claim the whole history before it is already here
            return;
        }
        if (this.#syncing.has(key)) {
            //a difference of this entity is in flight, its newCursor is the one to store
            return;
        }
        const local = this.#cursors.get(key);
        if (cursor <= local) {
            return; //already covered, cursors never move backwards
        }
        if (cursor === local + 1 || event.watermark) {
            this.#advanceCursor(entity, cursor).catch((e) => {
                this.#logger.error("Failed to store the live cursor " + cursor + " of " + key + ": ", e);
            });
            return;
        }
        this.#scheduleGapCheck(entity, key, local, cursor);
    }

    /**
     * A seq beyond the next one does not mean the records in between are lost: they may still be on their way,
     * or they may be private messages of other users, which consume numbers this client never receives.
     *
     * The cursor stays where it is and the entity is checked with a difference request, debounced to let the
     * out of order records arrive and throttled to keep an entity with a lively private correspondence from
     * requesting a difference on every message.
     */
    #scheduleGapCheck(entity: SyncEntity, key: string, localCursor: number, eventCursor: number) {
        this.#notifier.notify(MessagesSyncEvent.GAP_DETECTED, {
            targetEntityType: entity.targetEntityType,
            targetEntityId: entity.targetEntityId,
            localCursor,
            eventCursor
        } as GapDetected);
        if (this.#gapTimers.has(key)) {
            return; //a check of this entity is already pending, it will cover this seq too
        }
        const lastCheck = this.#lastGapCheck.get(key);
        const throttled = lastCheck === undefined ? 0 : lastCheck + this.#gapCheckMinIntervalMs - Date.now();
        const delay = Math.max(this.#gapCheckDelayMs, throttled);
        this.#logger.debug("Gap in the live stream of " + key + ": local cursor " + localCursor + ", event cursor "
            + eventCursor + ", checking with a difference in " + delay + " ms");
        this.#gapTimers.set(key, setTimeout(() => {
            this.#gapTimers.delete(key);
            this.#lastGapCheck.set(key, Date.now());
            this.syncEntity(entity).catch(() => {
                //the failure is reported through the EntitySyncResult, the cursor stays where it is
                //and the next live event runs into the same gap again
            });
        }, delay));
    }

    #cancelGapChecks() {
        this.#gapTimers.forEach((timer) => clearTimeout(timer));
        this.#gapTimers.clear();
    }

    async #sync(run: SyncRun): Promise<SyncResult> {
        try {
            await this.#loadStoredCursors();
            const summary = await this.#api.getChatsSyncSummary();
            const diverging = this.#selectDiverging(summary ? summary.cursors : []);
            this.#notifier.notify(MessagesSyncEvent.SYNC_STARTED, {entities: diverging.length} as SyncStarted);
            const entities = await this.#runQueue(diverging, run);
            const result: SyncResult = {entities, cancelled: run.cancelled};
            this.#notifier.notify(MessagesSyncEvent.SYNC_COMPLETED, result);
            return result;
        } catch (e) {
            this.#logger.error("Messages synchronization failed: ", e);
            this.#notifier.notify(MessagesSyncEvent.SYNC_FAILED, {error: e} as SyncFailed);
            throw e;
        }
    }

    async #loadStoredCursors() {
        const stored = await this.#store.getCursors();
        if (!stored) {
            return;
        }
        for (const item of stored) {
            if (!item || !Number.isFinite(item.cursor)) {
                continue;
            }
            //seeded, not persisted back: a stored cursor never moves a session cursor backwards
            const key = entityKey(item);
            const local = this.#cursors.get(key);
            if (local === undefined || item.cursor > local) {
                this.#cursors.set(key, item.cursor);
            }
        }
    }

    #selectDiverging(cursors: Array<ChatCursor>): Array<ChatCursor> {
        const diverging = (cursors || []).filter((cursor) => {
            const local = this.getCursor(cursor);
            if (local > cursor.currentCursor) {
                this.#logger.warn("Local cursor " + local + " is ahead of the server one " + cursor.currentCursor
                    + " for " + entityKey(cursor) + ", skipping");
                return false;
            }
            if (local >= cursor.currentCursor) {
                return false;
            }
            return this.#entityFilter ? !!this.#entityFilter(cursor, local) : true;
        });
        //the entity the user is looking at goes first
        const activeKey = this.#activeEntityKey;
        if (activeKey) {
            diverging.sort((a, b) => {
                const aActive = entityKey(a) === activeKey ? 0 : 1;
                const bActive = entityKey(b) === activeKey ? 0 : 1;
                return aActive - bActive;
            });
        }
        return diverging;
    }

    /**
     * Pulls entities with a limited concurrency so that the background difference does not take over
     * the connection the live stream is delivered through.
     */
    async #runQueue(entities: Array<ChatCursor>, run: SyncRun): Promise<Array<EntitySyncResult>> {
        const results: Array<EntitySyncResult> = new Array(entities.length);
        let next = 0;
        const worker = async () => {
            while (next < entities.length) {
                const index = next++;
                const entity = entities[index];
                if (run.cancelled) {
                    results[index] = this.#cancelledResult(entity);
                    continue;
                }
                const result = await this.#syncEntity(entity, entity.currentCursor, run);
                results[index] = result;
                this.#notifier.notify(MessagesSyncEvent.ENTITY_SYNCED, result);
            }
        };
        const workers = [];
        for (let i = 0; i < Math.min(this.#concurrency, entities.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return results;
    }

    async #syncEntity(entity: SyncEntity, currentCursor?: number, run?: SyncRun): Promise<EntitySyncResult> {
        const target: SyncEntity = {
            targetEntityType: entity.targetEntityType,
            targetEntityId: entity.targetEntityId
        };
        let pages = 0;
        let appliedMessages = 0;
        //while the difference is in flight its newCursor owns the cursor of the entity, see applyLiveCursor
        this.#enterSyncing(entityKey(target));
        try {
            //read once per entity: a coverage narrowing between the pages would leave the cursor ahead of
            //changes the client never received
            const ranges = await this.#cachedRanges(target);
            let sinceCursor = this.getCursor(target);
            while (true) {
                const request: GetMessagesDifferenceConfig = {
                    targetEntityType: target.targetEntityType,
                    targetEntityId: target.targetEntityId,
                    sinceCursor: sinceCursor,
                    limit: this.#limit
                };
                if (ranges) {
                    request.cachedRanges = ranges;
                }
                const difference = await this.#api.getMessagesDifference(request);
                pages++;
                if (!difference) {
                    throw new Error("Empty MESSAGES_DIFFERENCE response for " + entityKey(target));
                }
                if (difference.resyncRequired) {
                    const applied = await this.#resyncEntity(target, currentCursor, ranges);
                    return {
                        ...target,
                        status: EntitySyncStatus.RESYNCED,
                        cursor: this.getCursor(target),
                        pages,
                        appliedMessages: appliedMessages + applied
                    };
                }
                const messages = difference.messages || [];
                if (messages.length > 0) {
                    await this.#store.applyMessages({...target, messages, resync: false});
                    appliedMessages += messages.length;
                }
                //the cursor is stored only after the whole response is applied
                await this.#advanceCursor(target, difference.newCursor);
                if (!difference.hasMore) {
                    break;
                }
                if (!(difference.newCursor > sinceCursor)) {
                    //hasMore without a moving cursor would loop forever, the next run will pick the rest up
                    this.#logger.warn("MESSAGES_DIFFERENCE for " + entityKey(target) + " reports hasMore but the cursor "
                        + "did not move from " + sinceCursor + ", stopping the pagination");
                    break;
                }
                if (pages >= this.#maxPagesPerEntity) {
                    this.#logger.warn("Reached the page limit " + this.#maxPagesPerEntity + " for "
                        + entityKey(target) + ", stopping the pagination");
                    break;
                }
                if (run && run.cancelled) {
                    return {...this.#cancelledResult(target), pages, appliedMessages};
                }
                sinceCursor = difference.newCursor;
            }
            return {
                ...target,
                status: EntitySyncStatus.SYNCED,
                cursor: this.getCursor(target),
                pages,
                appliedMessages
            };
        } catch (e) {
            this.#logger.error("Failed to synchronize " + entityKey(target) + ": ", e);
            return {
                ...target,
                status: EntitySyncStatus.FAILED,
                cursor: this.getCursor(target),
                pages,
                appliedMessages,
                error: e
            };
        } finally {
            this.#leaveSyncing(entityKey(target));
        }
    }

    /**
     * Intervals of the local cache of an entity, taken from {@link MessagesSyncStore.getCachedRanges} when
     * the store implements it and from {@link MessagesSyncStore.getCachedWindow} otherwise. Null when the
     * store reports no coverage: the client is then treated as holding the whole history.
     */
    async #cachedRanges(entity: SyncEntity): Promise<Array<CachedWindow>> {
        try {
            if (this.#store.getCachedRanges) {
                return this.#checkedRanges(entity, await this.#store.getCachedRanges(entity));
            }
            if (this.#store.getCachedWindow) {
                const window = await this.#store.getCachedWindow(entity);
                return this.#checkedRanges(entity, window ? [window] : []);
            }
        } catch (e) {
            this.#logger.error("Failed to read the cached coverage of " + entityKey(entity) + ": ", e);
        }
        return null;
    }

    /**
     * Every rejection here widens the declared coverage rather than narrows it, because a coverage narrower
     * than the real one loses changes and nothing in the protocol reports that.
     */
    #checkedRanges(entity: SyncEntity, ranges: Array<CachedWindow>): Array<CachedWindow> {
        if (!ranges || ranges.length === 0) {
            return null;
        }
        const malformed = ranges.findIndex((range) => !range
            || !Number.isFinite(range.from) || !Number.isFinite(range.to)
            || range.from < 0 || range.to < 0
            || (range.to > 0 && range.from > range.to));
        if (malformed >= 0) {
            //nothing sensible can be built out of the list, the whole history is the safe reading
            this.#logger.error("Malformed cached range " + JSON.stringify(ranges[malformed]) + " at " + malformed
                + " of " + entityKey(entity) + ", synchronizing as if the whole history were cached");
            return null;
        }
        if (ranges.length > MAX_CACHED_RANGES) {
            //collapsing the list is the client's job, gluing it into the envelope keeps the run going
            this.#logger.error("The store reports " + ranges.length + " cached ranges of " + entityKey(entity)
                + ", more than the maximum of " + MAX_CACHED_RANGES + ", falling back to their envelope");
            return [coverageEnvelope(ranges)];
        }
        return ranges;
    }

    #enterSyncing(key: string) {
        this.#syncing.set(key, (this.#syncing.get(key) || 0) + 1);
    }

    #leaveSyncing(key: string) {
        const inFlight = (this.#syncing.get(key) || 0) - 1;
        if (inFlight > 0) {
            this.#syncing.set(key, inFlight);
        } else {
            this.#syncing.delete(key);
        }
    }

    /**
     * Client fell behind the journal retention: the difference cannot fill the gap, the entity is reloaded
     * and its cursor is taken from the summary.
     *
     * Only the ranges the client caches are reloaded, one request per interval, the rest of the history is
     * read in its current state whenever the client loads it. Without a coverage the whole entity is
     * reloaded, as before.
     */
    async #resyncEntity(entity: SyncEntity, currentCursor?: number,
                        cachedRanges?: Array<CachedWindow>): Promise<number> {
        this.#logger.info("Full resync of " + entityKey(entity));
        //read before the reload: a cursor read after it would skip the changes made while it was running
        const cursor = currentCursor === undefined ? await this.#lookupCurrentCursor(entity) : currentCursor;
        const ranges = cachedRanges ? cachedRanges : [{from: 0, to: 0}];
        let applied = 0;
        for (let i = 0; i < ranges.length; i++) {
            const messages = await this.#api.loadMessages({
                targetEntityType: entity.targetEntityType,
                targetEntityId: entity.targetEntityId,
                timeFrame: {
                    start: ranges[i].from ? ranges[i].from : 0,
                    end: ranges[i].to ? ranges[i].to : -1
                }
            }) || [];
            //only the first batch drops the stale content of the entity, the rest add to it
            await this.#store.applyMessages({...entity, messages, resync: i === 0});
            applied += messages.length;
        }
        //stored only once every interval is loaded: a cursor stored in between would leave the intervals
        //that did not make it looking synchronized
        await this.#advanceCursor(entity, cursor);
        return applied;
    }

    /**
     * Current server cursor of a single entity, used when a resync happens outside of a regular run
     */
    async #lookupCurrentCursor(entity: SyncEntity): Promise<number> {
        const key = entityKey(entity);
        const summary = await this.#api.getChatsSyncSummary();
        const found = (summary && summary.cursors ? summary.cursors : []).find((c) => entityKey(c) === key);
        if (!found) {
            this.#logger.warn("No cursor of " + key + " in the summary, leaving the local one as is");
            return undefined;
        }
        return found.currentCursor;
    }

    /**
     * Cursors only move forward, and only to a newCursor of a difference response
     */
    async #advanceCursor(entity: SyncEntity, cursor: number): Promise<void> {
        if (cursor === undefined || cursor === null || !Number.isFinite(cursor)) {
            return;
        }
        const key = entityKey(entity);
        const local = this.#cursors.get(key);
        if (local !== undefined && cursor <= local) {
            return;
        }
        this.#cursors.set(key, cursor);
        await this.#store.saveCursor({
            targetEntityType: entity.targetEntityType,
            targetEntityId: entity.targetEntityId,
            cursor
        });
    }

    #cancelledResult(entity: SyncEntity): EntitySyncResult {
        return {
            targetEntityType: entity.targetEntityType,
            targetEntityId: entity.targetEntityId,
            status: EntitySyncStatus.CANCELLED,
            cursor: this.getCursor(entity),
            pages: 0,
            appliedMessages: 0
        };
    }
}
