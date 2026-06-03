import Logger from "./logger";
import {ConnectionQualityStatus, evaluatePacketLossQuality} from "./connection-quality";

export type ConnectionParticipant = {
    id: string;
    type: 'local' | 'remote' | 'turn' | 'stun';
    name: string;
    ip: string;
    port: number;
    protocol: 'udp' | 'tcp';
    active: boolean;
    inboundBitrate: number;
    outboundBitrate: number;
    inboundPacketLossPercent?: number;
    outboundPacketLossPercent?: number;
    lastActivity: number;
};

export type ConnectionLink = {
    id: string;
    from: string;
    to: string;
    type: 'direct' | 'relay';
    active: boolean;
    inboundBitrate: number;
    outboundBitrate: number;
    inboundPacketLossPercent?: number;
    outboundPacketLossPercent?: number;
    status: ConnectionQualityStatus;
};

export type ConnectionBadges = {
    participants: ConnectionParticipant[];
    links: ConnectionLink[];
};

export type WebRTCConnectionTraffic = {
    inboundBitrate: number;
    outboundBitrate: number;
    inboundPacketLossPercent?: number;
    outboundPacketLossPercent?: number;
    ping: number;
    badges: ConnectionBadges;
};

type TrafficStatsData = {
    inboundBytes: number;
    outboundBytes: number;
    ping: number;
    selectedPair: any;
    localCandidate: any;
    remoteCandidate: any;
    connectionState: string;
    inboundPacketsReceived: number;
    inboundPacketsLost: number;
    outboundPacketsReceived: number;
    outboundPacketsLost: number;
    outboundPacketsSent: number;
    outboundPacketLossPercent?: number;
};

type TrafficSnapshot = {
    timestamp: number;
    inboundBytes: number;
    outboundBytes: number;
    inboundPacketsReceived: number;
    inboundPacketsLost: number;
    outboundPacketsReceived: number;
    outboundPacketsLost: number;
    outboundPacketsSent: number;
};

type CandidateEndpoint = {
    ip: string;
    port: number;
    protocol: 'udp' | 'tcp';
};

export class LocalTrafficMonitor {
    protected pc: RTCPeerConnection;
    protected logger: Logger;
    protected lastTrafficSnapshot?: TrafficSnapshot;
    #lastPing: number = 0;

    public constructor(pc: RTCPeerConnection) {
        this.pc = pc;
        this.logger = new Logger();
    }

