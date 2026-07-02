import {RoomEvent, SfuExtended} from "../../src";
import {RoomExtended} from "../../src/sdk/room-extended";
import {TEST_USER_0, TEST_USER_1, url} from "./constants";
import {Verbosity} from "../../src/sdk/logger";
const { URL } = require('url');
import {v4 as uuidv4} from 'uuid';
import {MessageAttachmentType, SfuEvent} from "../../src/sdk/constants";

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

export function waitForEvent<T = any>(
    sfu: SfuExtended,
    event: SfuEvent,
    match?: (payload: T) => boolean,
    timeoutMs = 5000
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const handler = (msg: any) => {
            if (!match || match(msg as T)) {
                sfu.off(event, handler);
                clearTimeout(timer);
                resolve(msg as T);
            }
        };
        timer = setTimeout(() => {
            sfu.off(event, handler);
            reject(new Error(`waitForEvent: '${String(event)}' not received within ${timeoutMs}ms`));
        }, timeoutMs);
        sfu.on(event, handler);
    });
}

export async function waitUntil(
    predicate: () => Promise<boolean> | boolean,
    {timeoutMs = 15000, intervalMs = 200}: {timeoutMs?: number; intervalMs?: number} = {}
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await predicate())) {
        if (Date.now() >= deadline) {
            throw new Error(`waitUntil: condition not met within ${timeoutMs}ms`);
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
}

export async function waitForAttachmentsStored<T>(
    read: () => Promise<T>,
    ready: (r: T) => boolean,
    opts?: {timeoutMs?: number; intervalMs?: number}
): Promise<T> {
    let last!: T;
    await waitUntil(async () => {
        last = await read();
        return ready(last);
    }, opts);
    return last;
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

export async function clearFriends(...clients: SfuExtended[]) {
    for (const sfu of clients) {
        try {
            const c: any = await sfu.getContacts();
            for (const contact of (c.contacts || [])) {
                if (contact.friend) {
                    try { await sfu.removeFriend({userId: contact.userId}); } catch (e) {}
                }
            }
            for (const inv of (c.outgoingFriendInvites || [])) {
                try { await sfu.revokeFriendInvite({inviteId: inv.inviteId}); } catch (e) {}
            }
            for (const inv of (c.incomingFriendInvites || [])) {
                try { await sfu.rejectFriendInvite({inviteId: inv.inviteId}); } catch (e) {}
            }
        } catch (e) {
        }
    }
}

export async function clearChats(...clients: SfuExtended[]) {
    for (const sfu of clients) {
        try {
            const chats: any = await sfu.getUserChats();
            for (const chat of Object.values(chats || {})) {
                try {
                    await sfu.deleteChat({id: (chat as any).id});
                }
                catch (e) {
                }
            }
        } catch (e) {
        }
    }
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
