import {RoomEvent} from "../../src";
import {RoomExtended} from "../../src/sdk/room-extended";

export type WaitCondition = (room: RoomExtended) => boolean;

export type EventPayloadSelector<T> = (room: RoomExtended) => T;

export function waitForRoomEvent<T>(event: RoomEvent, room: RoomExtended, condition: WaitCondition, selector: EventPayloadSelector<T>) {
    return new Promise((resolve, reject) => {
        room.on(event, function(msg) {
            if (condition(room)) {
                resolve(selector(room));
            }
        });
        if (condition(room)) {
            resolve(selector(room));
        }
    });
}