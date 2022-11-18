import {Connection} from "../../src/sdk/connection";
import {InternalApi} from "../../src/sdk/constants";

describe("connection", () => {
    it("should connect", async () => {
        const connection = new Connection((message, data) => {}, () => {},() => {}, () => {});
        await connection.connect({
            url: "ws://127.0.0.1:8080/",
            appName: InternalApi.P_APP,
            timeout: 1000,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        });
        connection.close();
    });
    it("should send message", async () => {
        const connection = new Connection((message, data) => {}, () => {}, () => {}, () => {});
        await connection.connect({
            url: "ws://127.0.0.1:8080/",
            appName: InternalApi.P_APP,
            timeout: 1000,
            custom: {
                nickname: "test",
                roomName: "test"
            }
        });
        connection.send("ping", "");
    });
})