const constants = SFU.constants;
const sfu = SFU;
let mainConfig;
let publishState;

const PUBLISH = "publish";

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
        display: null,
        roomEnded: false,
        starting: false,
        bitrateController: null,
        set: function (pc, session, room) {
            state.pc = pc;
            state.session = session;
            state.room = room;
            state.roomEnded = false;
        },
        clear: function () {
            state.room = null;
            state.session = null;
            state.pc = null;
            state.roomEnded = false;
        },
        setRoomEnded: function () {
            state.roomEnded = true;
        },
        buttonId: function () {
            return state.prefix + "Btn";
        },
        buttonText: function () {
            return "Connect";
        },
        inputId: function () {
            return state.prefix + "Name";
        },
        statusId: function () {
            return state.prefix + "Status";
        },
        formId: function () {
            return state.prefix + "Form";
        },
        errInfoId: function () {
            return state.prefix + "ErrorInfo";
        },
        bitrateButtonId: function () {
            return state.prefix + "BitrateBtn";
        },
        bitrateStatusId: function () {
            return state.prefix + "BitrateStatus";
        },
        getBitrateController: function () {
            return this.bitrateController;
        },
        setBitrateController: function (controller) {
            this.bitrateController = controller;
        },
        is: function (value) {
            return (prefix === value);
        },
        isActive: function () {
            return (state.room && !state.roomEnded && state.pc);
        },
        isConnected: function () {
            return (state.session && state.session.state() === constants.SFU_STATE.CONNECTED);
        },
        isRoomEnded: function () {
            return state.roomEnded;
        },
        setStarting: function (value) {
            state.starting = value;
        },
        isStarting: function () {
            return state.starting;
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
const init = function () {
    $("#publishBtn").prop('disabled', true);
    $("#url").prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#publishName").prop('disabled', true);
    $("#BitrateBtn").prop('disabled', true);
    publishState = CurrentState(PUBLISH);
    mainConfig = defaultConfig;
    onDisconnected(publishState);
    $("#url").val(mainConfig.room.url);
    $("#roomName").val("ROOM1-" + createUUID(4));
    $("#publishName").val("Publisher1-" + createUUID(4));
}

/**
 * connect to server
 */
const connect = async function (state) {
    //create peer connection
    const pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = getRoomConfig(mainConfig);
    roomConfig.url = $("#url").val();
    roomConfig.roomName = $("#roomName").val();
    roomConfig.nickname = createUUID(5);
    // clean state display items
    setStatus(state.statusId(), "");
    setStatus(state.errInfoId(), "");
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
    $("#" + state.buttonId()).text("Disconnect").off('click').click(function () {
        onStopClick(state);
    });
    $("#" + state.bitrateButtonId()).off('click').click(function () {
        onStartBitrateClick(state);
    });

    $('#url').prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#" + state.inputId()).prop('disabled', true);
    // Add errors displaying
    state.room.on(constants.SFU_ROOM_EVENT.FAILED, function (e) {
        setStatus(state.errInfoId(), e, "red");
        state.setRoomEnded();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
        onOperationFailed(state, e);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function () {
        setStatus(state.errInfoId(), "Room " + state.room.name() + " has ended", "red");
        state.setRoomEnded();
        onStopClick(state);
    }).on(constants.SFU_ROOM_EVENT.DROPPED, function () {
        setStatus(state.errInfoId(), "Dropped from the room " + state.room.name() + " due to network issues", "red");
        state.setRoomEnded();
        onStopClick(state);
    });
    startStreaming(state);
}

const onDisconnected = function (state) {
    state.clear();
    $("#" + state.buttonId()).text(state.buttonText()).off('click').click(function () {
        onStartClick(state);
    }).prop('disabled', false);
    $('#url').prop('disabled', false);
    $("#roomName").prop('disabled', false);
    $("#" + state.inputId()).prop('disabled', false);
    $("#" + state.bitrateButtonId()).prop('disabled', true);
}

const onStartClick = function (state) {
    if (validateForm("connectionForm", state.errInfoId())
        && validateForm(state.formId(), state.errInfoId())) {
        state.setStarting(true);
        if (!state.is(PUBLISH) && Browser().isSafariWebRTC()) {
            playFirstSound(document.getElementById("main"), PRELOADER_URL).then(function () {
                connect(state);
            });
        } else {
            connect(state);
        }
    }
}

const onStartBitrateClick = async function (state) {
    if (state.is(PUBLISH) && validateForm("connectionForm", state.errInfoId())
        && validateForm(state.formId(), state.errInfoId()) &&
        state.room) {
        const statusSelector = $("#" + state.bitrateStatusId());
        statusSelector.attr("style", "display:inline-block;margin-left: 10px");
        try {
            const bitrateTest = state.room.getBitrateTest();
            state.setBitrateController(bitrateTest);
            bitrateTest.setListener({
                onStatusUpdate(status) {
                    statusSelector.text(" = " + status);
                }
            })
            bitrateTest.test(30_000).then((bitrate) => {
                statusSelector.text("Test ended, last bitrate - " + bitrate);
                state.setBitrateController(null);
                $("#" + state.bitrateButtonId()).text("Start test").off('click').click(function () {
                    onStartBitrateClick(state);
                });
            })
            $("#" + state.bitrateButtonId()).text("Stop test").off('click').click(function () {
                onStopBitrateClick(state);
            });
        } catch (e) {
            setStatus(state.errInfoId(), e);
        }

    }
}

const onStopBitrateClick = function (state) {
    if (state.is(PUBLISH)) {
        const controller = state.getBitrateController();
        if (controller) {
            controller.stop();
        }
    }
}

const onOperationFailed = function (state, event) {
    if (event.operation && event.error) {
        setStatus(state.errInfoId(), event.operation + " failed: " + event.error, "red");
    } else {
        setStatus(state.errInfoId(), event, "red");
    }
    state.setRoomEnded();
    onStopClick(state);
}

const onStopClick = async function (state) {
    state.setStarting(false);
    disposeStateDisplay(state);
    if (state.isConnected()) {
        $("#" + state.buttonId()).prop('disabled', true);
        onStopBitrateClick(state);
        await state.session.disconnect();
        onDisconnected(state);
    }
}

const startStreaming = async function (state) {
    await publishStreams(state);
    state.setStarting(false);
}

const publishStreams = async function (state) {
    if (state.isConnected()) {
        try {
            if (state.isConnected() && state.isActive()) {
                await state.room.join(state.pc, null, null);
                $("#" + state.bitrateButtonId()).prop('disabled', false);
            }
        } catch (e) {
            if (e.type === constants.SFU_ROOM_EVENT.OPERATION_FAILED) {
                onOperationFailed(state, e);
            } else {
                console.error("Failed to capture streams: " + e);
                setStatus(state.errInfoId(), e.name, "red");
                onStopClick(state);
            }
        }
    }
}


const disposeStateDisplay = function (state) {
    state.disposeDisplay();
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
