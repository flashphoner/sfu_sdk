import {RoomEvent, SfuExtended} from "../../src";
import {RoomExtended} from "../../src/sdk/room-extended";
import {TEST_USER_0, TEST_USER_1, url} from "./constants";
import {Verbosity} from "../../src/sdk/logger";
const { URL } = require('url');
import {v4 as uuidv4} from 'uuid';
import {MessageAttachmentType} from "../../src/sdk/constants";

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
    username?: string,
    email: string,
    password: string,
    nickname: string
}) {
    const sfu = new SfuExtended(Verbosity.DEBUG, () => "[" + userConfig.username + " | " + expect.getState().currentTestName + "]");
    await sfu.connect({
        url: url,
        ...userConfig,
        username: userConfig.email
    });
    return sfu;
}

export async function waitForUsers() {
    const bob = await connect(TEST_USER_0);
    const alice = await connect(TEST_USER_1);
    return {bob, alice};
}

export async function waitForUser() {
    return await connect(TEST_USER_0);
}

export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export const generateAttachments = (attachmentsSize: number, size: number) => {
    const result = {
        metadata: [],
        payload: []
    };
    for (let i = 0; i < attachmentsSize; i++) {
        let id = uuidv4();
        result.metadata.push({
            type: MessageAttachmentType.file,
            id: id,
            size: size,
            name: "file" + i + ".txt"
        })
        result.payload.push({
            payload: Buffer.from(new ArrayBuffer(size)).buffer,
            id: id,
        })
    }
    return result;
}
