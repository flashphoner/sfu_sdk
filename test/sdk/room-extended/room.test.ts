import {
    CALENDAR_EVENT,
    MEETING_NICKNAME,
    PINLESS_TEST_ROOM,
    TEST_MESSAGE_ROOM,
    TEST_ROOM,
    TEST_USER_0,
    TEST_USER_1
} from "../../util/constants";
import {RoomError, RoomEvent} from "../../../src/sdk/constants";
import {connect, waitForRoomEvent, waitForUsers} from "../../util/utils";
import {SfuExtended} from "../../../src";

const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../../lib/rtcaudiosourcesinewave");

describe("room", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
    })
    afterEach(async() => {
        await bob.disconnect();
        await alice.disconnect();
    })
    it("Should create room at server side", async () => {
        const room = await bob.createRoom({
            ...TEST_ROOM,
            id: bob.user().pmi
        });
        expect(room).toBeTruthy();
        expect(room.id()).toBe(bob.user().pmi);
        expect(room.name()).toEqual(TEST_ROOM.name);
        expect(room.creationTime()).toBeTruthy();
        await room.destroyRoom();
    });
    it("Should create room with no name", async () => {
        const room = await bob.createRoom({});
        expect(room).toBeTruthy();
        expect(room.id()).toBeTruthy();
        expect(room.name()).toBeFalsy();
        expect(room.waitingRoomEnabled()).toBeFalsy();
        await room.destroyRoom();
    });
    it("Should check room exists", async () => {
        const room = await bob.createRoom({pin: TEST_ROOM.pin});
        expect(room).toBeTruthy();
        expect(room.id()).toBeTruthy();
        expect(room.name()).toBeFalsy();
        await expect(bob.roomExists({id: room.id(), pin: TEST_ROOM.pin}));
        await room.destroyRoom();
    });
    it("room exists should fail on missing room", async () => {
        await expect(bob.roomExists({id: "fake_id"})).rejects.toHaveProperty("error", RoomError.NOT_FOUND);
    });
    it("room exists should fail on wrong pin", async () => {
        const room = await bob.createRoom({pin: "123456"});
        await expect(bob.roomExists({id: room.id(), pin: "iurhfure"})).rejects.toHaveProperty("error", RoomError.WRONG_PIN);
        await room.destroyRoom();
    });
    it('room exists should fail on null room id', async () => {
        await expect(bob.roomExists({id: null})).rejects.toHaveProperty("error", RoomError.ID_IS_NULL);
    });
    it('room available should fail on null room id', async () => {
        await expect(bob.roomAvailable({id: null})).rejects.toHaveProperty("error", RoomError.ID_IS_NULL);
    });
    it("Should load room after disconnect", async () => {
        let room = await bob.createRoom({
            ...TEST_ROOM,
            id: bob.user().pmi
        });
        expect(room).toBeTruthy();
        expect(room.id()).toBe(bob.user().pmi);
        expect(room.name()).toEqual(TEST_ROOM.name);
        await bob.disconnect();
        bob = await connect(TEST_USER_0);
        let rooms = await bob.loadActiveRooms();
        expect(rooms.length).toBe(1);
        room = bob.getRoom({id: rooms[0].id});
        expect(room).toBeTruthy();
        expect(room.id()).toBe(bob.user().pmi);
        expect(room.name()).toBe(TEST_ROOM.name);
        expect(room.creationTime()).toBeTruthy();
        await room.destroyRoom();
    });
    it("Should join room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(bobPc);
        expect(state.name).toEqual(TEST_USER_0.nickname);
        await room.destroyRoom();
    });
    it("Should join pinless room", async () => {
        const room = await bob.createRoom({
            ...PINLESS_TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection());
        expect(state.name).toEqual(TEST_USER_0.nickname);
        await room.destroyRoom();
    })
    it("Should join room with custom nickname", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(bobPc, MEETING_NICKNAME);
        expect(state.name).toEqual(MEETING_NICKNAME);
        await room.destroyRoom();
    });
    it("Should join room using custom nickname", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const CUSTOM_NICKNAME = "pumicestone";
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(bobPc, CUSTOM_NICKNAME);
        expect(state.name).toEqual(CUSTOM_NICKNAME);
        await room.destroyRoom();
    });
    it("Should create calendar event and second user should join without owner", async () => {
        const event = CALENDAR_EVENT;
        event.usePMI = false;
        event.allowJoinAtAnyTime = true;
        event.waitingRoom = false;
        const calendarEvent = await bob.addCalendarEvent(event);
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();

        const room = await alice.roomAvailable({
            id: calendarEvent.meetingId,
            pin: calendarEvent.accessCode,
            nickname: TEST_USER_1.nickname
        });
        let state = await room.join(alicePc);
        expect(state.name).toEqual(TEST_USER_1.nickname);

        const room1 = await bob.roomAvailable({
            id: calendarEvent.meetingId,
            pin: calendarEvent.accessCode,
            nickname: TEST_USER_0.nickname
        });
        state = await room1.join(bobPc);
        expect(state.name).toEqual(TEST_USER_0.nickname);
        await room1.destroyRoom();
        await bob.removeCalendarEvent(calendarEvent);
    });
    it("Should leave room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        const state = await room.leaveRoom();
        expect(state.name).toEqual(TEST_USER_0.nickname);
    });
    it("Should destroy room", async () => {
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.destroyRoom();
    });
    it("Destroying room should result in ENDED event if user was joined", async (done) => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        room.on(RoomEvent.ENDED, async function() {
            await bob.disconnect();
            done();
        });
        await room.join(bobPc);
        room.destroyRoom();
    });
    it("Should fail if room is not available", async () => {
        await expect(bob.roomAvailable({id: "lkwjflkf"})).rejects.toHaveProperty("error", "Room is not available");
    });
    it("Should update state", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        const aSender = room.pc().addTrack(aTrack);

        await room.updateState({});
        aTrack.stop();
        aSource.close();
        room.pc().removeTrack(aSender);
        await room.updateState();
    });
    it("Should configure waiting room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        const state = await room.configureWaitingRoom(false);
        expect(state.enabled).toBeFalsy();
    });
    it("Should disable and enable waiting room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        const state = await room.configureWaitingRoom(false);
        expect(state.enabled).toBeFalsy();
        expect(room.waitingRoomEnabled()).toBeFalsy();
        const enableState = await room.configureWaitingRoom(true);
        expect(enableState.enabled).toBeTruthy();
        expect(room.waitingRoomEnabled()).toBeTruthy();
    });
    it("sending control message to nonexistent participant should result in rejection", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        await expect(room.sendControlMessage(TEST_MESSAGE_ROOM, false, TEST_USER_1.nickname)).rejects.toBeTruthy();
    });
    it("Should broadcast control message", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        await room.sendControlMessage(TEST_MESSAGE_ROOM, true);
    });
    it("Should change room lock", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        expect(room.config().locked).toBeFalsy();
        await room.setLock(true);
        expect(room.config().locked).toBeTruthy();
    });
    it("Should receive participant config", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const room = await bob.createRoom({
            ...TEST_ROOM
        });
        await room.join(bobPc);
        await waitForRoomEvent(RoomEvent.PARTICIPANT_CONFIG, room, (r) => r.config().participantsConfig[TEST_USER_0.nickname] !== undefined, () => {});
    });
});