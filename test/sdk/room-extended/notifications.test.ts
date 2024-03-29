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
        it("Should authorize waiting participant", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                expect(list.users[0].userId).toBeTruthy();
                await bobRoom.authorizeWaitingList(list.users[0].userId, true);
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    expect(state.userId).toBeTruthy();
                    await bobRoom.destroyRoom();
                    done();
                });

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            await aliceRoom.join(alicePc)
        });
        it('Should authorize waiting participant after the second attempt', async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);

            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            const waitingListHandlerReject = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandlerReject);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await bobRoom.authorizeWaitingList(list.users[0].userId, false);
            };
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandlerReject);
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);
            const waitingListHandlerAccept = async (msg: InternalMessage) => {
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                await waitForRoomEvent(RoomEvent.WAITING_LIST, bobRoom, (room) => list.users.length === 1,
                    function () {});
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandlerAccept);
                await bobRoom.authorizeWaitingList(list.users[0].userId, true);
            };
            const room2 = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            bobRoom
                .on(RoomEvent.WAITING_LIST, waitingListHandlerAccept)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    expect(state.userId).toBeTruthy();
                    await bobRoom.destroyRoom();
                    done();
                });
            await room2.join(new wrtc.RTCPeerConnection());
        });
        it("Should kick waiting participant", async () => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await bobRoom.authorizeWaitingList(list.users[0].userId, false);
                await bobRoom.destroyRoom();
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.AUTHORIZATION_FAILED);
        });
        it("Should move participant to waiting room", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
            const waitingListHandler0 = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler0);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await bobRoom.authorizeWaitingList(list.users[0].userId, true);
            }
            bobRoom
                .on(RoomEvent.WAITING_LIST, waitingListHandler0)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    bobRoom.on(RoomEvent.WAITING_LIST, async (msg) => {
                        const list = msg as WaitingListEvent;
                        expect(list.users).toBeTruthy();
                        expect(list.users.length).toEqual(1);
                        done();
                    });
                    await bobRoom.moveToWaitingRoom(state.userId);
                });
            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            aliceRoom.join(alicePc)
        });
        it("Should subscribe to waiting participant", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
            const waitingListHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                const state = await bobRoom.subscribeToWaitingParticipant(list.users[0].userId);
                expect(state.info).toBeTruthy();
                expect(state.info.waitingRoom).toBeTruthy();
                expect(state.info.info.length).toEqual(1);
                done();
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            const aSender = alicePc.addTrack(aTrack);
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
        });
        it("Should unsubscribe from waiting participant", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({id: bob.user().pmi});
            await bobRoom.join(bobPc);
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
                done();
            }
            bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);
            const aliceRoom = await alice.roomAvailable({
                id: bobRoom.id(),
                pin: bobRoom.pin()
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            const aSender = alicePc.addTrack(aTrack);
            await expect(aliceRoom.join(alicePc)).rejects.toHaveProperty("error", RoomError.ROOM_DESTROYED);
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
        it("Should assign role", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);
            bobRoom.on(RoomEvent.JOINED, async (msg) => {
                const state = msg as JoinedRoom;
                expect(state.name).toEqual(TEST_USER_1.nickname);
                await bobRoom.assignRole(state.userId, ParticipantRole.OWNER);
                expect(bobRoom.role()).toEqual(ParticipantRole.PARTICIPANT);
            });

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            expect(aliceRoom.creationTime()).toBeTruthy();
            aliceRoom.on(RoomEvent.ROLE_ASSIGNED, async (msg) => {
                const state = msg as RoleAssigned;
                if (ParticipantRole.PARTICIPANT === state.role) {
                    return;
                }
                expect(state.role).toEqual(ParticipantRole.OWNER);
                await aliceRoom.destroyRoom();
                done();
            });
            await aliceRoom.join(alicePc);
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
        });
        it("Should receive participants roles", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            await bobRoom.join(bobPc);
            const bobUserId = bobRoom.userId();
            const waitingListHandler = async (msg: InternalMessage) => {
                bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                const list = msg as WaitingListEvent;
                expect(list.users).toBeTruthy();
                expect(list.users.length).toEqual(1);
                await bobRoom.authorizeWaitingList(list.users[0].userId, true);
            }
            bobRoom
                .on(RoomEvent.WAITING_LIST, waitingListHandler)
                .on(RoomEvent.JOINED, async (msg) => {
                    const state = msg as JoinedRoom;
                    expect(state.name).toEqual(TEST_USER_1.nickname);
                    done();
                });
            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });
            aliceRoom.on(RoomEvent.ROLES_LIST, async (msg) => {
                const rolesListEvent = msg as RolesListEvent;
                expect(rolesListEvent.roles).toBeTruthy();
                expect(rolesListEvent.roles.length).toEqual(2);
                const bobRoleInfo = rolesListEvent.roles.find((p) => p.userId === bobUserId);
                expect(bobRoleInfo).toBeTruthy();
                expect(bobRoleInfo.role).toEqual(ParticipantRole.OWNER);
                done();
            });
            await aliceRoom.join(alicePc);
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
        });
        it("Should mute own audio track", async (done) => {
            const bobPc = new wrtc.RTCPeerConnection();
            const alicePc = new wrtc.RTCPeerConnection();
            const bobRoom = await bob.createRoom({
                ...TEST_ROOM
            });
            const aSource = new RTCAudioSourceSineWave();
            const aTrack = aSource.createTrack();
            const aSender = bobPc.addTrack(aTrack);
            await bobRoom.join(bobPc);
            await bobRoom.configureWaitingRoom(false);

            const aliceRoom = await alice.roomAvailable({
                ...TEST_ROOM,
                id: bobRoom.id()
            });

            aliceRoom.on(RoomEvent.MUTE_TRACKS, (e) => {
                const tracks = e as AddRemoveTracks;
                expect(tracks.info.info).toBeTruthy();
                const muteTrack = tracks.info.info[0];
                expect(muteTrack.mute).toBeTruthy();
                expect(tracks.info.userId).toBeTruthy();
                done();
            })
            await aliceRoom.join(alicePc);

            await bobRoom.muteTrack(aTrack.id, true);
        })
    })
    describe("hold", () => {
        it("Should hold participant if room doesn't allow to join at any time", async (done) => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false});

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, async (msg) => {
                const holdEvent = msg as PlacedInLobbyEvent;
                expect(holdEvent).toBeTruthy();
                expect(holdEvent.userId).toBeTruthy();
                await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
                done();
            })

            await aliceRoom.join(new wrtc.RTCPeerConnection());
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
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
        })
        it("Should change participant's state from hold to joined after owner enter the room", async (done) => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false, useWaitingRoom: false});

            const ownerJoinRoom = async () => {
                const bobRoom = await bob.roomAvailable({
                    id: bob.user().pmi,
                    pin: bobPmiSettings.pmiSettings.accessCode
                });
                expect(bobRoom).toBeTruthy();

                bobRoom.on(RoomEvent.JOINED, async (msg) => {
                    const joinedEvent = msg as JoinedRoom;
                    if (joinedEvent.name === alice.user().nickname) {
                        await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
                        done();
                    }
                })

                await bobRoom.join(new wrtc.RTCPeerConnection());
            }

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, async (msg) => {
                const holdEvent = msg as PlacedInLobbyEvent;
                expect(holdEvent).toBeTruthy();
                await ownerJoinRoom();
            })

            await aliceRoom.join(new wrtc.RTCPeerConnection());
        })
        it("Should hold and then place participant into waiting room after owner enter the room", async (done) => {
            const bobPmiSettings = await bob.getUserPmiSettings();
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings, allowJoinAtAnyTime: false, useWaitingRoom: true});

            const ownerJoinRoom = async () => {

                const waitingListHandler = async (msg) => {
                    bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
                    const waitingList = msg as WaitingListEvent;
                    expect(waitingList.users.length).toBeGreaterThan(0);
                    await bobRoom.authorizeWaitingList(waitingList.users[0].userId, true);
                    done();
                }

                const bobRoom = await bob.roomAvailable({
                    id: bob.user().pmi,
                    pin: bobPmiSettings.pmiSettings.accessCode
                });
                expect(bobRoom).toBeTruthy();

                bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);

                await bobRoom.join(new wrtc.RTCPeerConnection());
            }

            const aliceRoom = await alice.roomAvailable({
                id: bob.user().pmi,
                pin: bobPmiSettings.pmiSettings.accessCode
            });
            expect(aliceRoom).toBeTruthy();

            aliceRoom.on(RoomEvent.PLACED_IN_LOBBY, async (msg) => {
                const holdEvent = msg as PlacedInLobbyEvent;
                expect(holdEvent).toBeTruthy();
                await ownerJoinRoom();
            })

            await aliceRoom.join(new wrtc.RTCPeerConnection());
            await bob.updateUserPmiSettings({...bobPmiSettings.pmiSettings});
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
    it("Should receive control message", async (done) => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        await bobRoom.join(bobPc);
        await bobRoom.configureWaitingRoom(false);
        bobRoom.on(RoomEvent.JOINED, (msg) => {
            const status = msg as JoinedRoom;
            bobRoom.sendControlMessage(TEST_MESSAGE_ROOM, false, status.userId);
        });

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        aliceRoom.on(RoomEvent.CONTROL_MESSAGE, async (msg) => {
            const event = msg as ControlMessageEvent;
            expect(event.message).toBeTruthy();
            expect(event.message.body).toEqual(TEST_MESSAGE_ROOM);
            done();
        })
        await aliceRoom.join(alicePc);
    });
    it("Should kick participant from room", async (done) => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        bobRoom
            .on(RoomEvent.JOINED, async (msg) => {
                const state = msg as JoinedRoom;
                await bobRoom.evictParticipant(state.userId);
            })
            .on(RoomEvent.EVICTED, async (msg) => {
                const state = msg as EvictedFromRoom;
                expect(state.userId).toBeTruthy();
                done();
            })
        await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        await bobRoom.configureWaitingRoom(false);
        const aliceRoom = await alice.roomAvailable({
            ...TEST_ROOM,
            id: bobRoom.id()
        });
        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);

    });
    it("Should rename second participant", async (done) => {
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

        bobRoom
            .on(RoomEvent.JOINED, async (msg) => {
                const state = msg as JoinedRoom;
                await bobRoom.renameParticipant(state.userId, updatedNickname);
                await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === updatedNickname, (room) => room.nickname())
                expect(aliceRoom.nickname()).toEqual(updatedNickname);
                await bobRoom.destroyRoom();
                done();
            });

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);
    });
    it("Should change second participant nickname to already taken", async (done) => {
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

        bobRoom
            .on(RoomEvent.JOINED, async (msg) => {
                const state = msg as JoinedRoom;
                await bobRoom.renameParticipant(state.userId, alreadyTakenNickname);
                await waitForRoomEvent(RoomEvent.PARTICIPANT_RENAMED, aliceRoom, (room) => room.nickname() === alreadyTakenNickname, (room) => room.nickname())
                expect(aliceRoom.nickname()).toEqual(alreadyTakenNickname);
                await bobRoom.destroyRoom();
                done();
            });

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);
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
