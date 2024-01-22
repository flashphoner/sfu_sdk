const constants = SFU.constants;
const sfu = SFU;
let localDisplay;
let cControls;

const defaultConfig = {
    room: {
        url: "wss://127.0.0.1:8888",
        name: "ROOM1",
        pin: "1234",
        nickName: "Alice"
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
                    width: 1280,
                    height: 720,
                    codec: "H264",
                    encodings: [
                        {rid: "m", active: true, maxBitrate: 300000, scaleResolutionDownBy: 2},
                        {rid: "h", active: true, maxBitrate: 900000}
                    ]
                }
            ]
        }
    }
};

const scalabilityModes = [
    'L1T1',
    'L1T2',
    'L1T3',
    'L2T1',
    'L2T2',
    'L2T3',
    'L3T1',
    'L3T2',
    'L3T3',
    'L2T1h',
    'L2T2h',
    'L2T3h',
    'S2T1',
    'S2T2',
    'S2T3',
    'S2T1h',
    'S2T2h',
    'S2T3h',
    'S3T1',
    'S3T2',
    'S3T3',
    'S3T1h',
    'S3T2h',
    'S3T3h',
    'L2T2_KEY',
    'L2T3_KEY',
    'L3T2_KEY',
    'L3T3_KEY'
];

/**
 * Load track configuration and show entrance modal
 */
const init = function () {
    //read config
    $.getJSON("config.json", function (config) {
        cControls = createControls(config);
    }).fail(function () {
        //use default config
        cControls = createControls(defaultConfig);
    });
    //open entrance modal
    $('#entranceModal').modal('show');
}

/**
 * Connect to server and publish preconfigured streams
 */
async function connect() {
    // hide modal
    $('#entranceModal').modal('hide');
    // disable controls
    cControls.muteInput();
    //create peer connection
    const pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = cControls.roomConfig();
    //kick off connect to server and local room creation
    try {
        const session = await sfu.createRoom(roomConfig);
        // Now we connected to the server (if no exception was thrown)
        session.on(constants.SFU_EVENT.FAILED, function (e) {
            if (e.status && e.statusText) {
                displayError("CONNECTION FAILED: " + e.status + " " + e.statusText);
            } else if (e.type && e.info) {
                displayError("CONNECTION FAILED: " + e.info);
            } else {
                displayError("CONNECTION FAILED: " + e);
            }
        }).on(constants.SFU_EVENT.DISCONNECTED, function (e) {
            displayError("DISCONNECTED. Refresh the page to enter the room again");
        });
        const room = session.room();
        room.on(constants.SFU_ROOM_EVENT.FAILED, function (e) {
            displayError(e);
        }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
            displayError(e.operation + " failed: " + e.error);
        })

        // create local display to show local streams
        localDisplay = initLocalDisplay(document.getElementById("localDisplay"));
        // display audio and video control tables
        await cControls.displayTables();
        cControls.onTrack(async function (s) {
            await publishNewTrack(room, pc, s);
        });
        //create and bind chat to the new room
        const chatDiv = document.getElementById('messages');
        const chatInput = document.getElementById('localMessage');
        const chatButton = document.getElementById('sendMessage');
        createChat(room, chatDiv, chatInput, chatButton);

        //setup remote display for showing remote audio/video tracks
        const remoteDisplay = document.getElementById("display");
        const displayOptions = {
            quality: true,
            autoAbr: false
        };
        const abrOptions = {
            thresholds: [
                {parameter: "nackCount", maxLeap: 10},
                {parameter: "freezeCount", maxLeap: 10},
                {parameter: "packetsLost", maxLeap: 10}
            ],
            abrKeepOnGoodQuality: ABR_KEEP_ON_QUALITY,
            abrTryForUpperQuality: ABR_TRY_UPPER_QUALITY,
            interval: ABR_QUALITY_CHECK_PERIOD
        };
        initDefaultRemoteDisplay(room, remoteDisplay, displayOptions, abrOptions);

        //get configured local video streams
        let streams = cControls.getVideoStreams();
        //combine local video streams with audio streams
        streams.push.apply(streams, cControls.getAudioStreams());

        // Publish preconfigured streams
        publishPreconfiguredStreams(room, pc, streams);
    } catch (e) {
        console.error(e);
        displayError(e);
    }
}

/**
 * Display an error message on operation failure
 *
 * @param prefix
 * @param event
 */
const onOperationFailed = function (prefix, event) {
    let reason = "reason unknown";
    if (event.operation && event.error) {
        reason = event.operation + " failed: " + event.error;
    } else if (event.text) {
        reason = event.text;
    } else {
        reason = JSON.stringify(event);
    }
    console.error(prefix + ": " + reason);
    displayError(reason);
}


/**
 * Publish streams after entering room according to configuration file
 *
 * @param {*} room
 * @param {*} pc
 * @param {*} streams
 */
