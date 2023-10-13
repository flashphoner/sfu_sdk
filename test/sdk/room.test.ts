import {RoomEvent, RoomState, Sfu, StatsType} from "../../src";
import {TEST_GROUP_USER0, TEST_GROUP_USER1, TEST_MESSAGE_ROOM, TEST_ROOM, url} from "../util/constants";
import {AddRemoveTracks, RoomMessage, TrackType} from "../../src/sdk/constants";
import {Verbosity} from "../../src/sdk/logger";

const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../lib/rtcaudiosourcesinewave");
const RTCVideoSourceWrapper = require("../lib/rtcvideosourcewrapper");

async function connect(userConfig: {
    nickname: string
    logGroup: string
}) {
    const sfu = new Sfu(Verbosity.ERROR, () => "[" + userConfig.nickname + " | " + expect.getState().currentTestName + "]");
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
        await sfu.disconnect();
    });
    it("should join room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection());
        expect(state.name).toEqual(TEST_GROUP_USER0.nickname);
        await sfu.disconnect();
    });
    it("should leave room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const userId = room.userId();
        const state = await room.leaveRoom();
        expect(state.userId).toEqual(userId);
        await sfu.disconnect();
    });
    it("should join room with same nicknames", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const sfu1 = await connect(TEST_GROUP_USER0);

        const room = sfu.createRoom({
            ...TEST_ROOM
        });

        const room1 = sfu1.createRoom({
            ...TEST_ROOM
        });

        await room.join(new wrtc.RTCPeerConnection());
        await room1.join(new wrtc.RTCPeerConnection())
        expect(room1.state()).toEqual(RoomState.JOINED);
        expect(room.state()).toEqual(RoomState.JOINED);

        await sfu.disconnect();
        await sfu1.disconnect();
    });
    it("should destroy room", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.destroyRoom();
        await sfu.disconnect();
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
        // aTrack.stop();
        // aSource.close();
        room.pc().removeTrack(aSender);
        await room.updateState();
        await sfu.disconnect();
    });
    // This test was skipped due to unexpected crashes inside of wrtc
    it.skip("should set contentType", async () => {
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

        const vSource = new RTCVideoSourceWrapper();
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
            [vTrack2.id]: contentTypes[3].valueOf()}

        room0.on(RoomEvent.ADD_TRACKS, async (msg) => {
            const message = msg as AddRemoveTracks;
            expect(message).toBeTruthy();
            expect(message.info.userId).toBeTruthy();
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

        aTrack1.stop();
        aTrack2.stop();
        vTrack1.stop();
        vTrack2.stop();

        aSource.close();

        await sfu0.disconnect();
        await sfu1.disconnect();
    });
    it("should get incoming track stats", async (done) => {
        const sfu0 = await connect(TEST_GROUP_USER0);
        const sfu1 = await connect(TEST_GROUP_USER1);
        const room0 = sfu0.createRoom({
            ...TEST_ROOM
        });
        const room1 = sfu1.createRoom({
            ...TEST_ROOM
        });

        const rtcConnectionPublish = new wrtc.RTCPeerConnection();
        const rtcConnectionPlay = new wrtc.RTCPeerConnection();

        const vSource = new RTCVideoSourceWrapper();
        const vTrack1 = vSource.createTrack();

        rtcConnectionPublish.addTrack(vTrack1);

        room0.on(RoomEvent.ADD_TRACKS, async (msg) => {
            const message = msg as AddRemoveTracks;
            expect(message).toBeTruthy();
            expect(message.info.userId).toBeTruthy();
            const t = await room0.getRemoteTrack(TrackType.VIDEO, true);
            await t.demandTrack(message.info.info[0].id);
            room0.getStats(t.track, StatsType.INBOUND, async (stats) => {
                expect(stats.type).toBe(StatsType.INBOUND);
                expect(stats.mediaType).toBe("video");
                await sfu1.disconnect();
                await sfu0.disconnect();
                done();
            });
        });

        await room1.join(rtcConnectionPublish, null, {});
        await room0.join(rtcConnectionPlay, null, {}, 1);
    });
    //relates to zapp-64
    it.skip("should send message", async () => {
        const sfu = await connect(TEST_GROUP_USER0);
        const room = sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.sendMessage(TEST_MESSAGE_ROOM);
        await sfu.disconnect();
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
            room1.on(RoomEvent.MESSAGE, async (msg) => {
                const message = msg as RoomMessage;
                expect(message).toBeTruthy();
                expect(message.message.nickName).toEqual(TEST_GROUP_USER0.nickname);
                expect(JSON.parse(message.message.message).payload).toEqual(TEST_MESSAGE_ROOM);
                await sfu0.disconnect();
                await sfu1.disconnect();
                done();
            });
            await room0.sendMessage(TEST_MESSAGE_ROOM);
        });
    });
});
