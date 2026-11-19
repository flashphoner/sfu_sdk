const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {JSDOM} = require('jsdom');
const src = path.resolve(__dirname, '../src');
const read = name => fs.readFileSync(path.join(src, name), 'utf8');
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));

async function client(options = {}) {
    const html = read('v2/client/main.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(' onload="init()"', '');
    const dom = new JSDOM(html, {url: 'https://demo.example/client2/sfu/v2/client/main.html', runScripts: 'outside-only'});
    const w = dom.window;
    const events = {FAILED: 'FAILED', DISCONNECTED: 'DISCONNECTED', OPERATION_FAILED: 'OPERATION_FAILED', ENDED: 'ENDED', DROPPED: 'DROPPED', MESSAGE: 'MESSAGE', JOINED: 'JOINED', LEFT: 'LEFT'};
    const rooms = [];
    const pcs = [];
    const captures = [];
    const sessions = [];
    const createRoom = async config => {
        if (options.createRoom) await options.createRoom(config);
        const handlers = new Map();
        const room = {
            config, joined: false, sends: [], clientListeners: new Set(), serverListeners: new Set(),
            on(name, handler) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(handler); return this; },
            emit(name, value) { for (const handler of handlers.get(name) || []) handler(value); },
            async join(...args) { this.joined = true; this.joinArgs = args; },
            async updateState(config) { this.lastUpdate = config; },
            async sendMessage(text) { this.sends.push(text); },
            userId() { return 'local-user-123'; },
            addTrafficListener(fn) { this.clientListeners.add(fn); },
            removeTrafficListener(fn) { this.clientListeners.delete(fn); },
            addServerTrafficListener(fn) { this.serverListeners.add(fn); },
            removeServerTrafficListener(fn) { this.serverListeners.delete(fn); },
            async getTraffic() { return null; }
        };
        const session = {room: () => room, handlers: new Map(), closed: false,
            on(name, handler) { this.handlers.set(name, handler); return this; },
            async disconnect() { this.closed = true; }
        };
        rooms.push(room); sessions.push(session);
        return session;
    };
    w.SFU = {constants: {SFU_EVENT: events, SFU_ROOM_EVENT: events, SFU_TRANSPORT_TYPE: {UDP: 'UDP', TCP: 'TCP'}}, createRoom};
    w.WCS_SERVER_URL = options.serverUrl || 'wss://selected.example:443';
    w.RTCPeerConnection = class {
        constructor(configuration) { this.configuration = configuration; this.senders = []; this.closed = false; pcs.push(this); }
        close() { this.closed = true; }
        addTransceiver(track, config) { this.senders.push({track, config}); }
        getSenders() { return this.senders; }
        removeTrack(sender) { this.senders = this.senders.filter(item => item !== sender); }
        restartIce() {}
    };
    const makeStream = kind => {
        const track = new w.EventTarget(); track.id = `track-${captures.length}`; track.kind = kind; track.stopped = false;
        track.stop = () => { track.stopped = true; };
        const stream = {id: `stream-${captures.length}`, getTracks: () => [track], getAudioTracks: () => kind === 'audio' ? [track] : [], getVideoTracks: () => kind === 'video' ? [track] : []};
        captures.push(stream); return stream;
    };
    Object.defineProperty(w.navigator, 'mediaDevices', {value: {
        getUserMedia: async constraints => options.capture ? options.capture(constraints, makeStream) : makeStream(constraints.video ? 'video' : 'audio'),
        getDisplayMedia: async () => makeStream('video')
    }});
    w.eval(read('commons/dependencies/jquery@3.6.0/jquery.min.js'));
    w.eval(read('commons/dependencies/datatables@1.10.24/js/jquery.dataTables.min.js'));
    w.eval([
        read('commons/js/util.js'), read('v2/dependencies/js/ui.js'),
        `const PARTICIPANT_VIEW_TYPE = {ONE_TO_ONE: "One-to-one", ONE_TO_MANY: "One-to-many"};
        const ABR_KEEP_ON_QUALITY = 20000, ABR_TRY_UPPER_QUALITY = 20000, ABR_QUALITY_CHECK_PERIOD = 1000;
        const initLocalDisplay = () => ({add() {}, stop() {}});
        const initDefaultRemoteDisplay = () => ({stop() {}});`,
        read('v2/client/quality.js'), read('v2/client/controls.js'), read('v2/client/chat.js'), read('v2/client/main.js'),
        'window.clientApi = {init, connect, disconnect, buildRtcConfiguration, roomConfig: () => cControls.roomConfig()};'
    ].join('\n;\n'));
    const config = JSON.parse(read('v2/client/config.json'));
    if (options.config) options.config(config);
    w.$.getJSON = async () => config;
    await w.clientApi.init();
    return {w, dom, api: w.clientApi, rooms, sessions, pcs, captures, makeStream};
}

