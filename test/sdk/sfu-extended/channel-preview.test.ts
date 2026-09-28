import {SfuExtended} from "../../../src";
import {connect, waitForUsers} from "../../util/utils";
import {TEST_CHANNEL_NAME, TEST_SPACE_NAME, TEST_THREAD_NAME, TEST_USER_2} from "../../util/constants";
import {MessageTargetEntityType} from "../../../src/sdk/constants";

describe("channel preview", () => {
    let bob: SfuExtended;
    let alice: SfuExtended;
    let kiri: SfuExtended;
    beforeEach(async () => {
        const users = await waitForUsers();
        bob = users.bob;
        alice = users.alice;
        kiri = await connect(TEST_USER_2);
    });
    afterEach(async () => {
        await bob.disconnect();
        await alice.disconnect();
        await kiri.disconnect();
    });

    //guests join before the channel is created, so that they are members of it and of its threads
    const createChannel = async (guests: Array<SfuExtended> = []) => {
        const space = await bob.createSpace({name: TEST_SPACE_NAME});
        if (guests.length > 0) {
            const invite = await bob.generateNewSpaceInvite({spaceId: space.id, lifespan: 10000});
            for (const guest of guests) {
                await guest.joinSpaceByInviteCode(invite.inviteCode);
            }
        }
        const channel = await bob.createSpaceChannel({
            spaceId: space.id,
            name: TEST_CHANNEL_NAME,
            isPrivate: false
        });
        const createThread = () => bob.createSpaceThread({
            spaceId: space.id,
            channelId: channel.id,
            name: TEST_THREAD_NAME,
            isPrivate: false
        });
        const inThread = (threadId: string) => ({
            targetEntityType: MessageTargetEntityType.THREAD,
            targetEntityId: {spaceId: space.id, channelId: channel.id, threadId}
        });
        return {space, channel, createThread, inThread};
    };

    it("should return the newest message of every thread", async () => {
        const {space, channel, createThread, inThread} = await createChannel();
        const talked = await createThread();
        const silent = await createThread();
        await bob.sendMessage({...inThread(talked.id), body: "older"});
        const newest = await bob.sendMessage({...inThread(talked.id), body: "newest"});

        const preview = await bob.getChannelPreview({spaceId: space.id, channelId: channel.id});

        expect(preview.spaceId).toEqual(space.id);
        expect(preview.channelId).toEqual(channel.id);
        const byThread = new Map(preview.threads.map((item) => [item.threadId, item.message]));
        expect(byThread.get(talked.id).id).toEqual(newest.id);
        expect(byThread.get(talked.id).body).toEqual("newest");
        expect(byThread.has(silent.id)).toBeTruthy();
        expect(byThread.get(silent.id)).toBeNull();
        await bob.deleteSpace({id: space.id});
    });

    it("should skip a private message addressed to somebody else", async () => {
        const {space, channel, createThread, inThread} = await createChannel([alice, kiri]);
        const thread = await createThread();
        const visible = await bob.sendMessage({...inThread(thread.id), body: "for everybody"});
        await bob.sendMessage({...inThread(thread.id), body: "for kiri", to: TEST_USER_2.username});

        const preview = await alice.getChannelPreview({spaceId: space.id, channelId: channel.id});

        expect(preview.threads.find((item) => item.threadId === thread.id).message.id).toEqual(visible.id);
        await bob.deleteSpace({id: space.id});
    });

    it("should keep the private message of its own author", async () => {
        const {space, channel, createThread, inThread} = await createChannel([alice, kiri]);
        const thread = await createThread();
        await bob.sendMessage({...inThread(thread.id), body: "for everybody"});
        const own = await bob.sendMessage({...inThread(thread.id), body: "for kiri", to: TEST_USER_2.username});

        const preview = await bob.getChannelPreview({spaceId: space.id, channelId: channel.id});

        expect(preview.threads.find((item) => item.threadId === thread.id).message.id).toEqual(own.id);
        await bob.deleteSpace({id: space.id});
    });

    it("should fail for a channel the user does not belong to", async () => {
        const {space} = await createChannel();

        await expect(bob.getChannelPreview({spaceId: space.id, channelId: "unknown"})).rejects.toBeTruthy();
        await bob.deleteSpace({id: space.id});
    });
});