const publishPreconfiguredStreams = async function (room, pc, streams) {
    try {
        const config = {};
        //add our local streams to the room (to PeerConnection)
        streams.forEach(function (s) {
            let contentType = s.type || s.source;
            //add each track to PeerConnection
            s.stream.getTracks().forEach((track) => {
                config[track.id] = contentType;
                addTrackToPeerConnection(pc, s.stream, track, s.encodings);
                subscribeTrackToEndedEvent(room, track, pc);
            });
            localDisplay.add(s.stream.id, "local", s.stream, contentType);
        });
        //join room
        await room.join(pc, null, config, 1);
        // Enable Delete button for each preconfigured stream #WCS-3689
        streams.forEach(function (s) {
            $('#' + s.stream.id + "-button").prop('disabled', false);
        });
        cControls.controls.addVideoTrack.codec.addEventListener('change', async (event) => {
            const mimeType = "video/" + event.target.value;
            while (cControls.controls.addVideoEncoding.scalabilityMode.firstChild) {
                cControls.controls.addVideoEncoding.scalabilityMode.firstChild.remove();
            }
            const option = document.createElement('option');
            option.value = '';
            option.innerText = 'NONE';
            cControls.controls.addVideoEncoding.scalabilityMode.appendChild(option);

            const capabilityPromises = [];
            for (const mode of scalabilityModes) {
                capabilityPromises.push(navigator.mediaCapabilities.encodingInfo({
                    type: 'webrtc',
                    video: {
                        contentType: mimeType,
                        width: 640,
                        height: 480,
                        bitrate: 10000,
                        framerate: 29.97,
                        scalabilityMode: mode
                    }
                }));
            }
            const capabilityResults = await Promise.all(capabilityPromises);
            for (let i = 0; i < scalabilityModes.length; ++i) {
                if (capabilityResults[i].supported) {
                    const option = document.createElement('option');
                    option.value = scalabilityModes[i];
                    option.innerText = scalabilityModes[i];
                    cControls.controls.addVideoEncoding.scalabilityMode.appendChild(option);
                }
            }

            if (cControls.controls.addVideoEncoding.scalabilityMode.childElementCount > 1) {
                cControls.controls.addVideoEncoding.scalabilityMode.disabled = false;
            } else {
                cControls.controls.addVideoEncoding.scalabilityMode.disabled = true;
            }
        });
    } catch (e) {
        onOperationFailed("Failed to publish a preconfigured streams", e);
        // Enable Delete button for each preconfigured stream #WCS-3689
        streams.forEach(function (s) {
            $('#' + s.stream.id + "-button").prop('disabled', false);
        });
    }
}

/**
 * Publish a new media track to the room
 *
 * @param {*} room
 * @param {*} pc
 * @param {*} media
 */
const publishNewTrack = async function (room, pc, media) {
    try {
        let config = {};
        //add local stream to local display
        let contentType = media.type || media.source;

        localDisplay.add(media.stream.id, "local", media.stream, contentType);
        //add each track to PeerConnection
        media.stream.getTracks().forEach((track) => {
            config[track.id] = contentType;
            addTrackToPeerConnection(pc, media.stream, track, media.encodings);
            subscribeTrackToEndedEvent(room, track, pc);
        });
        // Clean error message
        displayError("");
        //kickoff renegotiation
        await room.updateState(config);
        // Enable Delete button for a new stream #WCS-3689
        $('#' + media.stream.id + "-button").prop('disabled', false);
    } catch (e) {
        onOperationFailed("Failed to publish a new track", e);
        // Enable Delete button for a new stream #WCS-3689
        $('#' + media.stream.id + "-button").prop('disabled', false);
    }
}

/**
 * Subscribe to track ended event to renegotiate WebRTC connection
 *
 * @param {*} room
 * @param {*} track
 * @param {*} pc
 */
const subscribeTrackToEndedEvent = function (room, track, pc) {
    track.addEventListener("ended", async function () {
        try {
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
            // Clean error message
            displayError("");
            if (negotiate) {
                //kickoff renegotiation
                await room.updateState();
            }
        } catch (e) {
            onOperationFailed("Failed to update room state", e);
        }
    });
}

/**
 * Add track to WebRTC PeerConnection
 *
 * @param {*} pc
 * @param {*} stream
 * @param {*} track
 * @param {*} encodings
 */
const addTrackToPeerConnection = function (pc, stream, track, encodings) {
    if (encodings) {
        for (const encoding of encodings) {
            if (encoding.scalabilityMode === "") {
                delete encoding.scalabilityMode;
            }
        }
    }
    pc.addTransceiver(track, {
        direction: "sendonly",
        streams: [stream],
        sendEncodings: encodings ? encodings : [] //passing encoding types for video simulcast tracks
    });
}

/**
 * Display error message
 *
 * @param {*} text
 */
const displayError = function (text) {
    const errField = document.getElementById("errorMsg");
    errField.style.color = "red";
    errField.innerText = text;
}

/**
 * Entrance modal cancelled, we do not enter to a room
 */
const cancel = function () {
    //hide modal
    $('#entranceModal').modal('hide');
    //disable controls
    cControls.muteInput();
    // display the error message
    displayError("Please refresh the page, fill the entrance modal and enter a room to publish or play streams");
}