const ABR_QUALITY_CHECK_PERIOD = 1000;
const ABR_KEEP_ON_QUALITY = 20000;
const ABR_TRY_UPPER_QUALITY = 20000;
const QUALITY_COLORS = {
    NONE: "",
    AVAILABLE: "gray",
    UNAVAILABLE: "red",
    SELECTED: "blue"
};

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
    }

    const onMuteClick = function(button, stream, type) {
        if (stream.getAudioTracks().length > 0) {
            stream.getAudioTracks()[0].enabled = !(stream.getAudioTracks()[0].enabled);
            button.innerHTML = audioStateText(stream) + " " + type;
        }
    }

    const add = function(id, name, stream, type) {
        if (stream.getAudioTracks().length > 0) {
            let videoElement = getAudioContainer();
            if (videoElement) {
                let track = stream.getAudioTracks()[0];
                videoElement.video.srcObject.addTrack(track);
                videoElement.audioStateDisplay.innerHTML = audioStateText(stream) + " " + type;
                videoElement.audioStateDisplay.addEventListener("click", function() {
                    onMuteClick(videoElement.audioStateDisplay, stream, type);
                });
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

        const coreDisplay = createContainer(null);
        coreDisplay.id = stream.id;
        const publisherNameDisplay = createInfoDisplay(coreDisplay, name + " " + type);

        const audioStateDisplay = document.createElement("button");
        coreDisplay.appendChild(audioStateDisplay);

        const streamDisplay = createContainer(coreDisplay);
        streamDisplay.id = "stream-" + id;
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
        if (stream.getVideoTracks().length > 0) {
            // Resize only if video displayed
            video.addEventListener('resize', function (event) {
                publisherNameDisplay.innerHTML = name + " " + type + " " + video.videoWidth + "x" + video.videoHeight;
                resizeVideo(event.target);
            });
        } else {
            // Hide audio only container
            hideItem(streamDisplay);
            // Set up mute button for audio only stream
            audioStateDisplay.innerHTML = audioStateText(stream) + " " + type;
            audioStateDisplay.addEventListener("click", function() {
                onMuteClick(audioStateDisplay, stream, type);
            });
        }
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
    let displayOptions = options.displayOptions || {publisher: true, quality: true, type: true};

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
                    display.setTrackInfo(pTrack);
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
                display.setTrackInfo(pTrack);
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
        let videoTypeDisplay;
        let abrQualityCheckPeriod = ABR_QUALITY_CHECK_PERIOD;
        let abrKeepOnGoodQuality = ABR_KEEP_ON_QUALITY;
        let abrTryForUpperQuality = ABR_TRY_UPPER_QUALITY;
        if (displayOptions.abrQualityCheckPeriod !== undefined) {
            abrQualityCheckPeriod = displayOptions.abrQualityCheckPeriod;
        }
        if (displayOptions.abrKeepOnGoodQuality !== undefined) {
            abrKeepOnGoodQuality = displayOptions.abrKeepOnGoodQuality;
        }
        if (displayOptions.abrTryForUpperQuality !== undefined) {
            abrTryForUpperQuality = displayOptions.abrTryForUpperQuality;
        }
        if (!displayOptions.abr) {
            abrQualityCheckPeriod = 0;
            abrKeepOnGoodQuality = 0;
            abrTryForUpperQuality = 0;
        }
        if (displayOptions.publisher) {
            publisherNameDisplay = createInfoDisplay(cell, "Published by: " + name);
        }
        if (displayOptions.quality) {
            currentQualityDisplay = createInfoDisplay(cell, "");
        }
        if (displayOptions.type) {
            videoTypeDisplay = createInfoDisplay(cell, "");
        }
        const qualitySwitchDisplay = createInfoDisplay(cell, "");

        let qualityDivs = [];
        let contentType = "";

        const rootDisplay = createContainer(cell);
        const streamDisplay = createContainer(rootDisplay);
        const audioDisplay = createContainer(rootDisplay);
        const audioTypeDisplay = createInfoDisplay(audioDisplay);
        const audioTrackDisplay = createContainer(audioDisplay);
        const audioStateButton = AudioStateButton();

        hideItem(streamDisplay);
        hideItem(audioDisplay);
        hideItem(publisherNameDisplay);
        hideItem(currentQualityDisplay);
        hideItem(videoTypeDisplay);
        hideItem(qualitySwitchDisplay);

        let audio = null;
        let video = null;

        const abr = ABR(abrQualityCheckPeriod, [
            {parameter: "nackCount", maxLeap: 10},
            {parameter: "freezeCount", maxLeap: 10},
            {parameter: "packetsLost", maxLeap: 10}
        ], abrKeepOnGoodQuality, abrTryForUpperQuality);

        return {
            dispose: function() {
                abr.stop();
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
                showItem(audioDisplay);
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
                audioTrackDisplay.appendChild(audio);
                audioStateButton.makeButton(audioTypeDisplay, audio);
                audio.srcObject = stream;
                audio.onloadedmetadata = function (e) {
                    audio.play().then(function() {
                        if (Browser().isSafariWebRTC() && Browser().isiOS()) {
                            console.warn("Audio track should be manually unmuted in iOS Safari");
                        } else {
                            audio.muted = false;
                            audioStateButton.setButtonState();
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
                showItem(streamDisplay);
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
                abr.start();
            },
            setTrackInfo: function(trackInfo) {
                if (trackInfo) { 
                    if (trackInfo.quality) {
                        showItem(qualitySwitchDisplay);
                        if (abr.isEnabled()) {
                            const autoDiv = createQualityButton("Auto", qualityDivs, qualitySwitchDisplay);
                            autoDiv.style.color = QUALITY_COLORS.SELECTED;
                            autoDiv.addEventListener('click', function() {
                                setQualityButtonsColor(qualityDivs);
                                autoDiv.style.color = QUALITY_COLORS.SELECTED;
                                abr.setAuto();
                            });
                        }
                        for (let i = 0; i < trackInfo.quality.length; i++) {
                            abr.addQuality(trackInfo.quality[i]);
                            const qualityDiv = createQualityButton(trackInfo.quality[i], qualityDivs, qualitySwitchDisplay);
                            qualityDiv.addEventListener('click', function() {
                                console.log("Clicked on quality " + trackInfo.quality[i] + " trackId " + trackInfo.id);
                                if (qualityDiv.style.color === QUALITY_COLORS.UNAVAILABLE) {
                                    return;
                                }
                                setQualityButtonsColor(qualityDivs);
                                qualityDiv.style.color = QUALITY_COLORS.SELECTED;
                                abr.setManual();
                                abr.setQuality(trackInfo.quality[i]);
                            });
                        }
                    } else {
                        hideItem(qualitySwitchDisplay);
                    }
                    if (trackInfo.type) {
                        contentType = trackInfo.contentType || "";
                        if (trackInfo.type == "VIDEO" && displayOptions.type && contentType !== "") {
                            showItem(videoTypeDisplay);
                            videoTypeDisplay.innerHTML = contentType;
                        }
                        if (trackInfo.type == "AUDIO") {
                            audioStateButton.setContentType(contentType);
                        }
                    }
                }
            },
            updateQualityInfo: function(videoQuality) {
                showItem(qualitySwitchDisplay);
                for (const qualityInfo of videoQuality) {
                    let qualityColor = QUALITY_COLORS.UNAVAILABLE;
                    if (qualityInfo.available === true) {
                        qualityColor = QUALITY_COLORS.AVAILABLE;
                    }
                    for (const qualityDiv of qualityDivs) {
                        if (qualityDiv.innerText === qualityInfo.quality){
                            qualityDiv.style.color = qualityColor;
                            break;
                        }
                    }
                    abr.setQualityAvailable(qualityInfo.quality, qualityInfo.available);
                }
            },
            hasVideo: function() {
                return video !== null || this.videoMid !== undefined;
            },
            setResizeHandler: function(video) {
                video.addEventListener("resize", function (event) {
                    if (displayOptions.publisher) {
                        showItem(publisherNameDisplay);
                        publisherNameDisplay.innerHTML = "Published by: " + name;
                    }
                    if (displayOptions.quality) {
                        showItem(currentQualityDisplay);
                        currentQualityDisplay.innerHTML = video.videoWidth + "x" + video.videoHeight;
                    }
                    resizeVideo(event.target);
                    // Received a new quality, resume ABR is enabled
                    if (abr.isAuto()) {
                        abr.resume();
                    }
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
            setVideoABRTrack: function(track) {
                abr.setTrack(track);
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
                        display.setVideoABRTrack(transceiver.receiver.track);
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

    const AudioStateButton = function() {
        let button = {
            audio: null,
            contentType: "",
            displayButton: null,
            makeButton: function(parent, audio) {
                button.setAudio(audio);
                button.displayButton = document.createElement("button");
                button.displayButton.innerHTML = button.audioState();
                button.displayButton.addEventListener("click", function() {
                    button.audio.muted = !button.audio.muted;
                    button.displayButton.innerHTML = button.audioState();
                });
                parent.appendChild(button.displayButton);

            },
            setAudio: function(audio) {
                button.audio = audio;
            },
            setButtonState: function() {
                if (button.displayButton) {
                    button.displayButton.innerHTML = button.audioState();
                }
            },
            setContentType: function(type) {
                button.contentType = type;
                button.setButtonState();
            },
            audioState: function() {
                let state = "";
                if (button.audio) {
                    if (button.audio.muted) {
                        state = "Unmute";
                    } else {
                        state = "Mute";
                    }
                    if (button.contentType) {
                        state = state + " " + button.contentType;
                    }
                }
                return (state);
            }
        };
        return button;
    }

    const ABR = function(interval, thresholds, keepGoodTimeout, tryUpperTimeout) {
        let abr = {
            track: null,
            interval: interval,
            thresholds: thresholds,
            qualities: [],
            currentQualityName: null,
            statTimer: null,
            paused: false,
            manual: false,
            keepGoodTimeout: keepGoodTimeout,
            keepGoodTimer: null,
            tryUpperTimeout: tryUpperTimeout,
            tryUpperTimer: null,
            start: function() {
                if (abr.interval) {
                    const thresholds = Thresholds();
                    for (const threshold of abr.thresholds) {
                        thresholds.add(threshold.parameter, threshold.maxLeap);
                    }
                    abr.statsTimer = setInterval(() => {
                        if (abr.track) {
                            room.getStats(abr.track, constants.SFU_RTC_STATS_TYPE.INBOUND, (stats) => {
                                if (thresholds.isReached(stats)) {
                                    abr.shiftDown();
                                } else {
                                    abr.useGoodQuality();
                                }
                            });
                        }
                    }, abr.interval);
                }
            },
            stop: function() {
                abr.stopKeeping();
                abr.stopTrying();
                if (abr.statsTimer) {
                    clearInterval(abr.statsTimer);
                    abr.statsTimer = null;
                }
            },
            isEnabled: function () {
                return (abr.interval > 0);
            },
            pause: function() {
                abr.paused = true;
            },
            resume: function() {
                abr.paused = false;
            },
            setAuto: function() {
                abr.manual = false;
                abr.resume();
            },
            setManual: function() {
                abr.manual = true;
                abr.pause();
            },
            isAuto: function() {
                return !abr.manual;
            },
            setTrack: function(track) {
                abr.track = track;
            },
            setQualitiesList: function(qualities) {
                abr.qualities = qualities;
            },
            addQuality: function(name) {
                abr.qualities.push({name: name, available: false, good: true});
            },
            setQualityAvailable: function(name, available) {
                for (let i = 0; i < abr.qualities.length; i++) {
                    if (name === abr.qualities[i].name) {
                        abr.qualities[i].available = available;
                    }
                }
            },
            setQualityGood: function(name, good) {
                if (name) {
                    for (let i = 0; i < abr.qualities.length; i++) {
                        if (name === abr.qualities[i].name) {
                            abr.qualities[i].good = good;
                        }
                    }
                }
            },
            getFirstAvailableQuality: function() {
                for (let i = 0; i < abr.qualities.length; i++) {
                    if (abr.qualities[i].available) {
                        return abr.qualities[i];
                    }
                }
                return null;
            },
            getLowerQuality: function(name) {
                let quality = null;
                if (!name) {
                    // There were no switching yet, return a first available quality
                    return abr.getFirstAvailableQuality();
                }
                let currentIndex = abr.qualities.map(item => item.name).indexOf(name);
                for (let i = 0; i < currentIndex; i++) {
                    if (abr.qualities[i].available) {
                        quality = abr.qualities[i];
                    }
                }
                return quality;
            },
            getUpperQuality: function(name) {
                let quality = null;
                if (!name) {
                    // There were no switching yet, return a first available quality
                    return abr.getFirstAvailableQuality();
                }
                let currentIndex = abr.qualities.map(item => item.name).indexOf(name);
                for (let i = currentIndex + 1; i < abr.qualities.length; i++) {
                    if (abr.qualities[i].available) {
                        quality = abr.qualities[i];
                        break;
                    }
                }
                return quality;
            },
            shiftDown: function() {
                if (!abr.manual && !abr.paused) {
                    abr.stopKeeping();
                    abr.setQualityGood(abr.currentQualityName, false);
                    let quality = abr.getLowerQuality(abr.currentQualityName);
                    if (quality) {
                        console.log("Switching down to " + quality.name + " quality");
                        abr.setQuality(quality.name);
                    }
                }
            },
            shiftUp: function() {
                if (!abr.manual && !abr.paused) {
                    let quality = abr.getUpperQuality(abr.currentQualityName);
                    if (quality) {
                        if (quality.good) {
                            console.log("Switching up to " + quality.name + " quality");
                            abr.setQuality(quality.name);
                        } else {
                            abr.tryUpper();
                        }
                    }
                }
            },
            useGoodQuality: function() {
                if (!abr.manual && !abr.paused) {
                    if (!abr.currentQualityName) {
                        let quality = abr.getFirstAvailableQuality();
                        abr.currentQualityName = quality.name;
                    }
                    abr.setQualityGood(abr.currentQualityName, true);
                    abr.keepGoodQuality();
                }
            },
            keepGoodQuality: function() {
                if (abr.keepGoodTimeout && !abr.keepGoodTimer && abr.getUpperQuality(abr.currentQualityName)) {
                    abr.keepGoodTimer = setTimeout(() => {
                        abr.shiftUp();
                        abr.stopKeeping();
                    }, abr.keepGoodTimeout);
                }
            },
            stopKeeping: function() {
                if (abr.keepGoodTimer) {
                    clearTimeout(abr.keepGoodTimer);
                    abr.keepGoodTimer = null;
                }
            },
            tryUpper: function() {
                let quality = abr.getUpperQuality(abr.currentQualityName);
                if (abr.tryUpperTimeout && !abr.tryUpperTimer && quality) {
                    abr.tryUpperTimer = setTimeout(() => {
                        abr.setQualityGood(quality.name, true);
                        abr.stopTrying();
                    }, abr.tryUpperTimeout);
                }
            },
            stopTrying: function() {
                if (abr.tryUpperTimer) {
                    clearTimeout(abr.tryUpperTimer);
                    abr.tryUpperTimer = null;
                }
            },
            setQuality: async function(name) {
                // Pause switching until a new quality is received
                abr.pause();
                abr.currentQualityName = name;
                await room.changeQuality(abr.track.id, abr.currentQualityName);
            }
        }
        return abr;
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

const createInfoDisplay = function(parent, text) {
    const div = document.createElement("div");
    if (text) {
        div.innerHTML = text;
    }
    div.setAttribute("style","width:auto; height:30px;");
    div.setAttribute("class","text-center");
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

const createContainer = function(parent) {
    const div = document.createElement("div");
    div.setAttribute("style","width:auto; height:auto;");
    div.setAttribute("class","text-center");
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

const createQualityButton = function(qualityName, buttonsList, parent) {
    const div = document.createElement("button");
    div.innerText = qualityName;
    div.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
    div.style.color = QUALITY_COLORS.UNAVAILABLE;
    if (buttonsList) {
        buttonsList.push(div);
    }
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

const setQualityButtonsColor = function(qualityDivs) {
    for (let c = 0; c < qualityDivs.length; c++) {
        if (qualityDivs[c].style.color !== QUALITY_COLORS.UNAVAILABLE) {
            qualityDivs[c].style.color = QUALITY_COLORS.AVAILABLE;
        }
    }
}

// Helper functions to display/hide an element
const showItem = function(tag) {
    if (tag) {
        tag.style.display = "block";
    }
}

const hideItem = function(tag) {
    if (tag) {
        tag.style.display = "none";
    }
}
