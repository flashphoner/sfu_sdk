import {Connection} from "../../src/sdk/connection";
import {InternalApi, SfuEvent} from "../../src/sdk/constants";
import {url, wrongWsUrl} from "../util/constants";

describe("connection", () => {
    it("should connect", async () => {
        const connection = new Connection((message, data) => {}, () => {},() => {}, () => {});
        await connection.connect({
            url: url,
            appName: InternalApi.P_APP,
            timeout: 1000,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        });
        await connection.close();
    });
    it("should send message", async () => {
        const connection = new Connection((message, data) => {}, () => {}, () => {}, () => {});
        await connection.connect({
            url: url,
            appName: InternalApi.P_APP,
            timeout: 1000,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        });
        connection.send("ping", "");
    });
    it("should fail on missing ping from server", async (done) => {
        const connection = new Connection(
            (message, data) => {},
            () => {},
            (error) => {
                expect(error.type).toEqual(SfuEvent.CONNECTION_FAILED);
                done();
            },
            () => {}
        );
        await connection.connect({
            url: url,
            appName: InternalApi.P_APP,
            timeout: 1000,
            failedProbesThreshold: 2,
            pingInterval: 100,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        });
    });
    it("should not connect to wrong WS URL", async () => {
        const connection = new Connection((message, data) => {}, () => {}, () => {}, () => {});
        await expect(connection.connect({
            url: wrongWsUrl,
            appName: InternalApi.P_APP,
            timeout: 1000,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        })).rejects.toBeInstanceOf(Event);
    });
})