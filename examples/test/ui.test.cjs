const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const uiSource = fs.readFileSync(path.join(__dirname, '../src/v2/dependencies/js/ui.js'), 'utf8');
const displaySource = fs.readFileSync(path.join(__dirname, '../src/v2/dependencies/js/display.js'), 'utf8');

function page(url = 'http://wcs.example.com/client2/sfu/v2/player/player.html') {
    const dom = new JSDOM('<div id="status"></div><div id="local"></div>', { url, runScripts: 'outside-only' });
    dom.window.eval(uiSource);
    return dom;
}

test('server default follows standalone protocol and supports IPv6', () => {
    for (const [url, expected] of [
        ['http://wcs.example.com/x', 'ws://wcs.example.com:8080'],
        ['https://wcs.example.com/x', 'wss://wcs.example.com:8443'],
        ['https://[::1]/x', 'wss://[::1]:8443']
    ]) {
        const dom = page(url);
        assert.equal(dom.window.SfuExample.serverUrl(), expected);
        dom.window.close();
    }
});

test('selected WCS is read at initialization after the embedding script runs', () => {
    const dom = page('https://llcast.example.com/proxied/page');
    dom.window.WCS_SERVER_URL = 'wss://selected-wcs.example.com:9443';
    assert.equal(dom.window.SfuExample.serverUrl(), 'wss://selected-wcs.example.com:9443');
    dom.window.WCS_SERVER_URL = 'ws://other-wcs.example.com:9080/';
    assert.equal(dom.window.SfuExample.serverUrl(), 'ws://other-wcs.example.com:9080');
    dom.window.close();
});

test('invalid embedded endpoints cannot silently connect to a different server', () => {
    const dom = page();
    for (const value of ['', 'https://wcs.example.com', 'wss://user:pass@wcs.example.com',
        'wss://wcs.example.com/path', 'wss://wcs.example.com/?query=1', 'wss://wcs.example.com/#hash']) {
        dom.window.WCS_SERVER_URL = value;
        assert.throws(() => dom.window.SfuExample.serverUrl(), undefined, value);
    }
    dom.window.close();
});

test('status displays errors as text and exposes semantic state to embedding themes', () => {
    const dom = page();
    dom.window.SfuExample.status('status', '<img src=x onerror=alert(1)>', 'error');
    const target = dom.window.document.getElementById('status');
    assert.equal(target.children.length, 0);
    assert.equal(target.textContent, '<img src=x onerror=alert(1)>');
    assert.equal(target.getAttribute('role'), 'alert');
    assert.equal(target.dataset.kind, 'error');
    dom.window.SfuExample.status('status', 'PLAYING', 'success');
    assert.equal(target.getAttribute('role'), 'status');
    assert.equal(target.dataset.kind, 'success');
    dom.window.SfuExample.status('status', null);
    assert.equal(target.textContent, '');
    dom.window.close();
});

test('participant names and track labels remain plain text in the v2 display', () => {
    const dom = page();
    dom.window.eval(displaySource + '\nwindow.displayTests = { createInfoDisplay, initLocalDisplay };');
    const text = '<img src=x onerror=alert(1)>';
    const display = dom.window.displayTests.createInfoDisplay(dom.window.document.body, text);
    assert.equal(display.textContent, text);
    assert.equal(display.querySelector('img'), null);
    const local = dom.window.displayTests.initLocalDisplay(dom.window.document.getElementById('local'));
    const stream = { id: 'local-stream', getAudioTracks: () => [], getVideoTracks: () => [], getTracks: () => [] };
    dom.window.Browser = () => ({ isSafariWebRTC: () => false });
    local.add('camera', text, stream, '<script>bad()</script>');
    assert.equal(dom.window.document.querySelector('#local img, #local script'), null);
    assert.match(dom.window.document.getElementById('local').textContent, /<img src=x/);
    local.stop();
    dom.window.close();
});
