import {
    HttpUpload,
    HttpUploadOptions,
    HttpUploadResult,
    uploadAttachmentBody,
    UPLOAD_ABORTED,
    UPLOAD_NETWORK_FAILURE
} from "./attachment-http-uploader";
import { resolveServerUrl } from "../server-url";

export class PublicUploadAddress {
    readonly #retryAfterMs: number;
    #failedAt = 0;

    constructor(retryAfterMs: number) {
        this.#retryAfterMs = retryAfterMs;
    }

    givenUp(): boolean {
        const elapsed = Date.now() - this.#failedAt;
        return elapsed >= 0 && elapsed < this.#retryAfterMs;
    }

    giveUp(): void {
        this.#failedAt = Date.now();
    }

    reset(): void {
        this.#failedAt = 0;
    }
}

export function uploadAddressOf(link: string, publicAddress: boolean | undefined, connectionUrl: string): string {
    return publicAddress ? link : resolveServerUrl(link, connectionUrl);
}

export type LinkUploadAttempt = {
    address: PublicUploadAddress;
    publicAddress: boolean;
    recheckDelayMs: number;
    connectionLost: () => boolean;
    cancelled: () => boolean;
    passFailed: () => boolean;
    onStart: (upload: HttpUpload) => void;
    onEnd: (upload: HttpUpload) => void;
    onGivenUp: () => void;
};

/* One failure may be a hiccup of this client's own network: only the second in a row gives the address up. */
export async function uploadByLink(options: HttpUploadOptions, attempt: LinkUploadAttempt): Promise<HttpUploadResult> {
    for (let failures = 0; ; failures++) {
        const upload = uploadAttachmentBody(options);
        attempt.onStart(upload);
        try {
            return await upload.promise;
        } catch (e) {
            const unreached = attempt.publicAddress && !upload.reachedServer() && !attempt.connectionLost()
                && !attempt.address.givenUp() && e instanceof Error && e.message === UPLOAD_NETWORK_FAILURE;
            if (!unreached) {
                throw e;
            }
            if (failures > 0) {
                attempt.address.giveUp();
                attempt.onGivenUp();
                throw e;
            }
        } finally {
            attempt.onEnd(upload);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt.recheckDelayMs));
        if (attempt.cancelled()) {
            throw new Error(UPLOAD_ABORTED);
        }
        if (attempt.connectionLost() || attempt.passFailed() || attempt.address.givenUp()) {
            throw new Error(UPLOAD_NETWORK_FAILURE);
        }
    }
}
