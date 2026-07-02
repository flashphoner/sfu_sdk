import {SfuExtended} from "../../../../src";
import {generateAttachments, waitForUsers, waitForAttachmentsStored} from "../../../util/utils";
import {TEST_SPACE_NAME, TEST_USER_0} from "../../../util/constants";
import {
    AttachmentType,
    MessageState,
    MessageTargetEntityType
} from "../../../../src/sdk/constants";

const MESSAGE_BODY = "test message";

describe("Listing", () => {
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
    it("should list space's attachments", async () => {
        const space = await bob.createSpace({name: TEST_SPACE_NAME});
        expect(space.name).toEqual(TEST_SPACE_NAME);
        expect(space.owner).toEqual(TEST_USER_0.username);
        const channel = space.channels[0];
        expect(channel).toBeTruthy();

        const attachmentsCount = 3;
        const size = 1024 * 1024;
        const attachments = generateAttachments(attachmentsCount, size);

        const status = await bob.sendMessage({
            targetEntityType: MessageTargetEntityType.CHANNEL,
            targetEntityId: {spaceId: space.id, channelId: channel.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = bob.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const result = await waitForAttachmentsStored(
            () => bob.listAttachments({sectionType: 'Spaces', spaceId: space.id, offset: -1, pageSize: -1}),
            r => attachments.metadata.every(m => r.result.items.some(it => it.id === m.id))
        );

        expect(result).toBeTruthy();
        expect(result.result.items.length).toBe(attachmentsCount);
        for (let i = 0; i < result.result.items.length; i++) {
            expect(result.result.items[i].size).toBe(size);
        }

        await bob.deleteSpace({id: space.id});

        const shouldBeEmptyList = await bob.listAttachments({
            sectionType: 'Spaces', spaceId: space.id, offset: -1, pageSize: -1
        });

        expect(shouldBeEmptyList).toBeTruthy();
        expect(shouldBeEmptyList.result.items.length).toBe(0);
    })
    it("should get space attachment size", async () => {
        const space = await bob.createSpace({name: TEST_SPACE_NAME});
        expect(space.name).toEqual(TEST_SPACE_NAME);
        expect(space.owner).toEqual(TEST_USER_0.username);
        const channel = space.channels[0];
        expect(channel).toBeTruthy();

        const attachmentsCount = 3;
        const size = 1024 * 1024;
        const attachments = generateAttachments(attachmentsCount, size);

        const status = await bob.sendMessage({
            targetEntityType: MessageTargetEntityType.CHANNEL,
            targetEntityId: {spaceId: space.id, channelId: channel.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = bob.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const result = await waitForAttachmentsStored(
            () => bob.getAttachmentsSize(AttachmentType.SPACE),
            r => Number(r.result[AttachmentType.SPACE]) >= size * attachmentsCount
        );

        expect(result).toBeTruthy();
        expect(result.result[AttachmentType.SPACE]).toBeTruthy();
        expect(result.result[AttachmentType.SPACE]).toBe(size * attachmentsCount)

        await bob.deleteSpace({id: space.id});

        const shouldBeEmptyResult = await bob.getAttachmentsSize(AttachmentType.SPACE)

        expect(shouldBeEmptyResult).toBeTruthy();
        expect(shouldBeEmptyResult.result.SPACE).toBeUndefined();
    })
});