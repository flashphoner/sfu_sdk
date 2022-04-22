import {Sfu, RoomEvent, SfuEvent, State} from "@flashphoner/sfusdk";

export function createRoom(options: {
    url: string,
    roomName: string,
    pin: string,
    nickname: string,
    pc: RTCPeerConnection
}) {
    const sfu = new Sfu();
    sfu.connect({
        url: options.url,
        nickname: options.nickname,
        logGroup: options.roomName
    });
    const room = sfu.createRoom({
        name: options.roomName,
        pin: options.pin,
        pc: options.pc
    });
    return sfu;
}

export const constants = {
    SFU_EVENT: SfuEvent,
    SFU_ROOM_EVENT: RoomEvent,
    SFU_STATE: State
}
