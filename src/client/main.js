'use strict'

const adapter = require('webrtc-adapter');
const constants = require('./constants');
const roomApi = require('./room');
const chatApi = require('./chat');
const displayApi = require('./display');
const util = require('./util');
const controlsApi = require('./controls');

let controls;

const defaultConfig = {
    room: {
        url: "ws://127.0.0.1:8080",
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

let localDisplay;

const init = function() {
    //read network config
    $.getJSON("config.json", function(config){
        controls = controlsApi.init(config);
    }).fail(function(){
        controls = controlsApi.init(defaultConfig);
    });
    localDisplay = displayApi.initLocalDisplay(document.getElementById("localDisplay"));
    $('#entranceModal').modal('show');
}

function connect() {
    $('#entranceModal').modal('hide');
    controls.muteInput();
    //create peer connection
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.mystunserver.tld" }]
    });
    const roomConfig = controls.roomConfig();
    roomConfig.pc = pc;
    const room = roomApi.createRoom(roomConfig);

    const chatDiv = document.getElementById('messages');
    const chatInput = document.getElementById('localMessage');
    const chatButton = document.getElementById('sendMessage');
    chatApi.createChat(room, chatDiv, chatInput, chatButton);
    room.on(constants.ROOM_EVENT.ENTERED, async function() {
        try {
            //setup remote display
            const remoteDisplay = document.getElementById("display");
            displayApi.initRemoteDisplay(room, remoteDisplay, pc);
            //setup local display
            let streams = controls.getVideoStreams();
            streams.push.apply(streams, controls.getAudioStreams());
            streams.forEach(function(s){
                localDisplay.add(s.stream.id, "local", s.stream);
                //apply simulcast
                s.stream.getTracks().forEach((track) => {
                    track.addEventListener("ended", function() {
                        let negotiate = false;
                        for (const sender of pc.getSenders()) {
                            if (sender.track === track) {
                                pc.removeTrack(sender);
                                negotiate = true;
                                break;
                            }
                        }
                        if (negotiate) {
                            pc.createOffer().then(function(offer) {
                                pc.setLocalDescription(offer).then(function() {
                                    console.log("Created local sdp, pc state " + pc.signalingState + " sdp type " + pc.localDescription.type + " sdp " + pc.localDescription.sdp);
                                    room.setRemoteSdp(pc.localDescription.sdp);
                                });
                            });
                        }
                    });

                    let encodings = s.encodings;
                    pc.addTransceiver(track, {
                        direction: "sendonly",
                        streams: [s.stream],
                        sendEncodings: s.encodings ? s.encodings : []
                    });
                });
            });

            //create offer and send to server
            pc.createOffer().then(function(offer) {
                offer.sdp = util.stripVideoCodecsExcept(offer.sdp, "H264");
                pc.setLocalDescription(offer).then(function(){
                    console.log("Created local sdp, pc state " + pc.signalingState + " sdp type " + pc.localDescription.type + " sdp " + pc.localDescription.sdp);
                    room.setRemoteSdp(pc.localDescription.sdp);
                    controls.onTrack(function(s){
                        localDisplay.add(s.stream.id, "local", s.stream);
                        s.stream.getTracks().forEach((track) => {
                            let encodings = s.encodings;
                            pc.addTransceiver(track, {
                                direction: "sendonly",
                                streams: [s.stream],
                                sendEncodings: s.encodings ? s.encodings : []
                            });
                        });
                        handleNewTrack(room, s.stream, pc);
                    });
                });
            });
        } catch(err) {
            console.error(err);
        }
    }).on(constants.ROOM_EVENT.FAILED, function(e) {
        const errField = document.getElementById("errorMsg");
        errField.style.color = "red";
        errField.innerText = e;
    }).on(constants.ROOM_EVENT.REMOTE_SDP, function(sdp) {
        console.log("Received remote sdp, pc state " + pc.signalingState + " sdp type " + sdp.type + " sdp " + sdp.sdp);
        switch (sdp.type) {
            case "offer":
                pc.setRemoteDescription(sdp).then(() => pc.createAnswer())
                    .then(answer => pc.setLocalDescription(answer))
                    .then(() => {
                        console.log("Created local sdp, pc state " + pc.signalingState + " sdp type " + pc.localDescription.type + " sdp " + pc.localDescription.sdp);
                        room.setRemoteSdp(pc.localDescription.sdp);
                    });
                break;
            case "answer":
                pc.setRemoteDescription(sdp);
                break;
        }
    }).on(constants.ROOM_EVENT.ADD_TRACKS, function() {
        console.log("ADD TRACKS");
    });
    room.join();
}

const handleNewTrack = function(room, stream, pc) {
    const track = stream.getTracks()[0];
    track.addEventListener("ended", function() {
        let negotiate = false;
        for (const sender of pc.getSenders()) {
            if (sender.track === track) {
                pc.removeTrack(sender);
                negotiate = true;
                break;
            }
        }
        if (negotiate) {
            pc.createOffer().then(function(offer) {
                pc.setLocalDescription(offer).then(function() {
                    console.log("Created local sdp, pc state " + pc.signalingState + " sdp type " + pc.localDescription.type + " sdp " + pc.localDescription.sdp);
                    room.setRemoteSdp(pc.localDescription.sdp);
                });
            });
        }
    });
    pc.createOffer().then(function(offer) {
        pc.setLocalDescription(offer).then(function() {
            console.log("Created local sdp, pc state " + pc.signalingState + " sdp type " + pc.localDescription.type + " sdp " + pc.localDescription.sdp);
            room.setRemoteSdp(pc.localDescription.sdp);
        });
    });
};

module.exports = {
    init: init,
    connect: connect
}