    public async getTraffic(): Promise<WebRTCConnectionTraffic> {
        try {
            const stats = await this.pc.getStats();
            const timestamp = Date.now();
            const {
                inboundBytes,
                outboundBytes,
                ping,
                localCandidate,
                remoteCandidate,
                connectionState,
                inboundPacketsReceived,
                inboundPacketsLost,
                outboundPacketsReceived,
                outboundPacketsLost,
                outboundPacketsSent,
                outboundPacketLossPercent: outboundPacketLossPercentFallback
            } = this.#collectStatsData(stats);
            const previousSnapshot = this.lastTrafficSnapshot;
            const isTurn = this.#isRelayCandidate(localCandidate) || this.#isRelayCandidate(remoteCandidate);
            const {totalInboundBitrate, totalOutboundBitrate} = this.#calculateBitrates(inboundBytes, outboundBytes, timestamp, previousSnapshot);
            const inboundPacketLossPercent = this.#calculatePacketLossPercent(
                inboundPacketsReceived,
                inboundPacketsLost,
                previousSnapshot?.inboundPacketsReceived || 0,
                previousSnapshot?.inboundPacketsLost || 0
            );
            const outboundPacketLossPercent = this.#calculatePacketLossPercent(
                outboundPacketsReceived,
                outboundPacketsLost,
                previousSnapshot?.outboundPacketsReceived || 0,
                previousSnapshot?.outboundPacketsLost || 0,
                outboundPacketLossPercentFallback,
                outboundPacketsSent,
                previousSnapshot?.outboundPacketsSent || 0
            );
            const participants = this.#createParticipants(
                localCandidate,
                remoteCandidate,
                isTurn,
                connectionState,
                totalInboundBitrate,
                totalOutboundBitrate,
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                timestamp
            );
            const links = this.#createLinks(
                participants,
                isTurn,
                connectionState,
                totalInboundBitrate,
                totalOutboundBitrate,
                inboundPacketLossPercent,
                outboundPacketLossPercent
            );

            this.lastTrafficSnapshot = {
                timestamp,
                inboundBytes,
                outboundBytes,
                inboundPacketsReceived,
                inboundPacketsLost,
                outboundPacketsReceived,
                outboundPacketsLost,
                outboundPacketsSent
            };

            return {
                inboundBitrate: Math.round(totalInboundBitrate),
                outboundBitrate: Math.round(totalOutboundBitrate),
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                ping: Math.round(ping),
                badges: {
                    participants,
                    links
                }
            };
        } catch (error) {
            this.logger.error('Failed to get local connection traffic:', error);
            return LocalTrafficMonitor.emptyTraffic();
        }
    }

    public static emptyTraffic(): WebRTCConnectionTraffic {
        return {
            inboundBitrate: 0,
            outboundBitrate: 0,
            ping: 0,
            badges: {
                participants: [],
                links: []
            }
        };
    }

    #collectStatsData(stats: RTCStatsReport): TrafficStatsData {
        let inboundBytes = 0;
        let outboundBytes = 0;
        let ping = 0;
        let connectionState: string = this.pc.connectionState as string;
        let selectedPair: any;
        let selectedCandidatePairId: string | undefined;
        let inboundPacketsReceived = 0;
        let inboundPacketsLost = 0;
        let outboundPacketsReceived = 0;
        let outboundPacketsLost = 0;
        let outboundPacketsSent = 0;
        const candidatePairs: any[] = [];
        const remoteInboundReports: any[] = [];
        const outboundPacketLossSamples: number[] = [];
        const reports = new Map<string, any>();
        const candidates = new Map<string, any>();

        stats.forEach((report: any) => {
            reports.set(report.id, report);
            if (report.type === 'inbound-rtp' && !report.isRemote && report.bytesReceived !== undefined) {
                inboundBytes += report.bytesReceived;
                inboundPacketsReceived += this.#normalizePacketCounter(report.packetsReceived);
                inboundPacketsLost += this.#normalizePacketCounter(report.packetsLost);
            }
            if (report.type === 'outbound-rtp' && !report.isRemote && report.bytesSent !== undefined) {
                outboundBytes += report.bytesSent;
                outboundPacketsSent += this.#normalizePacketCounter(report.packetsSent);
            }
            if (report.type === 'transport' && report.selectedCandidatePairId) {
                selectedCandidatePairId = report.selectedCandidatePairId;
            }
            if (report.type === 'candidate-pair') {
                candidatePairs.push(report);
                if (report.selected) {
                    selectedPair = report;
                }
            }
            if (report.type === 'remote-inbound-rtp') {
                remoteInboundReports.push(report);
                outboundPacketsReceived += this.#normalizePacketCounter(report.packetsReceived);
                outboundPacketsLost += this.#normalizePacketCounter(report.packetsLost);
                const fractionLostPercent = this.#normalizeFractionLost(report.fractionLost);
                if (fractionLostPercent !== undefined) {
                    outboundPacketLossSamples.push(fractionLostPercent);
                }
            }
            if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
                candidates.set(report.id, report);
            }
        });

        selectedPair = this.#resolveSelectedCandidatePair(candidatePairs, candidates, reports, selectedCandidatePairId, selectedPair);

        ping = this.#resolvePing(selectedPair, remoteInboundReports);
        if (ping > 0) {
            this.#lastPing = ping;
        } else if (this.#lastPing > 0 && (connectionState === 'connected' || connectionState === 'completed')) {
            ping = this.#lastPing;
        }

        const localCandidate = selectedPair ? candidates.get(selectedPair.localCandidateId) : undefined;
        const remoteCandidate = selectedPair ? candidates.get(selectedPair.remoteCandidateId) : undefined;
        const outboundPacketLossPercent = this.#averagePacketLoss(outboundPacketLossSamples);

        return {
            inboundBytes,
            outboundBytes,
            ping,
            selectedPair,
            localCandidate,
            remoteCandidate,
            connectionState,
            inboundPacketsReceived,
            inboundPacketsLost,
            outboundPacketsReceived,
            outboundPacketsLost,
            outboundPacketsSent,
            outboundPacketLossPercent
        };
    }

    #resolveSelectedCandidatePair(
        candidatePairs: any[],
        candidates: Map<string, any>,
        reports: Map<string, any>,
        selectedCandidatePairId?: string,
        reportedSelectedPair?: any
    ): any {
        if (selectedCandidatePairId) {
            const selectedPair = reports.get(selectedCandidatePairId);
            if (selectedPair) {
                return selectedPair;
            }
        }
        if (reportedSelectedPair) {
            return reportedSelectedPair;
        }

        return candidatePairs.find(pair => pair.nominated && this.#isPairReady(pair)) ||
            candidatePairs.find(pair => this.#isPairReady(pair)) ||
            candidatePairs.find(pair => this.#pairUsesRelay(pair, candidates) && this.#isPairChecking(pair)) ||
            candidatePairs.find(pair => this.#pairUsesRelay(pair, candidates)) ||
            candidatePairs[0];
    }

    #isPairReady(pair: any): boolean {
        const state = String(pair?.state || '').toLowerCase();
        return state === 'succeeded' || state === 'connected';
    }

    #isPairChecking(pair: any): boolean {
        const state = String(pair?.state || '').toLowerCase();
        return state === 'in-progress' || state === 'inprogress' || state === 'checking' || state === 'waiting';
    }

    #pairUsesRelay(pair: any, candidates: Map<string, any>): boolean {
        if (!pair) {
            return false;
        }
        const localCandidate = candidates.get(pair.localCandidateId);
        const remoteCandidate = candidates.get(pair.remoteCandidateId);
        return this.#isRelayCandidate(localCandidate) || this.#isRelayCandidate(remoteCandidate);
    }

    #resolvePing(selectedPair: any, remoteInboundReports: any[]): number {
        if (selectedPair) {
            if (selectedPair.currentRoundTripTime !== undefined && selectedPair.currentRoundTripTime > 0) {
                return selectedPair.currentRoundTripTime * 1000;
            }
            if (selectedPair.lastRoundTripTime !== undefined && selectedPair.lastRoundTripTime > 0) {
                return selectedPair.lastRoundTripTime * 1000;
            }
            if (selectedPair.totalRoundTripTime !== undefined && selectedPair.responsesReceived > 0) {
                return selectedPair.totalRoundTripTime / selectedPair.responsesReceived * 1000;
            }
        }

        const remoteInboundRoundTripTimes = remoteInboundReports
            .map(report => report.roundTripTime)
            .filter(value => typeof value === 'number' && !Number.isNaN(value) && value > 0);
        if (remoteInboundRoundTripTimes.length > 0) {
            const totalRoundTripTime = remoteInboundRoundTripTimes.reduce((sum, value) => sum + value, 0);
            return totalRoundTripTime / remoteInboundRoundTripTimes.length * 1000;
        }

        return 0;
    }

    #calculateBitrates(inboundBytes: number, outboundBytes: number, timestamp: number, previousSnapshot?: TrafficSnapshot): {
        totalInboundBitrate: number;
        totalOutboundBitrate: number;
    } {
        if (!previousSnapshot) {
            return {totalInboundBitrate: 0, totalOutboundBitrate: 0};
        }
        const timePassed = (timestamp - previousSnapshot.timestamp) / 1000;
        const totalInboundBitrate = timePassed > 0 ? Math.max(0, ((inboundBytes - previousSnapshot.inboundBytes) * 8) / timePassed) : 0;
        const totalOutboundBitrate = timePassed > 0 ? Math.max(0, ((outboundBytes - previousSnapshot.outboundBytes) * 8) / timePassed) : 0;

        return {totalInboundBitrate, totalOutboundBitrate};
    }

    #calculatePacketLossPercent(
        currentPacketsReceived: number,
        currentPacketsLost: number,
        previousPacketsReceived: number,
        previousPacketsLost: number,
        fallbackPacketLossPercent?: number,
        currentPacketsSent?: number,
        previousPacketsSent?: number
    ): number | undefined {
        const packetsReceivedDelta = currentPacketsReceived - previousPacketsReceived;
        const packetsLostDelta = currentPacketsLost - previousPacketsLost;
        const packetsSentDelta = currentPacketsSent !== undefined && previousPacketsSent !== undefined ?
            currentPacketsSent - previousPacketsSent : undefined;
        if (packetsReceivedDelta < 0 || packetsLostDelta < 0 || (packetsSentDelta !== undefined && packetsSentDelta < 0)) {
            return fallbackPacketLossPercent;
        }
        if (packetsLostDelta === 0) {
            return fallbackPacketLossPercent !== undefined && fallbackPacketLossPercent > 0 ? fallbackPacketLossPercent : undefined;
        }
        const packetsTotalDelta = packetsReceivedDelta + packetsLostDelta;
        if (packetsReceivedDelta > 0 && packetsTotalDelta > 0) {
            return this.#normalizePacketLossPercent((packetsLostDelta / packetsTotalDelta) * 100);
        }
        if (fallbackPacketLossPercent !== undefined && fallbackPacketLossPercent > 0) {
            return fallbackPacketLossPercent;
        }
        if (packetsSentDelta !== undefined && packetsSentDelta > 0) {
            return this.#normalizePacketLossPercent((packetsLostDelta / Math.max(packetsSentDelta, packetsLostDelta)) * 100);
        }
        return fallbackPacketLossPercent;
    }

    #normalizePacketCounter(value: number | undefined): number {
        return typeof value === 'number' && !Number.isNaN(value) && value > 0 ? value : 0;
    }

    #normalizeFractionLost(value: number | undefined): number | undefined {
        if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
            return undefined;
        }
        if (value <= 1) {
            return this.#normalizePacketLossPercent(value * 100);
        }
        return this.#normalizePacketLossPercent(value);
    }

    #normalizePacketLossPercent(value: number): number | undefined {
        if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
            return undefined;
        }
        return Math.min(100, value);
    }

    #averagePacketLoss(samples: number[]): number | undefined {
        if (samples.length === 0) {
            return undefined;
        }
        return samples.reduce((sum, value) => sum + value, 0) / samples.length;
    }

    #maxPacketLoss(left?: number, right?: number): number | undefined {
        if (left === undefined) {
            return right;
        }
        if (right === undefined) {
            return left;
        }
        return Math.max(left, right);
    }

    #createParticipants(
        localCandidate: any,
        remoteCandidate: any,
        isTurn: boolean,
        connectionState: string,
        totalInboundBitrate: number,
        totalOutboundBitrate: number,
        inboundPacketLossPercent: number | undefined,
        outboundPacketLossPercent: number | undefined,
        timestamp: number
    ): ConnectionParticipant[] {
        const participants: ConnectionParticipant[] = [];
        const active = connectionState === 'connected' || connectionState === 'completed' || connectionState === 'checking';
        const localEndpoint = this.#clientEndpoint(localCandidate);
        const remoteEndpoint = this.#candidateEndpoint(remoteCandidate);

        participants.push({
            id: 'local-client',
            type: 'local',
            name: 'Client',
            ip: localEndpoint?.ip || '127.0.0.1',
            port: localEndpoint?.port || 0,
            protocol: localEndpoint?.protocol || this.#candidateProtocol(localCandidate),
            active,
            inboundBitrate: Math.round(totalInboundBitrate),
            outboundBitrate: Math.round(totalOutboundBitrate),
            inboundPacketLossPercent,
            outboundPacketLossPercent,
            lastActivity: timestamp
        });

        if (isTurn) {
            const turnCandidate = this.#isRelayCandidate(localCandidate) ? localCandidate : remoteCandidate;
            const turnEndpoint = this.#turnServerEndpoint(turnCandidate) || this.#candidateEndpoint(turnCandidate);
            participants.push({
                id: `turn-${turnEndpoint?.ip || 'unknown'}-${turnEndpoint?.port || 0}`,
                type: 'turn',
                name: 'TURN',
                ip: turnEndpoint?.ip || '',
                port: turnEndpoint?.port || 0,
                protocol: turnEndpoint?.protocol || this.#candidateProtocol(turnCandidate),
                active,
                inboundBitrate: Math.round(totalInboundBitrate),
                outboundBitrate: Math.round(totalOutboundBitrate),
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                lastActivity: timestamp
            });
        }

        participants.push({
            id: 'remote-server',
            type: 'remote',
            name: 'WCS',
            ip: remoteEndpoint?.ip || '',
            port: remoteEndpoint?.port || 0,
            protocol: remoteEndpoint?.protocol || this.#candidateProtocol(remoteCandidate),
            active,
            inboundBitrate: Math.round(totalOutboundBitrate),
            outboundBitrate: Math.round(totalInboundBitrate),
            inboundPacketLossPercent: outboundPacketLossPercent,
            outboundPacketLossPercent: inboundPacketLossPercent,
            lastActivity: timestamp
        });

        return participants;
    }

    #createLinks(
        participants: ConnectionParticipant[],
        isTurn: boolean,
        connectionState: string,
        totalInboundBitrate: number,
        totalOutboundBitrate: number,
        inboundPacketLossPercent: number | undefined,
        outboundPacketLossPercent: number | undefined
    ): ConnectionLink[] {
        const links: ConnectionLink[] = [];
        const packetLossPercent = this.#maxPacketLoss(inboundPacketLossPercent, outboundPacketLossPercent);

        if (isTurn) {
            links.push({
                id: 'local-turn',
                from: participants[0].id,
                to: participants[1].id,
                type: 'relay',
                active: participants[1].active,
                inboundBitrate: Math.round(totalInboundBitrate),
                outboundBitrate: Math.round(totalOutboundBitrate),
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                status: this.#resolveStatus(connectionState, packetLossPercent)
            });
            links.push({
                id: 'turn-remote',
                from: participants[1].id,
                to: participants[participants.length - 1].id,
                type: 'relay',
                active: participants[participants.length - 1].active,
                inboundBitrate: Math.round(totalInboundBitrate),
                outboundBitrate: Math.round(totalOutboundBitrate),
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                status: this.#resolveStatus(connectionState, packetLossPercent)
            });
        } else {
            links.push({
                id: 'local-remote',
                from: participants[0].id,
                to: participants[participants.length - 1].id,
                type: 'direct',
                active: participants[participants.length - 1].active,
                inboundBitrate: Math.round(totalInboundBitrate),
                outboundBitrate: Math.round(totalOutboundBitrate),
                inboundPacketLossPercent,
                outboundPacketLossPercent,
                status: this.#resolveStatus(connectionState, packetLossPercent)
            });
        }

        return links;
    }

    #resolveStatus(connectionState: string, packetLossPercent?: number): ConnectionQualityStatus {
        if (connectionState === 'connected' || connectionState === 'completed') {
            return evaluatePacketLossQuality(packetLossPercent) || 'green';
        }
        if (connectionState === 'checking' || connectionState === 'new') {
            return 'yellow';
        }
        return 'red';
    }

    #isRelayCandidate(candidate: any): boolean {
        if (!candidate) {
            return false;
        }
        const candidateType = String(candidate.candidateType || candidate.type || '').toLowerCase();
        const url = String(candidate.url || '');
        const candidateLine = String(candidate.candidate || '');
        return Boolean(candidate.relayProtocol ||
            candidateType === 'relay' ||
            /^turns?:/i.test(url) ||
            /\styp\s+relay(?:\s|$)/i.test(candidateLine));
    }

    #candidateAddress(candidate: any): string | undefined {
        return candidate?.address || candidate?.ip || candidate?.relayAddress;
    }

    #candidateEndpoint(candidate: any): CandidateEndpoint | undefined {
        const ip = this.#candidateAddress(candidate);
        if (!ip) {
            return undefined;
        }
        const port = Number(candidate?.port || 0);
        return {
            ip,
            port: Number.isNaN(port) ? 0 : port,
            protocol: this.#candidateProtocol(candidate)
        };
    }

    #clientEndpoint(candidate: any): CandidateEndpoint | undefined {
        if (this.#isRelayCandidate(candidate)) {
            const relatedAddress = candidate?.relatedAddress || candidate?.relatedIp;
            if (relatedAddress) {
                const relatedPort = Number(candidate?.relatedPort || 0);
                return {
                    ip: relatedAddress,
                    port: Number.isNaN(relatedPort) ? 0 : relatedPort,
                    protocol: this.#candidateProtocol(candidate)
                };
            }
        }
        return this.#candidateEndpoint(candidate);
    }

    #turnServerEndpoint(candidate: any): CandidateEndpoint | undefined {
        const url = String(candidate?.url || '');
        const match = url.match(/^(turns?):(?:[^@/?#]+@)?(\[[^\]]+]|[^:/?#]+)(?::(\d+))?(?:\?([^#]*))?/i);
        if (!match) {
            return undefined;
        }

        const scheme = match[1].toLowerCase();
        const query = match[4] || '';
        const transportMatch = query.match(/(?:^|&)transport=(tcp|udp)(?:&|$)/i);
        let protocol: 'udp' | 'tcp' = scheme === 'turns' ? 'tcp' : 'udp';
        if (String(candidate?.relayProtocol || '').toLowerCase() === 'tcp') {
            protocol = 'tcp';
        }
        if (transportMatch) {
            protocol = transportMatch[1].toLowerCase() === 'tcp' ? 'tcp' : 'udp';
        }
        const port = match[3] ? Number(match[3]) : (scheme === 'turns' ? 5349 : 3478);

        return {
            ip: match[2].replace(/^\[/, '').replace(/\]$/, ''),
            port: Number.isNaN(port) ? 0 : port,
            protocol
        };
    }

    #candidateProtocol(candidate: any): 'udp' | 'tcp' {
        return String(candidate?.protocol || '').toLowerCase() === 'tcp' ? 'tcp' : 'udp';
    }
}
