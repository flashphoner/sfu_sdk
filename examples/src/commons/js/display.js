const initLocalDisplay = function(localDisplayElement){
    const localDisplayDiv = localDisplayElement;
    const localDisplays = {};

    const removeLocalDisplay = function(id) {
        let localDisplay = document.getElementById(localDisplays[id].id);
        let video = localDisplay.getElementsByTagName("video");
        if (video && video[0]) {
            for (const [key, vTrack] of Object.entries(video[0].srcObject.getTracks())) {
                vTrack.stop();
            }
        }
        delete localDisplays[id];
        localDisplay.remove();
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
                videoElement.audioStateDisplay.innerHTML = audioStateText(stream);
                track.addEventListener("ended", function() {
                    videoElement.video.srcObject.removeTrack(track);
                    videoElement.audioStateDisplay.innerHTML = "No audio";
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

        const coreDisplay = document.createElement('div');
        coreDisplay.setAttribute("class","text-center");
        coreDisplay.setAttribute("style","width: auto; height: auto;");
        coreDisplay.id = stream.id;
        const publisherNameDisplay = document.createElement("div");
        publisherNameDisplay.innerHTML = "Name: " + name;
        publisherNameDisplay.setAttribute("class","text-center");
        publisherNameDisplay.setAttribute("style","width: auto; height: auto;");
        coreDisplay.appendChild(publisherNameDisplay);

        const audioStateDisplay = document.createElement("button");
        audioStateDisplay.innerHTML = audioStateText(stream);
        audioStateDisplay.addEventListener('click', function(){
            if (stream.getAudioTracks().length > 0) {
                stream.getAudioTracks()[0].enabled = !(stream.getAudioTracks()[0].enabled);
                audioStateDisplay.innerHTML = audioStateText(stream);
            }
        });
        coreDisplay.appendChild(audioStateDisplay);

        const streamDisplay = document.createElement('div');
        streamDisplay.id = "stream-" + id;
        streamDisplay.setAttribute("class","text-center");
        streamDisplay.setAttribute("style","width: auto; height: auto;");
        coreDisplay.appendChild(streamDisplay);
        const video = document.createElement("video");
        video.muted = true;
        if(Browser().isSafariWebRTC()) {
            video.setAttribute("playsinline", "");
            video.setAttribute("webkit-playsinline", "");
        }
        streamDisplay.appendChild(video);
        video.srcObject = stream;
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
            publisherNameDisplay.innerHTML = "Name: " + name + "<br/>Max.resolution: " + video.videoWidth + "x" + video.videoHeight;
            resizeVideo(event.target);
        });
        localDisplays[id] = coreDisplay;
        localDisplayDiv.appendChild(coreDisplay);
        return coreDisplay;
    }

    const stop = function () {
        for (const [key, value] of Object.entries(localDisplays)) {
            removeLocalDisplay(value.id);
        }
    }

    const audioStateText = function (stream) {
        if (stream.getAudioTracks().length > 0) {
            if (stream.getAudioTracks()[0].enabled) {
                return "Mute";
            } else {
                return "Unmute";
            }
        }
        return "No audio";
    }

    return {
        add: add,
        stop: stop
    }
}

