/**
 * https://github.com/node-webrtc/node-webrtc/blob/develop/docs/nonstandard-apis.md#programmatic-video
 */

'use strict';

const { RTCVideoSource } = require('wrtc').nonstandard;

export class RTCVideoSourceWrapper {
    constructor() {
        const source = new RTCVideoSource();
        const width = 320;
        const height = 240;
        const data = new Uint8ClampedArray(width * height * 1.5);
        const frame = { width, height, data };

        const interval = setInterval(() => {
            // Update the frame in some way before sending.
            source.onFrame(frame);
        });

        this.createTrack = () => {
            return source.createTrack();
        };
    }
}

module.exports = RTCVideoSourceWrapper;