import {InternalMessage} from "../constants";

/**
 * Prefix used for logging within the metrics collector.
 */
export const LOG_PREFIX = "stats-collector -";

/**
 * Supported connection types for metrics transport.
 */
export const CONNECTION_TYPE = {
    WEBSOCKET: "ws",
    HTTP: "http"
};

/**
 * Maximum allowed number of consecutive send errors
 * before the collector stops sending metrics.
 */
export const MAX_SEND_ERRORS = 3;

/**
 * Possible connection states for metrics delivery.
 */
export const CONNECTION_STATUS = {
    INIT: 0,
    OK: 200,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500
};

/**
 * Defines whether metrics collection is enabled or disabled.
 */
export enum RTCMetricsCollect {
    on = "on",
    off = "off"
}

/**
 * Supported compression methods for metrics payloads.
 */
export enum RTCMetricsCompressionType {
    gzip = "gzip",
    none = "none",
    deflate = "deflate"
}

/**
 * Describes a specific type of metrics available for collection.
 * `metrics` defines the header string.
 * `contains` optionally restricts metrics to those reports whose fields
 * contain specific values.
 */
export interface RTCMetricsTypeDescription {
    metrics: string;
    contains?: Record<string, any[]>;
}

/**
 * Main configuration object received from the server.
 * This describes how the client should collect and send WebRTC metrics.
 *
 * - `ingestPoint`: HTTP/HTTPS endpoint for POST requests with metrics.
 * - `authorization`: value for the Authorization header for every POST request.
 * - `types`: a map describing metric types and their filtering rules.
 * - `sampling`: sampling period in milliseconds.
 * - `batchSize`: number of samples to collect before sending.
 * - `collect`: enabling or disabling metrics collection.
 * - `compression`: list of allowed compression methods for payloads.
 */
export interface RTCMetricsServerDescription {
    types?: Record<string, RTCMetricsTypeDescription>;
    sampling?: number;
    batchSize?: number;
    collect?: RTCMetricsCollect;
    ingestPoint?: string;
    authorization?: string;
    compression?: RTCMetricsCompressionType[];
}

/**
 * A message describing updates to the metrics configuration.
 */
export type RTCMetricsDescriptionUpdate = InternalMessage & {
    collect?: RTCMetricsCollect;
};

/**
 * Delimiters used for serialization of metrics and headers.
 */
export enum RTCMetricsDelimiter {
    HEADERS = ",",
    VALUES = ";"
}

/**
 * Describes one metric identifier requested from an RTCStatsReport.
 *
 * - `type`: WebRTC stats type.
 * - `id`: ID of the specific report.
 * - `name`: name of the property within the report.
 */
export type RTCStatsType = {
    type: string;
    id: string;
    name: string;
};
