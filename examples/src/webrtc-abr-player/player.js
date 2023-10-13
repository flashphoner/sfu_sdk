const constants = SFU.constants;
const sfu = SFU;
const PRELOADER_URL="../commons/media/silence.mp3";
const playStatus = "playStatus";
const playErrorInfo = "playErrorInfo";


/**
 * Current state object
 */
const CurrentState = function() {
    let state = {
        pc: null,
        session: null,
        room: null,
        display: null,
        roomEnded: false,
        set: function(pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
            state.roomEnded = false;
        },
        clear: function() {
            state.room = null;
            state.session = null;
            state.pc = null;
            state.roomEnded = false;
        },
        setRoomEnded: function() {
            state.roomEnded = true;
        },
        isRoomEnded: function() {
            return state.roomEnded;
        },
        isConnected: function() {
            return (state.session && state.session.state() === constants.SFU_STATE.CONNECTED);
        },
        isActive: function() {
            return (state.room && !state.roomEnded && state.pc);
        },
        setDisplay: function (display) {
            state.display = display;
        },
        disposeDisplay: function () {
            if (state.display) {
                state.display.stop();
                state.display = null;
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
const connect = async function(state) {
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
    setStatus(playStatus, "");
    setStatus(playErrorInfo, "");
    try {
        // Connect to the server (room should already exist)
        const session = await sfu.createRoom(roomConfig);
        // Set up session ending events
        session.on(constants.SFU_EVENT.DISCONNECTED, function() {
            onStopClick(state);
            onDisconnected(state);
            setStatus(playStatus, "DISCONNECTED", "green");
        }).on(constants.SFU_EVENT.FAILED, function(e) {
            onStopClick(state);
            onDisconnected(state);
            setStatus(playStatus, "FAILED", "red");
            if (e.status && e.statusText) {
                setStatus(playErrorInfo, e.status + " " + e.statusText, "red");
            } else if (e.type && e.info) {
                setStatus(playErrorInfo, e.type + ": " + e.info, "red");
            }
        });
        // Connected successfully
        onConnected(state, pc, session);
        setStatus(playStatus, "CONNECTING...", "black");
    } catch(e) {
        onDisconnected(state);
        setStatus(playStatus, "FAILED", "red");
        setStatus(playErrorInfo, e, "red");
    }
}

const onConnected = async function(state, pc, session) {
    state.set(pc, session, session.room());
    $("#playBtn").text("Stop").off('click').click(function () {
        onStopClick(state);
    });
    $('#url').prop('disabled', true);
    $("#streamName").prop('disabled', true);
    // Add room event handling
    state.room.on(constants.SFU_ROOM_EVENT.PARTICIPANT_LIST, function(e) {
        // If the room is empty, the stream is not published yet
        if (!e.participants || e.participants.length === 0) {
            setStatus(playErrorInfo, "ABR stream is not published", "red");
            onStopClick(state);    
        }
        else {
            setStatus(playStatus, "ESTABLISHED", "green");
            $("#placeholder").hide();
        }
    }).on(constants.SFU_ROOM_EVENT.FAILED, function(e) {
        // Display error state
        setStatus(playErrorInfo, e, "red");
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        onOperationFailed(state);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        // Publishing is stopped, dispose playback and close connection
        setStatus(playErrorInfo, "ABR stream is stopped", "red");
        state.setRoomEnded();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function () {
        // Client dropped from the room, dispose playback and close connection
        setStatus(playErrorInfo, "Playback is dropped due to network issues", "red");
        state.setRoomEnded();
        onStopClick(state);
    });
    await playStreams(state);
    // Enable button after starting playback #WCS-3635
    $("#playBtn").prop('disabled', false);
}

const onDisconnected = function(state) {
    state.clear();
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
    stopStreams(state);
    if (state.isConnected()) {
        $("#playBtn").prop('disabled', true);
        await state.session.disconnect();
        onDisconnected(state);
    }
}

const onOperationFailed = function(state, event) {
    if (event.operation && event.error) {
        setStatus(playErrorInfo, e.operation + " failed: " + e.error, "red");
    } else {
        setStatus(playErrorInfo, event, "red");
    }
    state.setRoomEnded();
    onStopClick(state);
}

const playStreams = async function (state) {
    try {
        // Create remote display item to show remote streams
        const display = initRemoteDisplay(state.room, document.getElementById("remoteVideo"), {quality:true, autoAbr: true}, {thresholds: [
            {parameter: "nackCount", maxLeap: 10},
        {parameter: "freezeCount", maxLeap: 10},
        {parameter: "packetsLost", maxLeap: 10}
    ], abrKeepOnGoodQuality: ABR_KEEP_ON_QUALITY, abrTryForUpperQuality: ABR_TRY_UPPER_QUALITY, interval: ABR_QUALITY_CHECK_PERIOD},createDefaultMeetingController, createDefaultMeetingModel, createDefaultMeetingView, oneToOneParticipantFactory(remoteTrackProvider(state.room)));
        state.setDisplay(display);
        // Start WebRTC negotiation
        await state.room.join(state.pc, null, null, 1);
    } catch(e) {
        if (e.type === constants.SFU_ROOM_EVENT.OPERATION_FAILED) {
            onOperationFailed(state, e);
        } else {
            console.error("Failed to play streams: " + e);
            setStatus(playErrorInfo, e.name, "red");
            onStopClick(state);
        }
    }

}

const stopStreams = function (state) {
    state.disposeDisplay();
}

const setStatus = function (status, text, color) {
    color = color || "black";
    const errField = document.getElementById(status);
    errField.style.color = color;
    errField.innerText = text;
}

const validateForm = function (formId) {
    let valid = true;
    $('#' + formId + ' :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
            setStatus(playErrorInfo, "Fields cannot be empty", "red");
        } else {
            removeHighlight($(this));
            setStatus(playErrorInfo, "");
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
