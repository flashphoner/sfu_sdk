'use strict';


const constants = Object.freeze({
    ROOM_EVENT: Object.freeze({
        ENTERED: "ENTERED",
        FAILED: "FAILED",
        ADD_TRACKS: "ADD_TRACKS",
        REMOVE_TRACKS: "REMOVE_TRACKS",
        MESSAGE: "MESSAGE",
        JOINED: "JOINED",
        LEFT: "LEFT",
        REMOTE_SDP: "REMOTE_SDP",
        TRACK_QUALITY_STATE: "TRACK_QUALITY_STATE"
    })
});

module.exports = constants;