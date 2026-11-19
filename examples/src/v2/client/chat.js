const createChat = function (room, messages, input, sendButton, onError = function () {}) {
    const events = SFU.constants.SFU_ROOM_EVENT;
    let active = true;
    let sending = false;

    const appendMessage = function (nickname, userId, text, kind) {
        if (!active) return;
        const message = document.createElement("div");
        message.className = "message " + kind;
        const author = document.createElement("div");
        author.className = "message-author";
        author.textContent = new Date().toLocaleTimeString() + " " + (nickname || "unknown") + "#" + getShortUserId(userId || "unknown");
        const body = document.createElement("div");
        body.textContent = text == null ? "" : String(text);
        message.append(author, body);
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
    };

    room.on(events.MESSAGE, function (event) {
        if (!active) return;
        try {
            const data = event.message || {};
            const payload = typeof data.message === "string" ? JSON.parse(data.message) : data.message || {};
            appendMessage(data.nickName || payload.nickName, data.userId || payload.userId,
                payload.payload == null ? "" : payload.payload, "message-remote");
        } catch (error) {
            onError("Unable to read the received chat message: " + error.message);
        }
    }).on(events.JOINED, function (event) {
        appendMessage(event.name, event.userId, event.type, "message-event");
    }).on(events.LEFT, function (event) {
        appendMessage(event.name, event.userId, event.type, "message-event");
    });

    const sendMessage = async function (event) {
        if (event) event.preventDefault();
        if (!active || sending || !input.value.trim()) return;
        const text = input.value;
        sending = true;
        sendButton.disabled = true;
        try {
            await room.sendMessage(text);
            if (active) {
                if (input.value === text) input.value = "";
                appendMessage(document.getElementById("nickName").value, room.userId(), text, "message-self");
            }
        } catch (error) {
            if (active) onError("Unable to send the chat message: " + (error.message || String(error)));
        } finally {
            sending = false;
            if (active) sendButton.disabled = false;
        }
    };
    const onKeyDown = function (event) {
        if (event.key === "Enter" && !event.shiftKey) sendMessage(event);
    };
    sendButton.addEventListener("click", sendMessage);
    input.addEventListener("keydown", onKeyDown);
    return function () {
        active = false;
        sendButton.removeEventListener("click", sendMessage);
        input.removeEventListener("keydown", onKeyDown);
    };
};
