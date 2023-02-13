const constants = SFU.constants;
const sfu = SFU;
let mainConfig;
let remoteDisplay;
let playState;
const PLAY = "play";
const STOP = "stop";
const PRELOADER_URL="../commons/media/silence.mp3";
const MAX_AWAIT_MS=5000;


/**
 * Default publishing config
 */
const defaultConfig = {
    room: {
        url: "ws://127.0.0.1:8080",
        name: "ROOM1",
        pin: "1234",
        nickName: "User1"
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
        }
    };
    return state;
}

/**
 * load config and set default values
 */
const init = function() {
    let configName = getUrlParam("config") || "./config.json";
    $("#playBtn").prop('disabled', true);
    $("#url").prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#playName").prop('disabled', true);
    playState = CurrentState(PLAY);
    $.getJSON(configName, function(cfg){
        mainConfig = cfg;
        onDisconnected(playState);
    }).fail(function(e){
        //use default config
        console.error("Error reading configuration file " + configName + ": " + e.status + " " + e.statusText)
        console.log("Default config will be used");
        mainConfig = defaultConfig;
        onDisconnected(playState);
    });
    $("#url").val(setURL());
    $("#roomName").val("ROOM1-"+createUUID(4));
    $("#playName").val("Player1-"+createUUID(4));
}

/**
 * connect to server
 */
const connect = async function(state) {
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

const onConnected = async function(state) {
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
    }).on(constants.SFU_ROOM_EVENT.ENDED, function (e) {
        setStatus(state.errInfoId(), "Room "+state.room.name()+" has ended", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function (e) {
        setStatus(state.errInfoId(), "Dropped from the room "+state.room.name()+" due to network issues", "red");
        state.setRoomEnded();
        state.stopWaiting();
        onStopClick(state);
    });
    await playStreams(state);
    // Enable button after starting playback #WCS-3635
    $("#" + state.buttonId()).prop('disabled', false);
}

const onDisconnected = function(state) {
    $("#" + state.buttonId()).text(state.buttonText()).off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#roomName").prop('disabled', false);
    $("#" + state.inputId()).prop('disabled', false);
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

const onStopClick = async function(state) {
    $("#" + state.buttonId()).prop('disabled', true);
    stopStreams(state);
    if (state.isConnected()) {
        state.waitFor(state.session.disconnect(), MAX_AWAIT_MS);
    }
}

const playStreams = async function(state) {
    //create remote display item to show remote streams
    try {
        remoteDisplay = initRemoteDisplay({
            div: document.getElementById("remoteVideo"),
            room: state.room,
            peerConnection: state.pc
        });
        // Start WebRTC negotiation
        state.waitFor(state.room.join(state.pc), MAX_AWAIT_MS);
    } catch(e) {
        console.error("Failed to play streams: " + e);
        setStatus(state.errInfoId(), e.name, "red");
        onStopClick(state);
    }
}

const stopStreams = function(state) {
    if (remoteDisplay) {
        remoteDisplay.stop();
    }
}

const setStatus = function (status, text, color) {
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
