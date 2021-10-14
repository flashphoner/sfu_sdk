/**
 * @namespace FlashphonerSFU
 */

const ws = require("./ws");
const roomApi = require("./room");
const constants = require("./constants");
const SFU_STATE = constants.SFU_STATE;
const SFU_EVENT = constants.SFU_EVENT;
const SFU_INTERNAL = constants.SFU_INTERNAL_API;

/**
 * Connect to server and create local representation of the room.
 * @param {Object} options Room options
 * @param {String} options.url Server url
 * @param {String} options.roomName Room name
 * @param {String} options.pin Room's pin
 * @param {String} options.nickname Participant's nick
 * @param {Object} options.pc Peer connection
 * @returns {FlashphonerSFU.SFUSession} session
 * @throws {TypeError} Error if no options provided
 * @memberof FlashphonerSFU
 */
function createSession(options) {
    if (!options) {
        throw new TypeError("No options provided");
    }
    let sfu = {};
    let room;
    const callbacks = {};
    const connection = ws.createConnection();
    let state = SFU_STATE.NEW;


    connection.onMessage = function(name, msg){
        switch (name) {
            case SFU_INTERNAL.DEFAULT_METHOD:
                if (msg[0].roomName && msg[0].roomName.length > 0) {
                    //room event
                    if (room) {
                        room.processEvent(msg[0]);
                    }
                } else {
                    notify(msg[0].type, msg[0]);
                }
                break;
            case "failed":
                notify(constants.SFU_EVENT.FAILED, msg[0]);
                break;
        }
    };

    connection.onClose = function(e) {
        state = SFU_STATE.DISCONNECTED;
        notify(SFU_EVENT.DISCONNECTED, e);
    };

    connection.onError = function(e) {
        state = SFU_STATE.FAILED;
        notify(SFU_STATE.FAILED, e);
    };

    let connectionConfig = {
        url: options.url,
        appName: SFU_INTERNAL.P_APP,
        custom: {
            nickname: options.nickname,
            roomName: options.roomName
        }
    };

    connection.connect(connectionConfig).then(function (connectionConfig) {
        state = SFU_STATE.CONNECTED;
        //create room
        const opt = {
            connection: connection,
            name: options.roomName,
            pin: options.pin,
            pc: options.pc
        };
        room = roomApi.room(opt);
        notify(SFU_EVENT.CONNECTED, room);
    }, function (e) {
        state = SFU_STATE.FAILED;
        notify(SFU_EVENT.FAILED, e);
    });

    /**
     * Disconnect from the server
     * @memberOf FlashphonerSFU.SFUSession
     */
    const disconnect = function() {
        connection.close();
    }

    /**
     * Session event callback.
     *
     * @callback FlashphonerSFU.SFUSession~eventCallback
     * @param {FlashphonerSFU.SFUSession} session SFUSession that corresponds to the event
     */

    /**
     * Add session event callback.
     *
     * @param {String} event One of {@link FlashphonerSFU.SFU_EVENT} events
     * @param {FlashphonerSFU.SFUSession~eventCallback} callback Callback function
     * @returns {FlashphonerSFU.SFUSession} Session callback was attached to
     * @throws {TypeError} Error if event is not specified
     * @throws {Error} Error if callback is not a valid function
     * @memberOf FlashphonerSFU.SFUSession
     * @inner
     */
    const on = function (event, callback) {
        if (!event) {
            throw new TypeError("Event can't be null");
        }
        if (!callback || typeof callback !== "function") {
            throw new Error("Callback needs to be a valid function");
        }
        if (!callbacks[event]) {
            callbacks[event] = [];
        }
        callbacks[event].push(callback);
        return sfu;
    };

    const notify = function(event, msg) {
        if (callbacks[event]) {
            for (const callback of callbacks[event]) {
                callback(msg);
            }
        }
    };

    /**
     * Represents connection to server. Once connected will emmit {@link FlashphonerSFU.SFU_EVENT.CONNECTED} with local instance of previously
     * specified room.
     *
     * @see FlashphonerSFU.createSession
     * @namespace SFUSession
     * @memberOf FlashphonerSFU
     */
    sfu = {
        /**
         * Returns room object if available
         * @returns {FlashphonerSFU.Room}
         * @memberOf FlashphonerSFU.SFUSession
         */
        room: function() {
            return room;
        },
        /**
         * Returns {@link FlashphonerSFU.SFU_STATE} state of connection
         * @returns {FlashphonerSFU.SFU_STATE}
         * @memberOf FlashphonerSFU.SFUSession
         */
        state: function() {
            return state;
        },
        /**
         * Preconfigured nickname
         * @returns {String}
         * @memberOf FlashphonerSFU.SFUSession
         */
        nickname: function() {
            return options.nickname;
        },
        disconnect: disconnect,
        on: on
    }
    return sfu;
}


module.exports = {
    createRoom: createSession,
    constants: constants
}