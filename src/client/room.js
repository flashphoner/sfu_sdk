'use strict';

const ws = require('./ws');
const constants = require('./constants');

/**
 * Static initializer.
 *
 * @param {Object} options Room options
 * @param {String=} options.url Server url
 * @param {String=} options.name Room name
 * @param {String=} options.pin Room's pin
 * @param {String=} options.nickName Participant's nick
 * @param {Object=} options.pc Peer connection
 * @returns {Room} Room
 * @throws {TypeError} Error if no options provided
 * @memberof FSFU
 * @inner
 */
function createRoom(options) {
    if (!options) {
        throw new TypeError("No options provided");
    }
    const room = {};
    let joinCalled = false;
    const callbacks = {};
    const connection = ws.createConnection();

    connection.onMessage = function(name, msg){
        switch (name) {
            case 'setRemoteSdp':
                let sdp = msg[0];
                notify(constants.ROOM_EVENT.REMOTE_SDP, sdp);
                break;
            case 'sfuCallback':
                notify(msg[0].type, msg[0]);
                break;
            case 'failed':
                notify(constants.ROOM_EVENT.FAILED, msg[0]);
                break;
        }
    }

    //data channel
    const dChannel = options.pc.createDataChannel("control");
    dChannel.onopen = function() {
        console.log("DataChannel opened");
    }
    dChannel.onclose = function() {
        console.log("DataChannel closed");
    }
    dChannel.onmessage = function(msg) {
        console.log("received message: " + msg.data);
        const message = JSON.parse(msg.data);
        notify(message.type, message.message);
    };

    const join = function() {
        if (!joinCalled) {
            joinCalled = true;
            connection.connect(options.url, options.name, options.pin, options.nickName, 0).then(
                function() {
                    notify(constants.ROOM_EVENT.ENTERED);
                },
                function(e) {
                    notify(constants.ROOM_EVENT.FAILED, e);
                });
        }
    }

    const setRemoteSdp = function(sdp) {
        connection.send("setRemoteSdp", sdp);
    }

    const sendMessage = function(msg) {
        dChannel.send(msg);
    }

    const changeQuality = function(trackId, quality, tid) {
        connection.send("changeQuality", {
            id: trackId,
            quality: quality,
            tid: tid
        });
    }

    const on = function (event, callback) {
        if (!event) {
            throw new TypeError("Event can't be null");
        }
        if (!callback || typeof callback !== 'function') {
            throw new Error("Callback needs to be a valid function");
        }
        if (!callbacks[event]) {
            callbacks[event] = [];
        }
        callbacks[event].push(callback);
        return room;
    };

    const notify = function(event, msg) {
        if (callbacks[event]) {
            for (const callback of callbacks[event]) {
                callback(msg);
            }
        }
    }

    room.join = join;
    room.setRemoteSdp = setRemoteSdp;
    room.sendMessage = sendMessage;
    room.changeQuality = changeQuality;
    room.on = on;

    return room;
}


module.exports = {
    createRoom: createRoom
}