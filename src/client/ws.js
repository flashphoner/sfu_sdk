'use strict';

function createConnection() {
    let wsConnection;
    let exports = {};
    exports.onError = function(e){};
    exports.onClose = function(e){};
    exports.onMessage = function(name, body){};
    exports.connect = function(url, name, pin, nickName, timeout) {
        return new Promise(function(resolve, reject) {
            let connected = false;
            wsConnection = new WebSocket(url);
            let connectionTimeout;
            if (timeout !== undefined && timeout > 0) {
                connectionTimeout = setTimeout(function () {
                    if (wsConnection.readyState == 0) {
                        console.log("WS connection timeout");
                        wsConnection.close();
                    }
                }, timeout);
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
                clearTimeout(connectionTimeout);
                let cConfig = {
                    appKey: "sfuApp",
                    mediaProviders: ["WebRTC"],
                    keepAlive: true,
                    authToken: null,
                    clientVersion: "0.5.28",
                    clientOSVersion: window.navigator.appVersion,
                    clientBrowserVersion: window.navigator.userAgent,
                    custom: {
                        roomName: name,
                        pin: pin,
                        nickName: nickName
                    }
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
                    case 'ping':
                        send("pong", null);
                        break;
                    case 'getUserData':
                        resolve();
                        break;
                    default:
                        exports.onMessage(name, msg);
                }
            };
        });
    }

    const send = function(message, data) {
        if (wsConnection) {
            wsConnection.send(JSON.stringify({
                message: message,
                data: [data]
            }));
        }
    }

    exports.send = send;
    return exports;
}

module.exports = {
    createConnection: createConnection
}