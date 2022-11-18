import {Sfu, RoomEvent} from "../../src";
import {TEST_GROUP_USER0, TEST_GROUP_USER1, TEST_MESSAGE_ROOM, TEST_ROOM, url} from "../util/constants";
import {RoomMessage} from "../../src/sdk/constants";

const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../lib/rtcaudiosourcesinewave");

async function connect(userConfig: {
    nickname: string
    logGroup: string
}) {
    const sfu = new Sfu();
    await sfu.connect({
        url: url,
        ...userConfig
    });
    return sfu;
}

describe("room", () => {
    it("should create room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        expect(room).toBeTruthy();
        sfu.disconnect();
    });
    it("should join room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection());
        expect(state.name).toEqual(TEST_GROUP_USER0.nickname);
        sfu.disconnect();
    });
    it("should leave room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const state = await room.leaveRoom();
        expect(state.name).toEqual(TEST_GROUP_USER0.nickname);
        sfu.disconnect();
    });
    it("should destroy room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should update state", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        const aSender = room.pc().addTrack(aTrack);

        await room.updateState({});
        //await waitForPeerConnectionStableState(room.pc());
        aTrack.stop();
        aSource.close();
        room.pc().removeTrack(aSender);
        await room.updateState();
        sfu.disconnect();
    });
    //relates to zapp-64
    it.skip("should send message", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.sendMessage(TEST_MESSAGE_ROOM);
        sfu.disconnect();
    });
    describe("notifications", () => {
        //relates to zapp-64
        it.skip("should receive message", async (done) => {
            const sfu0 = await connect(TEST_GROUP_USER0);
            const sfu1 = await connect(TEST_GROUP_USER1);
            const room0 = sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const room1 = sfu1.createRoom({
                ...TEST_ROOM
            });
            await room1.join(new wrtc.RTCPeerConnection());
            room1.on(RoomEvent.MESSAGE, (msg) => {
                const message = msg as RoomMessage;
                expect(message).toBeTruthy();
                expect(message.message.nickName).toEqual(TEST_GROUP_USER0.nickname);
                expect(message.message.message).toEqual(TEST_MESSAGE_ROOM);
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            });
            await room0.sendMessage(TEST_MESSAGE_ROOM);
        });
    });
});