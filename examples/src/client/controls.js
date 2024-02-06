const createControls = function (config) {

    let trackCallback = function () {
    };

    const controls = {
        entrance: {
            url: document.getElementById("url"),
            roomName: document.getElementById("roomName"),
            roomPin: document.getElementById("roomPin"),
            nickName: document.getElementById("nickName"),
            enter: document.getElementById("startButton")
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
                "columns": [
                    {
                        "className": 'details-control',
                        "orderable": false,
                        "data": null,
                        "defaultContent": ''
                    },
                    {"data": "source"},
                    {"data": "width"},
                    {"data": "height"},
                    {"data": "codec"},
                    {"data": "action"}
                ]
            }),
            audio: $('#audioTracksTable').DataTable({
                "sDom": 't',
                "columns": [
                    {"data": "source"},
                    {"data": "channels"},
                    {"data": "action"}
                ]
            }),
            encodings: $('#videoTrackEncodingsTable').DataTable({
                "sDom": 't',
                "columns": [
                    {"data": "rid"},
                    {"data": "active"},
                    {"data": "maxBitrate"},
                    {"data": "resolutionScale"},
                    {"data": "scalabilityMode"},
                    {"data": "action"}
                ]
            })
        }
    }

    //apply room config
    controls.entrance.url.value = config.room.url;
    controls.entrance.roomName.value = config.room.name;
    controls.entrance.roomPin.value = config.room.pin;
    controls.entrance.nickName.value = config.room.nickName;

    const addAudioTrackRow = async function (track) {
        const stream = await getMedia([track]);
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

    const addVideoTrackRow = async function (track) {
        const stream = await getMedia([track]);
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

    const format = function (d) {
        if (!d.encodings) {
            return;
        }
        let details = '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">';
        d.encodings.forEach(function (encoding) {
            details += '<tr>';
            for (const [key, value] of Object.entries(encoding)) {
                details += '<td>' + key + '</td>' +
                    '<td>' + value + '</td>';
            }
            details += '</tr>';
        });
        details += '</table>';
        return details;
    }

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
            nickname: controls.entrance.nickName.value
        };
        if (config.room.failedProbesThreshold !== undefined) {
            roomConfig.failedProbesThreshold = config.room.failedProbesThreshold;
        }
        if (config.room.pingInterval !== undefined) {
            roomConfig.pingInterval = config.room.pingInterval;
        }
        return roomConfig;
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
        // Add event listener for opening and closing details
        $('#videoTracksTableBody').on('click', 'td.details-control', function () {
            let tr = $(this).closest('tr');
            let row = controls.tables.video.row(tr);
            if (row.child.isShown()) {
                // This row is already open - close it
                row.child.hide();
                tr.removeClass('shown');
            } else {
                // Open this row
                row.child(format(row.data())).show();
                tr.addClass('shown');
            }
        });

        // Add preconfigured audio and video tracks
        for (const track of config.media.audio.tracks) {
            await addAudioTrackRow(track);
        }
        for (const track of config.media.video.tracks) {
            await addVideoTrackRow(track);
        }

        // Click event listener to add a new video track
        document.getElementById("addVideoTrack").addEventListener("click", function (e) {
            let encodings = [];
            controls.tables.encodings.rows().every(function () {
                let encoding = this.data();
                encodings.push({
                    rid: encoding.rid,
                    active: encoding.active,
                    maxBitrate: encoding.maxBitrate,
                    scaleResolutionDownBy: encoding.resolutionScale,
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
            addVideoTrackRow(track);
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
                channels: controls.addAudioTrack.channels.value,
                encodings: encodings
            }
            addAudioTrackRow(track);
        });

    }

    const cleanTables = function () {
        controls.tables.video.rows().remove().draw();
        controls.tables.audio.rows().remove().draw();
        controls.tables.encodings.rows().remove().draw();
    }

    return {
        muteInput: muteInput,
        roomConfig: roomConfig,
        displayTables: displayTables,
        getAudioStreams: getAudioStreams,
        getVideoStreams: getVideoStreams,
        onTrack: onTrack,
        cleanTables: cleanTables,
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