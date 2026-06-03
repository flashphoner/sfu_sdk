import {LocalTrafficMonitor} from "../../src/sdk/local-traffic";

function createStatsReport(reports: any[]): RTCStatsReport {
    return {
        forEach: (callback: (report: any) => void) => reports.forEach(callback)
    } as unknown as RTCStatsReport;
}

function createPeerConnection(reports: any[]): RTCPeerConnection {
    return {
        connectionState: "connected",
        getStats: jest.fn().mockResolvedValue(createStatsReport(reports))
    } as unknown as RTCPeerConnection;
}

function baseReports(extraReports: any[]): any[] {
    return [
        {
            id: "pair",
            type: "candidate-pair",
            selected: true,
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
            currentRoundTripTime: 0.001
        },
        {
            id: "local",
            type: "local-candidate",
            address: "192.168.0.234",
            port: 50000,
            protocol: "udp",
            candidateType: "host"
        },
        {
            id: "remote",
            type: "remote-candidate",
            address: "192.168.0.234",
            port: 31016,
            protocol: "udp",
            candidateType: "host"
        },
        ...extraReports
    ];
}

describe("LocalTrafficMonitor", () => {
    it("should use fractionLost when remote inbound packetsReceived is not available", async () => {
        const monitor = new LocalTrafficMonitor(createPeerConnection(baseReports([
            {
                id: "outbound-video",
                type: "outbound-rtp",
                isRemote: false,
                bytesSent: 10000
            },
            {
                id: "remote-inbound-video",
                type: "remote-inbound-rtp",
                packetsLost: 10,
                fractionLost: 0.1
            }
        ])));

        const traffic = await monitor.getTraffic();

        expect(traffic.outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].status).toEqual("yellow");
    });

    it("should use outbound packetsSent as denominator when remote inbound packetsReceived is not available", async () => {
        const monitor = new LocalTrafficMonitor(createPeerConnection(baseReports([
            {
                id: "outbound-video",
                type: "outbound-rtp",
                isRemote: false,
                bytesSent: 10000,
                packetsSent: 100
            },
            {
                id: "remote-inbound-video",
                type: "remote-inbound-rtp",
                packetsLost: 10
            }
        ])));

        const traffic = await monitor.getTraffic();

        expect(traffic.outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].status).toEqual("yellow");
    });

    it("should use fractionLost when packetsLost is not available", async () => {
        const monitor = new LocalTrafficMonitor(createPeerConnection(baseReports([
            {
                id: "outbound-video",
                type: "outbound-rtp",
                isRemote: false,
                bytesSent: 10000
            },
            {
                id: "remote-inbound-video",
                type: "remote-inbound-rtp",
                fractionLost: 0.1
            }
        ])));

        const traffic = await monitor.getTraffic();

        expect(traffic.outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].outboundPacketLossPercent).toEqual(10);
        expect(traffic.badges.links[0].status).toEqual("yellow");
    });
});
