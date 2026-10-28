import {AttachmentStatus, MessageAttachment, MessageAttachmentData, MessageStatus} from "../constants";


export class SendingAttachmentsHandler {

    #sendMessageAttachments: {send: () => Promise<MessageStatus>, cancel: (attachment: MessageAttachment) => Promise<AttachmentStatus>, waitAndGetMessageStatus: () => Promise<MessageStatus>, sendOutOfQueue?: () => void, abandonSend?: () => void, getAttachmentsData: () => MessageAttachmentData[]}

    constructor(sendMessageAttachments: {send: () => Promise<MessageStatus>, cancel: (attachment: MessageAttachment) => Promise<AttachmentStatus>, waitAndGetMessageStatus: () => Promise<MessageStatus>, sendOutOfQueue?: () => void, abandonSend?: () => void, getAttachmentsData: () => MessageAttachmentData[] }) {
        this.#sendMessageAttachments = sendMessageAttachments;
    }

    public sendAttachments() {
        return this.#sendMessageAttachments.send();
    }

    public cancelSendingAttachment(attachment: MessageAttachment) {
        return this.#sendMessageAttachments.cancel(attachment);
    }

    public waitAndGetMessageStatus() {
        return this.#sendMessageAttachments.waitAndGetMessageStatus();
    }

    public sendOutOfQueue() {
        this.#sendMessageAttachments.sendOutOfQueue?.();
    }

    /** Call after cancelSendingMessage: aborts the PUTs and frees the chat queue at once. */
    public abandonSend() {
        this.#sendMessageAttachments.abandonSend?.();
    }

    public getAttachmentsPayload() {
        return this.#sendMessageAttachments.getAttachmentsData();
    }

}