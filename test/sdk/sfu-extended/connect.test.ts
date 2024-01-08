import {SfuEvent, SfuExtended, State} from "../../../src";
import {TEST_USER_0, url} from "../../util/constants";
import {Verbosity} from "../../../src/sdk/logger";
import {ConnectionFailedEvent} from "../../../src/sdk/constants";

describe("connect", () => {
    let sfu: SfuExtended;
    beforeEach(() => {
        sfu = new SfuExtended(Verbosity.DEBUG, () => "[" + expect.getState().currentTestName + "]");
    })
    afterEach(() => {
        sfu.disconnect();
        sfu = null;
    })
    it("Should connect", (done) => {
        sfu.on(SfuEvent.CONNECTED, async () => {
            const user = sfu.user();
            expect(user).toBeTruthy();
            expect(user.username).toEqual(TEST_USER_0.username);
            expect(user.nickname).toEqual(TEST_USER_0.nickname);
            expect(user.pmi).toBeTruthy();
            await sfu.disconnect();
            done();
        });
        sfu.connect({
            url: url,
            ...TEST_USER_0
        });
    });
    it("Should disconnect", (done) => {
        sfu.on(SfuEvent.CONNECTED, async () => {
            await sfu.disconnect();
        }).on(SfuEvent.DISCONNECTED, () => {
            done();
        });
        sfu.connect({
            url: url,
            ...TEST_USER_0
        });
    });
    it("Should reconnect after disconnect", async () => {
        await sfu.connect({
            url: url,
            ...TEST_USER_0
        });
        await sfu.disconnect();
        expect(sfu.state()).toEqual(State.DISCONNECTED);
        const user = await sfu.connect({
            url: url,
            ...TEST_USER_0
        });
        expect(user).toBeTruthy();
        expect(user.username).toEqual(TEST_USER_0.username);
        expect(user.nickname).toEqual(TEST_USER_0.nickname);
        expect(user.pmi).toBeTruthy();
    });
    it("Should disconnect by missing pings", (done) => {
        sfu.on(SfuEvent.CONNECTION_FAILED, async (e) => {
            const event = e as ConnectionFailedEvent;
            expect(event.reason).toMatch("connection seems to be down");
            done();
        });
        sfu.connect({
            url: url,
            failedProbesThreshold: 2,
            pingInterval: 100,
            ...TEST_USER_0
        });
    });
})