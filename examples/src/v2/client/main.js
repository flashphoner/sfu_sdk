const constants = SFU.constants;
const sfu = SFU;
const quality = window.ConnectionQualityBadge;
const CONNECTION_STATUS = quality.CONNECTION_STATUS;
let localDisplay;
let cControls;
let currentAttempt = null;
const isCurrent = function (attempt) { return currentAttempt === attempt; };

const setMediaControls = function (enabled) {
    document.querySelectorAll(".track-section input, .track-section select, .track-section button, #localMessage, #sendMessage")
        .forEach(element => { element.disabled = !enabled; });
};

const connectionStatus = function (text, kind) {
    SfuExample.status("connectionStatus", text, kind);
};

const cleanupAttempt = function (attempt) {
    if (attempt.cleaned) return;
    attempt.cleaned = true;
    if (attempt.chatCleanup) attempt.chatCleanup();
    if (attempt.trafficCleanup) attempt.trafficCleanup();
    if (attempt.remoteDisplay) attempt.remoteDisplay.stop();
    cControls.onTrack(function () {});
    cControls.cleanTables();
    if (localDisplay) {
        localDisplay.stop();
        localDisplay = null;
    }
    if (attempt.pc) attempt.pc.close();
    document.getElementById("localDisplay").replaceChildren();
    document.getElementById("display").replaceChildren();
    cControls.unmuteInput();
    setMediaControls(false);
    document.getElementById("disconnectButton").disabled = true;
    connectionStatus("DISCONNECTED");
    resetTrafficWidget();
};

const disconnect = async function () {
    const attempt = currentAttempt;
    if (!attempt) return;
    currentAttempt = null;
    cleanupAttempt(attempt);
    if (attempt.session) {
        try { await attempt.session.disconnect(); }
        catch (error) { if (!currentAttempt) displayError(formatError(error)); }
    }
};

const failAttempt = function (attempt, error) {
    if (!isCurrent(attempt)) return;
    displayError(formatError(error));
    disconnect();
};

const updateRouteIndicator = function (badges) {
    const routeMode = quality.resolveRouteMode(badges);
    const routeElement = document.getElementById("stat-route");
    if (routeElement) {
        routeElement.textContent = routeMode;
    }

    updateStatusCircle("route-status", routeMode !== "Unknown");

    const routeBadge = routeElement ? routeElement.parentElement : null;
    if (routeBadge) {
        routeBadge.classList.remove("bg-secondary", "bg-info", "bg-dark");
        if (routeMode === "Relay") {
            routeBadge.classList.add("bg-dark");
        } else if (routeMode === "Direct") {
            routeBadge.classList.add("bg-info");
        } else {
            routeBadge.classList.add("bg-secondary");
        }
    }
};

const renderConnectionBadges = function (model) {
    const topologyDiagram = document.getElementById("topology-diagram");
    if (!topologyDiagram) {
        return;
    }

    if (!model || !model.participants || model.participants.length === 0) {
        topologyDiagram.innerHTML = "<div class='text-muted'>No connection data</div>";
        return;
    }

    topologyDiagram.innerHTML = "";

    const chain = document.createElement("div");
    chain.className = "badge-chain";

    for (let i = 0; i < model.participants.length; i++) {
        const participant = model.participants[i];
        chain.appendChild(createNodeBadge(participant));

        if (i < model.participants.length - 1) {
            chain.appendChild(createLinkBadge(quality.findLinkBetweenParticipants(participant, model.participants[i + 1], model.links)));
        }
    }

    topologyDiagram.appendChild(chain);
};

const getParticipantEyebrow = function (participantType) {
    if (participantType === "turn") {
        return "Relay";
    }
    if (participantType === "remote") {
        return "Server";
    }
    return "Endpoint";
};

