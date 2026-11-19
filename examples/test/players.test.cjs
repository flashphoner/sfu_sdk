const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");

const source = path.resolve(__dirname, "../src/v2");
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
const emitter = () => ({
    listeners: new Map(),
    on(event, callback) { this.listeners.set(event, callback); return this; },
    emit(event, value) { const callback = this.listeners.get(event); if (callback) callback(value); }
});

function harness(page, config) {
    const elements = new Map();
    const field = (id) => {
        if (!elements.has(id)) elements.set(id, {
            value: "value", textContent: "", disabled: false, hidden: false,
            attributes: {}, listeners: {},
            setAttribute(key, value) { this.attributes[key] = value; },
            addEventListener(event, callback) { this.listeners[event] = callback; },
            focus() { this.focused = true; },
            click() { this.listeners.click(); }
        });
        return elements.get(id);
    };
    const peers = [], sessions = [], displays = [], captures = [];
    const events = {SFU_EVENT: {FAILED: "session-failed", DISCONNECTED: "disconnected"}, SFU_ROOM_EVENT: {
        FAILED: "room-failed", OPERATION_FAILED: "operation-failed", ENDED: "ended", DROPPED: "dropped", PARTICIPANT_LIST: "participants"
    }};
    const environment = {
        safari: false, createRoom: null, capture: null, unlock: null,
        document: {getElementById: field},
        window: {location: {search: ""}, addEventListener() {}},
        console: {warn() {}}, URLSearchParams,
        SfuExample: {
            serverUrl: () => "wss://selected.example:8443",
            status(id, text, kind) { field(id).textContent = text; field(id).kind = kind; }
        },
        SFU: {constants: events, async createRoom(options) {
            if (environment.createRoom) return environment.createRoom(options);
            const room = Object.assign(emitter(), {
                name: () => options.roomName,
                joins: [], async join(...args) { this.joins.push(args); },
                updates: 0, async updateState() { this.updates++; }
            });
            const session = Object.assign(emitter(), {
                options, room: () => room, disconnects: 0,
                async disconnect() { this.disconnects++; }
            });
            sessions.push(session);
            return session;
        }},
        RTCPeerConnection: class {
            constructor() { this.closed = false; this.senders = []; peers.push(this); }
            close() { this.closed = true; }
            addTransceiver(track, options) { this.senders.push({track, options}); }
            getSenders() { return this.senders; }
            removeTrack(sender) { this.senders.splice(this.senders.indexOf(sender), 1); }
        },
        Browser: () => ({isSafariWebRTC: () => environment.safari}),
        async playFirstSound() { if (environment.unlock) return environment.unlock(); },
        createUUID: () => "abcd",
        async fetch(url) { environment.fetched = url; return {ok: true, json: async () => config || {room: {pin: "secret"}, initPoolParticipantsCount: 7, idleTransceiverTimeoutMs: 1234}}; },
        navigator: {mediaDevices: {
            async getUserMedia(constraints) { return capture(constraints); },
            async getDisplayMedia(constraints) { return capture(constraints); }
        }},
        initDefaultRemoteDisplay: display,
        initLocalDisplay: display,
        initRemoteDisplay: display,
        createDefaultMeetingController() {}, createDefaultMeetingModel() {}, createDefaultMeetingView() {},
        oneToOneParticipantFactory: (value) => value, remoteTrackProvider: (value) => value,
        ABR_KEEP_ON_QUALITY: 20000, ABR_TRY_UPPER_QUALITY: 20000, ABR_QUALITY_CHECK_PERIOD: 1000
    };
    function display(...args) {
        const value = {args, stops: 0, added: [], stop() { this.stops++; }, add(...values) { this.added.push(values); }};
        displays.push(value);
        return value;
    }
    async function capture(constraints) {
        if (environment.capture) return environment.capture(constraints);
        const track = {id: "track-" + captures.length, stops: 0, listeners: {}, stop() { this.stops++; }, addEventListener(name, fn) { this.listeners[name] = fn; }};
        const stream = {id: "stream-" + captures.length, getTracks: () => [track]};
        captures.push({constraints, track, stream});
        return stream;
    }
    environment.window.SfuExample = environment.SfuExample;
    const context = vm.createContext(environment);
    const run = (file) => vm.runInContext(fs.readFileSync(path.join(source, file), "utf8"), context, {filename: file});
    run("dependencies/js/session.js");
    environment.SfuExampleSession = environment.window.SfuExampleSession;
    vm.runInContext(fs.readFileSync(path.join(source, "../commons/js/config.js"), "utf8"), context);
    if (page) run(page);
    return {environment, field, peers, sessions, displays, captures, events, run};
}

