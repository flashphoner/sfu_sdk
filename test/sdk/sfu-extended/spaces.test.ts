import {SfuExtended, SpaceEvent} from "../../../src";
import {connect, waitForUsers} from "../../util/utils";
import {
    ALLOWS_TO_MANAGE_CATEGORIES,
    ALLOWS_TO_MANAGE_CHANNELS,
    ALLOWS_TO_MANAGE_ROLES,
    ALLOWS_TO_MANAGE_SPACE,
    DEFAULT_CATEGORY_NAME,
    DEFAULT_CHANNEL_NAME,
    TEST_CATEGORY_NAME,
    TEST_CHANNEL_NAME,
    TEST_SPACE_NAME,
    TEST_SPACE_ROLE,
    TEST_SPACE_ROLE_NAME,
    TEST_THREAD_NAME,
    TEST_USER_0,
    TEST_USER_1,
    TEST_USER_2,
    DEFAULT_ROLE_ID,
    NAME_OF_DEFAULT_ROLE,
    ALLOWS_TO_VIEW_CHANNELS,
    ALLOWS_TO_CREATE_INVITE,
} from "../../util/constants";
import {
    AddedRoleToMember,
    Message,
    MessageTargetEntityType,
    NewSpaceCategoryEvent,
    NewSpaceChannelEvent,
    NewSpaceRoleAdded,
    SpaceCategoryDeleted,
    SpaceCategoryUpdated,
    SpaceChannelDeleted,
    SpaceChannelUpdated,
    SpaceDeletedEvent,
    SpaceError,
    SpaceOverviewUpdated,
    SpaceRoleDeleted,
    SpaceRoleUpdated,
    UserJoinedToSpaceEvent,
    UserLeftSpace,
    SfuEvent,
    ConferenceType,
} from "../../../src/sdk/constants";

