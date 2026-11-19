const createControls = function (config) {

    let trackCallback = function () {};
    let captureGeneration = 0;
    let handlersBound = false;
    const stopStream = function (stream) { stream.getTracks().forEach(track => track.stop()); };
    const currentCapture = function (generation, stream) {
        if (generation !== captureGeneration) {
            stopStream(stream);
            return false;
        }
        return true;
    };

    const controls = {
        entrance: {
            url: document.getElementById("url"),
            roomName: document.getElementById("roomName"),
            roomPin: document.getElementById("roomPin"),
            nickName: document.getElementById("nickName"),
            turnServer: document.getElementById("turnServer"),
            forceRelay: document.getElementById("forceRelay"),
            enter: document.getElementById("startButton"),
            transport: document.getElementById("transport"),
            participantViewType: document.getElementById("participantViewType"),
        },
        addVideoTrack: {
            source: document.getElementById("addVideoTrackSource"),
            width: document.getElementById("addVideoTrackWidth"),
            height: document.getElementById("addVideoTrackHeight"),
            codec: document.getElementById("addVideoTrackCodec")
        },
        addAudioTrack: {
            source: document.getElementById("addAudioTrackSource"),
            channels: document.getElementById("addAudioTrackChannels")
        },
        addVideoEncoding: {
            rid: document.getElementById("addVideoTrackEncodingRid"),
            active: document.getElementById("addVideoTrackEncodingActive"),
            maxBitrate: document.getElementById("addVideoTrackEncodingMaxBitrate"),
            resolutionScale: document.getElementById("addVideoTrackEncodingResolutionScale"),
            scalabilityMode: document.getElementById("addVideoTrackScalabilityMode")
        },
        tables: {
            video: $('#videoTracksTable').DataTable({
                "sDom": 't',
                "order": [],
                "columns": [
                    {
                        "className": 'details-control',
                        "orderable": false,
                        "data": null,
                        "defaultContent": '<button class="track-details" type="button" aria-label="Show video encodings" aria-expanded="false">+</button>'
                    },
                    {"data": "source", "render": $.fn.dataTable.render.text()},
                    {"data": "width", "render": $.fn.dataTable.render.text()},
                    {"data": "height", "render": $.fn.dataTable.render.text()},
                    {"data": "codec", "render": $.fn.dataTable.render.text()},
                    {"data": "action", "orderable": false}
                ]
            }),
            audio: $('#audioTracksTable').DataTable({
                "sDom": 't',
                "order": [],
                "columns": [
                    {"data": "source", "render": $.fn.dataTable.render.text()},
                    {"data": "channels", "render": $.fn.dataTable.render.text()},
                    {"data": "action", "orderable": false}
                ]
            }),
            encodings: $('#videoTrackEncodingsTable').DataTable({
                "sDom": 't',
                "order": [],
                "columns": [
                    {"data": "rid", "render": $.fn.dataTable.render.text()},
                    {"data": "active", "render": $.fn.dataTable.render.text()},
                    {"data": "maxBitrate", "render": $.fn.dataTable.render.text()},
                    {"data": "resolutionScale", "render": $.fn.dataTable.render.text()},
                    {"data": "scalabilityMode", "render": $.fn.dataTable.render.text()},
                    {"data": "action", "orderable": false}
                ]
            })
        }
    }

    controls.entrance.url.value = window.WCS_SERVER_URL ? SfuExample.serverUrl() :
        ((config.room.url && config.room.url.indexOf("127.0.0.1") === -1) ? config.room.url : SfuExample.serverUrl());
    controls.entrance.roomName.value = config.room.name;
    controls.entrance.roomPin.value = config.room.pin;
    controls.entrance.nickName.value = config.room.nickName;
    controls.entrance.turnServer.value = config.room.turnServer || "";
    controls.entrance.forceRelay.checked = Boolean(config.room.forceRelay);

    const addAudioTrackRow = async function (track, generation = captureGeneration) {
        const stream = await getMedia([track]);
        if (!currentCapture(generation, stream)) return;
        let button = '<button id="' + stream.id + '-button" class="btn btn-primary">Delete</button>';
        const row = controls.tables.audio.row.add({
            source: track.source,
            channels: track.channels,
            action: button,
            stream: stream
        }).node();
        controls.tables.audio.draw();

        $('#' + stream.id + "-button").on('click', function () {
            //terminate stream
            console.log("terminate audio stream " + stream.id);
            let track = stream.getAudioTracks()[0];
            track.stop();
            track.dispatchEvent(new Event("ended"));
        }).prop('disabled', true);
        stream.getTracks()[0].onended = function () {
            controls.tables.audio.row(row).remove().draw();
        }
        trackCallback({
            stream: stream,
            encodings: track.encodings,
            source: track.source,
            type: track.type
        });
    }

    const addVideoTrackRow = async function (track, generation = captureGeneration) {
        const stream = await getMedia([track]);
        if (!currentCapture(generation, stream)) return;
        let button = '<button id="' + stream.id + '-button" class="btn btn-primary">Delete</button>';
        const row = controls.tables.video.row.add({
            source: track.source,
            width: track.width,
            height: track.height,
            codec: track.codec,
            action: button,
            stream: stream,
            encodings: track.encodings,
        }).node();
        controls.tables.video.draw();

        $('#' + stream.id + "-button").on('click', function () {
            //terminate stream
            console.log("terminate video stream " + stream.id);
            let track = stream.getVideoTracks()[0];
            track.stop();
            track.dispatchEvent(new Event("ended"));
        }).prop('disabled', true);
        stream.getTracks()[0].addEventListener("ended", function () {
            controls.tables.video.row(row).remove().draw();
        });
        trackCallback({
            stream: stream,
            encodings: track.encodings,
            source: track.source
        });
    }

    const format = function (data) {
        const table = document.createElement("table");
        for (const encoding of data.encodings || []) {
            const row = table.insertRow();
            for (const [key, value] of Object.entries(encoding)) {
                row.insertCell().textContent = key;
                row.insertCell().textContent = String(value);
            }
        }
        return table;
    };

    const muteForm = function (form) {
        for (const [key, value] of Object.entries(form)) {
            value.disabled = true;
        }
    }

    const unmuteForm = function (form) {
        for (const [key, value] of Object.entries(form)) {
            value.disabled = false;
        }
    }

    const muteInput = function () {
        muteForm(controls.entrance);
    }

    const roomConfig = function () {
        let roomConfig = {
            url: controls.entrance.url.value,
            roomName: controls.entrance.roomName.value,
            pin: controls.entrance.roomPin.value,
            nickname: controls.entrance.nickName.value,
            turnServer: controls.entrance.turnServer.value.trim(),
            forceRelay: controls.entrance.forceRelay.checked,
            transport: controls.entrance.transport.value,
            participantViewType: controls.entrance.participantViewType.value,
        };
        if (config.room.failedProbesThreshold !== undefined) {
            roomConfig.failedProbesThreshold = config.room.failedProbesThreshold;
        }
        if (config.room.pingInterval !== undefined) {
            roomConfig.pingInterval = config.room.pingInterval;
        }
        return roomConfig;
    }

    let initPoolParticipantsCount = function () {
        return config.initPoolParticipantsCount;
    }

    let idleTransceiverTimeoutMs = function () {
        return config.idleTransceiverTimeoutMs;
    }

    const getVideoStreams = function () {
        let streams = [];
        controls.tables.video.rows().every(function (rowIdx, tableLoop, rowLoop) {
            let data = this.data();
            streams.push({
                stream: data.stream,
                encodings: data.encodings,
                source: data.source,
                type: data.type
            });
        });
        return streams;
    }
    const getAudioStreams = function () {
        let streams = [];
        controls.tables.audio.rows().every(function (rowIdx, tableLoop, rowLoop) {
            let data = this.data();
            streams.push({
                stream: data.stream,
                encodings: [],
                source: data.source
            });
        });
        return streams;
    }

    const onTrack = function (callback) {
        trackCallback = callback;
    }

    const displayTables = async function () {
        const generation = ++captureGeneration;
        const addConfiguredTracks = async function () {
            for (const track of config.media.audio.tracks) {
                if (generation !== captureGeneration) return;
                await addAudioTrackRow(track, generation);
            }
            for (const track of config.media.video.tracks) {
                if (generation !== captureGeneration) return;
                await addVideoTrackRow(track, generation);
            }
        };
        if (handlersBound) {
            await addConfiguredTracks();
            return;
        }
        handlersBound = true;
        // Add event listener for opening and closing details
        $('#videoTracksTableBody').on('click', 'td.details-control', function () {
            let tr = $(this).closest('tr');
            let row = controls.tables.video.row(tr);
            if (row.child.isShown()) {
                // This row is already open - close it
                row.child.hide();
                tr.removeClass('shown');
                tr.find('.track-details').text('+').attr('aria-expanded', 'false');
            } else {
                // Open this row
                row.child(format(row.data())).show();
                tr.addClass('shown');
                tr.find('.track-details').text('−').attr('aria-expanded', 'true');
            }
        });

        // Click event listener to add a new video track
        document.getElementById("addVideoTrack").addEventListener("click", function (e) {
            let encodings = [];
            controls.tables.encodings.rows().every(function () {
                let encoding = this.data();
                encodings.push({
                    rid: encoding.rid,
                    active: encoding.active === true || encoding.active === "true",
                    maxBitrate: Number(encoding.maxBitrate),
                    scaleResolutionDownBy: Number(encoding.resolutionScale),
                    scalabilityMode: encoding.scalabilityMode
                })
            });
            let track = {
                source: controls.addVideoTrack.source.value,
                width: controls.addVideoTrack.width.value,
                height: controls.addVideoTrack.height.value,
                codec: controls.addVideoTrack.codec.value,
                encodings: encodings
            }
            const generation = captureGeneration;
            addVideoTrackRow(track, generation).catch(error => {
                if (generation === captureGeneration) displayError(formatError(error));
            });
        });

        // Click event listener to remove video quality
        $("#videoTrackEncodingsTable").on("click", ".remove", function () {
            controls.tables.encodings.row($(this).parents('tr')).remove().draw();
        });

        // Click event listener to add video quality
        document.getElementById("addVideoTrackEncoding").addEventListener("click", function () {
            let button = '<button class="btn btn-primary remove">Delete</button>';
            controls.tables.encodings.row.add({
                rid: controls.addVideoEncoding.rid.value,
                active: controls.addVideoEncoding.active.value,
                maxBitrate: controls.addVideoEncoding.maxBitrate.value,
                resolutionScale: controls.addVideoEncoding.resolutionScale.value,
                scalabilityMode: controls.addVideoEncoding.scalabilityMode.value,
                action: button
            }).draw();
        });

        // Click event listener to add a new audio track
        document.getElementById("addAudioTrack").addEventListener("click", function (e) {
            let encodings = [];
            let track = {
                source: controls.addAudioTrack.source.value,
                channels: Number(controls.addAudioTrack.channels.value),
                encodings: encodings
            }
            const generation = captureGeneration;
            addAudioTrackRow(track, generation).catch(error => {
                if (generation === captureGeneration) displayError(formatError(error));
            });
        });

        await addConfiguredTracks();
    }

    const cleanTables = function () {
        captureGeneration++;
        for (const media of [...getVideoStreams(), ...getAudioStreams()]) stopStream(media.stream);
        controls.tables.video.rows().remove().draw();
        controls.tables.audio.rows().remove().draw();
        controls.tables.encodings.rows().remove().draw();
    }

    return {
        muteInput: muteInput,
        unmuteInput: function () { unmuteForm(controls.entrance); },
        roomConfig: roomConfig,
        displayTables: displayTables,
        getAudioStreams: getAudioStreams,
        getVideoStreams: getVideoStreams,
        onTrack: onTrack,
        cleanTables: cleanTables,
        initPoolParticipantsCount: initPoolParticipantsCount,
        idleTransceiverTimeoutMs: idleTransceiverTimeoutMs,
        controls: controls
    }
}

const getMedia = async function (tracks) {
    //convert to constraints
    let screen = false;
    const constraints = {};
    tracks.forEach(function (track) {
        if (track.source === "mic") {
            //audio
            constraints.audio = {};
            if (track.constraints) {
                constraints.audio = track.constraints;
            }
            constraints.audio.stereo = track.channels !== 1
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
    });

    //get access to a/v
    let stream;
    if (screen) {
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } else {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    }
    return stream;
}