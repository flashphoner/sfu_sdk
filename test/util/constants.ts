import * as fs from "fs";
import * as path from "path";
import {ChannelSendPolicy, ChatType, MessageAttachmentType} from "../../src/sdk/constants";
export const url = "ws://127.0.0.1:8080/";
export const wrongWsUrl = "ws://127.0.0.1:8081/";
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

export const ALL_TAG = "<@all>";
export const EVERYONE_TAG = "<@everyone>";
export const TEST_USER_0_TAG = `<@${TEST_USER_0.username}>`;
export const TEST_USER_1_TAG = `<@${TEST_USER_1.username}>`;

export const TEST_USER_2 = {
    username: "kiri@flashphoner.com",
    password: "123456",
    nickname: "kiri"
}

export const TEST_SIGN_UP_USER_1 = {
    email: "testovbob@gmail.com",
    password: "123456"
}

export const TEST_SIGN_UP_USER_2 = {
    email: "bot@flashphoner.com",
    password: "123456"
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

export const PINLESS_TEST_ROOM = {
    name: "pinless_test",
    id: "pinless_test"
}
export const MEETING_NICKNAME = "Custom Nickname";

export const CALENDAR_EVENT = {
    title: "test",
    description: "test",
    start: Date.now() + 10000,
    end: Date.now() + 20000,
    recurring: false,
    accessCode: "123456",
    waitingRoom: true,
    usePMI: true,
    ownerVideo: false,
    participantVideo: false,
    allowJoinAtAnyTime: false,
    useMuteAudioOnJoin: false,
    useLocalAutoRecord: false
}

export const PDF_FILE_NAME = "sample.pdf";
export const PICTURE_FILE_NAME = "sample.jpeg";
export const PICTURE_2M_FILE_NAME = "sample2.jpeg";
export const DOWNLOAD_PATH = "../resources/downloads/"
export const PICTURE_FILE_PATH = "../resources/" + PICTURE_FILE_NAME;
export const PICTURE_2M_FILE_PATH = "../resources/" + PICTURE_2M_FILE_NAME;
export const PDF_FILE_PATH = "../resources/" + PDF_FILE_NAME;

export const TEST_PUBLIC_CHANNEL = {
    channel: true,
    name: "test_public_channel",
    type: ChatType.PUBLIC,
    channelSendPolicy: ChannelSendPolicy.EVERYONE
}

export const TEST_PRIVATE_CHANNEL = {
    channel: true,
    name: "test_private_channel",
    type: ChatType.PRIVATE,
    channelSendPolicy: ChannelSendPolicy.EVERYONE
}

export const TEST_PRIVATE_CHANNEL_WITH_LIST = {
    channel: true,
    name: "test_private_channel_with_list",
    type: ChatType.PRIVATE,
    channelSendPolicy: ChannelSendPolicy.ADMIN_AND_LIST
}

export const TEST_MESSAGE_ROOM = "Room test message";

export const TEST_PICTURE_ATTACHMENT = {
    type: MessageAttachmentType.picture,
    name: PICTURE_FILE_NAME,
    size: fs.readFileSync(path.resolve(__dirname, PICTURE_FILE_PATH)).length,
    id: 0
}

export const TEST_BIG_PICTURE_ATTACHMENT = {
    type: MessageAttachmentType.picture,
    name: PICTURE_2M_FILE_NAME,
    size: fs.readFileSync(path.resolve(__dirname, PICTURE_2M_FILE_PATH)).length,
    id: 2
}

export const TEST_PDF_ATTACHMENT = {
    type: MessageAttachmentType.file,
    name: PDF_FILE_NAME,
    size: fs.readFileSync(path.resolve(__dirname, PDF_FILE_PATH)).length,
    id: 1
}

export const TEST_PICTURE_ATTACHMENT_DATA = {
    payload: Buffer.from(new Uint8Array(fs.readFileSync(path.resolve(__dirname, PICTURE_FILE_PATH)))).buffer,
    size: TEST_PICTURE_ATTACHMENT.size,
    id: TEST_PICTURE_ATTACHMENT.id
}

export const TEST_BIG_PICTURE_ATTACHMENT_DATA = {
    payload: Buffer.from(new Uint8Array(fs.readFileSync(path.resolve(__dirname, PICTURE_2M_FILE_PATH)))).buffer,
    size: TEST_BIG_PICTURE_ATTACHMENT.size,
    id: TEST_BIG_PICTURE_ATTACHMENT.id
}

export const TEST_PDF_ATTACHMENT_DATA = {
    payload: Buffer.from(new Uint8Array(fs.readFileSync(path.resolve(__dirname, PDF_FILE_PATH)))).buffer,
    size: TEST_PDF_ATTACHMENT.size,
    id: TEST_PDF_ATTACHMENT.id
}

export const ATTACHMENTS = [TEST_PICTURE_ATTACHMENT, TEST_PDF_ATTACHMENT];

export const ATTACHMENTS_PAYLOAD = [TEST_PICTURE_ATTACHMENT_DATA, TEST_PDF_ATTACHMENT_DATA]

export const UPDATED_PMI_SETTINGS = {
    allowJoinAtAnyTime: true,
    useMuteAudioOnJoin: true,
    useLocalAutoRecord: true,
    useAccessCode: true,
    useWaitingRoom: true,
    useOwnerVideo: true,
    useParticipantsVideo: true,
    accessCode: 'NEW_ACCESS_CODE'
}