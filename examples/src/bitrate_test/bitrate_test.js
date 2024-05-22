const constants = SFU.constants;
const sfu = SFU;
let bitrateTestState;

const BITRATE_TEST = "bitrateTest";
const TEST_DURATION = 30000;

/**
 * Default publishing config
 */
const defaultConfig = {
    room: {
        url: "ws://localhost:8080",
        name: "ROOM1",
        pin: "1234",
        nickName: "User1",
        failedProbesThreshold: 5,
        pingInterval: 5000
    }
};

/**
 * Current state object
 */
const CurrentState = function (prefix) {
    let state = {
        prefix: prefix,
        pc: null,
        session: null,
        room: null,
        bitrateController: null,
        set: function (pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
        },
        clear: function () {
            state.room = null;
            state.session = null;
            state.pc = null;
            state.bitrateController = null;
        },
        durationId: function () {
            return state.prefix + "Duration";
        },
        buttonId: function () {
            return state.prefix + "Btn";
        },
        statusId: function () {
            return state.prefix + "Status";
        },
        errInfoId: function () {
            return state.prefix + "ErrorInfo";
        },
        currentStateId: function () {
            return state.prefix + "CurrentState";
        },
        getBitrateController: function () {
            return state.bitrateController;
        },
        setBitrateController: function (controller) {
            state.bitrateController = controller;
        },
        isConnected: function () {
            return (state.session && state.session.state() === constants.SFU_STATE.CONNECTED);
        }
    };
    return state;
}

/**
 * load config and set default values
 */
const init = function () {
    bitrateTestState = CurrentState(BITRATE_TEST);
    $("#" + bitrateTestState.buttonId()).prop('disabled', true);
    $("#url").prop('disabled', true);
    onDisconnected(bitrateTestState);
    $("#url").val(setURL());
    $("#" + bitrateTestState.durationId()).val(TEST_DURATION);
}

/**
 * connect to server
 */
const connect = async function (state) {
    //create peer connection
    const pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = getRoomConfig(defaultConfig);
    roomConfig.url = $("#url").val();
    roomConfig.roomName = "ROOM1-" + createUUID(4);
    roomConfig.nickname = "User1" + createUUID(4);
    // clean status display items
    setStatus(state.statusId(), " ");
    setStatus(state.errInfoId(), " ");
    // clean bitrate display item
    $("#" + state.currentStateId()).val("");
    // connect to server and create a room if not
    try {
        const session = await sfu.createRoom(roomConfig);
        // Set up session ending events
        session.on(constants.SFU_EVENT.DISCONNECTED, function () {
            onStopClick(state);
            onDisconnected(state);
            setStatus(state.statusId(), "DISCONNECTED", "green");
        }).on(constants.SFU_EVENT.FAILED, function (e) {
            onStopClick(state);
            onDisconnected(state);
            setStatus(state.statusId(), "FAILED", "red");
            if (e.status && e.statusText) {
                setStatus(state.errInfoId(), e.status + " " + e.statusText, "red");
            } else if (e.type && e.info) {
                setStatus(state.errInfoId(), e.type + ": " + e.info, "red");
            }
        });
        // Connected successfully
        onConnected(state, pc, session);
        setStatus(state.statusId(), "ESTABLISHED", "green");
    } catch (e) {
        onDisconnected(state);
        setStatus(state.statusId(), "FAILED", "red");
        setStatus(state.errInfoId(), e, "red");
    }
}

const onConnected = function (state, pc, session) {
    state.set(pc, session, session.room());
    $("#" + state.buttonId()).text("Stop").off('click').click(function () {
        onStopClick(state);
    }).prop('disabled', false);

    $('#url').prop('disabled', true);
    $("#" + bitrateTestState.durationId()).prop('disabled', true);
    // Add errors displaying
    state.room.on(constants.SFU_ROOM_EVENT.FAILED, function (e) {
        setStatus(state.errInfoId(), e, "red");
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        onOperationFailed(state, e);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        setStatus(state.errInfoId(), "Room " + state.room.name() + " has ended", "red");
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function () {
        setStatus(state.errInfoId(), "Dropped from the room " + state.room.name() + " due to network issues", "red");
        onStopClick(state);
    });
    startBitrateTest(state);
}

const onDisconnected = function (state) {
    state.clear();
    $("#" + state.buttonId()).text("Start").off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#" + bitrateTestState.durationId()).prop('disabled', false);
}

const onStartClick = function (state) {
    if (validateForm("connectionForm", state.errInfoId())) {
        $("#" + state.buttonId()).prop('disabled', true);
        connect(state);
    }
}

const startBitrateTest = async function (state) {
    if (state.room) {
        await state.room.join(state.pc, null, {});
        const stateSelector = $("#" + state.currentStateId());
        stateSelector.attr("style", "display:inline-block;margin-left: 10px");
        try {
            const bitrateTest = state.room.getBitrateTest();
            state.setBitrateController(bitrateTest);
            bitrateTest.setListener({
                onStatusUpdate(bitrateKbps) {
                    stateSelector.text("Current bitrate: " + bitrateKbps + " kbps");
                }
            });
            bitrateTest.test($("#" + bitrateTestState.durationId()).val()).then((bitrateKbps) => {
                stateSelector.text("Test is finished, last measured bitrate: " + bitrateKbps + " kbps");
                state.setBitrateController(null);
                onStopClick(state);
            });
        } catch (e) {
            if (e.type === constants.SFU_ROOM_EVENT.OPERATION_FAILED) {
                onOperationFailed(state, e);
            } else {
                console.error("Failed to start bitrate test: " + e);
                setStatus(state.errInfoId(), e.name, "red");
                onStopClick(state);
            }
        }
    }
}

const stopBitrateTest = function (state) {
    const controller = state.getBitrateController();
    if (controller) {
        controller.stop();
    }
}

const onOperationFailed = function (state, event) {
    if (event.operation && event.error) {
        setStatus(state.errInfoId(), event.operation + " failed: " + event.error, "red");
    } else {
        setStatus(state.errInfoId(), event, "red");
    }
    onStopClick(state);
}

const onStopClick = async function (state) {
    if (state.isConnected()) {
        stopBitrateTest(state);
        await state.session.disconnect();
        onDisconnected(state);
    }
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
