const constants = SFU.constants;
const sfu = SFU;
let localDisplay;
let cControls;
let pc;

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
 * load config and show entrance modal
 */
const init = function() {
    //read config
    $.getJSON("config.json", function(config){
        cControls = createControls(config);
    }).fail(function(){
        //use default config
        cControls = createControls(defaultConfig);
    });
    //create local display to show local streams
    localDisplay = initLocalDisplay(document.getElementById("localDisplay"));
    //open entrance modal
    $('#entranceModal').modal('show');
}

/**
 * connect to server
 */
function connect() {
    //hide modal
    $('#entranceModal').modal('hide');
    //disable controls
    cControls.muteInput();
    //create peer connection
    pc = new RTCPeerConnection();
    //get config object for room creation
    const roomConfig = cControls.roomConfig();
    //kick off connect to server and local room creation
    const session = sfu.createRoom(roomConfig);
    session.on(constants.SFU_EVENT.CONNECTED, function() {
        const room = session.room();
        //connected to server
        const chatDiv = document.getElementById('messages');
        const chatInput = document.getElementById('localMessage');
        const chatButton = document.getElementById('sendMessage');
        //create and bind chat to the new room
        createChat(room, chatDiv, chatInput, chatButton);

        room.on(constants.SFU_ROOM_EVENT.FAILED, function(e) {
            const errField = document.getElementById("errorMsg");
            errField.style.color = "red";
            errField.innerText = e;
        }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
            const errField = document.getElementById("errorMsg");
            errField.style.color = "red";
            errField.innerText = e.operation + " failed: " + e.error;
        })
        //setup remote display for showing remote audio/video tracks
        const remoteDisplay = document.getElementById("display");
        initRemoteDisplay(room, remoteDisplay, pc);

        //get configured local video streams
        let streams = cControls.getVideoStreams();
        //combine local video streams with audio streams
        streams.push.apply(streams, cControls.getAudioStreams());
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
        //add callback for the new local stream to the local controls
        cControls.onTrack(function (s) {
            let config = {};
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
            //kickoff renegotiation
            room.updateState(config);
        });
        //join room
        room.join(pc, null, config);
    });
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