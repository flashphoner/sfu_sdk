/**
 * @namespace FlashphonerSFUExtended
 */


const ws = require("./ws");
const messaging = require("./messaging");
const roomApi = require("./room");
const constants = require("./constants");
const SFU_STATE = constants.SFU_STATE;
const SFU_EVENT = constants.SFU_EVENT;
const SFU_INTERNAL = constants.SFU_INTERNAL_API;
const sfu = {};
let rooms = {};
let connection = ws.createConnection();
let server;
const callbacks = {};

let state = SFU_STATE.NEW;
let connectionConfig;
let user;
let im;
let pendingUserList = [];


function setupConnection(connection) {
    connection.onMessage = function(name, msg){
        switch (name) {
            case SFU_INTERNAL.DEFAULT_METHOD:
                //filter messages
                if (msg[0].type === SFU_INTERNAL.MESSAGE) {
                    notify(SFU_EVENT.MESSAGE, msg[0].message);
                } else if (msg[0].type === SFU_INTERNAL.MESSAGE_STATE) {
                    im.onMessageState(msg);
                } else if (msg[0].type === SFU_INTERNAL.USER_LIST) {
                    while (pendingUserList.length > 0) {
                        const promise = pendingUserList.pop();
                        promise.resolve(msg[0].list);
                    }
                    notify(SFU_EVENT.USER_LIST, msg[0].list);
                } else if (msg[0].roomName && msg[0].roomName.length > 0) {
                    //room event
                    const room = rooms[msg[0].roomName];
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
        disconnect();
        notify(SFU_EVENT.DISCONNECTED, e);
    };

    connection.onError = function(e) {
        state = SFU_STATE.FAILED;
        notify(SFU_STATE.FAILED, e);
    };

    im = messaging.create({
        connection: connection
    });
}
/**
 * Connect to server.
 *
 * @param {Object} options SFU options
 * @param {String} options.url Server url
 * @param {String} options.username Username
 * @param {String} options.password Password
 * @param {String=} options.nickname Participant's nickname
 * @returns {Promise<void|Error>} Promise which resolves upon connect
 * @throws {TypeError} Error if no options provided
 * @memberof FlashphonerSFUExtended
 */
const connect = function(options) {
    if (!options) {
        throw new TypeError("No options provided");
    }
    setupConnection(connection);
    server = new URL(options.url).hostname;
    connectionConfig = {
        url: options.url,
        appName: SFU_INTERNAL.Z_APP,
        custom: {
            username: options.username,
            password: options.password,
            nickname: options.nickname
        }
    };
    return new Promise(function(resolve, reject) {
        if (state !== SFU_STATE.NEW && state !== SFU_STATE.DISCONNECTED && state !== SFU_STATE.FAILED) {
            reject(new Error("Can't connect with the state " + state));
            return;
        }
        connection.connect(connectionConfig).then(function (connectionConfig) {
            user = Object.freeze({
                username: connectionConfig[0].sipLogin,
                nickname: connectionConfig[0].sipVisibleName
            });
            state = SFU_STATE.AUTHENTICATED;
            notify(SFU_EVENT.CONNECTED);
            resolve();
        }, function (e) {
            state = SFU_STATE.FAILED;
            notify(SFU_EVENT.FAILED, e);
            reject(e);
        });
    });
};

/**
 * Send message
 * @param {Object} msg Message
 * @param {String} msg.to Recipient's id
 * @param {String} msg.body Message body
 * @returns {Promise} Promise will resolve upon message delivery and reject if delivery was unsuccessful
 * @throws {Error} error if api isn't connected
 * @memberOf FlashphonerSFUExtended
 */
const sendMessage = function(msg) {
    if (state !== SFU_STATE.AUTHENTICATED) {
        throw new Error("Can't send message while in " + state + " state");
    }
    return im.sendMessage(msg);
};

/**
 * Fetch available user list from server
 * @returns {Promise<Array<FlashphonerSFUExtended.UserListEntry>>}
 * @throws {Error} error if api isn't connected
 * @memberOf FlashphonerSFUExtended

 */
const getUserList = function() {
    if (state !== SFU_STATE.AUTHENTICATED) {
        throw new Error("Can't get user list while in " + state + " state");
    }
    return new Promise(function (resolve, reject){
        if (state !== SFU_STATE.AUTHENTICATED) {
            reject(new Error("Can't get user list while in " + state + " state"));
            return;
        }
        if (pendingUserList.length > 0) {
            pendingUserList.push({resolve: resolve, reject: reject});
            return;
        } else {
            pendingUserList.push({resolve: resolve, reject: reject});
        }
        connection.send("getUserList");
    });
};

/**
 * Create room
 *
 * @param {Object} options Room options
 * @param {String} options.name Room name
 * @param {String} options.pin Room's pin
 * @param {Object} options.pc Peer connection
 * @returns {FlashphonerSFU.Room} Room
 * @throws {TypeError} Error if no options provided
 * @throws {Error} error if api isn't connected
 * @memberof FlashphonerSFUExtended
 */
const room = function(options) {
    if (!options) {
        throw new TypeError("No options provided");
    }
    if (state !== SFU_STATE.AUTHENTICATED) {
        throw new Error("Can't create room while in " + state + " state");
    }
    const opt = {
        connection: connection,
        name: options.name,
        pin: options.pin,
        pc: options.pc
    };
    const exports = roomApi.room(opt);
    rooms[options.name] = exports;
    const cleanup = function() {
        rooms[options.name].pc().close();
        rooms[options.name].pc().dispatchEvent(new Event("connectionstatechange"));
        delete rooms[options.name];
    };
    exports.on(constants.SFU_ROOM_EVENT.LEFT, function(participant){
        if (participant.name === user.nickname) {
            cleanup();
        }
    }).on(constants.SFU_ROOM_EVENT.EVICTED, function(participant) {
        if (participant.name === user.nickname) {
            cleanup();
        }
    }).on(constants.SFU_ROOM_EVENT.FAILED, cleanup
    ).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function(e) {
        if (constants.SFU_OPERATIONS.ROOM_JOIN === e.operation) {
            cleanup();
        }
    });
    return exports;
};

/**
 * FlashphonerSFUExtended event callback.
 *
 * @callback FlashphonerSFUExtended~eventCallback
 * @param {FlashphonerSFUExtended} sdk instance FlashphonerSFUExtended
 */

/**
 * Add session event callback.
 *
 * @param {String} event One of {@link FlashphonerSFU.SFU_EVENT} events
 * @param {FlashphonerSFUExtended~eventCallback} callback Callback function
 * @returns {FlashphonerSFUExtended} SDK instance callback was attached to
 * @throws {TypeError} Error if event is not specified
 * @throws {Error} Error if callback is not a valid function
 * @memberOf FlashphonerSFUExtended
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
 * Disconnect sfu from the server
 * @memberOf FlashphonerSFUExtended
 */
const disconnect = function() {
    for (const [key, value] of Object.entries(rooms)) {
        value.leaveRoom();
    }
    user = undefined;
    pendingUserList = [];
    connection.close();
    connection = ws.createConnection();
    state = SFU_STATE.DISCONNECTED;
    rooms = {};
};

sfu.on = on;
sfu.connect = connect;
sfu.sendMessage = sendMessage;
sfu.getUserList = getUserList;
sfu.room = room;


/**
 * @typedef {Object} SFUUser
 * @property username {String} username
 * @property nickname {String} nickname
 * @memberOf FlashphonerSFUExtended
 */

/**
 * Get current user
 * @returns {FlashphonerSFUExtended.SFUUser} Returns current logged in user
 * @memberOf FlashphonerSFUExtended
 */
sfu.user = function(){
    return user;
};
/**
 * Get hostname of the server in use
 * @returns {String} Current server's hostname
 * @memberOf FlashphonerSFUExtended
 */
sfu.server = function() {
    return server;
};
sfu.disconnect = disconnect;

/**
 * Get sfu state
 * @returns {FlashphonerSFU.SFU_STATE} Current sfu state
 */
sfu.state = function() {
    return state;
};

sfu.constants = constants;


module.exports = sfu;