import {
    Attachment,
    ATTACHMENTS_TRANSFER_CONNECT_TIMEOUT_MS,
    ATTACHMENTS_TRANSFER_FIRST_CHUNK_TIMEOUT_MS,
    ATTACHMENTS_TRANSFER_RESPONSE_TIMEOUT_MS,
    AttachmentState,
    AttachmentStatus,
    ChatError,
    InternalApi,
    InternalMessage,
    RoomEvent,
    SfuEvent,
    State
} from "./constants";
import {Notifier} from "./notifier";
import {EventUnion, NotifyUnion} from "./sfu-extended";
import {Connection} from "./connection";

import {v4 as uuidv4} from 'uuid';

const HEADER_SIZE = 2;

export type AttachmentsTransferEndpoint = {
    url: string;
    pingInterval?: number;
    failedProbesThreshold?: number;
}

type PendingDownload = {
    attachment: Attachment;
    internalMessageId: string;
    chunks: Array<ArrayBuffer>;
    received: number;
    resolve: (attachment: Attachment) => void;
    reject: (error: Error) => void;
}

export class AttachmentsTransferClient {

    #_state: State = State.NEW;
    #notifier: Notifier<EventUnion, NotifyUnion>;
    #connection: Connection;
    #endpoint: AttachmentsTransferEndpoint;
    #busy: boolean = false;
    #busySince: number = 0;
    #closed: boolean = false;
    #pending: PendingDownload | null = null;
    #responseTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(notifier: Notifier<EventUnion, NotifyUnion>, endpoint: AttachmentsTransferEndpoint) {
        this.#notifier = notifier;
        this.#endpoint = endpoint;
    }

    public get url(): string {
        return this.#endpoint.url;
    }

    public get busy(): boolean {
        return this.#busy;
    }

    public get busySince(): number {
        return this.#busySince;
    }

    public get connected(): boolean {
        return this.#_state === State.CONNECTED;
    }

    #notifyMessageAttachmentState(attachment: Attachment, state: AttachmentState, downloadedSize: number) {
        const status: AttachmentStatus = {
            targetEntityType: attachment.targetEntityType,
            targetEntityId: attachment.targetEntityId,
            messageId: attachment.messageId,
            id: attachment.attachmentId,
            name: attachment.name,
            state: state,
            downloadedSize: downloadedSize
        };
        this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, status);
    }

    static #getConnectionConfigForAnonymousUser(endpoint: AttachmentsTransferEndpoint) {
        return {
            url: endpoint.url,
            appName: InternalApi.Z_ATTACHMENTS_TRANSFER_APP,
            timeout: ATTACHMENTS_TRANSFER_CONNECT_TIMEOUT_MS,
            pingInterval: endpoint.pingInterval,
            failedProbesThreshold: endpoint.failedProbesThreshold,
            custom: {
                username: "",
                password: "",
                nickname: ""
            }
        };
    };

    static #concat(chunks: Array<ArrayBuffer>, total: number): ArrayBuffer {
        const payload = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            payload.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }
        return payload.buffer;
    }

    async #connect() {
        const connection = new Connection(
            (name: string, data: Array<InternalMessage>) => this.#onMessage(data),
            (name: string, data: ArrayBuffer) => this.#onBinaryData(name, data),
            () => this.#onDisconnected(connection),
            () => this.#onDisconnected(connection),
        );
        this.#connection = connection;
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<never>((resolve, reject) => {
            timer = setTimeout(() => reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED)), ATTACHMENTS_TRANSFER_CONNECT_TIMEOUT_MS);
        });
        try {
            await Promise.race([connection.connect(AttachmentsTransferClient.#getConnectionConfigForAnonymousUser(this.#endpoint)), timeout]);
        } catch (e) {
            connection.close();
            throw e;
        } finally {
            clearTimeout(timer);
        }
        this.#_state = State.CONNECTED;
    }

    public async downloadAttachment(attachment: Attachment): Promise<Attachment> {
        if (this.#busy) {
            throw new Error("Transfer client is busy");
        }
        if (this.#closed) {
            throw new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED);
        }
        this.#busy = true;
        this.#busySince = Date.now();
        if (this.#_state !== State.CONNECTED) {
            try {
                await this.#connect();
            } catch (e) {
                this.#_state = State.FAILED;
                this.#busy = false;
                throw new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED);
            }
            if (this.#closed) {
                this.#_state = State.DISCONNECTED;
                this.#busy = false;
                this.#connection.close();
                throw new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED);
            }
        }
        return new Promise<Attachment>((resolve, reject) => {
            const internalMessageId = uuidv4();
            this.#pending = {attachment, internalMessageId, chunks: [], received: 0, resolve, reject};
            // the server may first fetch the whole file from S3
            this.#watchResponse(ATTACHMENTS_TRANSFER_FIRST_CHUNK_TIMEOUT_MS);
            this.#connection.send(InternalApi.GET_ATTACHMENT, {
                sessionId: attachment.sessionId,
                internalMessageId: internalMessageId,
            });
        });
    }

    #watchResponse(timeout: number) {
        this.#stopResponseWatch();
        this.#responseTimer = setTimeout(() => this.#onResponseTimeout(), timeout);
    }

    #stopResponseWatch() {
        if (this.#responseTimer) {
            clearTimeout(this.#responseTimer);
            this.#responseTimer = null;
        }
    }

    #onResponseTimeout() {
        this.#responseTimer = null;
        // chunks of the abandoned transfer may still arrive, so the connection is not reused
        this.#_state = State.FAILED;
        const connection = this.#connection;
        this.#fail();
        connection.close();
    }

    #onBinaryData(name: string, data: ArrayBuffer) {
        if (name !== InternalApi.BINARY_DATA) {
            console.error("Unknown binary data type " + name);
            return;
        }
        const pending = this.#pending;
        if (!pending) {
            return;
        }
        const eof = new Uint8Array(data)[HEADER_SIZE - 1];
        const chunk = data.slice(HEADER_SIZE);
        pending.chunks.push(chunk);
        pending.received += chunk.byteLength;
        if (eof !== 1) {
            this.#watchResponse(ATTACHMENTS_TRANSFER_RESPONSE_TIMEOUT_MS);
            this.#notifyMessageAttachmentState(pending.attachment, AttachmentState.PENDING, pending.received);
            return;
        }
        this.#stopResponseWatch();
        this.#pending = null;
        this.#busy = false;
        try {
            pending.attachment.payload = AttachmentsTransferClient.#concat(pending.chunks, pending.received);
        } catch (e) {
            pending.reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED));
            return;
        }
        pending.resolve(pending.attachment);
        this.#notifyMessageAttachmentState(pending.attachment, AttachmentState.DOWNLOADED, pending.received);
    }

    #onMessage(data: Array<InternalMessage>) {
        const message = data && data[0];
        if (!message || message.type !== RoomEvent.OPERATION_FAILED || !this.#pending) {
            return;
        }
        if (!message.internalMessageId || message.internalMessageId === this.#pending.internalMessageId) {
            this.#fail();
        }
    }

    #onDisconnected(connection: Connection) {
        if (connection !== this.#connection) {
            return;
        }
        this.#_state = State.DISCONNECTED;
        this.#fail();
    }

    #fail() {
        this.#stopResponseWatch();
        const pending = this.#pending;
        if (!pending) {
            return;
        }
        this.#pending = null;
        this.#busy = false;
        pending.reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED));
    }

    public async disconnect() {
        this.#closed = true;
        this.#fail();
        if (this.#_state === State.CONNECTED) {
            this.#_state = State.DISCONNECTED;
            await this.#connection.close();
        }
    };
}
