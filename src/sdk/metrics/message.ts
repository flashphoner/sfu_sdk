/**
 * Types of signaling message described WCS-4566
 */
export enum RTCMetricsMessageType {
    description = "webRTCMetricsClientDescription",
    batch = "webRTCMetricsBatch"
}

/**
 * This message describes which metrics and in what order the client will send for a given media session.
 */
export type RTCMetricsClientDescriptionMessage = {
    mediaSessionId: string,
    compression: string,
    headers: string
}

/**
 * This message contains a batch of metrics in the quantity requested from the server and in the order in which the client
 * declared them from the message {@link RTCMetricsClientDescriptionMessage} for a specific media session.
 * */
export type RTCMetricsBatchMessage = {
    mediaSessionId: string,
    metrics: string
}