const createNodeBadge = function (participant) {
    const node = document.createElement("div");
    node.className = `badge-node badge-node-${participant.type}`;

    const circle = document.createElement("span");
    circle.className = `badge-status ${participant.status}`;
    circle.title = participant.status === 'green' ? 'Connected' : (participant.status === 'yellow' ? 'Connecting' : (participant.status === 'orange' ? 'Degraded' : 'Disconnected'));

    const labelRow = document.createElement("div");
    labelRow.className = "badge-node-label-row";

    const title = document.createElement("div");
    title.className = "badge-node-main";

    const eyebrow = document.createElement("span");
    eyebrow.className = "badge-node-eyebrow";
    eyebrow.textContent = getParticipantEyebrow(participant.type);

    const label = document.createElement("span");
    label.className = "badge-node-label";
    label.textContent = participant.label;

    const address = document.createElement("span");
    address.className = "badge-node-address";
    address.textContent = participant.address;

    title.appendChild(eyebrow);
    title.appendChild(label);
    title.appendChild(address);

    labelRow.appendChild(circle);
    labelRow.appendChild(title);
    node.appendChild(labelRow);

    if (!participant.showTraffic) {
        return node;
    }

    const speedContainer = document.createElement("div");
    speedContainer.className = "badge-node-speeds";

    const inboundValue = quality.formatSpeedValue(participant.inboundSpeed, participant.inboundPacketLossPercent);
    const outboundValue = quality.formatSpeedValue(participant.outboundSpeed, participant.outboundPacketLossPercent);

    const inbound = document.createElement("div");
    inbound.className = "badge-node-speed inbound";
    inbound.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 8L1 4h2V0h4v4h2L5 8z"/></svg><span>' + inboundValue + '</span>';

    const outbound = document.createElement("div");
    outbound.className = "badge-node-speed outbound";
    outbound.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 2L9 6H7v4H3V6H1L5 2z"/></svg><span>' + outboundValue + '</span>';

    speedContainer.appendChild(inbound);
    speedContainer.appendChild(outbound);
    node.appendChild(speedContainer);

    return node;
};

const createLinkBadge = function (link) {
    const linkNode = document.createElement("div");
    linkNode.className = "badge-link";

    const label = document.createElement("div");
    label.className = "badge-link-label";
    label.textContent = link.type === "relay" ? "Relay" : "Direct";

    const line = document.createElement("div");
    line.className = `badge-link-line ${link.status}`;

    linkNode.appendChild(label);
    linkNode.appendChild(line);
    return linkNode;
};

const parseIceServerEntry = function (value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    let urls = trimmedValue;
    if (!/^(stun|turn|turns):/i.test(urls)) {
        urls = "turn:" + urls;
    }

    const credentialMatch = urls.match(/^(stun|turn|turns):([^@]+)@(.+)$/i);
    if (!credentialMatch) {
        return {urls: urls};
    }

    const server = {
        urls: credentialMatch[1] + ":" + credentialMatch[3]
    };
    const authParts = credentialMatch[2].split(":");
    const username = authParts.shift() || "";
    const credential = authParts.join(":");

    if (username) {
        server.username = username;
    }
    if (credential) {
        server.credential = credential;
        server.credentialType = "password";
    }

    return server;
};

const buildRtcConfiguration = function (roomConfig) {
    const iceServers = (roomConfig.turnServer || "")
        .split(/[\n,]+/)
        .map(parseIceServerEntry)
        .filter(Boolean);
    const hasTurnServer = iceServers.some(function (server) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some(function (url) {
            return /^turns?:/i.test(url);
        });
    });

    if (iceServers.length === 0 && !roomConfig.forceRelay) {
        return undefined;
    }
    if (roomConfig.forceRelay && !hasTurnServer) {
        throw new Error("Force relay requires a TURN server. Fill TURN Server, for example turn:user:password@turn.example.com:3478?transport=udp.");
    }

    const rtcConfiguration = {
        iceServers: iceServers
    };

    if (roomConfig.forceRelay) {
        rtcConfiguration.iceTransportPolicy = "relay";
    }

    return rtcConfiguration;
};

const defaultConfig = {
    room: {
        url: "wss://127.0.0.1:8888",
        name: "ROOM1",
        pin: "1234",
        nickName: "Alice",
        turnServer: "",
        forceRelay: false
    },
    media: {
        audio: {
            tracks: [
                {
                    source: "mic",
                    channels: 1
                }
            ]
        },
        video: {
            tracks: [
                {
                    source: "camera",
                    width: 1280,
                    height: 720,
                    codec: "H264",
                    encodings: [
                        {rid: "m", active: true, maxBitrate: 300000, scaleResolutionDownBy: 2},
                        {rid: "h", active: true, maxBitrate: 900000}
                    ]
                }
            ]
        }
    },
    initPoolParticipantsCount: 10,
    idleTransceiverTimeoutMs: 60000
};

