import {TEST_CHANNEL_NAME, TEST_SPACE_NAME, TEST_USER_0, TEST_USER_1, TEST_USER_2, url} from "../../util/constants";
import {
    ContactDeleted,
    ContactUpdated,
    FriendInviteDeleted,
    NewContact,
    NewFriendInvite,
    PresenceStatus,
    SfuEvent,
    UserPresenceStatusUpdated
} from "../../../src/sdk/constants";
import {SfuExtended} from "../../../src";
import {connect, waitForUsers} from "../../util/utils";

describe("contacts", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
    })
    afterEach(async () => {
        await bob.disconnect();
        await alice.disconnect();
    })
    describe("friends", () => {
        it('should send friend invite', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});
            const bobContacts = await bob.getContacts();
            expect(bobContacts.outgoingFriendInvites.length).toBe(1);

            const outgoingInvite = bobContacts.outgoingFriendInvites[0];
            expect(outgoingInvite.userId).toEqual(TEST_USER_1.username);

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];
            expect(incomingInvite.userId).toEqual(TEST_USER_0.username);

            expect(outgoingInvite.inviteId).toEqual(incomingInvite.inviteId);

            await bob.revokeFriendInvite({inviteId: outgoingInvite.inviteId});
        });
        it('user should be added as a friend if that user sent friend request earlier', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            await alice.addFriend({userId: TEST_USER_0.username});

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.friend)).toBeTruthy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname && item.friend)).toBeTruthy();

            await bob.removeFriend({userId: TEST_USER_1.username});
        });
        it('should revoke friend invite', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});
            const bobContacts = await bob.getContacts();
            expect(bobContacts.outgoingFriendInvites.length).toBe(1);
            const outgoingInvite = bobContacts.outgoingFriendInvites[0];

            const revokedInvite = await bob.revokeFriendInvite({inviteId: outgoingInvite.inviteId});
            expect(outgoingInvite.inviteId).toEqual(revokedInvite.inviteId);
        });
        it('should accept friend invite', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];

            const friend = await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId});
            expect(friend.userId).toEqual(bob.user().username);
            expect(friend.nickname).toEqual(bob.user().nickname);

            await bob.removeFriend({userId: TEST_USER_1.username});
        });
        it('should reject friend invite', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];
            const rejectedInvite = await alice.rejectFriendInvite({inviteId: incomingInvite.inviteId});

            const bobContacts = await bob.getContacts();
            expect(bobContacts.outgoingFriendInvites.length).toBe(1);
            expect(bobContacts.outgoingFriendInvites[0].inviteId).toEqual(incomingInvite.inviteId);
            expect(rejectedInvite.inviteId).toEqual(incomingInvite.inviteId);
        });
        it('should remove friend', async () => {
            await bob.addFriend({userId: TEST_USER_1.username});

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.incomingFriendInvites.length).toBe(1);
            const incomingInvite = aliceContacts.incomingFriendInvites[0];
            const friend = await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId});
            expect(friend.userId).toEqual(bob.user().username);
            expect(friend.nickname).toEqual(bob.user().nickname);

            await bob.removeFriend({userId: TEST_USER_1.username});

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.friend)).toBeFalsy();
        });
    });
    describe("space", () => {
        it('a new contact should be received when a user joins to a space with mutual channel', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }

                    const bobHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                    }
                    bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                    alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            alice.joinSpaceByInviteCode(invite.inviteCode);
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();

            await bob.deleteSpace({id: space.id});
        });
        it('contact should be deleted when a user leaves from space', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            await alice.joinSpaceByInviteCode(invite.inviteCode);

            alice.leaveSpace({id: space.id});
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();

            await bob.deleteSpace({id: space.id});
        });
        it('a new contact should be received when user creates a new mutual channel', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_1.username);
                        expect(event.contact.nickname).toEqual(TEST_USER_1.nickname);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_0.username);
                        expect(event.contact.nickname).toEqual(TEST_USER_0.nickname);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                    }
                    bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                    alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            await alice.joinSpaceByInviteCode(invite.inviteCode);

            await bob.deleteSpaceChannel({spaceId: space.id, channelId: space.channels[0].id});

            bob.createSpaceChannel({
                spaceId: space.id,
                name: TEST_CHANNEL_NAME,
                isPrivate: false
            });
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();

            await bob.deleteSpace({id: space.id});
        });
        it('contact should be deleted when a user deletes the mutual channel', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            await alice.joinSpaceByInviteCode(invite.inviteCode);

            bob.deleteSpaceChannel({spaceId: space.id, channelId: space.channels[0].id});
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();

            await bob.deleteSpace({id: space.id});
        });
        it('contact should be deleted when a user deletes the space with mutual channels', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            await alice.joinSpaceByInviteCode(invite.inviteCode);

            bob.deleteSpace({id: space.id});
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();
        });
        it('should update space channel access rights', async () => {
            const kiri = await connect(TEST_USER_2);

            const waitDeletedEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            await alice.joinSpaceByInviteCode(invite.inviteCode);
            await kiri.joinSpaceByInviteCode(invite.inviteCode);

            const channel = space.channels[0];
            expect(channel).toBeTruthy();
            bob.updateSpaceChannel({
                spaceId: space.id,
                channelId: channel.id,
                name: channel.name,
                isPrivate: true,
                members: [TEST_USER_0.username, TEST_USER_1.username]
            });
            await waitDeletedEvents();

            let bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeFalsy();

            let aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeFalsy();

            let kiriContacts = await kiri.getContacts();
            expect(kiriContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();
            expect(kiriContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const waitNewContactEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }

                    const bobHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                    }
                    bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                    alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                });
            };

            bob.updateSpaceChannel({
                spaceId: space.id,
                channelId: channel.id,
                name: channel.name,
                isPrivate: false
            });
            await waitNewContactEvents();

            bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeTruthy();

            aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeTruthy();

            kiriContacts = await kiri.getContacts();
            expect(kiriContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();
            expect(kiriContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();

            await kiri.disconnect();
            await bob.deleteSpace({id: space.id});
        });
        describe("presence status", () => {
            it('user should be notified when contact disconnects', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        const bobHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(PresenceStatus.OFFLINE);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            resolve();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                    });
                };

                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
                await alice.joinSpaceByInviteCode(invite.inviteCode);

                alice.disconnect();
                await waitEvent();


                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.OFFLINE)).toBeTruthy();

                await alice.connect({
                    url: url,
                    ...TEST_USER_1,
                    username: TEST_USER_1.email
                });
                await bob.deleteSpace({id: space.id});
            });
            it('user should be notified when contact connects', async () => {
                const waitEvent = async (status: PresenceStatus) => {
                    return new Promise<void>((resolve) => {
                        const bobHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(status);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            resolve();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                    });
                };

                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
                await alice.joinSpaceByInviteCode(invite.inviteCode);

                alice.disconnect();
                await waitEvent(PresenceStatus.OFFLINE);
                alice.connect({
                    url: url,
                    ...TEST_USER_1,
                    username: TEST_USER_1.email
                });
                await waitEvent(PresenceStatus.ONLINE);

                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.ONLINE)).toBeTruthy();

                await bob.deleteSpace({id: space.id});
            });
            it('user should be notified when contact changes status', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        const bobHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(PresenceStatus.IDLE);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            resolve();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                    });
                };

                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
                await alice.joinSpaceByInviteCode(invite.inviteCode);

                alice.updatePresenceStatus(PresenceStatus.IDLE);
                await waitEvent();

                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.IDLE)).toBeTruthy();

                await alice.updatePresenceStatus(PresenceStatus.ONLINE);

                await bob.deleteSpace({id: space.id});
            });
        });
    });
    describe("direct", () => {
        it('should receive new contact when user creates personal chat', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }

                    const bobHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                    }
                    bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                    alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                });
            };

            bob.createChat({
                members: [TEST_USER_1.username]
            });
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();

            const chats = await bob.getUserChats();
            for (let chat of Object.values(chats)) {
                await bob.deleteChat({id: chat.id});
            }
        });
        it('should delete contact when user removes chat member from group chat', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const chat = await bob.createChat({
                members: [TEST_USER_1.username, TEST_USER_2.username]
            });

            bob.removeMemberFromChat({
                id: chat.id,
                member: TEST_USER_2.username
            });
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();

            await bob.deleteChat({id: chat.id});
        });
        it('should receive a new contact when user adds member to group chat', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }

                    const bobHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as NewContact;
                        expect(event.contact.userId).toEqual(TEST_USER_2.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                    }
                    bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                    alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                });
            };

            const chat = await bob.createChat({
                members: [TEST_USER_1.username, TEST_USER_2.username]
            });

            await bob.removeMemberFromChat({
                id: chat.id,
                member: TEST_USER_2.username
            });

            bob.addMemberToChat({
                id: chat.id,
                member: TEST_USER_2.username
            });
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeTruthy();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeTruthy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeTruthy();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_2.username && item.nickname === TEST_USER_2.nickname)).toBeTruthy();

            await bob.deleteChat({id: chat.id});
        });
        it('should delete contact when user deletes a chat', async () => {
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    let eventsCount = 0;
                    const checkEventsAndResolve = () => {
                        if (eventsCount === 2) {
                            resolve();
                        }
                    }
                    const bobHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_1.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        bob.off(SfuEvent.CONTACT_DELETED, bobHandler);
                    }
                    const aliceHandler = (msg) => {
                        const event = msg as ContactDeleted;
                        expect(event.userId).toEqual(TEST_USER_0.username);
                        eventsCount++;
                        checkEventsAndResolve();
                        alice.off(SfuEvent.CONTACT_DELETED, aliceHandler);
                    }
                    bob.on(SfuEvent.CONTACT_DELETED, bobHandler);
                    alice.on(SfuEvent.CONTACT_DELETED, aliceHandler);
                });
            };

            const chat = await bob.createChat({
                members: [TEST_USER_1.username]
            });

            bob.deleteChat({id: chat.id});
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname)).toBeFalsy();

            const aliceContacts = await alice.getContacts();
            expect(aliceContacts.contacts.some((item) => item.userId === TEST_USER_0.username && item.nickname === TEST_USER_0.nickname)).toBeFalsy();
        });
        it('should notify user when contact changes nickname', async () => {
            const CHANGED_NICKNAME = "CHANGED_NICKNAME";
            const waitEvents = async () => {
                return new Promise<void>((resolve) => {
                    const bobHandler = (msg) => {
                        const event = msg as ContactUpdated;
                        expect(event.contact.userId).toEqual(TEST_USER_1.username);
                        expect(event.contact.nickname).toEqual(CHANGED_NICKNAME);
                        bob.off(SfuEvent.CONTACT_UPDATED, bobHandler);
                        resolve();
                    }
                    bob.on(SfuEvent.CONTACT_UPDATED, bobHandler);
                });
            };

            const chat = await bob.createChat({
                members: [TEST_USER_1.username]
            });

            alice.changeUserNickname(CHANGED_NICKNAME);
            await waitEvents();

            const bobContacts = await bob.getContacts();
            expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === CHANGED_NICKNAME)).toBeTruthy();

            await alice.changeUserNickname(TEST_USER_1.nickname);

            await bob.deleteChat({id: chat.id});
        });
        describe("presence status", () => {
            it('user should be notified when contact disconnects', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        let eventsCount = 0;
                        const checkEvents = () => {
                            if (eventsCount === 2) {
                                resolve();
                            }
                        }
                        const bobStatusHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(PresenceStatus.OFFLINE);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobStatusHandler);
                            resolve();
                        }
                        const aliceDisconnectedHandler = (msg) => {
                            alice.off(SfuEvent.DISCONNECTED, aliceDisconnectedHandler);
                            eventsCount++;
                            checkEvents();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobStatusHandler);
                        alice.on(SfuEvent.DISCONNECTED, aliceDisconnectedHandler);
                    });
                };

                const chat = await bob.createChat({
                    members: [TEST_USER_1.username]
                });

                alice.disconnect();
                await waitEvent();


                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.OFFLINE)).toBeTruthy();

                await alice.connect({
                    url: url,
                    ...TEST_USER_1,
                    username: TEST_USER_1.email
                });
                await bob.deleteChat({id: chat.id});
            });
            it('user should be notified when contact connects', async () => {
                const waitEvent = async (status: PresenceStatus, connectionEvent: SfuEvent) => {
                    return new Promise<void>((resolve) => {
                        let eventsCount = 0;
                        const checkEvents = () => {
                            if (eventsCount === 2) {
                                resolve();
                            }
                        }
                        const bobStatusHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(status);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobStatusHandler);
                            eventsCount++;
                            checkEvents();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobStatusHandler);
                        const aliceConnectionHandler = (msg) => {
                            alice.off(connectionEvent, aliceConnectionHandler);
                            eventsCount++;
                            checkEvents();
                        }
                        alice.on(connectionEvent, aliceConnectionHandler);
                    });
                };

                const chat = await bob.createChat({
                    members: [TEST_USER_1.username]
                });

                alice.disconnect();
                await waitEvent(PresenceStatus.OFFLINE, SfuEvent.DISCONNECTED);

                alice.connect({
                    url: url,
                    ...TEST_USER_1,
                    username: TEST_USER_1.email
                });
                await waitEvent(PresenceStatus.ONLINE, SfuEvent.CONNECTED);

                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.ONLINE)).toBeTruthy();

                await bob.deleteChat({id: chat.id});
            });
            it('user should be notified when contact changes status', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        const bobHandler = (msg) => {
                            const event = msg as UserPresenceStatusUpdated;
                            expect(event.userId).toEqual(TEST_USER_1.username);
                            expect(event.status).toEqual(PresenceStatus.IDLE);
                            bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            resolve();
                        }
                        bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                    });
                };

                const chat = await bob.createChat({
                    members: [TEST_USER_1.username]
                });

                alice.updatePresenceStatus(PresenceStatus.IDLE);
                await waitEvent();

                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.IDLE)).toBeTruthy();

                await alice.updatePresenceStatus(PresenceStatus.ONLINE);

                await bob.deleteChat({id: chat.id});
            });
        });
    });
    describe("notifications", () => {
        describe("friends", () => {
            it('should receive incoming friend invite', async () => {
                let inviteId = "";
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        alice.on(SfuEvent.NEW_INCOMING_FRIEND_INVITE, (msg) => {
                            const event = msg as NewFriendInvite;
                            inviteId = event.inviteId;
                            expect(event.userId).toEqual(TEST_USER_0.username);
                            resolve();
                        });
                    });
                }

                bob.addFriend({userId: TEST_USER_1.username});
                await waitEvent();
                await bob.revokeFriendInvite({inviteId: inviteId});
            });
            it('should send friend invite and receive new contact if that user sent friend request earlier.', async () => {
                const waitEvents = async () => {
                    return new Promise<void>((resolve) => {
                        let eventsCount = 0;
                        const checkEventsAndResolve = () => {
                            if (eventsCount === 2) {
                                resolve();
                            }
                        }
                        const bobHandler = (msg) => {
                            const event = msg as NewContact;
                            expect(event.contact.userId).toEqual(TEST_USER_1.username);
                            expect(event.contact.nickname).toEqual(TEST_USER_1.nickname);
                            eventsCount++;
                            checkEventsAndResolve();
                            bob.off(SfuEvent.NEW_CONTACT, bobHandler);
                        }
                        const aliceHandler = (msg) => {
                            const event = msg as NewContact;
                            expect(event.contact.userId).toEqual(TEST_USER_0.username);
                            expect(event.contact.nickname).toEqual(TEST_USER_0.nickname);
                            eventsCount++;
                            checkEventsAndResolve();
                            alice.off(SfuEvent.NEW_CONTACT, aliceHandler);
                        }
                        bob.on(SfuEvent.NEW_CONTACT, bobHandler);
                        alice.on(SfuEvent.NEW_CONTACT, aliceHandler);
                    });
                };

                await alice.addFriend({userId: TEST_USER_0.username});
                const bobContacts = await bob.getContacts();
                expect(bobContacts.incomingFriendInvites.some((invite) => invite.userId === TEST_USER_1.username)).toBeTruthy();

                bob.addFriend({userId: TEST_USER_1.username});
                await waitEvents();

                await bob.removeFriend({userId: TEST_USER_1.username});
            });
            it('user should be notified when second user revokes invite', async () => {
                const waitEvent = async (inviteId: string) => {
                    return new Promise<void>((resolve) => {
                        alice.on(SfuEvent.INCOMING_FRIEND_INVITE_DELETED, (msg) => {
                            const event = msg as FriendInviteDeleted;
                            expect(event.inviteId).toEqual(inviteId);
                            resolve();
                        });
                    });
                }

                await bob.addFriend({userId: TEST_USER_1.username});
                const bobContacts = await bob.getContacts();
                expect(bobContacts.outgoingFriendInvites.length).toBe(1);
                const outgoingInvite = bobContacts.outgoingFriendInvites[0];
                bob.revokeFriendInvite({inviteId: outgoingInvite.inviteId});
                await waitEvent(outgoingInvite.inviteId);
            });
            it('user should be notified when second user accepts invite', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        bob.on(SfuEvent.NEW_CONTACT, (msg) => {
                            const event = msg as NewContact;
                            expect(event.contact.userId).toEqual(TEST_USER_1.username);
                            expect(event.contact.nickname).toEqual(TEST_USER_1.nickname);
                            resolve();
                        });
                    });
                }

                await bob.addFriend({userId: TEST_USER_1.username});

                const aliceContacts = await alice.getContacts();
                expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                const incomingInvite = aliceContacts.incomingFriendInvites[0];
                alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})
                await waitEvent();
                await bob.removeFriend({userId: TEST_USER_1.username});
            });
            it('user should receive event when second user removes friend', async () => {
                const waitEvent = async () => {
                    return new Promise<void>((resolve) => {
                        alice.on(SfuEvent.CONTACT_DELETED, (msg) => {
                            const event = msg as ContactDeleted;
                            expect(event.userId).toEqual(TEST_USER_0.username);
                            resolve();
                        });
                    });
                }

                await bob.addFriend({userId: TEST_USER_1.username});
                const aliceContacts = await alice.getContacts();
                expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                const incomingInvite = aliceContacts.incomingFriendInvites[0];
                await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})
                bob.removeFriend({userId: TEST_USER_1.username});
                await waitEvent();
            });
            it('should notify user when friend changes nickname', async () => {
                const CHANGED_NICKNAME = "CHANGED_NICKNAME";
                const waitEvents = async () => {
                    return new Promise<void>((resolve) => {
                        const bobHandler = (msg) => {
                            const event = msg as ContactUpdated;
                            expect(event.contact.userId).toEqual(TEST_USER_1.username);
                            expect(event.contact.nickname).toEqual(CHANGED_NICKNAME);
                            bob.off(SfuEvent.CONTACT_UPDATED, bobHandler);
                            resolve();
                        }
                        bob.on(SfuEvent.CONTACT_UPDATED, bobHandler);
                    });
                };

                await bob.addFriend({userId: TEST_USER_1.username});
                const aliceContacts = await alice.getContacts();
                expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                const incomingInvite = aliceContacts.incomingFriendInvites[0];
                await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})

                alice.changeUserNickname(CHANGED_NICKNAME);
                await waitEvents();

                const bobContacts = await bob.getContacts();
                expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === CHANGED_NICKNAME)).toBeTruthy();

                await alice.changeUserNickname(TEST_USER_1.nickname);

                await bob.removeFriend({userId: TEST_USER_1.username});
            });
            describe("presence status", () => {
                it('user should be notified when friend disconnects', async () => {
                    const waitEvent = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkEvents = () => {
                                if (eventsCount === 2) {
                                    resolve();
                                }
                            }
                            const bobHandler = (msg) => {
                                const event = msg as UserPresenceStatusUpdated;
                                expect(event.userId).toEqual(TEST_USER_1.username);
                                expect(event.status).toEqual(PresenceStatus.OFFLINE);
                                bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                                resolve();
                            }
                            bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            const aliceDisconnectedHandler = () => {
                                alice.off(SfuEvent.DISCONNECTED, aliceDisconnectedHandler);
                                eventsCount++;
                                checkEvents();
                            }
                            alice.on(SfuEvent.DISCONNECTED, aliceDisconnectedHandler);
                        });
                    };

                    await bob.addFriend({userId: TEST_USER_1.username});
                    const aliceContacts = await alice.getContacts();
                    expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                    const incomingInvite = aliceContacts.incomingFriendInvites[0];
                    await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})

                    alice.disconnect();
                    await waitEvent();


                    const bobContacts = await bob.getContacts();
                    expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.OFFLINE)).toBeTruthy();

                    await alice.connect({
                        url: url,
                        ...TEST_USER_1,
                        username: TEST_USER_1.email
                    });
                    await bob.removeFriend({userId: TEST_USER_1.username});
                });
                it('user should be notified when friend connects', async () => {
                    const waitEvent = async (status: PresenceStatus, connectionEvent: SfuEvent) => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkEvents = () => {
                                if (eventsCount === 2) {
                                    resolve();
                                }
                            }
                            const bobHandler = (msg) => {
                                const event = msg as UserPresenceStatusUpdated;
                                expect(event.userId).toEqual(TEST_USER_1.username);
                                expect(event.status).toEqual(status);
                                bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                                eventsCount++;
                                checkEvents();
                            }
                            bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                            const aliceConnectionHandler = () => {
                                alice.off(connectionEvent, aliceConnectionHandler);
                                eventsCount++;
                                checkEvents();
                            }
                            alice.on(connectionEvent, aliceConnectionHandler);
                        });
                    };

                    await bob.addFriend({userId: TEST_USER_1.username});
                    const aliceContacts = await alice.getContacts();
                    expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                    const incomingInvite = aliceContacts.incomingFriendInvites[0];
                    await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})

                    alice.disconnect();
                    await waitEvent(PresenceStatus.OFFLINE, SfuEvent.DISCONNECTED);
                    alice.connect({
                        url: url,
                        ...TEST_USER_1,
                        username: TEST_USER_1.email
                    });
                    await waitEvent(PresenceStatus.ONLINE, SfuEvent.CONNECTED);

                    const bobContacts = await bob.getContacts();
                    expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.ONLINE)).toBeTruthy();

                    await bob.removeFriend({userId: TEST_USER_1.username});
                });
                it('user should be notified when friend changes status', async () => {
                    const waitEvent = async () => {
                        return new Promise<void>((resolve) => {
                            const bobHandler = (msg) => {
                                const event = msg as UserPresenceStatusUpdated;
                                expect(event.userId).toEqual(TEST_USER_1.username);
                                expect(event.status).toEqual(PresenceStatus.IDLE);
                                bob.off(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                                resolve();
                            }
                            bob.on(SfuEvent.USER_PRESENCE_STATUS_UPDATED, bobHandler);
                        });
                    };

                    await bob.addFriend({userId: TEST_USER_1.username});
                    const aliceContacts = await alice.getContacts();
                    expect(aliceContacts.incomingFriendInvites.length).toBe(1);
                    const incomingInvite = aliceContacts.incomingFriendInvites[0];
                    await alice.acceptFriendInvite({inviteId: incomingInvite.inviteId})

                    alice.updatePresenceStatus(PresenceStatus.IDLE);
                    await waitEvent();

                    const bobContacts = await bob.getContacts();
                    expect(bobContacts.contacts.some((item) => item.userId === TEST_USER_1.username && item.nickname === TEST_USER_1.nickname && item.status === PresenceStatus.IDLE)).toBeTruthy();

                    await alice.updatePresenceStatus(PresenceStatus.ONLINE);

                    await bob.removeFriend({userId: TEST_USER_1.username});
                });
            });
        });
    });
});
