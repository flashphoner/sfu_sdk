var constants = SFU.constants;

(async function () {
    const defaultConfig = {
        room: {url: "ws://127.0.0.1:8080", name: "ROOM1", pin: "1234", nickName: "User1"},
        initPoolParticipantsCount: 10,
        idleTransceiverTimeoutMs: 60000
    };
    const field = (id) => document.getElementById(id);
    try {
        field("url").value = SfuExample.serverUrl();
        field("roomName").value = "ROOM1-" + createUUID(4);
        field("playName").value = "Player1-" + createUUID(4);
        const config = await SfuExampleSession.loadConfig(defaultConfig);
        const player = new SfuExampleSession({
            prefix: "play",
            label: "Play",
            fields: ["url", "roomName", "playName"],
            unlockAudio: true,
            roomConfig: () => Object.assign(getRoomConfig(config), {
                url: field("url").value.trim(),
                roomName: field("roomName").value.trim(),
                nickname: field("playName").value.trim()
            }),
            join: async (attempt) => {
                attempt.display = initDefaultRemoteDisplay(attempt.room, field("remoteVideo"), {quality: true});
                await attempt.room.join(attempt.pc, null, null, config.initPoolParticipantsCount, config.idleTransceiverTimeoutMs);
            },
            onChange: () => { field("playPlaceholder").hidden = field("playBtn").textContent === "Stop"; }
        });
        field("playBtn").disabled = false;
        player.status("Ready");
        window.addEventListener("pagehide", () => player.stop());
    } catch (error) {
        SfuExample.status("playErrorInfo", error.message || String(error), "error");
    }
}());
