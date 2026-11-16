import {
    HttpUpload,
    HttpUploadResult,
    uploadAttachmentBody,
    UPLOAD_ABORTED,
    UPLOAD_NETWORK_FAILURE
} from "../../src/sdk/attachments/attachment-http-uploader";
import {
    LinkUploadAttempt,
    PublicUploadAddress,
    uploadAddressOf,
    uploadByLink
} from "../../src/sdk/attachments/public-upload-address";

jest.mock("../../src/sdk/attachments/attachment-http-uploader", () => ({
    ...(jest.requireActual("../../src/sdk/attachments/attachment-http-uploader") as object),
    uploadAttachmentBody: jest.fn()
}));

const RETRY_AFTER_MS = 600000;
const OPTIONS = {url: "https://files.example.com:8444/attachment-upload/m1/a1", body: new ArrayBuffer(8)};
const STORED: HttpUploadResult = {status: 200};

type Outcome = { result?: HttpUploadResult, failure?: string, reached?: boolean };

describe("uploadAddressOf", () => {
    const LINK = "https://zapp.example.com:8444/attachment-upload/m1/a1?sig=1";

    it("should leave a link to a public address as issued", () => {
        expect(uploadAddressOf(LINK, true, "wss://zapp.example.com")).toEqual(LINK);
    });

    it("should fit any other link to the connection", () => {
        expect(uploadAddressOf(LINK, false, "wss://zapp.example.com"))
            .toEqual("https://zapp.example.com/attachment-upload/m1/a1?sig=1");
    });
});

describe("uploadByLink", () => {
    let address: PublicUploadAddress;
    let givenUp: number;
    let cancelled: boolean;
    let connectionLost: boolean;
    let passFailed: boolean;

    const uploadsEnding = (...outcomes: Outcome[]) => {
        const uploader = uploadAttachmentBody as jest.Mock;
        uploader.mockReset();
        for (const outcome of outcomes) {
            uploader.mockImplementationOnce((): HttpUpload => ({
                promise: outcome.failure ? Promise.reject(new Error(outcome.failure)) : Promise.resolve(outcome.result!),
                abort: () => undefined,
                reachedServer: () => !!outcome.reached
            }));
        }
        return uploader;
    };

    const attempt = (publicAddress: boolean): LinkUploadAttempt => ({
        address,
        publicAddress,
        recheckDelayMs: 1,
        connectionLost: () => connectionLost,
        cancelled: () => cancelled,
        passFailed: () => passFailed,
        onStart: () => undefined,
        onEnd: () => undefined,
        onGivenUp: () => givenUp++
    });

    const failureOf = async (promise: Promise<unknown>): Promise<string> => {
        try {
            await promise;
            return "";
        } catch (e) {
            return (e as Error).message;
        }
    };

    beforeEach(() => {
        address = new PublicUploadAddress(RETRY_AFTER_MS);
        givenUp = 0;
        cancelled = false;
        connectionLost = false;
        passFailed = false;
    });

    it("should repeat an upload that did not reach a public address and keep the address once it goes through", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE}, {result: STORED, reached: true});

        expect(await uploadByLink(OPTIONS, attempt(true))).toBe(STORED);
        expect(uploader).toHaveBeenCalledTimes(2);
        expect(address.givenUp()).toBe(false);
    });

    it("should give a public address up on the second failure to reach it", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE}, {failure: UPLOAD_NETWORK_FAILURE});

        expect(await failureOf(uploadByLink(OPTIONS, attempt(true)))).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(uploader).toHaveBeenCalledTimes(2);
        expect(address.givenUp()).toBe(true);
        expect(givenUp).toBe(1);
    });

    it("should neither repeat nor give up an upload that broke after reaching the address", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE, reached: true});

        expect(await failureOf(uploadByLink(OPTIONS, attempt(true)))).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(uploader).toHaveBeenCalledTimes(1);
        expect(address.givenUp()).toBe(false);
    });

    it("should neither repeat nor give up a link that carries no public address", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE});

        expect(await failureOf(uploadByLink(OPTIONS, attempt(false)))).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(uploader).toHaveBeenCalledTimes(1);
        expect(address.givenUp()).toBe(false);
    });

    it("should not blame the address for a failure of the lost connection", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE});
        connectionLost = true;

        expect(await failureOf(uploadByLink(OPTIONS, attempt(true)))).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(uploader).toHaveBeenCalledTimes(1);
        expect(address.givenUp()).toBe(false);
    });

    it("should not repeat an upload cancelled before the repeat", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE});
        cancelled = true;

        expect(await failureOf(uploadByLink(OPTIONS, attempt(true)))).toEqual(UPLOAD_ABORTED);
        expect(uploader).toHaveBeenCalledTimes(1);
        expect(address.givenUp()).toBe(false);
    });

    it("should not repeat an upload once another one of the pass has failed", async () => {
        const uploader = uploadsEnding({failure: UPLOAD_NETWORK_FAILURE});
        passFailed = true;

        expect(await failureOf(uploadByLink(OPTIONS, attempt(true)))).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(uploader).toHaveBeenCalledTimes(1);
        expect(address.givenUp()).toBe(false);
    });

    it("should take the address back after the retry time and on a reset", () => {
        jest.useFakeTimers();
        try {
            address.giveUp();
            jest.advanceTimersByTime(RETRY_AFTER_MS - 1);
            expect(address.givenUp()).toBe(true);
            jest.advanceTimersByTime(1);
            expect(address.givenUp()).toBe(false);

            address.giveUp();
            address.reset();
            expect(address.givenUp()).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
