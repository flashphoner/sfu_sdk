window.ConnectionQualityBadge = (function () {
    const connectionQuality = window.SFU && window.SFU.connectionQuality;

    const CONNECTION_STATUS = {
        RED: "red",
        ORANGE: "orange",
        YELLOW: "yellow",
        GREEN: "green"
    };

    const PARTICIPANT_PRIORITY = {
        client: 0,
        local: 0,
        stun: 1,
        turn: 1,
        wcs: 2,
        remote: 2
    };

    const evaluateConnectionBadgeQuality = function (metrics) {
        if (connectionQuality && typeof connectionQuality.evaluateConnectionQuality === "function") {
            return connectionQuality.evaluateConnectionQuality(metrics);
        }
        return {
            status: metrics && metrics.connected === false ? CONNECTION_STATUS.RED : CONNECTION_STATUS.GREEN,
            reasons: []
        };
    };

    const formatSpeed = function (value) {
        if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
            return "0 bps";
        }
        if (value < 1000) {
            return `${Math.round(value)} bps`;
        }
        if (value < 1000000) {
            return `${Math.round(value / 1000)} kbps`;
        }
        return `${(value / 1000000).toFixed(2)} Mbps`;
    };

    const normalizePacketLoss = function (value) {
        if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
            return undefined;
        }
        return Math.min(100, value);
    };

    const formatPacketLossSuffix = function (value) {
        const packetLoss = normalizePacketLoss(value);
        if (packetLoss === undefined) {
            return "";
        }
        const formattedLoss = packetLoss < 0.1 ? "<0.1" : Number(packetLoss.toFixed(1)).toString();
        return " (" + formattedLoss + "% lost)";
    };

    const formatSpeedValue = function (speedObj, packetLossPercent) {
        if (!speedObj || typeof speedObj.value === 'undefined' || speedObj.value === null) {
            return "0 " + (speedObj?.unit || "bps") + formatPacketLossSuffix(packetLossPercent);
        }
        return speedObj.value + " " + speedObj.unit + formatPacketLossSuffix(packetLossPercent);
    };

    const normalizeBadges = function (badges) {
        return {
            participants: Array.isArray(badges && badges.participants) ? badges.participants : [],
            links: Array.isArray(badges && badges.links) ? badges.links : []
        };
    };

    const hasTurnParticipantIn = function (badges) {
        return normalizeBadges(badges).participants.some(function (participant) {
            return participant.type === "turn";
        });
    };

    const hasRelayLinkIn = function (badges) {
        return normalizeBadges(badges).links.some(function (link) {
            return link.type === "relay";
        });
    };

    const hasRelayRoute = function (badges) {
        return hasTurnParticipantIn(badges) || hasRelayLinkIn(badges);
    };

    const resolveTopologyBadges = function (clientTraffic, serverTraffic) {
        const clientBadges = normalizeBadges(clientTraffic && clientTraffic.badges);
        const serverBadges = normalizeBadges(serverTraffic && serverTraffic.badges);

        if (hasRelayRoute(clientBadges)) {
            return clientBadges;
        }
        if (serverBadges.participants.length > 0 || serverBadges.links.length > 0) {
            return serverBadges;
        }
        return clientBadges;
    };

    const resolveRouteMode = function (badges) {
        const normalizedBadges = normalizeBadges(badges);
        const participants = normalizedBadges.participants;
        const links = normalizedBadges.links;
        const hasDirectLink = links.some(function (link) {
            return link.type === "direct";
        });

        if (hasRelayRoute(normalizedBadges)) {
            return "Relay";
        }
        if (participants.length > 0 || hasDirectLink) {
            return "Direct";
        }
        return "Unknown";
    };

    const createParticipantBadgeModel = function (badges, clientTraffic, serverTraffic) {
        const participants = Array.isArray(badges && badges.participants) ? badges.participants : [];
        const links = Array.isArray(badges && badges.links) ? badges.links : [];
        const clientParticipants = Array.isArray(clientTraffic && clientTraffic.badges && clientTraffic.badges.participants)
            ? clientTraffic.badges.participants
            : [];

        const normalizeStatus = function (value) {
            if (typeof value === "string") {
                const normalizedValue = value.toLowerCase();
                if (normalizedValue === CONNECTION_STATUS.GREEN ||
                    normalizedValue === CONNECTION_STATUS.YELLOW ||
                    normalizedValue === CONNECTION_STATUS.ORANGE ||
                    normalizedValue === CONNECTION_STATUS.RED) {
                    return normalizedValue;
                }
            }
            if (value === true) {
                return CONNECTION_STATUS.GREEN;
            }
            if (value === false) {
                return CONNECTION_STATUS.RED;
            }
            if (value === undefined || value === null) {
                return CONNECTION_STATUS.YELLOW;
            }
            return CONNECTION_STATUS.YELLOW;
        };

        const normalizeSpeed = function (value) {
            if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
                return {value: 0, unit: "bps"};
            }

            if (value < 1000) {
                return {value: Math.round(value), unit: "bps"};
            }

            if (value < 1000000) {
                return {value: Math.round(value / 1000), unit: "kbps"};
            }

            return {value: (value / 1000000).toFixed(2), unit: "Mbps"};
        };

        const normalizeType = function (value) {
            if (value === "client") {
                return "local";
            }
            if (value === "wcs") {
                return "remote";
            }
            return value || "unknown";
        };

        const formatAddress = function (participant) {
            const address = participant.ip || participant.address || "";
            const port = participant.port ? ":" + participant.port : "";
            return address || port ? address + port : "Address unavailable";
        };

        const hasMeasuredTraffic = function (participantType) {
            if (participantType === "local" || participantType === "client") {
                return true;
            }
            return (participantType === "remote" || participantType === "wcs") && !!serverTraffic;
        };

        const findClientParticipant = function (participantType) {
            return clientParticipants.find(function (participant) {
                return normalizeType(participant.type) === participantType;
            });
        };

        const participantItems = participants.map(function (participant, index) {
            const participantType = normalizeType(participant.type);
            let label = participant.nickName || participant.name;
            if (!label) {
                if (participantType === "client" || participantType === "local") {
                    label = 'Client';
                } else if (participantType === "wcs" || participantType === "remote") {
                    label = 'WCS';
                } else if (participantType === 'turn') {
                    label = 'TURN';
                } else {
                    label = participantType || 'Node';
                }
            }

            let inboundBitrate = participant.inboundBitrate;
            let outboundBitrate = participant.outboundBitrate;
            let inboundPacketLossPercent = normalizePacketLoss(participant.inboundPacketLossPercent);
            let outboundPacketLossPercent = normalizePacketLoss(participant.outboundPacketLossPercent);
            let connectedValue = participant.connected !== undefined ? participant.connected : (participant.active !== undefined ? participant.active : participant.hasConnection);

            if ((participantType === "local" || participantType === "client") && clientTraffic) {
                inboundBitrate = clientTraffic.inboundBitrate;
                outboundBitrate = clientTraffic.outboundBitrate;
                const clientInboundPacketLossPercent = normalizePacketLoss(clientTraffic.inboundPacketLossPercent);
                const clientOutboundPacketLossPercent = normalizePacketLoss(clientTraffic.outboundPacketLossPercent);
                if (clientInboundPacketLossPercent !== undefined) {
                    inboundPacketLossPercent = clientInboundPacketLossPercent;
                }
                if (clientOutboundPacketLossPercent !== undefined) {
                    outboundPacketLossPercent = clientOutboundPacketLossPercent;
                }

                const localClientParticipant = findClientParticipant("local") || findClientParticipant("client");
                if (localClientParticipant) {
                    connectedValue = localClientParticipant.connected !== undefined
                        ? localClientParticipant.connected
                        : (localClientParticipant.active !== undefined ? localClientParticipant.active : localClientParticipant.hasConnection);
                    const localClientInboundPacketLossPercent = normalizePacketLoss(localClientParticipant.inboundPacketLossPercent);
                    const localClientOutboundPacketLossPercent = normalizePacketLoss(localClientParticipant.outboundPacketLossPercent);
                    if (localClientInboundPacketLossPercent !== undefined) {
                        inboundPacketLossPercent = localClientInboundPacketLossPercent;
                    }
                    if (localClientOutboundPacketLossPercent !== undefined) {
                        outboundPacketLossPercent = localClientOutboundPacketLossPercent;
                    }
                }
            }
            if ((participantType === "remote" || participantType === "wcs") && clientTraffic) {
                const localRemoteParticipant = findClientParticipant("remote") || findClientParticipant("wcs");
                if (localRemoteParticipant) {
                    const localRemoteInboundPacketLossPercent = normalizePacketLoss(localRemoteParticipant.inboundPacketLossPercent);
                    const localRemoteOutboundPacketLossPercent = normalizePacketLoss(localRemoteParticipant.outboundPacketLossPercent);
                    if (localRemoteInboundPacketLossPercent !== undefined) {
                        inboundPacketLossPercent = localRemoteInboundPacketLossPercent;
                    }
                    if (localRemoteOutboundPacketLossPercent !== undefined) {
                        outboundPacketLossPercent = localRemoteOutboundPacketLossPercent;
                    }
                }
            }
            if ((participantType === "remote" || participantType === "wcs") && serverTraffic) {
                inboundBitrate = serverTraffic.inboundBitrate;
                outboundBitrate = serverTraffic.outboundBitrate;
            }

            const measuredTraffic = hasMeasuredTraffic(participantType);
            if (!measuredTraffic || typeof inboundBitrate !== "number" || Number.isNaN(inboundBitrate) || inboundBitrate < 0) {
                inboundBitrate = 0;
            }
            if (!measuredTraffic || typeof outboundBitrate !== "number" || Number.isNaN(outboundBitrate) || outboundBitrate < 0) {
                outboundBitrate = 0;
            }

            return {
                id: participant.id || participant.userId || participant.nickName || String(index),
                label: label,
                type: participantType,
                address: formatAddress(participant),
                status: normalizeStatus(connectedValue),
                showTraffic: measuredTraffic,
                inboundSpeed: measuredTraffic ? normalizeSpeed(inboundBitrate) : null,
                outboundSpeed: measuredTraffic ? normalizeSpeed(outboundBitrate) : null,
                inboundPacketLossPercent: inboundPacketLossPercent,
                outboundPacketLossPercent: outboundPacketLossPercent
            };
        }).sort(function (left, right) {
            const leftPriority = PARTICIPANT_PRIORITY[left.type] !== undefined ? PARTICIPANT_PRIORITY[left.type] : 99;
            const rightPriority = PARTICIPANT_PRIORITY[right.type] !== undefined ? PARTICIPANT_PRIORITY[right.type] : 99;
            return leftPriority - rightPriority;
        });

        const linkItems = links.map(function (link) {
            const connectedValue = link.connected !== undefined ? link.connected : (link.active !== undefined ? link.active : link.hasConnection);
            const inboundBitrate = serverTraffic ? serverTraffic.inboundBitrate : (clientTraffic ? clientTraffic.inboundBitrate : undefined);
            const outboundBitrate = serverTraffic ? serverTraffic.outboundBitrate : (clientTraffic ? clientTraffic.outboundBitrate : undefined);
            const hasInboundTraffic = typeof inboundBitrate === "number" && inboundBitrate > 0;
            const hasOutboundTraffic = typeof outboundBitrate === "number" && outboundBitrate > 0;
            const inboundPacketLossPercent = normalizePacketLoss(link.inboundPacketLossPercent) ||
                normalizePacketLoss(clientTraffic && clientTraffic.inboundPacketLossPercent);
            const outboundPacketLossPercent = normalizePacketLoss(link.outboundPacketLossPercent) ||
                normalizePacketLoss(clientTraffic && clientTraffic.outboundPacketLossPercent);
            const quality = evaluateConnectionBadgeQuality({
                connected: connectedValue,
                status: link.status,
                inboundBitrate: hasInboundTraffic ? inboundBitrate : undefined,
                outboundBitrate: hasOutboundTraffic ? outboundBitrate : undefined,
                inboundPacketLossPercent: inboundPacketLossPercent,
                outboundPacketLossPercent: outboundPacketLossPercent,
                expectedInboundTraffic: connectedValue !== false && hasInboundTraffic,
                expectedOutboundTraffic: connectedValue !== false && hasOutboundTraffic
            });
            return {
                id: link.id || [link.from || "unknown", link.to || "unknown", link.type || "direct"].join("-"),
                from: link.from || "",
                to: link.to || "",
                type: link.type || "direct",
                status: quality.status,
                qualityReasons: quality.reasons
            };
        });

        return {
            participants: participantItems,
            links: linkItems
        };
    };

    const findLinkBetweenParticipants = function (currentParticipant, nextParticipant, links) {
        const directLink = links.find(function (link) {
            return link.from === currentParticipant.id && link.to === nextParticipant.id;
        });
        if (directLink) {
            return directLink;
        }

        const reverseLink = links.find(function (link) {
            return link.from === nextParticipant.id && link.to === currentParticipant.id;
        });
        if (reverseLink) {
            return reverseLink;
        }

        return {
            id: currentParticipant.id + "-" + nextParticipant.id,
            from: currentParticipant.id,
            to: nextParticipant.id,
            type: currentParticipant.type === "turn" || nextParticipant.type === "turn" ? "relay" : "direct",
            status: currentParticipant.status === CONNECTION_STATUS.RED || nextParticipant.status === CONNECTION_STATUS.RED
                ? CONNECTION_STATUS.RED
                : CONNECTION_STATUS.YELLOW
        };
    };

    return {
        CONNECTION_STATUS: CONNECTION_STATUS,
        evaluateConnectionBadgeQuality: evaluateConnectionBadgeQuality,
        formatSpeed: formatSpeed,
        formatSpeedValue: formatSpeedValue,
        normalizePacketLoss: normalizePacketLoss,
        normalizeBadges: normalizeBadges,
        hasRelayRoute: hasRelayRoute,
        resolveTopologyBadges: resolveTopologyBadges,
        resolveRouteMode: resolveRouteMode,
        createParticipantBadgeModel: createParticipantBadgeModel,
        findLinkBetweenParticipants: findLinkBetweenParticipants
    };
})();
