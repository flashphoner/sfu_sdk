import {Sfu} from "./sdk/sfu";
import {SfuExtended} from "./sdk/sfu-extended";
import {
    SfuEvent,
    RoomEvent,
    SpaceEvent,
    State,
    RoomState,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD,
    StatsType,
    TransportType,
    MessageTargetEntityType,
    DEFAULT_MESSAGES_DIFFERENCE_LIMIT,
    MAX_CACHED_RANGES
} from "./sdk/constants";
import {
    EntitySyncStatus,
    MessagesSyncEvent,
    MessagesSynchronizer,
    entityKey
} from "./sdk/messages-sync";
export type {
    CachedRange,
    ChatCursor,
    ChatsSyncSummaryEvent,
    GetMessagesDifferenceConfig,
    MessageCursorEvent,
    MessagesDifferenceEvent,
    MessageTargetEntityId
} from "./sdk/constants";
export type {
    CachedWindow,
    EntitySyncResult,
    GapDetected,
    MessagesSyncApi,
    MessagesSyncEventSource,
    MessagesSyncOptions,
    MessagesSyncStore,
    MessagesSyncUpdate,
    StoredCursor,
    SyncEntity,
    SyncResult
} from "./sdk/messages-sync";
import {
    DEFAULT_CONNECTION_QUALITY_POLICY,
    evaluateConnectionQuality
} from "./sdk/connection-quality";
export type {
    ConnectionQualityMetrics,
    ConnectionQualityPolicy,
    ConnectionQualityResult,
    ConnectionQualityStatus
} from "./sdk/connection-quality";

export const sfu = new Sfu();
export const sfuExtended = new SfuExtended();
export {
    Sfu,
    SfuExtended,
    SfuEvent,
    RoomEvent,
    SpaceEvent,
    State,
    RoomState,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD,
    StatsType,
    TransportType,
    MessageTargetEntityType,
    DEFAULT_MESSAGES_DIFFERENCE_LIMIT,
    MAX_CACHED_RANGES,
    MessagesSynchronizer,
    MessagesSyncEvent,
    EntitySyncStatus,
    entityKey,
    DEFAULT_CONNECTION_QUALITY_POLICY,
    evaluateConnectionQuality
};