describe("spaces", () => {
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
    describe("space", () => {
        it('should create space', async () => {
            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            expect(space.name).toEqual(TEST_SPACE_NAME);
            expect(space.owner).toEqual(TEST_USER_0.username);
            expect(space.createdAt).toBeGreaterThan(0);
            expect(space.members[0]).toBeTruthy();
            expect(space.members[0].userId).toEqual(TEST_USER_0.username);
            expect(space.roles[0].id).toEqual(DEFAULT_ROLE_ID);
            expect(space.roles[0].name).toEqual(NAME_OF_DEFAULT_ROLE);
            expect(space.roles[0].permissions).toContain(ALLOWS_TO_VIEW_CHANNELS);
            expect(space.roles[0].permissions).toContain(ALLOWS_TO_CREATE_INVITE);
            expect(space.categories[0]).toBeTruthy();
            expect(space.categories[0].name).toEqual(DEFAULT_CATEGORY_NAME);
            expect(space.channels[0]).toBeTruthy();
            expect(space.channels[0].name).toEqual(DEFAULT_CHANNEL_NAME);
            expect(space.channels[0].private).toBe(false);
            expect(space.channels[0].categoryId).toEqual(space.categories[0].id);
            expect(space.channels[0].members[0]).toEqual(TEST_USER_0.username);
            await bob.deleteSpace({id: space.id});
        });
        it('should update space', async () => {
            const UPDATED_SPACE_NAME = "UPDATED_SPACE_NAME";
            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            await bob.updateSpaceOverview({
                id: space.id,
                name: UPDATED_SPACE_NAME
            });
            const spaces = await bob.getUserSpaces();
            const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
            expect(spaceAfterUpdate).toBeTruthy();
            expect(spaceAfterUpdate.name).toEqual(UPDATED_SPACE_NAME);
            await bob.deleteSpace({id: space.id});
        });
        it('should delete space', async () => {
            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            let spaces = await bob.getUserSpaces();
            const spaceBeforeDelete = spaces.find((userSpace) => userSpace.id === space.id);
            expect(spaceBeforeDelete).toBeTruthy();
            await bob.deleteSpace({id: space.id});
            spaces = await bob.getUserSpaces();
            const spaceAfterDelete = spaces.find((userSpace) => userSpace.id === space.id);
            expect(spaceAfterDelete).toBeFalsy();
        });
        it('should generate invite', async () => {
            const lifespan = 10000;
            const space = await bob.createSpace({name: TEST_SPACE_NAME});
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan})

            expect(invite.inviteCode).toBeTruthy();
            expect(invite.createdAt).toBeGreaterThan(0);
            expect(invite.expiresAt).toBe(invite.createdAt + lifespan);

            await bob.deleteSpace({id: space.id});
        });
        describe("category", () => {
            it('should create category', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });
                expect(category.name).toEqual(TEST_CATEGORY_NAME);
                expect(category.creator).toEqual(TEST_USER_0.username);
                expect(category.createdAt).toBeGreaterThan(0);
                await bob.deleteSpace({id: space.id});
            });
            it('should update category', async () => {
                const UPDATED_CATEGORY_NAME = "UPDATED_CATEGORY_NAME";
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });
                expect(category.name).toEqual(TEST_CATEGORY_NAME);
                await bob.updateSpaceCategory({
                    spaceId: space.id,
                    categoryId: category.id,
                    name: UPDATED_CATEGORY_NAME
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const updatedCategory = spaceAfterUpdate.categories.find((currentCategory) => currentCategory.id === category.id);
                expect(updatedCategory).toBeTruthy();
                expect(updatedCategory.id).toEqual(category.id);
                expect(updatedCategory.name).toEqual(UPDATED_CATEGORY_NAME);
                await bob.deleteSpace({id: space.id});
            });
            it('should delete category', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });

                await bob.deleteSpaceCategory({
                    spaceId: space.id,
                    categoryId: category.id
                });
                const spaces = await bob.getUserSpaces();
                const userSpace = spaces.find((item) => item.id === space.id);
                expect(userSpace).toBeTruthy();
                const deletedCategory = userSpace.categories.find((currentCategory) => currentCategory.id === category.id);
                expect(deletedCategory).toBeFalsy();
                await bob.deleteSpace({id: space.id});
            });
        });
        describe("channel", () => {
            it('should create a public channel no category', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                expect(channel.name).toEqual(TEST_CHANNEL_NAME);
                expect(channel.private).toBe(false);
                expect(channel.categoryId).toBeFalsy();
                expect(channel.creator).toEqual(TEST_USER_0.username);
                expect(channel.createdAt).toBeGreaterThan(0);
                expect(channel.members.length).toBe(1);
                await bob.deleteSpace({id: space.id});
            });
            it('should update a public channel and do private', async () => {
                const UPDATED_CHANNEL_NAME = "UPDATED_CHANNEL_NAME";
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                await bob.updateSpaceChannel({
                    spaceId: space.id,
                    channelId: channel.id,
                    name: UPDATED_CHANNEL_NAME,
                    isPrivate: true
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const updatedChannel = spaceAfterUpdate.channels.find((currentChannel) => currentChannel.id === channel.id);
                expect(updatedChannel).toBeTruthy();
                expect(updatedChannel.name).toEqual(UPDATED_CHANNEL_NAME);
                expect(updatedChannel.private).toBe(true);
                await bob.deleteSpace({id: space.id});
            });
            it('should create a public channel in category', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    categoryId: category.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                expect(channel.categoryId).toEqual(category.id);
                expect(channel.name).toEqual(TEST_CHANNEL_NAME);
                expect(channel.private).toBe(false);
                expect(channel.categoryId).toEqual(category.id);
                expect(channel.creator).toEqual(TEST_USER_0.username);
                expect(channel.createdAt).toBeGreaterThan(0);
                expect(channel.members.length).toBe(1);
                await bob.deleteSpace({id: space.id});
            });
            it('should move channel from category when deleting category', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    categoryId: category.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                await bob.deleteSpaceCategory({
                    spaceId: space.id,
                    categoryId: category.id
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const channelAfterUpdate = spaceAfterUpdate.channels.find((currentChannel) => currentChannel.id === channel.id);
                expect(channelAfterUpdate).toBeTruthy();
                expect(channelAfterUpdate.categoryId).toBeFalsy();
                await bob.deleteSpace({id: space.id});
            });
            it('should move channel between categories', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const category1 = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME
                });
                const category2 = await bob.createSpaceCategory({
                    spaceId: space.id,
                    name: TEST_CATEGORY_NAME + "2"
                });
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    categoryId: category1.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                await bob.moveSpaceChannel({
                    spaceId: space.id,
                    categoryId: category2.id,
                    channelId: channel.id,
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const channelAfterUpdate = spaceAfterUpdate.channels.find((currentChannel) => currentChannel.id === channel.id);
                expect(channelAfterUpdate).toBeTruthy();
                expect(channelAfterUpdate.categoryId).toEqual(category2.id);
                await bob.deleteSpace({id: space.id});
            });
        });
        describe("thread", () => {
            it('should create a thread', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                const thread = await bob.createSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    name: TEST_THREAD_NAME,
                    isPrivate: false
                });
                expect(thread.name).toEqual(TEST_THREAD_NAME);
                expect(thread.createdAt).toBeGreaterThan(0);
                expect(thread.members.length).toBe(1);
                expect(thread.members).toContain(TEST_USER_0.username);
                expect(thread.creator).toEqual(TEST_USER_0.username);
                await bob.deleteSpace({id: space.id});
            });
            it('should update thread', async () => {
                const UPDATED_THREAD_NAME = "UPDATED_THREAD_NAME";
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                let channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                const thread = await bob.createSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    name: TEST_THREAD_NAME,
                    isPrivate: false
                });
                await bob.updateSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    threadId: thread.id,
                    name: UPDATED_THREAD_NAME
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const channelWithUpdatedThread = spaceAfterUpdate.channels.find((currentChannel) => currentChannel.id === channel.id);
                expect(channelWithUpdatedThread).toBeTruthy();
                const updatedThread = channelWithUpdatedThread.threads.find((currentThread) => currentThread.id === thread.id);
                expect(updatedThread).toBeTruthy();
                expect(updatedThread.name).toEqual(UPDATED_THREAD_NAME);
                await bob.deleteSpace({id: space.id});
            });
            it('should delete thread', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                let channel = await bob.createSpaceChannel({
                    spaceId: space.id,
                    name: TEST_CHANNEL_NAME,
                    isPrivate: false
                });
                const thread = await bob.createSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    name: TEST_THREAD_NAME,
                    isPrivate: false
                });
                await bob.deleteSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    threadId: thread.id,
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const channelWithUpdatedThread = spaceAfterUpdate.channels.find((currentChannel) => currentChannel.id === channel.id);
                expect(channelWithUpdatedThread).toBeTruthy();
                const deletedThread = channelWithUpdatedThread.threads.find((currentThread) => currentThread.id === thread.id);
                expect(deletedThread).toBeFalsy();
                await bob.deleteSpace({id: space.id});
            });
        });
        describe("role", () => {
            it('should add space role', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const role = await bob.addSpaceRole({
                    ...TEST_SPACE_ROLE,
                    spaceId: space.id
                });
                expect(role.name).toEqual(TEST_SPACE_ROLE_NAME);
                expect(role.permissions.length).toBe(2);
                expect(role.permissions).toContain(ALLOWS_TO_MANAGE_CATEGORIES);
                expect(role.permissions).toContain(ALLOWS_TO_MANAGE_CHANNELS);
                await bob.deleteSpace({id: space.id});
            });
            it('should update space role', async () => {
                const UPDATED_ROLE_NAME = "UPDATED_ROLE_NAME";
                const UPDATED_ROLE_COLOR = "UPDATED_COLOR";
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const role = await bob.addSpaceRole({
                    ...TEST_SPACE_ROLE,
                    spaceId: space.id
                });

                await bob.updateSpaceRole({
                    spaceId: space.id,
                    roleId: role.id,
                    name: UPDATED_ROLE_NAME,
                    color: UPDATED_ROLE_COLOR,
                    permissions: [ALLOWS_TO_MANAGE_CHANNELS],
                    members: []
                });
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const updatedRole = spaceAfterUpdate.roles.find((currentRole) => currentRole.id === role.id);
                expect(updatedRole).toBeTruthy();
                expect(updatedRole.name).toEqual(UPDATED_ROLE_NAME);
                expect(updatedRole.color).toEqual(UPDATED_ROLE_COLOR);
                expect(updatedRole.permissions.length).toBe(1);
                expect(updatedRole.permissions).toContain(ALLOWS_TO_MANAGE_CHANNELS);
                await bob.deleteSpace({id: space.id});
            });
            it('should delete space role', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const role = await bob.addSpaceRole({
                    ...TEST_SPACE_ROLE,
                    spaceId: space.id
                });
                await bob.deleteSpaceRole({
                    spaceId: space.id,
                    roleId: role.id
                })
                const spaces = await bob.getUserSpaces();
                const spaceAfterUpdate = spaces.find((userSpace) => userSpace.id === space.id);
                expect(spaceAfterUpdate).toBeTruthy();
                const deletedRole = spaceAfterUpdate.roles.find((currentRole) => currentRole.id === role.id);
                expect(deletedRole).toBeFalsy();
                await bob.deleteSpace({id: space.id});
            });
        });
        describe("messages", () => {
            it('should send channel message', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                expect(channel).toBeTruthy();
                const msg = await bob.sendMessage({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    body: "body"
                });
                const messages = await bob.loadMessages({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                expect(messages.length).toBe(1);
                expect(messages[0].id).toEqual(msg.id);
                await bob.deleteSpace({id: space.id});
            });
            it('should send thread message', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                expect(channel).toBeTruthy();
                const thread = await bob.createSpaceThread({
                    spaceId: space.id,
                    channelId: channel.id,
                    name: TEST_THREAD_NAME,
                    isPrivate: false
                });
                expect(thread).toBeTruthy();
                const msg = await bob.sendMessage({
                    targetEntityType: MessageTargetEntityType.THREAD,
                    targetEntityId: {spaceId: space.id, channelId: channel.id, threadId: thread.id},
                    body: "body"
                });
                const messages = await bob.loadMessages({
                    targetEntityType: MessageTargetEntityType.THREAD,
                    targetEntityId: {spaceId: space.id, channelId: channel.id, threadId: thread.id},
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                expect(messages.length).toBe(1);
                expect(messages[0].id).toEqual(msg.id);
                await bob.deleteSpace({id: space.id});
            });
            it('should edit message', async () => {
                const EDITED_BODY = "EDITED_BODY";
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                expect(channel).toBeTruthy();
                const msg = await bob.sendMessage({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    body: "body"
                });
                let messages = await bob.loadMessages({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                expect(messages.length).toBe(1);
                expect(messages[0].id).toEqual(msg.id);
                await bob.editMessage({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    messageId: msg.id,
                    body: EDITED_BODY
                });
                messages = await bob.loadMessages({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    timeFrame: {
                        start: 0,
                        end: -1
                    }
                });
                expect(messages.length).toBe(1);
                expect(messages[0].id).toEqual(msg.id);
                expect(messages[0].body).toEqual(EDITED_BODY);
                await bob.deleteSpace({id: space.id});
            });
            it('should delete message', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                expect(channel).toBeTruthy();
                const msg = await bob.sendMessage({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    body: "body"
                });
                await bob.deleteMessage({
                    targetEntityType: MessageTargetEntityType.CHANNEL,
                    targetEntityId: {spaceId: space.id, channelId: channel.id},
                    messageId: msg.id
                });
                await bob.deleteSpace({id: space.id});
            });
        });
        describe("participants", () => {
            let kiri: SfuExtended;
            beforeEach(async () => {
               kiri = await connect(TEST_USER_2);
            });
            afterEach(async () => {
               await kiri.disconnect();
            });
            it('should join space by invite', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                await alice.joinSpaceByInviteCode(invite.inviteCode);

                await bob.deleteSpace({id: space.id});
            });
            it('should receive error when member is joining space second time', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                await alice.joinSpaceByInviteCode(invite.inviteCode);

                await expect(alice.joinSpaceByInviteCode(invite.inviteCode)).rejects.toHaveProperty("error", SpaceError.USER_ALREADY_JOINED);
                await bob.deleteSpace({id: space.id});
            });
            it('should leave space', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                await alice.joinSpaceByInviteCode(invite.inviteCode);
                const waitLeftEvent = async () => {
                    return new Promise<void>((resolve) => {
                        bob.on(SpaceEvent.USER_LEFT_SPACE, (msg) => {
                            const event = msg as UserLeftSpace;
                            expect(event.spaceId).toEqual(space.id);
                            if (event.userId === alice.user().username) {
                                resolve();
                            }
                        });
                    })
                };
                alice.leaveSpace({id: space.id});
                await waitLeftEvent();
                await bob.deleteSpace({id: space.id});
            });
            describe("notifications", () => {
                it('should receive event when user joined', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    const waitEvent = async () => {
                        return new Promise<void>((resolve) => {
                            bob.on(SpaceEvent.USER_JOINED_TO_SPACE, (msg) => {
                                const event = msg as UserJoinedToSpaceEvent;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.userId === TEST_USER_1.username) {
                                    resolve();
                                }
                            });
                        })
                    };
                    alice.joinSpaceByInviteCode(invite.inviteCode);
                    await waitEvent();
                    await bob.deleteSpace({id: space.id});
                });
                it('should receive event when user left space', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const waitEvent = async () => {
                        return new Promise<void>((resolve) => {
                            bob.on(SpaceEvent.USER_LEFT_SPACE, (msg) => {
                                const event = msg as UserLeftSpace;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.userId === TEST_USER_1.username) {
                                    resolve();
                                }
                            });
                        })
                    };
                    alice.leaveSpace({
                        id: space.id
                    });
                    await waitEvent();
                    await bob.deleteSpace({id: space.id});
                });
                it('should receive event when owner deleting space', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const waitEvent = async () => {
                        return new Promise<void>((resolve) => {
                            alice.on(SpaceEvent.SPACE_DELETED, (msg) => {
                                const event = msg as SpaceDeletedEvent;
                                if (event.id === space.id) {
                                    resolve();
                                }
                            });
                        })
                    };
                    bob.deleteSpace({id: space.id});
                    await waitEvent();
                });
                it('should receive event when creating role', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkEvent = (msg) => {
                                const event = msg as NewSpaceRoleAdded;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.role.name === TEST_SPACE_ROLE_NAME) {
                                    eventsCount++;
                                }
                            };
                            const alicNewRoleHandler = (msg) => {
                                checkEvent(msg);
                                alice.off(SpaceEvent.NEW_SPACE_ROLE, alicNewRoleHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            const kiriNewRoleHandler = (msg) => {
                                checkEvent(msg);
                                kiri.off(SpaceEvent.NEW_SPACE_ROLE, kiriNewRoleHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            alice.on(SpaceEvent.NEW_SPACE_ROLE, alicNewRoleHandler);
                            kiri.on(SpaceEvent.NEW_SPACE_ROLE, kiriNewRoleHandler);
                        })
                    };
                    bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        members: []
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                it('should receive event when updating role', async () => {
                    const UPDATED_ROLE_NAME = "UPDATED_ROLE_NAME";
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        members: [alice.user().username]
                    });

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkEvent = (msg) => {
                                const event = msg as SpaceRoleUpdated;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.roleId === role.id && event.name === UPDATED_ROLE_NAME && event.membersForAddRole.includes(kiri.user().username) && event.membersForDeleteRole.includes(alice.user().username)) {
                                    eventsCount++;
                                }
                            };
                            const aliceRoleUpdatedHandler = (msg) => {
                                checkEvent(msg);
                                alice.off(SpaceEvent.SPACE_ROLE_UPDATED, aliceRoleUpdatedHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            const kiriRoleUpdatedHandler = (msg) => {
                                checkEvent(msg);
                                kiri.off(SpaceEvent.SPACE_ROLE_UPDATED, kiriRoleUpdatedHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            alice.on(SpaceEvent.SPACE_ROLE_UPDATED, aliceRoleUpdatedHandler);
                            kiri.on(SpaceEvent.SPACE_ROLE_UPDATED, kiriRoleUpdatedHandler);
                        })
                    };

                    bob.updateSpaceRole({
                        spaceId: space.id,
                        roleId: role.id,
                        name: UPDATED_ROLE_NAME,
                        color: role.color,
                        permissions: role.permissions,
                        members: [kiri.user().username]
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                it('should receive event when deleting role', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        members: [alice.user().username, kiri.user().username]
                    });

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkEvent = (msg) => {
                                const event = msg as SpaceRoleDeleted;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.roleId === role.id) {
                                    eventsCount++;
                                }
                            };
                            const aliceRoleDeletedHandler = (msg) => {
                                checkEvent(msg);
                                alice.off(SpaceEvent.SPACE_ROLE_DELETED, aliceRoleDeletedHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            const kiriRoleDeletedHandler = (msg) => {
                                checkEvent(msg);
                                kiri.off(SpaceEvent.SPACE_ROLE_DELETED, kiriRoleDeletedHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            alice.on(SpaceEvent.SPACE_ROLE_DELETED, aliceRoleDeletedHandler);
                            kiri.on(SpaceEvent.SPACE_ROLE_DELETED, kiriRoleDeletedHandler);
                        })
                    };

                    bob.deleteSpaceRole({
                        spaceId: space.id,
                        roleId: role.id,
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                it('owner should update role that contains in channel access rights', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        permissions: [ALLOWS_TO_MANAGE_ROLES],
                        members: [alice.user().username]
                    });
                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: true,
                        roles: [role.id]
                    });

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const channelDeletedHandler = (msg) => {
                                const event = msg as SpaceChannelDeleted;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.channelId === channel.id) {
                                    eventsCount++;
                                }
                                alice.off(SpaceEvent.SPACE_CHANNEL_DELETED, channelDeletedHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            const newChannelHandler = (msg) => {
                                const event = msg as NewSpaceChannelEvent;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.channel.id === channel.id) {
                                    eventsCount++;
                                }
                                kiri.off(SpaceEvent.NEW_SPACE_CHANNEL, newChannelHandler);
                                if (eventsCount == 2) {
                                    resolve();
                                }
                            };
                            alice.on(SpaceEvent.SPACE_CHANNEL_DELETED, channelDeletedHandler);
                            kiri.on(SpaceEvent.NEW_SPACE_CHANNEL, newChannelHandler);
                        })
                    };

                    bob.updateSpaceRole({
                        spaceId: space.id,
                        roleId: role.id,
                        name: role.name,
                        color: role.color,
                        permissions: role.permissions,
                        members: [kiri.user().username]
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                it('should add role to member and user should receive new channel event', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        members: []
                    });

                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: true,
                        roles: [role.id]
                    });

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkAndResolve = () => {
                                if (eventsCount === 2) {
                                    resolve();
                                }
                            }
                            const addedRoleToMemberHandler = (msg) => {
                                const event = msg as AddedRoleToMember;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.roleId === role.id) {
                                    eventsCount++;
                                }
                                alice.off(SpaceEvent.ADDED_ROLE_TO_MEMBER, addedRoleToMemberHandler);
                                checkAndResolve();
                            };
                            const newChannelHandler = (msg) => {
                                const event = msg as NewSpaceChannelEvent;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.channel.id === channel.id) {
                                    eventsCount++;
                                }
                                alice.off(SpaceEvent.NEW_SPACE_CHANNEL, newChannelHandler);
                                checkAndResolve();
                            }

                            alice.on(SpaceEvent.ADDED_ROLE_TO_MEMBER, addedRoleToMemberHandler);
                            alice.on(SpaceEvent.NEW_SPACE_CHANNEL, newChannelHandler);
                        })
                    };

                    bob.addRoleToMember({
                        spaceId: space.id,
                        roleId: role.id,
                        memberId: alice.user().username
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                it('should add role to member and user should receive channel deleted event', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id,
                        members: [alice.user().username]
                    });

                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: true,
                        roles: [role.id]
                    });

                    const waitEvents = async () => {
                        return new Promise<void>((resolve) => {
                            let eventsCount = 0;
                            const checkAndResolve = () => {
                                if (eventsCount === 2) {
                                    resolve();
                                }
                            }
                            const removedRoleFromMemberHandler = (msg) => {
                                const event = msg as AddedRoleToMember;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.roleId === role.id) {
                                    eventsCount++;
                                }
                                alice.off(SpaceEvent.REMOVED_ROLE_FROM_MEMBER, removedRoleFromMemberHandler);
                                checkAndResolve();
                            };
                            const deletedChannelHandler = (msg) => {
                                const event = msg as SpaceChannelDeleted;
                                expect(event.spaceId).toEqual(space.id);
                                if (event.channelId === channel.id) {
                                    eventsCount++;
                                }
                                alice.off(SpaceEvent.NEW_SPACE_CHANNEL, deletedChannelHandler);
                                checkAndResolve();
                            }

                            alice.on(SpaceEvent.REMOVED_ROLE_FROM_MEMBER, removedRoleFromMemberHandler);
                            alice.on(SpaceEvent.SPACE_CHANNEL_DELETED, deletedChannelHandler);
                        })
                    };

                    bob.removeRoleFromMember({
                        spaceId: space.id,
                        roleId: role.id,
                        memberId: alice.user().username
                    });
                    await waitEvents();
                    await bob.deleteSpace({id: space.id});
                });
                describe("permissions", () => {
                    it('member with permission should update space', async () => {
                        const UPDATED_SPACE_NAME = "UPDATED_SPACE_NAME";
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            permissions: [ALLOWS_TO_MANAGE_SPACE],
                            members: [alice.user().username]
                        });

                        const waitEvent = async () => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_OVERVIEW_UPDATED, (msg) => {
                                    const event = msg as SpaceOverviewUpdated;
                                    expect(event.id).toEqual(space.id);
                                    if (event.name === UPDATED_SPACE_NAME) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.updateSpaceOverview({
                            id: space.id,
                            name: UPDATED_SPACE_NAME
                        });
                        await waitEvent();
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should create category', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const waitEvent = async () => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.NEW_SPACE_CATEGORY, (msg) => {
                                    const event = msg as NewSpaceCategoryEvent;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.category.creator === alice.user().username) {
                                        resolve();
                                    }
                                });
                            })
                        };

                        alice.createSpaceCategory({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME
                        });
                        await waitEvent();
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should update category', async () => {
                        const UPDATED_CATEGORY_NAME = "UPDATED_CATEGORY_NAME";
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const category = await bob.createSpaceCategory({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME
                        });
                        const waitEvent = async (categoryId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_CATEGORY_UPDATED, (msg) => {
                                    const event = msg as SpaceCategoryUpdated;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.categoryId === categoryId && event.name === UPDATED_CATEGORY_NAME) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.updateSpaceCategory({
                            spaceId: space.id,
                            categoryId: category.id,
                            name: UPDATED_CATEGORY_NAME
                        })
                        await waitEvent(category.id);
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should delete category', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const category = await bob.createSpaceCategory({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME
                        });
                        const waitEvent = async (categoryId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_CATEGORY_DELETED, (msg) => {
                                    const event = msg as SpaceCategoryDeleted;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.categoryId === categoryId) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.deleteSpaceCategory({
                            spaceId: space.id,
                            categoryId: category.id,
                        })
                        await waitEvent(category.id);
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should create channel', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const waitEvent = async () => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.NEW_SPACE_CHANNEL, (msg) => {
                                    const event = msg as NewSpaceChannelEvent;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.channel.creator === alice.user().username) {
                                        resolve();
                                    }
                                });
                            })
                        };

                        alice.createSpaceChannel({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME,
                            isPrivate: false
                        });
                        await waitEvent();
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should update channel', async () => {
                        const UPDATED_CHANNEL_NAME = "UPDATED_CHANNEL_NAME";
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const channel = await bob.createSpaceChannel({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME,
                            isPrivate: false
                        });
                        const waitEvent = async (channelId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_CHANNEL_UPDATED, (msg) => {
                                    const event = msg as SpaceChannelUpdated;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.channelId === channelId && event.name === UPDATED_CHANNEL_NAME) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.updateSpaceChannel({
                            spaceId: space.id,
                            channelId: channel.id,
                            name: UPDATED_CHANNEL_NAME,
                            isPrivate: channel.private
                        })
                        await waitEvent(channel.id);
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should delete channel', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: [alice.user().username]
                        });

                        const channel = await bob.createSpaceChannel({
                            spaceId: space.id,
                            name: TEST_CATEGORY_NAME,
                            isPrivate: false
                        });
                        const waitEvent = async (channelId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_CHANNEL_DELETED, (msg) => {
                                    const event = msg as SpaceChannelDeleted;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.channelId === channelId) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.deleteSpaceChannel({
                            spaceId: space.id,
                            channelId: channel.id,
                        })
                        await waitEvent(channel.id);
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should add role', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            permissions: [ALLOWS_TO_MANAGE_ROLES],
                            members: [alice.user().username]
                        });

                        const waitEvent = async () => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.NEW_SPACE_ROLE, (msg) => {
                                    const event = msg as NewSpaceRoleAdded;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.role.name === TEST_SPACE_ROLE_NAME) {
                                        resolve();
                                    }
                                });
                            })
                        };

                        alice.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: []
                        });
                        await waitEvent();
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should update role', async () => {
                        const UPDATED_ROLE_NAME = "UPDATED_ROLE_NAME";
                        const UPDATED_ROLE_COLOR = "UPDATED_COLOR";
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            permissions: [ALLOWS_TO_MANAGE_ROLES],
                            members: [alice.user().username]
                        });

                        const role = await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: []
                        });
                        const waitEvent = async (roleId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_ROLE_UPDATED, (msg) => {
                                    const event = msg as SpaceRoleUpdated;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.roleId === roleId && event.name === UPDATED_ROLE_NAME && event.color === UPDATED_ROLE_COLOR) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.updateSpaceRole({
                            spaceId: space.id,
                            roleId: role.id,
                            name: UPDATED_ROLE_NAME,
                            color: UPDATED_ROLE_COLOR,
                            permissions: role.permissions,
                            members: []
                        })
                        await waitEvent(role.id);
                        await bob.deleteSpace({id: space.id});
                    });
                    it('member with permission should delete role', async () => {
                        const space = await bob.createSpace({name: TEST_SPACE_NAME});
                        const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                        await alice.joinSpaceByInviteCode(invite.inviteCode);

                        await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            permissions: [ALLOWS_TO_MANAGE_ROLES],
                            members: [alice.user().username]
                        });

                        const role = await bob.addSpaceRole({
                            ...TEST_SPACE_ROLE,
                            spaceId: space.id,
                            members: []
                        });
                        const waitEvent = async (roleId: string) => {
                            return new Promise<void>((resolve) => {
                                bob.on(SpaceEvent.SPACE_ROLE_DELETED, (msg) => {
                                    const event = msg as SpaceRoleDeleted;
                                    expect(event.spaceId).toEqual(space.id);
                                    if (event.roleId === roleId) {
                                        resolve();
                                    }
                                });
                            })
                        };
                        alice.deleteSpaceRole({
                            spaceId: space.id,
                            roleId: role.id,
                        })
                        await waitEvent(role.id);
                        await bob.deleteSpace({id: space.id});
                    });
                });
            });
            describe("channels", () => {
                it('should create private channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: true,
                        members: [alice.user().username]
                    });
                    const aliceSpaces = await alice.getUserSpaces();
                    const aliceSpace = aliceSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(aliceSpace).toBeTruthy();
                    const aliceChannel = aliceSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(aliceChannel).toBeTruthy();
                    const kiriSpaces = await kiri.getUserSpaces();
                    const kiriSpace = kiriSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(kiriSpace).toBeTruthy();
                    const kiriChannel = kiriSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(kiriChannel).toBeFalsy();
                    await bob.deleteSpace({id: space.id});
                });
                it('should update private channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: true,
                        members: [alice.user().username]
                    });
                    let aliceSpaces = await alice.getUserSpaces();
                    let aliceSpace = aliceSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(aliceSpace).toBeTruthy();
                    let aliceChannel = aliceSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(aliceChannel).toBeTruthy();
                    let kiriSpaces = await kiri.getUserSpaces();
                    let kiriSpace = kiriSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(kiriSpace).toBeTruthy();
                    let kiriChannel = kiriSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(kiriChannel).toBeFalsy();

                    await bob.updateSpaceChannel({
                        spaceId: space.id,
                        channelId: channel.id,
                        name: channel.name,
                        isPrivate: channel.private,
                        members: [kiri.user().username]
                    })
                    aliceSpaces = await alice.getUserSpaces();
                    aliceSpace = aliceSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(aliceSpace).toBeTruthy();
                    aliceChannel = aliceSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(aliceChannel).toBeFalsy();
                    kiriSpaces = await kiri.getUserSpaces();
                    kiriSpace = kiriSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(kiriSpace).toBeTruthy();
                    kiriChannel = kiriSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(kiriChannel).toBeTruthy();
                    await bob.deleteSpace({id: space.id});
                });
                it('should delete channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await kiri.joinSpaceByInviteCode(invite.inviteCode);

                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: false,
                    });
                    let aliceSpaces = await alice.getUserSpaces();
                    let aliceSpace = aliceSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(aliceSpace).toBeTruthy();
                    let aliceChannel = aliceSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(aliceChannel).toBeTruthy();
                    let kiriSpaces = await kiri.getUserSpaces();
                    let kiriSpace = kiriSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(kiriSpace).toBeTruthy();
                    let kiriChannel = kiriSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(kiriChannel).toBeTruthy();

                    await bob.deleteSpaceChannel({
                        spaceId: space.id,
                        channelId: channel.id
                    })

                    aliceSpaces = await alice.getUserSpaces();
                    aliceSpace = aliceSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(aliceSpace).toBeTruthy();
                    aliceChannel = aliceSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(aliceChannel).toBeFalsy();
                    kiriSpaces = await kiri.getUserSpaces();
                    kiriSpace = kiriSpaces.find((userSpace) => userSpace.id === space.id);
                    expect(kiriSpace).toBeTruthy();
                    kiriChannel = kiriSpace.channels.find((currentChannel) => currentChannel.id === channel.id);
                    expect(kiriChannel).toBeFalsy();
                    await bob.deleteSpace({id: space.id});
                });
            });
            describe("restricted access", () => {
                it('member should receive error when trying to update space', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.updateSpaceOverview({
                        id: space.id,
                        name: "UPDATED_SPACE"
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to create category', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.createSpaceCategory({
                        spaceId: space.id,
                        name: TEST_CATEGORY_NAME
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to update category', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const category = await bob.createSpaceCategory({
                        spaceId: space.id,
                        name: TEST_CATEGORY_NAME
                    })
                    await expect(alice.updateSpaceCategory({
                        spaceId: space.id,
                        categoryId: category.id,
                        name: "UPDATED_NAME"
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to delete category', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const category = await bob.createSpaceCategory({
                        spaceId: space.id,
                        name: TEST_CATEGORY_NAME
                    })
                    await expect(alice.deleteSpaceCategory({
                        spaceId: space.id,
                        categoryId: category.id
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to create channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: false
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to update channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: false
                    });
                    await expect(alice.updateSpaceChannel({
                        spaceId: space.id,
                        channelId: channel.id,
                        name: "UPDATED_CHANNEL",
                        isPrivate: channel.private
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to delete channel', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const channel = await bob.createSpaceChannel({
                        spaceId: space.id,
                        name: TEST_CHANNEL_NAME,
                        isPrivate: false
                    });
                    await expect(alice.deleteSpaceChannel({
                        spaceId: space.id,
                        channelId: channel.id,
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to add role', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to update role', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id
                    });

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.updateSpaceRole({
                        spaceId: space.id,
                        roleId: role.id,
                        name: "UPDATED_NAME",
                        color: role.color,
                        permissions: role.permissions,
                        members: []
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
                it('member should receive error when trying to update role', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})

                    const role = await bob.addSpaceRole({
                        ...TEST_SPACE_ROLE,
                        spaceId: space.id
                    });

                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    await expect(alice.deleteSpaceRole({
                        spaceId: space.id,
                        roleId: role.id,
                    })).rejects.toHaveProperty("error", SpaceError.RESTRICTED_ACCESS);
                    await bob.deleteSpace({id: space.id});
                });
            });
            describe("messages", () => {
                it('member should receive message', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const channel = space.channels[0];
                    expect(channel).toBeTruthy();
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})
                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const waitMessage = async () => {
                        return new Promise<void>((resolve) => {
                            alice.on(SfuEvent.MESSAGE, (msg) => {
                               const message = msg as Message;
                               if (message.targetEntityType === MessageTargetEntityType.CHANNEL) {
                                   resolve();
                               }
                            });
                        })
                    };
                    bob.sendMessage({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        body: "body"
                    });
                    await waitMessage();
                    await bob.deleteSpace({id: space.id});
                });
                it('should mark message read', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const channel = space.channels[0];
                    expect(channel).toBeTruthy();
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})
                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const msg = await alice.sendMessage({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        body: "body"
                    });
                    const lastReadMessageUpdate = await bob.markMessageRead({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        id: msg.id
                    });
                    expect(lastReadMessageUpdate.updateInfo.lastReadMessageDate).toEqual(msg.date);
                    await bob.deleteSpace({id: space.id});
                });
                it('should mark message unread', async () => {
                    const space = await bob.createSpace({name: TEST_SPACE_NAME});
                    const channel = space.channels[0];
                    expect(channel).toBeTruthy();
                    const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})
                    await alice.joinSpaceByInviteCode(invite.inviteCode);
                    const msg1 = await alice.sendMessage({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        body: "body1"
                    });
                    const msg2 = await alice.sendMessage({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        body: "body2"
                    });
                    const lastReadMessageUpdate = await bob.markMessageRead({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        id: msg2.id
                    });
                    expect(lastReadMessageUpdate.updateInfo.lastReadMessageDate).toEqual(msg2.date);
                    const lastReadMessageUpdate2 = await bob.markMessageUnread({
                        targetEntityType: MessageTargetEntityType.CHANNEL,
                        targetEntityId: {spaceId: space.id, channelId: channel.id},
                        id: msg2.id
                    });
                    expect(lastReadMessageUpdate2.updateInfo.oldLastReadMessageDate).toEqual(msg2.date);
                    expect(lastReadMessageUpdate2.updateInfo.lastReadMessageDate).toEqual(msg1.date);
                    await bob.deleteSpace({id: space.id});
                });
            });
        });
        describe("channel-room", () => {
            const wrtc = require("wrtc");

            it('should create channel room at server side', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                const room = await bob.createChannelMeeting({
                    spaceId: space.id,
                    channelId: channel.id
                });
                expect(room).toBeTruthy();
                expect(room.name()).toEqual(channel.name);
                expect(room.conferenceType()).toEqual(ConferenceType.CHANNEL);
                expect(room.config().locked).toBe(false);
                expect(room.config().initialAudioMuted).toBe(false);
                expect(room.config().initialVideoMuted).toBe(true);
                expect(room.config().initialScreenSharingMuted).toBe(true);
                expect(room.config().audioMuted).toBe(false);
                expect(room.config().videoMuted).toBe(false);
                expect(room.config().screenSharingMuted).toBe(false);
                expect(room.config().chatMuted).toBe(true);
                expect(room.config().canChangeNickname).toBe(false);
                expect(room.config().screenSharingConfig.multipleShares).toBe(true);
                expect(room.config().screenSharingConfig.everyoneCanShare).toBe(true);
                expect(room.config().screenSharingConfig.everyoneCanDoSubsequentShare).toBe(true);
                await room.destroyRoom();
                await bob.deleteSpace({id: space.id});
            });
            it('should join to channel room', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                const room = await bob.createChannelMeeting({
                    spaceId: space.id,
                    channelId: channel.id
                });
                const bobPc = new wrtc.RTCPeerConnection();
                const state = await room.join(bobPc);
                expect(state.userId).toEqual(TEST_USER_0.username);
                expect(state.name).toEqual(TEST_USER_0.nickname);
                await room.destroyRoom();
                await bob.deleteSpace({id: space.id});
            });
            it('second participant should join to channel room', async () => {
                const space = await bob.createSpace({name: TEST_SPACE_NAME});
                const channel = space.channels[0];
                const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000})
                await alice.joinSpaceByInviteCode(invite.inviteCode);
                const bobRoom = await bob.createChannelMeeting({
                    spaceId: space.id,
                    channelId: channel.id
                });
                const bobPc = new wrtc.RTCPeerConnection();
                const bobState = await bobRoom.join(bobPc);
                expect(bobState.userId).toEqual(TEST_USER_0.username);
                expect(bobState.name).toEqual(TEST_USER_0.nickname);
                const aliceRoom = await alice.roomAvailable({
                    id: channel.id
                });
                expect(aliceRoom).toBeTruthy();
                const alicePc = new wrtc.RTCPeerConnection();
                const aliceState = await aliceRoom.join(alicePc);
                expect(aliceState.userId).toEqual(TEST_USER_1.username);
                expect(aliceState.name).toEqual(TEST_USER_1.nickname);
                await bobRoom.destroyRoom();
                await bob.deleteSpace({id: space.id});
            });
        })
    });
})
