'use strict';

const constants = require("./constants");

const chatSelfColour = "green";
const chatTextColour = "black";
const chatOtherColour = "red";
const chatEventColour = "navy";


const createChat = function(room, messages, input, sendButton) {
    room.on(constants.ROOM_EVENT.MESSAGE, function(e) {
        appendMessage(e, chatOtherColour, chatTextColour);
    }).on(constants.ROOM_EVENT.JOINED, function(e) {
        appendMessage({
            nickName: e.name,
            message: e.type
        }, chatOtherColour, chatEventColour);
    }).on(constants.ROOM_EVENT.LEFT, function(e) {
        appendMessage({
            nickName: e.name,
            message: e.type
        }, chatOtherColour, chatEventColour);
    });

    const sendMessage = function() {
        let message = input.value;
        input.value = "";
        room.sendMessage(message);
        appendMessage({
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
        nickDiv.innerText = getChatTimestamp() + " " + msg.nickName + ":";
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
}

module.exports = {
    createChat: createChat
}