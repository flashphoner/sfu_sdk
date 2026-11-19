var constants = SFU.constants;

(async function () {
    const field = (id) => document.getElementById(id);
    const defaultConfig = {
        room: {url: "wss://127.0.0.1:8888", name: "ROOM1", pin: "1234", nickName: "User1", failedProbesThreshold: 5, pingInterval: 5000},
        media: {
            audio: {tracks: [{source: "mic", channels: 1}]},
            video: {tracks: [{source: "camera", width: 1280, height: 720, codec: "H264", constraints: {frameRate: 25}, encodings: [
                {rid: "180p", active: true, maxBitrate: 200000, scaleResolutionDownBy: 4},
                {rid: "360p", active: true, maxBitrate: 500000, scaleResolutionDownBy: 2},
                {rid: "720p", active: true, maxBitrate: 900000}
            ], type: "cam1"}]}
        }
    };
    const sessions = {};
    const refresh = () => {
        const active = Object.values(sessions).some((session) => session.active());
        field("url").disabled = active;
        field("roomName").disabled = active;
        for (const prefix of ["publish", "play"]) {
            field(prefix + "Placeholder").hidden = field(prefix + "Btn").textContent === "Stop";
        }
    };
    try {
        field("url").value = SfuExample.serverUrl();
        field("roomName").value = "ROOM1-" + createUUID(4);
        field("publishName").value = "Publisher1-" + createUUID(4);
        field("playName").value = "Player1-" + createUUID(4);
        const config = await SfuExampleSession.loadConfig(defaultConfig);
        for (const prefix of ["publish", "play"]) {
            sessions[prefix] = new SfuExampleSession({
                prefix,
                label: prefix === "publish" ? "Publish" : "Play",
                fields: [prefix + "Name"],
                sharedFields: ["url", "roomName"],
                unlockAudio: prefix === "play",
                validate: () => {
                    const other = sessions[prefix === "play" ? "publish" : "play"];
                    const sameName = field("publishName").value.trim() === field("playName").value.trim();
                    if (other && other.active() && sameName) {
                        sessions[prefix].error("Cannot connect with the same name.");
                        return false;
                    }
                    return true;
                },
                roomConfig: () => Object.assign(getRoomConfig(config), {
                    url: field("url").value.trim(),
                    roomName: field("roomName").value.trim(),
                    nickname: field(prefix + "Name").value.trim()
                }),
                join: async (attempt) => {
                    if (prefix === "play") {
                        attempt.display = initDefaultRemoteDisplay(attempt.room, field("remoteVideo"));
                        await attempt.room.join(attempt.pc, null, null, 1);
                        return;
                    }
                    attempt.display = initLocalDisplay(field("localVideo"));
                    const tracks = [
                        ...((config.media && config.media.video && config.media.video.tracks) || []),
                        ...((config.media && config.media.audio && config.media.audio.tracks) || [])
                    ];
                    const contentTypes = {};
                    for (const trackConfig of tracks) {
                        const stream = await getMedia(JSON.parse(JSON.stringify(trackConfig)));
                        if (!attempt.keepStream(stream)) return;
                        const type = trackConfig.type || trackConfig.source;
                        attempt.display.add(stream.id, field("publishName").value, stream, type);
                        for (const track of stream.getTracks()) {
                            contentTypes[track.id] = type;
                            attempt.pc.addTransceiver(track, {direction: "sendonly", streams: [stream], sendEncodings: trackConfig.encodings || []});
                            track.addEventListener("ended", async () => {
                                if (!attempt.isCurrent()) return;
                                const sender = attempt.pc.getSenders().find((sender) => sender.track === track);
                                if (!sender) return;
                                attempt.pc.removeTrack(sender);
                                try { await attempt.room.updateState(); }
                                catch (error) { sessions[prefix].fail(attempt, error); }
                            });
                        }
                    }
                    if (attempt.isCurrent()) await attempt.room.join(attempt.pc, null, contentTypes);
                },
                onChange: refresh
            });
            field(prefix + "Btn").disabled = false;
            sessions[prefix].status("Ready");
        }
        refresh();
        window.addEventListener("pagehide", () => Object.values(sessions).forEach((session) => session.stop()));
    } catch (error) {
        SfuExample.status("publishErrorInfo", error.message || String(error), "error");
    }
}());