test("player keeps the configured room PIN, pool size and timeout, and uses the embedded server", async () => {
    const h = harness("player/player.js");
    await settle();
    assert.equal(h.field("url").value, "wss://selected.example:8443");
    h.field("playBtn").click();
    await settle();
    assert.equal(h.sessions[0].options.pin, "secret");
    assert.equal(h.sessions[0].room().joins[0][3], 7);
    assert.equal(h.sessions[0].room().joins[0][4], 1234);
    assert.equal(h.displays[0].args[2].quality, true);
    assert.equal(h.field("playStatus").textContent, "Established");
});

test("Stop closes peer, display and session and allows another attempt", async () => {
    const h = harness("player/player.js");
    await settle(); h.field("playBtn").click(); await settle();
    h.field("playBtn").click();
    assert.equal(h.peers[0].closed, true);
    assert.equal(h.displays[0].stops, 1);
    assert.equal(h.sessions[0].disconnects, 1);
    assert.equal(h.field("url").disabled, false);
    h.field("playBtn").click(); await settle();
    assert.equal(h.sessions.length, 2);
});

test("callbacks from a stopped session do not reset a new attempt", async () => {
    const h = harness("player/player.js");
    await settle(); h.field("playBtn").click(); await settle();
    h.field("playBtn").click(); h.field("playBtn").click(); await settle();
    h.sessions[0].emit(h.events.SFU_EVENT.FAILED, new Error("old error"));
    h.sessions[0].room().emit(h.events.SFU_ROOM_EVENT.ENDED);
    assert.equal(h.field("playStatus").textContent, "Established");
    assert.equal(h.field("playErrorInfo").textContent, "");
    assert.equal(h.peers[1].closed, false);
});

test("failed connection closes the peer and restores controls", async () => {
    const h = harness("player/player.js"); await settle();
    h.environment.createRoom = async () => { throw new Error("Connection refused"); };
    h.field("playBtn").click(); await settle();
    assert.equal(h.peers[0].closed, true);
    assert.equal(h.field("playBtn").textContent, "Play");
    assert.equal(h.field("url").disabled, false);
    assert.equal(h.field("playErrorInfo").textContent, "Connection refused");
});

test("cancelling a pending connection disconnects a late session", async () => {
    const h = harness("player/player.js"); await settle();
    const pending = deferred(); let disconnects = 0;
    h.environment.createRoom = () => pending.promise;
    h.field("playBtn").click(); await settle(); h.field("playBtn").click();
    pending.resolve({async disconnect() { disconnects++; }}); await settle();
    assert.equal(disconnects, 1);
    assert.equal(h.peers[0].closed, true);
    assert.equal(h.field("playStatus").textContent, "Stopped");
});

test("Safari sound-unlock rejection restores Play and reports the failure", async () => {
    const h = harness("player/player.js"); await settle();
    h.environment.safari = true;
    h.environment.unlock = async () => { throw new Error("Playback blocked"); };
    h.field("playBtn").click(); await settle();
    assert.equal(h.sessions.length, 0);
    assert.equal(h.field("playBtn").textContent, "Play");
    assert.equal(h.field("playErrorInfo").textContent, "Playback blocked");
});

test("empty fields prevent connecting and identify the invalid input", async () => {
    const h = harness("player/player.js"); await settle();
    h.field("roomName").value = "   "; h.field("playBtn").click(); await settle();
    assert.equal(h.sessions.length, 0);
    assert.equal(h.field("roomName").attributes["aria-invalid"], "true");
    assert.equal(h.field("roomName").focused, true);
});

test("config query override loads requested JSON and malformed config falls back", async () => {
    const h = harness();
    h.environment.window.location.search = "?config=%2Fcustom.json";
    h.environment.fetch = async (url) => { h.environment.fetched = url; return {ok: true, json: async () => ({bad: true})}; };
    const config = await h.environment.SfuExampleSession.loadConfig({room: {pin: "fallback"}});
    assert.equal(h.environment.fetched, "/custom.json");
    assert.equal(config.room.pin, "fallback");
});

test("ABR uses stream room/PIN and retains automatic quality thresholds", async () => {
    const h = harness("webrtc-abr-player/player.js");
    h.field("streamName").value = "stream"; h.field("playBtn").click(); await settle();
    assert.equal(h.sessions[0].options.roomName, "stream");
    assert.equal(h.sessions[0].options.pin, 123456);
    assert.equal(h.displays[0].args[2].autoAbr, true);
    assert.equal(h.displays[0].args[3].thresholds.length, 3);
    assert.equal(h.sessions[0].room().joins[0][3], 1);
});

