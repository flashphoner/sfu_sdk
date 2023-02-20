import Logger, {Verbosity} from "./logger";
import {
    InternalApi,
    InternalMessage,
    SfuEvent,
    ConnectionFailedEvent,
    WS_PING_INTERVAL_MS,
    WS_PINGS_MISSING_THRESHOLD,
    WS_CONNECTION_TIMEOUT
} from "./constants";

type InitialUserData = {
    sipLogin: string,
    email: string,
    sipVisibleName: string,
    pmi: string
}

type OnMessageCallback = (arg0: string, arg1: Array<InternalMessage>) => void;

type OnBinaryDataCallback = (arg0: string, arg1: ArrayBuffer) => void;

class WSPingReceiver {
    private failedProbesThreshold: number;
    private interval: number;
    private checkInterval: number;
    private pingsMissing: number;
    private connection: Connection;
    private logger: Logger;

    public constructor(failedProbesThreshold: number, interval: number, connection: Connection, logger?: Logger) {
        this.failedProbesThreshold = failedProbesThreshold;
        this.pingsMissing = 0;
        this.interval = interval;
        this.connection = connection;
        this.logger = (logger) ? logger : new Logger();
        if (!logger) {
            this.logger.setPrefix(() => "[WSPingReceiver]");
            this.logger.setVerbosity(Verbosity.INFO);
        }
    }

    public start() {
        if (this.failedProbesThreshold > 0 && this.interval > 0) {
            const receiver = this;
            this.checkInterval = window.setInterval(function() {
                receiver.checkPingsReceived();
            }, this.interval);
        }
    }

    public stop() {
        if (this.checkInterval) {
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
            this.failure();
        }
    }

    private async failure() {
        let info: string;
        info = "Missing " + this.pingsMissing + " pings from server, connection seems to be down";
        this.logger.warn(info);
        await this.connection.close({
            type: SfuEvent.CONNECTION_FAILED,
            info: info
        } as ConnectionFailedEvent);
    }
}

export class Connection {
    private ws: WebSocket;
    private onError: Function;
    private onClose: Function;
    private onMessage: OnMessageCallback;
    private onBinaryData: OnBinaryDataCallback;
    private connected: boolean;
    private connectionTimeout: number;
    private logger: Logger;
    private pingChecker: WSPingReceiver;

    public constructor(onMessage: OnMessageCallback, onBinaryData: OnBinaryDataCallback, onError: Function, onClose: Function, logger?: Logger) {
        this.connected = false;
        this.onMessage = onMessage;
        this.onBinaryData = onBinaryData;
        this.onError = onError;
        this.onClose = onClose;
        this.logger = (logger) ? logger : new Logger();
        if (!logger) {
            this.logger.setPrefix(() => "[Connection]");
            this.logger.setVerbosity(Verbosity.INFO);
        }
        this.pingChecker = null;
    }
    
    public connect(options: {
        url: string,
        appName: string,
        timeout?: number,
        failedProbesThreshold?: number,
        pingInterval?: number,
        custom: object | null
    }): Promise<InitialUserData> {
        const timeout = options.timeout !== undefined ? options.timeout : WS_CONNECTION_TIMEOUT;
        const failedProbesThreshold = options.failedProbesThreshold !== undefined ? options.failedProbesThreshold : WS_PINGS_MISSING_THRESHOLD;
        const pingInterval = options.pingInterval !== undefined ? options.pingInterval : WS_PING_INTERVAL_MS;
        this.ws = new WebSocket(options.url);
        this.ws.binaryType = 'arraybuffer';
        const that = this;
        return new Promise(function(resolve, reject) {
            if (that.ws.readyState === 3) {
                reject("Can't connect to websocket URL "+ options.url);
            }
            if (timeout > 0) {
                that.connectionTimeout = window.setInterval(function () {
                    if (that.ws.readyState === 0) {
                        that.logger.warn("WS connection timeout");
                        that.ws.close();
                    }
                }, timeout);
            }
            that.ws.onerror = function (e) {
                if (that.connected) {
                    that.onError(e);
                } else {
                    reject(e);
                }
            };
            that.ws.onclose = function (e) {
                that.logger.debug("WebSocket connection closed, reason " + e.reason);
                if (that.connected) {
                    that.onClose(e);
                } else {
                    reject(e);
                }
            };
            that.ws.onopen = function () {
                clearInterval(that.connectionTimeout);
                let cConfig = {
                    appKey: options.appName,
                    mediaProviders: ["WebRTC"],
                    keepAlive: true,
                    authToken: null,
                    clientVersion: "0.5.28",
                    clientOSVersion: window.navigator.appVersion,
                    clientBrowserVersion: window.navigator.userAgent,
                    custom: options.custom
                };
                // Enable intervalic ping checking if ping options are set
                if (failedProbesThreshold > 0 && pingInterval > 0) {
                    that.pingChecker = new WSPingReceiver(failedProbesThreshold, pingInterval, that, that.logger);
                    that.pingChecker.start();
                }
                //connect to REST App
                that.send("connection", cConfig);
            };
            that.ws.onmessage = function (event: MessageEvent<ArrayBuffer | string>) {
                let name: string;
                let msg: Array<InternalMessage>;
                if (event.data instanceof ArrayBuffer) {
                    name = InternalApi.BINARY_DATA;
                } else {
                    let obj = JSON.parse(event.data) as {
                        message: string,
                        data: Array<InternalMessage>
                    };
                    name = obj.message;
                    msg = obj.data;
                }
                switch (name) {
                    case "ping":
                        that.send("pong", null);
                        if (that.pingChecker) {
                            that.pingChecker.success();
                        }
                        break;
                    case "getUserData":
                        that.connected = true;
                        resolve(msg[0] as unknown as InitialUserData);
                        break;
                    case "binaryData":
                        that.onBinaryData(name, event.data as ArrayBuffer);
                        break;
                    default:
                        that.onMessage(name, msg);
                }
            };
        });
    }

    public send(message: string, data: any) {
        this.logger.info("==>", message, data);
        if (this.ws) {
            this.ws.send(JSON.stringify({
                message: message,
                data: [data]
            }));
        }
    };

    public sendBinaryData(data: any) {
        this.logger.info("==>", data.size);
        if (this.ws) {
            this.ws.send(data);
        }

    }

    public async close(error?: ConnectionFailedEvent) {
        if (this.ws) {
            // Stop pings checking if enabled
            if (this.pingChecker) {
                this.pingChecker.stop();
            }
            // Close websocket connection
            const self = this;
            return new Promise<void>(function (resolve) {
                self.ws.onclose = function (e) {
                    self.logger.debug("WebSocket connection closed, reason " + e.reason);
                    if (self.connected) {
                        if (error) {
                            self.onError(error);
                        } else {
                            self.onClose(e);
                        }
                    }
                    resolve();
                }
                self.ws.close();
            });
        }
    }
}
