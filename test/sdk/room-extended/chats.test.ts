import {TEST_ROOM, TEST_USER_1} from "../../util/constants";
import {RoomEvent, SfuEvent, SfuExtended} from "../../../src";
import {
    ChatReceivePolicy,
    InternalMessage,
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
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
    })
    afterEach(async() => {
        await bob.disconnect();
        await alice.disconnect();
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
        const bobPc = new wrtc.RTCPeerConnection();
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
    it("Should remove participant from chat on exit from room", async () => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });
        const joinedEvent = await bobRoom.join(bobPc);
        await waitForPeerConnectionStableState(bobPc);

        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();

        await bobRoom.configureWaitingRoom(false);


        const waitUpdateChatEventAfterJoin = async (): Promise<void> => {
            return new Promise<void>((resolve) => {
                const handler = (msg) => {
                    bob.off(SfuEvent.CHAT_UPDATED, handler);
                    const chat = msg as UserSpecificChatInfo;
                    expect(chat.members.length).toBe(2);
                    aliceRoom.leaveRoom();
                    resolve();
                }
                bob.on(SfuEvent.CHAT_UPDATED, handler);
            });
        }

        const waitUpdatedEventAfterLeave = async (): Promise<void> => {
            return new Promise<void>((resolve) => {
                const handler = async (msg) => {
                    const chat = msg as UserSpecificChatInfo;
                    expect(chat.members.length).toBe(1);
                    const room = bob.getRoom({id: chat.id});
                    await room.destroyRoom();
                    resolve();
                }
                bob.on(SfuEvent.CHAT_UPDATED, handler);
            })
        }

        const aliceRoom = await alice.roomAvailable({
            id: bobRoom.id(),
            pin: TEST_ROOM.pin
        });
        aliceRoom.join(alicePc);

        await waitUpdateChatEventAfterJoin();
        await waitUpdatedEventAfterLeave();
    });
    it("Should remove participant from chat on moving to waiting room", async (done) => {
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
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
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
        bob
            .on(SfuEvent.MESSAGE, async (msg) => {
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
            .on(SfuEvent.CHAT_UPDATED, async (msg) => {
                const chat = msg as UserSpecificChatInfo;
                expect(chat.members.length).toEqual(2);
                await bob.sendMessage({body: "Test from Bob", chatId: roomChatId})
            })

        const bobRoom = await bob.createRoom({
            ...TEST_ROOM
        });

        const joinedEvent = await bobRoom.join(bobPc);
        const roomChatId = joinedEvent.chatId;
        expect(roomChatId).toBeTruthy();

        await bobRoom.configureWaitingRoom(false);

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
        const bobPc = new wrtc.RTCPeerConnection();
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
        const bobPc = new wrtc.RTCPeerConnection();
        const alicePc = new wrtc.RTCPeerConnection();
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