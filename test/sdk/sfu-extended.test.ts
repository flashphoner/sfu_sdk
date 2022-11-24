import {SfuExtended} from "../../src/sdk/sfu-extended";
import {
    ATTACHMENT_CHUNK_SIZE,
    AttachmentState, AttachmentStatus,
    ChannelSendPolicy,
    ChannelType, ChatError, ContactError,
    Invite,
    Message,
    MessageState,
    MessageStatus, MessageStatusBulkEvent, RoomError,
    SfuEvent, State,
    User,
    UserSpecificChatInfo
} from "../../src/sdk/constants";
import {
    ATTACHMENTS_PAYLOAD,
    CALENDAR_EVENT,
    DOWNLOAD_PATH, TEST_PDF_ATTACHMENT, TEST_PDF_ATTACHMENT_DATA,
    TEST_EMAIL_INVITE,
    TEST_PICTURE_ATTACHMENT, TEST_PICTURE_ATTACHMENT_DATA,
    TEST_PRIVATE_CHANNEL, TEST_PRIVATE_CHANNEL_WITH_LIST,
    TEST_PUBLIC_CHANNEL,
    TEST_USER_0,
    TEST_USER_1,
    url, ATTACHMENTS, UPDATED_PMI_SETTINGS
} from "../util/constants";

import * as fsUtils from "../util/fsUtils";


async function connect(userConfig: {
    username: string,
    password: string,
    nickname: string
}) {
    const sfu = new SfuExtended();
    await sfu.connect({
        url: url,
        ...userConfig
    });
    return sfu;
}

beforeAll(async () => {
    await fsUtils.deleteDir(fsUtils.getFilePath(__dirname, DOWNLOAD_PATH));
})

