import {Notifier} from "./notifier";
import {EventUnion, NotifyUnion} from "./sfu-extended";
import {Attachment} from "./constants";
import { AttachmentsTransferClient } from "./attachments-transfer-client";

export class AttachmentsTransferManager {

    readonly #notifier: Notifier<EventUnion, NotifyUnion>;


    constructor(notifier: Notifier<EventUnion, NotifyUnion>) {
        this.#notifier = notifier;
    }

    public download(attachment: Attachment, url: string) {
        const client = new AttachmentsTransferClient(this.#notifier, attachment);
        return client.downloadAttachment(url);
    }
}