const scalabilityModes = [
    'L1T1',
    'L1T2',
    'L1T3',
    'L2T1',
    'L2T2',
    'L2T3',
    'L3T1',
    'L3T2',
    'L3T3',
    'L2T1h',
    'L2T2h',
    'L2T3h',
    'S2T1',
    'S2T2',
    'S2T3',
    'S2T1h',
    'S2T2h',
    'S2T3h',
    'S3T1',
    'S3T2',
    'S3T3',
    'S3T1h',
    'S3T2h',
    'S3T3h',
    'L2T2_KEY',
    'L2T3_KEY',
    'L3T2_KEY',
    'L3T3_KEY'
];

const init = async function () {
    setMediaControls(false);
    try {
        const transportSelect = document.getElementById("transport");
        for (const value of Object.values(constants.SFU_TRANSPORT_TYPE)) {
            transportSelect.add(new Option(value, value));
        }
        const viewSelect = document.getElementById("participantViewType");
        for (const value of Object.values(PARTICIPANT_VIEW_TYPE)) {
            viewSelect.add(new Option(value, value));
        }
        let config;
        try { config = await $.getJSON("config.json"); }
        catch (error) { config = defaultConfig; }
        cControls = createControls(config);
        cControls.controls.addVideoTrack.codec.addEventListener("change", updateScalabilityModes);
        document.getElementById("startButton").disabled = false;
    } catch (error) {
        displayError(formatError(error));
    }
};

async function connect() {
    if (!cControls || currentAttempt) return;
    if (!document.getElementById("connectionForm").reportValidity()) return;
    displayError("");
    cControls.muteInput();
    connectionStatus("CONNECTING");
    document.getElementById("disconnectButton").disabled = false;
    const attempt = {};
    currentAttempt = attempt;
    const roomConfig = cControls.roomConfig();
    try {
        const rtcConfiguration = buildRtcConfiguration(roomConfig);
        attempt.pc = new RTCPeerConnection(rtcConfiguration);
        const session = await sfu.createRoom(roomConfig);
        attempt.session = session;
        if (!isCurrent(attempt)) {
            await session.disconnect();
            return;
        }
        session.on(constants.SFU_EVENT.FAILED, error => failAttempt(attempt, error))
            .on(constants.SFU_EVENT.DISCONNECTED, function () {
                if (isCurrent(attempt)) {
                    currentAttempt = null;
                    cleanupAttempt(attempt);
                }
            });
        const room = session.room();
        attempt.room = room;
        room.on(constants.SFU_ROOM_EVENT.FAILED, error => failAttempt(attempt, error))
            .on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, error => {
                if (isCurrent(attempt)) displayError(formatError(error));
            }).on(constants.SFU_ROOM_EVENT.ENDED, () => failAttempt(attempt, "Room is ended"))
            .on(constants.SFU_ROOM_EVENT.DROPPED, () => failAttempt(attempt, "Connection to the room is lost"));
        localDisplay = initLocalDisplay(document.getElementById("localDisplay"));
        document.querySelectorAll(".empty-video").forEach(element => element.remove());
        await cControls.displayTables();
        if (!isCurrent(attempt)) return;
        cControls.onTrack(async function (media) {
            if (!isCurrent(attempt)) {
                media.stream.getTracks().forEach(track => track.stop());
                return;
            }
            await publishNewTrack(room, attempt.pc, media);
        });
        attempt.chatCleanup = createChat(room, document.getElementById("messages"),
            document.getElementById("localMessage"), document.getElementById("sendMessage"), displayError);
        const displayOptions = {quality: true, autoAbr: false};
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
        attempt.remoteDisplay = initDefaultRemoteDisplay(room, document.getElementById("display"),
            displayOptions, abrOptions, roomConfig.participantViewType);
        attempt.trafficCleanup = bindTrafficWidget(room);
        const streams = [...cControls.getVideoStreams(), ...cControls.getAudioStreams()];
        await publishPreconfiguredStreams(room, attempt.pc, streams);
        if (!isCurrent(attempt)) return;
        setMediaControls(true);
        connectionStatus("ESTABLISHED", "success");
        updateScalabilityModes();
    } catch (error) {
        failAttempt(attempt, error);
    }
}

