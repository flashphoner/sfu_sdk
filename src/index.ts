import {Sfu} from "./sdk/sfu";
import {SfuExtended} from "./sdk/sfu-extended";
import {SfuEvent, RoomEvent, State, RoomState} from "./sdk/constants";

export const sfu = new Sfu();
export const sfuExtended = new SfuExtended();
export {Sfu, SfuExtended, SfuEvent, RoomEvent, State, RoomState};