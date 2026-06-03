import {
    evaluateConnectionQuality,
    evaluatePacketLossQuality
} from "../../src/sdk/connection-quality";

describe("connection quality", () => {
    it.each([
        [0, undefined],
        [0.5, "green"],
        [2, "green"],
        [2.1, "yellow"],
        [10, "yellow"],
        [10.1, "orange"],
        [50, "orange"],
        [50.1, "red"],
        [100, "red"]
    ])("should resolve %s%% packet loss as %s", (packetLossPercent, expectedStatus) => {
        expect(evaluatePacketLossQuality(packetLossPercent)).toEqual(expectedStatus);
    });

    it("should not downgrade audio-only traffic by low bitrate", () => {
        const result = evaluateConnectionQuality({
            connected: true,
            outboundBitrate: 7000,
            expectedOutboundTraffic: true,
            packetLossPercent: 0
        });

        expect(result.status).toEqual("green");
        expect(result.reasons).toEqual([]);
    });

    it("should use the worst packet loss direction", () => {
        const result = evaluateConnectionQuality({
            connected: true,
            inboundPacketLossPercent: 1,
            outboundPacketLossPercent: 12
        });

        expect(result.status).toEqual("orange");
        expect(result.reasons).toContain("outbound-packet-loss");
    });

    it("should keep disconnected state red", () => {
        expect(evaluateConnectionQuality({
            connected: false,
            packetLossPercent: 0
        }).status).toEqual("red");
    });
});
