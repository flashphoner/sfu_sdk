import {TEST_ROOM, TEST_USER_1} from "../../util/constants";
import {RoomEvent, SfuEvent, SfuExtended} from "../../../src";
import {
    ChatReceivePolicy,
    InternalMessage,
    LeftRoom,
    Message,
    UserSpecificChatInfo,
    WaitingListEvent
} from "../../../src/sdk/constants";
import {waitForPeerConnectionStableState} from "../../util/pcUtils";
import {waitForUsers} from "../../util/utils";

const wrtc = require("wrtc");

describe("chats", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    let bobPc: RTCPeerConnection;
    let alicePc: RTCPeerConnection;
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
        bobPc = new wrtc.RTCPeerConnection();
        alicePc = new wrtc.RTCPeerConnection();
    })
    afterEach(async() => {
        await bob.disconnect();
        await alice.disconnect();
        bobPc = null;
        alicePc = null;
    })
    it("Should create chat on creating meeting", async (done) => {
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
            done();
        })
        await bob.createRoom({
            ...TEST_ROOM
        });
    });
    it("Should remove chat on ending meeting", async (done) => {
        const bobRoom = await bob.createRoom({
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
                expect(chat.id).toEqual(bobRoom.id());
                done();
            })

        await bobRoom.join(bobPc);
        await bobRoom.leaveRoom();
    })
    it("Should remove participant from chat on exit from room", async (done) => {
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        const joinedEvent = await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);

        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();

        await bobRoom.configureWaitingRoom(false);

        const onJoinHandler = async (msg) => {
            bobRoom.off(RoomEvent.JOINED, onJoinHandler);
            const chats = await bob.getUserChats();
            const meetingChat = chats[roomChatId];
            expect(meetingChat.members.length).toBe(2);
            await aliceRoom.leaveRoom();
        }

        const onLeftHandler = async (participant: LeftRoom) => {
            if (participant.name === TEST_USER_1.nickname) {
                bobRoom.off(RoomEvent.LEFT, onLeftHandler);
                const chats = await bob.getUserChats();
                const meetingChat = chats[roomChatId];
                expect(meetingChat.members.length).toBe(1);
                const room = bob.getRoom({id: meetingChat.id});
                await room.destroyRoom();
                done();
            }
        }

        bobRoom
            .on(RoomEvent.JOINED, onJoinHandler)
            .on(RoomEvent.LEFT, onLeftHandler);

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);
    });
    it("Should remove participant from chat on moving to waiting room", async (done) => {
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        const joinedEvent = await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);

        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();
        await bobRoom.configureWaitingRoom(true);

        const waitingListHandler = async (msg: InternalMessage) => {
            bobRoom.off(RoomEvent.WAITING_LIST, waitingListHandler);
            const list = msg as WaitingListEvent;
            expect(list.users).toBeTruthy();
            expect(list.users.length).toEqual(1);
            await bobRoom.authorizeWaitingList(list.users[0].id, true);
        }
        bobRoom.on(RoomEvent.WAITING_LIST, waitingListHandler);

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        alice
            .on(SfuEvent.NEW_CHAT, async (msg) => {
                const newChat = msg as UserSpecificChatInfo;
                expect(newChat.members.length).toBe(2);
                await bobRoom.moveToWaitingRoom(TEST_USER_1.nickname);
            })
            .on(SfuEvent.CHAT_DELETED, async (msg) => {
                expect(msg).toBeTruthy();
                const room = bob.getRoom({id: bobRoom.id()});
                await room.destroyRoom();
                done();
            })

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);
    })
    it("Should send message to second participant", async (done) => {
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
            done();
        })

        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        const joinedEvent = await bobRoom.join(bobPc);
        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();

        await bobRoom.configureWaitingRoom(false);
        bobRoom.on(RoomEvent.JOINED, async (msg) => {
            await bob.sendMessage({body: "Test from Bob", chatId: roomChatId})
        })

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        alice.on(SfuEvent.MESSAGE, async (msg) => {
            const message = msg as Message;
            expect(message).toBeTruthy();
            await alice.sendMessage({body: "Test from Alice", chatId: roomChatId})
        })

        await aliceRoom.join(alicePc);
    })
    it("Owner should update chat receive policy", async () => {
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        const joinedEvent = await bobRoom.join(bobPc);
        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();
        await bobRoom.configureWaitingRoom(false);

        const chatInfo = await bob.updateChatReceivePolicy({id: roomChatId, chatReceivePolicy: ChatReceivePolicy.OWNER_ONLY});
        expect(chatInfo.chatReceivePolicy).toEqual(ChatReceivePolicy.OWNER_ONLY);
        await bobRoom.destroyRoom();
    })
    it("Should fail to send message if chat receive policy is NOBODY", async (done) => {
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        const joinedEvent = await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);
        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();
        await bobRoom.configureWaitingRoom(false);

        await bob.updateChatReceivePolicy({id: roomChatId, chatReceivePolicy: ChatReceivePolicy.NOBODY});

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        alice.on(SfuEvent.NEW_CHAT, async (msg) => {
            await expect(alice.sendMessage({chatId: roomChatId, body: "Test from Alice"})).rejects.toBeTruthy();
            await bobRoom.destroyRoom();
            done();
        })

        await aliceRoom.join(alicePc);
        await waitForPeerConnectionStableState(alicePc);
    })
})