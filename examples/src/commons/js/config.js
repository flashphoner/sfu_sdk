const getRoomConfig = function(config) {
    let roomConfig = {
        url: config.url || "ws://127.0.0.1:8080",
        roomName: config.name || "ROOM1",
        pin: config.pin || "1234",
        nickname: config.nickName || "User1"        
    };
    return roomConfig;
}

const getVideoStreams = async function(config) {
    let streams = [];
    if (config.media && config.media.video && config.media.video.tracks) {
        streams = await getStreams(config.media.video.tracks);
    }
    return streams;
}

const getAudioStreams = async function(config) {
    let streams = [];
    if (config.media && config.media.audio && config.media.audio.tracks) {
        streams = await getStreams(config.media.audio.tracks);
    }
    return streams;
}

const getStreams = async function(tracks) {
    let streams = [];
    for (let track of tracks) {
        let stream = await getMedia(track);
        if (stream) {
            streams.push({
                stream: stream,
                encodings: track.encodings,
                source: track.source,
                type: track.type
            });
        }
    }
    return streams;
}

const getMedia = async function(track) {
    //convert to constraints
    let screen = false;
    const constraints= {};
    if (track.source === "mic") {
        //audio
        constraints.audio = {};
        if (track.constraints) {
            constraints.audio = track.constraints;
        }
        if (track.channels && track.channels === 2) {
            constraints.audio.echoCancellation = false;
            constraints.audio.googEchoCancellation = false;
        }
    } else if (track.source === "camera") {
        constraints.video = {};
        if (track.constraints) {
            constraints.video = track.constraints;
        }
        constraints.video.width = track.width;
        constraints.video.height = track.height;
    } else if (track.source === "screen") {
        constraints.video = {};
        if (track.constraints) {
            constraints.video = track.constraints;
        }
        constraints.video.width = track.width;
        constraints.video.height = track.height;
        screen = true;
    }

    //get access to a/v
    let stream;
    if (screen) {
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } else {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    }
    return stream;
}