import {Sfu, RoomEvent, SfuEvent, State} from "@flashphoner/sfusdk";

export async function createRoom(options: {
    url: string,
    roomName: string,
    pin: string,
    nickname: string
}) {
    const sfu = new Sfu();
    await sfu.connect({
        url: options.url,
        nickname: options.nickname,
        logGroup: options.roomName
    });
    sfu.createRoom({
        name: options.roomName,
        pin: options.pin
    });
    return sfu;
}

export const constants = {
    SFU_EVENT: SfuEvent,
    SFU_ROOM_EVENT: RoomEvent,
    SFU_STATE: State
}
