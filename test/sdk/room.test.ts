import {Sfu, RoomEvent} from "../../src";
import {TEST_GROUP_USER0, TEST_GROUP_USER1, TEST_MESSAGE_ROOM, TEST_ROOM, url} from "../util/constants";
import {AddRemoveTracks, RoomMessage} from "../../src/sdk/constants";

const wrtc = require("wrtc");
const {RTCVideoSource} = require('wrtc').nonstandard
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
    it("should set contentType", async () => {
        const sfu0 = await connect(TEST_GROUP_USER0);
        const sfu1 = await connect(TEST_GROUP_USER1);
        const room0 = sfu0.createRoom({
            ...TEST_ROOM
        });
        const room1 = sfu1.createRoom({
            ...TEST_ROOM
        });

        const rtcConnection = new wrtc.RTCPeerConnection();
        const aSource = new RTCAudioSourceSineWave();
        const aTrack1 = aSource.createTrack();
        const aTrack2 = aSource.createTrack();

        const vSource = new RTCVideoSource();
        const vTrack1 = vSource.createTrack();
        const vTrack2 = vSource.createTrack();

        rtcConnection.addTrack(aTrack1);
        rtcConnection.addTrack(aTrack2);
        rtcConnection.addTrack(vTrack1);
        const contentTypes = ["mic-1", "mic-2", "cam-1","cam-2"]

        const config = {
            [aTrack1.id]: contentTypes[0].valueOf(),
            [aTrack2.id]: contentTypes[1].valueOf(),
            [vTrack1.id]: contentTypes[2].valueOf()
        };
        const updateConfig = {...config,
            [vTrack2]:contentTypes[3].valueOf()}

        room0.on(RoomEvent.ADD_TRACKS, (msg) => {
            const message = msg as AddRemoveTracks;
            expect(message).toBeTruthy();
            message.info.info.forEach((info) => {
                const index = contentTypes.indexOf(info.contentType);
                expect(index).toBeGreaterThan(-1);
                contentTypes.splice(index, 1);
            });
        });

        await room1.join(rtcConnection, null, config);
        await room0.join(new wrtc.RTCPeerConnection());

        rtcConnection.addTrack(vTrack2);
        await room1.updateState(updateConfig);

        sfu0.disconnect();
        sfu1.disconnect()
        aSource.close();
        aTrack1.stop();
        aTrack2.stop();
        vTrack1.stop();
        vTrack2.stop();
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