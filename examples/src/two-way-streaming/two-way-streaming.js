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
const PRELOADER_URL="../commons/media/silence.mp3"


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
        timer: null,
        set: function(pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
        },
        clear: function() {
            state.stopWaiting();
            state.room = null;
            state.session = null;
            state.pc = null;
        },
        waitFor: function(div, timeout) {
            state.stopWaiting();
            state.timer = setTimeout(function () {
                if (div.innerHTML !== "") {
                    // Enable stop button
                    $("#" + state.buttonId()).prop('disabled', false);
                }
                else if (state.isConnected()) {
                    setStatus(state.errInfoId(), "No media capturing started in " + timeout + " ms, stopping", "red");
                    onStopClick(state);
                }
            }, timeout);        
        },
        stopWaiting: function() {
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;                
            }
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
            return (state.room && state.pc);
        },
        isConnected: function() {
            return (state.session && state.session.state() == constants.SFU_STATE.CONNECTED);
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
const connect = function(state) {
    //create peer connection
    pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = getRoomConfig(mainConfig);
    roomConfig.url = $("#url").val();
    roomConfig.roomName = $("#roomName").val();
    roomConfig.nickname = $("#" + state.inputId()).val();
    // clean state display items
    setStatus(state.statusId(), "");
    setStatus(state.errInfoId(), "");
    // connect to server and create a room if not
    const session = sfu.createRoom(roomConfig);
    session.on(constants.SFU_EVENT.CONNECTED, function() {
        state.set(pc, session, session.room());
        onConnected(state);
        setStatus(state.statusId(), "ESTABLISHED", "green");
    }).on(constants.SFU_EVENT.DISCONNECTED, function() {
        state.clear();
        onDisconnected(state);
        setStatus(state.statusId(), "DISCONNECTED", "green");
    }).on(constants.SFU_EVENT.FAILED, function(e) {
        state.clear();
        onDisconnected(state);
        setStatus(state.statusId(), "FAILED", "red");
        setStatus(state.errInfoId(), e.status + " " + e.statusText, "red");
    });
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
        stopStreaming(state);
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        setStatus(state.errInfoId(), e.operation + " failed: " + e.error, "red");
        stopStreaming(state);
    });
    startStreaming(state);
}

const onDisconnected = function(state) {
    $("#" + state.buttonId()).text(state.buttonText()).off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $("#" + state.inputId()).prop('disabled', false);
    // Check if other session is active
    if ((state.is(PUBLISH) && playState.session)
       || (state.is(PLAY) && publishState.session)) {
        return;
    }
    $('#url').prop('disabled', false);
    $("#roomName").prop('disabled', false);
}

const onStartClick = function(state) {
    if (validateForm("connectionForm") && validateForm(state.formId())) {
        $("#" + state.buttonId()).prop('disabled', true);
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
    $("#" + state.buttonId()).prop('disabled', true);
    stopStreaming(state);
    if (state.isConnected()) {
        state.session.disconnect();
    }
}

const startStreaming = function(state) {
    if (state.is(PUBLISH)) {
        publishStreams(state);
    } else if (state.is(PLAY)) {
        playStreams(state);
    }
}

const stopStreaming = function(state) {
    state.stopWaiting();
    if (state.is(PUBLISH)) {
        unPublishStreams(state);
    } else if (state.is(PLAY)) {
        stopStreams(state);
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
                    //add local stream to local display
                    localDisplay.add(s.stream.id, $("#" + state.inputId()).val(), s.stream);
                    //add each track to PeerConnection
                    s.stream.getTracks().forEach((track) => {
                        if (s.source === "screen") {
                            config[track.id] = s.source;
                        }
                        addTrackToPeerConnection(state.pc, s.stream, track, s.encodings);
                        subscribeTrackToEndedEvent(state.room, track, state.pc);
                    });
                });
                state.room.join(state.pc, null, config);
                // TODO: Use room state or promises to detect if publishing started to enable stop button
                state.waitFor(document.getElementById("localVideo"), 3000);
            }
        } catch(e) {
            console.error("Failed to capture streams: " + e);
            setStatus(state.errInfoId(), e.name, "red");
            state.stopWaiting();
            if (state.isConnected()) { 
                onStopClick(state);
            }
        }
    }
}

const unPublishStreams = function(state) {
    if (localDisplay) {
        localDisplay.stop();
    }
}

const playStreams = function(state) {
    if (state.isConnected() && state.isActive()) {
        //create remote display item to show remote streams
        remoteDisplay = initRemoteDisplay({
            div: document.getElementById("remoteVideo"),
            room: state.room,
            peerConnection: state.pc
        });
        state.room.join(state.pc);
    }
    $("#" + state.buttonId()).prop('disabled', false);
}

const stopStreams = function(state) {
    if (remoteDisplay) {
        remoteDisplay.stop();
    }
}

const subscribeTrackToEndedEvent = function(room, track, pc) {
    track.addEventListener("ended", function() {
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
            room.updateState();
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

const validateForm = function (formId) {
    var valid = true;
    $('#' + formId + ' :text').each(function () {
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
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

const buttonText = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

