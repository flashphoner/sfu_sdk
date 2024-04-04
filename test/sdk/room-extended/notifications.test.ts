import {RoomEvent, SfuExtended} from "../../../src";
import {TEST_MESSAGE_ROOM, TEST_ROOM, TEST_USER_0, TEST_USER_1} from "../../util/constants";
import {
    AddRemoveTracks,
    ControlMessageEvent,
    EvictedFromRoom,
    InternalMessage,
    JoinedRoom,
    ParticipantRole,
    PlacedInLobbyEvent,
    RoleAssigned,
    RolesListEvent,
    RoomError,
    WaitingListEvent
} from "../../../src/sdk/constants";
import {connect, waitForRoomEvent, waitForUsers} from "../../util/utils";
import {waitForPeerConnectionStableState} from "../../util/pcUtils";
import {RoomExtended} from "../../../src/sdk/room-extended";

const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../../lib/rtcaudiosourcesinewave");

describe("notifications", () => {
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
    describe("waiting room", () => {
        it("Should authorize waiting participant", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });

            const authorizeParticipantAndDestroyRoom = async () => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    expect(list.users[0].userId).toBeTruthy();
                    await bobRoom.authorizeWaitingList(list.users[0].userId, true);
                }
                const joinHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.JOINED, joinHandler);
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    expect(state.userId).toBeTruthy();
                    await bobRoom.destroyRoom();
                    resolve();
                }
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler)
                    .on(RoomEvent.JOINED, joinHandler);
            });

            aliceRoom.join(alicePc);
            await authorizeParticipantAndDestroyRoom();
        });
        it('Should authorize waiting participant after the second attempt', async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });

            const failParticipantAuthorization = async () => new Promise<void>((resolve) => {
                const waitingListHandlerReject = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandlerReject);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, false);
                    resolve();
                };
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandlerReject);
            })

            expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);

            await failParticipantAuthorization();

            const authorizeParticipantAndDestroyRoom = async () => new Promise<void>((resolve) => {
                const waitingListHandlerAccept = async (msg: InternalMessage) => {
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    await waitForRoomEvent(RoomEvent.WAITING_LIST, bobRoom, (room) => list.users.length === 1,
                        function () {});
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandlerAccept);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, true);
                };
                const joinHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.JOINED, joinHandler);
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    expect(state.userId).toBeTruthy();
                    await bobRoom.destroyRoom();
                    resolve();
                };

                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandlerAccept)
                    .on(RoomEvent.JOINED, joinHandler);
            });

            const aliceRoom2 = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });

            aliceRoom2.join(new wrtc.RTCPeerConnection());
            await authorizeParticipantAndDestroyRoom();
        });
        it("Should kick waiting participant", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            const kickParticipant = async () => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, false);
                    await bobRoom.destroyRoom();
                    resolve();
                }
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            });
            expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);
            await kickParticipant();
        });
        it("Should move participant to waiting room", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const authorizeParticipantAndMoveToWaitingRoom = async () => new Promise<void>((resolve) => {
                const firstWaitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, firstWaitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    bobRoom.authorizeWaitingList(list.users[0].userId, true);
                }

                const joinHandler = async (msg) => {
                    bobRoom.off(RoomEvent.JOINED, joinHandler);
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);

                    const secondWaitingListHandler = async (msg) => {
                        bobRoom.off(RoomEvent.WAITING_LIST, secondWaitingListHandler);
                        const list = msg as WaitingListEvent;
                        expect(list.users).toBeTruthy();
                        expect(list.users.length).toEqual(1);
                        await bobRoom.destroyRoom();
                        resolve();
                    };

                    bobRoom.on(RoomEvent.WAITING_LIST, secondWaitingListHandler);
                    bobRoom.moveToWaitingRoom(state.userId);
                };

                bobRoom.on(RoomEvent.WAITING_LIST, firstWaitingListHandler)
                    .on(RoomEvent.JOINED, joinHandler);
            })

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            aliceRoom.join(alicePc);
            await authorizeParticipantAndMoveToWaitingRoom();
        });
        it("Should subscribe to waiting participant", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });

            const subscribeToWaitingParticipant = async () => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    const state = await bobRoom.subscribeToWaitingParticipant(list.users[0].userId);
                    expect(state.info).toBeTruthy();
                    expect(state.info.waitingRoom).toBeTruthy();
                    expect(state.info.info.length).toEqual(1);
                    await bobRoom.destroyRoom();
                    resolve();
                }
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            alicePc.addTrack(aTrack);
            expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
            await subscribeToWaitingParticipant();
        });
        it("Should unsubscribe from waiting participant", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });

            const subscribeToWaitingParticipantAndUnsubscribe = async () => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    let state = await bobRoom.subscribeToWaitingParticipant(list.users[0].userId);
                    expect(state.info).toBeTruthy();
                    expect(state.info.waitingRoom).toBeTruthy();
                    expect(state.info.info.length).toEqual(1);
                    state = await bobRoom.unsubscribeFromWaitingParticipant(list.users[0].userId);
                    expect(state.info).toBeTruthy();
                    expect(state.info.waitingRoom).toBeTruthy();
                    expect(state.info.info.length).toEqual(1);
                    await bobRoom.destroyRoom();
                    resolve();
                }
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            alicePc.addTrack(aTrack);
            expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
            await subscribeToWaitingParticipantAndUnsubscribe();
        });
        it("Waiting participant should receive error at meeting end", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await bobRoom.destroyRoom();
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
        });
    })
    describe("roles", () => {
        it("Should assign role", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            expect(aliceRoom.creationTime()).toBeTruthy();

            const waitWhenAliceJoined = async () => new Promise<void>((resolve) => {
                const joinHandler = async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    await bobRoom.assignRole(state.userId, ParticipantRole.OWNER);
                    expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);
                };
                const rolesHandler = async (msg) => {
                    const state = msg as RoleAssigned;
                    if (ParticipantRole.PARTICIPANT === state.role) {
                        return;
                    }
                    expect(state.role).toEqual(ParticipantRole.OWNER);
                    await aliceRoom.destroyRoom();
                    resolve();
                };
                bobRoom.on(RoomEvent.JOINED, joinHandler)
                    .on(RoomEvent.ROLE_ASSIGNED, rolesHandler);
            });

            aliceRoom.join(alicePc);
            await waitWhenAliceJoined();
        });
        it("Should reclaim owner rights", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await bobRoom.assignRole(aliceRoom.userId(), ParticipantRole.OWNER);
            expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);

            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());

            await bobRoom.reclaimOwnerRights();
            expect(bobRoom.role()).toEqual(ParticipantRole.OWNER);

            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            await bobRoom.destroyRoom();
        });
        it("previous owner should enter the room without current owner approval", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            let bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                expect(list.users.length).toBeGreaterThan(0);
                if (list.users.length > 0) {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, true);
                }
            }
            bobRoom
                .on(RoomEvent.WAITING_LIST, waitingListHandler)
                .on(RoomEvent.JOINED, async (msg) => {
                    const event = msg as JoinedRoom;
                    expect(event.name).toEqual(TEST_USER_1.nickname);
                    await bobRoom.assignRole(event.userId, ParticipantRole.OWNER);
                    await waitForRoomEvent(
                    RoomEvent.ROLE_ASSIGNED,
                    bobRoom,
                    (room) => room.role() === ParticipantRole.PARTICIPANT,
                    (room) => room.role());
                    expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);
            });

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());

            await bobRoom.leaveRoom();
            bobRoom = await bob.roomAvailable({
                ...TEST_ROOM,
                id: aliceRoom.id()
            });
            await bobRoom.join(new wrtc.RTCPeerConnection());
            await bobRoom.destroyRoom();
        });
        it("Owner should reclaim ownership after reconnection", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            let bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                if (list.users.length > 0) {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, true);
                }
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await waitForRoomEvent(RoomEvent.JOINED,
                bobRoom,
                (room) => true,
                () => {}
            )

            await bobRoom.assignRole(aliceRoom.userId(), ParticipantRole.OWNER);
            expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);

            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());

            await bobRoom.leaveRoom();
            bobRoom = await bob.roomAvailable({
                ...TEST_ROOM,
                id: aliceRoom.id()
            });
            await bobRoom.join(new wrtc.RTCPeerConnection());
            await bobRoom.reclaimOwnerRights();
            expect(bobRoom.role()).toEqual(ParticipantRole.OWNER);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            await bobRoom.destroyRoom();
        });
        it("Owner should re-enter the room without approval after disconnect", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            let bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                expect(list.users.length).toBeGreaterThan(0);
                if (list.users.length > 0) {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    await bobRoom.authorizeWaitingList(list.users[0].userId, true);
                }
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await waitForRoomEvent(RoomEvent.JOINED,
                bobRoom,
                (room) => true,
                () => {}
                )

            await bobRoom.assignRole(aliceRoom.userId(), ParticipantRole.OWNER);
            expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);

            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.OWNER,
                (room) => room.role());
            await bobRoom.leaveRoom();
            await bob.disconnect();

            bob = await connect(TEST_USER_0);
            const rooms = await bob.loadActiveRooms();
            expect(rooms.length).toBe(1);
            bobRoom = bob.getRoom({id: aliceRoom.id()});
            expect(bobRoom).toBeTruthy();
            await bobRoom.join(new wrtc.RTCPeerConnection());
            await bobRoom.reclaimOwnerRights();
            expect(bobRoom.role()).toEqual(ParticipantRole.OWNER);
            await waitForRoomEvent(
                RoomEvent.ROLE_ASSIGNED,
                aliceRoom,
                (room) => room.role() === ParticipantRole.PARTICIPANT,
                (room) => room.role());
            await bobRoom.destroyRoom();
        });
        it("Should receive participants roles", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            const bobUserId = bobRoom.userId();

            await bobRoom.configureWaitingRoom(true);
            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });

            const authorizeParticipant = async () => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg: InternalMessage) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const list = msg as WaitingListEvent;
                    expect(list.users).toBeTruthy();
                    expect(list.users.length).toEqual(1);
                    bobRoom.authorizeWaitingList(list.users[0].userId, true);
                    resolve();
                }
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            });
            const waitParticipantRoles = async () => new Promise<void>((resolve) => {
                let eventsNumber = 0;
                const checkEventsNumberAndResolve = async () => {
                    if (eventsNumber === 2) {
                        await bobRoom.destroyRoom();
                        resolve();
                    }
                }
                const joinHandler = async (msg: InternalMessage) => {
                    eventsNumber++;
                    bobRoom.off(RoomEvent.JOINED, joinHandler);
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    await checkEventsNumberAndResolve();
                }
                const rolesList = async (msg: InternalMessage) => {
                    eventsNumber++;
                    aliceRoom.off(RoomEvent.ROLES_LIST, rolesList);
                    const rolesListEvent = msg as RolesListEvent;
                    expect(rolesListEvent.roles).toBeTruthy();
                    expect(rolesListEvent.roles.length).toEqual(2);
                    const bobRoleInfo = rolesListEvent.roles.find((p) => p.userId === bobUserId);
                    expect(bobRoleInfo).toBeTruthy();
                    expect(bobRoleInfo.role).toEqual(ParticipantRole.OWNER);
                    await checkEventsNumberAndResolve();
                };
                bobRoom.on(RoomEvent.JOINED, joinHandler);
                aliceRoom.on(RoomEvent.ROLES_LIST, rolesList);
            });

            aliceRoom.join(alicePc);
            await authorizeParticipant();
            await waitParticipantRoles();
        });
    })
    describe("tracks", () => {
        it("Should mute participant's audio", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc)

            await bobRoom.setParticipantAudioMuted(aliceRoom.userId(), true);
            expect(bobRoom.config().participantsConfig[aliceRoom.userId()].audioMuted).toBeTruthy();
            await bobRoom.destroyRoom();
        });
        it("Should mute participant's video", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await bobRoom.setParticipantVideoMuted(aliceRoom.userId(), true);
            expect(bobRoom.config().participantsConfig[aliceRoom.userId()].videoMuted).toBeTruthy();
            await bobRoom.destroyRoom();
        });
        it("Should mute participant's screen sharing", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);

            await bobRoom.setParticipantScreenSharingMuted(aliceRoom.userId(), true);
            expect(bobRoom.config().participantsConfig[aliceRoom.userId()].screenSharingMuted).toBeTruthy();
            await bobRoom.destroyRoom();
        });
        it("Should mute own audio track", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            bobPc.addTrack(aTrack);
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });

            await aliceRoom.join(alicePc);

            const waitMuteTracksEvent = async () => new Promise<void>((resolve) => {
                const muteTracksHandler = async (msg: InternalMessage) => {
                    aliceRoom.off(RoomEvent.MUTE_TRACKS, muteTracksHandler);
                    const tracks = msg as AddRemoveTracks;
                    expect(tracks.info.info).toBeTruthy();
                    const muteTrack = tracks.info.info[0];
                    expect(muteTrack.mute).toBeTruthy();
                    expect(tracks.info.userId).toBeTruthy();
                    await bobRoom.destroyRoom();
                    resolve();
                };
                aliceRoom.on(RoomEvent.MUTE_TRACKS, muteTracksHandler);
            });

            bobRoom.muteTrack(aTrack.id, true);
            await waitMuteTracksEvent();
        })
    })
    describe("hold", () => {
        it("Should hold participant if room doesn't allow to join at any time", async () => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false});

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            const waitWhenParticipantJoinedLobby = async () => new Promise<void>((resolve) => {
                const placedInLobbyHandler = async (msg) => {
                    aliceRoom.off(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
                    const holdEvent = msg as PlacedInLobbyEvent;
                    expect(holdEvent).toBeTruthy();
                    expect(holdEvent.userId).toBeTruthy();
                    await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
                    resolve();
                };
                aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
            });

            aliceRoom.join(new wrtc.RTCPeerConnection());
            await waitWhenParticipantJoinedLobby();
        })
        it("Should join if room allow to join at any time", async () => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: true, useWaitingRoom: false});

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            await aliceRoom.join(new wrtc.RTCPeerConnection());
            const bobRoom = await bob.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            await bobRoom.destroyRoom();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
        })
        it("Should change participant's state from hold to joined after owner enter the room", async () => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false, useWaitingRoom: false});

            const waitWhenParticipantJoined = async (bobRoom: RoomExtended) => new Promise<void>((resolve) => {
                const aliceJoinedHandler = async (msg) => {
                    bobRoom.off(RoomEvent.JOINED, aliceJoinedHandler);
                    const joinedEvent = msg as JoinedRoom;
                    if (joinedEvent.name === alice.user().nickname) {
                        await bobRoom.destroyRoom();
                        await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
                        resolve();
                    }
                };
                bobRoom.on(RoomEvent.JOINED, aliceJoinedHandler);
            });

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            const waitWhenParticipantJoinedLobbyAndJoinRoom = async () => new Promise<void>((resolve) => {
                const placedInLobbyHandler = async (msg) => {
                    aliceRoom.off(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
                    const holdEvent = msg as PlacedInLobbyEvent;
                    expect(holdEvent).toBeTruthy();
                    const bobRoom = await bob.roomAvailable({
                        id: bob.user().pmi,
                        pin: bobPmiSettings.pmiSettings.accessCode
                    });
                    expect(bobRoom).toBeTruthy();
                    bobRoom.join(new wrtc.RTCPeerConnection());
                    await waitWhenParticipantJoined(bobRoom);
                    resolve();
                };
                aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
            });
            aliceRoom.join(new wrtc.RTCPeerConnection());
            await waitWhenParticipantJoinedLobbyAndJoinRoom();
        })
        it("Should hold and then place participant into waiting room after owner enter the room", async () => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false, useWaitingRoom: true});

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            const authorizeParticipant = async (bobRoom: RoomExtended) => new Promise<void>((resolve) => {
                const waitingListHandler = async (msg) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const waitingList = msg as WaitingListEvent;
                    expect(waitingList.users.length).toBeGreaterThan(0);
                    await bobRoom.authorizeWaitingList(waitingList.users[0].userId, true);
                    await bobRoom.destroyRoom();
                    await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
                    resolve();
                };
                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            });

            const waitWhenParticipantJoinedLobbyAndAuthorize = async () => new Promise<void>((resolve) => {
                const placedInLobbyHandler = async (msg) => {
                    aliceRoom.off(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
                    const holdEvent = msg as PlacedInLobbyEvent;
                    expect(holdEvent).toBeTruthy();
                    const bobRoom = await bob.roomAvailable({
                        id: bob.user().pmi,
                        pin: bobPmiSettings.pmiSettings.accessCode
                    });
                    expect(bobRoom).toBeTruthy();
                    bobRoom.join(new wrtc.RTCPeerConnection());
                    await authorizeParticipant(bobRoom);
                    resolve();
                };
                aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, placedInLobbyHandler);
            });

            aliceRoom.join(new wrtc.RTCPeerConnection());
            await waitWhenParticipantJoinedLobbyAndAuthorize();
        })
    })
    describe("errors and rejects", () => {
        it("Should receive error on using wrong pin", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: "wrong_pin"
            });
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.WRONG_PIN);
            await bobRoom.destroyRoom();
        });
        it("Should receive error when trying to join to locked room", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.setLock(true);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_IS_LOCKED);

            await bobRoom.destroyRoom();
        });
        it("Should reject participant's attempt to change nickname if setting canChangeNickname is turned off", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            await aliceRoom.join(alicePc);
            expect(aliceRoom.config().canChangeNickname).toBe(true);

            await bobRoom.setCanChangeNickname(false);
            await waitForRoomEvent(RoomEvent.ROOM_CAN_CHANGE_NICKNAME, aliceRoom, (room) => room.config().canChangeNickname === false, function () {});
            await expect(aliceRoom.renameParticipant(aliceRoom.userId(), "NEW_NICKNAME")).rejects.toHaveProperty("error", RoomError.RENAMING_PROHIBITED);
            await bobRoom.destroyRoom();
        });
    });
    it("Room available should convey initial config", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        expect(bobRoom.config()).toBeTruthy();
        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });
        expect(aliceRoom.config()).toBeTruthy();
        await bobRoom.destroyRoom();
    });
    it("Should remove room from inner collection on left", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });
        await aliceRoom.join(alicePc);
        await aliceRoom.leaveRoom();
        expect(alice.getRoom({id: aliceRoom.id()})).toBe(undefined);
        await bobRoom.destroyRoom();
    });
    it("Should remove room from inner collection on ended", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });
        await aliceRoom.join(alicePc);
        await bobRoom.destroyRoom();
        await waitForRoomEvent(RoomEvent.ENDED, aliceRoom, (room) => alice.getRoom({id: aliceRoom.id()}) === undefined, function () {});
    });
    it("Should receive control message", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });

        const waitWhenAliceJoined = async () => new Promise<void>((resolve) => {
           const joinHandler = (msg: InternalMessage) => {
               bobRoom.off(RoomEvent.JOINED, joinHandler);
               const status = msg as JoinedRoom;
               bobRoom.sendControlMessage(TEST_MESSAGE_ROOM, false, status.userId);
               resolve();
           };
            bobRoom.on(RoomEvent.JOINED, joinHandler);
        });

        const waitControlMessage = async () => new Promise<void>((resolve) => {
           const controlMessageHandler = async (msg: InternalMessage) => {
               aliceRoom.off(RoomEvent.CONTROL_MESSAGE, controlMessageHandler);
               const event = msg as ControlMessageEvent;
               expect(event.message).toBeTruthy();
               expect(event.message.body).toEqual(TEST_MESSAGE_ROOM);
               await bobRoom.destroyRoom();
               resolve();
           };
            aliceRoom.on(RoomEvent.CONTROL_MESSAGE, controlMessageHandler);
        });
        aliceRoom.join(alicePc);
        await waitWhenAliceJoined();
        await waitControlMessage();
    });
    it("Should kick participant from room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const waitWhenAliceJoinedAndEvict = async () => new Promise<void>((resolve) => {
            const joinHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.JOINED, joinHandler);
                const state = msg as JoinedRoom;
                bobRoom.evictParticipant(state.userId);
            };

            const evictHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.EVICTED, evictHandler);
                const state = msg as EvictedFromRoom;
                expect(state.userId).toBeTruthy();
                await bobRoom.destroyRoom();
                resolve();
            };
            bobRoom
                .on(RoomEvent.JOINED, joinHandler)
                .on(RoomEvent.EVICTED, evictHandler);
        });

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });
        aliceRoom.join(alicePc);
        await waitWhenAliceJoinedAndEvict();
    });
    it("Should rename second participant", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });

        const updatedNickname = "RENAMED";

        const waitWhenAliceJoinedAndRename = async () => new Promise<void>((resolve) => {
            const joinHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.JOINED, joinHandler);
                const state = msg as JoinedRoom;
                await bobRoom.renameParticipant(state.userId, updatedNickname);
                await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === updatedNickname, (room) => room.nickname())
                expect(aliceRoom.nickname()).toEqual(updatedNickname);
                await bobRoom.destroyRoom();
                resolve();
            };
            bobRoom.on(RoomEvent.JOINED, joinHandler);
        });
        aliceRoom.join(alicePc);
        await waitWhenAliceJoinedAndRename();
    });
    it("Should change second participant nickname to already taken", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });

        const alreadyTakenNickname = bobRoom.nickname();

        const waitWhenAliceJoinedAndRename = async () => new Promise<void>((resolve) => {
            const joinHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.JOINED, joinHandler);
                const state = msg as JoinedRoom;
                await bobRoom.renameParticipant(state.userId, alreadyTakenNickname);
                await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === alreadyTakenNickname, (room) => room.nickname())
                expect(aliceRoom.nickname()).toEqual(alreadyTakenNickname);
                await bobRoom.destroyRoom();
                resolve();
            };
            bobRoom.on(RoomEvent.JOINED, joinHandler);
        });
        aliceRoom.join(alicePc);
        await waitWhenAliceJoinedAndRename();
    });
    it("Second participant should change nickname after join room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);

        const updatedNickname = "RENAMED";

        await aliceRoom.renameParticipant(aliceRoom.userId(), updatedNickname);
        await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === updatedNickname, (room) => room.nickname());
        expect(aliceRoom.nickname()).toEqual(updatedNickname);
        await bobRoom.destroyRoom();
    });
    it("Second participant should change nickname to already taken after join room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);

        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);

        const updatedNickname = bobRoom.nickname();

        await aliceRoom.renameParticipant(aliceRoom.userId(), updatedNickname);
        await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === updatedNickname, (room) => room.nickname());
        expect(aliceRoom.nickname()).toEqual(updatedNickname);
        await bobRoom.destroyRoom();
    });
});
