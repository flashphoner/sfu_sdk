import Logger, {Verbosity} from "./logger";
import {
    ConnectionFailedEvent,
    InternalApi,
    InternalMessage,
    SfuEvent,
    WS_CONNECTION_TIMEOUT,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD
} from "./constants";
import {
    IRTCMetricsSender,
    RTCMetricsBatchMessage,
    RTCMetricsClientDescriptionMessage,
    RTCMetricsMessageType,
    RTCMetricsServerDescription
} from "@flashphoner/web-sdk-metrics"

export type InitialUserData = {
    sipLogin: string,
    email: string,
    sipVisibleName: string,
    authToken: string,
    pmi: string,
    webRTCMetricsServerDescription: RTCMetricsServerDescription
}

type OnMessageCallback = (name: string, data: Array<InternalMessage>) => void;

type OnBinaryDataCallback = (name: string, data: ArrayBuffer) => void;

type OnErrorCallback = (error: Event | ConnectionFailedEvent) => void;

type OnCloseCallback = (event: CloseEvent) => void;

type ConnectOptions = {
    url: string,
    appName: string,
    timeout?: number,
    failedProbesThreshold?: number,
    pingInterval?: number,
    authToken?: string,
    custom: object | null
};

class WSPingReceiver {
    private readonly failedProbesThreshold: number;
    private readonly interval: number;
    private readonly onMissed: (pingsMissing: number) => void;
    private checkInterval: number | null = null;
    private pingsMissing = 0;

    public constructor(failedProbesThreshold: number, interval: number, onMissed: (pingsMissing: number) => void) {
        this.failedProbesThreshold = failedProbesThreshold;
        this.interval = interval;
        this.onMissed = onMissed;
    }

    public start() {
        this.checkInterval = window.setInterval(() => this.checkPingsReceived(), this.interval);
    }

