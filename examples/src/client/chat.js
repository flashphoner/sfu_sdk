const createChat = function(room, messages, input, sendButton) {
    const constants = SFU.constants;
    const chatSelfColour = "green";
    const chatTextColour = "black";
    const chatOtherColour = "red";
    const chatEventColour = "navy";

    room.on(constants.SFU_ROOM_EVENT.MESSAGE, function(e) {
        appendMessage({
            userId: getUserId(e.message),
            nickName: getNickName(e.message),
            message: getMessage(e.message)
        }, chatOtherColour, chatTextColour);
    }).on(constants.SFU_ROOM_EVENT.JOINED, function(e) {
        appendMessage({
            userId: getShortUserId(e.userId),
            nickName: e.name,
            message: e.type
        }, chatOtherColour, chatEventColour);
    }).on(constants.SFU_ROOM_EVENT.LEFT, function(e) {
        appendMessage({
            userId: getShortUserId(e.userId),
            nickName: e.name,
            message: e.type
        }, chatOtherColour, chatEventColour);
    });

    const sendMessage = async function() {
        let message = input.value;
        input.value = "";
        await room.sendMessage(message);
        appendMessage({
            userId: getShortUserId(room.userId()),
            nickName: nickName.value,
            message: message
        }, chatSelfColour, chatTextColour);
    }

    sendButton.addEventListener("click", sendMessage);
    input.onkeyup = function(e) {
        if (e.keyCode === 13) {
            if (e.shiftKey) {

            } else {
                sendMessage();
            }
            return false;
        }
    }

    const appendMessage = function(msg, nickColour, msgColour) {
        let message = document.createElement('div');
        message.setAttribute("class","message");
        messages.appendChild(message);
        let nickDiv = document.createElement('div');
        nickDiv.style.color = nickColour;
        nickDiv.innerText = getChatTimestamp() + " " + msg.nickName + "#" + msg.userId + ":";
        message.appendChild(nickDiv);
        let msgDiv = document.createElement('div');
        msgDiv.style.color = msgColour;
        msgDiv.innerText = msg.message;
        message.appendChild(msgDiv);
        scrollToBottom();
    }

    const scrollToBottom = function() {
        messages.scrollTop = messages.scrollHeight;
    }

    const getChatTimestamp = function() {
        let currentdate = new Date();
        return currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds();
    }

    const getUserId = function(msgData) {
        let userId = "unknown";
        if (msgData.userId) {
            userId = msgData.userId;
        } else if (msgData.message.userId) {
            userId = msgData.message.userId;
        }
        return getShortUserId(userId);
    }

    const getNickName = function(msgData) {
        let nickName = "unknown";
        if (msgData.nickName) {
            nickName = msgData.nickName;
        } else if (msgData.message.nickName) {
            nickName = msgData.message.nickName;
        }
        return nickName;
    }

    const getMessage = function(msgData) {
        let message = "";
        if (msgData.message) {
            message = JSON.parse(msgData.message).payload;
        }
        return message;
    }
}