import {SfuExtended, State} from "../../src";
import {Connection} from "../../src/sdk/connection";
import {InternalApi, WS_PING_INTERVAL_MS, WS_PINGS_MISSING_THRESHOLD} from "../../src/sdk/constants";
import Logger, {Verbosity} from "../../src/sdk/logger";
import {FakeWebSocket, flushPromises, outcomeOf} from "../util/fakeWebSocket";

const URL = "ws://127.0.0.1:8080/";
const SILENCE_MS = WS_PINGS_MISSING_THRESHOLD * WS_PING_INTERVAL_MS;

const openAndStaySilent = async () => {
    FakeWebSocket.last().open();
    jest.advanceTimersByTime(SILENCE_MS);
    await flushPromises();
    expect(FakeWebSocket.last().readyState).toEqual(3);
};

describe("connect over a socket that opens and gets no answer", () => {
    let restoreWebSocket: () => void;

    beforeEach(() => {
        jest.useFakeTimers("modern");
        restoreWebSocket = FakeWebSocket.install();
    });

    afterEach(() => {
        restoreWebSocket();
        jest.useRealTimers();
    });

    it("Connection.connect rejects once the pings are missed", async () => {
        const connection = new Connection(() => {}, () => {}, () => {}, () => {}, new Logger());
        const outcome = outcomeOf(connection.connect({url: URL, appName: InternalApi.Z_APP, custom: null}));

        await openAndStaySilent();

        expect(outcome.state).toEqual("rejected");
    });

    it("SfuExtended fails the attempt and opens a new socket on the next connect", async () => {
        const sfu = new SfuExtended(Verbosity.ERROR);
        const outcome = outcomeOf(sfu.connect({url: URL, username: "bob@flashphoner.com", password: "123456"}));

        await openAndStaySilent();

        expect(outcome.state).toEqual("rejected");
        expect(sfu.state()).toEqual(State.FAILED);
        sfu.connect({url: URL, username: "bob@flashphoner.com", password: "123456"}).catch(() => {});
        expect(FakeWebSocket.created).toHaveLength(2);
    });
});
