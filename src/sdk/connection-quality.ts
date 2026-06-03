export type ConnectionQualityStatus = "green" | "yellow" | "orange" | "red";

export type ConnectionQualityMetrics = {
    connected?: boolean;
    status?: ConnectionQualityStatus | string;
    ping?: number;
    inboundBitrate?: number;
    outboundBitrate?: number;
    packetLossPercent?: number;
    inboundPacketLossPercent?: number;
    outboundPacketLossPercent?: number;
    expectedTraffic?: boolean;
    expectedInboundTraffic?: boolean;
    expectedOutboundTraffic?: boolean;
};

export type ConnectionQualityPolicy = {
    pingWarningMs: number;
    pingCriticalMs: number;
    packetLossGreenMaxPercent?: number;
    packetLossYellowMaxPercent?: number;
    packetLossOrangeMaxPercent?: number;
};

export type ConnectionQualityResult = {
    status: ConnectionQualityStatus;
    reasons: string[];
};

export const DEFAULT_CONNECTION_QUALITY_POLICY: ConnectionQualityPolicy = {
    pingWarningMs: 150,
    pingCriticalMs: 300,
    packetLossGreenMaxPercent: 2,
    packetLossYellowMaxPercent: 10,
    packetLossOrangeMaxPercent: 50
};

const STATUS_PRIORITY: Record<ConnectionQualityStatus, number> = {
    green: 0,
    yellow: 1,
    orange: 2,
    red: 3
};

export function evaluateConnectionQuality(
    metrics: ConnectionQualityMetrics,
    policy: ConnectionQualityPolicy = DEFAULT_CONNECTION_QUALITY_POLICY
): ConnectionQualityResult {
    const reasons: string[] = [];
    let status = normalizeStatus(metrics.status);

    if (metrics.connected === false) {
        reasons.push("disconnected");
        status = worstStatus(status, "red");
    }

    const ping = normalizeMetric(metrics.ping);
    if (ping !== undefined) {
        if (ping >= policy.pingCriticalMs) {
            reasons.push("critical-ping");
            status = worstStatus(status, "red");
        } else if (ping >= policy.pingWarningMs) {
            reasons.push("high-ping");
            status = worstStatus(status, "yellow");
        }
    }

    const inboundPacketLoss = metrics.inboundPacketLossPercent ?? metrics.packetLossPercent;
    const outboundPacketLoss = metrics.outboundPacketLossPercent ?? metrics.packetLossPercent;
    const inboundStatus = evaluatePacketLossQuality(inboundPacketLoss, policy);
    if (inboundStatus) {
        if (inboundStatus !== "green") {
            reasons.push("inbound-packet-loss");
        }
        status = worstStatus(status, inboundStatus);
    }
    const outboundStatus = evaluatePacketLossQuality(outboundPacketLoss, policy);
    if (outboundStatus) {
        if (outboundStatus !== "green") {
            reasons.push("outbound-packet-loss");
        }
        status = worstStatus(status, outboundStatus);
    }

    return {status, reasons};
}

function normalizeStatus(status?: ConnectionQualityStatus | string): ConnectionQualityStatus {
    if (typeof status !== "string") {
        return "green";
    }
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "yellow" || normalizedStatus === "orange" || normalizedStatus === "red") {
        return normalizedStatus;
    }
    return "green";
}

function normalizeMetric(value?: number): number | undefined {
    return typeof value === "number" && !Number.isNaN(value) && value >= 0 ? value : undefined;
}

export function evaluatePacketLossQuality(
    packetLossPercent: number | undefined,
    policy: ConnectionQualityPolicy = DEFAULT_CONNECTION_QUALITY_POLICY
): ConnectionQualityStatus | undefined {
    const normalizedPacketLoss = normalizeMetric(packetLossPercent);
    if (normalizedPacketLoss === undefined || normalizedPacketLoss <= 0) {
        return undefined;
    }
    const greenMax = policy.packetLossGreenMaxPercent ?? DEFAULT_CONNECTION_QUALITY_POLICY.packetLossGreenMaxPercent as number;
    const yellowMax = policy.packetLossYellowMaxPercent ?? DEFAULT_CONNECTION_QUALITY_POLICY.packetLossYellowMaxPercent as number;
    const orangeMax = policy.packetLossOrangeMaxPercent ?? DEFAULT_CONNECTION_QUALITY_POLICY.packetLossOrangeMaxPercent as number;
    if (normalizedPacketLoss <= greenMax) {
        return "green";
    }
    if (normalizedPacketLoss <= yellowMax) {
        return "yellow";
    }
    if (normalizedPacketLoss <= orangeMax) {
        return "orange";
    }
    return "red";
}

function worstStatus(left: ConnectionQualityStatus, right: ConnectionQualityStatus): ConnectionQualityStatus {
    return STATUS_PRIORITY[right] > STATUS_PRIORITY[left] ? right : left;
}