test("empty ABR participant list stops playback and permits retry", async () => {
    const h = harness("webrtc-abr-player/player.js");
    h.field("streamName").value = "stream"; h.field("playBtn").click(); await settle();
    h.sessions[0].room().emit(h.events.SFU_ROOM_EVENT.PARTICIPANT_LIST, {participants: []});
    assert.match(h.field("playErrorInfo").textContent, /not published/);
    assert.equal(h.displays[0].stops, 1);
    assert.equal(h.field("playBtn").textContent, "Play");
});

test("room operation failure preserves its error and cleans media", async () => {
    const h = harness("player/player.js"); await settle(); h.field("playBtn").click(); await settle();
    h.sessions[0].room().emit(h.events.SFU_ROOM_EVENT.OPERATION_FAILED, {operation: "join", error: "denied"});
    assert.equal(h.field("playErrorInfo").textContent, "join failed: denied");
    assert.equal(h.peers[0].closed, true);
});

const mediaConfig = () => ({room: {pin: "1234"}, media: {
    video: {tracks: [{source: "camera", width: 640, height: 360, encodings: [{rid: "high", maxBitrate: 900000}], type: "cam"}]},
    audio: {tracks: [{source: "mic", channels: 2, type: "mic"}]}
}});

test("two-way sessions publish configured tracks independently from playback", async () => {
    const h = harness("two-way-streaming/two-way-streaming.js", mediaConfig()); await settle();
    h.field("publishBtn").click(); await settle(); h.field("playBtn").click(); await settle();
    assert.equal(h.sessions.length, 2);
    assert.equal(h.peers[0].senders.length, 2);
    assert.equal(h.peers[0].senders[0].options.sendEncodings[0].rid, "high");
    assert.equal(h.sessions[0].room().joins[0][2][h.captures[0].track.id], "cam");
    assert.equal(h.captures[1].constraints.audio.stereo, true);
    h.field("publishBtn").click();
    assert.equal(h.peers[0].closed, true);
    assert.equal(h.peers[1].closed, false);
    assert.equal(h.field("url").disabled, true);
    assert.equal(h.captures[0].track.stops, 1);
    h.field("playBtn").click();
    assert.equal(h.field("url").disabled, false);
});

test("two-way rejects duplicate nickname while the other side is active", async () => {
    const h = harness("two-way-streaming/two-way-streaming.js", mediaConfig()); await settle();
    h.field("publishBtn").click(); await settle();
    h.field("playName").value = h.field("publishName").value;
    h.field("playBtn").click(); await settle();
    assert.equal(h.sessions.length, 1);
    assert.match(h.field("playErrorInfo").textContent, /same name/);
});

test("media acquired after cancellation is stopped without publishing", async () => {
    const h = harness("two-way-streaming/two-way-streaming.js", mediaConfig()); await settle();
    const pending = deferred(); let stops = 0;
    h.environment.capture = () => pending.promise;
    h.field("publishBtn").click(); await settle(); h.field("publishBtn").click();
    pending.resolve({getTracks: () => [{stop() { stops++; }}]}); await settle();
    assert.equal(stops, 1);
    assert.equal(h.sessions[0].room().joins.length, 0);
    assert.equal(h.field("publishStatus").textContent, "Stopped");
});

test("capture failure releases tracks already acquired in the same attempt", async () => {
    const h = harness("two-way-streaming/two-way-streaming.js", mediaConfig()); await settle();
    let stops = 0, captures = 0;
    h.environment.capture = async () => {
        if (captures++) throw new Error("Microphone denied");
        return {id: "camera", getTracks: () => [{id: "camera-track", stop() { stops++; }, addEventListener() {}}]};
    };
    h.field("publishBtn").click(); await settle();
    assert.equal(stops, 1);
    assert.equal(h.peers[0].closed, true);
    assert.equal(h.field("publishErrorInfo").textContent, "Microphone denied");
});

test("native track end removes its sender and renegotiates the publisher", async () => {
    const h = harness("two-way-streaming/two-way-streaming.js", mediaConfig()); await settle();
    h.field("publishBtn").click(); await settle();
    await h.captures[0].track.listeners.ended();
    assert.equal(h.peers[0].senders.length, 1);
    assert.equal(h.sessions[0].room().updates, 1);
});