test('SFU Client fills the selected WCS URL and retains transport, view and TURN options', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    assert.equal(c.w.document.getElementById('url').value, 'wss://selected.example');
    assert.deepEqual(Array.from(c.w.document.getElementById('transport').options, o => o.value), ['', 'UDP', 'TCP']);
    assert.deepEqual(Array.from(c.w.document.getElementById('participantViewType').options, o => o.value), ['One-to-one', 'One-to-many']);
    assert.equal(c.w.document.getElementById('startButton').disabled, false);
    assert.equal(c.api.buildRtcConfiguration({turnServer: '', forceRelay: false}), undefined);
    assert.throws(() => c.api.buildRtcConfiguration({turnServer: '', forceRelay: true}), /requires a TURN/);
    const rtc = c.api.buildRtcConfiguration({turnServer: 'turn:user:pass@relay.example:3478?transport=udp', forceRelay: true});
    assert.equal(rtc.iceTransportPolicy, 'relay');
    assert.equal(rtc.iceServers[0].username, 'user');
    assert.equal(rtc.iceServers[0].credential, 'pass');
});

test('SFU Client joins with configured tracks and disconnect releases media, listeners and connection', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    assert.equal(c.rooms.length, 1);
    assert.equal(c.rooms[0].joined, true);
    assert.equal(c.pcs[0].senders.length, 1);
    assert.equal(c.pcs[0].senders[0].config.sendEncodings[0].scalabilityMode, 'L1T3');
    assert.equal(c.rooms[0].joinArgs[3], 10);
    assert.equal(c.w.document.getElementById('connectionStatus').textContent, 'ESTABLISHED');
    await c.api.disconnect();
    assert.equal(c.sessions[0].closed, true);
    assert.equal(c.pcs[0].closed, true);
    assert.equal(c.captures[0].getTracks()[0].stopped, true);
    assert.equal(c.rooms[0].clientListeners.size, 0);
    assert.equal(c.rooms[0].serverListeners.size, 0);
    assert.equal(c.w.document.getElementById('startButton').disabled, false);
    assert.equal(c.w.document.getElementById('addVideoTrack').disabled, true);
});

test('SFU Client failure after an earlier capture restores controls and stops already captured media', async t => {
    let calls = 0;
    const c = await client({
        config(config) { config.media.audio.tracks.push({source: 'mic', channels: 1}); },
        capture(constraints, makeStream) { if (++calls === 2) throw new Error('Camera denied'); return makeStream('audio'); }
    });
    t.after(() => c.dom.window.close());
    await c.api.connect();
    assert.match(c.w.document.getElementById('errorMsg').textContent, /Camera denied/);
    assert.equal(c.captures[0].getTracks()[0].stopped, true);
    assert.equal(c.pcs[0].closed, true);
    assert.equal(c.w.document.getElementById('startButton').disabled, false);
    assert.equal(c.rooms[0].joined, false);
});

test('SFU Client cancellation while connecting closes the late session without joining', async t => {
    const pending = deferred();
    const c = await client({createRoom: () => pending.promise}); t.after(() => c.dom.window.close());
    const connecting = c.api.connect();
    await c.api.disconnect();
    pending.resolve();
    await connecting;
    assert.equal(c.sessions[0].closed, true);
    assert.equal(c.rooms[0].joined, false);
    assert.equal(c.pcs[0].closed, true);
    assert.equal(c.captures.length, 0);
});

test('SFU Client cancellation during media permission stops a late capture', async t => {
    const pending = deferred();
    const c = await client({capture: async (constraints, makeStream) => { await pending.promise; return makeStream('video'); }});
    t.after(() => c.dom.window.close());
    const connecting = c.api.connect();
    await settle();
    await c.api.disconnect();
    pending.resolve();
    await connecting;
    assert.equal(c.captures[0].getTracks()[0].stopped, true);
    assert.equal(c.rooms[0].joined, false);
    assert.equal(c.w.document.getElementById('videoTracksTableBody').children.length, 1); // DataTables empty-state row.
});

