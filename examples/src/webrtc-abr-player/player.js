const constants = SFU.constants;
const sfu = SFU;
const PRELOADER_URL="../commons/media/silence.mp3";
const MAX_AWAIT_MS=5000;


/**
 * Current state object
 */
const CurrentState = function() {
    let state = {
        pc: null,
        session: null,
        room: null,
        remoteDisplay: null,
        roomEnded: false,
        timeout: null,
        timer: null,
        promise: null,
        set: function(pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
            state.roomEnded = false;
            state.timeout = null;
            state.timer = null;
            state.promise = null;
        },
        clear: function() {
            state.stopWaiting();
            state.room = null;
            state.session = null;
            state.pc = null;
            state.roomEnded = false;
            state.timeout = null;
            state.timer = null;
            state.promise = null;
        },
        setRoomEnded: function() {
            state.roomEnded = true;
        },
        isRoomEnded: function() {
            return state.roomEnded;
        },
        isConnected: function() {
            return (state.session && state.session.state() == constants.SFU_STATE.CONNECTED);
        },
        isActive: function() {
            return (state.room && !state.roomEnded && state.pc);
        },
        setDisplay: function(display) {
            state.remoteDisplay = display;
        },
        disposeDisplay: function() {
            if (state.remoteDisplay) {
                state.remoteDisplay.stop();
                state.remoteDisplay = null;
            }
        },
        waitFor: async function(promise, ms) {
            // Create a promise that rejects in <ms> milliseconds
            state.promise = promise;
            state.timeout = new Promise((resolve, reject) => {
                state.resolve = resolve;
                state.timer = setTimeout(() => {
                    clearTimeout(state.timer);
                    state.timer = null;
                    state.promise = null;
                    state.timeout = null;
                    reject('Operation timed out in '+ ms + ' ms.')
                }, ms)
            });

            // Returns a race between our timeout and the passed in promise
            Promise.race([
                state.promise,
                state.timeout
            ]).then(() => {
                state.stopWaiting();
            }).catch((e) => {
                setStatus("playStatus", e, "red");
            });
        },
        stopWaiting: function() {
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
            }
            if (state.timeout) {
                state.resolve();
                state.timeout = null;
            }
            if (state.promise) {
                state.promise = null;
            }
        }

    };
    return state;
}

/**
 * load config and set default values
 */
const init = function() {
    $("#playBtn").prop('disabled', true);
    $("#url").prop('disabled', true);
    $("#streamName").prop('disabled', true);
    onDisconnected(CurrentState());
    $("#url").val(setURL());
}

/**
 * Connect to server
 */
const connect = function(state) {
    // Create peer connection
    let pc = new RTCPeerConnection();
    // Create a config to connect to SFU room
    const roomConfig = {
        // Server websocket URL
        url: $("#url").val(),
        // Use stream name as room name to play ABR
        roomName: $("#streamName").val(),
        // Make a random participant name from stream name
        nickname: "Player-" + $("#streamName").val() + "-" + createUUID(4),
        // Set room pin
        pin: 123456
    }
    // Clean state display items
    setStatus("playStatus", "");
    setStatus("playErrorInfo", "");
    // Connect to the server (room should already exist)
    const session = sfu.createRoom(roomConfig);
    session.on(constants.SFU_EVENT.CONNECTED, function() {
        state.set(pc, session, session.room());
        onConnected(state);
        setStatus("playStatus", "CONNECTING...", "black");
    }).on(constants.SFU_EVENT.DISCONNECTED, function() {
        state.clear();
        onDisconnected(state);
        setStatus("playStatus", "DISCONNECTED", "green");
    }).on(constants.SFU_EVENT.FAILED, function(e) {
        state.clear();
        onDisconnected(state);
        setStatus("playStatus", "FAILED", "red");
        setStatus("playErrorInfo", e.status + " " + e.statusText, "red");
    });
}

const onConnected = async function(state) {
    $("#playBtn").text("Stop").off('click').click(function () {
        onStopClick(state);
    });
    $('#url').prop('disabled', true);
    $("#streamName").prop('disabled', true);
    // Add room event handling
    state.room.on(constants.SFU_ROOM_EVENT.PARTICIPANT_LIST, function(e) {
        // If the room is empty, the stream is not published yet
        if(!e.participants || e.participants.length === 0) {
            setStatus("playErrorInfo", "ABR stream is not published", "red");
            onStopClick(state);    
        }
        else {
            setStatus("playStatus", "ESTABLISHED", "green");
            $("#placeholder").hide();
        }
    }).on(constants.SFU_ROOM_EVENT.FAILED, function(e) {
        // Display error state
        setStatus("playErrorInfo", e, "red");
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        // Display the operation failed
        setStatus("playErrorInfo", e.operation + " failed: " + e.error, "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        // Publishing is stopped, dispose playback and close connection
        setStatus("playErrorInfo", "ABR stream is stopped", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function () {
        // Client dropped from the room, dispose playback and close connection
        setStatus("playErrorInfo", "Playback is dropped due to network issues", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    });
    await playStreams(state);
    // Enable button after starting playback #WCS-3635
    $("#playBtn").prop('disabled', false);
}

const onDisconnected = function(state) {
    $("#placeholder").show();
    $("#playBtn").text("Play").off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#streamName").prop('disabled', false);
}

const onStartClick = function(state) {
    if (validateForm("connectionForm")) {
        $("#playBtn").prop('disabled', true);
        if (Browser().isSafariWebRTC()) {
            playFirstSound(document.getElementById("main"), PRELOADER_URL).then(function () {
                connect(state);
            });
        } else {
            connect(state);
        }
    }
}

const onStopClick = async function(state) {
    $("#playBtn").prop('disabled', true);
    stopStreams(state);
    if (state.isConnected()) {
        state.waitFor(state.session.disconnect(), MAX_AWAIT_MS);
    }
}

const playStreams = async function(state) {
    // Create remote display item to show remote streams
    state.setDisplay(initRemoteDisplay({
        div: document.getElementById("remoteVideo"),
        room: state.room,
        peerConnection: state.pc,
        displayOptions: {
            publisher: false,
            quality: true,
            type: false
        }
    }));
    // Start WebRTC negotiation
    state.waitFor(state.room.join(state.pc), MAX_AWAIT_MS);
}

const stopStreams = function(state) {
    state.disposeDisplay();
}

const setStatus = function (status, text, color) {
    color = color || "black";
    const errField = document.getElementById(status);
    errField.style.color = color;
    errField.innerText = text;
}

const validateForm = function (formId) {
    var valid = true;
    $('#' + formId + ' :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
            setStatus("playErrorInfo", "Fields cannot be empty", "red");
        } else {
            removeHighlight($(this));
            setStatus("playErrorInfo", "");
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.form-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.form-group').removeClass("has-error");
    }
}
