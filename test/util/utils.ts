import {RoomEvent, SfuExtended} from "../../src";
import {RoomExtended} from "../../src/sdk/room-extended";
import {TEST_USER_0, TEST_USER_1, url} from "./constants";
import {Verbosity} from "../../src/sdk/logger";

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

const logger = (msg: string, obj?: any) => {
    console.log("[" + expect.getState().currentTestName + "] " + msg, (obj) ? obj : '');
}

export async function connect(userConfig: {
    username: string,
    password: string,
    nickname: string
}) {
    const sfu = new SfuExtended(Verbosity.DEBUG, () => "[" + userConfig.username + " | " + expect.getState().currentTestName + "]");
    await sfu.connect({
        url: url,
        ...userConfig
    });
    return sfu;
}

export async function waitForUsers() {
    const bob = await connect(TEST_USER_0);
    const alice = await connect(TEST_USER_1);
    return {bob, alice};
}

export async function waitForUser() {
    const bob = await connect(TEST_USER_0);
    return bob;
}