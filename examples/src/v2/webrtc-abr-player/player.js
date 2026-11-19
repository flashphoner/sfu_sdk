var constants = SFU.constants;

(function () {
    const field = (id) => document.getElementById(id);
    try {
        field("url").value = SfuExample.serverUrl();
        const player = new SfuExampleSession({
            prefix: "play",
            label: "Play",
            fields: ["url", "streamName"],
            unlockAudio: true,
            endedMessage: "ABR stream is stopped.",
            roomConfig: () => ({
                url: field("url").value.trim(),
                roomName: field("streamName").value.trim(),
                nickname: "Player-" + field("streamName").value.trim() + "-" + createUUID(4),
                pin: 123456
            }),
            join: async (attempt) => {
                attempt.listen(attempt.room, constants.SFU_ROOM_EVENT.PARTICIPANT_LIST, (event) => {
                    if (!event.participants || !event.participants.length) player.fail(attempt, "ABR stream is not published.");
                });
                const abrOptions = {
                    thresholds: [
                        {parameter: "nackCount", maxLeap: 10},
                        {parameter: "freezeCount", maxLeap: 10},
                        {parameter: "packetsLost", maxLeap: 10}
                    ],
                    abrKeepOnGoodQuality: ABR_KEEP_ON_QUALITY,
                    abrTryForUpperQuality: ABR_TRY_UPPER_QUALITY,
                    interval: ABR_QUALITY_CHECK_PERIOD
                };
                attempt.display = initRemoteDisplay(attempt.room, field("remoteVideo"),
                    {quality: true, autoAbr: true}, abrOptions,
                    createDefaultMeetingController, createDefaultMeetingModel, createDefaultMeetingView,
                    oneToOneParticipantFactory(remoteTrackProvider(attempt.room)));
                await attempt.room.join(attempt.pc, null, null, 1);
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
