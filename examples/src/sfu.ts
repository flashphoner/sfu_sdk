import {
    Sfu,
    RoomEvent,
    SfuEvent,
    State
} from "@flashphoner/sfusdk";

export async function createRoom(options: {
    url: string,
    roomName: string,
    pin: string,
    nickname: string,
    failedProbesThreshold?: number,
    pingInterval?: number,
}) {
    try {
        const sfu = new Sfu();
        await sfu.connect({
            url: options.url,
            nickname: options.nickname,
            logGroup: options.roomName,
            failedProbesThreshold: options.failedProbesThreshold,
            pingInterval: options.pingInterval
        });
        sfu.createRoom({
            name: options.roomName,
            pin: options.pin
        });
        return sfu;
    } catch (e) {
        throw new Error("Can't connect to websocket URL " + options.url);
    }
}

export const constants = {
    SFU_EVENT: SfuEvent,
    SFU_ROOM_EVENT: RoomEvent,
    SFU_STATE: State
}
