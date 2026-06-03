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
    TransportType
} from "./sdk/constants";
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
    DEFAULT_CONNECTION_QUALITY_POLICY,
    evaluateConnectionQuality
};
