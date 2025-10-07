import {SfuExtended} from "../../../../src";
import {generateAttachments, waitForUsers} from "../../../util/utils";
import {
    AttachmentType,
    MessageAttachmentType,
    MessageState,
    MessageTargetEntityType
} from "../../../../src/sdk/constants";
import {v4 as uuidv4} from 'uuid';

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
    it("Should list one attachment", async () => {
        const chat = await alice.createChat({});
        const id = uuidv4();
        const size = 1024 * 1024;
        const attachments = [{
            type: MessageAttachmentType.file,
            name: "test.txt",
            size: size,
            id: id
        }];
        const payload = [{
            payload: Buffer.from(new ArrayBuffer(1024 * 1024)).buffer,
            id: id
        }];
        const status = await alice.sendMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            body: MESSAGE_BODY,
            attachments: attachments
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = alice.getSendingAttachmentsHandler(payload, status.id);
        await handler.sendAttachments();

        const result = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(result).toBeTruthy();
        expect(result.result.length).toBe(1);
        expect(result.result[0].id).toBe(id);
        expect(result.result[0].size).toBe(size);

        await alice.deleteChat(chat);

        const shouldBeEmptyList = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(shouldBeEmptyList).toBeTruthy();
        expect(shouldBeEmptyList.result.length).toBe(0);
    });
    it("Should list multiple attachments", async () => {
        const chat = await alice.createChat({});

        const attachmentsCount = 3;
        const size = 1024 * 1024;

        const attachments = generateAttachments(attachmentsCount, size);

        const status = await alice.sendMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = alice.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const result = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(result).toBeTruthy();
        expect(result.result.length).toBe(attachmentsCount);

        await alice.deleteChat(chat);

        const shouldBeEmptyList = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(shouldBeEmptyList).toBeTruthy();
        expect(shouldBeEmptyList.result.length).toBe(0);
    });

    it("Should match attachments size after edit message", async () => {
        const chat = await alice.createChat({});

        const attachmentsCount = 3;
        const size = 1024 * 1024;

        const attachments = generateAttachments(attachmentsCount, size);

        const status = await alice.sendMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = alice.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const result = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(result).toBeTruthy();
        expect(result.result.length).toBe(attachmentsCount);

        const attachmentId = status.attachments[0].id;
        await alice.editMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            messageId: status.id,
            body: MESSAGE_BODY,
            attachmentIdsToDelete: [attachmentId]
        });

        const editedResult = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(editedResult).toBeTruthy();
        expect(editedResult.result.length).toBe(attachmentsCount-1);

        await alice.deleteChat(chat);

        const shouldBeEmptyList = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(shouldBeEmptyList).toBeTruthy();
        expect(shouldBeEmptyList.result.length).toBe(0);
    });

    it("Should list with pagination", async () => {
        const chat = await alice.createChat({});

        const attachmentsCount = 5;
        const size = 1024 * 1024;

        const attachments = generateAttachments(attachmentsCount, size);

        const status = await alice.sendMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = alice.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const pageSize = 3

        const result = await alice.listAttachments({
            offset: 0, pageSize: pageSize
        });

        expect(result).toBeTruthy();
        expect(result.result.length).toBe(pageSize);

        await alice.deleteChat(chat);

        const shouldBeEmptyList = await alice.listAttachments({
            offset: -1, pageSize: -1
        });

        expect(shouldBeEmptyList).toBeTruthy();
        expect(shouldBeEmptyList.result.length).toBe(0);
    });

    it("should get direct attachment size", async () => {
        const chat = await alice.createChat({});

        const attachmentsCount = 3;
        const size = 1024 * 1024;

        const attachments = generateAttachments(attachmentsCount, size);

        const status = await alice.sendMessage({
            targetEntityType: MessageTargetEntityType.CHAT,
            targetEntityId: {chatId: chat.id},
            body: MESSAGE_BODY,
            attachments: attachments.metadata
        });
        expect(status).toBeTruthy();
        expect(status.id).toBeTruthy();
        expect(status.date).toBeTruthy();
        expect(status.state).toBe(MessageState.PENDING_ATTACHMENTS);
        expect(status.attachments).toBeTruthy();

        const handler = alice.getSendingAttachmentsHandler(attachments.payload, status.id);
        await handler.sendAttachments();

        const result = await alice.getAttachmentsSize(AttachmentType.DIRECT)

        expect(result).toBeTruthy();
        expect(result.result[AttachmentType.DIRECT]).toBeTruthy();
        expect(result.result[AttachmentType.DIRECT]).toBe(size * attachmentsCount)

        await alice.deleteChat(chat);

        const shouldBeEmptyResult = await alice.getAttachmentsSize(AttachmentType.DIRECT)

        expect(shouldBeEmptyResult).toBeTruthy();
        expect(shouldBeEmptyResult.result.DIRECT).toBeUndefined();
    });
});