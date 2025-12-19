import {Connection} from "../connection";
import {RTCMetricsBatchMessage, RTCMetricsClientDescriptionMessage, RTCMetricsMessageType} from "./message";
import {CONNECTION_STATUS} from "./constants";


/**
 * An interface that implements sending metrics according to the protocol designed WCS-4566
 */
export interface IRTCMetricsSender {
    /**
     * Sends a signal message `webRTCMetricsClientDescription`
     * @param message {@link RTCMetricsClientDescriptionMessage}
     */
    sendDescription(message: RTCMetricsClientDescriptionMessage): Promise<number>;

    /**
     * Sends a signal message `webRTCMetricsBatch`
     * @param message {@link RTCMetricsBatchMessage}
     */
    sendBatch(message: RTCMetricsBatchMessage): Promise<number>;
}

/**
 * A class that implements {@link IRTCMetricsSender} sending signaling messages via a web socket
 */
export class RTCMetricsWebsocketSender implements IRTCMetricsSender {
    private readonly websocket: Connection;

    constructor(websocket: Connection) {
        this.websocket = websocket;
    }

    public async sendDescription(message: RTCMetricsClientDescriptionMessage): Promise<number> {
        if (!this.websocket) {
            return CONNECTION_STATUS.BAD_REQUEST;
        }
        this.websocket.send(RTCMetricsMessageType.description, message);
        return CONNECTION_STATUS.OK;
    }

    public async sendBatch(message: RTCMetricsBatchMessage): Promise<number> {
        if (!this.websocket) {
            return CONNECTION_STATUS.BAD_REQUEST;
        }
        this.websocket.send(RTCMetricsMessageType.batch, message);
        return CONNECTION_STATUS.OK;
    }
}

/**
 * A class that implements {@link IRTCMetricsSender} sending signaling messages via a HTTP/HTTPS
 */
export class RTCMetricsHttpSender implements IRTCMetricsSender {
    private readonly _url: string;
    private readonly _headers: Record<string, string>;

    constructor(url: string, headers: Record<string, string>) {
        this._url = url;
        this._headers = headers;
    }

    public async sendDescription(message: RTCMetricsClientDescriptionMessage): Promise<number> {
        return this._send(RTCMetricsMessageType.description, message);
    }

    public async sendBatch(message: RTCMetricsBatchMessage): Promise<number> {
        return this._send(RTCMetricsMessageType.batch, message);
    }

    private async _send(pathname: string, message: RTCMetricsBatchMessage | RTCMetricsClientDescriptionMessage): Promise<number> {
        if (!this._url) {
            return CONNECTION_STATUS.BAD_REQUEST;
        }
        try {
            const headers = new Headers({
                "Content-Type": "application/json",
                ...this._headers
            });

            await fetch(`${this._url}/${pathname}`, {
                method: "POST",
                mode: "cors",
                headers,
                body: JSON.stringify(message)
            });

            return CONNECTION_STATUS.OK;
        } catch {
            return CONNECTION_STATUS.INTERNAL_SERVER_ERROR;
        }
    }
}
