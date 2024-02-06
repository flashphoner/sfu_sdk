const ABR_QUALITY_CHECK_PERIOD = 1000;
const ABR_KEEP_ON_QUALITY = 20000;
const ABR_TRY_UPPER_QUALITY = 20000;
const QUALITY_COLORS = {
    NONE: "",
    AVAILABLE: "gray",
    UNAVAILABLE: "red",
    SELECTED: "blue"
};

const initLocalDisplay = function (localDisplayElement) {
    const localDisplayDiv = localDisplayElement;
    const localDisplays = {};

    const removeLocalDisplay = function (id) {
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

    const getAudioContainer = function () {
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

    const onMuteClick = function (button, stream, type) {
        if (stream.getAudioTracks().length > 0) {
            stream.getAudioTracks()[0].enabled = !(stream.getAudioTracks()[0].enabled);
            button.innerHTML = audioStateText(stream) + " " + type;
        }
    }

    const add = function (id, name, stream, type) {
        if (stream.getAudioTracks().length > 0) {
            let videoElement = getAudioContainer();
            if (videoElement) {
                let track = stream.getAudioTracks()[0];
                videoElement.video.srcObject.addTrack(track);
                videoElement.audioStateDisplay.innerHTML = audioStateText(stream) + " " + type;
                videoElement.audioStateDisplay.addEventListener("click", function () {
                    onMuteClick(videoElement.audioStateDisplay, stream, type);
                });
                track.addEventListener("ended", function () {
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
        audioStateDisplay.innerText = audioStateText();
        coreDisplay.appendChild(audioStateDisplay);

        const streamDisplay = createContainer(coreDisplay);
        streamDisplay.id = "stream-" + id;
        const video = document.createElement("video");
        video.muted = true;
        if (Browser().isSafariWebRTC()) {
            video.setAttribute("playsinline", "");
            video.setAttribute("webkit-playsinline", "");
        }
        streamDisplay.appendChild(video);
        video.srcObject = stream;
        video.onloadedmetadata = function (e) {
            video.play();
        };
        stream.getTracks().forEach(function (track) {
            track.addEventListener("ended", function () {
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
            audioStateDisplay.addEventListener("click", function () {
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
        if (stream && stream.getAudioTracks().length > 0) {
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

const abrManagerFactory = function (room, abrOptions) {
    return {
        createAbrManager: function () {
            let abr = {
                track: null,
                interval: abrOptions.interval,
                thresholds: abrOptions.thresholds,
                qualities: [],
                currentQualityName: null,
                statTimer: null,
                paused: false,
                manual: false,
                keepGoodTimeout: abrOptions.abrKeepOnGoodQuality,
                keepGoodTimer: null,
                tryUpperTimeout: abrOptions.abrTryForUpperQuality,
                tryUpperTimer: null,
                start: function () {
                    this.stop();
                    console.log("Start abr interval")
                    if (abr.interval) {
                        const thresholds = Thresholds();
                        for (const threshold of abr.thresholds) {
                            thresholds.add(threshold.parameter, threshold.maxLeap);
                        }
                        abr.statsTimer = setInterval(() => {
                            if (abr.track) {
                                room.getStats(abr.track.track, constants.SFU_RTC_STATS_TYPE.INBOUND, (stats) => {
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
                stop: function () {
                    console.log("Stop abr interval")
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
                pause: function () {
                    abr.paused = true;
                },
                resume: function () {
                    abr.paused = false;
                },
                setAuto: function () {
                    abr.manual = false;
                    abr.resume();
                },
                setManual: function () {
                    abr.manual = true;
                    abr.pause();
                },
                isAuto: function () {
                    return !abr.manual;
                },
                setTrack: function (track) {
                    abr.track = track;
                },
                setQualitiesList: function (qualities) {
                    abr.qualities = qualities;
                },
                clearQualityState: function () {
                    abr.qualities = [];
                    abr.currentQualityName = null;
                },
                addQuality: function (name) {
                    abr.qualities.push({name: name, available: false, good: true});
                },
                setQualityAvailable: function (name, available) {
                    for (let i = 0; i < abr.qualities.length; i++) {
                        if (name === abr.qualities[i].name) {
                            abr.qualities[i].available = available;
                        }
                    }
                },
                setQualityGood: function (name, good) {
                    if (name) {
                        for (let i = 0; i < abr.qualities.length; i++) {
                            if (name === abr.qualities[i].name) {
                                abr.qualities[i].good = good;
                            }
                        }
                    }
                },
                getFirstAvailableQuality: function () {
                    for (let i = 0; i < abr.qualities.length; i++) {
                        if (abr.qualities[i].available) {
                            return abr.qualities[i];
                        }
                    }
                    return null;
                },
                getLowerQuality: function (name) {
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
                getUpperQuality: function (name) {
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
                shiftDown: function () {
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
                shiftUp: function () {
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
                useGoodQuality: function () {
                    if (!abr.manual && !abr.paused) {
                        if (!abr.currentQualityName) {
                            let quality = abr.getFirstAvailableQuality();
                            abr.currentQualityName = quality.name;
                        }
                        abr.setQualityGood(abr.currentQualityName, true);
                        abr.keepGoodQuality();
                    }
                },
                keepGoodQuality: function () {
                    if (abr.keepGoodTimeout && !abr.keepGoodTimer && abr.getUpperQuality(abr.currentQualityName)) {
                        console.log("start keepGoodTimer");
                        abr.keepGoodTimer = setTimeout(() => {
                            abr.shiftUp();
                            abr.stopKeeping();
                        }, abr.keepGoodTimeout);
                    }
                },
                stopKeeping: function () {
                    if (abr.keepGoodTimer) {
                        clearTimeout(abr.keepGoodTimer);
                        abr.keepGoodTimer = null;
                    }
                },
                tryUpper: function () {
                    let quality = abr.getUpperQuality(abr.currentQualityName);
                    if (abr.tryUpperTimeout && !abr.tryUpperTimer && quality) {
                        abr.tryUpperTimer = setTimeout(() => {
                            abr.setQualityGood(quality.name, true);
                            abr.stopTrying();
                        }, abr.tryUpperTimeout);
                    }
                },
                stopTrying: function () {
                    if (abr.tryUpperTimer) {
                        clearTimeout(abr.tryUpperTimer);
                        abr.tryUpperTimer = null;
                    }
                },
                setQuality: async function (name) {
                    console.log("set quality name");
                    // Pause switching until a new quality is received
                    abr.pause();
                    abr.currentQualityName = name;
                    abr.track.setPreferredQuality(abr.currentQualityName);
                }
            }
            return abr;
        }
    }
}


const createDefaultMeetingModel = function (meetingView, participantFactory, displayOptions, abrFactory) {
    return {
        participants: new Map(),
        meetingName: null,
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
        renameParticipant: function (userId, newNickname) {
            const participant = this.participants.get(userId);
            if (participant) {
                participant.setNickname(newNickname);
            }
        },
        addTracks: function (userId, tracks) {
            const participant = this.participants.get(userId);
            if (!participant) {
                return;
            }

            for (const track of tracks) {
                if (track.type === "VIDEO") {
                    participant.addVideoTrack(track);
                } else if (track.type === "AUDIO") {
                    participant.addAudioTrack(track);
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

const createDefaultMeetingView = function (entryPoint) {
    const rootDiv = document.createElement("div");
    rootDiv.setAttribute("class", "grid-item");
    entryPoint.appendChild(rootDiv);
    const title = document.createElement("label");
    title.setAttribute("style", "display:block; border: solid; border-width: 1px");
    rootDiv.appendChild(title);
    return {
        participantViews: new Map(),
        setMeetingName: function (id) {
            title.innerText = "Meeting: " + id;
        },
        addParticipant: function (userId, participantName, cell) {
            const participantDiv = createContainer(rootDiv);
            participantDiv.appendChild(cell);
            this.participantViews.set(userId, participantDiv);
        },
        removeParticipant: function (userId) {
            const cell = this.participantViews.get(userId);
            if (cell) {
                this.participantViews.delete(userId);
                cell.remove();
            }
        },
        end: function () {
            rootDiv.remove();
        }
    }
}
const oneToOneParticipantFactory = function (remoteTrackFactory) {
    return createParticipantFactory(remoteTrackFactory, createOneToOneParticipantView, createOneToOneParticipantModel);
}
const createParticipantFactory = function (remoteTrackFactory, createParticipantView, createParticipantModel) {
    return {
        displayOptions: null,
        abrFactory: null,
        createParticipant: function (userId, nickname) {
            const view = createParticipantView();
            const model = createParticipantModel(userId, nickname, view, remoteTrackFactory, this.abrFactory, this.displayOptions);
            const controller = createParticipantController(model);
            return [model, view, controller];
        }
    }
}

const createParticipantController = function (model) {
    return {
        addVideoTrack: function (track) {
            model.addVideoTrack(track);
        },
        removeVideoTrack: function (track) {
            model.removeVideoTrack(track);
        },
        addAudioTrack: function (track) {
            model.addAudioTrack(track);
        },
        removeAudioTrack: function (track) {
            model.removeAudioTrack(track);
        },
        updateQualityInfo: function (qualityInfo) {
            model.updateQualityInfo(qualityInfo);
        },
        setNickname: function (nickname) {
            model.setNickname(nickname);
        },
        dispose: function () {
            model.dispose();
        }
    }
}

const createOneToManyParticipantView = function () {

    const participantDiv = createContainer(null);

    const audioDisplay = createContainer(participantDiv);

    const participantNicknameDisplay = createInfoDisplay(participantDiv, "Name: ")

    const audioElements = new Map();
    const player = createVideoPlayer(participantDiv);

    return {
        rootDiv: participantDiv,
        currentTrack: null,
        dispose: function () {
            player.dispose();
            for (const element of audioElements.values()) {
                element.dispose();
            }
            audioElements.clear();
        },
        addVideoTrack: function (track, requestVideoTrack) {
            player.addVideoTrack(track, async () => {
                return requestVideoTrack();
            });
        },
        removeVideoTrack: function (track) {
            player.removeVideoTrack(track);
        },
        addVideoSource: function (remoteVideoTrack, track, onResize, muteHandler, onSidClick, onTidClick) {
            this.currentTrack = track;
            player.setVideoSource(remoteVideoTrack, onResize, muteHandler, onSidClick, onTidClick);
        },
        removeVideoSource: function (track) {
            if (this.currentTrack && this.currentTrack.mid === track.mid) {
                player.removeVideoSource();
            }
        },
        showVideoTrack: function (track) {
            player.showVideoTrack(track);
        },
        addAudioTrack: function (track, audioTrack, show) {
            const audioPlayer = createAudioPlayer(audioDisplay, track, audioTrack, show);
            audioElements.set(track.mid, audioPlayer);
        },
        removeAudioTrack: function (track) {
            const audioElement = audioElements.get(track.mid);
            if (audioElement) {
                audioElement.dispose();
                audioElements.delete(track.mid);
            }
        },
        setNickname: function (userId, nickname) {
            const additionalUserId = userId ? "#" + getShortUserId(userId) : "";
            participantNicknameDisplay.innerText = "Name: " + nickname + additionalUserId;
        },
        updateQuality: function (track, quality) {
            player.updateQuality(quality);
        },
        addQuality: function (track, quality, onQualityPick) {
            player.addQuality(quality, onQualityPick);
        },
        clearQualityState: function (track) {
            player.clearQualityState();
        },
        pickQuality: function (track, qualityName) {
            player.pickQuality(qualityName);
        }
    }
}

const createVideoPlayer = function (participantDiv) {

    const streamDisplay = createContainer(participantDiv);

    const resolutionLabel = createInfoDisplay(streamDisplay, "0x0");
    hideItem(resolutionLabel);

    const trackNameDisplay = createInfoDisplay(streamDisplay, "track not set");
    hideItem(trackNameDisplay);

    const videoMuteDisplay = createContainer(streamDisplay);

    const qualityDisplay = createContainer(streamDisplay);

    const trackDisplay = createContainer(streamDisplay);

    let videoElement;
    // traciId/
    // {btn: button,
    // qualities:Map{quality
    //      {name:string,
    //      available:boolean,
    //      btn: button,
    //             spatialLayersInfo:Map{
    //                  available:boolean,
    //                  resolution{width:number,height:number},
    //                  sid:number,
    //                  btn: button},
    //                  temporalLayersInfo:Map{
    //                  available:boolean,
    //                  tid:number,
    //                  btn: button}
    //                  }
    //      }

    const tracksInfo = new Map();
    const qualityButtons = new Map();

    const lock = function () {
        for (const btn of tracksInfo.values()) {
            btn.disabled = true;
        }
        for (const state of qualityButtons.values()) {
            state.btn.disabled = true;
            for (const [sid, spatialLayerButton] of state.layerButtons.spatialLayerButtons) {
                spatialLayerButton.btn.disabled = true;
            }
            for (const [sid, temporalLayerButton] of state.layerButtons.temporalLayerButtons) {
                temporalLayerButton.btn.disabled = true;
            }
        }
    }

    const unlock = function () {
        for (const btn of tracksInfo.values()) {
            btn.disabled = false;
        }
        for (const state of qualityButtons.values()) {
            state.btn.disabled = false;
            for (const [sid, spatialLayerButton] of state.layerButtons.spatialLayerButtons) {
                spatialLayerButton.btn.disabled = false;
            }
            for (const [sid, temporalLayerButton] of state.layerButtons.temporalLayerButtons) {
                temporalLayerButton.btn.disabled = false;
            }
        }
    }

    const setWebkitEventHandlers = function (video) {
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
    }
    const setEventHandlers = function (video) {
        // Ignore play/pause button
        video.addEventListener("pause", function () {
            console.log("Media paused by click, continue...");
            video.play();
        });
    }

    const repickQuality = function (qualityName) {
        for (const [quality, state] of qualityButtons.entries()) {
            state.layerButtons.temporalLayerButtons.forEach((lState, __) => {
                if(lState.btn.style.color === QUALITY_COLORS.SELECTED) {
                    lState.btn.style.color = QUALITY_COLORS.AVAILABLE;
                }
            });
            state.layerButtons.spatialLayerButtons.forEach((lState, __) => {
                if(lState.btn.style.color === QUALITY_COLORS.SELECTED) {
                    lState.btn.style.color = QUALITY_COLORS.AVAILABLE;
                }
            });
            if (quality === qualityName) {
                state.layerButtons.temporalLayerButtons.forEach((lState, __) => showItem(lState.btn));
                state.layerButtons.spatialLayerButtons.forEach((lState, __) => showItem(lState.btn));

                state.btn.style.color = QUALITY_COLORS.SELECTED;
            } else if (state.btn.style.color === QUALITY_COLORS.SELECTED) {
                state.layerButtons.temporalLayerButtons.forEach((lState, __) => hideItem(lState.btn));
                state.layerButtons.spatialLayerButtons.forEach((lState, __) => hideItem(lState.btn));
                if (state.available) {
                    state.btn.style.color = QUALITY_COLORS.AVAILABLE;
                } else {
                    state.btn.style.color = QUALITY_COLORS.UNAVAILABLE;
                }
            }
        }
    }

    const repickSid = function (qualityName, sid) {
        const qualityState = qualityButtons.get(qualityName);
        for (const [__, state] of qualityState.layerButtons.spatialLayerButtons.entries()) {
            if (state.layerInfo.sid === sid) {
                state.btn.style.color = QUALITY_COLORS.SELECTED;
            } else if (state.layerInfo.available) {
                state.btn.style.color = QUALITY_COLORS.AVAILABLE;
            } else {
                state.btn.style.color = QUALITY_COLORS.UNAVAILABLE;
            }
        }
    }

    const repickTid = function (qualityName, tid) {
        const qualityState = qualityButtons.get(qualityName);
        for (const [__, state] of qualityState.layerButtons.temporalLayerButtons.entries()) {
            if (state.layerInfo.tid === tid) {
                state.btn.style.color = QUALITY_COLORS.SELECTED;
            } else if (state.layerInfo.available) {
                state.btn.style.color = QUALITY_COLORS.AVAILABLE;
            } else {
                state.btn.style.color = QUALITY_COLORS.UNAVAILABLE;
            }
        }
    }

    return {
        rootDiv: streamDisplay,
        muteButton: null,
        autoButton: null,
        tidListener: null,
        sidListener: null,
        dispose: function () {
            streamDisplay.remove();
        },
        clearQualityState: function () {
            qualityButtons.forEach((state, qName) => {
                state.btn.remove();
                state.layerButtons.temporalLayerButtons.forEach((lState, __) => lState.btn.remove());
                state.layerButtons.spatialLayerButtons.forEach((lState, __) => lState.btn.remove());
            });
            qualityButtons.clear();
        },
        addVideoTrack: function (track, asyncCallback) {
            const trackButton = document.createElement("button");
            tracksInfo.set(track.mid, trackButton);
            trackButton.innerText = "Track №" + track.mid + ": " + track.contentType;
            trackButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
            trackButton.style.color = QUALITY_COLORS.AVAILABLE;
            const self = this;
            trackButton.addEventListener('click', async function () {
                console.log("Clicked on track button track.mid " + track.mid);
                if (trackButton.style.color === QUALITY_COLORS.SELECTED) {
                    return
                }

                lock();
                asyncCallback().then(() => {
                    self.showVideoTrack(track);
                }).finally(() => {
                    unlock();
                });
            });
            trackDisplay.appendChild(trackButton);
        },
        removeVideoTrack: function (track) {
            const trackButton = tracksInfo.get(track.mid);
            if (trackButton) {
                trackButton.remove();
                tracksInfo.delete(track.mid);
            }
        },
        setVideoSource: function (remoteVideoTrack, onResize, onMute, onSidClick, onTidClick) {
            if (!this.muteButton) {
                const newVideoMuteBtn = document.createElement("button");
                this.muteButton = newVideoMuteBtn;
                newVideoMuteBtn.innerText = "Mute video";
                newVideoMuteBtn.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                newVideoMuteBtn.addEventListener('click', async function () {
                    newVideoMuteBtn.disabled = true;
                    try {
                        if (newVideoMuteBtn.innerText === "Mute video") {
                            await onMute(true);
                            newVideoMuteBtn.innerText = "Unmute video";
                        } else if (newVideoMuteBtn.innerText === "Unmute video") {
                            await onMute(false);
                            newVideoMuteBtn.innerText = "Mute video";
                        }
                    } finally {
                        newVideoMuteBtn.disabled = false;
                    }
                });
                videoMuteDisplay.appendChild(newVideoMuteBtn);
            }
            this.sidListener = onSidClick;
            this.tidListener = onTidClick;

            if (videoElement) {
                videoElement.remove();
                videoElement = null;
            }

            if (!remoteVideoTrack) {
                return;
            }

            videoElement = document.createElement("video");
            hideItem(videoElement);
            videoElement.setAttribute("style", "display:none; border: solid; border-width: 1px");

            const stream = new MediaStream();

            streamDisplay.appendChild(videoElement);
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = function (e) {
                videoElement.play();
            };
            videoElement.addEventListener("resize", function (event) {
                showItem(resolutionLabel);
                if (videoElement) {
                    resolutionLabel.innerText = videoElement.videoWidth + "x" + videoElement.videoHeight;
                    resizeVideo(event.target);
                    onResize();
                }
            });
            stream.addTrack(remoteVideoTrack);
            if (Browser().isSafariWebRTC()) {
                videoElement.setAttribute("playsinline", "");
                videoElement.setAttribute("webkit-playsinline", "");
                setWebkitEventHandlers(videoElement);
            } else {
                setEventHandlers(videoElement);
            }
        },
        removeVideoSource: function () {
            if (videoElement) {
                videoElement.remove();
                videoElement = null;
            }
            if (this.muteButton) {
                this.muteButton.remove();
                this.muteButton = null;
            }
            hideItem(resolutionLabel);
            trackNameDisplay.innerText = "track not set";
        },
        showVideoTrack: function (track) {
            if (videoElement) {
                showItem(videoElement);
            }
            for (const [mid, btn] of tracksInfo.entries()) {
                if (mid === track.mid) {
                    btn.style.color = QUALITY_COLORS.SELECTED;
                } else if (btn.style.color === QUALITY_COLORS.SELECTED) {
                    btn.style.color = QUALITY_COLORS.AVAILABLE;
                }
            }
            trackNameDisplay.innerText = "Current video track: " + track.mid;
            showItem(trackNameDisplay);
        },
        updateQuality: function (quality) {
            console.log("updateQuality" + quality.available);
            const qualityInfo = qualityButtons.get(quality.quality);
            if (qualityInfo) {
                const qualityButton = qualityInfo.btn;
                qualityInfo.available = quality.available;
                const isSelectedQuality = qualityButton.style.color === QUALITY_COLORS.SELECTED;

                if (quality.available) {
                    if(!isSelectedQuality) {
                        qualityButton.style.color = QUALITY_COLORS.AVAILABLE;
                    }
                } else {
                    qualityButton.style.color = QUALITY_COLORS.UNAVAILABLE;
                }
                const self = this;
                for (const spatialLayer of quality.layersInfo.spatialLayers) {
                    const localLayerInfo = qualityInfo.layerButtons.spatialLayerButtons.get(spatialLayer.sid);
                    if (localLayerInfo) {
                        if (spatialLayer.available) {
                            localLayerInfo.btn.style.color = QUALITY_COLORS.AVAILABLE;
                        } else {
                            localLayerInfo.btn.style.color = QUALITY_COLORS.UNAVAILABLE;
                        }
                        localLayerInfo.btn.innerText = "sid-" + spatialLayer.sid + " | " + spatialLayer.resolution.width + "x" + spatialLayer.resolution.height;
                    } else {
                        const layerButton = document.createElement("button");
                        layerButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                        if (!isSelectedQuality) {
                            hideItem(layerButton);
                        }
                        layerButton.innerText = "sid-" + spatialLayer.sid + " | " + spatialLayer.resolution.width + "x" + spatialLayer.resolution.height;
                        layerButton.addEventListener('click', async function () {
                            console.log("Clicked on sid button " + spatialLayer.sid);
                            if (layerButton.style.color === QUALITY_COLORS.SELECTED || layerButton.style.color === QUALITY_COLORS.UNAVAILABLE || !videoElement) {
                                return;
                            }
                            if (self.sidListener) {
                                lock();
                                self.sidListener(spatialLayer.sid).finally(() => {
                                    unlock();
                                    repickSid(quality.quality, spatialLayer.sid);
                                });
                            }
                        });
                        if (spatialLayer.available) {
                            layerButton.style.color = QUALITY_COLORS.AVAILABLE;
                        } else {
                            layerButton.style.color = QUALITY_COLORS.UNAVAILABLE;
                        }
                        qualityInfo.layerButtons.spatialLayerButtons.set(spatialLayer.sid, {
                            btn: layerButton,
                            layerInfo: spatialLayer
                        });
                        qualityDisplay.appendChild(layerButton);
                    }
                }

                for (const temporalLayer of quality.layersInfo.temporalLayers) {
                    const localLayerInfo = qualityInfo.layerButtons.temporalLayerButtons.get(temporalLayer.tid);
                    if (localLayerInfo) {
                        if (temporalLayer.available) {
                            localLayerInfo.btn.style.color = QUALITY_COLORS.AVAILABLE;
                        } else {
                            localLayerInfo.btn.style.color = QUALITY_COLORS.UNAVAILABLE;
                        }
                        localLayerInfo.btn.innerText = "tid-" + temporalLayer.tid;
                    } else {
                        const layerButton = document.createElement("button");
                        layerButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                        if (!isSelectedQuality) {
                            hideItem(layerButton);
                        }
                        layerButton.innerText = "tid-" + temporalLayer.tid;
                        layerButton.addEventListener('click', async function () {
                            console.log("Clicked on tid button " + temporalLayer.tid);
                            if (layerButton.style.color === QUALITY_COLORS.SELECTED || layerButton.style.color === QUALITY_COLORS.UNAVAILABLE || !videoElement) {
                                return;
                            }
                            if (self.tidListener) {
                                lock();
                                self.tidListener(temporalLayer.tid).finally(() => {
                                    unlock();
                                    repickTid(quality.quality, temporalLayer.tid);
                                });
                            }
                        });
                        if (temporalLayer.available) {
                            layerButton.style.color = QUALITY_COLORS.AVAILABLE;
                        } else {
                            layerButton.style.color = QUALITY_COLORS.UNAVAILABLE;
                        }
                        qualityInfo.layerButtons.temporalLayerButtons.set(temporalLayer.tid, {
                            btn: layerButton,
                            layerInfo: temporalLayer
                        })
                        qualityDisplay.appendChild(layerButton);
                    }
                }
            }
        },
        addQuality: function (quality, onQualityClick) {
            console.log("addQuality" + quality.available);

            const qualityButton = document.createElement("button");
            qualityButton.innerText = quality.quality;
            qualityButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
            if (quality.available) {
                qualityButton.style.color = QUALITY_COLORS.AVAILABLE;
            } else {
                qualityButton.style.color = QUALITY_COLORS.UNAVAILABLE;
            }
            qualityDisplay.appendChild(qualityButton);
            const self = this;
            qualityButton.addEventListener('click', async function () {
                console.log("Clicked on quality button " + quality.quality);
                if (qualityButton.style.color === QUALITY_COLORS.SELECTED || qualityButton.style.color === QUALITY_COLORS.UNAVAILABLE || !videoElement) {
                    return;
                }
                lock();
                onQualityClick().finally(() => {
                    unlock();
                    repickQuality(quality.quality);
                });
            });

            const spatialLayers = new Map();
            for (const spatialLayer of quality.layersInfo.spatialLayers) {
                const layerButton = document.createElement("button");
                layerButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                hideItem(layerButton);
                layerButton.innerText = "sid-" + spatialLayer.sid + " | " + spatialLayer.resolution.width + "x" + spatialLayer.resolution.height;
                layerButton.addEventListener('click', async function () {
                    console.log("Clicked on sid button " + spatialLayer.sid);
                    if (layerButton.style.color === QUALITY_COLORS.SELECTED || layerButton.style.color === QUALITY_COLORS.UNAVAILABLE || !videoElement) {
                        return;
                    }
                    if (self.sidListener) {
                        lock();
                        self.sidListener(spatialLayer.sid).finally(() => {
                            unlock();
                            repickSid(quality.quality, spatialLayer.sid);
                        });
                    }
                });
                if (spatialLayer.available) {
                    layerButton.style.color = QUALITY_COLORS.AVAILABLE;
                } else {
                    layerButton.style.color = QUALITY_COLORS.UNAVAILABLE;
                }
                spatialLayers.set(spatialLayer.sid, {btn: layerButton, layerInfo: spatialLayer});
                qualityDisplay.appendChild(layerButton);
            }

            const temporalLayers = new Map();
            for (const temporalLayer of quality.layersInfo.temporalLayers) {
                const layerButton = document.createElement("button");
                layerButton.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
                hideItem(layerButton);
                layerButton.innerText = "tid-" + temporalLayer.tid;
                layerButton.addEventListener('click', async function () {
                    console.log("Clicked on tid button " + temporalLayer.tid);
                    if (layerButton.style.color === QUALITY_COLORS.SELECTED || layerButton.style.color === QUALITY_COLORS.UNAVAILABLE || !videoElement) {
                        return;
                    }
                    if (self.tidListener) {
                        lock();
                        self.tidListener(temporalLayer.tid).finally(() => {
                            unlock();
                            repickTid(quality.quality, temporalLayer.tid);
                        });
                    }
                });
                if (temporalLayer.available) {
                    layerButton.style.color = QUALITY_COLORS.AVAILABLE;
                } else {
                    layerButton.style.color = QUALITY_COLORS.UNAVAILABLE;
                }
                temporalLayers.set(temporalLayer.tid, {btn: layerButton, layerInfo: temporalLayer})
                qualityDisplay.appendChild(layerButton);
            }
            qualityButtons.set(quality.quality, {
                btn: qualityButton,
                available: quality.available,
                layerButtons: {spatialLayerButtons: spatialLayers, temporalLayerButtons: temporalLayers}
            });
        },
        pickQuality: function (qualityName) {
            repickQuality(qualityName);
        }
    }
}

const createAudioPlayer = function (audioDisplay, track, audioTrack, show) {
    let audioElement;
    let audioMuteButton

    const displayMute = function (audioTag) {
        let text = "";
        if (audioTag.muted) {
            text = "Unmute audio";
        } else {
            text = "Mute audio";
        }
        return text;
    }

    const createAudioElement = function () {
        const div = document.createElement("audio");
        div.controls = "controls";
        div.muted = true;
        div.autoplay = true;
        return div;
    }

    const createAudioMuteButton = function (trackId, audioTag) {
        const div = document.createElement("button");
        div.innerText = displayMute(audioTag) + " " + trackId;
        div.setAttribute("style", "display:inline-block; border: solid; border-width: 1px");
        div.onclick = function (e) {
            audioTag.muted = !audioTag.muted;
            div.innerText = displayMute(audioTag) + " " + trackId;
        };
        return div;
    }

    const create = function (audioDisplay, track, audioTrack, show) {
        const stream = new MediaStream();
        stream.addTrack(audioTrack);
        audioElement = createAudioElement();
        audioMuteButton = createAudioMuteButton(track.mid, audioElement);
        audioElement.onloadedmetadata = function (e) {
            audioElement.play().then(function () {
                if (Browser().isSafariWebRTC() && Browser().isiOS()) {
                    console.warn("Audio track should be manually unmuted in iOS Safari");
                } else {
                    audioElement.muted = false;
                    audioMuteButton.innerText = displayMute(audioElement) + " " + track.mid;
                }
            });
        };
        if (show) {
            hideItem(audioMuteButton);
        } else {
            hideItem(audioElement);
        }
        audioDisplay.appendChild(audioElement);
        audioDisplay.appendChild(audioMuteButton);
        audioElement.srcObject = stream;
    }

    create(audioDisplay, track, audioTrack, show);

    return {
        dispose() {
            audioElement.remove();
            audioMuteButton.remove();
        }
    };
}

const createOneToOneParticipantView = function () {

    const participantDiv = createContainer(null);

    const audioDisplay = createContainer(participantDiv);

    const participantNicknameDisplay = createInfoDisplay(participantDiv, "Name: ")

    const videoPlayers = new Map();
    const audioElements = new Map();

    return {
        rootDiv: participantDiv,
        dispose: function () {
            for (const player of videoPlayers.values()) {
                player.dispose();
            }
            videoPlayers.clear();
            for (const element of audioElements.values()) {
                element.dispose();
            }
            audioElements.clear();
        },
        addVideoTrack: function (track) {
            const player = createVideoPlayer(participantDiv);
            videoPlayers.set(track.mid, player);
        },
        removeVideoTrack: function (track) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.dispose();
            }
        },
        addVideoSource: function (remoteVideoTrack, track, onResize, muteHandler, onSidClick, onTidClick) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.setVideoSource(remoteVideoTrack, onResize, muteHandler, onSidClick, onTidClick);
            }
        },
        removeVideoSource: function (track) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.removeVideoSource();
            }
        },
        showVideoTrack: function (track) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.showVideoTrack(track);
            }
        },
        addAudioTrack: function (track, audioTrack, show) {
            const audioPlayer = createAudioPlayer(audioDisplay, track, audioTrack, show);
            audioElements.set(track.mid, audioPlayer);
        },
        removeAudioTrack: function (track) {
            const audioElement = audioElements.get(track.mid);
            if (audioElement) {
                audioElement.dispose();
                audioElements.delete(track.mid);
            }
        },
        setNickname: function (userId, nickname) {
            const additionalUserId = userId ? "#" + getShortUserId(userId) : "";
            participantNicknameDisplay.innerText = "Name: " + nickname + additionalUserId;
        },
        updateQuality: function (track, qualityName, available) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.updateQuality(qualityName, available);
            }
        },
        addQuality: function (track, quality, onQualityPick) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.addQuality(quality, onQualityPick);
            }
        },
        pickQuality: function (track, qualityName) {
            const player = videoPlayers.get(track.mid);
            if (player) {
                player.pickQuality(qualityName);
            }
        }
    }
}
const createOneToOneParticipantModel = function (userId, nickname, participantView, remoteTrackFactory, abrFactory, displayOptions) {
    const instance = {
        userId: userId,
        nickname: nickname,
        remoteVideoTracks: new Map(),
        remoteAudioTracks: new Map(),
        audioTracks: new Map(),
        videoTracks: new Map(),
        abrManagers: new Map(),
        disposed: false,
        dispose: async function () {
            this.disposed = true;
            participantView.dispose();
            this.remoteVideoTracks.forEach((track, id) => {
                track.dispose();
            })
            this.remoteVideoTracks.clear();

            this.remoteAudioTracks.forEach((track, id) => {
                track.dispose();
            })
            this.remoteAudioTracks.clear();

            this.abrManagers.forEach((abrManager, id) => {
                abrManager.stop();
            })
            this.abrManagers.clear();

        },
        addVideoTrack: function (track) {
            this.videoTracks.set(track.mid, track);
            if (!track.quality) {
                track.quality = [];
            }
            participantView.addVideoTrack(track);
            const self = this;
            remoteTrackFactory.getVideoTrack().then((remoteTrack) => {
                if (remoteTrack) {
                    if (self.disposed || !self.videoTracks.get(track.mid)) {
                        remoteTrack.dispose();
                        return;
                    }

                    participantView.addVideoSource(remoteTrack.track, track, () => {
                        const abrManager = self.abrManagers.get(track.id);
                        if (!abrManager) {
                            return;
                        }
                        if (abrManager.isAuto()) {
                            abrManager.resume();
                        }
                    }, (mute) => {
                        if (mute) {
                            return self.muteVideo(track);
                        } else {
                            return self.unmuteVideo(track);
                        }
                    }, (sid) => {
                        return remoteTrack.setSid(sid)
                    }, (tid) => {
                        return remoteTrack.setTid(tid)
                    });
                    self.requestVideoTrack(track, remoteTrack).then(() => {
                        participantView.showVideoTrack(track);
                    }, (ex) => {
                        participantView.removeVideoSource(track);
                        remoteTrack.dispose();
                    });
                }
            }, (ex) => {
                console.log("Failed to get remote track " + ex);
            });
        },
        removeVideoTrack: function (track) {
            if (this.videoTracks.delete(track.mid)) {
                const remoteTrack = this.remoteVideoTracks.get(track.mid);
                if (remoteTrack) {
                    this.remoteVideoTracks.delete(track.mid);
                    remoteTrack.dispose();
                }
                participantView.removeVideoTrack(track);

                const abrManager = this.abrManagers.get(track.id);
                if (abrManager) {
                    this.abrManagers.delete(track.id);
                    abrManager.clearQualityState();
                    abrManager.stop();
                }
            }
        },
        addAudioTrack: function (track) {
            this.audioTracks.set(track.mid, track);
            const self = this;
            remoteTrackFactory.getAudioTrack().then((remoteTrack) => {
                if (remoteTrack) {
                    if (self.disposed || !self.audioTracks.get(track.mid)) {
                        remoteTrack.dispose();
                        return;
                    }
                    this.remoteAudioTracks.set(track.mid, remoteTrack);
                    remoteTrack.demandTrack(track.id).then(() => {
                        if (!self.audioTracks.get(track.mid)) {
                            remoteTrack.dispose();
                            self.remoteAudioTracks.delete(track.mid);
                            return;
                        }
                        participantView.addAudioTrack(track, remoteTrack.track, displayOptions.showAudio);
                    }, (ex) => {
                        console.log("Failed demand track " + ex);
                        remoteTrack.dispose();
                        self.remoteAudioTracks.delete(track.mid);
                    });
                }
            }, (ex) => {
                console.log("Failed to get audio track " + ex);
            });
        },
        removeAudioTrack: function (track) {
            if (!this.audioTracks.delete(track.mid)) {
                return
            }

            participantView.removeAudioTrack(track);
            const remoteTrack = this.remoteAudioTracks.get(track.mid);
            if (remoteTrack) {
                this.remoteAudioTracks.delete(track.mid);
                remoteTrack.dispose();
            }
        },
        setUserId: function (userId) {
            this.userId = userId;
        },
        setNickname: function (nickname) {
            this.nickname = nickname;
            participantView.setNickname(this.userId ? this.userId : "", nickname);
        },
        updateQualityInfo: function (remoteTracks) {
            for (const remoteTrackQuality of remoteTracks) {
                const track = this.videoTracks.get(remoteTrackQuality.mid);
                if (!track) {
                    continue;
                }
                if (!this.remoteVideoTracks.get(track.mid)) {
                    // update model and return, view not changed
                    for (const remoteQualityInfo of remoteTrackQuality.quality) {
                        const quality = track.quality.find((q) => q.quality === remoteQualityInfo.quality);
                        if (quality) {
                            quality.available = remoteQualityInfo.available;
                            for(const info of remoteQualityInfo.layersInfo.temporalLayers) {
                                const localTidInfo = quality.layersInfo.temporalLayers.find((t) => t.tid === info.tid);
                                if(localTidInfo) {
                                    localTidInfo.available = info.available;
                                } else {
                                    quality.layersInfo.temporalLayers.push(info);
                                }
                            }
                            for(const info of remoteQualityInfo.layersInfo.spatialLayers) {
                                const localSidInfo = quality.layersInfo.spatialLayers.find((s) => s.sid === info.sid);
                                if(localSidInfo) {
                                    localSidInfo.available = info.available;
                                    localSidInfo.resolution = info.resolution;
                                } else {
                                    quality.layersInfo.spatialLayers.push(info);
                                }
                            }
                        } else {
                            track.quality.push(remoteQualityInfo);
                        }
                    }
                    return;
                }
                let abrManager = this.abrManagers.get(track.id);
                if (abrManager && track.quality.length === 0 && remoteTrackQuality.quality.length > 0) {
                    const self = this;
                    participantView.addQuality(track, {quality:"Auto",available:true,layersInfo:{spatialLayers:[],temporalLayers:[]}}, async () => {
                        const manager = self.abrManagers.get(track.id);
                        if (!manager) {
                            return;
                        }
                        manager.start();
                        manager.setAuto();
                        participantView.pickQuality(track, "Auto");
                    })
                    if (displayOptions.autoAbr) {
                        abrManager.setAuto();
                        abrManager.start();
                        participantView.pickQuality(track, "Auto");
                    }
                }
                for (const remoteQualityInfo of remoteTrackQuality.quality) {
                    const localQuality = track.quality.find((q) => q.quality === remoteQualityInfo.quality);
                    if (localQuality) {
                        localQuality.available = remoteQualityInfo.available;
                        for(const info of remoteQualityInfo.layersInfo.temporalLayers) {
                            const localTidInfo = localQuality.layersInfo.temporalLayers.find((t) => t.tid === info.tid);
                            if(localTidInfo) {
                                localTidInfo.available = info.available;
                            } else {
                                localQuality.layersInfo.temporalLayers.push(info);
                            }
                        }
                        for(const info of remoteQualityInfo.layersInfo.spatialLayers) {
                            const localSidInfo = localQuality.layersInfo.spatialLayers.find((s) => s.sid === info.sid);
                            if(localSidInfo) {
                                localSidInfo.available = info.available;
                                localSidInfo.resolution = info.resolution;
                            } else {
                                localQuality.layersInfo.spatialLayers.push(info);
                            }
                        }
                        if (abrManager) {
                            abrManager.setQualityAvailable(remoteQualityInfo.quality, remoteQualityInfo.available);
                        }
                        if (displayOptions.quality) {
                            participantView.updateQuality(track, localQuality.quality, localQuality.available);
                        }
                    } else {
                        track.quality.push(remoteQualityInfo);
                        if (abrManager) {
                            abrManager.addQuality(remoteQualityInfo.quality);
                            abrManager.setQualityAvailable(remoteQualityInfo.quality, remoteQualityInfo.available)
                        }
                        if (displayOptions.quality) {
                            const self = this;
                            participantView.addQuality(track, remoteQualityInfo, async (sid, tid) => {
                                const manager = self.abrManagers.get(track.id);
                                if (manager) {
                                    manager.setManual();
                                    manager.setQuality(remoteQualityInfo.quality);
                                }
                                return self.pickQuality(track, remoteQualityInfo.quality, sid, tid);
                            });
                        }
                    }
                }
            }

        },
        requestVideoTrack: async function (track, remoteTrack) {
            return new Promise((resolve, reject) => {
                if (!remoteTrack || !track) {
                    reject(new Error("Remote and local track must be defined"));
                    return;
                }
                const self = this;
                remoteTrack.demandTrack(track.id).then(() => {
                    if (!self.videoTracks.get(track.mid)) {
                        reject(new Error("Video track already removed from model"));
                        return;
                    }
                    let abrManager = self.abrManagers.get(track.id);

                    if (abrManager) {
                        abrManager.clearQualityState();
                    } else if (abrFactory) {
                        abrManager = abrFactory.createAbrManager();
                        self.abrManagers.set(track.id, abrManager);
                    }

                    if (abrManager) {
                        abrManager.setTrack(remoteTrack);
                        abrManager.stop();
                        if (track.quality.length > 0) {
                            participantView.addQuality(track, {quality:"Auto",available:true, layersInfo:{spatialLayers:[],temporalLayers:[]}}, async () => {
                                const manager = self.abrManagers.get(track.id);
                                if (!manager) {
                                    return;
                                }
                                manager.start();
                                manager.setAuto();
                                participantView.pickQuality(track, "Auto");
                            });
                            if (displayOptions.autoAbr) {
                                abrManager.setAuto();
                                abrManager.start();
                                participantView.pickQuality(track, "Auto");
                            }
                        }
                    }
                    for (const qualityDescriptor of track.quality) {
                        if (abrManager) {
                            abrManager.addQuality(qualityDescriptor.quality);
                            abrManager.setQualityAvailable(qualityDescriptor.quality, qualityDescriptor.available);
                        }
                        if (displayOptions.quality) {
                            participantView.addQuality(track, qualityDescriptor, async () => {
                                const manager = self.abrManagers.get(track.id);
                                if (manager) {
                                    manager.setManual();
                                    manager.setQuality(qualityDescriptor.quality);
                                }
                                return self.pickQuality(track, qualityDescriptor.quality);
                            });
                        }
                    }
                    self.remoteVideoTracks.delete(track.mid);
                    self.remoteVideoTracks.set(track.mid, remoteTrack);
                    resolve();
                }, (ex) => {
                    reject(ex);
                });
            });
        },
        pickQuality: async function (track, qualityName, tid, sid) {
            let remoteVideoTrack = this.remoteVideoTracks.get(track.mid);
            if (remoteVideoTrack) {
                return remoteVideoTrack.setPreferredQuality(qualityName, sid, tid).then(() => {
                    participantView.pickQuality(track, qualityName, sid, tid);
                });
            }
        },
        muteVideo: async function (track) {
            const remoteTrack = this.remoteVideoTracks.get(track.mid);
            if (remoteTrack) {
                return remoteTrack.mute();
            } else {
                return new Promise((resolve, reject) => {
                    reject(new Error("Remote track not defined"));
                });
            }
        },
        unmuteVideo: async function (track) {
            const remoteTrack = this.remoteVideoTracks.get(track.mid);
            if (remoteTrack) {
                return remoteTrack.unmute();
            } else {
                return new Promise((resolve, reject) => {
                    reject(new Error("Remote track not defined"));
                });
            }
        }
    };
    instance.setUserId(userId);
    instance.setNickname(nickname);
    return instance;
}

const createOneToManyParticipantModel = function (userId, nickname, participantView, remoteTrackFactory, abrFactory, displayOptions) {
    // reject may received before track removed from model.
    // If a new rejection reason is added in addition to track deletion,
    // a rejection reason analysis must be added
    const repickTrack = function (model, failedTrack) {
        if (!model.remoteVideoTrack) {
            return;
        }
        const tracks = new Map(model.videoTracks);
        if (failedTrack) {
            tracks.delete(failedTrack.mid);
            participantView.removeVideoSource(failedTrack);
        }

        if (tracks.size > 0) {
            const anotherTrack = tracks.values().next().value;
            participantView.addVideoSource(model.remoteVideoTrack.track, anotherTrack, () => {
                if (!model.abr) {
                    return;
                }
                if (model.abr.isAuto()) {
                    model.abr.resume();
                }
            }, (mute) => {
                if (mute) {
                    return model.muteVideo(anotherTrack);
                } else {
                    return model.unmuteVideo(anotherTrack);
                }
            }, (sid) => {
                return model.remoteVideoTrack.setSid(sid)
            }, (tid) => {
                return model.remoteVideoTrack.setTid(tid)
            });
            model.requestVideoTrack(anotherTrack, model.remoteVideoTrack).then(() => {
                participantView.showVideoTrack(anotherTrack)
            }, (ex) => {
                console.log("Failed to request track " + anotherTrack.mid + " " + ex);
                repickTrack(model, anotherTrack);
            });
        } else {
            if (model.abr) {
                model.abr.stop();
            }
            participantView.clearQualityState();
            if (model.remoteVideoTrack) {
                model.remoteVideoTrack.dispose();
                model.remoteVideoTrack = null;
                model.videoEnabled = false;
            }
        }
    }

    const requestTrackAndPick = function (model, targetTrack) {
        if (model.videoTracks.size === 0) {
            return;
        }
        if (!targetTrack) {
            targetTrack = model.videoTracks.values().next().value
        }
        if (!model.videoTracks.get(targetTrack.mid)) {
            return;
        }
        if (!model.videoEnabled) {
            model.videoEnabled = true;
            remoteTrackFactory.getVideoTrack().then((remoteTrack) => {
                if (!remoteTrack) {
                    model.videoEnabled = false;
                    return;
                }
                if (model.disposed || model.videoTracks.size === 0) {
                    remoteTrack.dispose();
                    model.videoEnabled = false;
                    return;
                }
                model.remoteVideoTrack = remoteTrack;
                if (!model.videoTracks.get(targetTrack.mid)) {
                    repickTrack(model, targetTrack);
                } else {
                    repickTrack(model, null);
                }
            }, (ex) => {
                model.videoEnabled = false;
                console.log("Failed to get remote track " + ex);
            });
        }
    }
    const instance = {
        userId: userId,
        nickname: nickname,
        videoEnabled: false,
        currentTrack: null,
        remoteVideoTrack: null,
        remoteAudioTracks: new Map(),
        audioTracks: new Map(),
        videoTracks: new Map(),
        abr: null,
        disposed: false,
        dispose: async function () {
            this.disposed = true;
            participantView.dispose();
            if (this.remoteVideoTrack) {
                const remoteTrack = this.remoteVideoTrack;
                this.remoteVideoTrack = null;
                remoteTrack.dispose();
            }
            this.remoteAudioTracks.forEach((track, id) => {
                track.dispose();
            })
            if (this.abr) {
                this.abr.stop();
            }
            this.remoteAudioTracks.clear();
        },
        addVideoTrack: function (track) {
            this.videoTracks.set(track.mid, track);
            if (!track.quality) {
                track.quality = [];
            }
            const self = this;
            participantView.addVideoTrack(track, () => {
                if (self.disposed) {
                    return new Promise((resolve, reject) => {
                        reject(new Error("Model disposed"));
                    });
                }

                if (self.remoteVideoTrack) {
                    return new Promise((resolve, reject) => {
                        self.requestVideoTrack(track, self.remoteVideoTrack).then(() => {
                            resolve();
                        }, (ex) => {
                            reject(ex);
                        });
                    });
                } else {
                    return new Promise((resolve, reject) => {
                        reject(new Error("Remote track is null"));
                        requestTrackAndPick(self, track);
                    });
                }
            });
            requestTrackAndPick(this, track);
        },
        removeVideoTrack: function (track) {
            this.videoTracks.delete(track.mid);
            participantView.removeVideoTrack(track);
            if (this.currentTrack && this.currentTrack.mid === track.mid) {
                repickTrack(this, track);
            }
        },
        addAudioTrack: async function (track) {
            this.audioTracks.set(track.mid, track);
            const self = this;
            remoteTrackFactory.getAudioTrack().then((remoteTrack) => {
                if (!remoteTrack) {
                    return;
                }
                if (self.disposed || !self.audioTracks.get(track.mid)) {
                    remoteTrack.dispose();
                    return;
                }
                this.remoteAudioTracks.set(track.mid, remoteTrack);
                remoteTrack.demandTrack(track.id).then(() => {
                    if (!self.audioTracks.get(track.mid)) {
                        remoteTrack.dispose();
                        self.remoteAudioTracks.delete(track.mid);
                        return;
                    }
                    participantView.addAudioTrack(track, remoteTrack.track, displayOptions.showAudio);
                }, (ex) => {
                    console.log("Failed demand track " + ex);
                    remoteTrack.dispose();
                    self.remoteAudioTracks.delete(track.mid);
                });
            }, (ex) => {
                console.log("Failed to get audio track " + ex);
            });

        },
        removeAudioTrack: function (track) {
            if (!this.audioTracks.delete(track.mid)) {
                return
            }

            participantView.removeAudioTrack(track);
            const remoteTrack = this.remoteAudioTracks.get(track.mid);
            if (remoteTrack) {
                this.remoteAudioTracks.delete(track.mid);
                remoteTrack.dispose();
            }

        },
        setUserId: function (userId) {
            this.userId = userId;
        },
        setNickname: function (nickname) {
            this.nickname = nickname;
            participantView.setNickname(this.userId ? this.userId : "", nickname);
        },
        updateQualityInfo: function (remoteTracks) {
            for (const remoteTrackQuality of remoteTracks) {
                const track = this.videoTracks.get(remoteTrackQuality.mid);
                if (!track) {
                    continue;
                }
                if (!this.currentTrack || this.currentTrack.mid !== track.mid) {
                    // update model and return, view not changed
                    for (const remoteQualityInfo of remoteTrackQuality.quality) {
                        const quality = track.quality.find((q) => q.quality === remoteQualityInfo.quality);
                        if (quality) {
                            quality.available = remoteQualityInfo.available;
                            for(const info of remoteQualityInfo.layersInfo.temporalLayers) {
                                const localTidInfo = quality.layersInfo.temporalLayers.find((t) => t.tid === info.tid);
                                if(localTidInfo) {
                                    localTidInfo.available = info.available;
                                } else {
                                    quality.layersInfo.temporalLayers.push(info);
                                }
                            }
                            for(const info of remoteQualityInfo.layersInfo.spatialLayers) {
                                const localSidInfo = quality.layersInfo.spatialLayers.find((s) => s.sid === info.sid);
                                if(localSidInfo) {
                                    localSidInfo.available = info.available;
                                    localSidInfo.resolution = info.resolution;
                                } else {
                                    quality.layersInfo.spatialLayers.push(info);
                                }
                            }
                        } else {
                            track.quality.push(remoteQualityInfo);
                        }
                    }
                    continue;
                }
                if (this.abr && track.quality.length === 0 && remoteTrackQuality.quality.length > 0) {
                    const self = this;
                    participantView.addQuality(track, {quality:"Auto",available:true, layersInfo:{spatialLayers:[],temporalLayers:[]}}, async () => {
                        if (!self.abr) {
                            return;
                        }
                        self.abr.start();
                        self.abr.setAuto();
                        participantView.pickQuality(track, "Auto");
                    })
                    if (displayOptions.autoAbr && this.abr) {
                        this.abr.setAuto();
                        this.abr.start();
                        participantView.pickQuality(track, "Auto");
                    }
                }
                for (const remoteQualityInfo of remoteTrackQuality.quality) {
                    const localQuality = track.quality.find((q) => q.quality === remoteQualityInfo.quality);
                    if (localQuality) {
                        localQuality.available = remoteQualityInfo.available;
                        for(const info of remoteQualityInfo.layersInfo.temporalLayers) {
                            const localTidInfo = localQuality.layersInfo.temporalLayers.find((t) => t.tid === info.tid);
                            if(localTidInfo) {
                                localTidInfo.available = info.available;
                            } else {
                                localQuality.layersInfo.temporalLayers.push(info);
                            }
                        }
                        for(const info of remoteQualityInfo.layersInfo.spatialLayers) {
                            const localSidInfo = localQuality.layersInfo.spatialLayers.find((s) => s.sid === info.sid);
                            if(localSidInfo) {
                                localSidInfo.available = info.available;
                                localSidInfo.resolution = info.resolution;
                            } else {
                                localQuality.layersInfo.spatialLayers.push(info);
                            }
                        }
                        if (this.abr) {
                            this.abr.setQualityAvailable(remoteQualityInfo.quality, remoteQualityInfo.available)
                        }
                        if (displayOptions.quality) {
                            participantView.updateQuality(track, remoteQualityInfo);
                        }
                    } else {
                        track.quality.push(remoteQualityInfo);
                        if (this.abr) {
                            this.abr.addQuality(remoteQualityInfo.quality);
                            this.abr.setQualityAvailable(remoteQualityInfo.quality, remoteQualityInfo.available)
                        }
                        if (displayOptions.quality) {
                            const self = this;
                            participantView.addQuality(track, remoteQualityInfo, async () => {
                                if (self.abr) {
                                    self.abr.setManual();
                                    self.abr.setQuality(remoteQualityInfo.quality);
                                }
                                return self.pickQuality(track, remoteQualityInfo.quality);
                            });
                        }
                    }
                }
            }
        },
        requestVideoTrack: async function (track, remoteTrack) {
            return new Promise((resolve, reject) => {
                if (!remoteTrack || !track) {
                    reject(new Error("Remote and local track must be defined"));
                    return;
                }
                const self = this;
                remoteTrack.demandTrack(track.id).then(() => {
                    // channels reordering case, must be removed after channels unification
                    if (!self.videoTracks.get(track.mid)) {
                        reject(new Error("Video track already removed from model"));
                        return;
                    }
                    self.currentTrack = track;
                    participantView.clearQualityState(track);
                    if (self.abr) {
                        self.abr.stop();
                        self.abr.clearQualityState();
                        self.abr.setTrack(remoteTrack);

                        if (track.quality.length > 0) {
                            participantView.addQuality(track, {quality:"Auto",available:true,layersInfo:{spatialLayers:[],temporalLayers:[]}}, async () => {
                                if (!self.abr) {
                                    return;
                                }
                                self.abr.start();
                                self.abr.setAuto();
                                participantView.pickQuality(track, "Auto");
                            })
                        }
                        if (displayOptions.autoAbr) {
                            self.abr.setAuto();
                            self.abr.start();
                            participantView.pickQuality(track, "Auto");
                        }
                    }
                    for (const qualityDescriptor of track.quality) {
                        if (self.abr) {
                            self.abr.addQuality(qualityDescriptor.quality);
                            self.abr.setQualityAvailable(qualityDescriptor.quality, qualityDescriptor.available);
                        }
                        if (displayOptions.quality) {
                            participantView.addQuality(track, qualityDescriptor, async () => {
                                if (self.abr) {
                                    self.abr.setManual();
                                    self.abr.setQuality(qualityDescriptor.quality);
                                }
                                return self.pickQuality(track, qualityDescriptor.quality);
                            });
                        }
                    }
                    resolve();
                }, (ex) => reject(ex));
            });
        },
        pickQuality: async function (track, qualityName) {
            if (this.remoteVideoTrack) {
                return this.remoteVideoTrack.setPreferredQuality(qualityName).then(() => participantView.pickQuality(track, qualityName));
            }
        },
        muteVideo: async function (track) {
            if (this.remoteVideoTrack) {
                return this.remoteVideoTrack.mute();
            } else {
                return new Promise((resolve, reject) => {
                    reject(new Error("Remote track not defined"));
                });
            }
        },
        unmuteVideo: async function (track) {
            if (this.remoteVideoTrack) {
                return this.remoteVideoTrack.unmute();
            } else {
                return new Promise((resolve, reject) => {
                    reject(new Error("Remote track not defined"));
                });
            }
        }
    };
    instance.setUserId(userId);
    instance.setNickname(nickname);
    if (abrFactory) {
        instance.abr = abrFactory.createAbrManager();
    }
    return instance;
}


const createDefaultMeetingController = function (room, meetingModel) {
    const constants = SFU.constants;
    room.on(constants.SFU_ROOM_EVENT.PARTICIPANT_LIST, async function (e) {
        for (const idName of e.participants) {
            meetingModel.addParticipant(idName.userId, idName.name);
        }
    }).on(constants.SFU_ROOM_EVENT.JOINED, async function (e) {
        meetingModel.addParticipant(e.userId, e.name);
    }).on(constants.SFU_ROOM_EVENT.LEFT, function (e) {
        meetingModel.removeParticipant(e.userId);
    }).on(constants.SFU_ROOM_EVENT.ADD_TRACKS, async function (e) {
        meetingModel.addTracks(e.info.userId, e.info.info);
    }).on(constants.SFU_ROOM_EVENT.REMOVE_TRACKS, async function (e) {
        meetingModel.removeTracks(e.info.userId, e.info.info);
    }).on(constants.SFU_ROOM_EVENT.TRACK_QUALITY_STATE, async function (e) {
        meetingModel.updateQualityInfo(e.info.userId, e.info.tracks);
    }).on(constants.SFU_ROOM_EVENT.ENDED, function (e) {
        meetingModel.end();
    });
    meetingModel.setMeetingName(room.id());


    const stop = function () {
        meetingModel.end();
    };

    return {
        stop: stop
    }
}

const remoteTrackProvider = function (room) {
    return {
        getVideoTrack: async function () {
            return await room.getRemoteTrack("VIDEO", false);
        },
        getAudioTrack: async function () {
            return await room.getRemoteTrack("AUDIO", true);
        }
    }
}
const initDefaultRemoteDisplay = function (room, div, displayOptions, abrOptions) {
    const participantFactory = createParticipantFactory(remoteTrackProvider(room), createOneToManyParticipantView, createOneToManyParticipantModel);
    return initRemoteDisplay(room, div, displayOptions, abrOptions, createDefaultMeetingController, createDefaultMeetingModel, createDefaultMeetingView, participantFactory)
}
/*
display options:
autoAbr     - choose abr by default
quality     - show quality buttons
showAudio   - show audio elements
 */
const initRemoteDisplay = function (room, div, displayOptions, abrOptions, meetingController, meetingModel, meetingView, participantFactory) {
    // Validate options first
    if (!div) {
        throw new Error("Main div to place all the media tag is not defined");
    }
    if (!room) {
        throw new Error("Room is not defined");
    }

    const dOptions = displayOptions || {quality: true, type: true, showAudio: false};
    let abrFactory;
    if (abrOptions) {
        abrFactory = abrManagerFactory(room, abrOptions);
    }
    participantFactory.abrFactory = abrFactory;
    participantFactory.displayOptions = dOptions;
    return meetingController(room, meetingModel(meetingView(div), participantFactory));
}

const resizeVideo = function (video, width, height) {
    // TODO: fix
    if (video) {
        return;
    }
    if (!video.parentNode) {
        return;
    }
    if (video instanceof HTMLCanvasElement) {
        video.videoWidth = video.width;
        video.videoHeight = video.height;
    }
    const display = video.parentNode;
    const parentSize = {
        w: display.parentNode.clientWidth,
        h: display.parentNode.clientHeight
    };
    let newSize;
    if (width && height) {
        newSize = downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = downScaleToFitSize(video.videoWidth, video.videoHeight, parentSize.w, parentSize.h);
    }
    display.style.width = newSize.w + "px";
    display.style.height = newSize.h + "px";

    //vertical align
    let margin = 0;
    if (parentSize.h - newSize.h > 1) {
        margin = Math.floor((parentSize.h - newSize.h) / 2);
    }
    display.style.margin = margin + "px auto";
    console.log("Resize from " + video.videoWidth + "x" + video.videoHeight + " to " + display.offsetWidth + "x" + display.offsetHeight);
}

const downScaleToFitSize = function (videoWidth, videoHeight, dstWidth, dstHeight) {
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

const createInfoDisplay = function (parent, text) {
    const div = document.createElement("div");
    if (text) {
        div.innerHTML = text;
    }
    div.setAttribute("style", "width:auto; height:30px;");
    div.setAttribute("class", "text-center");
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

const createContainer = function (parent) {
    const div = document.createElement("div");
    div.setAttribute("style", "width:auto; height:auto;");
    div.setAttribute("class", "text-center");
    if (parent) {
        parent.appendChild(div);
    }
    return div;
}

// Helper functions to display/hide an element
const showItem = function (tag) {
    if (tag) {
        tag.style.display = "block";
    }
}

const hideItem = function (tag) {
    if (tag) {
        tag.style.display = "none";
    }
}
