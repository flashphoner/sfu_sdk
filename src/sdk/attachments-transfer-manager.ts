import {Notifier} from "./notifier";
import {EventUnion, NotifyUnion} from "./sfu-extended";
import {
    Attachment,
    ATTACHMENTS_TRANSFER_IDLE_TIMEOUT_MS,
    ATTACHMENTS_TRANSFER_MAX_CLIENTS,
    ATTACHMENTS_TRANSFER_POOL_SIZE,
    ATTACHMENTS_TRANSFER_STALLED_MS,
    ChatError
} from "./constants";
import {AttachmentsTransferClient, AttachmentsTransferEndpoint} from "./attachments-transfer-client";

type QueuedDownload = {
    attachment: Attachment;
    endpoint: AttachmentsTransferEndpoint;
    resolve: (attachment: Attachment) => void;
    reject: (error: Error) => void;
}

export class AttachmentsTransferManager {

    readonly #notifier: Notifier<EventUnion, NotifyUnion>;
    readonly #clients: Array<AttachmentsTransferClient> = [];
    readonly #queue: Array<QueuedDownload> = [];
    readonly #idleTimers: Map<AttachmentsTransferClient, ReturnType<typeof setTimeout>> = new Map();
    #retryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(notifier: Notifier<EventUnion, NotifyUnion>) {
        this.#notifier = notifier;
    }

    public download(attachment: Attachment, endpoint: AttachmentsTransferEndpoint): Promise<Attachment> {
        return new Promise<Attachment>((resolve, reject) => {
            this.#queue.push({attachment, endpoint, resolve, reject});
            this.#next();
        });
    }

    public async close() {
        this.#stopRetryTimer();
        this.#queue.splice(0).forEach((task) => task.reject(new Error(ChatError.DOWNLOADING_ATTACHMENT_FAILED)));
        const clients = this.#clients.splice(0);
        clients.forEach((client) => this.#stopIdleTimer(client));
        await Promise.all(clients.map((client) => client.disconnect()));
    }

    public dropIdle() {
        this.#clients.filter((client) => !client.busy).forEach((client) => this.#drop(client));
    }

    #next() {
        while (this.#queue.length > 0) {
            const client = this.#clientFor(this.#queue[0].endpoint);
            if (!client) {
                this.#scheduleRetry();
                return;
            }
            const task = this.#queue.shift();
            this.#stopIdleTimer(client);
            client.downloadAttachment(task.attachment)
                .then(task.resolve, task.reject)
                .finally(() => this.#release(client));
        }
    }

    #clientFor(endpoint: AttachmentsTransferEndpoint): AttachmentsTransferClient | null {
        const idle = this.#clients.find((client) => !client.busy && client.url === endpoint.url);
        if (idle) {
            return idle;
        }
        const other = this.#clients.find((client) => !client.busy);
        if (other) {
            this.#drop(other);
        }
        if (this.#clients.length < ATTACHMENTS_TRANSFER_POOL_SIZE || this.#canOpenExtraClient()) {
            const client = new AttachmentsTransferClient(this.#notifier, endpoint);
            this.#clients.push(client);
            return client;
        }
        return null;
    }

    #canOpenExtraClient(): boolean {
        const stalledSince = Date.now() - ATTACHMENTS_TRANSFER_STALLED_MS;
        return this.#clients.length < ATTACHMENTS_TRANSFER_MAX_CLIENTS
            && this.#clients.every((client) => client.busy && client.busySince <= stalledSince);
    }

    #release(client: AttachmentsTransferClient) {
        if (!this.#clients.includes(client)) {
            client.disconnect();
        } else if (!client.connected) {
            this.#drop(client);
        }
        this.#next();
        if (this.#clients.includes(client) && !client.busy) {
            if (this.#clients.length > ATTACHMENTS_TRANSFER_POOL_SIZE) {
                this.#drop(client);
            } else {
                this.#startIdleTimer(client);
            }
        }
    }

    #drop(client: AttachmentsTransferClient) {
        this.#stopIdleTimer(client);
        const index = this.#clients.indexOf(client);
        if (index !== -1) {
            this.#clients.splice(index, 1);
        }
        client.disconnect();
    }

    #scheduleRetry() {
        if (!this.#retryTimer) {
            this.#retryTimer = setTimeout(() => {
                this.#retryTimer = null;
                this.#next();
            }, ATTACHMENTS_TRANSFER_STALLED_MS);
        }
    }

    #stopRetryTimer() {
        if (this.#retryTimer) {
            clearTimeout(this.#retryTimer);
            this.#retryTimer = null;
        }
    }

    #startIdleTimer(client: AttachmentsTransferClient) {
        this.#stopIdleTimer(client);
        this.#idleTimers.set(client, setTimeout(() => this.#drop(client), ATTACHMENTS_TRANSFER_IDLE_TIMEOUT_MS));
    }

    #stopIdleTimer(client: AttachmentsTransferClient) {
        const timer = this.#idleTimers.get(client);
        if (timer) {
            clearTimeout(timer);
            this.#idleTimers.delete(client);
        }
    }
}
