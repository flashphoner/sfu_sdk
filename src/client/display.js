'use strict'

const constants = require('./constants');


const initLocalDisplay = function(localDisplayElement){
    const localDisplayDiv = localDisplayElement;

    const localDisplays = {};

    const removeLocalDisplay = function(id) {
        delete localDisplays[id];
        $('#' + id).remove();
        reassembleLocalLayout();
    }

    const getAudioContainer = function() {
        for (const [key, value] of Object.entries(localDisplays)) {
            let video = value.getElementsByTagName("video");
            if (video && video[0]) {
                let audioStateButton = value.getElementsByTagName("button");
                let audioTracks = video[0].srcObject.getAudioTracks();
                if (!audioTracks || audioTracks.length === 0) {
                    return {
                        id: value.id,
                        video: video[0],
                        audioStateDisplay: audioStateButton[0]
                    }
                }
            }
        }
    };

    const add = function(id, name, stream) {
        if (stream.getAudioTracks().length > 0) {
            let videoElement = getAudioContainer();
            if (videoElement) {
                let track = stream.getAudioTracks()[0];
                videoElement.video.srcObject.addTrack(track);
                videoElement.audioStateDisplay.innerHTML = "Audio state: " + stream.getAudioTracks()[0].enabled;
                track.addEventListener("ended", function() {
                    videoElement.video.srcObject.removeTrack(track);
                    videoElement.audioStateDisplay.innerHTML = "Audio state: " + false;
                    //check video element has no tracks left
                    for (const [key, vTrack] of Object.entries(videoElement.video.srcObject.getTracks())) {
                        if (vTrack.readyState !== "ended") {
                            return;
                        }
                    }
                    removeLocalDisplay(videoElement.id);
                });
                return;
            }
        }

        //coreDisplay => streamDisplay => video
        const coreDisplay = document.createElement('div');
        coreDisplay.setAttribute("style","width:200px; height:auto; border: solid; border-width: 1px");
        coreDisplay.id = stream.id;
        const streamNameDisplay = document.createElement("div");
        streamNameDisplay.innerHTML = "Name: " + name;
        streamNameDisplay.setAttribute("style","width:auto; height:30px");
        coreDisplay.appendChild(streamNameDisplay);

        const audioStateDisplay = document.createElement("button");
        audioStateDisplay.setAttribute("style","width:auto; height:30px");
        audioStateDisplay.innerHTML = "Audio state: " + (stream.getAudioTracks().length > 0 ? stream.getAudioTracks()[0].enabled : false);
        audioStateDisplay.addEventListener('click', function(){
            if (stream.getAudioTracks().length > 0) {
                stream.getAudioTracks()[0].enabled = !(stream.getAudioTracks()[0].enabled);
                audioStateDisplay.innerHTML = "Audio state: " + stream.getAudioTracks()[0].enabled;
            }
        });
        coreDisplay.appendChild(audioStateDisplay);

        const streamDisplay = document.createElement('div');
        streamDisplay.id = id;
        streamDisplay.setAttribute("style","width:auto; height:auto");
        coreDisplay.appendChild(streamDisplay);
        const video = document.createElement("video");
        streamDisplay.appendChild(video);
        video.srcObject = stream;
        video.muted = true;
        video.onloadedmetadata = function (e) {
            video.play();
        };
        stream.getTracks().forEach(function(track){
            track.addEventListener("ended", function() {
                video.srcObject.removeTrack(track);
                //check video element has no tracks left
                for (const [key, vTrack] of Object.entries(video.srcObject.getTracks())) {
                    if (vTrack.readyState !== "ended") {
                        return;
                    }
                }
                removeLocalDisplay(id);
            });
        });
        video.addEventListener('resize', function (event) {
            streamNameDisplay.innerHTML = "Name: " + name + " " + video.videoWidth + "x" + video.videoHeight;
            resizeVideo(event.target);
        });
        localDisplays[id] = coreDisplay;
        reassembleLocalLayout();
        return coreDisplay;
    }

    const reassembleLocalLayout = function() {
        let gridWidth = gridSize(Object.keys(localDisplays).length).x;
        let container = document.createElement('div');
        let row;
        let rowI = 1;
        let colI = 0;
        for (const [key, value] of Object.entries(localDisplays)) {
            if (row) {
                if (colI >= gridWidth) {
                    row = createRow(container);
                    rowI++;
                    colI = 0;
                }
            } else {
                row = createRow(container);
            }
            $("#" + key).detach();
            let col = createCol(row);
            col.appendChild(value);
            colI++;
        }
        $(localDisplayDiv).empty();
        localDisplayDiv.appendChild(container);
    }

    return {
        add: add
    }
}