const updateScalabilityModes = async function () {
    const select = cControls.controls.addVideoEncoding.scalabilityMode;
    const codec = cControls.controls.addVideoTrack.codec.value;
    select.replaceChildren(new Option("NONE", ""));
    select.disabled = true;
    if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.encodingInfo) return;
    try {
        const results = await Promise.all(scalabilityModes.map(scalabilityMode =>
            navigator.mediaCapabilities.encodingInfo({type: "webrtc", video: {
                contentType: "video/" + codec, width: 640, height: 480,
                bitrate: 10000, framerate: 29.97, scalabilityMode
            }}).catch(() => ({supported: false}))));
        if (!currentAttempt || cControls.controls.addVideoTrack.codec.value !== codec) return;
        results.forEach((result, index) => {
            if (result.supported) select.add(new Option(scalabilityModes[index], scalabilityModes[index]));
        });
        select.disabled = select.options.length === 1;
    } catch (error) {
        displayError(formatError(error));
    }
};

const formatError = function (event) {
    if (!event) {
        return "reason unknown";
    }
    if (typeof event === "string") {
        return event;
    }
    if (event.operation && event.error) {
        return event.operation + " failed: " + formatError(event.error);
    }
    if (event.text) {
        return event.text;
    }
    if (event.message) {
        return (event.name ? event.name + ": " : "") + event.message;
    }
    try {
        const serialized = JSON.stringify(event, Object.getOwnPropertyNames(event));
        if (serialized && serialized !== "{}") {
            return serialized;
        }
    } catch (ignore) {
        // Fallback to String below.
    }
    return String(event);
};

/**
 * Display an error message on operation failure
 *
 * @param prefix
 * @param event
 */
const onOperationFailed = function (prefix, event) {
    const reason = formatError(event);
    console.error(prefix + ": " + reason, event);
    displayError(reason);
}


/**
 * Publish streams after entering room according to configuration file
 *
 * @param {*} room
 * @param {*} pc
 * @param {*} streams
 */
const publishPreconfiguredStreams = async function (room, pc, streams) {
    const config = {};
    //add our local streams to the room (to PeerConnection)
    streams.forEach(function (s) {
        let contentType = s.type || s.source;
        //add each track to PeerConnection
        s.stream.getTracks().forEach((track) => {
            config[track.id] = contentType;
            addTrackToPeerConnection(pc, s.stream, track, s.encodings);
            subscribeTrackToEndedEvent(room, track, pc);
        });
        localDisplay.add(s.stream.id, "local", s.stream, contentType);
    });
    //join room
    const transportType = cControls.roomConfig().transport;
    await room.join(pc, null, config, cControls.initPoolParticipantsCount(), cControls.idleTransceiverTimeoutMs(), transportType);
    // Enable Delete button for each preconfigured stream #WCS-3689
    streams.forEach(function (s) {
        $('#' + s.stream.id + "-button").prop('disabled', false);
    });
}


/**
 * Publish a new media track to the room
 *
 * @param {*} room
 * @param {*} pc
 * @param {*} media
 */
const publishNewTrack = async function (room, pc, media) {
    try {
        if (!currentAttempt || currentAttempt.room !== room) return;
        let config = {};
        //add local stream to local display
        let contentType = media.type || media.source;

        localDisplay.add(media.stream.id, "local", media.stream, contentType);
        //add each track to PeerConnection
        media.stream.getTracks().forEach((track) => {
            config[track.id] = contentType;
            addTrackToPeerConnection(pc, media.stream, track, media.encodings);
            subscribeTrackToEndedEvent(room, track, pc);
        });
        // Clean error message
        displayError("");
        //kickoff renegotiation
        await room.updateState(config);
        // Enable Delete button for a new stream #WCS-3689
        $('#' + media.stream.id + "-button").prop('disabled', false);
    } catch (e) {
        if (!currentAttempt || currentAttempt.room !== room) return;
        onOperationFailed("Failed to publish a new track", e);
        // Enable Delete button for a new stream #WCS-3689
        $('#' + media.stream.id + "-button").prop('disabled', false);
    }
}

