const constants = SFU.constants;
const sfu = SFU;
let mainConfig;
let publishState;
let test1State;
let test2State;
let test3State;

const PUBLISH = "publish";
const TEST1 = "test1";
const TEST2 = "test2";
const TEST3 = "test3";
const PRELOADER_URL = "../commons/media/silence.mp3";

const trackCount = 30;
/**
 * Default publishing config
 */
const defaultConfig = {
    room: {
        url: "wss://127.0.0.1:8888",
        name: "ROOM1",
        pin: "1234",
        nickName: "User1",
        failedProbesThreshold: 5,
        pingInterval: 5000
    },
    media: {
        video: {
            tracks: Array(trackCount).fill({
                source: "camera",
                width: 1280,
                height: 720,
                codec: "H264",
                constraints: {
                    frameRate: 25
                },
                encodings: [
                    {rid: "180p", active: true, maxBitrate: 2000000, scaleResolutionDownBy: 4}
                ],
                type: "cam1"
            })
        }
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
            return (state.prefix.charAt(0).toUpperCase() + state.prefix.slice(1));
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
    $("#test1Btn").prop('disabled', true);
    $("#test2Btn").prop('disabled', true);
    $("#test3Btn").prop('disabled', true);
    $("#url").prop('disabled', true);
    $("#roomName").prop('disabled', true);
    $("#publishName").prop('disabled', true);
    publishState = CurrentState(PUBLISH);
    test1State = CurrentState(TEST1);
    test2State = CurrentState(TEST2);
    test3State = CurrentState(TEST3);
    mainConfig = defaultConfig;
    onDisconnected(publishState);
    onDisconnected(test1State);
    onDisconnected(test2State);
    onDisconnected(test3State);
    $("#url").val(setURL());
    $("#roomName").val("ROOM1-" + createUUID(4));
    $("#publishName").val("Publisher1-" + createUUID(4));
}

/**
 * connect to server
 */
const connect = async function (state) {
    //create peer connection
    let pc = new RTCPeerConnection();
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
    $("#" + state.buttonId()).text("Stop").off('click').click(function () {
        onStopClick(state);
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
        await state.session.disconnect();
        onDisconnected(state);
    }
}

const startStreaming = async function (state) {
    if (state.is(PUBLISH)) {
        await publishStreams(state);
    } else {
        await playStreams(state);
    }
    state.setStarting(false);
}

const publishStreams = async function (state) {
    if (state.isConnected()) {
        //create local display item to show local streams
        const localDisplay = initLocalDisplay(document.getElementById("localVideo"));
        state.setDisplay(localDisplay);
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
                        subscribeTrackToEndedEvent(state.room, track, state.pc);
                    });
                });
                //start WebRTC negotiation
                await state.room.join(state.pc, null, config);
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

const playStreams = async function (state) {
    if (state.isConnected() && state.isActive()) {
        try {
            if (state.is(TEST1)) {
                const display = initRemoteDisplay(state.room, document.getElementById("remoteVideo"), null, null,
                    createDefaultMeetingController,
                    createDelayedMeetingModel,
                    createDefaultMeetingView,
                    oneToOneParticipantFactory(remoteTrackProvider(state.room)));
                state.setDisplay(display);
            } else if (state.is(TEST2)) {
                const display = initRemoteDisplay(state.room, document.getElementById("remoteVideo"), null, null,
                    createDefaultMeetingController,
                    createDefaultMeetingModel,
                    createDefaultMeetingView,
                    createParticipantFactory(remoteTrackProvider(state.room), createAutoMuteParticipantView, createOneToManyParticipantModel));
                state.setDisplay(display);
            } else if (state.is(TEST3)) {
                const display = initRemoteDisplay(state.room, document.getElementById("remoteVideo"), null, null,
                    createDefaultMeetingController,
                    createTest3MeetingModel,
                    createDefaultMeetingView,
                    oneToOneParticipantFactory(remoteTrackProvider(state.room)));
                state.setDisplay(display);
            }
            //start WebRTC negotiation
            await state.room.join(state.pc, null, null, 10);
        } catch (e) {
            if (e.type === constants.SFU_ROOM_EVENT.OPERATION_FAILED) {
                onOperationFailed(state, e);
            } else {
                console.error("Failed to play streams: " + e);
                setStatus(state.errInfoId(), e.name, "red");
                onStopClick(state);
            }
        }
    }
}


const disposeStateDisplay = function (state) {
    state.disposeDisplay();
}

const subscribeTrackToEndedEvent = function (room, track, pc) {
    track.addEventListener("ended", async function () {
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
            await room.updateState();
        }
    });
};

