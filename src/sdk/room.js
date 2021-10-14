/**
 * @namespace Room
 * @memberOf FlashphonerSFU
 */

const { v4: uuidv4 } = require("uuid");
const constants = require("./constants");

const room = function(options) {
    if (!options) {
        throw new TypeError("No options provided");
    }
    const room = {};
    let state = constants.SFU_ROOM_STATE.NEW;
    let role = constants.SFU_PARTICIPANT_ROLE.PARTICIPANT;
    let inviteId;
    const callbacks = {};
    const connection = options.connection;
    const pc = options.pc;
    const name = options.name;
    const pin = options.pin;

    let incomingMessageQueue = {};

    //data channel
    const dChannel = options.pc.createDataChannel("control");
    dChannel.onopen = function() {
        console.log("DataChannel opened");
    };
    dChannel.onclose = function() {
        console.log("DataChannel closed");
    };
    dChannel.onerror = function(e) {
        //console.error("Got error in data channel ", e);
    };
    dChannel.onmessage = function(msg) {
        console.log("received message: " + msg.data);
        const message = JSON.parse(msg.data);
        if (message.type === constants.SFU_ROOM_EVENT.MESSAGE && message.message.message.indexOf("\"payload\":") !== -1) {
            try {
                let innerMessage = JSON.parse(message.message.message);
                if (!incomingMessageQueue[innerMessage.id]) {
                    incomingMessageQueue[innerMessage.id] = [];
                }
                incomingMessageQueue[innerMessage.id].push(innerMessage);
                if (innerMessage.last) {
                    let wholeMessage = "";
                    for (let i = 0; i < incomingMessageQueue[innerMessage.id].length; i++) {
                        wholeMessage += incomingMessageQueue[innerMessage.id][i].payload;
                    }
                    delete incomingMessageQueue[innerMessage.id];
                    message.message.message = wholeMessage;
                    notify(message.type, message.message);
                }
            } catch (e) {
                window.log.info("Failed to process inner message: " + message.message);
                notify(message.type, message.message);
            }
        } else {
            notify(message.type, message.message);
        }
    };

    const processEvent = function(e) {
        if (e.type === constants.SFU_ROOM_EVENT.REMOTE_SDP) {
            switch (e.info.type) {
                case "offer":
                    pc.setRemoteDescription(e.info).then(() => pc.createAnswer())
                        .then(answer => pc.setLocalDescription(answer))
                        .then(() => {
                            connection.send(constants.SFU_INTERNAL_API.UPDATE_ROOM_STATE, {
                                name: name,
                                pin: pin,
                                sdp: pc.localDescription.sdp
                            });
                        });
                    break;
                case "answer":
                    pc.setRemoteDescription(e.info);
                    break;
            }
        } else if (e.type === constants.SFU_ROOM_EVENT.ROLE_ASSIGNED) {
            role = e.role;
            notify(e.type, e);
        } else if (e.type === constants.SFU_ROOM_EVENT.CREATED) {
            inviteId = e.inviteId;
            notify(e.type, e);
        } else {
            notify(e.type, e);
        }
    };

    /**
     * Create room at server side.
     */
    const createRoom = function() {
        connection.send(constants.SFU_INTERNAL_API.CREATE_ROOM, {
            name: name,
            pin: pin
        });
    };

    /**
     * Join room.
     * @param {Object=} config Config for track marking. Key is a track id and value is a String (e.g. screen_sharing, camera, front_camera).
     * The specified value will be available for other participants as contentType in {@link FlashphonerSFU.Room.TrackInfo}
     * @memberOf FlashphonerSFU.Room
     */
    const join = function(config) {
        if (state === constants.SFU_ROOM_STATE.NEW) {
            state = constants.SFU_ROOM_STATE.JOINED;
            pc.createOffer().then(function(offer) {
                if (config) {
                    offer.sdp = applyContentTypeConfig(offer.sdp, config);
                }
                pc.setLocalDescription(offer).then(function() {
                    connection.send(constants.SFU_INTERNAL_API.JOIN_ROOM, {
                        name: name,
                        pin: pin,
                        sdp: offer.sdp
                    });
                });
            });
        }
    };

    /**
     * Update state after adding tracks to PeerConnection.
     * This method kicks off sdp renegotiation.
     * @param {Object=} config Config for track marking. Key is a track id and value is a String (e.g. screen_sharing, camera, front_camera).
     * The specified value will be available for other participants as contentType in {@link FlashphonerSFU.Room.TrackInfo}
     * @throws {Error} Error if peer connection is being negotiated
     * @memberOf FlashphonerSFU.Room
     */
    const updateState = function(config) {
        if (pc.signalingState !== "stable") {
            throw new Error("Peer connection signaling state is " + pc.signalingState + ". Can't update room while negotiation is in progress");
        }
        pc.createOffer().then(function(offer) {
            pc.setLocalDescription(offer).then(function() {
                if (config) {
                    offer.sdp = applyContentTypeConfig(offer.sdp, config);
                }
                connection.send(constants.SFU_INTERNAL_API.UPDATE_ROOM_STATE, {
                    name: name,
                    pin: pin,
                    sdp: offer.sdp
                });
            });
        });
    };

    const applyContentTypeConfig = function(sdp, config) {
        let ret = "";
        for (const str of sdp.split("\n")) {
            if (str && str.length > 0) {
                ret += str + "\n";
                if (str.indexOf("a=msid:") > -1) {
                    const msid = str.substring(str.indexOf(" ") + 1).trim();
                    if (config[msid]) {
                        ret += constants.SFU_INTERNAL_API.TRACK_CONTENT_HEADER + config[msid] + "\r\n";
                    }
                }
            }
        }
        return ret;
    };

    /**
     * Destroys room instance at server side.
     * @memberOf FlashphonerSFU.Room
     */
    const destroyRoom = function() {
        connection.send(constants.SFU_INTERNAL_API.DESTROY_ROOM, {
            name: name,
            pin: pin
        });
    };

    /**
     * Leave room.
     * @memberOf FlashphonerSFU.Room
     */
    const leaveRoom = function() {
        connection.send(constants.SFU_INTERNAL_API.LEAVE_ROOM, {
            name: name,
            pin: pin
        });
        pc.close();
        pc.dispatchEvent(new Event("connectionstatechange"));
    };

    /**
     * Broadcast message to participants currently in the Room.
     * This method will use DataChannels.
     * @param {String} msg
     * @memberOf FlashphonerSFU.Room
     */
    const sendMessage = function(msg) {
        //throttle messages
        const chuckSize = 16384;
        if (msg.length > chuckSize) {
            const id = uuidv4();
            const chunks = msg.match(new RegExp("(.|[\r\n]){1,"+chuckSize+"}", "g"));
            for (let i = 0; i < chunks.length; i++) {
                dChannel.send(JSON.stringify({
                    id: id,
                    last: i === chunks.length - 1,
                    payload: chunks[i]
                }));
            }
        } else {
            dChannel.send(msg);
        }
    };

    /**
     * Send control message.
     * This method will use WSS to send the message.
     * @param {String} to recipient's nickname
     * @param {String} msg message
     * @param {Boolean} broadcast ignore 'to' and broadcast the message (send it to all participants)
     */
    const sendControlMessage = function(to, msg, broadcast) {
        connection.send(constants.SFU_INTERNAL_API.SEND_CONTROL_MESSAGE, {
            broadcast: broadcast,
            from: "",
            to: to,
            body: msg
        });
    };

    /**
     * Change receiving quality of the simulcast track.
     * @param {String} trackId Id of the track
     * @param {String} quality one of qualities advertised in {@link FlashphonerSFU.Room.TrackInfo}
     * @param {String} tid In some tracks (Such as WebRTC simulcast VP8 track) there is an option of changing FPS of the
     * track by changing TID. At the time of writing there were 3 TIDs (lower TID = lower FPS) 0|1|2
     * @memberOf FlashphonerSFU.Room
     */
    const changeQuality = function(trackId, quality, tid) {
        connection.send("changeQuality", {
            roomName: name,
            id: trackId,
            quality: quality,
            tid: tid
        });
    };

    /**
     * Authorize user that is currently resides in waiting room. Note that this will only work with {@link FlashphonerSFUExtended}
     * @param {String} userId User id
     * @param {Boolean} authorized If true participant will move to the main room otherwise participant will be evicted.
     * @memberOf FlashphonerSFU.Room
     */
    const authorizeWaitingList = function(userId, authorized) {
        connection.send(constants.SFU_INTERNAL_API.AUTHORIZE_WAITING_LIST, {
            name: name,
            userId: userId,
            authorized: authorized
        });
    };

    /**
     * Mute track. Mute takes place at server side - server stops forwarding this track.
     * @param {String} trackId Id of the track
     * @param {Boolean} mute Mute flag
     * @memberOf FlashphonerSFU.Room
     */
    const muteTrack = function(trackId, mute) {
        connection.send(constants.SFU_INTERNAL_API.MUTE_TRACK, {
            roomName: name,
            id: trackId,
            mute: mute
        });
    };

    /**
     * Assign user a role. Note that this will only work with {@link FlashphonerSFUExtended}
     * @param {String} nickname Nickname of the participant
     * @param {FlashphonerSFU.SFU_PARTICIPANT_ROLE} role Role to assign
     * @memberOf FlashphonerSFU.Room
     */
    const assignRole = function(nickname, role) {
        connection.send(constants.SFU_INTERNAL_API.ASSIGN_ROLE, {
            roomName: name,
            nickname: nickname,
            role: role
        });
    };

    /**
     * Subscribe to tracks of participant that is currently resides in waiting room.
     * New tracks will have `info.waitingRoom` flag set to true, see {@link FlashphonerSFU.Room.TracksInfo}.
     * Note that this will only work with {@link FlashphonerSFUExtended}
     * @param {String} nickname Nickname of the participant
     * @memberOf FlashphonerSFU.Room
     */
    const subscribeToWaitingParticipant = function(nickname) {
        connection.send(constants.SFU_INTERNAL_API.SUBSCRIBE_TO_WAITING_PARTICIPANT, {
            roomName: name,
            nickname: nickname
        });
    };

    /**
     * Unsubscribe from tracks of participant that is currently resides in waiting room.
     * Note that this will only work with {@link FlashphonerSFUExtended}
     * @param {String} nickname Nickname of the participant
     * @memberOf FlashphonerSFU.Room
     */
    const unsubscribeFromWaitingParticipant = function(nickname) {
        connection.send(constants.SFU_INTERNAL_API.UNSUBSCRIBE_FROM_WAITING_PARTICIPANT, {
            roomName: name,
            nickname: nickname
        });
    };

    /**
     * Room event callback.
     *
     * @callback FlashphonerSFU.Room~eventCallback
     * @param {FlashphonerSFU.Room} sdk instance FlashphonerSFU.Room
     */

    /**
     * Add session event callback.
     *
     * @param {String} event One of {@link FlashphonerSFU.SFU_ROOM_EVENT} events
     * @param {FlashphonerSFU.Room~eventCallback} callback Callback function
     * @returns {FlashphonerSFU.Room} SDK instance callback was attached to
     * @throws {TypeError} Error if event is not specified
     * @throws {Error} Error if callback is not a valid function
     * @memberOf FlashphonerSFU.Room
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
        return room;
    };

    const notify = function(event, msg) {
        if (callbacks[event]) {
            for (const callback of callbacks[event]) {
                callback(msg);
            }
        }
    };

    room.processEvent = processEvent;
    room.createRoom = createRoom;
    room.join = join;
    room.updateState = updateState;
    room.destroyRoom = destroyRoom;
    room.leaveRoom = leaveRoom;
    room.sendMessage = sendMessage;
    room.sendControlMessage = sendControlMessage;
    room.changeQuality = changeQuality;
    room.authorizeWaitingList = authorizeWaitingList;
    room.muteTrack = muteTrack;
    room.assignRole = assignRole;
    room.subscribeToWaitingParticipant = subscribeToWaitingParticipant;
    room.unsubscribeFromWaitingParticipant = unsubscribeFromWaitingParticipant;
    /**
     * Room name
     * @returns {String} room name
     */
    room.name = function() {
        return name;
    };
    /**
     * Room pin
     * @returns {String} room pin
     */
    room.pin = function() {
        return pin;
    };

    /**
     * Room underlying PeerConnection
     * @returns {RTCPeerConnection} peer connection
     */
    room.pc = function() {
        return pc;
    };
    /**
     * Local user role
     * @returns {FlashphonerSFU.SFU_PARTICIPANT_ROLE}
     */
    room.role = function() {
        return role;
    };
    /**
     * HTTP address of the invite. Note that this will only work with {@link FlashphonerSFUExtended}
     * @returns {String}
     */
    room.invite = function() {
        return inviteId;
    };
    room.on = on;

    return room;
};


module.exports = {
    room: room
};