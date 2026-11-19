const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const { JSDOM } = require('jsdom');

test('distribution ships four v2 pages and their local assets alongside legacy pages', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sfu-examples-'));
    const config = require('../webpack.config.js');
    const compiler = webpack({ ...config, mode: 'production', context: path.join(__dirname, '..'),
        output: { ...config.output, path: directory } });
    try {
        await new Promise((resolve, reject) => compiler.run((error, stats) => {
            if (error) return reject(error);
            if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
            resolve();
        }));
        for (const page of ['client/main.html', 'webrtc-abr-player/player.html',
            'two-way-streaming/two-way-streaming.html', 'player/player.html']) {
            assert.ok(fs.statSync(path.join(directory, page)).isFile(), 'legacy ' + page);
            const entry = 'v2/' + page;
            const dom = new JSDOM(fs.readFileSync(path.join(directory, entry), 'utf8'));
            assert.equal(dom.window.document.documentElement.dataset.wcsTheme, 'light');
            for (const element of dom.window.document.querySelectorAll('script[src],link[href]')) {
                const resource = element.getAttribute('src') || element.getAttribute('href');
                assert.ok(!/^(?:https?:)?\/\//.test(resource), 'local dependency: ' + resource);
                const resolved = path.resolve(directory, path.dirname(entry), resource);
                assert.ok(resolved.startsWith(directory + path.sep), 'asset inside distribution');
                assert.ok(fs.statSync(resolved).isFile(), entry + ' -> ' + resource);
            }
            dom.window.close();
        }
        for (const resource of ['sfu.js', 'commons/media/silence.mp3', 'v2/client/config.json',
            'v2/player/config.json', 'v2/two-way-streaming/config.json']) {
            assert.ok(fs.statSync(path.join(directory, resource)).isFile(), resource);
        }
        const manifest = require('../package.json');
        const bundledSdk = require('@flashphoner/sfusdk/package.json');
        assert.equal(bundledSdk.version, manifest.devDependencies['@flashphoner/sfusdk']);
        assert.equal(manifest.dependencies['@flashphoner/sfusdk'], undefined,
            'the published examples already include the SDK in sfu.js');
    } finally {
        await new Promise((resolve) => compiler.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
