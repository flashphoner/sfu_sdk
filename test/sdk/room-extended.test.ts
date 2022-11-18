import {RoomEvent, SfuEvent, SfuExtended} from "../../src";
import {
    MEETING_NICKNAME,
    PINLESS_TEST_ROOM,
    TEST_MESSAGE_ROOM,
    TEST_ROOM,
    TEST_USER_0,
    TEST_USER_1,
    url
} from "../util/constants";
import {
    ChatReceivePolicy,
    ControlMessageEvent,
    EvictedFromRoom,
    InternalMessage,
    JoinedRoom,
    Message,
    ParticipantRole,
    RoleAssigned,
    RolesListEvent,
    RoomError,
    RoomMessage,
    UserSpecificChatInfo,
    WaitingListEvent
} from "../../src/sdk/constants";
import {waitForRoomEvent} from "../util/utils";
import {waitForPeerConnectionStableState} from "../util/pcUtils";
import {Verbosity} from "../../src/sdk/logger";

const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../lib/rtcaudiosourcesinewave");

async function connect(userConfig: {
    username: string,
    password: string,
    nickname: string
}) {
    const sfu = new SfuExtended(Verbosity.DEBUG);
    await sfu.connect({
        url: url,
        ...userConfig
    });
    return sfu;
}

describe("room", () => {
    it("should create room at server side", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM,
            id: sfu.user().pmi
        });
        expect(room).toBeTruthy();
        expect(room.id()).toBe(sfu.user().pmi);
        expect(room.name()).toEqual(TEST_ROOM.name);
        expect(room.creationTime()).toBeTruthy();
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should create room with no name", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({});
        expect(room).toBeTruthy();
        expect(room.id()).toBeTruthy();
        expect(room.name()).toBeFalsy();
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should check room exists", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({pin: TEST_ROOM.pin});
        expect(room).toBeTruthy();
        expect(room.id()).toBeTruthy();
        expect(room.name()).toBeFalsy();
        await expect(sfu.roomExists({id: room.id(), pin: TEST_ROOM.pin}));
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("room exists should fail on missing room", async () => {
        const sfu = await connect(TEST_USER_0);
        await expect(sfu.roomExists({id: "fake_id"})).rejects.toHaveProperty("error", RoomError.NOT_FOUND);
        sfu.disconnect();
    });
    it("room exists should fail on wrong pin", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({pin: "123456"});
        await expect(sfu.roomExists({id: room.id(), pin: "iurhfure"})).rejects.toHaveProperty("error", RoomError.WRONG_PIN);
        await room.destroyRoom();
        sfu.disconnect();
    });
    it('room exists should fail on null room id', async () => {
        const sfu = await connect(TEST_USER_0);
        await expect(sfu.roomExists({id: null})).rejects.toHaveProperty("error", RoomError.ID_IS_NULL);
        sfu.disconnect();
    });
    it('room available should fail on null room id', async () => {
        const sfu = await connect(TEST_USER_0);
        await expect(sfu.roomAvailable({id: null})).rejects.toHaveProperty("error", RoomError.ID_IS_NULL);
        sfu.disconnect();
    });
    it("should load room after disconnect", async () => {
        let sfu = await connect(TEST_USER_0);
        let room = await sfu.createRoom({
            ...TEST_ROOM,
            id: sfu.user().pmi
        });
        expect(room).toBeTruthy();
        expect(room.id()).toBe(sfu.user().pmi);
        expect(room.name()).toEqual(TEST_ROOM.name);
        sfu.disconnect();
        sfu = await connect(TEST_USER_0);
        let rooms = await sfu.loadActiveRooms();
        expect(rooms.length).toBe(1);
        room = sfu.getRoom({id: rooms[0].id});
        expect(room).toBeTruthy();
        expect(room.id()).toBe(sfu.user().pmi);
        expect(room.name()).toBe(TEST_ROOM.name);
        expect(room.creationTime()).toBeTruthy();
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should join room", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection());
        expect(state.name).toEqual(TEST_USER_0.nickname);
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should join pinless room", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...PINLESS_TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection());
        expect(state.name).toEqual(TEST_USER_0.nickname);
        await room.destroyRoom();
        sfu.disconnect();
    })
    it("should join room with custom nickname", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection(), MEETING_NICKNAME);
        expect(state.name).toEqual(MEETING_NICKNAME);
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should join room using custom nickname", async () => {
        const CUSTOM_NICKNAME = "pumicestone";
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        const state = await room.join(new wrtc.RTCPeerConnection(), CUSTOM_NICKNAME);
        expect(state.name).toEqual(CUSTOM_NICKNAME);
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("should leave room", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const state = await room.leaveRoom();
        expect(state.name).toEqual(TEST_USER_0.nickname);
        sfu.disconnect();
    });
    it("should destroy room", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.destroyRoom();
        sfu.disconnect();
    });
    it("destroying room should result in ENDED event if user was joined", async (done) => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        room.on(RoomEvent.ENDED, function() {
            sfu.disconnect();
            done();
        });
        await room.join(new wrtc.RTCPeerConnection());
        room.destroyRoom();
    });
    it("should fail if room is not available", async () => {
        const sfu = await connect(TEST_USER_0);
        await expect(sfu.roomAvailable({id: "lkwjflkf"})).rejects.toHaveProperty("error", "Room is not available");
        sfu.disconnect();
    });
    it("should update state", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        const aSender = room.pc().addTrack(aTrack);

        await room.updateState({});
        aTrack.stop();
        aSource.close();
        room.pc().removeTrack(aSender);
        await room.updateState();
        sfu.disconnect();
    });
    //relates to zapp-64
    it.skip("should send message", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.sendMessage(TEST_MESSAGE_ROOM);
        sfu.disconnect();
    });
    it("should configure waiting room", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        const state = await room.configureWaitingRoom(false);
        expect(state.enabled).toBeFalsy();
        sfu.disconnect();
    });
    it("sending control message to nonexistent participant should result in rejection", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await expect(room.sendControlMessage(TEST_MESSAGE_ROOM, false, TEST_USER_1.nickname)).rejects.toBeTruthy();
        sfu.disconnect();
    });
    it("should broadcast control message", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await room.sendControlMessage(TEST_MESSAGE_ROOM, true);
        sfu.disconnect();
    });
    it("should change room lock", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        expect(room.config().locked).toBeFalsy();
        await room.setLock(true);
        expect(room.config().locked).toBeTruthy();
        sfu.disconnect();
    });
    it("should receive participant config", async () => {
        const sfu = await connect(TEST_USER_0);
        const room = await sfu.createRoom({
            ...TEST_ROOM
        });
        await room.join(new wrtc.RTCPeerConnection());
        await waitForRoomEvent(RoomEvent.PARTICIPANT_CONFIG, room, (r) => r.config().participantsConfig[TEST_USER_0.nickname] !== undefined, () => {});
        sfu.disconnect();
    });
    describe("notifications", () => {
        it("room available should convey initial config", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            expect(room0.config()).toBeTruthy();
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            expect(room1.config()).toBeTruthy();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("should mute participant's audio", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room0.setParticipantAudioMuted(TEST_USER_1.nickname, true);
            expect(room0.config().participantsConfig[TEST_USER_1.nickname].audioMuted).toBeTruthy();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("should mute participant's video", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room0.setParticipantVideoMuted(TEST_USER_1.nickname, true);
            expect(room0.config().participantsConfig[TEST_USER_1.nickname].videoMuted).toBeTruthy();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("should mute participant's screen sharing", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room0.setParticipantScreenSharingMuted(TEST_USER_1.nickname, true);
            expect(room0.config().participantsConfig[TEST_USER_1.nickname].screenSharingMuted).toBeTruthy();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        //relates to zapp-64
        it.skip("should receive message", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            room1.on(RoomEvent.MESSAGE, (msg) => {
                const message = msg as RoomMessage;
                expect(message).toBeTruthy();
                expect(message.message.nickName).toEqual(TEST_USER_0.nickname);
                expect(message.message.message).toEqual(TEST_MESSAGE_ROOM);
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            });
            await room0.sendMessage(TEST_MESSAGE_ROOM);
        });
        it("should assign role", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            room0.on(RoomEvent.JOINED, async (msg) => {
                const state = msg as JoinedRoom;
                await room0.assignRole(state.name, ParticipantRole.OWNER);
                expect(room0.role()).toEqual(ParticipantRole.PARTICIPANT);
            });
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            expect(room1.creationTime()).toBeTruthy();
            room1.on(RoomEvent.ROLE_ASSIGNED, async (msg) => {
                const state = msg as RoleAssigned;
                if (ParticipantRole.PARTICIPANT === state.role) {
                    return;
                }
                expect(state.role).toEqual(ParticipantRole.OWNER);
                await room1.destroyRoom();
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            });
            await room1.join(new wrtc.RTCPeerConnection());
        });
        it("should reclaim owner rights", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room0.assignRole(TEST_USER_1.nickname, ParticipantRole.OWNER);
            expect(room0.role()).toEqual(ParticipantRole.PARTICIPANT);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());
            await room0.reclaimOwnerRights();
            expect(room0.role()).toEqual(ParticipantRole.OWNER);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            await room0.destroyRoom();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("previous owner should enter the room without current owner approval", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            let room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                if (list.users.length > 0) {
                    await room0.authorizeWaitingList(list.users[0].id, true);
                }
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            await room1.join(new wrtc.RTCPeerConnection());
            room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
            await room0.assignRole(TEST_USER_1.nickname, ParticipantRole.OWNER);
            expect(room0.role()).toEqual(ParticipantRole.PARTICIPANT);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());
            await room0.leaveRoom();
            room0 = await sfu0.roomAvailable({
                ...TEST_ROOM,
                id: room1.id()
            });
            await room0.join(new wrtc.RTCPeerConnection());
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("previous owner should enter the room without current owner approval and reclaim ownership", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            let room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                if (list.users.length > 0) {
                    await room0.authorizeWaitingList(list.users[0].id, true);
                }
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            await room1.join(new wrtc.RTCPeerConnection());
            room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
            await room0.assignRole(TEST_USER_1.nickname, ParticipantRole.OWNER);
            expect(room0.role()).toEqual(ParticipantRole.PARTICIPANT);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());
            await room0.leaveRoom();
            room0 = await sfu0.roomAvailable({
                ...TEST_ROOM,
                id: room1.id()
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.reclaimOwnerRights();
            expect(room0.role()).toEqual(ParticipantRole.OWNER);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("previous owner should enter the room without current owner approval after disconnect", async () => {
            let sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            let room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                if (list.users.length > 0) {
                    await room0.authorizeWaitingList(list.users[0].id, true);
                }
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            await room1.join(new wrtc.RTCPeerConnection());
            room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
            await room0.assignRole(TEST_USER_1.nickname, ParticipantRole.OWNER);
            expect(room0.role()).toEqual(ParticipantRole.PARTICIPANT);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());
            await room0.leaveRoom();
            sfu0.disconnect();
            sfu0 = await connect(TEST_USER_0);
            const rooms = await sfu0.loadActiveRooms();
            expect(rooms.length).toBe(1);
            room0 = sfu0.getRoom({id: room1.id()});
            expect(room0).toBeTruthy();
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.reclaimOwnerRights();
            expect(room0.role()).toEqual(ParticipantRole.OWNER);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                room1,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Should authorize waiting participant", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, true);
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            room1.join(new wrtc.RTCPeerConnection());
        });
        it('Should authorize waiting participant after the second attempt', async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            const waitingListHandlerReject = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandlerReject);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, false);
            };
            room0.on(RoomEvent.WAITING_LIST, waitingListHandlerReject);
            await expect(room1.join(new wrtc.RTCPeerConnection())).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);
            const waitingListHandlerAccept = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                await waitForRoomEvent(RoomEvent.WAITING_LIST, room0, (room) => list.users.length === 1,
                    function () {});
                room0.off(RoomEvent.WAITING_LIST, waitingListHandlerAccept);
                await room0.authorizeWaitingList(list.users[0].id, true);
            };
            const room2 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            room0.on(RoomEvent.WAITING_LIST, waitingListHandlerAccept)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });
            await room2.join(new wrtc.RTCPeerConnection());
        });
        it("Should remove room from inner collection on left", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room1.leaveRoom();
            expect(sfu1.getRoom({id: room1.id()})).toBe(undefined);
            await room0.destroyRoom();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Should remove room from inner collection on ended", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            await room0.destroyRoom();
            await waitForRoomEvent(RoomEvent.ENDED, room1, (room) => sfu1.getRoom({id: room1.id()}) === undefined, function () {});
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Should receive participants roles", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, true);
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            room1.on(RoomEvent.ROLES_LIST, (msg) => {
                const rolesListEvent = msg as RolesListEvent;
                expect(rolesListEvent.roles).toBeTruthy();
                expect(rolesListEvent.roles.length).toEqual(2);
                const bobRoleInfo = rolesListEvent.roles.find((p) => p.name === TEST_USER_0.nickname);
                expect(bobRoleInfo).toBeTruthy();
                expect(bobRoleInfo.role).toEqual(ParticipantRole.OWNER);
                sfu1.disconnect();
                sfu0.disconnect();
                done();
            });
            room1.join(new wrtc.RTCPeerConnection());
        });
        it("Should kick waiting participant", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, false);
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await expect(room1.join(new wrtc.RTCPeerConnection())).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("waiting participant should receive error at meeting end", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                room0.destroyRoom();
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await expect(room1.join(new wrtc.RTCPeerConnection())).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("participant using wrong pin should receive error", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                id: room0.id(),
                pin: "wrong_pin"
            });
            await expect(room1.join(new wrtc.RTCPeerConnection())).rejects.toHaveProperty("error", RoomError.WRONG_PIN);
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("participant using already taken nickname should receive error", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await expect(room1.join(new wrtc.RTCPeerConnection(), TEST_USER_0.nickname)).rejects.toHaveProperty("error", RoomError.NICKNAME_UNAVAILABLE);
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Should move participant to waiting room", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler0 = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler0);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, true);
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler0)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    room0.on(RoomEvent.WAITING_LIST, async (msg) => {
                        const list = msg as WaitingListEvent;
                        expect(list.users).toBeTruthy();
                        expect(list.users.length).toEqual(1);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    await room0.moveToWaitingRoom(TEST_USER_1.nickname)
                });
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            room1.join(new wrtc.RTCPeerConnection());
        });
        it("Should subscribe to waiting participant", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                const state = await room0.subscribeToWaitingParticipant(list.users[0].nickname);
                expect(state.info).toBeTruthy();
                expect(state.info.waitingRoom).toBeTruthy();
                expect(state.info.info.length).toEqual(1);
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const room1 = await sfu1.roomAvailable({
                id: room0.id()
            });
            const pc = new wrtc.RTCPeerConnection();
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            const aSender = pc.addTrack(aTrack);
            room1.join(pc);
        });
        it("Should unsubscribe from waiting participant", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                let state = await room0.subscribeToWaitingParticipant(list.users[0].nickname);
                expect(state.info).toBeTruthy();
                expect(state.info.waitingRoom).toBeTruthy();
                expect(state.info.info.length).toEqual(1);
                state = await room0.unsubscribeFromWaitingParticipant(list.users[0].nickname);
                expect(state.info).toBeTruthy();
                expect(state.info.waitingRoom).toBeTruthy();
                expect(state.info.info.length).toEqual(1);
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const room1 = await sfu1.roomAvailable({
                id: room0.id()
            });
            const pc = new wrtc.RTCPeerConnection();
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            const aSender = pc.addTrack(aTrack);
            room1.join(pc);
        });
        it("should receive control message", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);
            room0.on(RoomEvent.JOINED, (msg) => {
                const status = msg as JoinedRoom;
                room0.sendControlMessage(TEST_MESSAGE_ROOM, false, status.name);
            });
            const room1 = await sfu1.roomAvailable({
                id: room0.id(),
                pin: TEST_ROOM.pin
            });
            room1.on(RoomEvent.CONTROL_MESSAGE, (msg) => {
                const event = msg as ControlMessageEvent;
                expect(event.message).toBeTruthy();
                expect(event.message.body).toEqual(TEST_MESSAGE_ROOM);
                sfu0.disconnect();
                sfu1.disconnect();
                done();
            })
            await room1.join(new wrtc.RTCPeerConnection());
        });
        it("Should kick participant from room", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const pc0 = new wrtc.RTCPeerConnection();
            const sfu1 = await connect(TEST_USER_1);
            const pc1 = new wrtc.RTCPeerConnection();
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            room0
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    await room0.evictParticipant(state.name);
                })
                .on(RoomEvent.EVICTED, async (msg) => {
                    const state = msg as EvictedFromRoom;
                    expect(state.name).toBe(TEST_USER_1.nickname);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                })
            await room0.join(pc0);
            await waitForPeerConnectionStableState(pc0);
            await room0.configureWaitingRoom(false);
            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(pc1);
            await waitForPeerConnectionStableState(pc1);

        });
        it('Should fail if user try to connect second time when he already connected', async () => {
            const sfu0 = await connect(TEST_USER_0);
            await expect(connect(TEST_USER_0)).rejects.toBeTruthy();
            sfu0.disconnect();
        });
        it("Should rename second participant", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const pc0 = new wrtc.RTCPeerConnection();
            const sfu1 = await connect(TEST_USER_1);
            const pc1 = new wrtc.RTCPeerConnection();
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(pc0);
            await waitForPeerConnectionStableState(pc0);
            await room0.configureWaitingRoom(false);

            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });

            const updatedNickname = "RENAMED";

            room0
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    await room0.renameParticipant(state.name, updatedNickname);
                    expect(room1.nickname()).toEqual(updatedNickname);
                    await room0.destroyRoom();
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });

            await room1.join(pc1);
            await waitForPeerConnectionStableState(pc1);
        });
        it("Should reject renaming participant if nickname is already taken", async (done) => {
            const sfu0 = await connect(TEST_USER_0);
            const pc0 = new wrtc.RTCPeerConnection();
            const sfu1 = await connect(TEST_USER_1);
            const pc1 = new wrtc.RTCPeerConnection();
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(pc0);
            await waitForPeerConnectionStableState(pc0);
            await room0.configureWaitingRoom(false);

            room0
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    const alreadyTakenNickname = room0.nickname();
                    await expect(room0.renameParticipant(state.name, alreadyTakenNickname)).rejects.toHaveProperty("error", RoomError.NICKNAME_ALREADY_TAKEN);
                    await room0.destroyRoom();
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });

            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(pc1);
            await waitForPeerConnectionStableState(pc1);
        });
        it("Second participant should change nickname after join room", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const pc0 = new wrtc.RTCPeerConnection();
            const sfu1 = await connect(TEST_USER_1);
            const pc1 = new wrtc.RTCPeerConnection();
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(pc0);
            await waitForPeerConnectionStableState(pc0);
            await room0.configureWaitingRoom(false);

            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });

            await room1.join(pc1);
            await waitForPeerConnectionStableState(pc1);

            const updatedNickname = "RENAMED";

            await room1.renameParticipant(room1.nickname(), updatedNickname);
            expect(room1.nickname()).toEqual(updatedNickname);
            await room0.destroyRoom();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Participant should receive error when trying to join to locked room", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());

            await room0.setLock(true);

            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await expect(room1.join(new wrtc.RTCPeerConnection())).rejects.toHaveProperty("error", RoomError.ROOM_IS_LOCKED);

            await room0.destroyRoom();
            sfu0.disconnect();
            sfu1.disconnect();
        });
        it("Should reject participant's attempt to change nickname if setting canChangeNickname is turned off", async () => {
            const sfu0 = await connect(TEST_USER_0);
            const sfu1 = await connect(TEST_USER_1);
            const room0 = await sfu0.createRoom({
                ...TEST_ROOM
            });
            await room0.join(new wrtc.RTCPeerConnection());
            await room0.configureWaitingRoom(false);

            const room1 = await sfu1.roomAvailable({
                ...TEST_ROOM,
                id: room0.id()
            });
            await room1.join(new wrtc.RTCPeerConnection());
            expect(room1.config().canChangeNickname).toBe(true);
            await room0.setCanChangeNickname(false);
            await waitForRoomEvent(RoomEvent.ROOM_CAN_CHANGE_NICKNAME, room1, (room) => room.config().canChangeNickname === false, function () {});
            await expect(room1.renameParticipant(room1.nickname(), "NEW_NICKNAME")).rejects.toHaveProperty("error", RoomError.RENAMING_PROHIBITED);
            await room0.destroyRoom();
            sfu0.disconnect();
            sfu1.disconnect();
        });
    });
    describe("chats", () => {
        it("should create chat on creating meeting", async (done) => {
            const bob = await connect(TEST_USER_0);
            bob.on(SfuEvent.NEW_CHAT, async (msg) => {
                const chat = msg as UserSpecificChatInfo;
                const rooms = await bob.loadActiveRooms();
                const chatRoom = rooms.find(room => room.id === chat.id);
                expect(chatRoom).toBeTruthy();
                if (chatRoom) {
                    const room = bob.getRoom({id: chatRoom.id});
                    expect(chat.id).toEqual(room.id());
                    await room.destroyRoom();
                }
                bob.disconnect();
                done();
            })
            await bob.createRoom({
                ...TEST_ROOM
            });
        });
        it("should remove chat on ending meeting", async (done) => {
            const bob = await connect(TEST_USER_0);
            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });
            bob
                .on(SfuEvent.NEW_CHAT, async (msg) => {
                    const chat = msg as UserSpecificChatInfo;
                    const rooms = await bob.loadActiveRooms();
                    const chatRoom = rooms.find(room => room.id === chat.id);
                    expect(chatRoom).toBeTruthy();
                    if (chatRoom) {
                        const room = bob.getRoom({id: chatRoom.id});
                        expect(chat.id).toEqual(room.id());
                        await room.destroyRoom();
                    }
                })
                .on(SfuEvent.CHAT_DELETED, async (msg) => {
                    const chat = msg as UserSpecificChatInfo;
                    expect(chat.id).toEqual(room0.id());
                    bob.disconnect();
                    done();
                })

            await room0.join(new wrtc.RTCPeerConnection());
            await room0.leaveRoom();
        })
        it("should remove participant from chat on exit from room", async (done) => {
            const bob = await connect(TEST_USER_0);
            const bobPc = new wrtc.RTCPeerConnection();

            const alice = await connect(TEST_USER_1);
            const alicePc = new wrtc.RTCPeerConnection();

            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });
            const joinedEvent = await room0.join(bobPc);
            await waitForPeerConnectionStableState(bobPc);

            const roomChatId = joinedEvent.chatId;
            expect(roomChatId).toBeTruthy();

            await room0.configureWaitingRoom(false);
            room0
                .on(RoomEvent.JOINED, async (msg) => {
                    const chats = await bob.getUserChats();
                    const meetingChat = chats[roomChatId];
                    expect(meetingChat.members.length).toBe(2);
                    await room1.leaveRoom();
                })
                .on(RoomEvent.LEFT, async (msg) => {
                    const chats = await bob.getUserChats();
                    const meetingChat = chats[roomChatId];
                    expect(meetingChat.members.length).toBe(1);
                    const room = bob.getRoom({id: meetingChat.id});
                    await room.destroyRoom();
                    bob.disconnect();
                    alice.disconnect();
                    done();
                })

            const room1 = await alice.roomAvailable({
                id: room0.id(),
                pin: TEST_ROOM.pin
            });
            await room1.join(alicePc);
            await waitForPeerConnectionStableState(alicePc);
        });
        it("should remove participant from chat on moving to waiting room", async (done) => {
            const bob = await connect(TEST_USER_0);
            const bobPc = new wrtc.RTCPeerConnection();

            const alice = await connect(TEST_USER_1);
            const alicePc = new wrtc.RTCPeerConnection();

            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });

            const joinedEvent = await room0.join(bobPc);
            await waitForPeerConnectionStableState(bobPc);

            const roomChatId = joinedEvent.chatId;
            expect(roomChatId).toBeTruthy();
            await room0.configureWaitingRoom(true);

            const waitingListHandler = async (msg: InternalMessage) => {
                room0.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await room0.authorizeWaitingList(list.users[0].id, true);
            }
            room0.on(RoomEvent.WAITING_LIST, waitingListHandler);

            const room1 = await alice.roomAvailable({
                id: room0.id(),
                pin: TEST_ROOM.pin
            });
            alice
                .on(SfuEvent.NEW_CHAT, async (msg) => {
                    const newChat = msg as UserSpecificChatInfo;
                    expect(newChat.members.length).toBe(2);
                    await room0.moveToWaitingRoom(TEST_USER_1.nickname);
                })
                .on(SfuEvent.CHAT_DELETED, async (msg) => {
                    expect(msg).toBeTruthy();
                    const room = bob.getRoom({id: room0.id()});
                    await room.destroyRoom();
                    bob.disconnect();
                    alice.disconnect();
                    done();
                })

            await room1.join(alicePc);
            await waitForPeerConnectionStableState(alicePc);
        })
        it("should send message to second participant", async (done) => {
            const bob = await connect(TEST_USER_0);
            const alice = await connect(TEST_USER_1);

            bob.on(SfuEvent.MESSAGE, async (msg) => {
                const message = msg as Message;
                expect(message).toBeTruthy();
                const rooms = await bob.loadActiveRooms();
                const chatRoom = rooms.find(room => room.id === message.chatId);
                expect(chatRoom).toBeTruthy();
                if (chatRoom) {
                    const room = bob.getRoom({id: chatRoom.id});
                    expect(message.chatId).toEqual(room.id());
                    await room.destroyRoom();
                }
                alice.disconnect();
                bob.disconnect();
                done();
            })

            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });

            const joinedEvent = await room0.join(new wrtc.RTCPeerConnection());
            const roomChatId = joinedEvent.chatId;
            expect(roomChatId).toBeTruthy();

            await room0.configureWaitingRoom(false);
            room0.on(RoomEvent.JOINED, async (msg) => {
                await bob.sendMessage({body: "Test from Bob", chatId: roomChatId})
            })

            const room1 = await alice.roomAvailable({
                id: room0.id(),
                pin: TEST_ROOM.pin
            });
            alice.on(SfuEvent.MESSAGE, async (msg) => {
                const message = msg as Message;
                expect(message).toBeTruthy();
                await alice.sendMessage({body: "Test from Alice", chatId: roomChatId})
            })

            await room1.join(new wrtc.RTCPeerConnection());
        })
        it("owner should update chat receive policy", async () => {
            const bob = await connect(TEST_USER_0);

            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });

            const joinedEvent = await room0.join(new wrtc.RTCPeerConnection());
            const roomChatId = joinedEvent.chatId;
            expect(roomChatId).toBeTruthy();
            await room0.configureWaitingRoom(false);

            const chatInfo = await bob.updateChatReceivePolicy({id: roomChatId, chatReceivePolicy: ChatReceivePolicy.OWNER_ONLY});
            expect(chatInfo.chatReceivePolicy).toEqual(ChatReceivePolicy.OWNER_ONLY);
            await room0.destroyRoom();
            bob.disconnect();
        })
        it("should fail to send message if chat receive policy is NOBODY", async (done) => {
            const bob = await connect(TEST_USER_0);
            const bobPc = new wrtc.RTCPeerConnection();

            const alice = await connect(TEST_USER_1);
            const alicePc = new wrtc.RTCPeerConnection();

            const room0 = await bob.createRoom({
                ...TEST_ROOM
            });

            const joinedEvent = await room0.join(bobPc);
            await waitForPeerConnectionStableState(bobPc);
            const roomChatId = joinedEvent.chatId;
            expect(roomChatId).toBeTruthy();
            await room0.configureWaitingRoom(false);

            await bob.updateChatReceivePolicy({id: roomChatId, chatReceivePolicy: ChatReceivePolicy.NOBODY});

            const room1 = await alice.roomAvailable({
                id: room0.id(),
                pin: TEST_ROOM.pin
            });
            alice.on(SfuEvent.NEW_CHAT, async (msg) => {
                await expect(alice.sendMessage({chatId: roomChatId, body: "Test from Alice"})).rejects.toBeTruthy();
                await room0.destroyRoom();
                bob.disconnect();
                alice.disconnect();
                done();
            })

            await room1.join(alicePc);
            await waitForPeerConnectionStableState(alicePc);
        })
    })
});