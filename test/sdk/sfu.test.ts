import {RoomState, Sfu, SfuEvent} from "../../src";

describe("sfu", () => {
    it("should connect", (done) => {
       const sfu = new Sfu();
       sfu.on(SfuEvent.CONNECTED, async () => {
           await sfu.disconnect();
           done();
       });
       sfu.connect({
           url: "ws://127.0.0.1:8080/",
           nickname: "test",
           logGroup: "test"
       });
    });
    it("should disconnect", (done) => {
        const sfu = new Sfu();
        sfu.on(SfuEvent.CONNECTED, async () => {
            await sfu.disconnect();
        }).on(SfuEvent.DISCONNECTED, () => {
            done();
        });
        sfu.connect({
            url: "ws://127.0.0.1:8080/",
            nickname: "test",
            logGroup: "test"
        });
    });
    it("should create room", async () => {
        const sfu = new Sfu();
        await sfu.connect({
            url: "ws://127.0.0.1:8080/",
            nickname: "test",
            logGroup: "test"
        });
        const room = await sfu.createRoom({
            name: "test",
            pin: "1234"
        });
        expect(room).toBeTruthy();
        expect(room.state()).toEqual(RoomState.NEW);
    });
});