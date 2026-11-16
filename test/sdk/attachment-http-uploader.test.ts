import {
    uploadAttachmentBody,
    UPLOAD_ABORTED,
    UPLOAD_NETWORK_FAILURE
} from "../../src/sdk/attachments/attachment-http-uploader";

class FakeXhr {
    static last: FakeXhr;
    upload: { onprogress?: (event: { loaded: number, total: number }) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    status = 0;
    response: unknown = undefined;
    responseType = "";

    constructor() {
        FakeXhr.last = this;
    }

    open() {
        // do nothing
    }

    setRequestHeader() {
        // do nothing
    }

    send() {
        // do nothing
    }

    abort() {
        this.onabort?.();
    }

    progress(loaded: number, total: number) {
        this.upload.onprogress?.({loaded, total});
    }
}

const BODY = new ArrayBuffer(8);
const UPLOAD_URL = "https://files.example.com:8444/attachment-upload/m1/a1";

describe("uploadAttachmentBody over XMLHttpRequest", () => {
    const realXhr = global.XMLHttpRequest;

    beforeEach(() => {
        jest.useFakeTimers();
        (global as any).XMLHttpRequest = FakeXhr;
    });

    afterEach(() => {
        jest.useRealTimers();
        (global as any).XMLHttpRequest = realXhr;
    });

    const failureOf = async (promise: Promise<unknown>): Promise<string> => {
        try {
            await promise;
            return "";
        } catch (e) {
            return (e as Error).message;
        }
    };

    it("should give the first byte the stall timeout unless a connect timeout is set", async () => {
        const upload = uploadAttachmentBody({url: UPLOAD_URL, body: BODY});
        const failure = failureOf(upload.promise);

        jest.advanceTimersByTime(119000);
        FakeXhr.last.progress(1, 8);
        jest.advanceTimersByTime(119000);
        FakeXhr.last.status = 200;
        FakeXhr.last.onload?.();

        expect(await failure).toEqual("");
    });

    it("should fail an upload that sent nothing within the connect timeout, as not having reached the server", async () => {
        const upload = uploadAttachmentBody({url: UPLOAD_URL, body: BODY, connectTimeoutMs: 20000});
        const failure = failureOf(upload.promise);

        jest.advanceTimersByTime(20000);

        expect(await failure).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(upload.reachedServer()).toBe(false);
    });

    it("should go by the stall timeout once the first byte left", async () => {
        const upload = uploadAttachmentBody({url: UPLOAD_URL, body: BODY, connectTimeoutMs: 20000});
        const failure = failureOf(upload.promise);

        jest.advanceTimersByTime(19000);
        FakeXhr.last.progress(1, 8);
        jest.advanceTimersByTime(119000);
        expect(upload.reachedServer()).toBe(true);
        jest.advanceTimersByTime(1000);

        expect(await failure).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(upload.reachedServer()).toBe(true);
    });

    it("should wait for the answer without a limit once the whole body left", async () => {
        const upload = uploadAttachmentBody({url: UPLOAD_URL, body: BODY, connectTimeoutMs: 20000});
        const failure = failureOf(upload.promise);

        FakeXhr.last.progress(8, 8);
        jest.advanceTimersByTime(600000);
        FakeXhr.last.status = 200;
        FakeXhr.last.onload?.();

        expect(await failure).toEqual("");
    });

    it("should drop the connect timeout at the first byte when the stall timeout is off", async () => {
        const upload = uploadAttachmentBody({url: UPLOAD_URL, body: BODY, connectTimeoutMs: 20000, stallTimeoutMs: 0});
        const failure = failureOf(upload.promise);

        FakeXhr.last.progress(1, 8);
        jest.advanceTimersByTime(600000);
        FakeXhr.last.status = 200;
        FakeXhr.last.onload?.();

        expect(await failure).toEqual("");
    });

    it("should tell an abort by the caller from a network failure", async () => {
        const aborted = uploadAttachmentBody({url: UPLOAD_URL, body: BODY});
        const abortedFailure = failureOf(aborted.promise);
        aborted.abort();

        const broken = uploadAttachmentBody({url: UPLOAD_URL, body: BODY});
        const brokenFailure = failureOf(broken.promise);
        FakeXhr.last.onerror?.();

        expect(await abortedFailure).toEqual(UPLOAD_ABORTED);
        expect(await brokenFailure).toEqual(UPLOAD_NETWORK_FAILURE);
        expect(broken.reachedServer()).toBe(false);
    });
});
