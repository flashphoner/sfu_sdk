import {Connection} from "../../src/sdk/connection";
import {
    InternalApi,
    SfuEvent,
    WS_CONNECTION_TIMEOUT,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD
} from "../../src/sdk/constants";
import Logger from "../../src/sdk/logger";
import {RTCMetricsMessageType} from "@flashphoner/web-sdk-metrics";
import {FakeWebSocket, flushPromises, outcomeOf} from "../util/fakeWebSocket";

const URL = "ws://127.0.0.1:8080/";
const SILENCE_MS = WS_PINGS_MISSING_THRESHOLD * WS_PING_INTERVAL_MS;
const USER_DATA = {sipLogin: "bob", email: "bob@flashphoner.com", sipVisibleName: "Bob", authToken: "token", pmi: "1"};

describe("Connection over a fake socket", () => {
    let restoreWebSocket: () => void;
    let onMessage: jest.Mock;
    let onBinaryData: jest.Mock;
    let onError: jest.Mock;
    let onClose: jest.Mock;
    let connection: Connection;

    const connect = (options: Partial<Parameters<Connection["connect"]>[0]> = {}) => outcomeOf(connection.connect({
        url: URL,
        appName: InternalApi.Z_APP,
        custom: {username: "bob"},
        ...options
    }));

    const connectAndAuthenticate = async (options: Partial<Parameters<Connection["connect"]>[0]> = {}) => {
        const outcome = connect(options);
        FakeWebSocket.last().open();
        FakeWebSocket.last().receive("getUserData", USER_DATA);
        await flushPromises();
        expect(outcome.state).toEqual("resolved");
        return FakeWebSocket.last();
    };

    beforeEach(() => {
        jest.useFakeTimers("modern");
        restoreWebSocket = FakeWebSocket.install();
        onMessage = jest.fn();
        onBinaryData = jest.fn();
        onError = jest.fn();
        onClose = jest.fn();
        connection = new Connection(onMessage, onBinaryData, onError, onClose, new Logger());
    });

    afterEach(() => {
        restoreWebSocket();
        jest.useRealTimers();
    });

    describe("an attempt", () => {
        it("opens a socket to the URL with binary type arraybuffer", () => {
            connect();

            expect(FakeWebSocket.created).toHaveLength(1);
            expect(FakeWebSocket.last().url).toEqual(URL);
            expect(FakeWebSocket.last().binaryType).toEqual("arraybuffer");
        });

        it("sends the connection message with the app, the token and the custom data once open", () => {
            connect({authToken: "held"});
            expect(FakeWebSocket.last().sent).toHaveLength(0);

            FakeWebSocket.last().open();

            const [sent] = FakeWebSocket.last().sentMessages();
            expect(sent.message).toEqual("connection");
            expect(sent.data[0]).toMatchObject({
                appKey: InternalApi.Z_APP,
                keepAlive: true,
                authToken: "held",
                custom: {username: "bob"}
            });
        });

        it("sends a null token when it has none", () => {
            connect();
            FakeWebSocket.last().open();

            expect(FakeWebSocket.last().sentMessages()[0].data[0]).toMatchObject({authToken: null});
        });

        it("resolves with the user data of getUserData", async () => {
            const outcome = connect();
            FakeWebSocket.last().open();

            FakeWebSocket.last().receive("getUserData", USER_DATA);
            await flushPromises();

            expect(outcome).toMatchObject({state: "resolved", value: USER_DATA});
        });

        it("rejects with the error of a socket that fails before it opens", async () => {
            const outcome = connect();
            const error = {type: "error"};

            FakeWebSocket.last().fail(error);
            await flushPromises();

            expect(outcome).toMatchObject({state: "rejected", reason: error});
            expect(onError).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
        });

        it("rejects with the close event of a socket the server closes before getUserData", async () => {
            const outcome = connect();
            FakeWebSocket.last().open();
            const closed = {code: 1006, reason: ""};

            FakeWebSocket.last().drop(closed);
            await flushPromises();

            expect(outcome).toMatchObject({state: "rejected", reason: closed});
            expect(onClose).not.toHaveBeenCalled();
        });

        it("closes a socket that does not open in time and rejects", async () => {
            const outcome = connect();

            jest.advanceTimersByTime(WS_CONNECTION_TIMEOUT - 1);
            await flushPromises();
            expect(outcome.state).toEqual("pending");

            jest.advanceTimersByTime(1);
            await flushPromises();

            expect(FakeWebSocket.last().readyState).toEqual(3);
            expect(outcome).toMatchObject({state: "rejected", reason: {type: "error"}});
        });

        it("drops its timeout once the socket closes before it opens", async () => {
            connect();

            FakeWebSocket.last().fail();
            await flushPromises();

            expect(jest.getTimerCount()).toEqual(0);
        });

        it("takes the timeout it is given", async () => {
            const outcome = connect({timeout: 1000});

            jest.advanceTimersByTime(1000);
            await flushPromises();

            expect(outcome.state).toEqual("rejected");
        });

        it("waits for the socket to open without a timeout of 0", async () => {
            const outcome = connect({timeout: 0});

            jest.advanceTimersByTime(10 * WS_CONNECTION_TIMEOUT);
            await flushPromises();

            expect(outcome.state).toEqual("pending");
        });

        it("rejects once the socket opened and the pings are missed", async () => {
            const outcome = connect();
            FakeWebSocket.last().open();

            jest.advanceTimersByTime(SILENCE_MS);
            await flushPromises();

            expect(FakeWebSocket.last().readyState).toEqual(3);
            expect(outcome.state).toEqual("rejected");
            expect(onError).not.toHaveBeenCalled();
        });

        it("rejects when it is closed while waiting for getUserData", async () => {
            const outcome = connect();
            FakeWebSocket.last().open();

            await connection.close();
            await flushPromises();

            expect(outcome.state).toEqual("rejected");
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe("messages", () => {
        it("answers a ping with a pong", async () => {
            const socket = await connectAndAuthenticate();

            socket.receive("ping");

            expect(socket.sentMessages().pop()).toEqual({message: "pong", data: [null]});
        });

        it("passes the other messages with their data to onMessage", async () => {
            const socket = await connectAndAuthenticate();

            socket.receive("someEvent", {id: 1});

            expect(onMessage).toHaveBeenCalledWith("someEvent", [{id: 1}]);
        });

        it("passes the traffic update by its type", async () => {
            const socket = await connectAndAuthenticate();

            socket.onmessage({data: JSON.stringify({type: InternalApi.TRAFFIC_UPDATE, data: [{roomId: "r"}]})});

            expect(onMessage).toHaveBeenCalledWith(InternalApi.TRAFFIC_UPDATE, [{roomId: "r"}]);
        });

        it("passes binary data to onBinaryData", async () => {
            const socket = await connectAndAuthenticate();
            const data = new ArrayBuffer(4);

            socket.receiveBinary(data);

            expect(onBinaryData).toHaveBeenCalledWith(InternalApi.BINARY_DATA, data);
            expect(onMessage).not.toHaveBeenCalled();
        });

        it("sends a message as JSON with its data in an array", async () => {
            const socket = await connectAndAuthenticate();

            connection.send("hello", {a: 1});

            expect(socket.sentMessages().pop()).toEqual({message: "hello", data: [{a: 1}]});
        });

        it("sends binary data as is", async () => {
            const socket = await connectAndAuthenticate();
            const data = {size: 3};

            connection.sendBinaryData(data);

            expect(socket.sent.pop()).toBe(data);
        });

        it("sends nothing before connect", () => {
            expect(() => connection.send("hello", {})).not.toThrow();
            expect(() => connection.sendBinaryData({size: 1})).not.toThrow();
        });
    });

    describe("metrics", () => {
        const refused = new Error("InvalidStateError");

        const refuseToSend = (socket: FakeWebSocket) => jest.spyOn(socket, "send").mockImplementation(() => {
            throw refused;
        });

        it("refuses the description and the batch before connect", async () => {
            await expect(connection.sendDescription({} as any)).rejects.toThrow("Connection closed");
            await expect(connection.sendBatch({} as any)).rejects.toThrow("Connection closed");
        });

        it("rejects the description, not throws, when the socket refuses to send", async () => {
            refuseToSend(await connectAndAuthenticate());
            let sending: Promise<number>;

            expect(() => sending = connection.sendDescription({} as any)).not.toThrow();
            await expect(sending).rejects.toBe(refused);
        });

        it("rejects the batch, not throws, when the socket refuses to send", async () => {
            refuseToSend(await connectAndAuthenticate());
            let sending: Promise<number>;

            expect(() => sending = connection.sendBatch({} as any)).not.toThrow();
            await expect(sending).rejects.toBe(refused);
        });

        it("sends the description and the batch once connected", async () => {
            const socket = await connectAndAuthenticate();

            await expect(connection.sendDescription({d: 1} as any)).resolves.toEqual(200);
            await expect(connection.sendBatch({b: 1} as any)).resolves.toEqual(200);

            expect(socket.sentMessages().slice(-2)).toEqual([
                {message: RTCMetricsMessageType.description, data: [{d: 1}]},
                {message: RTCMetricsMessageType.batch, data: [{b: 1}]}
            ]);
        });
    });

    describe("pings", () => {
        it("fail the connection with CONNECTION_FAILED once the threshold of them is missed", async () => {
            await connectAndAuthenticate();

            jest.advanceTimersByTime(SILENCE_MS - WS_PING_INTERVAL_MS);
            await flushPromises();
            expect(onError).not.toHaveBeenCalled();

            jest.advanceTimersByTime(WS_PING_INTERVAL_MS);
            await flushPromises();

            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError.mock.calls[0][0]).toMatchObject({
                type: SfuEvent.CONNECTION_FAILED,
                reason: expect.stringContaining(`Missing ${WS_PINGS_MISSING_THRESHOLD} pings`)
            });
            expect(onClose).not.toHaveBeenCalled();
            expect(FakeWebSocket.last().readyState).toEqual(3);
        });

        it("are counted afresh after any message", async () => {
            const socket = await connectAndAuthenticate();

            for (let i = 0; i < 4; i++) {
                jest.advanceTimersByTime(SILENCE_MS - WS_PING_INTERVAL_MS);
                socket.receive("someEvent");
            }
            await flushPromises();

            expect(onError).not.toHaveBeenCalled();
        });

        it("follow the threshold and the interval given", async () => {
            await connectAndAuthenticate({failedProbesThreshold: 2, pingInterval: 100});

            jest.advanceTimersByTime(200);
            await flushPromises();

            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("are not checked with a threshold of 0", async () => {
            await connectAndAuthenticate({failedProbesThreshold: 0});

            jest.advanceTimersByTime(10 * SILENCE_MS);
            await flushPromises();

            expect(onError).not.toHaveBeenCalled();
        });

        it("are not checked with an interval of 0", async () => {
            await connectAndAuthenticate({pingInterval: 0});

            jest.advanceTimersByTime(10 * SILENCE_MS);
            await flushPromises();

            expect(onError).not.toHaveBeenCalled();
        });

        it("stop being checked once the socket closes", async () => {
            const socket = await connectAndAuthenticate();
            socket.drop();

            jest.advanceTimersByTime(10 * SILENCE_MS);
            await flushPromises();

            expect(onError).not.toHaveBeenCalled();
        });
    });

    describe("an established connection", () => {
        it("reports a close by the server to onClose", async () => {
            const socket = await connectAndAuthenticate();
            const closed = {code: 1006, reason: "gone"};

            socket.drop(closed);

            expect(onClose).toHaveBeenCalledWith(closed);
            expect(onError).not.toHaveBeenCalled();
        });

        it("reports a network error to onError and not to onClose", async () => {
            const socket = await connectAndAuthenticate();
            const error = {type: "error"};

            socket.fail(error);

            expect(onError).toHaveBeenCalledWith(error);
            expect(onClose).not.toHaveBeenCalled();
        });

        it("reports close() to onClose and resolves it once the socket closed", async () => {
            const socket = await connectAndAuthenticate();

            const closing = outcomeOf(connection.close());
            expect(socket.readyState).toEqual(2);
            await flushPromises();

            expect(closing.state).toEqual("resolved");
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onError).not.toHaveBeenCalled();
        });

        it("reports close() with an error to onError", async () => {
            await connectAndAuthenticate();
            const error = {type: SfuEvent.CONNECTION_FAILED, reason: "test"} as any;

            await connection.close(error);

            expect(onError).toHaveBeenCalledWith(error);
            expect(onClose).not.toHaveBeenCalled();
        });

        it("resolves close() at once when the socket is already closed", async () => {
            const socket = await connectAndAuthenticate();
            socket.drop();

            const closing = outcomeOf(connection.close());
            await flushPromises();

            expect(closing.state).toEqual("resolved");
        });

        it("resolves close() even when onClose throws", async () => {
            const socket = await connectAndAuthenticate();
            jest.spyOn(socket, "close").mockImplementation(() => {});
            onClose.mockImplementation(() => {
                throw new Error("onClose failed");
            });

            const closing = outcomeOf(connection.close());
            expect(() => socket.drop()).toThrow("onClose failed");
            await flushPromises();

            expect(closing.state).toEqual("resolved");
        });

        it("resolves close() with an error even when onError throws", async () => {
            const socket = await connectAndAuthenticate();
            jest.spyOn(socket, "close").mockImplementation(() => {});
            onError.mockImplementation(() => {
                throw new Error("onError failed");
            });

            const closing = outcomeOf(connection.close({type: SfuEvent.CONNECTION_FAILED, reason: "test"} as any));
            expect(() => socket.drop()).toThrow("onError failed");
            await flushPromises();

            expect(closing.state).toEqual("resolved");
        });

        it("reports nothing more after it closed", async () => {
            const socket = await connectAndAuthenticate();
            socket.drop();

            socket.onclose?.({code: 1006, reason: ""});

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    it("close() before connect does nothing", async () => {
        await expect(connection.close()).resolves.toBeUndefined();
    });
});
