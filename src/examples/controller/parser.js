const statsToGraph = function(stats) {
    let g = {
        nodes: [],
        edges: []
    }

    const wcsId = "WCS";
    const edgeType = 'curvedArrow';
    let eIndex = 0;
    const fromServerColour = '#00ff40';
    const fromParticipantColour = '#3a8dc6';
    const deadTrackColour = '#ff2800';
    const nodeSize = 5;
    const edgeSize = 2;

    g.nodes.push({
        id: wcsId,
        label: wcsId,
        // Display attributes:
        x: 0,
        y: 0,
        size: nodeSize,
        color: fromServerColour
    });

    const calcPoints = function(radius, qty) {
        const ret = [];
        const stepRad = 360/qty * Math.PI / 180;
        for (let i = 0; i < qty; i++) {
            let angle = i * stepRad;
            let x = Math.cos(angle) * radius;
            let y = Math.sin(angle) * radius;
            ret.push({
                x: x,
                y: y
            });
        }
        return ret;
    }

    const points = calcPoints(800, stats.participants.length);
    stats.participants.forEach(function(participant){
        let count = 0;
        let point = points.pop();
        g.nodes.push({
            id: participant.nickName,
            label: participant.nickName,
            // Display attributes:
            x: point.x,
            y: point.y,
            size: nodeSize,
            color: fromParticipantColour
        });
        participant.outgoingTracks.forEach(function(track){
            if (track.composite) {
                for (const [key, value] of Object.entries(track.tracks)) {
                    g.edges.push({
                        id: 'e' + eIndex,
                        // Reference extremities:
                        source: participant.nickName,
                        target: wcsId,
                        label: value.id + "-" + key,
                        count: count++,
                        size: edgeSize,
                        type: edgeType,
                        color: value.alive ? fromParticipantColour : deadTrackColour
                    });
                    eIndex++;
                }
            } else {
                g.edges.push({
                    id: 'e' + eIndex,
                    // Reference extremities:
                    source: participant.nickName,
                    target: wcsId,
                    label: track.id,
                    count: count++,
                    size: edgeSize,
                    type: edgeType,
                    color: track.alive ? fromParticipantColour : deadTrackColour
                });
                eIndex++;
            }
        });
        for (const [key, value] of Object.entries(participant.incomingTracks)) {
            g.edges.push({
                id: 'e' + eIndex,
                // Reference extremities:
                source: wcsId,
                target: participant.nickName,
                label: value ? key + "-" + value : key,
                count: count++,
                size: edgeSize,
                type: edgeType,
                color: fromServerColour
            });
            eIndex++;
        }
    });
    return g;
}

const statsToTable = function(stats) {
    const NA = "NA";
    const tKey = function(str1, str2) {
        if (str1 && str2) {
            return str1.replaceAll(" ", "") + str2.replaceAll(" ", "");
        }
        return str1;
    }
    const trackToTable = function(track, nickName, quality) {
        return {
            metric: "track",
            type: track.type,
            participant: nickName,
            id: track.id,
            quality: quality,
            details: track
        }
    }
    const metricToTable = function(name, value, nickName) {
        return {
            metric: name,
            type: value,
            participant: nickName,
            id: NA,
            quality: NA,
            details: {}
        }
    }

    const metrics = {};
    metrics.WCS = [];
    let bitrate_in = 0;
    let tracks_in = 0;

    const src = {};
    stats.participants.forEach(function(participant){
        participant.outgoingTracks.forEach(function(track){
            if (track.composite) {
                for (const [key, value] of Object.entries(track.tracks)) {
                    src[tKey(value.id, key)] = value;
                    value.nickName = participant.nickName;
                    bitrate_in += value.bitrate;
                    tracks_in++;
                }
            } else {
                src[tKey(track.id)] = track;
                track.nickName = participant.nickName;
                bitrate_in += track.bitrate;
                tracks_in++;
            }
        });
    });
    let bitrate_out = 0;
    let tracks_out = 0;
    stats.participants.forEach(function(participant){
        for (const [key, value] of Object.entries(participant.incomingTracks)) {
            const srcTrack = src[tKey(key, value)];
            bitrate_out += srcTrack.bitrate;
            tracks_out++;
        }
    });
    metrics.WCS.push(metricToTable("participants", stats.participants.length, NA));
    metrics.WCS.push(metricToTable("bitrate_in", bitrate_in, NA));
    metrics.WCS.push(metricToTable("bitrate_out", bitrate_out, NA));
    metrics.WCS.push(metricToTable("tracks_in", tracks_in, NA));
    metrics.WCS.push(metricToTable("tracks_out", tracks_out, NA));
    stats.participants.forEach(function(participant){
        const pStats = [];
        let tracksIn = 0;
        let tracksOut = 0;
        let bitrateIn = 0;
        let bitrateOut = 0;
        participant.outgoingTracks.forEach(function(track){
            if (track.composite) {
                for (const [key, value] of Object.entries(track.tracks)) {
                    pStats.push(trackToTable(value, participant.nickName, key));
                    tracksOut++;
                    bitrateOut += value.bitrate;
                }
            } else {
                pStats.push(trackToTable(track, participant.nickName, "NA"));
                tracksOut++;
                bitrateOut += track.bitrate;
            }
        });
        for (const [key, value] of Object.entries(participant.incomingTracks)) {
            const srcTrack = src[tKey(key, value)];
            pStats.push(trackToTable(srcTrack, srcTrack.nickName, value));
            tracksIn++;
            bitrateIn += srcTrack.bitrate;
        }
        pStats.push(metricToTable("tracks_in", tracksIn, participant.nickName));
        pStats.push(metricToTable("bitrate_in", bitrateIn, participant.nickName));
        pStats.push(metricToTable("tracks_out", tracksOut, participant.nickName));
        pStats.push(metricToTable("bitrate_out", bitrateOut, participant.nickName));
        metrics[participant.nickName] = pStats;
    });

    return metrics;
}