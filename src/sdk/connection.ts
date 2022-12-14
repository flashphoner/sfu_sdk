import {InternalApi, InternalMessage} from "./constants";
import Logger, {Verbosity} from "./logger";

type InitialUserData = {
    sipLogin: string,
    sipVisibleName: string,
    pmi: string
}

type OnMessageCallback = (arg0: string, arg1: Array<InternalMessage>) => void;

type OnBinaryDataCallback = (arg0: string, arg1: ArrayBuffer) => void;

export class Connection {
    private ws: WebSocket;
    private onError: Function;
    private onClose: Function;
    private onMessage: OnMessageCallback;
    private onBinaryData: OnBinaryDataCallback;
    private connected: boolean;
    private connectionTimeout: number;
    private logger: Logger;

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
    }

    public connect(options: {
        url: string,
        appName: string,
        timeout: number,
        custom: object | null
    }): Promise<InitialUserData> {
        this.ws = new WebSocket(options.url);
        this.ws.binaryType = 'arraybuffer';
        const that = this;
        return new Promise(function(resolve, reject) {
            if (options.timeout !== undefined && options.timeout > 0) {
                that.connectionTimeout = window.setTimeout(function () {
                    if (that.ws.readyState === 0) {
                        that.logger.warn("WS connection timeout");
                        that.ws.close();
                    }
                }, options.timeout);
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
                clearTimeout(that.connectionTimeout);
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
                //connect to REST App
                that.send("connection", cConfig);
            };
            that.ws.onmessage = function (event: MessageEvent<ArrayBuffer | string>) {
                let name;
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

    public async close() {
        if (this.ws) {
            const self = this;
            return new Promise<void>(function (resolve) {
                self.ws.onclose = function (e) {
                    self.logger.debug("WebSocket connection closed, reason " + e.reason);
                    if (self.connected) {
                        self.onClose(e);
                    }
                    resolve();
                }
                self.ws.close();
            });
        }
    }
}