    public stop() {
        if (this.checkInterval !== null) {
            window.clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    public success() {
        this.pingsMissing = 0;
    }

    private checkPingsReceived() {
        this.pingsMissing++;
        if (this.pingsMissing >= this.failedProbesThreshold) {
            this.onMissed(this.pingsMissing);
        }
    }
}

export class Connection implements IRTCMetricsSender {
    private ws: WebSocket | null = null;
    private readonly onError: OnErrorCallback;
    private readonly onClose: OnCloseCallback;
    private readonly onMessage: OnMessageCallback;
    private readonly onBinaryData: OnBinaryDataCallback;
    private connected = false;
    private connectionTimeout: number | null = null;
    private readonly logger: Logger;
    private pingChecker: WSPingReceiver | null = null;
    private closeError: ConnectionFailedEvent | null = null;
    private closeWaiters: Array<() => void> = [];

    public constructor(onMessage: OnMessageCallback, onBinaryData: OnBinaryDataCallback, onError: OnErrorCallback, onClose: OnCloseCallback, logger?: Logger) {
        this.onMessage = onMessage;
        this.onBinaryData = onBinaryData;
        this.onError = onError;
        this.onClose = onClose;
        this.logger = logger ?? new Logger();
        if (!logger) {
            this.logger.setPrefix(() => "[Connection]");
            this.logger.setVerbosity(Verbosity.INFO);
        }
    }

    public sendDescription(message: RTCMetricsClientDescriptionMessage): Promise<number> {
        return this.sendMetrics(RTCMetricsMessageType.description, message);
    }

    public sendBatch(message: RTCMetricsBatchMessage): Promise<number> {
        return this.sendMetrics(RTCMetricsMessageType.batch, message);
    }

    public connect({
        url,
        appName,
        timeout = WS_CONNECTION_TIMEOUT,
        failedProbesThreshold = WS_PINGS_MISSING_THRESHOLD,
        pingInterval = WS_PING_INTERVAL_MS,
        authToken,
        custom
    }: ConnectOptions): Promise<InitialUserData> {
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        return new Promise((resolve, reject) => {
            if (timeout > 0) {
                this.connectionTimeout = window.setTimeout(() => {
                    this.logger.warn("WS connection timeout");
                    ws.close();
                }, timeout);
            }
            ws.onerror = (event) => this.end(() => this.onError(event), () => reject(event));
            ws.onclose = (event) => {
                this.logger.debug("WebSocket connection closed, reason " + event.reason);
                const error = this.closeError;
                this.closeError = null;
                try {
                    this.end(error ? () => this.onError(error) : () => this.onClose(event), () => reject(error ?? event));
                } finally {
                    this.closeWaiters.splice(0).forEach((resolveClose) => resolveClose());
                }
            };
            ws.onopen = () => {
                this.stopConnectionTimeout();
                if (failedProbesThreshold > 0 && pingInterval > 0) {
                    this.pingChecker = new WSPingReceiver(failedProbesThreshold, pingInterval, (pingsMissing) => this.onPingsMissed(pingsMissing));
                    this.pingChecker.start();
                }
                this.send("connection", {
                    appKey: appName,
                    mediaProviders: ["WebRTC"],
                    keepAlive: true,
                    authToken: authToken ?? null,
                    clientVersion: "0.5.28",
                    clientOSVersion: window.navigator.appVersion,
                    clientBrowserVersion: window.navigator.userAgent,
                    custom
                });
            };
            ws.onmessage = (event: MessageEvent<ArrayBuffer | string>) => this.receive(event, resolve);
        });
    }

    public send(message: string, data: any) {
        this.logger.info("==>", message, data);
        this.ws?.send(JSON.stringify({
            message: message,
            data: [data]
        }));
    };

    public sendBinaryData(data: any) {
        this.logger.info("==>", data.size);
        this.ws?.send(data);
    }

    public close(error?: ConnectionFailedEvent): Promise<void> {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            return Promise.resolve();
        }
        this.stopPingChecking();
        this.closeError = error ?? null;
        return new Promise<void>((resolve) => {
            this.closeWaiters.push(resolve);
            this.ws.close();
        });
    }

    private end(report: () => void, failAttempt: () => void) {
        this.stopConnectionTimeout();
        this.stopPingChecking();
        if (this.connected) {
            report();
        } else {
            failAttempt();
        }
        this.connected = false;
    }

    private receive(event: MessageEvent<ArrayBuffer | string>, resolveConnect: (userData: InitialUserData) => void) {
        if (event.data instanceof ArrayBuffer) {
            this.onBinaryData(InternalApi.BINARY_DATA, event.data);
        } else {
            this.receiveMessage(event.data, resolveConnect);
        }
        this.pingChecker?.success();
    }

    private receiveMessage(raw: string, resolveConnect: (userData: InitialUserData) => void) {
        const {message, type, data} = JSON.parse(raw) as {
            message?: string,
            type?: string,
            data: Array<InternalMessage>
        };
        const name = message || (type === InternalApi.TRAFFIC_UPDATE ? type : undefined);
        switch (name) {
            case "ping":
                this.send("pong", null);
                break;
            case "getUserData":
                this.connected = true;
                resolveConnect(data[0] as unknown as InitialUserData);
                break;
            default:
                this.onMessage(name, data);
        }
    }

    private onPingsMissed(pingsMissing: number) {
        const reason = "Missing " + pingsMissing + " pings from server, connection seems to be down";
        this.logger.warn(reason);
        this.close({
            type: SfuEvent.CONNECTION_FAILED,
            reason
        } as ConnectionFailedEvent);
    }

    private async sendMetrics(type: RTCMetricsMessageType, message: RTCMetricsClientDescriptionMessage | RTCMetricsBatchMessage): Promise<number> {
        if (!this.ws) {
            throw new Error("Connection closed");
        }
        this.send(type, message);
        return 200;
    }

    private stopConnectionTimeout() {
        if (this.connectionTimeout !== null) {
            window.clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    private stopPingChecking() {
        if (this.pingChecker) {
            this.pingChecker.stop();
            this.pingChecker = null;
        }
    }
}
