import {RTCMetricsBatch} from "./batch";
import {RTCMetricsCompressionType} from "./constants";
import {gzip} from "pako";

export interface IRTCMetricsCompressor {
    /**
     * Accepts a filled metrics batch and returns a serialized payload,
     * optionally applying compression.
     */
    compress(batch: RTCMetricsBatch): string;

    /**
     * Compression type identifier so the receiver knows
     * how to decode the payload.
     */
    get type(): RTCMetricsCompressionType;
}

export class NoneRTCMetricsCompressor implements IRTCMetricsCompressor {

    /**
     * Produces a plain JSON string from the batch
     * without any compression applied.
     */
    public compress(batch: RTCMetricsBatch): string {
        return JSON.stringify(batch.flat());
    }

    get type(): RTCMetricsCompressionType {
        return RTCMetricsCompressionType.none;
    }
}

export class GzipRTCMetricsCompressor implements IRTCMetricsCompressor {

    /**
     * Compresses the flattened batch with gzip (via pako),
     * then converts the resulting binary data to a base64 string.
     *
     * Flow:
     * 1. Flatten batch (batched metrics stored as arrays)
     * 2. Convert JSON → UTF-8 bytes
     * 3. Apply gzip
     * 4. Convert compressed Uint8Array → binary string → base64
     */
    public compress(batch: RTCMetricsBatch): string {
        const utf8 = new TextEncoder().encode(JSON.stringify(batch.flat()));
        const gzipped = gzip(utf8);
        return btoa(String.fromCharCode(...gzipped));
    }

    get type(): RTCMetricsCompressionType {
        return RTCMetricsCompressionType.gzip;
    }
}
