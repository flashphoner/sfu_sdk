"use strict";
const constants = Object.freeze({
    /**
     * @namespace FlashphonerSFU.SFU_EVENT
     * @see FlashphonerSFU.on and @see FlashphonerSFUExtended.on
     */
    SFU_EVENT: Object.freeze({
        /**
         * Fires when SFU connects to server.
         * @event CONNECTED
         * @memberof FlashphonerSFU.SFU_EVENT
         */
        CONNECTED: "CONNECTED",
        /**
         * Fires when SFU operation fails.
         * @event FAILED
         * @memberof FlashphonerSFU.SFU_EVENT
         */
        FAILED: "FAILED",
        /**
         * Fires when SFU gets disconnected.
         * @event DISCONNECTED
         * @memberof FlashphonerSFU.SFU_EVENT
         */
        DISCONNECTED: "DISCONNECTED",

        /**
         * @typedef Message
         * @memberOf FlashphonerSFUExtended
         * @property id {String} message id
         * @property from {String} username of the sender
         * @property to {String} username of the recipient
         * @property body {String} message payload
         */

        /**
         * Fires upon new message received.
         * @event MESSAGE
         * @memberof FlashphonerSFU.SFU_EVENT
         * @see {@link FlashphonerSFUExtended.Message}
         */
        MESSAGE: "MESSAGE",

        /**
         * @typedef {Object} UserListEntry
         * @property id {String} username
         * @property nickname {String} nickname
         * @property state {String} ONLINE or OFFLINE
         * @memberOf FlashphonerSFUExtended
         */

        /**
         * Fires when SFU fetches user list, see {@link FlashphonerSFUExtended.getUserList}
         * @event USER_LIST
         * @memberof FlashphonerSFU.SFU_EVENT
         */
        USER_LIST: "USER_LIST"
    }),
    /**
     * @namespace FlashphonerSFU.SFU_ROOM_EVENT
     * @see {@link FlashphonerSFU.Room.on}
     */
    SFU_ROOM_EVENT: Object.freeze({
        /**
         * Fires upon Room creation
         * Event object {@link FlashphonerSFU.Room}
         * @event CREATED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        CREATED: "CREATED",
        /**
         * Fires when Room operation fails
         * @event FAILED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        FAILED: "FAILED",

        /**
         * @typedef TrackInfo
         * @memberOf FlashphonerSFU.Room
         * @property id {String} track id
         * @property contentType {String} content type that was advertised by content creator
         * @property mid {String} mid of the track
         * @property mute {Boolean} true if track is muted at server side
         * @property quality {Array<String>} array of advertised quality types
         * @property type {FlashphonerSFU.SFU_TRACK_TYPE} track type
         */

        /**
         * @typedef TracksInfo
         * @memberOf FlashphonerSFU.Room
         * @property info {Object} tracks info
         * @property info.nickName {String} nickname of the owner of the tracks
         * @property info.waitingRoom {Boolean} true if this track belongs to waiting room
         * @property info.info {Array<FlashphonerSFU.Room.TrackInfo>} details of each track
         * @property type {String} Event type
         * @property roomName {String} name of the Room this data corresponds to
         */

        /**
         * Fires when tracks were added to Room
         * Event object {@link FlashphonerSFU.Room.TracksInfo}
         * @event ADD_TRACKS
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        ADD_TRACKS: "ADD_TRACKS",
        /**
         * Fires when tracks were removed from Room
         * Event object {@link FlashphonerSFU.Room.TracksInfo}
         * @event REMOVE_TRACKS
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        REMOVE_TRACKS: "REMOVE_TRACKS",

        /**
         * @typedef Message
         * @memberOf FlashphonerSFU.Room
         * @property message {String} message body
         * @property nickName {String} nickname of the sender
         */

        /**
         * Fires when Room message was received
         * Event object {@link FlashphonerSFU.Room.Message}
         * @event MESSAGE
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        MESSAGE: "MESSAGE",
        /**
         * Fires when Room control message was received
         * @event CONTROL_MESSAGE
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        CONTROL_MESSAGE: "CONTROL_MESSAGE",

        /**
         * @typedef ParticipantInfo
         * @memberOf FlashphonerSFU.Room
         * @property name {String} nickname of participant
         * @property roomName {String} room name
         * @property type {String} Event type
         */

        /**
         * Fires when new participant joins the Room
         * Event object {@link FlashphonerSFU.Room.ParticipantInfo}
         * @event JOINED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        JOINED: "JOINED",
        /**
         * Fires when participant exits the Room
         * Event object {@link FlashphonerSFU.Room.ParticipantInfo}
         * @event LEFT
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        LEFT: "LEFT",
        /**
         * Fires when participant was evicted
         * Event object {@link FlashphonerSFU.Room.ParticipantInfo}
         * @event EVICTED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        EVICTED: "EVICTED",
        /**
         * Fires when sdp was received from server
         * This is internal api event, Room will handle it automatically
         * @event REMOTE_SDP
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        REMOTE_SDP: "REMOTE_SDP",

        /**
         * @typedef QualityInfo
         * @memberOf FlashphonerSFU.Room
         * @property quality {String} quality id
         * @property available {Boolean} true if quality is available
         */

        /**
         * @typedef TrackQualityInfo
         * @memberOf FlashphonerSFU.Room
         * @property mid {String} track mid
         * @property quality {Array<FlashphonerSFU.Room.QualityInfo>} all advertised qualities of this track
         */

        /**
         * @typedef TracksQualityInfo
         * @memberOf FlashphonerSFU.Room
         * @property roomName {String} room name
         * @property type {String} Event type
         * @property info {Object}
         * @property info.nickName {String} nickname
         * @property info.tracks {Array<FlashphonerSFU.Room.TrackQualityInfo>}
         */

        /**
         * Fires when track quality state was received
         * Event object {@link FlashphonerSFU.Room.TracksQualityInfo}
         * @event TRACK_QUALITY_STATE
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        TRACK_QUALITY_STATE: "TRACK_QUALITY_STATE",

        /**
         * @typedef OperationFailedInfo
         * @memberOf FlashphonerSFU.Room
         * @property error {String} error name
         * @property info {String} details about the error
         * @property operation {FlashphonerSFUExtended.SFU_OPERATIONS} Specifies operation that failed
         * @property roomName {String} room name
         * @property type {String} Event type
         */

        /**
         * Fires when one of requested operations (such as muteTrack) were unsuccessful
         * Event object {@link FlashphonerSFU.Room.OperationFailedInfo}
         * @event OPERATION_FAILED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        OPERATION_FAILED: "OPERATION_FAILED",

        /**
         * @typedef WaitingList
         * @memberOf FlashphonerSFU.Room
         * @property roomName {String} room name
         * @property type {String} event type
         * @property users {Array<FlashphonerSFUExtended.UserListEntry>}
         */

        /**
         * Fires when waiting list in waiting room changes
         * Event object {@link FlashphonerSFU.Room.WaitingList}
         * @event SFU_WAITING_LIST
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        WAITING_LIST: "SFU_WAITING_LIST",
        /**
         * Fires when mute/unmute state of one of the Room's participating tracks changes
         * Event object {@link FlashphonerSFU.Room.TracksInfo}
         * @event MUTE_TRACKS
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        MUTE_TRACKS: "MUTE_TRACKS",
        /**
         * @typedef ParticipantList
         * @memberOf FlashphonerSFU.Room
         * @property participants {Array<String>} array with nicknames
         * @property roomName {String} room name
         * @property type {String} Event type
         *
         */

        /**
         * Fires after local participant enters the Room
         * Event object {@link FlashphonerSFU.Room.ParticipantList}
         * @event PARTICIPANT_LIST
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        PARTICIPANT_LIST: "PARTICIPANT_LIST",
        /**
         * @typedef RoleInfo
         * @memberOf FlashphonerSFU.Room
         * @property name {String} nickname
         * @property role {FlashphonerSFU.SFU_PARTICIPANT_ROLE} new role
         * @property roomName {String} room name
         * @property type {String} Event type
         */

        /**
         * Fires when local participant was assigned a role ({@link FlashphonerSFU.SFU_PARTICIPANT_ROLE})
         * @event ROLE_ASSIGNED
         * @memberof FlashphonerSFU.SFU_ROOM_EVENT
         */
        ROLE_ASSIGNED: "ROLE_ASSIGNED"
    }),
    /**
     * @namespace FlashphonerSFU.SFU_STATE
     */
    SFU_STATE: Object.freeze({
        /**
         * New SFU instance
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        NEW: "NEW",
        /**
         * SFU is trying to connect to server
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        PENDING: "PENDING",
        /**
         * SFU connected to server
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        CONNECTED: "CONNECTED",
        /**
         * SFU authenticated at server side
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        AUTHENTICATED: "AUTHENTICATED",
        /**
         * SFU disconnected from the server
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        DISCONNECTED: "DISCONNECTED",
        /**
         * SFU failed, something went wrong during sfu operation
         * @memberOf FlashphonerSFU.SFU_STATE
         */
        FAILED: "FAILED"
    }),
    /**
     * @namespace FlashphonerSFU.SFU_ROOM_STATE
     */
    SFU_ROOM_STATE: Object.freeze({
        /**
         * New room
         * @memberOf FlashphonerSFU.SFU_ROOM_STATE
         */
        NEW: "NEW",
        /**
         * Waiting for server to create/allow join
         * @memberOf FlashphonerSFU.SFU_ROOM_STATE
         */
        PENDING: "PENDING",
        /**
         * Local participant joined
         * @memberOf FlashphonerSFU.SFU_ROOM_STATE
         */
        JOINED: "JOINED",
        /**
         * Room failed, something went wrong during room operations
         * @memberOf FlashphonerSFU.SFU_ROOM_STATE
         */
        FAILED: "FAILED"
    }),
    /**
     * Internal api constants such as server side methods
     */
    SFU_INTERNAL_API: Object.freeze({
        Z_APP: "sfuZClientApp",
        P_APP: "sfuApp",
        DEFAULT_METHOD: "sfuCallback",
        JOIN_ROOM: "joinRoom",
        CREATE_ROOM: "createRoom",
        UPDATE_ROOM_STATE: "updateRoomState",
        DESTROY_ROOM: "destroyRoom",
        LEAVE_ROOM: "leaveRoom",
        CHANGE_QUALITY: "changeQuality",
        AUTHORIZE_WAITING_LIST: "authorizeWaitingList",
        MESSAGE: "SFU_MESSAGE",
        MESSAGE_STATE: "SFU_MESSAGE_STATE",
        USER_LIST: "SFU_USER_LIST",
        MUTE_TRACK: "muteTrack",
        SEND_CONTROL_MESSAGE: "sendControlMessage",
        ASSIGN_ROLE: "assignRole",
        SUBSCRIBE_TO_WAITING_PARTICIPANT: "subscribeToWaitingParticipant",
        UNSUBSCRIBE_FROM_WAITING_PARTICIPANT: "unsubscribeFromWaitingParticipant",
        TRACK_CONTENT_HEADER: "a=content:"
    }),
    /**
     * @namespace FlashphonerSFUExtended.SFU_OPERATIONS
     */
    SFU_OPERATIONS: Object.freeze({
        ROOM_CREATE: "ROOM_CREATE",
        ROOM_JOIN: "ROOM_JOIN",
        ROOM_DESTROY: "ROOM_DESTROY",
        SEND_MESSAGE: "SEND_MESSAGE",
        USER_LIST: "USER_LIST",
        ROOM_UPDATE: "ROOM_UPDATE",
        MUTE_TRACKS: "MUTE_TRACKS",
        ASSIGN_ROLE: "ASSIGN_ROLE",
        SUBSCRIBE_TO_WAITING_PARTICIPANT: "SUBSCRIBE_TO_WAITING_PARTICIPANT",
        UNSUBSCRIBE_FROM_WAITING_PARTICIPANT: "UNSUBSCRIBE_FROM_WAITING_PARTICIPANT"
    }),
    /**
     * @namespace FlashphonerSFU.SFU_PARTICIPANT_ROLE
     */
    SFU_PARTICIPANT_ROLE: Object.freeze({
        OWNER: "OWNER",
        ADMIN: "ADMIN",
        PARTICIPANT: "PARTICIPANT"
    }),
    /**
     * @namespace FlashphonerSFU.SFU_TRACK_TYPE
     */
    SFU_TRACK_TYPE: Object.freeze({
        /**
         * @typedef AUDIO
         * @memberOf FlashphonerSFU.SFU_TRACK_TYPE
         */
        AUDIO: "AUDIO",
        /**
         * @typedef VIDEO
         * @memberOf FlashphonerSFU.SFU_TRACK_TYPE
         */
        VIDEO: "VIDEO"
    })
});

module.exports = constants;