/**
 * Subscribe to track ended event to renegotiate WebRTC connection
 *
 * @param {*} room
 * @param {*} track
 * @param {*} pc
 */
const subscribeTrackToEndedEvent = function (room, track, pc) {
    track.addEventListener("ended", async function () {
        if (!currentAttempt || currentAttempt.room !== room) return;
        try {
            //track ended, see if we need to cleanup
            let negotiate = false;
            for (const sender of pc.getSenders()) {
                if (sender.track === track) {
                    pc.removeTrack(sender);
                    //track found, set renegotiation flag
                    negotiate = true;
                    if (sender.track) {
                        sender.track.stop();
                        sender.track.active = false;
                    }
                    break;
                }
            }
            // Clean error message
            displayError("");
            if (negotiate) {
                //kickoff renegotiation
                await room.updateState();
                pc.restartIce();
            }
        } catch (e) {
            if (currentAttempt && currentAttempt.room === room) onOperationFailed("Failed to update room state", e);
        }
    });
}

/**
 * Add track to WebRTC PeerConnection
 *
 * @param {*} pc
 * @param {*} stream
 * @param {*} track
 * @param {*} encodings
 */
const addTrackToPeerConnection = function (pc, stream, track, encodings) {
    if (encodings) {
        for (const encoding of encodings) {
            if (encoding.scalabilityMode === "") {
                delete encoding.scalabilityMode;
            }
        }
    }
    pc.addTransceiver(track, {
        direction: "sendonly",
        streams: [stream],
        sendEncodings: encodings ? encodings : [] //passing encoding types for video simulcast tracks
    });
}

/**
 * Display error message
 *
 * @param {*} text
 */
const displayError = function (text) {
    const errField = document.getElementById("errorMsg");
    errField.textContent = text;
}

const resetTrafficWidget = function () {
    for (const [id, text] of Object.entries({
        "stat-outbound": "0 bps", "stat-inbound": "0 bps", "stat-ping": "—",
        "stat-participants": "0", "stat-route": "Unknown"
    })) document.getElementById(id).textContent = text;
    document.querySelectorAll("#statsDashboard .status-circle").forEach(element => {
        element.classList.remove("active", "warning", "orange", "inactive");
    });
    document.getElementById("stat-route").parentElement.classList.remove("bg-secondary", "bg-info", "bg-dark");
    const empty = document.createElement("span");
    empty.className = "text-muted";
    empty.textContent = "No connection data";
    document.getElementById("topology-diagram").replaceChildren(empty);
};