const addTrackToPeerConnection = function (pc, stream, track, encodings) {
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

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const createDelayedMeetingModel = function (meetingView, participantFactory, displayOptions, abrFactory) {
    return {
        participants: new Map(),
        meetingName: null,
        ended: false,
        addParticipant: function (userId, participantName) {
            if (this.participants.get(userId)) {
                return;
            }
            const [participantModel, participantView, participant] = participantFactory.createParticipant(userId, participantName, displayOptions, abrFactory);
            this.participants.set(userId, participant);
            meetingView.addParticipant(userId, participantName, participantView.rootDiv);
        },
        removeParticipant: function (userId) {
            const participant = this.participants.get(userId);
            if (participant) {
                this.participants.delete(userId);
                meetingView.removeParticipant(userId);
                participant.dispose();
            }
        },
        addTracks: async function (userId, tracks) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }

            for (let i = 0; i < 10 && i < tracks.length; i++) {
                if (this.ended) {
                    return;
                }
                if (tracks[i].type === "VIDEO") {
                    participant.addVideoTrack(tracks[i]);
                    await timeout(1000);
                }
            }
        },
        removeTracks: function (userId, tracks) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }
            for (const track of tracks) {
                if (track.type === "VIDEO") {
                    participant.removeVideoTrack(track);
                } else if (track.type === "AUDIO") {
                    participant.removeAudioTrack(track);
                }
            }
        },
        updateQualityInfo: function (userId, tracksInfo) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }
            participant.updateQualityInfo(tracksInfo);
        },
        end: function () {
            console.log("Meeting " + this.meetingName + " ended")
            meetingView.end();
            this.participants.forEach((participant, id) => {
                participant.dispose();
            });
            this.participants.clear();
        },
        setMeetingName: function (id) {
            this.meetingName = id;
            meetingView.setMeetingName(id);
        }
    }
}

const createAutoMuteParticipantView = function () {

    const participantDiv = createContainer(null);

    const participantNicknameDisplay = createInfoDisplay(participantDiv, "Name: ");
    const muteStatus = createInfoDisplay(participantDiv, "unMuted");


    const player = createVideoPlayer(participantDiv);
    const timer = setInterval(() => {
        if (player.muteButton) {
            player.muteButton.click();
        }
    }, 10000);

    return {
        rootDiv: participantDiv,
        dispose: function () {
            player.dispose();
            if (timer) {
                clearInterval(timer);
            }
        },
        addVideoTrack: function (track, requestVideoTrack) {

        },
        removeVideoTrack: function (track) {

        },
        addVideoSource: function (remoteVideoTrack, track, onResize, muteHandler) {
            player.setVideoSource(remoteVideoTrack, onResize, async (mute) => {
                const startDate = Date.now();
                if (mute) {
                    muteStatus.innerText = "muting";
                    return muteHandler(mute).then(() => {
                        const delay = Date.now() - startDate;
                        muteStatus.innerText = "muted";
                        muteStatus.innerHTML = muteStatus.innerHTML + " in " + delay + "ms";

                    });
                } else {
                    muteStatus.innerText = "unMuting";
                    return muteHandler(mute).then(() => {
                        const delay = Date.now() - startDate;
                        muteStatus.innerText = "unMuted";
                        muteStatus.innerHTML = muteStatus.innerHTML + " in " + delay + "ms";

                    });
                }});
            if (player.muteButton) {
                hideItem(player.muteButton);
            }
        },
        removeVideoSource: function (track) {
            player.removeVideoSource(track);
        },
        showVideoTrack: function (track) {
            player.showVideoTrack(track);
        },
        addAudioTrack: function (track, audioTrack, show) {

        },
        removeAudioTrack: function (track) {

        },
        setNickname: function (nickname) {
            participantNicknameDisplay.innerText = "Name: " + nickname;
        },
        updateQuality: function (track, qualityName, available) {
            player.updateQuality(qualityName, available);
        },
        addQuality: function (track, qualityName, available, onQualityPick) {
            player.addQuality(qualityName, available, onQualityPick);
        },
        clearQualityState: function (track) {
            player.clearQualityState();
        },
        pickQuality: function (track, qualityName) {
            player.pickQuality(qualityName);
        }
    }
}

const createTest3MeetingModel = function (meetingView, participantFactory, displayOptions, abrFactory) {
    return {
        participants: new Map(),
        meetingName: null,
        ended: false,
        addParticipant: function (userId, participantName) {
            if (this.participants.get(userId)) {
                return;
            }
            const [participantModel, participantView, participant] = participantFactory.createParticipant(userId, participantName, displayOptions, abrFactory);
            this.participants.set(userId, participant);
            meetingView.addParticipant(userId, participantName, participantView.rootDiv);
        },
        removeParticipant: function (userId) {
            const participant = this.participants.get(userId);
            if (participant) {
                this.participants.delete(userId);
                meetingView.removeParticipant(userId);
                participant.dispose();
            }
        },
        addTracks: async function (userId, tracks) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }
            const videoTracks = tracks.filter((t) => t.type === "VIDEO");
            for (let i = 0; i < videoTracks.length;i+=5) {
                console.log("add 5 tracks");
                for(let j = i; j< i+5; j++) {
                    participant.addVideoTrack(videoTracks[j]);
                }
                await timeout(5000);
                if (this.ended) {
                    return;
                }
                const tracksToRemove = []
                console.log("remove 5 tracks");
                for(let j = i; j< i+5; j++) {
                    tracksToRemove.push(videoTracks[j]);
                }
                this.removeTracks(userId, tracksToRemove);
            }
        },
        removeTracks: function (userId, tracks) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }
            for (const track of tracks) {
                if (track.type === "VIDEO") {
                    participant.removeVideoTrack(track);
                } else if (track.type === "AUDIO") {
                    participant.removeAudioTrack(track);
                }
            }
        },
        updateQualityInfo: function (userId, tracksInfo) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }
            participant.updateQualityInfo(tracksInfo);
        },
        end: function () {
            console.log("Meeting " + this.meetingName + " ended")
            meetingView.end();
            this.participants.forEach((participant, id) => {
                participant.dispose();
            });
            this.participants.clear();
        },
        setMeetingName: function (id) {
            this.meetingName = id;
            meetingView.setMeetingName(id);
        }
    }
}
