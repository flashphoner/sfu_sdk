const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");

function controller(options = {}) {
    const callbacks = new Map();
    const detached = [];
    const calls = [];
    const events = Object.fromEntries(["PARTICIPANT_LIST", "JOINED", "LEFT", "ADD_TRACKS", "REMOVE_TRACKS", "TRACK_QUALITY_STATE", "ENDED"].map(name => [name, name]));
    const room = {
        id: () => "test-room",
        on(event, callback) { callbacks.set(event, callback); return this; }
    };
    if (options.off !== false) room.off = (event, callback) => {
        assert.equal(callbacks.get(event), callback);
        detached.push(event);
        return room;
    };
    const model = {};
    for (const name of ["setMeetingName", "addParticipant", "removeParticipant", "addTracks", "removeTracks", "updateQualityInfo", "end"]) {
        model[name] = (...args) => calls.push([name, ...args]);
    }
    const context = vm.createContext({SFU: {constants: {SFU_ROOM_EVENT: events}}, room, model});
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../src/v2/dependencies/js/display.js"), "utf8") +
        "\nglobalThis.controller = createDefaultMeetingController(room, model);", context);
    return {callbacks, calls, detached, instance: context.controller};
}

test("meeting controller forwards participant, track and quality updates while active", () => {
    const c = controller();
    c.callbacks.get("PARTICIPANT_LIST")({participants: [{userId: "one", name: "Alice"}]});
    c.callbacks.get("JOINED")({userId: "two", name: "Bob"});
    c.callbacks.get("ADD_TRACKS")({info: {userId: "one", info: ["video"]}});
    c.callbacks.get("TRACK_QUALITY_STATE")({info: {userId: "one", tracks: ["high"]}});
    c.callbacks.get("REMOVE_TRACKS")({info: {userId: "one", info: ["video"]}});
    c.callbacks.get("LEFT")({userId: "two"});
    assert.deepEqual(c.calls, [
        ["setMeetingName", "test-room"], ["addParticipant", "one", "Alice"], ["addParticipant", "two", "Bob"],
        ["addTracks", "one", ["video"]], ["updateQualityInfo", "one", ["high"]],
        ["removeTracks", "one", ["video"]], ["removeParticipant", "two"]
    ]);
});

test("Stop detaches listeners and queued callbacks cannot recreate a disposed meeting", () => {
    const c = controller();
    c.instance.stop();
    assert.equal(c.detached.length, 7);
    for (const callback of c.callbacks.values()) callback();
    c.instance.stop();
    assert.deepEqual(c.calls, [["setMeetingName", "test-room"], ["end"]]);
    assert.equal(c.detached.length, 7);
});

test("room end uses the same cleanup and ignores callbacks even without an off API", () => {
    const c = controller({off: false});
    c.callbacks.get("ENDED")();
    c.callbacks.get("JOINED")({userId: "late", name: "Old participant"});
    c.callbacks.get("ADD_TRACKS")({info: {userId: "late", info: ["old video"]}});
    c.callbacks.get("ENDED")();
    c.instance.stop();
    assert.deepEqual(c.calls, [["setMeetingName", "test-room"], ["end"]]);
});
