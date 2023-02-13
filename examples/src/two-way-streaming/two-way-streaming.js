const constants = SFU.constants;
const sfu = SFU;
let mainConfig;
let localDisplay;
let remoteDisplay;
let publishState;
let playState;
const PUBLISH = "publish";
const PLAY = "play";
const STOP = "stop";
const PRELOADER_URL="../commons/media/silence.mp3";
const MAX_AWAIT_MS=5000;


/**
 * Default publishing config
 */
const defaultConfig = {
    room: {
        url: "wss://127.0.0.1:8888",
        name: "ROOM1",
        pin: "1234",
        nickName: "User1"
    },
    media: {
        audio: {
            tracks: [
                {
                    source: "mic",
                    channels: 1
                }
            ]
        },
        video: {
            tracks: [
                {
                    source: "camera",
                    width: 640,
                    height: 360,
                    codec: "H264",
                    encodings: [
                        { rid: "360p", active: true, maxBitrate: 500000 },
                        { rid: "180p", active: true, maxBitrate: 200000, scaleResolutionDownBy: 2 }
                    ]
                }
            ]
        }
    }
};

/**
 * Current state object
 */
const CurrentState = function(prefix) {
    let state = {
        prefix: prefix,
        pc: null,
        session: null,
        room: null,
        roomEnded: false,
        timeout: null,
        timer: null,
        promise: null,
        starting: false,
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
        buttonId: function() {
            return state.prefix + "Btn";
        },
        buttonText: function() {
            return (state.prefix.charAt(0).toUpperCase() + state.prefix.slice(1));
        },
        inputId: function() {
            return state.prefix + "Name";
        },
        statusId: function() {
            return state.prefix + "Status";
        },
        formId: function() {
            return state.prefix + "Form";
        },
        errInfoId: function() {
            return state.prefix + "ErrorInfo";
        },
        is: function(value) {
            return (prefix === value);
        },
        isActive: function() {
            return (state.room && !state.roomEnded && state.pc);
        },
        isConnected: function() {
            return (state.session && state.session.state() == constants.SFU_STATE.CONNECTED);
        },
        isRoomEnded: function() {
            return state.roomEnded;
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
                setStatus(state.errInfoId(), e, "red");
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
        },
        setStarting: function(value) {
            state.starting = value;
        },
        isStarting: function() {
            return state.starting;
        }
    };
    return state;
}

/**
 * load config and set default values
 */
const init = function() {
    let configName = getUrlParam("config") || "./config.json";
    $("#publishBtn").prop('disabled', true);
    $("#playBtn").prop('disabled', true);
    $("#url").prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#publishName").prop('disabled', true);
    $("#playName").prop('disabled', true);
    publishState = CurrentState(PUBLISH);
    playState = CurrentState(PLAY);
    $.getJSON(configName, function(cfg){
        mainConfig = cfg;
        onDisconnected(publishState);
        onDisconnected(playState);
    }).fail(function(e){
        //use default config
        console.error("Error reading configuration file " + configName + ": " + e.status + " " + e.statusText)
        console.log("Default config will be used");
        mainConfig = defaultConfig;
        onDisconnected(publishState);
        onDisconnected(playState);
    });
    $("#url").val(setURL());
    $("#roomName").val("ROOM1-"+createUUID(4));
    $("#publishName").val("Publisher1-"+createUUID(4));
    $("#playName").val("Player1-"+createUUID(4));
}

/**
 * connect to server
 */
