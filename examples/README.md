# @flashphoner/sfusdk

# Flashphoner WebCallServer SFU API (SFU SDK) usage examples

## Examples v2

Four pages are also available under `v2/` in the built distribution:

| Example | Page |
|---|---|
| WebRTC ABR Player | `v2/webrtc-abr-player/player.html` |
| SFU Client | `v2/client/main.html` |
| SFU Two Way Streaming | `v2/two-way-streaming/two-way-streaming.html` |
| SFU Player | `v2/player/player.html` |

The original pages remain at their existing URLs. The v2 pages use the same
locally bundled SFU SDK and vendor dependencies. Build from the repository root
with Node.js 18 or later and access to the configured Flashphoner npm registry:

```sh
npm --prefix examples ci --ignore-scripts
npm --prefix examples run test:examples
npm --prefix examples run build
```

The examples build bundles a published SFU SDK version into `sfu.js`. The npm
package contains the built distribution and can be installed independently.
Serve `examples/dist` over HTTP or HTTPS; its contents are installed at `client2/sfu`
on WCS. Include the whole distribution so the shared scripts, audio unlock file
and local vendor assets are available. The examples archive contains these
built files at its root.

The four v2 pages declare `data-wcs-theme="light"`. LLcast can set this attribute
to `dark` and supply `window.WCS_SERVER_URL` before initialization. The selected
WS/WSS endpoint takes precedence over the page host; standalone defaults remain
port 8080 for HTTP and 8443 for HTTPS. Embedded endpoints must be WS/WSS origins
without credentials, path, query or fragment. WCS `get_catalog_v2` lists each
SFU page only when its new entry file is installed, while the legacy catalog
continues to use the original URLs.

SFU Player and Two Way Streaming retain the `?config=` JSON override and default
fallback. They retain the configured room PIN, participant pool and idle timeout.
Two Way Streaming keeps independent publishing and playback sessions. SFU Client
retains transport selection, participant views, TURN/forced relay, media track
and simulcast/SVC controls, chat, quality selection, and connection statistics.
WebRTC ABR Player retains automatic/manual quality and reports when its source
stream ends. Screen capture requires a supported desktop browser. Safari may
require its audio unlock and a manual unmute.

The tests exercise page behavior with browser/media substitutes and verify the
actual webpack distribution. Live WCS media, TURN, screen capture and browser
compatibility checks remain separate.

Flashphoner [WebCallServer](https://flashphoner.com) [SFU](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast) API (SFU SDK) usage examples.

## Get the sources

Install as NPM package
```
npm init
npm install @flashphoner/sfusdk-examples
cd node_modules/@flashphoner/sfusdk-examples
```

or download from GitHub
```
git clone https://github.com/flashphoner/sfu_sdk.git
cd sfu_sdk/examples
```

## Build
```
npm install && npm run build
```

### Deploy to web server
```
mkdir -p /var/www/html/flashphoner-sfu-test
cp -r dist/* /var/www/html/flashphoner-sfu-test
```

## Documentation

[SFU functions description](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast)

[SFU SDK documentation](https://docs.flashphoner.com/display/SS1E/SFU+SDK+1.0+-+EN)

[SFU examples description](https://docs.flashphoner.com/display/SS1E/SFU+SDK+Examples)

[API documentation](http://flashphoner.com/docs/api/WCS5/client/sfu-sdk/latest)


