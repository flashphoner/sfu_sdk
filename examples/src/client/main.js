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
                        { rid: "h", active: true, maxBitrate: 900000 },
                        { rid: "m", active: true, maxBitrate: 300000, scaleResolutionDownBy: 2 }
                    ]
                }
            ]
        }
    }
};

/**
 * Load track configuration and show entrance modal
 */
const init = function() {
    //read config
    $.getJSON("config.json", function(config){
        cControls = createControls(config);
    }).fail(function(){
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
        session.on(constants.SFU_EVENT.FAILED, function(e) {
            if (e.status && e.statusText) {
                displayError("CONNECTION FAILED: " + e.status + " " + e.statusText);
            } else if (e.type && e.info) {
                displayError("CONNECTION FAILED: " + e.info);
            } else {
                displayError("CONNECTION FAILED: " + e);
            }
        }).on(constants.SFU_EVENT.DISCONNECTED, function(e) {
            displayError("DISCONNECTED. Refresh the page to enter the room again");
        });
        const room = session.room();
        room.on(constants.SFU_ROOM_EVENT.FAILED, function(e) {
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
        initRemoteDisplay(room, remoteDisplay, pc);

        //get configured local video streams
        let streams = cControls.getVideoStreams();
        //combine local video streams with audio streams
        streams.push.apply(streams, cControls.getAudioStreams());

        // Publish preconfigured streams
        publishPreconfiguredStreams(room, pc, streams);
    } catch(e) {
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
const onOperationFailed = function(prefix, event) {
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
const publishPreconfiguredStreams = async function(room, pc, streams) {
    try {
        let config = {};
        //add our local streams to the room (to PeerConnection)
        streams.forEach(function (s) {
            //add local stream to local display
            localDisplay.add(s.stream.id, "local", s.stream);
            //add each track to PeerConnection
            s.stream.getTracks().forEach((track) => {
                if (s.source === "screen") {
                    config[track.id] = s.source;
                }
                addTrackToPeerConnection(pc, s.stream, track, s.encodings);
                subscribeTrackToEndedEvent(room, track, pc);
            });
        });
        //join room
        await room.join(pc, null, config);
        // Enable Delete button for each preconfigured stream #WCS-3689
        streams.forEach(function (s) {
            $('#' + s.stream.id + "-button").prop('disabled', false);
        });
    } catch(e) {
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
const publishNewTrack = async function(room, pc, media) {
    try {
        let config = {};
        //add local stream to local display
        localDisplay.add(media.stream.id, "local", media.stream);
        //add each track to PeerConnection
        media.stream.getTracks().forEach((track) => {
            if (media.source === "screen") {
                config[track.id] = media.source;
            }
            addTrackToPeerConnection(pc, media.stream, track, media.encodings);
            subscribeTrackToEndedEvent(room, track, pc);
        });
        // Clean error message
        displayError("");
        //kickoff renegotiation
        await room.updateState(config);
        // Enable Delete button for a new stream #WCS-3689
        $('#' + media.stream.id + "-button").prop('disabled', false);
    } catch(e) {
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
const subscribeTrackToEndedEvent = function(room, track, pc) {
    track.addEventListener("ended", async function() {
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
        } catch(e) {
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
const addTrackToPeerConnection = function(pc, stream, track, encodings) {
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
const displayError = function(text) {
    const errField = document.getElementById("errorMsg");
    errField.style.color = "red";
    errField.innerText = text;
}

/**
 * Entrance modal cancelled, we do not enter to a room
 */
const cancel = function() {
    //hide modal
    $('#entranceModal').modal('hide');
    //disable controls
    cControls.muteInput();
    // display the error message
    displayError("Please refresh the page, fill the entrance modal and enter a room to publish or play streams");
}