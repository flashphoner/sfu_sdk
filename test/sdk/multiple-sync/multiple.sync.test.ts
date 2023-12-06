import {SfuEvent, SfuExtended} from "../../../src";
import {connect} from "../../util/utils";
import {
    CALENDAR_EVENT,
    TEST_PRIVATE_CHANNEL_WITH_LIST,
    TEST_USER_0,
    TEST_USER_1,
    TEST_USER_2
} from "../../util/constants";
import {
    CalendarEvent,
    ChannelSendPolicy,
    ChatType,
    Invite,
    MessageEdited,
    User,
    UserInfoChangedEvent,
    UserPmiSettings,
    UserSpecificChatInfo,
    LastReadMessageUpdated,
    UpdateMessagesDeliveryStatusEvent,
    DeliveryStatus
} from "../../../src/sdk/constants";

const MESSAGE_BODY = "test message";

describe("multiple-sync", () => {

    let bobFirstInstance: SfuExtended;
    let bobSecondInstance: SfuExtended;
    beforeEach(async () => {
        bobFirstInstance = await connect(TEST_USER_0);
        bobSecondInstance = await connect(TEST_USER_0);
    })
    afterEach(async () => {
        await bobFirstInstance.disconnect();
        await bobSecondInstance.disconnect();
    })


    describe("contacts", () => {
        let aliceFirstInstance: SfuExtended;
        let aliceSecondInstance: SfuExtended;
        beforeEach(async () => {
            aliceFirstInstance = await connect(TEST_USER_1);
            aliceSecondInstance = await connect(TEST_USER_1);
        })
        afterEach(async () => {
            await aliceFirstInstance.disconnect();
            await aliceSecondInstance.disconnect();
        })

        it('should invite contact', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkInviteAndResolve = (invite: Invite) => {
                        expect(invite.from).toEqual(TEST_USER_0.username);
                        expect(invite.to).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        if (eventsCount === 3) {
                            resolve();
                        }
                    }

                    bobSecondInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        expect(user.id).toEqual(TEST_USER_1.username);
                        checkInviteAndResolve(user.invite);
                    });
                    aliceFirstInstance.on(SfuEvent.CONTACT_INVITE, (msg) => {
                        const invite = msg as Invite;
                        checkInviteAndResolve(invite);
                    });
                    aliceSecondInstance.on(SfuEvent.CONTACT_INVITE, (msg) => {
                        const invite = msg as Invite;
                        checkInviteAndResolve(invite);
                    });
                })
            }


            bobFirstInstance.inviteContact({to: TEST_USER_1.username});
            await waitEvents();
            await bobFirstInstance.removeContact({id: TEST_USER_1.username});
        });
        it('should confirm invite', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkUserAndResolve = (user: User, username: string) => {
                        expect(user.id).toEqual(username);
                        eventsCount++;
                        if (eventsCount === 3 && user.confirmed) {
                            resolve();
                        }
                    }
                    aliceSecondInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_0.username);
                    });
                    bobFirstInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_1.username);
                    });
                    bobSecondInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_1.username);
                    });
                })
            }


            const invite = await bobFirstInstance.inviteContact({to: TEST_USER_1.username});
            aliceFirstInstance.confirmContact({
                id: invite.id,
                from: TEST_USER_0.username,
                to: TEST_USER_1.username
            })
            await waitEvents();
            await bobFirstInstance.removeContact({id: TEST_USER_1.username});
        });
        it('should remove contact', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkUserAndResolve = (user: User, username: string) => {
                        expect(user.id).toEqual(username);
                        eventsCount++;
                        if (eventsCount === 3 && !user.confirmed) {
                            resolve();
                        }
                    }

                    aliceSecondInstance.on(SfuEvent.CONTACT_REMOVED, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_0.username);
                    });
                    bobFirstInstance.on(SfuEvent.CONTACT_REMOVED, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_1.username);
                    });
                    bobSecondInstance.on(SfuEvent.CONTACT_REMOVED, (msg) => {
                        const user = msg as User;
                        checkUserAndResolve(user, TEST_USER_1.username);
                    });
                })
            }


            const invite = await bobFirstInstance.inviteContact({to: TEST_USER_1.username});
            await aliceFirstInstance.confirmContact({
                id: invite.id,
                from: TEST_USER_0.username,
                to: TEST_USER_1.username
            })
            aliceFirstInstance.removeContact({id: TEST_USER_0.username});
            await waitEvents();
        });
        it('should add contact to favorites', async () => {
            const waitEvent = async () => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        expect(user.id).toEqual(TEST_USER_1.username);
                        if (user.confirmed && user.favourite) {
                            resolve();
                        }
                    });
                })
            }


            const invite = await bobFirstInstance.inviteContact({to: TEST_USER_1.username});
            await aliceFirstInstance.confirmContact({
                id: invite.id,
                from: TEST_USER_0.username,
                to: TEST_USER_1.username
            })
            bobFirstInstance.addContactToFavourites({id: TEST_USER_1.username});
            await waitEvent();
            await bobFirstInstance.removeContact({id: TEST_USER_1.username});
        });
        it('should remove contact from favorites', async () => {
            const waitEvent = async () => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.CONTACT_UPDATE, (msg) => {
                        const user = msg as User;
                        expect(user.id).toEqual(TEST_USER_1.username);
                        if (user.confirmed && !user.favourite) {
                            resolve();
                        }
                    });
                })
            }


            const invite = await bobFirstInstance.inviteContact({to: TEST_USER_1.username});
            await aliceFirstInstance.confirmContact({
                id: invite.id,
                from: TEST_USER_0.username,
                to: TEST_USER_1.username
            })
            await bobFirstInstance.addContactToFavourites({id: TEST_USER_1.username});
            bobFirstInstance.removeContactFromFavourites({id: TEST_USER_1.username});
            await waitEvent();
            await bobFirstInstance.removeContact({id: TEST_USER_1.username});
        });
    });

    describe("calendar", () => {
        it('should add calendar event', async () => {
            const waitEvent = async () => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.NEW_CALENDAR_ENTRY, (msg) => {
                        const event = msg as CalendarEvent;
                        expect(event.title).toEqual(CALENDAR_EVENT.title);
                        expect(event.accessCode).toEqual(CALENDAR_EVENT.accessCode);
                        resolve();
                    });
                })
            }

            const pmiSettings = await bobFirstInstance.getUserPmiSettings();
            bobFirstInstance.addCalendarEvent(CALENDAR_EVENT);
            await waitEvent();
            await bobFirstInstance.updateUserPmiSettings(pmiSettings.pmiSettings);
            const events = await bobFirstInstance.getUserCalendar();
            expect(events.events.length).toBe(1);
            await bobFirstInstance.removeCalendarEvent({id: events.events[0].id});
        });
        it('should update calendar event', async () => {
            const waitEvent = async () => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.UPDATE_CALENDAR_EVENT, (msg) => {
                        const event = msg as CalendarEvent;
                        expect(event.usePMI).toBeFalsy();
                        resolve();
                    });
                })
            }

            const pmiSettings = await bobFirstInstance.getUserPmiSettings();
            const calendarEvent = await bobFirstInstance.addCalendarEvent(CALENDAR_EVENT);
            calendarEvent.usePMI = false;
            bobFirstInstance.updateCalendarEvent(calendarEvent);
            await waitEvent();
            await bobFirstInstance.updateUserPmiSettings(pmiSettings.pmiSettings);
            const events = await bobFirstInstance.getUserCalendar();
            expect(events.events.length).toBe(1);
            await bobFirstInstance.removeCalendarEvent({id: events.events[0].id});
        });
        it('should remove calendar event', async () => {
            const waitEvent = async () => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.REMOVE_CALENDAR_ENTRY, (msg) => {
                        resolve();
                    });
                })
            }

            const pmiSettings = await bobFirstInstance.getUserPmiSettings();
            await bobFirstInstance.addCalendarEvent(CALENDAR_EVENT);
            const events = await bobFirstInstance.getUserCalendar();
            expect(events.events.length).toBe(1);
            bobFirstInstance.removeCalendarEvent({id: events.events[0].id});
            await waitEvent();
            await bobFirstInstance.updateUserPmiSettings(pmiSettings.pmiSettings);
        });
    });
    describe("user", () => {

        let aliceFirstInstance: SfuExtended;
        let aliceSecondInstance: SfuExtended;
        beforeEach(async () => {
            aliceFirstInstance = await connect(TEST_USER_1);
            aliceSecondInstance = await connect(TEST_USER_1);
        })
        afterEach(async () => {
            await aliceFirstInstance.disconnect();
            await aliceSecondInstance.disconnect();
        })

        it('should change email', async () => {
            const newEmail = "newEmail@flashphoner.com";

            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const userEmailChangedEventHandler = (msg) => {
                        bobSecondInstance.off(SfuEvent.USER_INFO_CHANGED, userEmailChangedEventHandler);
                        const event = msg as UserInfoChangedEvent;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        expect(event.info.email).toEqual(newEmail);
                        eventsCount++;
                        if (eventsCount === 3) {
                            resolve();
                        }
                    };

                    bobSecondInstance.on(SfuEvent.USER_INFO_CHANGED, userEmailChangedEventHandler);

                    const checkEventAndResolve = (msg) => {
                        const user = msg as User;
                        expect(user.id).toEqual(TEST_USER_0.username);
                        expect(user.email).toEqual(newEmail);
                        eventsCount++;
                        if (eventsCount === 3) {
                            resolve();
                        }
                    }

                    const contactUpdateEventHandlerForFirstAlice = (msg) => {
                        aliceFirstInstance.off(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForFirstAlice);
                        checkEventAndResolve(msg);
                    };

                    const contactUpdateEventHandlerForSecondAlice = (msg) => {
                        aliceSecondInstance.off(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForSecondAlice);
                        checkEventAndResolve(msg);
                    };


                    aliceFirstInstance.on(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForFirstAlice);
                    aliceSecondInstance.on(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForSecondAlice);
                })
            }

            bobFirstInstance.changeUserEmail(newEmail);
            await waitEvents();
            await bobFirstInstance.changeUserEmail(TEST_USER_0.username);
        });
        it('should change nickname', async () => {
            const newNickname = "newNickname";

            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const userNicknameChangedEventHandler = (msg) => {
                        bobSecondInstance.off(SfuEvent.USER_INFO_CHANGED, userNicknameChangedEventHandler);
                        const event = msg as UserInfoChangedEvent;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        expect(event.info.nickname).toEqual(newNickname);
                        eventsCount++;
                        if (eventsCount === 3) {
                            resolve();
                        }
                    };

                    bobSecondInstance.on(SfuEvent.USER_INFO_CHANGED, userNicknameChangedEventHandler);

                    const checkEventAndResolve = (msg) => {
                        const user = msg as User;
                        expect(user.id).toEqual(TEST_USER_0.username);
                        expect(user.nickname).toEqual(newNickname);
                        eventsCount++;
                        if (eventsCount === 3) {
                            resolve();
                        }
                    }

                    const contactUpdateEventHandlerForFirstAlice = (msg) => {
                        aliceFirstInstance.off(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForFirstAlice);
                        checkEventAndResolve(msg);
                    };

                    const contactUpdateEventHandlerForSecondAlice = (msg) => {
                        aliceSecondInstance.off(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForSecondAlice);
                        checkEventAndResolve(msg);
                    };


                    aliceFirstInstance.on(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForFirstAlice);
                    aliceSecondInstance.on(SfuEvent.CONTACT_UPDATE, contactUpdateEventHandlerForSecondAlice);
                })
            }

            bobFirstInstance.changeUserNickname(newNickname);
            await waitEvents();
            await bobFirstInstance.changeUserNickname(TEST_USER_0.nickname);
        });
        it('should change hostKey', async () => {
            const newHostKey = "123123";

            const waitSyncEvent = async () => {
                return new Promise<void>((resolve) => {
                    const handler = (msg) => {
                        bobSecondInstance.off(SfuEvent.USER_INFO_CHANGED, handler);
                        const event = msg as UserInfoChangedEvent;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        expect(event.info.hostKey).toEqual(newHostKey);
                        resolve();
                    };

                    bobSecondInstance.on(SfuEvent.USER_INFO_CHANGED, handler);
                })
            }

            bobFirstInstance.changeUserHostKey(newHostKey);
            await waitSyncEvent();
            await bobFirstInstance.changeUserHostKey("");
        });
        it('should change phone number', async () => {
            const newPhoneNumber = "89999999999";

            const waitSyncEvent = async () => {
                return new Promise<void>((resolve) => {
                    const handler = (msg) => {
                        bobSecondInstance.off(SfuEvent.USER_INFO_CHANGED, handler);
                        const event = msg as UserInfoChangedEvent;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        expect(event.info.phoneNumber).toEqual(newPhoneNumber);
                        resolve();
                    };

                    bobSecondInstance.on(SfuEvent.USER_INFO_CHANGED, handler);
                })
            }

            bobFirstInstance.changeUserPhoneNumber(newPhoneNumber);
            await waitSyncEvent();
            await bobFirstInstance.changeUserPhoneNumber("");
        });
        it('should change timezone', async () => {
            const newTimezone = "Asia/Moscow, GMT +3:00";

            const waitSyncEvent = async () => {
                return new Promise<void>((resolve) => {
                    const handler = (msg) => {
                        bobSecondInstance.off(SfuEvent.USER_INFO_CHANGED, handler);
                        const event = msg as UserInfoChangedEvent;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        expect(event.info.timezone).toEqual(newTimezone);
                        resolve();
                    };

                    bobSecondInstance.on(SfuEvent.USER_INFO_CHANGED, handler);
                })
            }

            bobFirstInstance.changeUserTimezone(newTimezone);
            await waitSyncEvent();
            await bobFirstInstance.changeUserTimezone("");
        });
    });
    describe("pmi", () => {
        it('should update pmi settings', async () => {
            const newAccessCode = "999999";
            const pmiSettings = await bobFirstInstance.getUserPmiSettings();
            const waitSyncEvent = async () => {
                return new Promise<void>((resolve) => {
                    const handler = (msg) => {
                        bobSecondInstance.off(SfuEvent.UPDATE_USER_PMI_SETTINGS, handler);
                        const settings = msg as UserPmiSettings;
                        expect(settings.pmiSettings.accessCode).toEqual(newAccessCode);
                        expect(settings.pmiSettings.allowJoinAtAnyTime).toBeTruthy();
                        resolve();
                    };

                    bobSecondInstance.on(SfuEvent.UPDATE_USER_PMI_SETTINGS, handler);
                })
            }


            bobFirstInstance.updateUserPmiSettings({
                ...pmiSettings.pmiSettings,
                accessCode: newAccessCode,
                allowJoinAtAnyTime: true
            });
            await waitSyncEvent();
            await bobFirstInstance.updateUserPmiSettings({...pmiSettings.pmiSettings});
        });
    })
    describe("chat", () => {
        let aliceFirstInstance: SfuExtended;
        let aliceSecondInstance: SfuExtended;
        beforeEach(async () => {
            aliceFirstInstance = await connect(TEST_USER_1);
            aliceSecondInstance = await connect(TEST_USER_1);
        })
        afterEach(async () => {
            await aliceFirstInstance.disconnect();
            await aliceSecondInstance.disconnect();
        })

        it('should create chat', async () => {
            const waitNewChatEvents = (): Promise<void> => {

                const onNewChatHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.NEW_CHAT, (msg) => {
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }

                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onNewChatHandler(bobSecondInstance, resolve, eventsCount);
                    onNewChatHandler(aliceFirstInstance, resolve, eventsCount);
                    onNewChatHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });

            await waitNewChatEvents();

            const chats = await bobFirstInstance.getUserChats();
            Object.keys(chats).forEach((chat) => {
                bobFirstInstance.deleteChat({id: chat});
            });
        });
        it('should delete chat', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });

            const waitChatDeletedEvents = (id: string): Promise<void> => {
                const onChatDeletedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_DELETED, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }

                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatDeletedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatDeletedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatDeletedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.deleteChat({id: chat.id});
            await waitChatDeletedEvents(chat.id);
        });
        it('should rename chat', async () => {
            const newChatName = "new chat name";
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username, TEST_USER_2.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const waitChatUpdatedEvents = (id: string): Promise<void> => {

                const onChatUpdatedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        expect(event.name).toEqual(newChatName);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }

                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatUpdatedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.renameChat({
                id: chat.id,
                name: newChatName
            });
            await waitChatUpdatedEvents(chat.id);
            await bobFirstInstance.deleteChat({id: chat.id});
        });
        it('should add chat member', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const waitEvents = (id: string): Promise<void> => {

                const onNewChatHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.NEW_CHAT, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        expect(event.members.length).toBe(2);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }

                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    bobSecondInstance.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        expect(event.members.length).toBe(2);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                    onNewChatHandler(aliceFirstInstance, resolve, eventsCount);
                    onNewChatHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.addMemberToChat({
                id: chat.id,
                member: TEST_USER_1.username
            });
            await waitEvents(chat.id);
            await bobFirstInstance.deleteChat({id: chat.id});
        });
        it('should remove member from chat', async () => {
            const waitEvents = (id: string): Promise<void> => {

                const onChatDeletedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_DELETED, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }

                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    bobSecondInstance.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const event = msg as UserSpecificChatInfo;
                        expect(event.id).toEqual(id);
                        expect(event.members.length).toBe(1);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                    onChatDeletedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatDeletedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            bobFirstInstance.removeMemberFromChat({
                id: chat.id,
                member: TEST_USER_1.username
            });
            await waitEvents(chat.id);
            await bobFirstInstance.deleteChat({id: chat.id});
        });
        it('should update channel send policy', async () => {
            const channel = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: true,
                channelSendPolicy: ChannelSendPolicy.ADMIN
            });

            const waitEvents = (channelId: string): Promise<void> => {
                const onChatUpdatedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(channelId);
                        expect(info.channelSendPolicy).toEqual(ChannelSendPolicy.EVERYONE);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatUpdatedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.updateChannelSendPolicy({
                id: channel.id,
                channelSendPolicy: ChannelSendPolicy.EVERYONE
            });
            await waitEvents(channel.id);
            await bobFirstInstance.deleteChat(channel);
        });
        it('should add channel send permission list', async () => {
            const channel = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: true,
                channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST
            });

            const waitEvents = (channelId: string): Promise<void> => {
                const onChatUpdatedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(channelId);
                        expect(info.channelSendPolicy).toEqual(ChannelSendPolicy.ADMIN_AND_LIST);
                        expect(info.sendPermissionList.length).toBe(1);
                        expect(info.sendPermissionList).toContain(TEST_USER_1.username);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatUpdatedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.addChannelSendPermissionListMember({
                id: channel.id,
                member: TEST_USER_1.username
            });
            await waitEvents(channel.id);
            await bobFirstInstance.deleteChat(channel);
        });
        it('should remove channel send permission list', async () => {
            const channel = await bobFirstInstance.createChat({members: [TEST_USER_0.username, TEST_USER_1.username], type: ChatType.PUBLIC, channel: true, channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST, sendPermissionList: [TEST_USER_1.username]});
            expect(channel.sendPermissionList.length).toBe(1);

            const waitEvents = (channelId: string): Promise<void> => {
                const onChatUpdatedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(channelId);
                        expect(info.channelSendPolicy).toEqual(ChannelSendPolicy.ADMIN_AND_LIST);
                        expect(info.sendPermissionList.length).toBe(0);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatUpdatedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.removeChannelSendPermissionListMember({
                id: channel.id,
                member: TEST_USER_1.username
            });
            await waitEvents(channel.id);
            await bobFirstInstance.deleteChat(channel);
        });
        it('should update chat configuration', async () => {
            const channel = await bobFirstInstance.createChat({
                ...TEST_PRIVATE_CHANNEL_WITH_LIST,
                members: [TEST_USER_0.username, TEST_USER_1.username],
                sendPermissionList: [TEST_USER_1.username]
            });
            expect(channel.sendPermissionList.length).toBe(1);

            const waitEvents = (channelId: string): Promise<void> => {
                const onChatUpdatedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(channelId);
                        expect(info.channelSendPolicy).toEqual(ChannelSendPolicy.ADMIN);
                        expect(info.sendPermissionList.length).toBe(0);
                        expect(info.allowedToAddExternalUser).toBeTruthy();
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onChatUpdatedHandler(bobSecondInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceFirstInstance, resolve, eventsCount);
                    onChatUpdatedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            const config = {
                type: ChatType.PUBLIC,
                channelSendPolicy: ChannelSendPolicy.ADMIN,
                allowedToAddExternalUser: true
            }
            bobFirstInstance.updateChatConfiguration({
                id: channel.id,
                ...config
            });
            await waitEvents(channel.id);
            await bobFirstInstance.deleteChat(channel);
        });
        it('should add chat to favorites', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const waitChatUpdatedEvent = async (id: string) => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(id);
                        expect(info.favourite).toBeTruthy();
                        resolve();
                    });
                })
            }


            bobFirstInstance.addChatToFavourites({id: chat.id});
            await waitChatUpdatedEvent(chat.id);
            await bobFirstInstance.deleteChat({id: chat.id});
        });
        it('should remove chat from favorites', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const waitChatUpdatedEvent = async (id: string) => {
                return new Promise<void>((resolve) => {
                    bobSecondInstance.on(SfuEvent.CHAT_UPDATED, (msg) => {
                        const info = msg as UserSpecificChatInfo;
                        expect(info.id).toEqual(id);
                        if (!info.favourite) {
                            resolve();
                        }
                    });
                })
            }


            await bobFirstInstance.addChatToFavourites({id: chat.id});
            bobFirstInstance.removeChatFromFavourites({id: chat.id});
            await waitChatUpdatedEvent(chat.id);
            await bobFirstInstance.deleteChat({id: chat.id});
        });
        it('should send message', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });

            const onNewMessageHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                sfu.on(SfuEvent.MESSAGE, (msg) => {
                    eventsCount.num++;
                    if (eventsCount.num === 3) {
                        resolve();
                    }
                });
            }
            const waitEvents = (): Promise<void> => {
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    bobSecondInstance.on(SfuEvent.SEND_MESSAGE_SYNC, (msg) => {
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    })
                    onNewMessageHandler(aliceFirstInstance, resolve, eventsCount);
                    onNewMessageHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            bobFirstInstance.sendMessage({
                chatId: chat.id,
                body: MESSAGE_BODY,
            });
            await waitEvents();
            await bobFirstInstance.deleteChat(chat);
        });
        it('should edit message', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const newMessageBody = "newMessageBody";

            const waitEvents = (messageId: string): Promise<void> => {
                const onMessageEditedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_MESSAGE_EDITED, (msg) => {
                        const messageEdited = msg as MessageEdited;
                        expect(messageEdited.message.id).toEqual(messageId);
                        expect(messageEdited.message.body).toEqual(newMessageBody);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onMessageEditedHandler(bobSecondInstance, resolve, eventsCount);
                    onMessageEditedHandler(aliceFirstInstance, resolve, eventsCount);
                    onMessageEditedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            const message = await bobFirstInstance.sendMessage({
                chatId: chat.id,
                body: MESSAGE_BODY,
            });
            bobFirstInstance.editChatMessage({
                chatId: chat.id,
                messageId: message.id,
                body: newMessageBody
            });
            await waitEvents(message.id);
            await bobFirstInstance.deleteChat(chat);
        });
        it('should delete message', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });
            const newMessageBody = "newMessageBody";

            const waitEvents = (messageId: string): Promise<void> => {
                const onMessageDeletedHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.CHAT_MESSAGE_EDITED, (msg) => {
                        const messageEdited = msg as MessageEdited;
                        expect(messageEdited.message.id).toEqual(messageId);
                        expect(messageEdited.message.body).toEqual(newMessageBody);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    onMessageDeletedHandler(bobSecondInstance, resolve, eventsCount);
                    onMessageDeletedHandler(aliceFirstInstance, resolve, eventsCount);
                    onMessageDeletedHandler(aliceSecondInstance, resolve, eventsCount);
                })
            }

            const message = await bobFirstInstance.sendMessage({
                chatId: chat.id,
                body: MESSAGE_BODY,
            });
            bobFirstInstance.editChatMessage({
                chatId: chat.id,
                messageId: message.id,
                body: newMessageBody
            });
            await waitEvents(message.id);
            await bobFirstInstance.deleteChat(chat);
        });
        it('should mark message read', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });

            const waitEvents = (chatId: string, messageId: string, messageDate: number): Promise<void> => {
                const onMessageStatusBulkEventHandler = (sfu: SfuExtended, resolve: () => void, eventsCount: { num: number }): void => {
                    sfu.on(SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS, (msg) => {
                        const updateEvent = msg as UpdateMessagesDeliveryStatusEvent;
                        expect(chatId).toEqual(updateEvent.chatId);
                        expect(updateEvent.dateFrom).toBe(0);
                        expect(updateEvent.dateTo).toBe(messageDate);
                        expect(updateEvent.userId).toEqual(aliceFirstInstance.user().username);
                        expect(updateEvent.status).toEqual(DeliveryStatus.READ);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                }
                return new Promise<void>((resolve) => {
                    let eventsCount = { num: 0 };
                    aliceSecondInstance.on(SfuEvent.LAST_READ_MESSAGE_UPDATED, (msg) => {
                        const updateEvent = msg as LastReadMessageUpdated;
                        expect(updateEvent.chatId).toEqual(chatId);
                        expect(updateEvent.updateInfo.lastReadMessageId).toEqual(messageId);
                        expect(updateEvent.updateInfo.lastReadMessageDate).toEqual(messageDate);
                        eventsCount.num++;
                        if (eventsCount.num === 3) {
                            resolve();
                        }
                    });
                    onMessageStatusBulkEventHandler(bobFirstInstance, resolve, eventsCount);
                    onMessageStatusBulkEventHandler(bobSecondInstance, resolve, eventsCount);
                })
            }

            const message = await bobFirstInstance.sendMessage({
                chatId: chat.id,
                body: MESSAGE_BODY,
            });
            aliceFirstInstance.markMessageRead({id: message.id, chatId: chat.id});
            await waitEvents(chat.id, message.id, message.date);
            await bobFirstInstance.deleteChat(chat);
        });
        it('should mark message unread', async () => {
            const chat = await bobFirstInstance.createChat({
                members: [TEST_USER_0.username, TEST_USER_1.username],
                type: ChatType.PUBLIC,
                channel: false
            });

            const waitEvents = (chatId: string, messageDate: number): Promise<void> => {
                return new Promise<void>((resolve) => {
                    aliceSecondInstance.on(SfuEvent.LAST_READ_MESSAGE_UPDATED, (msg) => {
                        const updateEvent = msg as LastReadMessageUpdated;
                        expect(updateEvent.chatId).toEqual(chatId);
                        if (
                            updateEvent.updateInfo.oldLastReadMessageDate === messageDate
                            && updateEvent.updateInfo.lastReadMessageDate === 0
                            && updateEvent.updateInfo.lastReadMessageId === ''
                        ) {
                            resolve();
                        }
                    });
                })
            }

            const message = await bobFirstInstance.sendMessage({
                chatId: chat.id,
                body: MESSAGE_BODY,
            });
            await aliceFirstInstance.markMessageRead({id: message.id, chatId: chat.id});
            aliceFirstInstance.markMessageUnread({id: message.id, chatId: chat.id});
            await waitEvents(chat.id, message.date);
            await bobFirstInstance.deleteChat(chat);
        });
    });
})