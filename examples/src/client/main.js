const constants = SFU.constants;
const sfu = SFU;
const quality = window.ConnectionQualityBadge;
const CONNECTION_STATUS = quality.CONNECTION_STATUS;
let localDisplay;
let cControls;

const updateRouteIndicator = function (badges) {
    const routeMode = quality.resolveRouteMode(badges);
    const routeElement = document.getElementById("stat-route");
    if (routeElement) {
        routeElement.innerText = routeMode;
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

/**
 * Load track configuration and show entrance modal
 */
const init = function () {
    $.getJSON("config.json", function (config) {
        cControls = createControls(config);
    }).fail(function () {
        //use default config
        cControls = createControls(defaultConfig);
    });

    // insert transport values in entrance modal
    const transportSelect = document.getElementById('transport');
    Object.values(constants.SFU_TRANSPORT_TYPE).forEach(function(value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        transportSelect.appendChild(option);
    });
    // insert participant view types in entrance modal
    const participantViewTypeSelect = document.getElementById("participantViewType");
    Object.values(PARTICIPANT_VIEW_TYPE).forEach(function(value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        participantViewTypeSelect.appendChild(option);
    })
    //open entrance modal
    $('#entranceModal').modal('show');
}

/**
 * Connect to server and publish preconfigured streams
 */
async function connect() {
    // hide modal
    $('#entranceModal').modal('hide');
    // disable controls
    cControls.muteInput();
    //get config object for room creation
    const roomConfig = cControls.roomConfig();
    //kick off connect to server and local room creation
    try {
        const rtcConfiguration = buildRtcConfiguration(roomConfig);
        const pc = rtcConfiguration ? new RTCPeerConnection(rtcConfiguration) : new RTCPeerConnection();
        const session = await sfu.createRoom(roomConfig);
        // Now we connected to the server (if no exception was thrown)
        session.on(constants.SFU_EVENT.FAILED, function (e) {
            if (e.status && e.statusText) {
                displayError("CONNECTION FAILED: " + e.status + " " + e.statusText);
            } else if (e.type && e.info) {
                displayError("CONNECTION FAILED: " + e.info);
            } else {
                displayError("CONNECTION FAILED: " + e);
            }
        }).on(constants.SFU_EVENT.DISCONNECTED, function (e) {
            displayError("DISCONNECTED. Refresh the page to enter the room again");
        });
        const room = session.room();
        room.on(constants.SFU_ROOM_EVENT.FAILED, function (e) {
            displayError(e);
        }).on(constants.SFU_ROOM_EVENT.OPERATION_FAILED, function (e) {
            displayError(e.operation + " failed: " + e.error);
        })

        // create local display to show local streams
        localDisplay = initLocalDisplay(document.getElementById("localDisplay"));
        // display audio and video control tables
        await cControls.displayTables();
        cControls.onTrack(async function (s) {
            await publishNewTrack(room, pc, s);
        });
        //create and bind chat to the new room
        const chatDiv = document.getElementById('messages');
        const chatInput = document.getElementById('localMessage');
        const chatButton = document.getElementById('sendMessage');
        createChat(room, chatDiv, chatInput, chatButton);

        //setup remote display for showing remote audio/video tracks
        const remoteDisplay = document.getElementById("display");
        const displayOptions = {
            quality: true,
            autoAbr: false
        };
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
        initDefaultRemoteDisplay(room, remoteDisplay, displayOptions, abrOptions, roomConfig.participantViewType);
        bindTrafficWidget(room);

        //get configured local video streams
        let streams = cControls.getVideoStreams();
        //combine local video streams with audio streams
        streams.push.apply(streams, cControls.getAudioStreams());

        // Publish preconfigured streams
        publishPreconfiguredStreams(room, pc, streams);
    } catch (e) {
        console.error(e);
        displayError(formatError(e));
    }
}

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
    try {
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
        cControls.controls.addVideoTrack.codec.addEventListener('change', async (event) => {
            const mimeType = "video/" + event.target.value;
            while (cControls.controls.addVideoEncoding.scalabilityMode.firstChild) {
                cControls.controls.addVideoEncoding.scalabilityMode.firstChild.remove();
            }
            const option = document.createElement('option');
            option.value = '';
            option.innerText = 'NONE';
            cControls.controls.addVideoEncoding.scalabilityMode.appendChild(option);

            const capabilityPromises = [];
            for (const mode of scalabilityModes) {
                capabilityPromises.push(navigator.mediaCapabilities.encodingInfo({
                    type: 'webrtc',
                    video: {
                        contentType: mimeType,
                        width: 640,
                        height: 480,
                        bitrate: 10000,
                        framerate: 29.97,
                        scalabilityMode: mode
                    }
                }));
            }
            const capabilityResults = await Promise.all(capabilityPromises);
            for (let i = 0; i < scalabilityModes.length; ++i) {
                if (capabilityResults[i].supported) {
                    const option = document.createElement('option');
                    option.value = scalabilityModes[i];
                    option.innerText = scalabilityModes[i];
                    cControls.controls.addVideoEncoding.scalabilityMode.appendChild(option);
                }
            }

            if (cControls.controls.addVideoEncoding.scalabilityMode.childElementCount > 1) {
                cControls.controls.addVideoEncoding.scalabilityMode.disabled = false;
            } else {
                cControls.controls.addVideoEncoding.scalabilityMode.disabled = true;
            }
        });
    } catch (e) {
        onOperationFailed("Failed to publish a preconfigured streams", e);
        // Enable Delete button for each preconfigured stream #WCS-3689
        streams.forEach(function (s) {
            $('#' + s.stream.id + "-button").prop('disabled', false);
        });
    }
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
            onOperationFailed("Failed to update room state", e);
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
    errField.style.color = "red";
    errField.innerText = text;
}

const bindTrafficWidget = function (room) {
    const SERVER_TRAFFIC_TTL_MS = 3000;
    let lastClientTraffic = null;
    let lastServerTraffic = null;
    let lastServerTrafficAt = 0;
    let lastKnownPing = 0;

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
        document.getElementById("stat-ping").innerText = ping > 0 ? Math.round(ping) + " ms" : (routeActive ? "Connected" : "—");
        updateStatusCircle("ping-status", ping > 0 ? pingQuality.status : routeActive);
    };

    const updateClientTraffic = function (traffic) {
        if (!traffic) {
            return;
        }

        lastClientTraffic = traffic;
        const serverTraffic = isServerTrafficFresh() ? lastServerTraffic : null;
        const pingTraffic = serverTraffic || lastServerTraffic;
        const topologyBadges = quality.resolveTopologyBadges(traffic, serverTraffic);

        document.getElementById("stat-outbound").innerText = quality.formatSpeed(traffic.outboundBitrate);
        document.getElementById("stat-inbound").innerText = quality.formatSpeed(traffic.inboundBitrate);
        updatePingMetric(traffic, pingTraffic);
        updateStatusCircle("outbound-status", traffic.outboundBitrate > 0);
        updateStatusCircle("inbound-status", traffic.inboundBitrate > 0);

        document.getElementById("stat-participants").innerText = topologyBadges.participants.length;
        updateStatusCircle("participants-status", topologyBadges.participants.length > 0);
        updateRouteIndicator(topologyBadges);
        renderConnectionBadges(quality.createParticipantBadgeModel(topologyBadges, traffic, serverTraffic));
    };

    const updateServerTraffic = function (serverTraffic) {
        if (!serverTraffic) {
            return;
        }
        lastServerTraffic = serverTraffic;
        lastServerTrafficAt = Date.now();

        const traffic = lastClientTraffic;
        if (traffic) {
            document.getElementById("stat-outbound").innerText = quality.formatSpeed(traffic.outboundBitrate);
            document.getElementById("stat-inbound").innerText = quality.formatSpeed(traffic.inboundBitrate);

            updateStatusCircle("outbound-status", traffic.outboundBitrate > 0);
            updateStatusCircle("inbound-status", traffic.inboundBitrate > 0);
        }
        updatePingMetric(traffic, serverTraffic);

        const topologyBadges = quality.resolveTopologyBadges(lastClientTraffic, serverTraffic);
        document.getElementById("stat-participants").innerText = topologyBadges.participants.length;
        updateStatusCircle("participants-status", topologyBadges.participants.length > 0);
        updateRouteIndicator(topologyBadges);

        const badgeModel = quality.createParticipantBadgeModel(topologyBadges, lastClientTraffic, serverTraffic);
        renderConnectionBadges(badgeModel);
    };

    const clientListener = function (traffic) {
        updateClientTraffic(traffic);
    };

    room.addTrafficListener(clientListener);

    room.getTraffic().then(function (traffic) {
        updateClientTraffic(traffic);
    });

    room.addServerTrafficListener(updateServerTraffic);

    const cleanup = function () {
        room.removeTrafficListener(clientListener);
        room.removeServerTrafficListener(updateServerTraffic);
    };
    room.on(constants.SFU_ROOM_EVENT.LEFT, function (participant) {
        if (participant && participant.userId === room.userId()) {
            cleanup();
        }
    });
    room.on(constants.SFU_ROOM_EVENT.ENDED, cleanup);
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

/**
 * Entrance modal cancelled, we do not enter to a room
 */
const cancel = function () {
    //hide modal
    $('#entranceModal').modal('hide');
    //disable controls
    cControls.muteInput();
    // display the error message
    displayError("Please refresh the page, fill the entrance modal and enter a room to publish or play streams");
}
