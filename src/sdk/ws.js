"use strict";

function createConnection() {
    let wsConnection;
    let exports = {};
    exports.onError = function(e){};
    exports.onClose = function(e){};
    exports.onMessage = function(name, body){};
    /**
     * @param {Object} options Connection options
     * @param {String=} options.url Server url
     * @param {String=} options.appName Application name
     * @param {Number=} options.timeout Connection timeout
     * @param {Object=} options.custom Custom object
     * @returns Promise
     * @throws {TypeError} Error if no options provided
     * @memberof FSFU
     * @inner
     */
    exports.connect = function(options) {
        return new Promise(function(resolve, reject) {
            let connected = false;
            wsConnection = new WebSocket(options.url);
            let connectionTimeout;
            if (options.timeout !== undefined && options.timeout > 0) {
                connectionTimeout = setTimeout(function () {
                    if (wsConnection.readyState === 0) {
                        console.log("WS connection timeout");
                        wsConnection.close();
                    }
                }, options.timeout);
            }
            wsConnection.onerror = function (e) {
                if (connected) {
                    exports.onError(e);
                } else {
                    reject(e);
                }
            };
            wsConnection.onclose = function (e) {
                if (connected) {
                    exports.onClose(e);
                } else {
                    reject(e);
                }
            };
            wsConnection.onopen = function () {
                connected = true;
                clearTimeout(connectionTimeout);
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
                send("connection", cConfig);
            };
            wsConnection.onmessage = function (event) {
                let name;
                let msg;
                if (event.data instanceof Blob) {
                    name = "binaryData";
                } else {
                    let obj = JSON.parse(event.data);
                    name = obj.message;
                    msg = obj.data;
                }
                switch (name) {
                    case "ping":
                        send("pong", null);
                        break;
                    case "getUserData":
                        resolve(msg);
                        break;
                    default:
                        exports.onMessage(name, msg);
                }
            };
        });
    };

    const send = function(message, data) {
        if (wsConnection) {
            wsConnection.send(JSON.stringify({
                message: message,
                data: [data]
            }));
        }
    };

    exports.send = send;

    const close = function() {
        if (wsConnection) {
            wsConnection.close();
        }
    };
    exports.close = close;
    return exports;
}

module.exports = {
    createConnection: createConnection
};