const initRemoteDisplay = function(options) {
    const constants = SFU.constants;
    const remoteParticipants = {};
    // Validate options first
    if (!options.div) {
        throw new Error("Main div to place all the media tag is not defined");
    }
    if (!options.room) {
        throw new Error("Room is not defined");
    }
    if (!options.peerConnection) {
        throw new Error("PeerConnection is not defined");
    }

    let mainDiv = options.div;
    let room = options.room;
    let peerConnection = options.peerConnection;
    let displayOptions = options.displayOptions || {publisher: true, quality: true};

    room.on(constants.SFU_ROOM_EVENT.ADD_TRACKS, function(e) {
        console.log("Received ADD_TRACKS");
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
            let createDisplay = true;
            for (let i = 0; i < participant.displays.length; i++) {
                let display = participant.displays[i];
                if (pTrack.type === "VIDEO") {
                    if (display.hasVideo()) {
                        continue;
                    }
                    display.videoMid = pTrack.mid;
                    display.setTrackInfo(pTrack);
                    createDisplay = false;
                    break;
                } else if (pTrack.type === "AUDIO") {
                    if (display.hasAudio()) {
                        continue;
                    }
                    display.audioMid = pTrack.mid;
                    createDisplay = false;
                    break;
                }
            }
            if (!createDisplay) {
                continue;
            }
            let display = createRemoteDisplay(participant.nickName, participant.nickName, mainDiv, displayOptions);
            participant.displays.push(display);
            if (pTrack.type === "VIDEO") {
                display.videoMid = pTrack.mid;
                display.setTrackInfo(pTrack);
            } else if (pTrack.type === "AUDIO") {
                display.audioMid = pTrack.mid;
            }
        }
    }).on(constants.SFU_ROOM_EVENT.REMOVE_TRACKS, function(e) {
        console.log("Received REMOVE_TRACKS");
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
                if (display.audioMid === rTrack.mid) {
                    display.setAudio(null);
                    found = true;
                } else if (display.videoMid === rTrack.mid) {
                    display.setVideo(null);
                    found = true;
                }
                if (found) {
                    if (!display.hasAudio() && !display.hasVideo()) {
                        display.dispose();
                        participant.displays.splice(i, 1);
                    }
                    break;
                }
            }
        }
    }).on(constants.SFU_ROOM_EVENT.LEFT, function(e) {
        console.log("Received LEFT");
        let participant = remoteParticipants[e.name];
        if (!participant) {
            return;
        }
        participant.displays.forEach(function(display){
            display.dispose();
        })
        delete remoteParticipants[e.name];
    }).on(constants.SFU_ROOM_EVENT.TRACK_QUALITY_STATE, function(e){
        console.log("Received track quality state");
        const participant = remoteParticipants[e.info.nickName];
        if (!participant) {
            return;
        }

        for (const rTrack of e.info.tracks) {
            const mid = rTrack.mid;
            for (let i = 0; i < participant.displays.length; i++) {
                const display = participant.displays[i];
                if (display.videoMid === mid) {
                    display.updateQualityInfo(rTrack.quality);
                    break;
                }
            }
        }
    });

    const createRemoteDisplay = function(id, name, mainDiv, displayOptions) {
        const cell = document.createElement("div");
        cell.setAttribute("class", "text-center");
        cell.id = id;
        mainDiv.appendChild(cell);
        let publisherNameDisplay;
        let currentQualityDisplay;
        if (displayOptions.publisher) {
            publisherNameDisplay = document.createElement("div");
            publisherNameDisplay.innerHTML = "Published by: " + name;
            publisherNameDisplay.setAttribute("style","width:auto; height:30px;");
            publisherNameDisplay.setAttribute("class","text-center");
            cell.appendChild(publisherNameDisplay);
        }
        if (displayOptions.quality) {
            currentQualityDisplay = document.createElement("div");
            currentQualityDisplay.innerHTML = "";
            currentQualityDisplay.setAttribute("style","width:auto; height:30px;");
            currentQualityDisplay.setAttribute("class","text-center");
            cell.appendChild(currentQualityDisplay);
        }
        const qualitySwitchDisplay = document.createElement("div");
        qualitySwitchDisplay.setAttribute("style","width:auto; height:30px;");
        qualitySwitchDisplay.setAttribute("class","text-center");
        cell.appendChild(qualitySwitchDisplay);

        let qualityDivs = [];

        const rootDisplay = document.createElement("div");
        rootDisplay.setAttribute("style","width:auto; height:auto;");
        rootDisplay.setAttribute("class","text-center");
        cell.appendChild(rootDisplay);
        const streamDisplay = document.createElement("div");
        streamDisplay.setAttribute("style","width:auto; height:auto;");
        streamDisplay.setAttribute("class","text-center");
        rootDisplay.appendChild(streamDisplay);

        let audio = null;
        let video = null;
        return {
            dispose: function() {
                cell.remove();
            },
            hide: function(value) {
                if (value) {
                    cell.style.display = "none";
                } else {
                    cell.style.display = "block";
                }
            },
            setAudio: function(stream) {
                if (audio) {
                    audio.remove();
                }
                if (!stream) {
                    audio = null;
                    this.audioMid = undefined;
                    return;
                }
                audio = document.createElement("audio");
                audio.controls = "controls";
                audio.muted = true;
                audio.autoplay = true;
                if (Browser().isSafariWebRTC()) {
                    audio.setAttribute("playsinline", "");
                    audio.setAttribute("webkit-playsinline", "");
                    this.setWebkitEventHandlers(audio);
                } else {
                    this.setEventHandlers(audio);
                }
                cell.appendChild(audio);
                audio.srcObject = stream;
                audio.onloadedmetadata = function (e) {
                    audio.play().then(function() {
                        if (Browser().isSafariWebRTC() && Browser().isiOS()) {
                            console.warn("Audio track should be manually unmuted in iOS Safari");
                        } else {
                            audio.muted = false;
                        }
                    });
                };
            },
            hasAudio: function() {
                return audio !== null || this.audioMid !== undefined;
            },
            setVideo: function(stream) {
                if (video) {
                    video.remove();
                }

                if (stream == null) {
                    video = null;
                    this.videoMid = undefined;
                    qualityDivs.forEach(function(div) {
                        div.remove();
                    });
                    qualityDivs = [];
                    return;
                }
                video = document.createElement("video");
                video.controls = "controls";
                video.muted = true;
                video.autoplay = true;
                if (Browser().isSafariWebRTC()) {
                    video.setAttribute("playsinline", "");
                    video.setAttribute("webkit-playsinline", "");
                    this.setWebkitEventHandlers(video);
                } else {
                    this.setEventHandlers(video);
                }
                streamDisplay.appendChild(video);
                video.srcObject = stream;
                this.setResizeHandler(video);
            },
            setTrackInfo: function(trackInfo) {
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
                        qualitySwitchDisplay.appendChild(qualityDiv);
                    }
                }
            },
            updateQualityInfo: function(videoQuality) {
                for (const qualityInfo of videoQuality) {
                    for (const qualityDiv of qualityDivs) {
                        if (qualityDiv.innerText === qualityInfo.quality){
                            if (qualityInfo.available === true) {
                                qualityDiv.style.color = "gray";
                            } else {
                                qualityDiv.style.color = "red";
                            }
                            break;
                        }
                    }
                }
            },
            hasVideo: function() {
                return video !== null || this.videoMid !== undefined;
            },
            setResizeHandler: function(video) {
                video.addEventListener("resize", function (event) {
                    if (displayOptions.publisher) {
                        publisherNameDisplay.innerHTML = "Published by: " + name;
                    }
                    if (displayOptions.quality) {
                        currentQualityDisplay.innerHTML = video.videoWidth + "x" + video.videoHeight;
                    }
                    resizeVideo(event.target);
                });
            },
            setEventHandlers: function(video) {
                // Ignore play/pause button
                video.addEventListener("pause", function () {
                    console.log("Media paused by click, continue...");
                    video.play();
                });
            },
            setWebkitEventHandlers: function(video) {
                let needRestart = false;
                let isFullscreen = false;
                // Use webkitbeginfullscreen event to detect full screen mode in iOS Safari
                video.addEventListener("webkitbeginfullscreen", function () {
                    isFullscreen = true;
                });                
                video.addEventListener("pause", function () {
                    if (needRestart) {
                        console.log("Media paused after fullscreen, continue...");
                        video.play();
                        needRestart = false;
                    } else {
                        console.log("Media paused by click, continue...");
                        video.play();
                    }
                });
                video.addEventListener("webkitendfullscreen", function () {
                    video.play();
                    needRestart = true;
                    isFullscreen = false;
                });
            },
            audioMid: undefined,
            videoMid: undefined
        };
    }

    const stop = function() {
        for (const [nickName, participant] of Object.entries(remoteParticipants)) {
            participant.displays.forEach(function(display){
                display.dispose();
            });
            delete remoteParticipants[nickName];
        }
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
                    if (display.videoMid === transceiver.mid) {
                        let stream = new MediaStream();
                        stream.addTrack(transceiver.receiver.track);
                        display.setVideo(stream);
                        break;
                    }
                } else if (transceiver.receiver.track.kind === "audio") {
                    if (display.audioMid === transceiver.mid) {
                        let stream = new MediaStream();
                        stream.addTrack(transceiver.receiver.track);
                        display.setAudio(stream);
                        break;
                    }
                }
            }
        } else {
            console.warn("Failed to find participant for track " + transceiver.receiver.track.id);
        }
    }

    return {
        stop: stop
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