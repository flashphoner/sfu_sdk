const { v4: uuidv4 } = require("uuid");

const create = function(options) {
    const connection = options.connection;
    const pendingMessages = {};

    /*
     * @param {String} msg.to Recipient's id
     * @param {String} msg.body Message body
     */
    const sendMessage = function(msg) {
        return new Promise(function(resolve, reject) {
            const message = {
                id: uuidv4(),
                to: msg.to,
                body: msg.body
            };
            connection.send("sendMessage", message);
            pendingMessages[message.id] = {
                resolve: resolve,
                reject: reject
            };
        });
    };

    const onMessageState = function(msg) {
        const promise = pendingMessages[msg[0].status.id];
        if (promise) {
            delete pendingMessages[msg[0].status.id];
            if (msg[0].status.delivered) {
                promise.resolve();
            } else {
                promise.reject();
            }
        }
    };

    return {
        sendMessage: sendMessage,
        onMessageState: onMessageState
    };

};


module.exports = {
    create: create
};