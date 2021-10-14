const createControls = function(config) {

    let trackCallback = function(){};

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
            resolutionScale: document.getElementById("addVideoTrackEncodingResolutionScale")
        },
        tables: {
            video: $('#videoTracksTable').DataTable({
                "sDom": 't',
                "columns": [
                    {
                        "className":      'details-control',
                        "orderable":      false,
                        "data":           null,
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

    const addAudioTrackRow = function(track) {
        getMedia([track]).then(function(stream){
            let button = '<button id="' + stream.id + '-button" class="btn btn-primary">Delete</button>';
            const row = controls.tables.audio.row.add({
                source: track.source,
                channels: track.channels,
                action: button,
                stream: stream
            }).node();
            controls.tables.audio.draw();

            $('#' + stream.id + "-button").on('click', function(){
                //terminate stream
                console.log("terminate stream " + stream.id);
                let track = stream.getAudioTracks()[0];
                track.stop();
                track.dispatchEvent(new Event("ended"));
            });
            stream.getTracks()[0].onended = function() {
                controls.tables.audio.row(row).remove().draw();
            }
            trackCallback({
                stream: stream,
                encodings: track.encodings
            });
        });
    }

    const addVideoTrackRow = function(track) {
        getMedia([track]).then(function(stream){
            let button = '<button id="' + stream.id + '-button" class="btn btn-primary">Delete</button>';
            const row = controls.tables.video.row.add({
                source: track.source,
                width: track.width,
                height: track.height,
                codec: track.codec,
                action: button,
                stream: stream,
                encodings: track.encodings
            }).node();
            controls.tables.video.draw();

            $('#' + stream.id + "-button").on('click', function(){
                //terminate stream
                console.log("terminate stream " + stream.id);
                let track = stream.getVideoTracks()[0];
                track.stop();
                track.dispatchEvent(new Event("ended"));
            });
            stream.getTracks()[0].addEventListener("ended", function() {
                controls.tables.video.row(row).remove().draw();
            });
            trackCallback({
                stream: stream,
                encodings: track.encodings
            });
        });
    }

    const format = function(d) {
        if (!d.encodings) {
            return;
        }
        let details =  '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">';
        d.encodings.forEach(function(encoding){
            details += '<tr>';
            for (const [key, value] of Object.entries(encoding)) {
                details += '<td>'+ key + '</td>'+
                    '<td>'+ value + '</td>';
            }
            details += '</tr>';
        });
        details +='</table>';
        return details;
    }

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

    config.media.audio.tracks.forEach(function(track){
        addAudioTrackRow(track);
    })
    config.media.video.tracks.forEach(function(track){
        addVideoTrackRow(track);
    })

    const muteForm = function(form) {
        for (const [key, value] of Object.entries(form)) {
            value.disabled = true;
        }
    }

    const unmuteForm = function(form) {
        for (const [key, value] of Object.entries(form)) {
            value.disabled = false;
        }
    }

    const muteInput = function() {
        muteForm(controls.entrance);
    }

    const roomConfig = function() {
        return {
            url: controls.entrance.url.value,
            roomName: controls.entrance.roomName.value,
            pin: controls.entrance.roomPin.value,
            nickname: controls.entrance.nickName.value
        }
    }

    const getVideoStreams = function() {
        let streams = [];
        controls.tables.video.rows().every(function(rowIdx, tableLoop, rowLoop) {
            let data = this.data();
            streams.push({
                stream: data.stream,
                encodings: data.encodings
            });
        });
        return streams;
    }
    const getAudioStreams = function() {
        let streams = [];
        controls.tables.audio.rows().every(function(rowIdx, tableLoop, rowLoop) {
            let data = this.data();
            streams.push({
                stream: data.stream,
                encodings: []
            });
        });
        return streams;
    }

    document.getElementById("addVideoTrack").addEventListener("click", function(e){
        let encodings = [];
        controls.tables.encodings.rows().every(function() {
            let encoding = this.data();
            encodings.push({
                rid: encoding.rid,
                active: encoding.active,
                maxBitrate: encoding.maxBitrate,
                scaleResolutionDownBy: encoding.resolutionScale
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

    $("#videoTrackEncodingsTable").on("click", ".remove", function(){
        controls.tables.encodings.row($(this).parents('tr')).remove().draw();
    });

    document.getElementById("addVideoTrackEncoding").addEventListener("click", function(){
        let button = '<button class="btn btn-primary remove">Delete</button>';
        controls.tables.encodings.row.add({
            rid: controls.addVideoEncoding.rid.value,
            active: controls.addVideoEncoding.active.value,
            maxBitrate: controls.addVideoEncoding.maxBitrate.value,
            resolutionScale: controls.addVideoEncoding.resolutionScale.value,
            action: button
        }).draw();
    });

    document.getElementById("addAudioTrack").addEventListener("click", function(e){
        let encodings = [];
        let track = {
            source: controls.addAudioTrack.source.value,
            channels: controls.addAudioTrack.channels.value,
            encodings: encodings
        }
        addAudioTrackRow(track);
    });

    const onTrack = function(callback) {
        trackCallback = callback;
    }


    return {
        muteInput: muteInput,
        roomConfig: roomConfig,
        getAudioStreams: getAudioStreams,
        getVideoStreams: getVideoStreams,
        onTrack: onTrack
    }
}

const getMedia = async function(tracks) {
    //convert to constraints
    let screen = false;
    const constraints= {};
    tracks.forEach(function(track){
        if (track.source === "mic") {
            //audio
            constraints.audio = {};
            constraints.audio.stereo = track.channels !== 1
        } else if (track.source === "camera") {
            constraints.video = {
                width: track.width,
                height: track.height
            };
        } else if (track.source === "screen") {
            constraints.video = {
                width: track.width,
                height: track.height
            };
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