test('SFU Client reconnect binds chat once and renders remote message content as text', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    await c.api.disconnect();
    await c.api.connect();
    c.w.document.getElementById('localMessage').value = 'hello';
    c.w.document.getElementById('sendMessage').click();
    await settle();
    assert.deepEqual(c.rooms[0].sends, []);
    assert.deepEqual(c.rooms[1].sends, ['hello']);
    c.rooms[1].emit('MESSAGE', {message: {nickName: '<img src=x>', userId: 'remote', message: JSON.stringify({payload: '<script>bad()</script>'})}});
    assert.equal(c.w.document.querySelector('#messages img'), null);
    assert.equal(c.w.document.querySelector('#messages script'), null);
    assert.match(c.w.document.getElementById('messages').textContent, /<script>bad\(\)<\/script>/);
    c.rooms[0].emit('MESSAGE', {message: {nickName: 'old', userId: 'old', message: JSON.stringify({payload: 'stale message'})}});
    assert.doesNotMatch(c.w.document.getElementById('messages').textContent, /stale message/);
});


test('SFU Client adds screen tracks with typed encodings and removes ended tracks', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    const d = c.w.document;
    d.getElementById('addVideoTrackEncodingActive').value = 'false';
    d.getElementById('addVideoTrackEncodingMaxBitrate').value = '250000';
    d.getElementById('addVideoTrackEncodingResolutionScale').value = '2';
    d.getElementById('addVideoTrackEncoding').click();
    d.getElementById('addVideoTrackSource').value = 'screen';
    d.getElementById('addVideoTrack').click();
    await settle();
    assert.equal(c.pcs[0].senders.length, 2);
    const sender = c.pcs[0].senders[1];
    assert.equal(sender.config.sendEncodings[0].active, false);
    assert.equal(sender.config.sendEncodings[0].maxBitrate, 250000);
    assert.equal(sender.config.sendEncodings[0].scaleResolutionDownBy, 2);
    assert.equal(c.rooms[0].lastUpdate[sender.track.id], 'screen');
    sender.track.dispatchEvent(new c.w.Event('ended'));
    await settle();
    assert.equal(c.pcs[0].senders.length, 1);
    assert.equal(sender.track.stopped, true);
});

test('SFU Client room termination releases media and restores connection controls', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    c.rooms[0].emit('ENDED');
    await settle();
    assert.equal(c.captures[0].getTracks()[0].stopped, true);
    assert.equal(c.w.document.getElementById('startButton').disabled, false);
    assert.match(c.w.document.getElementById('errorMsg').textContent, /Room is ended/);
});

test('SFU Client renders configured table data without interpreting markup', async t => {
    const c = await client({config(config) { config.media.video.tracks[0].codec = '<img src=x onerror=bad()>'; }});
    t.after(() => c.dom.window.close());
    await c.api.connect();
    assert.equal(c.w.document.querySelector('#videoTracksTable img'), null);
    assert.match(c.w.document.getElementById('videoTracksTable').textContent, /<img src=x/);
});


test('SFU Client disconnect clears live route and traffic measurements', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    for (const listener of c.rooms[0].clientListeners) listener({outboundBitrate: 1000, inboundBitrate: 2000, badges: {participants: [], links: []}});
    assert.equal(c.w.document.getElementById('stat-outbound').textContent, '1 kbps');
    assert.equal(c.w.document.getElementById('outbound-status').classList.contains('active'), true);
    await c.api.disconnect();
    assert.equal(c.w.document.getElementById('stat-outbound').textContent, '0 bps');
    assert.equal(c.w.document.getElementById('stat-inbound').textContent, '0 bps');
    assert.equal(c.w.document.getElementById('stat-ping').textContent, '—');
    assert.equal(c.w.document.getElementById('outbound-status').classList.contains('active'), false);
    assert.equal(c.w.document.getElementById('stat-route').textContent, 'Unknown');
    assert.equal(c.w.document.getElementById('topology-diagram').textContent, 'No connection data');
});

test('SFU Client encoding details are reachable with native buttons', async t => {
    const c = await client(); t.after(() => c.dom.window.close());
    await c.api.connect();
    const button = c.w.document.querySelector('#videoTracksTable .track-details');
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.match(button.closest('tr').nextElementSibling.textContent, /scalabilityMode/);
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'false');
});
