import {
    Attachment,
    AttachmentState,
    AttachmentStatus,
    ChatError,
    InternalApi,
    SfuEvent,
    State
} from "./constants";
import {Notifier} from "./notifier";
import {EventUnion, NotifyUnion} from "./sfu-extended";
import {Connection} from "./connection";

import {v4 as uuidv4} from 'uuid';

export class AttachmentsTransferClient {

    #_state: State = State.NEW;
    #notifier: Notifier<EventUnion, NotifyUnion>;
    #attachment: Attachment;
    #connection: Connection;


    constructor(notifier: Notifier<EventUnion, NotifyUnion>, attachment: Attachment) {
        this.#notifier = notifier;
        this.#attachment = attachment;
    }

    #notifyMessageAttachmentState(attachment: Attachment, state: AttachmentState) {
        const status: AttachmentStatus = {
            targetEntityType: attachment.targetEntityType,
            targetEntityId: attachment.targetEntityId,
            messageId: attachment.messageId,
            id: attachment.attachmentId,
            name: attachment.name,
            state: state,
            downloadedSize: attachment.payload.byteLength
        };
        this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, status);
    }

    static #getConnectionConfigForAnonymousUser(url: string, timeout?: number) {
        return {
            url: url,
            appName: InternalApi.Z_ATTACHMENTS_TRANSFER_APP,
            timeout: timeout ? timeout : 10000,
            pingInterval: 0,
            failedProbesThreshold: 0,
            custom: {
                username: "",
                password: "",
                nickname: ""
            }
        };
    };

    public async downloadAttachment(url: string) {
        const self = this;

        if (self.#_state === State.CONNECTED) {
            throw new Error("Downloading failed");
        }
        return new Promise<Attachment>(async (resolve, reject) => {
            const config = AttachmentsTransferClient.#getConnectionConfigForAnonymousUser(url);

            const id = uuidv4();
            self.#connection = new Connection(
                () => {
                },
                (name: string, data: ArrayBuffer) => {
                    switch (name) {
                        case InternalApi.BINARY_DATA:
                            const headerSize = 2;
                            const buffer = new Uint8Array(data);
                            const eof = buffer[headerSize - 1];
                            if (self.#attachment) {
                                if (!self.#attachment.payload) {
                                    self.#attachment.payload = data.slice(headerSize, data.byteLength);
                                } else {
                                    const newData = new Uint8Array(self.#attachment.payload.byteLength + (data.byteLength - headerSize));
                                    newData.set(new Uint8Array(self.#attachment.payload), 0);
                                    newData.set(new Uint8Array(data.slice(headerSize, data.byteLength)), self.#attachment.payload.byteLength);
                                    self.#attachment.payload = newData.buffer;
                                }
                                if (eof === 1) {
                                    self.#notifyMessageAttachmentState(self.#attachment, AttachmentState.DOWNLOADED);
                                    self.disconnect();
                                    resolve(self.#attachment);
                                } else {
                                    self.#notifyMessageAttachmentState(self.#attachment, AttachmentState.PENDING);
                                }
                            }
                            break;
                        default:
                            console.error("Unknown binary data type " + name);
                    }
                },
                (e) => {
                    self.#_state = State.FAILED;
                    reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED));
                },
                (e) => {
                    self.#_state = State.DISCONNECTED;
                    reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED));
                },
            );

            await self.#connection.connect(config);
            self.#_state = State.CONNECTED;
            self.#connection.send(InternalApi.GET_ATTACHMENT, {
                sessionId: self.#attachment.sessionId,
                internalMessageId: id,
            });
        })
    }

    public async disconnect() {
        if (this.#_state !== State.DISCONNECTED) {
            await this.#connection.close();
            this.#_state = State.DISCONNECTED;
        }
    };
}