const connect = async function(state) {
    //create peer connection
    let pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = getRoomConfig(mainConfig);
    roomConfig.url = $("#url").val();
    roomConfig.roomName = $("#roomName").val();
    roomConfig.nickname = $("#" + state.inputId()).val();
    // clean state display items
    setStatus(state.statusId(), "");
    setStatus(state.errInfoId(), "");
    // connect to server and create a room if not
    try {
        const session = await sfu.createRoom(roomConfig);
        // Set up session ending events
        session.on(constants.SFU_EVENT.DISCONNECTED, function() {
            state.clear();
            onDisconnected(state);
            setStatus(state.statusId(), "DISCONNECTED", "green");
        }).on(constants.SFU_EVENT.FAILED, function(e) {
            state.clear();
            onDisconnected(state);
            setStatus(state.statusId(), "FAILED", "red");
            setStatus(state.errInfoId(), e.status + " " + e.statusText, "red");
        });
        // Connected successfully
        state.set(pc, session, session.room());
        onConnected(state);
        setStatus(state.statusId(), "ESTABLISHED", "green");
    } catch(e) {
        setStatus(state.statusId(), "FAILED", "red");
        setStatus(state.errInfoId(), e, "red");
    }
}

const onConnected = function(state) {
    $("#" + state.buttonId()).text("Stop").off('click').click(function () {
        onStopClick(state);
    });
    $('#url').prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#" + state.inputId()).prop('disabled', true);
    // Add errors displaying
    state.room.on(constants.SFU_ROOM_EVENT.FAILED, function(e) {
        setStatus(state.errInfoId(), e, "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        setStatus(state.errInfoId(), e.operation + " failed: " + e.error, "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        setStatus(state.errInfoId(), "Room "+state.room.name()+" has ended", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function () {
        setStatus(state.errInfoId(), "Dropped from the room "+state.room.name()+" due to network issues", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    });
    startStreaming(state);
}

const onDisconnected = function(state) {
    $("#" + state.buttonId()).text(state.buttonText()).off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $("#" + state.inputId()).prop('disabled', false);
    // Enable other session buttons
    let otherState = getOtherState(state);
    if (!otherState.session) {
        $("#" + otherState.buttonId()).prop('disabled', false);
        $("#" + otherState.inputId()).prop('disabled', false);
        $('#url').prop('disabled', false);
        $("#roomName").prop('disabled', false);
    }
}

const onStartClick = function(state) {
    if (validateForm("connectionForm", state.errInfoId())
      && validateForm(state.formId(), state.errInfoId())
       && validateName(state, state.errInfoId())) {
        state.setStarting(true);
        let otherState = getOtherState(state);
        $("#" + state.buttonId()).prop('disabled', true);
        // Disable other session button to prevent a simultaneous connections
        if (!otherState.isStarting()) {
            $("#" + otherState.buttonId()).prop('disabled', true);
        }
        if (state.is(PLAY) && Browser().isSafariWebRTC()) {
            playFirstSound(document.getElementById("main"), PRELOADER_URL).then(function () {
                connect(state);
            });
        } else {
            connect(state);
        }
    }
}

const onStopClick = function(state) {
    state.setStarting(false);
    $("#" + state.buttonId()).prop('disabled', true);
    stopStreaming(state);
}

const startStreaming = async function(state) {
    if (state.is(PUBLISH)) {
        await publishStreams(state);
    } else if (state.is(PLAY)) {
        await playStreams(state);
    }
    state.setStarting(false);
    // Enable session buttons
    let otherState = getOtherState(state);
    $("#" + state.buttonId()).prop('disabled', false);
    if (!otherState.isStarting()) {
        $("#" + otherState.buttonId()).prop('disabled', false);
    }
}

const stopStreaming = async function(state) {
    if (state.is(PUBLISH)) {
        unPublishStreams(state);
    } else if (state.is(PLAY)) {
        stopStreams(state);
    }
    if (state.isConnected()) {
        state.waitFor(state.session.disconnect(), MAX_AWAIT_MS);
    }
}

const publishStreams = async function(state) {
    if (state.isConnected()) {
        //create local display item to show local streams
        localDisplay = initLocalDisplay(document.getElementById("localVideo"));
        try {
            //get configured local video streams
            let streams = await getVideoStreams(mainConfig);
            let audioStreams = await getAudioStreams(mainConfig);
            if (state.isConnected() && state.isActive()) {
                //combine local video streams with audio streams
                streams.push.apply(streams, audioStreams);
                let config = {};
                //add our local streams to the room (to PeerConnection)
                streams.forEach(function (s) {
                    let contentType = s.type || s.source;
                    //add local stream to local display
                    localDisplay.add(s.stream.id, $("#" + state.inputId()).val(), s.stream, contentType);
                    //add each track to PeerConnection
                    s.stream.getTracks().forEach((track) => {
                        config[track.id] = contentType;
                        addTrackToPeerConnection(state.pc, s.stream, track, s.encodings);
                        subscribeTrackToEndedEvent(state, track);
                    });
                });
                //start WebRTC negotiation
                state.waitFor(state.room.join(state.pc, null, config), MAX_AWAIT_MS);
            }
        } catch(e) {
            console.error("Failed to capture streams: " + e);
            setStatus(state.errInfoId(), e.name, "red");
            onStopClick(state);
        }
    }
}

const unPublishStreams = function(state) {
    if (localDisplay) {
        localDisplay.stop();
    }
}

const playStreams = async function(state) {
    if (state.isConnected() && state.isActive()) {
        try {
            //create remote display item to show remote streams
            remoteDisplay = initRemoteDisplay({
                div: document.getElementById("remoteVideo"),
                room: state.room,
                peerConnection: state.pc
            });
            //start WebRTC negotiation
            state.waitFor(state.room.join(state.pc), MAX_AWAIT_MS);
        } catch(e) {
            console.error("Failed to play streams: " + e);
            setStatus(state.errInfoId(), e.name, "red");
            onStopClick(state);
        }
    }
}

const stopStreams = function(state) {
    if (remoteDisplay) {
        remoteDisplay.stop();
    }
}

const subscribeTrackToEndedEvent = function(state, track) {
    let room = state.room;
    let pc = state.pc;
    track.addEventListener("ended", async function() {
        //track ended, see if we need to cleanup
        let negotiate = false;
        for (const sender of pc.getSenders()) {
            if (sender.track === track) {
                pc.removeTrack(sender);
                //track found, set renegotiation flag
                negotiate = true;
                break;
            }
        }
        if (negotiate) {
            //kickoff renegotiation
            state.waitFor(room.updateState(), MAX_AWAIT_MS);
        }
    });
};

const addTrackToPeerConnection = function(pc, stream, track, encodings) {
    pc.addTransceiver(track, {
        direction: "sendonly",
        streams: [stream],
        sendEncodings: encodings ? encodings : [] //passing encoding types for video simulcast tracks
    });
}

const setStatus = function (status, text, color) {
    const field = document.getElementById(status);
    if (color) {
        field.style.color = color;
    }
    field.innerText = text;
}

const validateForm = function (formId, errorInfoId) {
    let valid = true;
    // Validate empty fields
    $('#' + formId + ' :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
            setStatus(errorInfoId, "Fields cannot be empty", "red");
        } else {
            removeHighlight($(this));
            setStatus(errorInfoId, "");
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.input-group').addClass("has-error");
    }

    function removeHighlight(input) {
        input.closest('.input-group').removeClass("has-error");
    }
}

const validateName = function (state) {
    let valid = true;
    // Validate other nickname
    let nameToCheck = $("#" + state.inputId()).val();
    let otherState = getOtherState(state);

    if (nameToCheck === $("#" + otherState.inputId()).val()) {
        if (otherState.isActive() || otherState.isConnected()) {
            valid = false;
            setStatus(state.errInfoId(), "Cannot connect with the same name", "red");
        }
    }
    return valid;
}

const buttonText = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const getOtherState = function(state) {
    if (state.is(PUBLISH)) {
        return playState;
    } else if (state.is(PLAY)) {
        return publishState;
    }
}
