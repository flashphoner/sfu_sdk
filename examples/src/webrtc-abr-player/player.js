const constants = SFU.constants;
const sfu = SFU;
const PRELOADER_URL="../commons/media/silence.mp3"

/**
 * Current state object
 */
const CurrentState = function() {
    let state = {
        pc: null,
        session: null,
        room: null,
        remoteDisplay: null,
        set: function(pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
        },
        clear: function() {
            state.room = null;
            state.session = null;
            state.pc = null;
        },
        setDisplay: function(display) {
            state.remoteDisplay = display;
        },
        disposeDisplay: function() {
            if (state.remoteDisplay) {
                state.remoteDisplay.stop();
                state.remoteDisplay = null;
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

const onConnected = function(state) {
    $("#playBtn").text("Stop").off('click').click(function () {
        onStopClick(state);
    }).prop('disabled', false);
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
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        // Publishing is stopped, dispose playback and close connection
        setStatus("playErrorInfo", "ABR stream is stopped", "red");
        onStopClick(state);
    });
    playStreams(state);
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

const onStopClick = function(state) {
    $("#playBtn").prop('disabled', true);
    stopStreams(state);
    state.session.disconnect();
}

const playStreams = function(state) {
    // Create remote display item to show remote streams
    state.setDisplay(initRemoteDisplay({
        div: document.getElementById("remoteVideo"),
        room: state.room,
        peerConnection: state.pc,
        displayOptions: {
            publisher: false,
            quality: true
        }
    }));
    state.room.join(state.pc);
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