const bindTrafficWidget = function (room) {
    const SERVER_TRAFFIC_TTL_MS = 3000;
    let lastClientTraffic = null;
    let lastServerTraffic = null;
    let lastServerTrafficAt = 0;
    let lastKnownPing = 0;
    let active = true;

    const isServerTrafficFresh = function () {
        return lastServerTraffic && Date.now() - lastServerTrafficAt <= SERVER_TRAFFIC_TTL_MS;
    };

    const resolvePing = function (clientTraffic, serverTraffic) {
        if (serverTraffic && typeof serverTraffic.ping === "number" && !Number.isNaN(serverTraffic.ping) && serverTraffic.ping > 0) {
            return serverTraffic.ping;
        }
        if (clientTraffic && typeof clientTraffic.ping === "number" && !Number.isNaN(clientTraffic.ping) && clientTraffic.ping > 0) {
            return clientTraffic.ping;
        }
        return lastKnownPing;
    };

    const hasActiveRoute = function (traffic) {
        const links = Array.isArray(traffic && traffic.badges && traffic.badges.links) ? traffic.badges.links : [];
        if (links.length === 0) {
            return false;
        }
        return links.some(function (link) {
            return link.active === true || link.connected === true || link.status === CONNECTION_STATUS.GREEN || link.status === CONNECTION_STATUS.YELLOW;
        });
    };

    const updatePingMetric = function (clientTraffic, serverTraffic) {
        const ping = resolvePing(clientTraffic, serverTraffic);
        if (ping > 0) {
            lastKnownPing = ping;
        }
        const routeActive = hasActiveRoute(serverTraffic) || hasActiveRoute(clientTraffic);
        const pingQuality = quality.evaluateConnectionBadgeQuality({
            connected: routeActive || lastKnownPing > 0,
            ping: ping
        });
        document.getElementById("stat-ping").textContent = ping > 0 ? Math.round(ping) + " ms" : (routeActive ? "Connected" : "—");
        updateStatusCircle("ping-status", ping > 0 ? pingQuality.status : routeActive);
    };

    const updateClientTraffic = function (traffic) {
        if (!active || !traffic) {
            return;
        }

        lastClientTraffic = traffic;
        const serverTraffic = isServerTrafficFresh() ? lastServerTraffic : null;
        const pingTraffic = serverTraffic || lastServerTraffic;
        const topologyBadges = quality.resolveTopologyBadges(traffic, serverTraffic);

        document.getElementById("stat-outbound").textContent = quality.formatSpeed(traffic.outboundBitrate);
        document.getElementById("stat-inbound").textContent = quality.formatSpeed(traffic.inboundBitrate);
        updatePingMetric(traffic, pingTraffic);
        updateStatusCircle("outbound-status", traffic.outboundBitrate > 0);
        updateStatusCircle("inbound-status", traffic.inboundBitrate > 0);

        document.getElementById("stat-participants").textContent = topologyBadges.participants.length;
        updateStatusCircle("participants-status", topologyBadges.participants.length > 0);
        updateRouteIndicator(topologyBadges);
        renderConnectionBadges(quality.createParticipantBadgeModel(topologyBadges, traffic, serverTraffic));
    };

    const updateServerTraffic = function (serverTraffic) {
        if (!active || !serverTraffic) {
            return;
        }
        lastServerTraffic = serverTraffic;
        lastServerTrafficAt = Date.now();

        const traffic = lastClientTraffic;
        if (traffic) {
            document.getElementById("stat-outbound").textContent = quality.formatSpeed(traffic.outboundBitrate);
            document.getElementById("stat-inbound").textContent = quality.formatSpeed(traffic.inboundBitrate);

            updateStatusCircle("outbound-status", traffic.outboundBitrate > 0);
            updateStatusCircle("inbound-status", traffic.inboundBitrate > 0);
        }
        updatePingMetric(traffic, serverTraffic);

        const topologyBadges = quality.resolveTopologyBadges(lastClientTraffic, serverTraffic);
        document.getElementById("stat-participants").textContent = topologyBadges.participants.length;
        updateStatusCircle("participants-status", topologyBadges.participants.length > 0);
        updateRouteIndicator(topologyBadges);

        const badgeModel = quality.createParticipantBadgeModel(topologyBadges, lastClientTraffic, serverTraffic);
        renderConnectionBadges(badgeModel);
    };

    const clientListener = function (traffic) {
        updateClientTraffic(traffic);
    };

    room.addTrafficListener(clientListener);

    room.getTraffic().then(updateClientTraffic).catch(function (error) {
        if (active) displayError(formatError(error));
    });

    room.addServerTrafficListener(updateServerTraffic);

    const cleanup = function () {
        if (!active) return;
        active = false;
        room.removeTrafficListener(clientListener);
        room.removeServerTrafficListener(updateServerTraffic);
    };
    room.on(constants.SFU_ROOM_EVENT.LEFT, function (participant) {
        if (participant && participant.userId === room.userId()) {
            cleanup();
        }
    });
    room.on(constants.SFU_ROOM_EVENT.ENDED, cleanup);
    return cleanup;
};

const updateStatusCircle = function (elementId, isActive) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove("active", "warning", "orange", "inactive");
        if (isActive === CONNECTION_STATUS.YELLOW || isActive === "warning") {
            element.classList.add("warning");
        } else if (isActive === CONNECTION_STATUS.ORANGE) {
            element.classList.add("orange");
        } else if (isActive === CONNECTION_STATUS.RED) {
            element.classList.add("inactive");
        } else if (isActive) {
            element.classList.add("active");
        } else {
            element.classList.add("inactive");
        }
    }
};


window.addEventListener("pagehide", disconnect);