const initRemoteDisplay = function(room, mainDiv, peerConnection) {
    const remoteParticipants = {};
    room.on(constants.ROOM_EVENT.ADD_TRACKS, function(e) {
        let participant = remoteParticipants[e.info.nickName];
        if (!participant) {
            participant = {};
            participant.nickName = e.info.nickName;
            participant.tracks = [];
            participant.displays = [];
            remoteParticipants[participant.nickName] = participant;
        }
        participant.tracks.push.apply(participant.tracks, e.info.info);
        for (const pTrack of e.info.info) {
            if (pTrack.type === "VIDEO") {
                const displayObj = {
                    display: createRemoteDisplay(participant.nickName, participant.nickName, null, pTrack),
                    mediaStream: new MediaStream(),
                    mids: {
                        audio: [],
                        video: undefined
                    },
                    audioStreams: {},
                    audioElements: {}
                };
                const video = displayObj.display.getElementsByTagName("video")[0];
                video.srcObject = displayObj.mediaStream;
                displayObj.mids.video = pTrack.mid;
                participant.displays.push(displayObj);
            }
        }
    }).on(constants.ROOM_EVENT.REMOVE_TRACKS, function(e) {
        const participant = remoteParticipants[e.info.nickName];
        if (!participant) {
            return;
        }
        for (const rTrack of e.info.info) {
            for (let i = 0; i < participant.tracks.length; i++) {
                if (rTrack.mid === participant.tracks[i].mid) {
                    participant.tracks.splice(i, 1);
                    break;
                }
            }
            for (let i = 0; i < participant.displays.length; i++) {
                let found = false;
                const display = participant.displays[i];
                if (display.mids.audio.includes(rTrack.mid)) {
                    //remove from mids array
                    display.mids.audio.splice(display.mids.audio.indexOf(rTrack.mid), 1);
                    //stop track and remove stream
                    display.audioStreams[rTrack.mid].getAudioTracks()[0].stop();
                    delete display.audioStreams[rTrack.mid];
                    //remove audio element
                    display.display.removeChild(display.audioElements[rTrack.mid]);
                    delete display.audioElements[rTrack.mid];
                    found = true;
                } else if (display.mids.video === rTrack.mid) {
                    display.mids.video = undefined;
                    display.mediaStream.getVideoTracks()[0].stop();
                    found = true;
                }
                if (display.mids.audio.length === 0 && display.mids.video === undefined) {
                    const video = display.display.getElementsByTagName("video")[0]
                    video.pause();
                    video.srcObject = null;
                    display.display.remove();
                    participant.displays.splice(i, 1);
                }
                if (found) {
                    break;
                }
            }
        }
    }).on(constants.ROOM_EVENT.LEFT, function(e) {
        let participant = remoteParticipants[e.name];
        if (!participant) {
            return;
        }
        delete remoteParticipants[e.name];
    }).on(constants.ROOM_EVENT.TRACK_QUALITY_STATE, function(e){
        console.log("Received track quality state");
        const participant = remoteParticipants[e.info.nickName];
        if (!participant) {
            return;
        }

        for (const rTrack of e.info.tracks) {
            const mid = rTrack.mid;
            let vDisplay;
            for (let i = 0; i < participant.displays.length; i++) {
                const display = participant.displays[i];
                if (display.mids.video === mid) {
                    vDisplay = display;
                    break;
                }
            }
            //todo rework loops
            if (vDisplay) {
                for (const qualityInfo of rTrack.quality) {
                    for (const child of vDisplay.display.childNodes) {
                        if (child.childNodes.length > 0) {
                            for (const cChild of child.childNodes) {
                                if (cChild.innerHTML === qualityInfo.quality) {
                                    if (qualityInfo.available === true) {
                                        cChild.style.color = "gray";
                                    } else {
                                        cChild.style.color = "red";
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const createRemoteDisplay = function(id, name, stream, trackInfo) {
        const cell = document.createElement('div');
        cell.setAttribute("class", "grid-item");
        cell.id = id;
        mainDiv.appendChild(cell);
        const streamNameDisplay = document.createElement("div");
        streamNameDisplay.innerHTML = "Name: " + name;
        streamNameDisplay.setAttribute("style","width:auto; height:20px");
        cell.appendChild(streamNameDisplay);
        const qualityDisplay = document.createElement("div");
        qualityDisplay.setAttribute("style","width:auto; height:20px");
        cell.appendChild(qualityDisplay);
        const tidDisplay = document.createElement("div");
        tidDisplay.setAttribute("style","width:auto; height:20px");
        cell.appendChild(tidDisplay);
        const qualityDivs = [];
        const tidDivs = [];
        if (trackInfo && trackInfo.quality) {
            for (let i = 0; i < trackInfo.quality.length; i++) {
                const qualityDiv = document.createElement("button");
                qualityDivs.push(qualityDiv);
                qualityDiv.innerText = trackInfo.quality[i];
                qualityDiv.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                qualityDiv.style.color = "red";
                qualityDiv.addEventListener('click', function(){
                    console.log("Clicked on quality " + trackInfo.quality[i] + " trackId " + trackInfo.id);
                    if (qualityDiv.style.color === "red") {
                        return;
                    }
                    for (let c = 0; c < qualityDivs.length; c++) {
                        if (qualityDivs[c].style.color !== "red") {
                            qualityDivs[c].style.color = "gray";
                        }
                    }
                    qualityDiv.style.color = "blue";
                    room.changeQuality(trackInfo.id, trackInfo.quality[i]);
                });
                qualityDisplay.appendChild(qualityDiv);
            }
            for (let i = 0; i < 3; i++) {
                const tidDiv = document.createElement("button");
                tidDivs.push(tidDiv);
                tidDiv.innerText = "TID"+i;
                tidDiv.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                tidDiv.style.color = "gray";
                tidDiv.addEventListener('click', function(){
                    console.log("Clicked on TID " + i + " trackId " + trackInfo.id);
                    for (let c = 0; c < tidDivs.length; c++) {
                        tidDivs[c].style.color = "gray";
                    }
                    tidDiv.style.color = "blue";
                    room.changeQuality(trackInfo.id, null, i);
                });
                tidDisplay.appendChild(tidDiv);
            }
        }

        const volumeDisplay = document.createElement("input");
        volumeDisplay.setAttribute("type", "range");
        volumeDisplay.setAttribute("min", 0);
        volumeDisplay.setAttribute("max", 100);
        volumeDisplay.setAttribute("style","width:auto; height:20px");
        volumeDisplay.addEventListener("input", function(e) {
            video.volume = e.target.value / 100;
        });
        cell.appendChild(volumeDisplay);

        const rootDisplay = document.createElement('div');
        rootDisplay.setAttribute("style","width:auto; height:auto");
        cell.appendChild(rootDisplay);
        const streamDisplay = document.createElement('div');
        streamDisplay.setAttribute("style","width:auto; height:auto");
        rootDisplay.appendChild(streamDisplay);
        const video = document.createElement("video");
        streamDisplay.appendChild(video);
        video.srcObject = stream;
        video.onloadedmetadata = function (e) {
            video.play();
        };
        video.addEventListener("ended", function() {
            console.log("VIDEO ENDED");
        });
        video.addEventListener('resize', function (event) {
            streamNameDisplay.innerHTML = "Name: " + name + " " + video.videoWidth + "x" + video.videoHeight;
            resizeVideo(event.target);
        });
        return cell;
    }

    peerConnection.ontrack = ({transceiver}) => {
        let rParticipant;
        console.log("Attach remote track " + transceiver.receiver.track.id + " kind " + transceiver.receiver.track.kind + " mid " + transceiver.mid);
        for (const [nickName, participant] of Object.entries(remoteParticipants)) {
            for (const pTrack of participant.tracks) {
                console.log("Participant " + participant.nickName + " track " + pTrack.id + " mid " + pTrack.mid);
                if (pTrack.mid === transceiver.mid) {
                    rParticipant = participant;
                    break;
                }
            }
            if (rParticipant) {
                break;
            }
        }
        if (rParticipant) {
            for (const display of rParticipant.displays) {
                if (transceiver.receiver.track.kind === "video") {
                    if (display.mids.video === transceiver.mid) {
                        display.mediaStream.addTrack(transceiver.receiver.track);
                        display.display.getElementsByTagName("video")[0].play();
                        break;
                    }
                } else if (transceiver.receiver.track.kind === "audio") {
                    if (display.mids.audio.includes(transceiver.mid)) {
                        break;
                    }
                    display.mids.audio.push(transceiver.mid);
                    let aStream = new MediaStream();
                    aStream.addTrack(transceiver.receiver.track);
                    display.audioStreams[transceiver.mid] = aStream;
                    let audio = document.createElement("audio");
                    audio.controls = "controls";
                    display.audioElements[transceiver.mid] = audio;
                    display.display.appendChild(audio);
                    audio.srcObject = aStream;
                    audio.play();
                    break;
                }
            }
        } else {
            console.warn("Failed to find participant for track " + transceiver.receiver.track.id);
        }
    }
}

const createRow = function(container) {
    const row = document.createElement('div');
    row.setAttribute("class","row");
    container.appendChild(row);
    return row;
}

const createCol = function(row) {
    const col = document.createElement('div');
    col.setAttribute("class","col local-video-display");
    row.appendChild(col);
    return col;
}

const gridSize = function(frames) {
    let x = 1;
    let y = 1;
    let fSqrt = Math.sqrt(frames);
    if (fSqrt % 1 === 0) {
        x = y = Math.sqrt(frames);
    } else {
        x = Math.ceil(fSqrt);
        while(x * y < frames) {
            y++;
        }
    }
    return {
        x: x,
        y: y
    }
}

const resizeVideo = function(video, width, height) {
    if (!video.parentNode) {
        return;
    }
    if (video instanceof HTMLCanvasElement) {
        video.videoWidth = video.width;
        video.videoHeight = video.height;
    }
    var display = video.parentNode;
    var parentSize = {
        w: display.parentNode.clientWidth,
        h: display.parentNode.clientHeight
    };
    var newSize;
    if (width && height) {
        newSize = downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = downScaleToFitSize(video.videoWidth, video.videoHeight, parentSize.w, parentSize.h);
    }
    display.style.width = newSize.w + "px";
    display.style.height = newSize.h + "px";

    //vertical align
    var margin = 0;
    if (parentSize.h - newSize.h > 1) {
        margin = Math.floor((parentSize.h - newSize.h) / 2);
    }
    display.style.margin = margin + "px auto";
    console.log("Resize from " + video.videoWidth + "x" + video.videoHeight + " to " + display.offsetWidth + "x" + display.offsetHeight);
}

const downScaleToFitSize = function(videoWidth, videoHeight, dstWidth, dstHeight) {
    var newWidth, newHeight;
    var videoRatio = videoWidth / videoHeight;
    var dstRatio = dstWidth / dstHeight;
    if (dstRatio > videoRatio) {
        newHeight = dstHeight;
        newWidth = Math.floor(videoRatio * dstHeight);
    } else {
        newWidth = dstWidth;
        newHeight = Math.floor(dstWidth / videoRatio);
    }
    return {
        w: newWidth,
        h: newHeight
    };
}

module.exports = {
    initLocalDisplay: initLocalDisplay,
    initRemoteDisplay: initRemoteDisplay
}