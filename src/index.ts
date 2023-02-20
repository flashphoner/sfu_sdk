import {Sfu} from "./sdk/sfu";
import {SfuExtended} from "./sdk/sfu-extended";
import {
    SfuEvent,
    RoomEvent,
    State,
    RoomState,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD
} from "./sdk/constants";

export const sfu = new Sfu();
export const sfuExtended = new SfuExtended();
export {
    Sfu,
    SfuExtended,
    SfuEvent,
    RoomEvent,
    State,
    RoomState,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD
};