describe("sfu-extended", () => {
    it("should connect", (done) => {
       const sfu = new SfuExtended();
       sfu.on(SfuEvent.CONNECTED, () => {
           const user = sfu.user();
           expect(user).toBeTruthy();
           expect(user.username).toEqual(TEST_USER_0.username);
           expect(user.nickname).toEqual(TEST_USER_0.nickname);
           expect(user.pmi).toBeTruthy();
           sfu.disconnect();
           done();
       });
       sfu.connect({
           url: url,
           ...TEST_USER_0
       });
    });
    it("should disconnect", (done) => {
        const sfu = new SfuExtended();
        sfu.on(SfuEvent.CONNECTED, () => {
            sfu.disconnect();
        }).on(SfuEvent.DISCONNECTED, () => {
            done();
        });
        sfu.connect({
            url: url,
            ...TEST_USER_0
        });
    });
    it("should reconnect after disconnect", async () => {
        const sfu = new SfuExtended();
        await sfu.connect({
            url: url,
            ...TEST_USER_0
        });
        await sfu.disconnect();
        expect(sfu.state()).toEqual(State.DISCONNECTED);
        const user = await sfu.connect({
            url: url,
            ...TEST_USER_0
        });
        expect(user).toBeTruthy();
        expect(user.username).toEqual(TEST_USER_0.username);
        expect(user.nickname).toEqual(TEST_USER_0.nickname);
        expect(user.pmi).toBeTruthy();
        await sfu.disconnect();
    });

    describe("user", () => {
        it("should load user PMI settings", async () => {
            const sfu = await connect(TEST_USER_0);
            const pmiSettings = await sfu.getUserPmiSettings();
            expect(pmiSettings).toBeTruthy();
            sfu.disconnect();
        })
        it("should update user PMI settings", async () => {
            const sfu = await connect(TEST_USER_0);
            const pmiSettings = await sfu.getUserPmiSettings();
            expect(pmiSettings).toBeTruthy();
            await sfu.updateUserPmiSettings(UPDATED_PMI_SETTINGS);
            const updatedSettings = await sfu.getUserPmiSettings();
            expect(updatedSettings.pmiSettings.accessCode).toBe(UPDATED_PMI_SETTINGS.accessCode);
            sfu.disconnect();
        })
    });

    describe("contacts", () => {
        it("should load contacts", async () => {
            const sfu = await connect(TEST_USER_0);
            const list = await sfu.getUserList();
            expect(list.length).toBeGreaterThan(0);
            const user = list[0];
            expect(user.id).toBeTruthy();
            sfu.disconnect();
        });
        it("should invite contact", async () => {
            const sfu = await connect(TEST_USER_0);
            const list = await sfu.getUserList();
            const user = list.find((user) => user.id === TEST_USER_1.username);
            const invitedUser = await sfu.inviteContact({to: user.id});
            expect(invitedUser.invite).toBeTruthy();
            expect(invitedUser.invite.id).toBeTruthy();
            expect(invitedUser.invite.from).toEqual(TEST_USER_0.username);
            expect(invitedUser.invite.to).toEqual(user.id);
            await sfu.removeContact({id: user.id});
            sfu.disconnect();
        });
        it("should fail on user self-invitation", async () => {
            const sfu = await connect(TEST_USER_0);
            await expect(sfu.inviteContact({to: TEST_USER_0.username})).rejects.toHaveProperty("error", ContactError.USER_CAN_NOT_SEND_INVITE_TO_HIMSELF);
            sfu.disconnect();
        });
        it("should remove contact", async () => {
            const sfu = await connect(TEST_USER_0);
            const list = await sfu.getUserList();
            const user = list.find(user => user.id === TEST_USER_1.username);
            const invitedUser = await sfu.inviteContact({to: user.id});
            expect(invitedUser.id).toEqual(user.id);
            expect(invitedUser.invite).toBeTruthy();
            const removedUser = await sfu.removeContact({id: user.id});
            expect(removedUser.id).toEqual(user.id);
            expect(removedUser.invite).toBeFalsy();
            const freshList = await sfu.getUserList();
            const freshUser = list.find(user => user.id === TEST_USER_1.username);
            expect(freshUser.id).toEqual(user.id);
            expect(freshUser.invite).toBeFalsy();
            sfu.disconnect();
        });
        it("should invite non existent contact", async () => {
            const sfu = await connect(TEST_USER_0);
            const list = await sfu.getUserList();
            const user = list[0];
            const invitedUser = await sfu.inviteContact({to: TEST_EMAIL_INVITE});
            expect(invitedUser.email).toEqual(TEST_EMAIL_INVITE);
            expect(invitedUser.invite).toBeTruthy();
            expect(invitedUser.invite.id).toBeTruthy();
            expect(invitedUser.invite.from).toEqual(TEST_USER_0.username);
            expect(invitedUser.invite.to).toEqual(TEST_EMAIL_INVITE);
            await sfu.removeContact({id: TEST_EMAIL_INVITE});
            sfu.disconnect();
        });
        describe("notifications", () => {
            test("invited contact should receive invite", async (done) => {
                const sfu0 = await connect(TEST_USER_0);
                const sfu1 = await connect(TEST_USER_1);
                sfu1.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                    const invite = msg as Invite;
                    await sfu0.removeContact({id: TEST_USER_1.username});
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                });
                await sfu0.inviteContact({to: TEST_USER_1.username});
            });
            test("invited contact should confirm invite", async (done) => {
                const sfu0 = await connect(TEST_USER_0);
                const sfu1 = await connect(TEST_USER_1);
                sfu1.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                    const invite = msg as Invite;
                    sfu1.confirmContact(invite);
                });
                sfu0.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                    const user = msg as User;
                    expect(user.confirmed).toEqual(true);
                    expect(user.id).toEqual(TEST_USER_1.username);
                    await sfu0.removeContact(user);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                })
                await sfu0.inviteContact({to: TEST_USER_1.username});
            });
            test("should be able to add contact to favourites", async (done) => {
                const sfu0 = await connect(TEST_USER_0);
                const sfu1 = await connect(TEST_USER_1);
                sfu1.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                    const invite = msg as Invite;
                    await sfu1.confirmContact(invite);
                });
                sfu0.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                    const user = msg as User;
                    const userState = await sfu0.addContactToFavourites(user);
                    expect(userState).toBeTruthy();
                    expect(userState.favourite).toBeTruthy();
                    await sfu0.removeContact(user);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                })
                await sfu0.inviteContact({to: TEST_USER_1.username});
            });
            test("should be able to remove contact from favourites", async (done) => {
                const sfu0 = await connect(TEST_USER_0);
                const sfu1 = await connect(TEST_USER_1);
                sfu1.on(SfuEvent.CONTACT_INVITE, async (msg) => {
                    const invite = msg as Invite;
                    await sfu1.confirmContact(invite);
                });
                sfu0.on(SfuEvent.CONTACT_UPDATE, async (msg) => {
                    const user = msg as User;
                    let userState = await sfu0.addContactToFavourites(user);
                    expect(userState).toBeTruthy();
                    expect(userState.favourite).toBeTruthy();
                    userState = await sfu0.removeContactFromFavourites(user);
                    expect(userState).toBeTruthy();
                    expect(userState.favourite).toBeFalsy();
                    await sfu0.removeContact(user);
                    sfu0.disconnect();
                    sfu1.disconnect();
                    done();
                })
                await sfu0.inviteContact({to: TEST_USER_1.username});
            });
        });
    });

    //TODO(naz): add/remove should return object, add should return id that was created at server side
    describe("calendar", () => {
        it("should load calendar", async () => {
            const sfu = await connect(TEST_USER_0);
            const calendar = await sfu.getUserCalendar();
            expect(calendar).toBeTruthy();
            expect(calendar.events).toBeTruthy();
            sfu.disconnect();
        });
        it("should add event", async () => {
            const sfu = await connect(TEST_USER_0);
            const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
            const calendar = await sfu.getUserCalendar();
            expect(calendar.events).toHaveProperty(calendarEvent.id);
            await sfu.removeCalendarEvent(calendarEvent);
            sfu.disconnect();
        });
        it("should update event", async () => {
            const sfu = await connect(TEST_USER_0);
            let calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
            expect(calendarEvent.usePMI).toBe(true);
            calendarEvent.usePMI = false;
            calendarEvent = await sfu.updateCalendarEvent(calendarEvent);
            expect(calendarEvent.usePMI).toBe(false);
            await sfu.removeCalendarEvent(calendarEvent);
            sfu.disconnect();
        });
        it("should remove event", async () => {
            const sfu = await connect(TEST_USER_0);
            const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
            let calendar = await sfu.getUserCalendar();
            expect(calendar.events).toHaveProperty(calendarEvent.id);
            await sfu.removeCalendarEvent(calendarEvent);
            calendar = await sfu.getUserCalendar();
            expect(calendar.events[calendarEvent.id]).toBeFalsy();
            sfu.disconnect();
        });
        it("should create room based on event", async () => {
            const sfu = await connect(TEST_USER_0);
            const calendarEvent = await sfu.addCalendarEvent(CALENDAR_EVENT);
            const room = await sfu.createRoomFromEvent(calendarEvent);
            expect(room).toBeTruthy();
            expect(room.id()).toBe(sfu.user().pmi);
            await room.destroyRoom();
            await sfu.removeCalendarEvent(calendarEvent);
            sfu.disconnect();
        });
    });

    describe("chat", () => {
        describe("chats", () => {
            it("should load chats", async () => {
                const sfu = await connect(TEST_USER_0);
                const chats = await sfu.getUserChats();
                expect(chats).toBeTruthy();
                sfu.disconnect();
            });
            it("should create chat", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                expect(chat).toBeTruthy();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should have canSend set to true #zapp-125", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                expect(chat).toBeTruthy();
                expect(chat.canSend).toBe(true);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            test("newly created chat without name should have it generated by server", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({
                    members: [
                        TEST_USER_0.username,
                        TEST_USER_1.username
                    ]
                });
                const expectedName = TEST_USER_0.nickname + ", " + TEST_USER_1.nickname;
                expect(chat.name).toEqual(expectedName);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should delete chat", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                expect(chat).toBeTruthy();
                let chats = await sfu.getUserChats();
                expect(chats).toHaveProperty(chat.id);
                await sfu.deleteChat(chat);
                chats = await sfu.getUserChats();
                expect(chats[chat.id]).toBeFalsy();
                sfu.disconnect();
            });
            it("should add member", async () => {
                const sfu = await connect(TEST_USER_0);
                let chat = await sfu.createChat({});
                chat = await sfu.addMemberToChat({id: chat.id, member: TEST_USER_1.username});
                expect(chat.members).toContain(TEST_USER_1.username);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            test("adding new member should change chat's name", async () => {
                const sfu = await connect(TEST_USER_0);
                let chat = await sfu.createChat({});
                chat = await sfu.addMemberToChat({id: chat.id, member: TEST_USER_1.username});
                const expectedName = TEST_USER_0.nickname + ", " + TEST_USER_1.nickname;
                expect(chat.name).toEqual(expectedName);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should remove member", async () => {
                const sfu = await connect(TEST_USER_0);
                let chat = await sfu.createChat({});
                chat = await sfu.addMemberToChat({id: chat.id, member: TEST_USER_1.username});
                expect(chat.members).toContain(TEST_USER_1.username);
                chat = await sfu.removeMemberFromChat({id: chat.id, member: TEST_USER_1.username});
                const member = chat.members.find((member) => {member === TEST_USER_1.username});
                expect(member).toBeUndefined();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send message", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message"
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBeTruthy();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should reply to sent message", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message"
                });
                const replyStatus = await sfu.sendMessage({
                    parentId: status.id,
                    chatId: chat.id,
                    body: "test message reply"
                });
                const allMessages = await sfu.loadChatMessages({
                    chatId: chat.id,
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                const reply = allMessages.find((m) => m.id === replyStatus.id);
                expect(reply).toBeTruthy();
                if (reply) {
                    expect(reply.parentId).toEqual(status.id);
                }
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should reject sending message without body and attachment", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                await expect(sfu.sendMessage({
                    chatId: chat.id,
                })).rejects.toBeTruthy();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should perform partial messages loading", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                //populate with 3 messages 1 second apart
                for (let i = 0; i < 3; i++) {
                    await sfu.sendMessage({
                        chatId: chat.id,
                        body: "test message"
                    });
                    await new Promise(r => setTimeout(r, 1050));
                }
                const allMessages = await sfu.loadChatMessages({
                    chatId: chat.id,
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                expect(allMessages.length).toEqual(3);
                allMessages.sort((a, b) => a.date - b.date);

                const firstTwo = await sfu.loadChatMessages({
                    chatId: chat.id,
                    timeFrame:  {
                        start: 0,
                        end: allMessages[1].date
                    }
                })
                expect(firstTwo.length).toEqual(2);
                firstTwo.sort((a, b) => a.date - b.date);
                expect(firstTwo[0].id).toEqual(allMessages[0].id);
                expect(firstTwo[1].id).toEqual(allMessages[1].id);

                const lastTwo = await sfu.loadChatMessages({
                    chatId: chat.id,
                    timeFrame:  {
                        start: allMessages[1].date,
                        end: -1
                    }
                })
                lastTwo.sort((a, b) => a.date - b.date);
                expect(lastTwo[0].id).toEqual(allMessages[1].id);
                expect(lastTwo[1].id).toEqual(allMessages[2].id);

                const onlyTwo = await sfu.loadChatMessages({
                    chatId: chat.id,
                    limit: 2,
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                })
                expect(onlyTwo.length).toEqual(2);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should perform chat search", async () => {
                const searchString = "I'm a needle";
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                await sfu.sendMessage({
                    chatId: chat.id,
                    body: "first message"
                });
                for (let i = 0; i < 3; i++) {
                    await sfu.sendMessage({
                        chatId: chat.id,
                        body: searchString + " " + i
                    });
                }
                await sfu.sendMessage({
                    chatId: chat.id,
                    body: "last message"
                });
                const searchResults = await sfu.searchChatMessages({
                    chatId: chat.id,
                    searchString: searchString
                });
                expect(searchResults.length).toEqual(3);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send message with attachment", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    attachments: [
                        TEST_PICTURE_ATTACHMENT
                    ]
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const attachmentsData = [];
                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PICTURE_ATTACHMENT_DATA.payload,
                })
                const handler = sfu.getSendingAttachmentsHandler(attachmentsData, status.id);
                await handler.sendAttachments();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should reject sending message if user is not chat member", async () => {
                const sfu = await connect(TEST_USER_0);
                const sfu1 = await connect(TEST_USER_1);
                const chat = await sfu.createChat({});
                await expect(sfu1.sendMessage({
                    chatId: chat.id,
                    body: "test message"
                })).rejects.toHaveProperty("error", ChatError.USER_MUST_BE_A_CHAT_MEMBER_TO_SEND_MESSAGES);
                await sfu.deleteChat(chat);
                sfu.disconnect();
                sfu1.disconnect();
            });
            it("should send message with attachment and without body", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    attachments: [
                        TEST_PICTURE_ATTACHMENT
                    ]
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const attachmentsData = [];
                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PICTURE_ATTACHMENT_DATA.payload,
                })
                const handler = await sfu.getSendingAttachmentsHandler(attachmentsData, status.id);
                await handler.sendAttachments();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send message with attachment and should cancel attachment uploading", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    attachments: [
                        TEST_PICTURE_ATTACHMENT
                    ]
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const attachmentsData = [];
                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PICTURE_ATTACHMENT_DATA.payload,
                })
                const handler = sfu.getSendingAttachmentsHandler(attachmentsData, status.id);
                handler.sendAttachments();
                handler.cancelUploadAttachment(status.attachments[0]);
                const result = await handler.waitAndGetMessageStatus();
                expect(result.state).toEqual(MessageState.DELIVERY_CANCELLED);
                expect(result.attachments).toHaveLength(0);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should reject cancellation sending attachment after uploading", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    attachments: [
                        TEST_PICTURE_ATTACHMENT
                    ]
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const attachmentsData = [];
                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PICTURE_ATTACHMENT_DATA.payload,
                })
                const handler = sfu.getSendingAttachmentsHandler(attachmentsData, status.id);
                await handler.sendAttachments();
                await expect(handler.cancelUploadAttachment(status.attachments[0])).rejects.toEqual(new Error(ChatError.CAN_NOT_CANCEL_UPLOADED_ATTACHMENT));
                const result = await handler.waitAndGetMessageStatus();
                expect(result.state).toEqual(MessageState.NO_DELIVERY_NO_READ);
                expect(result.attachments).toHaveLength(1);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send message with multiple attachments", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    attachments: ATTACHMENTS
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const handler = sfu.getSendingAttachmentsHandler(ATTACHMENTS_PAYLOAD, status.id);
                await handler.sendAttachments();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it('should send message with multiple attachments and should cancel attachments uploading', async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    attachments: ATTACHMENTS
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                const handler = sfu.getSendingAttachmentsHandler(ATTACHMENTS_PAYLOAD, status.id);
                handler.sendAttachments();
                handler.cancelUploadAttachment(status.attachments[0]);
                handler.cancelUploadAttachment(status.attachments[1]);
                const result = await handler.waitAndGetMessageStatus();
                expect(result.state).toEqual(MessageState.DELIVERY_CANCELLED);
                expect(result.attachments).toHaveLength(0);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send a few messages with attachment", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});

                for (let i = 0; i < 10; i++) {
                    const status = await sfu.sendMessage({
                        chatId: chat.id,
                        body: "test message",
                        attachments: [
                            TEST_PDF_ATTACHMENT
                        ]
                    });
                    expect(status).toBeTruthy();
                    expect(status.id).toBeTruthy();
                    expect(status.date).toBeTruthy();
                    expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                    expect(status.attachments).toBeTruthy();

                    const attachmentsData = [];
                    attachmentsData.push({
                        id: status.attachments[0].id,
                        payload: TEST_PDF_ATTACHMENT_DATA.payload
                    })
                    const handler = await sfu.getSendingAttachmentsHandler(attachmentsData, status.id);
                    const result = await handler.sendAttachments();
                    expect(result).toBeTruthy();
                    expect(result.delivered).toBe(true);
                }
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });

            it("should send and receive message attachment", async (done) => {
                fsUtils.makeDir(fsUtils.getFilePath(__dirname, DOWNLOAD_PATH));
                const attachmentsData = [];
                const pendingAttachments = {};

                const bob = await connect(TEST_USER_0);
                const alice = await connect(TEST_USER_1);

                const chat = await bob.createChat({
                    members: [
                        TEST_USER_0.username,
                        TEST_USER_1.username
                    ]
                });

                const onMessageHandler = async (msg) => {
                    expect(msg.attachments).toBeTruthy();
                    const attachmentRequest = {
                        messageId: msg.id,
                        attachmentId: msg.attachments[0].id,
                        chatId: msg.chatId,
                        name: msg.attachments[0].name,
                    }
                    pendingAttachments[msg.attachments[0].id] = attachmentRequest;
                    const attachment = await alice.getMessageAttachment(attachmentRequest);
                    expect(attachment).toBeTruthy();

                    const path = fsUtils.getFilePath(__dirname, DOWNLOAD_PATH + attachment.name);
                    fsUtils.writeFile(path, new Uint8Array(attachment.payload), {flag: 'a+'});

                    alice.off(SfuEvent.MESSAGE, onMessageHandler);
                    await bob.deleteChat(chat);
                    bob.disconnect();
                    alice.disconnect();
                    done();
                }

                alice.on(SfuEvent.MESSAGE, onMessageHandler);

                const status = await bob.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    attachments: [
                        TEST_PDF_ATTACHMENT
                    ]
                });

                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PDF_ATTACHMENT_DATA.payload
                })
                const handler = bob.getSendingAttachmentsHandler(attachmentsData, status.id);
                await handler.sendAttachments();

            })
            it("should send and receive message attachment with handling notifications", async (done) => {
                fsUtils.makeDir(fsUtils.getFilePath(__dirname, DOWNLOAD_PATH));
                const attachmentsData = [];
                const pendingAttachments = {};
                const chunks = Math.ceil(TEST_PDF_ATTACHMENT.size/ATTACHMENT_CHUNK_SIZE);
                const uploadedChunks = [];
                const downloadedChunkSize = [];

                const bob = await connect(TEST_USER_0);
                const alice = await connect(TEST_USER_1);

                const chat = await bob.createChat({
                    members: [
                        TEST_USER_0.username,
                        TEST_USER_1.username
                    ]
                });

                const downloadingAttachmentStateHandler = async (msg) => {
                    const status = msg as AttachmentStatus;
                    expect(status.downloadedSize);
                    downloadedChunkSize.push(status.downloadedSize);
                    if (status.downloadedSize !== TEST_PDF_ATTACHMENT.size) {
                        expect(status.state).toEqual(AttachmentState.PENDING);
                    } else {
                        expect(status.state).toEqual(AttachmentState.DOWNLOADED);
                        alice.off(SfuEvent.MESSAGE_ATTACHMENT_STATE, downloadingAttachmentStateHandler);
                    }
                }

                const onMessageHandler = async (msg) => {
                    expect(msg.attachments).toBeTruthy();
                    const attachmentRequest = {
                        messageId: msg.id,
                        attachmentId: msg.attachments[0].id,
                        chatId: msg.chatId,
                        name: msg.attachments[0].name,
                    }
                    pendingAttachments[msg.attachments[0].id] = attachmentRequest;
                    alice.on(SfuEvent.MESSAGE_ATTACHMENT_STATE, downloadingAttachmentStateHandler);
                    const attachment = await alice.getMessageAttachment(attachmentRequest);
                    expect(attachment).toBeTruthy();

                    expect(downloadedChunkSize.length).toBe(chunks);

                    const path = fsUtils.getFilePath(__dirname, DOWNLOAD_PATH + attachment.name);
                    fsUtils.writeFile(path, new Uint8Array(attachment.payload), {flag: 'a+'});

                    alice.off(SfuEvent.MESSAGE, onMessageHandler);
                    await bob.deleteChat(chat);
                    bob.disconnect();
                    alice.disconnect();
                    done();
                }

                alice.on(SfuEvent.MESSAGE, onMessageHandler);

                const status = await bob.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    attachments: [
                        TEST_PDF_ATTACHMENT
                    ]
                });

                expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                expect(status.attachments).toBeTruthy();

                attachmentsData.push({
                    id: status.attachments[0].id,
                    payload: TEST_PDF_ATTACHMENT_DATA.payload
                });

                const sendingAttachmentStateHandler = async (msg) => {
                    const status = msg as AttachmentStatus;
                    expect(status.uploadedSize);
                    uploadedChunks.push(status.uploadedSize);
                    if (status.uploadedSize !== TEST_PDF_ATTACHMENT.size) {
                        expect(status.state).toEqual(AttachmentState.PENDING);
                    } else {
                        expect(status.state).toEqual(AttachmentState.UPLOADED);
                        bob.off(SfuEvent.MESSAGE_ATTACHMENT_STATE, sendingAttachmentStateHandler);
                    }
                }

                bob.on(SfuEvent.MESSAGE_ATTACHMENT_STATE, sendingAttachmentStateHandler);
                const handler = bob.getSendingAttachmentsHandler(attachmentsData, status.id);
                await handler.sendAttachments();
                expect(uploadedChunks.length).toBe(chunks);
            });

            it("should mark message as read", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message"
                });
                await sfu.markMessageRead(status);
                const chats = await sfu.getUserChats();
                const updatedChat = chats[chat.id];
                expect(updatedChat.lastReadMessageId).toEqual(status.id);
                expect(updatedChat.lastReadMessageDate).toEqual(status.date);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should mark message as unread", async () => {
                const sfu = await connect(TEST_USER_0);
                const chat = await sfu.createChat({});
                const status = await sfu.sendMessage({
                    chatId: chat.id,
                    body: "test message"
                });
                await sfu.markMessageUnread(status);
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            //TODO(naz): sfu.renameChat should return UserSpecificChatInfo with the new name
            it("should rename chat", async () => {
                const sfu = await connect(TEST_USER_0);
                const chatOriginal = await sfu.createChat({});
                const name = "chat_name";
                await sfu.renameChat({id: chatOriginal.id, name: name});
                const chats = await sfu.getUserChats();
                const chatRenamed = chats[chatOriginal.id];
                expect(chatRenamed.name).toEqual(name);
                await sfu.deleteChat(chatRenamed);
                sfu.disconnect();
            });
            test("chat's name should remain stable after rename was done", async () => {
                const sfu = await connect(TEST_USER_0);
                const chatOriginal = await sfu.createChat({});
                const name = "chat_name";
                await sfu.renameChat({id: chatOriginal.id, name: name});
                await sfu.addMemberToChat({id: chatOriginal.id, member: TEST_USER_1.username});
                const chats = await sfu.getUserChats();
                const chatRenamed = chats[chatOriginal.id];
                expect(chatRenamed.name).toEqual(name);
                await sfu.deleteChat(chatRenamed);
                sfu.disconnect();
            });
            it("should add chat to favourites", async () => {
                const sfu = await connect(TEST_USER_0);
                let chat = await sfu.createChat({});
                chat = await sfu.addChatToFavourites(chat);
                expect(chat.favourite).toBeTruthy();
                const chats = await sfu.getUserChats();
                chat = chats[chat.id];
                expect(chat.favourite).toBeTruthy();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should remove chat from favourites", async () => {
                const sfu = await connect(TEST_USER_0);
                let chat = await sfu.createChat({});
                chat = await sfu.addChatToFavourites(chat);
                expect(chat.favourite).toBeTruthy();
                chat = await sfu.removeChatFromFavourites(chat);
                expect(chat.favourite).toBeFalsy();
                const chats = await sfu.getUserChats();
                chat = chats[chat.id];
                expect(chat.favourite).toBeFalsy();
                await sfu.deleteChat(chat);
                sfu.disconnect();
            });
            it("should send private message", async (done) => {
                const bob = await connect(TEST_USER_0);
                const alice = await connect(TEST_USER_1);

                const chat = await bob.createChat({
                    members: [
                        TEST_USER_0.username,
                        TEST_USER_1.username
                    ]
                });

                const onMessageHandler = async (msg) => {
                    const message = msg as Message;
                    expect(message.privateMessage).toBe(true);
                    alice.off(SfuEvent.MESSAGE, onMessageHandler);
                    await bob.deleteChat(chat);
                    bob.disconnect();
                    alice.disconnect();
                    done();
                }

                alice.on(SfuEvent.MESSAGE, onMessageHandler);

                await bob.sendMessage({
                    chatId: chat.id,
                    body: "test message",
                    to: TEST_USER_1.username
                });
            })
            describe("notifications", () => {
                test("user should be notified when added to chat", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.NEW_CHAT, async (msg) => {
                        const chat1 = msg as UserSpecificChatInfo;
                        expect(chat1.id).toEqual(chat0.id);
                        await sfu0.deleteChat(chat0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let chat0 = await sfu0.createChat({});
                    await sfu0.addMemberToChat({id: chat0.id, member: TEST_USER_1.username});
                });
                test("user should be notified when removed from chat", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_DELETED, async (msg) => {
                        const chat1 = msg as UserSpecificChatInfo;
                        expect(chat1.id).toEqual(chat0.id);
                        await sfu0.deleteChat(chat0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    }).on(SfuEvent.NEW_CHAT, async (msg) => {
                        const chat1 = msg as UserSpecificChatInfo;
                        expect(chat1.id).toEqual(chat0.id);
                        await sfu0.removeMemberFromChat({id: chat0.id, member: TEST_USER_1.username});
                    });
                    let chat0 = await sfu0.createChat({});
                    await sfu0.addMemberToChat({id: chat0.id, member: TEST_USER_1.username});
                });
                test("user should be notified when chat deleted", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_DELETED, async (msg) => {
                        const chat1 = msg as UserSpecificChatInfo;
                        expect(chat1.id).toEqual(chat0.id);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    }).on(SfuEvent.NEW_CHAT, async (msg) => {
                        const chat1 = msg as UserSpecificChatInfo;
                        expect(chat1.id).toEqual(chat0.id);
                        await sfu0.deleteChat(chat0);
                    });
                    let chat0 = await sfu0.createChat({});
                    await sfu0.addMemberToChat({id: chat0.id, member: TEST_USER_1.username});
                });
                test("should receive message", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.MESSAGE, async (msg) => {
                        const message1 = msg as Message;
                        expect(message1.body).toEqual(messageBody);
                        await sfu0.deleteChat(chat0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let chat0 = await sfu0.createChat({
                        members: [TEST_USER_1.username]
                    });
                    const messageBody = "test message";
                    await sfu0.sendMessage({
                        chatId: chat0.id,
                        body: messageBody
                    });
                });
                test("should receive message with attachment", async (done) => {
                    fsUtils.makeDir(fsUtils.getFilePath(__dirname, DOWNLOAD_PATH));

                    const attachmentsData = [];
                    const pendingAttachments = {};

                    const bob = await connect(TEST_USER_0);
                    const alice = await connect(TEST_USER_1);

                    let chat0 = await bob.createChat({
                        members: [TEST_USER_1.username]
                    });

                    const onMessageHandler = async (msg) => {
                        expect(msg.attachments).toBeTruthy();
                        const attachmentRequest = {
                            messageId: msg.id,
                            attachmentId: msg.attachments[0].id,
                            chatId: msg.chatId,
                            name: msg.attachments[0].name,
                        }
                        pendingAttachments[msg.attachments[0].id] = attachmentRequest;
                        const attachment = await alice.getMessageAttachment(attachmentRequest);
                        expect(attachment).toBeTruthy();

                        const path = fsUtils.getFilePath(__dirname, DOWNLOAD_PATH + attachment.name);
                        fsUtils.writeFile(path, new Uint8Array(attachment.payload), {flag: 'a+'});

                        alice.off(SfuEvent.MESSAGE, onMessageHandler);
                        await bob.deleteChat(chat0);
                        bob.disconnect();
                        alice.disconnect();
                        done();
                    }

                    alice.on(SfuEvent.MESSAGE, onMessageHandler);


                    const messageBody = "test message";
                    const status = await bob.sendMessage({
                        chatId: chat0.id,
                        body: messageBody,
                        attachments: [
                            TEST_PICTURE_ATTACHMENT
                        ]
                    });
                    expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                    expect(status.attachments).toBeTruthy();

                    attachmentsData.push({
                        id: status.attachments[0].id,
                        payload: TEST_PICTURE_ATTACHMENT_DATA.payload
                    })
                    const handler = await bob.getSendingAttachmentsHandler(attachmentsData, status.id);
                    await handler.sendAttachments();
                });
                test("user should be notified with message IM state", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu0.on(SfuEvent.MESSAGE_STATE_BULK, async (msg) => {
                        const state = msg as MessageStatusBulkEvent;
                        expect(state).toBeTruthy();
                        expect(state.update[0].state).toEqual(MessageState.FULL_DELIVERY_FULL_READ);
                        await sfu0.deleteChat(chat0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    sfu1.on(SfuEvent.MESSAGE, async (msg) => {
                        const message1 = msg as Message;
                        expect(message1.body).toEqual(messageBody);
                        await sfu1.markMessageRead(message1);
                    });
                    let chat0 = await sfu0.createChat({
                        members: [TEST_USER_1.username]
                    });
                    const messageBody = "test message";
                    await sfu0.sendMessage({
                        chatId: chat0.id,
                        body: messageBody
                    });
                });
            });
        });
        describe("channels", () => {
            it("should create public channel", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                expect(channel).toBeTruthy();
                expect(channel.id).toBeTruthy();
                expect(channel.channel).toBeTruthy();
                expect(channel.name).toBe(TEST_PUBLIC_CHANNEL.name);
                expect(channel.channelType).toBe(TEST_PUBLIC_CHANNEL.channelType);
                expect(channel.channelSendPolicy).toBe(TEST_PUBLIC_CHANNEL.channelSendPolicy);
                expect(channel.members).toContain(sfu.user().username);
                expect(channel.allowedToAddExternalUser).toBe(false);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should delete public channel", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                await sfu.deleteChat(channel);
                const pChannels = await sfu.getPublicChannels();
                expect(pChannels[channel.id]).toBeUndefined();
                sfu.disconnect();
            });
            it("should load public channels", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const pChannels = await  sfu.getPublicChannels();
                expect(pChannels).toHaveProperty(channel.id);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("Should load public channel user participates in into chats", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const chats = await  sfu.getUserChats();
                expect(chats).toHaveProperty(channel.id);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should create private channel", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PRIVATE_CHANNEL);
                expect(channel).toBeTruthy();
                expect(channel.id).toBeTruthy();
                expect(channel.channel).toBeTruthy();
                expect(channel.name).toBe(TEST_PRIVATE_CHANNEL.name);
                expect(channel.channelType).toBe(TEST_PRIVATE_CHANNEL.channelType);
                expect(channel.channelSendPolicy).toBe(TEST_PRIVATE_CHANNEL.channelSendPolicy);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should delete private channel", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PRIVATE_CHANNEL);
                await sfu.deleteChat(channel);
                const chats = await  sfu.getUserChats();
                expect(chats[channel.id]).toBeUndefined();
                sfu.disconnect();
            });
            it("should not load private channels into public channels", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PRIVATE_CHANNEL);
                const pChannels = await  sfu.getPublicChannels();
                expect(pChannels[channel.id]).toBeUndefined();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("Should load private channel into chats", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PRIVATE_CHANNEL);
                const chats = await  sfu.getUserChats();
                expect(chats).toHaveProperty(channel.id);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should add member", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                channel = await sfu.addMemberToChat({id: channel.id, member: TEST_USER_1.username});
                expect(channel.members).toContain(TEST_USER_1.username);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should remove member", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                channel = await sfu.addMemberToChat({id: channel.id, member: TEST_USER_1.username});
                expect(channel.members).toContain(TEST_USER_1.username);
                channel = await sfu.removeMemberFromChat({id: channel.id, member: TEST_USER_1.username});
                const member = channel.members.find((member) => {member === TEST_USER_1.username});
                expect(member).toBeUndefined();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should send message", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const status = await sfu.sendMessage({
                    chatId: channel.id,
                    body: "test message"
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBeTruthy();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should send message with attachment", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const status = await sfu.sendMessage({
                    chatId: channel.id,
                    body: "test message",
                    attachments: [
                        TEST_PICTURE_ATTACHMENT
                    ]
                });
                expect(status).toBeTruthy();
                expect(status.id).toBeTruthy();
                expect(status.date).toBeTruthy();
                expect(status.state).toBeTruthy();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should mark message as read", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const status = await sfu.sendMessage({
                    chatId: channel.id,
                    body: "test message"
                });
                await sfu.markMessageRead(status);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should mark message as unread", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const status = await sfu.sendMessage({
                    chatId: channel.id,
                    body: "test message"
                });
                await sfu.markMessageUnread(status);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should rename channel", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                const name = "chat_name";
                await sfu.renameChat({id: channel.id, name: name});
                const pChannels = await sfu.getPublicChannels();
                const channelRenamed = pChannels[channel.id];
                expect(channelRenamed.name).toEqual(name);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should add channel to favourites", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                channel = await sfu.addChatToFavourites(channel);
                expect(channel.favourite).toBeTruthy();
                const chats = await sfu.getUserChats();
                channel = chats[channel.id];
                expect(channel.favourite).toBeTruthy();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should remove channel from favourites", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                channel = await sfu.addChatToFavourites(channel);
                expect(channel.favourite).toBeTruthy();
                channel = await sfu.removeChatFromFavourites(channel);
                expect(channel.favourite).toBeFalsy();
                const chats = await sfu.getUserChats();
                channel = chats[channel.id];
                expect(channel.favourite).toBeFalsy();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should change send policy", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PUBLIC_CHANNEL);
                expect(channel.channelSendPolicy).toBe(TEST_PUBLIC_CHANNEL.channelSendPolicy);
                const policy = ChannelSendPolicy.ADMIN_AND_LIST;
                channel = await sfu.updateChannelSendPolicy({id: channel.id, channelSendPolicy: policy});
                expect(channel.channelSendPolicy).toBe(policy);
                await sfu.deleteChat(channel);
                await sfu.disconnect();
            });
            it("should add member to policy list", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat({
                    ...TEST_PUBLIC_CHANNEL,
                    channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST
                });
                expect(channel.sendPermissionList.length).toBe(0);
                channel = await sfu.addChannelSendPermissionListMember({id: channel.id, member: TEST_USER_1.username});
                expect(channel.sendPermissionList).toContain(TEST_USER_1.username);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should remove member from policy list", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat({
                    ...TEST_PUBLIC_CHANNEL,
                    channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST
                });
                expect(channel.sendPermissionList.length).toBe(0);
                channel = await sfu.addChannelSendPermissionListMember({id: channel.id, member: TEST_USER_1.username});
                expect(channel.sendPermissionList).toContain(TEST_USER_1.username);
                channel = await sfu.removeChannelSendPermissionListMember({id: channel.id, member: TEST_USER_1.username});
                const member = channel.sendPermissionList.find((member) => member === TEST_USER_1.username);
                expect(member).toBeUndefined();
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            it("should update channel's configuration", async () => {
                const sfu = await connect(TEST_USER_0);
                const channel = await sfu.createChat(TEST_PRIVATE_CHANNEL);
                expect(channel).toBeTruthy();
                expect(channel.id).toBeTruthy();
                expect(channel.channel).toBeTruthy();
                expect(channel.name).toBe(TEST_PRIVATE_CHANNEL.name);
                expect(channel.channelType).toBe(TEST_PRIVATE_CHANNEL.channelType);
                expect(channel.channelSendPolicy).toBe(TEST_PRIVATE_CHANNEL.channelSendPolicy);
                expect(channel.allowedToAddExternalUser).toBe(false);
                const config = {
                    channelType: ChannelType.PUBLIC,
                    channelSendPolicy: ChannelSendPolicy.ADMIN,
                    allowedToAddExternalUser: true
                }
                const updatedChannel = await sfu.updateChatConfiguration({
                    id: channel.id,
                    ...config
                });
                expect(updatedChannel.channelType).toBe(config.channelType);
                expect(updatedChannel.channelSendPolicy).toBe(config.channelSendPolicy);
                expect(updatedChannel.allowedToAddExternalUser).toBe(true);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            test("updating channel's send policy from admin_and_list to other should clear the list", async () => {
                const sfu = await connect(TEST_USER_0);
                let channel = await sfu.createChat(TEST_PRIVATE_CHANNEL_WITH_LIST);
                expect(channel.sendPermissionList.length).toBe(0);
                channel = await sfu.addChannelSendPermissionListMember({id: channel.id, member: TEST_USER_1.username});
                expect(channel.sendPermissionList).toContain(TEST_USER_1.username);
                const config = {
                    channelType: ChannelType.PUBLIC,
                    channelSendPolicy: ChannelSendPolicy.ADMIN
                }
                channel = await sfu.updateChatConfiguration({
                    id: channel.id,
                    ...config
                });
                expect(channel.channelType).toBe(config.channelType);
                expect(channel.channelSendPolicy).toBe(config.channelSendPolicy);
                expect(channel.sendPermissionList.length).toBe(0);
                await sfu.deleteChat(channel);
                sfu.disconnect();
            });
            describe("notifications", () => {
                test("user should be notified when added to channel", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.NEW_CHAT, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let channel0 = await sfu0.createChat(TEST_PUBLIC_CHANNEL);
                    await sfu0.addMemberToChat({id: channel0.id, member: TEST_USER_1.username});
                });
                test("user should be notified when removed from channel", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_DELETED, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    }).on(SfuEvent.NEW_CHAT, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        await sfu0.removeMemberFromChat({id: channel0.id, member: TEST_USER_1.username});
                    });
                    let channel0 = await sfu0.createChat(TEST_PUBLIC_CHANNEL);
                    await sfu0.addMemberToChat({id: channel0.id, member: TEST_USER_1.username});
                });
                test("user should be notified when channel deleted", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_DELETED, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    }).on(SfuEvent.NEW_CHAT, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        await sfu0.deleteChat(channel0);
                    });
                    let channel0 = await sfu0.createChat({});
                    await sfu0.addMemberToChat({id: channel0.id, member: TEST_USER_1.username});
                });
                test("should receive message", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.MESSAGE, async (msg) => {
                        const message1 = msg as Message;
                        expect(message1.body).toEqual(messageBody);
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        members: [TEST_USER_1.username]
                    });
                    const messageBody = "test message";
                    await sfu0.sendMessage({
                        chatId: channel0.id,
                        body: messageBody
                    });
                });
                test("should receive message with attachment", async (done) => {
                    fsUtils.makeDir(fsUtils.getFilePath(__dirname, DOWNLOAD_PATH));

                    const attachmentsData = [];
                    const pendingAttachments = {};

                    const bob = await connect(TEST_USER_0);
                    const alice = await connect(TEST_USER_1);

                    let channel0 = await bob.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        members: [TEST_USER_1.username]
                    });

                    const onMessageHandler = async (msg) => {
                        expect(msg.attachments).toBeTruthy();
                        const attachmentRequest = {
                            messageId: msg.id,
                            attachmentId: msg.attachments[0].id,
                            chatId: msg.chatId,
                            name: msg.attachments[0].name,
                        }
                        pendingAttachments[msg.attachments[0].id] = attachmentRequest;
                        const attachment = await alice.getMessageAttachment(attachmentRequest);
                        expect(attachment).toBeTruthy();

                        const path = fsUtils.getFilePath(__dirname, DOWNLOAD_PATH + attachment.name);
                        fsUtils.writeFile(path, new Uint8Array(attachment.payload), {flag: 'a+'});

                        alice.off(SfuEvent.MESSAGE, onMessageHandler);
                        await bob.deleteChat(channel0);
                        bob.disconnect();
                        alice.disconnect();
                        done();
                    }

                    alice.on(SfuEvent.MESSAGE, onMessageHandler);

                    const messageBody = "test message";
                    const status = await bob.sendMessage({
                        chatId: channel0.id,
                        body: messageBody,
                        attachments: [
                            TEST_PICTURE_ATTACHMENT
                        ]
                    });
                    expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
                    expect(status.attachments).toBeTruthy();

                    console.log("Server attachments", status.attachments);

                    attachmentsData.push({
                        id: status.attachments[0].id,
                        payload: TEST_PICTURE_ATTACHMENT_DATA.payload
                    })
                    const handler = bob.getSendingAttachmentsHandler(attachmentsData, status.id);
                    handler.sendAttachments();
                });
                test("user should be notified with message IM state", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu0.on(SfuEvent.MESSAGE_STATE_BULK, async (msg) => {
                        const state = msg as MessageStatusBulkEvent;
                        expect(state).toBeTruthy();
                        expect(state.update[0].state).toEqual(MessageState.FULL_DELIVERY_FULL_READ);
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    sfu1.on(SfuEvent.MESSAGE, async (msg) => {
                        const message1 = msg as Message;
                        expect(message1.body).toEqual(messageBody);
                        await sfu1.markMessageRead(message1);
                    });
                    let channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        members: [TEST_USER_1.username]
                    });
                    const messageBody = "test message";
                    await sfu0.sendMessage({
                        chatId: channel0.id,
                        body: messageBody
                    });
                });
                test("member's state should update after it was added to send permission list", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_UPDATED, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        expect(channel1.sendPermissionList).toContain(TEST_USER_1.username);
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        members: [TEST_USER_1.username]
                    });
                    await sfu0.addChannelSendPermissionListMember({id: channel0.id, member: TEST_USER_1.username});
                });
                test("member's state should update after it was removed from send permission list", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_UPDATED, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        const member = channel1.sendPermissionList.find((member) => member === TEST_USER_1.username);
                        expect(member).toBeUndefined();
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST,
                        members: [TEST_USER_1.username],
                        sendPermissionList: [TEST_USER_1.username]
                    });
                    await sfu0.removeChannelSendPermissionListMember({id: channel0.id, member: TEST_USER_1.username});
                });
                test("public channel visible to everyone", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat(TEST_PUBLIC_CHANNEL);
                    const pChannels1 = await  sfu1.getPublicChannels();
                    expect(pChannels1).toHaveProperty(channel0.id);
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                    sfu1.disconnect();
                });
                test("private channel not visible to everyone", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat(TEST_PRIVATE_CHANNEL);
                    const pChannels1 = await  sfu1.getPublicChannels();
                    expect(pChannels1[channel0.id]).toBeUndefined();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                    sfu1.disconnect();
                });
                test("send policy EVERYONE", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.EVERYONE,
                        members: [TEST_USER_1.username]
                    });
                    sfu0.on(SfuEvent.MESSAGE, (msg) => {
                        const message0 = msg as Message;
                        sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    await sfu1.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    });
                });
                test("send policy ADMIN should fail for non admin", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN,
                        members: [TEST_USER_1.username]
                    });
                    await expect(sfu1.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    })).rejects.toBeTruthy();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                    sfu1.disconnect();
                });
                test("send policy ADMIN should work for admin", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN,
                        members: [TEST_USER_1.username]
                    });
                    await expect(sfu0.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    })).resolves.toBeTruthy();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                });
                test("send policy ADMIN_AND_LIST should work for listed", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST,
                        members: [TEST_USER_1.username],
                        sendPermissionList: [TEST_USER_1.username]
                    });
                    await expect(sfu1.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    })).resolves.toBeTruthy();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                    sfu1.disconnect();
                });
                test("send policy ADMIN_AND_LIST should work for admin", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST,
                        members: [TEST_USER_1.username],
                        sendPermissionList: []
                    });
                    await expect(sfu0.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    })).resolves.toBeTruthy();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                });
                test("send policy ADMIN_AND_LIST should fail for unlisted", async () => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    const channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST,
                        members: [TEST_USER_1.username],
                        sendPermissionList: []
                    });
                    await expect(sfu1.sendMessage({
                        chatId: channel0.id,
                        body: "test message"
                    })).rejects.toBeTruthy();
                    await sfu0.deleteChat(channel0);
                    sfu0.disconnect();
                    sfu1.disconnect();
                });
                test("member's state should update after owner channel configuration update", async (done) => {
                    const sfu0 = await connect(TEST_USER_0);
                    const sfu1 = await connect(TEST_USER_1);
                    sfu1.on(SfuEvent.CHAT_UPDATED, async (msg) => {
                        const channel1 = msg as UserSpecificChatInfo;
                        expect(channel1.id).toEqual(channel0.id);
                        expect(channel1.channelType).toEqual(TEST_PRIVATE_CHANNEL_WITH_LIST.channelType);
                        expect(channel1.channelSendPolicy).toEqual(TEST_PRIVATE_CHANNEL_WITH_LIST.channelSendPolicy);
                        expect(channel1.sendPermissionList).toContain(TEST_USER_1.username);
                        expect(channel1.canSend).toBeTruthy();
                        await sfu0.deleteChat(channel0);
                        sfu0.disconnect();
                        sfu1.disconnect();
                        done();
                    });
                    let channel0 = await sfu0.createChat({
                        ...TEST_PUBLIC_CHANNEL,
                        members: [TEST_USER_1.username]
                    });
                    await sfu0.updateChatConfiguration({
                        id: channel0.id,
                        channelType: TEST_PRIVATE_CHANNEL_WITH_LIST.channelType,
                        channelSendPolicy: TEST_PRIVATE_CHANNEL_WITH_LIST.channelSendPolicy,
                        sendPermissionList: [TEST_USER_1.username]
                    });
                });
            });
        });
    });
});