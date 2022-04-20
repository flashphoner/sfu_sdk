import * as fs from "fs";
import * as path from "path";
import {v4 as uuidv4} from 'uuid';
import {ChannelSendPolicy, ChannelType, MessageAttachmentType} from "../../src/sdk/constants";
export const url = "ws://127.0.0.1:8080/";
export const TEST_USER_0 = {
    username: "bob@flashphoner.com",
    password: "123456",
    nickname: "bob"
}
export const TEST_USER_1 = {
    username: "alice@flashphoner.com",
    password: "123456",
    nickname: "alice"
}
export const TEST_USER_2 = {
    username: "kiri@flashphoner.com",
    password: "123456",
    nickname: "kiri"
}

export const TEST_EMAIL_INVITE = "john@flashphoner.com";

export const TEST_GROUP_USER0 = {
    nickname: "bob",
    logGroup: "test"
}

export const TEST_GROUP_USER1 = {
    nickname: "alice",
    logGroup: "test"
}

export const TEST_GROUP_USER2 = {
    nickname: "kiri",
    logGroup: "test"
}

export const TEST_ROOM = {
    name: "test",
    pin: "1234"
}

export const CALENDAR_EVENT = {
    id: uuidv4(),
    title: "test",
    description: "test",
    start: Date.now(),
    end: Date.now() + 10000,
    recurring: false,
    accessCode: "",
    waitingRoom: true,
    usePMI: true,
    ownerVideo: false,
    participantVideo: false
}

export const FILE_PATH = "../resources/1.jpeg"

export const TEST_PUBLIC_CHANNEL = {
    channel: true,
    name: "test_public_channel",
    channelType: ChannelType.PUBLIC,
    channelSendPolicy: ChannelSendPolicy.EVERYONE
}

export const TEST_PRIVATE_CHANNEL = {
    channel: true,
    name: "test_private_channel",
    channelType: ChannelType.PRIVATE,
    channelSendPolicy: ChannelSendPolicy.EVERYONE
}

export const TEST_MESSAGE_ROOM = "Room test message";

export const TEST_MESSAGE_ATTACHMENT = {
    type: MessageAttachmentType.picture,
    name: FILE_PATH,
    payload: Buffer.from(fs.readFileSync(path.resolve(__dirname, FILE_PATH))).toString('base64'),
    size: fs.readFileSync(path.resolve(__dirname, FILE_PATH)).length
}