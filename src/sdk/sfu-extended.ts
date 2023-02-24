import {v4 as uuidv4} from 'uuid';
import promises from "./promises";
import {Connection} from "./connection";
import {
    ATTACHMENT_CHUNK_SIZE,
    Calendar, CalendarEvent, CalendarEventEvent,
    AttachmentRequest, AttachmentRequestAck, Attachment,
    ChannelSendPolicy,
    ChannelType,
    Chat,
    ChatLoadedEvent,
    ChatMap,
    ChatsEvent,
    ContactInviteEvent,
    ContactRemovedEvent,
    ContactUpdateEvent, CreatedRoom,
    InternalApi,
    InternalMessage,
    Invite, LeftRoom,
    Message,
    MessageAttachment,
    MessageAttachmentData,
    MessageStatus,
    MessageStatusEvent,
    AttachmentState,
    AttachmentStatus,
    AttachmentStatusEvent,
    NewChatEvent,
    OperationFailedEvent, Operations,
    PublicChannelsEvent,
    RemovedChatEvent, RoomAvailable,
    RoomEvent, RoomInfo,
    SfuEvent,
    SfuMessageEvent,
    State,
    UpdateChatEvent,
    User,
    UserCalendarEvent,
    UserEmail,
    UserId,
    UserPassword,
    UserPmiSettings,
    UserListEvent,
    UserNickname,
    UserRoomsEvent,
    UserSpecificChatInfo,
    ChatMessagesEvent,
    ChatError,
    ChatReceivePolicy,
    ChatSearchResultEvent,
    MessageStatusBulkEvent,
    UserEmailChangedEvent,
    UserNicknameChangedEvent,
    UserInfo,
    UserInfoEvent,
    MessageEdited,
    MessageDeleted,
    UserTimezone,
    UserHostKey,
    UserPhoneNumber,
    SignUpStatus,
    UserManagementError
} from "./constants";
import {Notifier} from "./notifier";
import {RoomExtended} from "./room-extended";
import {SendingAttachmentsHandler} from "./sending-attachments-handler";
import Logger, {PrefixFunction, Verbosity} from "./logger";

type NotifyUnion = InternalMessage | Message | MessageStatus | AttachmentStatus | Array<User> | Calendar | UserSpecificChatInfo | Invite | User | ChatMap | Chat | ArrayBuffer | CalendarEvent | Attachment | UserInfo;

export class SfuExtended {

    #connection: Connection;
    #_user: {
        username: UserId,
        email: UserEmail,
        nickname: UserNickname,
        pmi: string
    }
    #_server: string;
    #_state: State = State.NEW;
    #rooms: { [key: string]: RoomExtended } = {};
    //TODO(naz): Provide union instead of InternalMessage
    #notifier: Notifier<SfuEvent, NotifyUnion> = new Notifier<SfuEvent, NotifyUnion>();
    #attachmentState: Array<Attachment> = [];
    #binaryChunkSize: number;
    #logger: Logger = new Logger();
    #loggerPrefix: PrefixFunction;
    #signUpId: string = '';

    constructor(logLevel?: Verbosity, prefix?: PrefixFunction) {
        this.#logger.setVerbosity(logLevel ? logLevel : Verbosity.ERROR);
        if (prefix) {
            this.#loggerPrefix = prefix;
            this.#logger.setPrefix(prefix);
        }
        this.#logger.setVerbosity(logLevel ? logLevel : Verbosity.ERROR);
    }

    public connect(options: {
        url: string,
        username: UserId,
        password: string,
        nickname: UserNickname,
        timeout?: number,
        binaryChunkSize?: number
    }) {
        if (!options) {
            throw new TypeError("No options provided");
        }
        const connectionConfig = {
            url: options.url,
            appName: InternalApi.Z_APP,
            timeout: options.timeout ? options.timeout : 10000,
            custom: {
                username: options.username,
                password: options.password,
                nickname: options.nickname
            }
        };
        const self = this;
        this.#createConnection();
        this.#_server = new URL(options.url).hostname;
        this.#binaryChunkSize = options.binaryChunkSize ? options.binaryChunkSize : ATTACHMENT_CHUNK_SIZE;
        return new Promise<{
            username: UserId,
            email: UserEmail,
            nickname: UserNickname,
            pmi: string
        }>(async (resolve, reject) => {
            try {
                const userCredentials = await this.#connection.connect(connectionConfig);
                self.#_user = {
                    username: userCredentials.sipLogin,
                    email: userCredentials.email,
                    nickname: userCredentials.sipVisibleName,
                    pmi: userCredentials.pmi
                }
                self.#_state = State.AUTHENTICATED;
                self.#notifier.notify(SfuEvent.CONNECTED);
                resolve(self.#_user);
            } catch (e) {
                self.#_state = State.FAILED;
                this.#notifier.notify(SfuEvent.FAILED, e);
                reject(e);
            }
        });
    };

    #createConnection() {
        const self = this;
        this.#connection = new Connection(
            (name: string, data: InternalMessage[]) => {
                this.#logger.debug("onMessage: ", data[0]);
                switch (name) {
                    case InternalApi.DEFAULT_METHOD:
                        //filter messages
                        //TODO(naz): refactor this part
                        if (data[0].type === InternalApi.MESSAGE) {
                            const message = (data[0] as SfuMessageEvent).message;
                            this.#notifier.notify(SfuEvent.MESSAGE, message);
                        } else if (data[0].type === InternalApi.MESSAGE_STATE) {
                            const messageState = data[0] as MessageStatusEvent;
                            if (!promises.resolve(data[0].internalMessageId, messageState.status)) {
                                this.#notifier.notify(SfuEvent.MESSAGE_STATE, messageState.status);
                            }
                        } else if (data[0].type === InternalApi.MESSAGE_ATTACHMENT_STATE) {
                            const attachmentState = data[0] as AttachmentStatusEvent;
                            promises.resolve(data[0].internalMessageId, attachmentState.status);
                            this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, attachmentState.status);
                        } else if (data[0].type === InternalApi.MESSAGE_STATE_BULK) {
                            const messageState = data[0] as MessageStatusBulkEvent;
                            if (!promises.resolve(data[0].internalMessageId, messageState)) {
                                this.#notifier.notify(SfuEvent.MESSAGE_STATE_BULK, messageState);
                            }
                        } else if (data[0].type === InternalApi.SFU_ATTACHMENT_REQUEST_ACK) {
                            const ack = data[0] as AttachmentRequestAck;
                            const request = ack.attachmentRequest as AttachmentRequest;
                            const state = this.#attachmentState.find(s => s.messageId === ack.attachmentRequest.messageId);
                            if (!state) {
                                this.#attachmentState.push({
                                    ...request,
                                    payload: null,
                                    internalMessageId: ack.internalMessageId
                                })
                            }
                        } else if (data[0].type === InternalApi.USER_LIST) {
                            const userList = data[0] as UserListEvent;
                            promises.resolve(data[0].internalMessageId, userList.list);
                            this.#notifier.notify(SfuEvent.USER_LIST, userList.list);
                        } else if (data[0].type === InternalApi.USER_CALENDAR) {
                            const calendar = data[0] as UserCalendarEvent;
                            promises.resolve(data[0].internalMessageId, calendar.calendar);
                            this.#notifier.notify(SfuEvent.USER_CALENDAR, calendar.calendar);
                        } else if (data[0].type === SfuEvent.NEW_CALENDAR_ENTRY) {
                            const calendarEntry = data[0] as CalendarEventEvent;
                            if (!promises.resolve(data[0].internalMessageId, calendarEntry.entry)) {
                                this.#notifier.notify(SfuEvent.NEW_CALENDAR_ENTRY, calendarEntry.entry);
                            }
                        } else if (data[0].type === SfuEvent.REMOVE_CALENDAR_ENTRY) {
                            const calendarEntry = data[0] as CalendarEventEvent;
                            if (!promises.resolve(data[0].internalMessageId, calendarEntry.entry)) {
                                this.#notifier.notify(SfuEvent.REMOVE_CALENDAR_ENTRY, calendarEntry.entry);
                            }
                        } else if (data[0].type === SfuEvent.UPDATE_CALENDAR_EVENT) {
                            const calendarEntry = data[0] as CalendarEventEvent;
                            if (!promises.resolve(data[0].internalMessageId, calendarEntry.entry)) {
                                this.#notifier.notify(SfuEvent.UPDATE_CALENDAR_EVENT, calendarEntry.entry);
                            }
                        } else if (data[0].type === SfuEvent.SFU_USER_PMI_SETTINGS) {
                            const pmiSettings = data[0] as UserPmiSettings;
                            if (!promises.resolve(data[0].internalMessageId, pmiSettings)) {
                                this.#notifier.notify(SfuEvent.SFU_USER_PMI_SETTINGS, pmiSettings);
                            }
                        } else if (data[0].type === SfuEvent.UPDATE_USER_PMI_SETTINGS) {
                            const pmiSettings = data[0] as UserPmiSettings;
                            if (!promises.resolve(data[0].internalMessageId, pmiSettings)) {
                                this.#notifier.notify(SfuEvent.UPDATE_USER_PMI_SETTINGS, pmiSettings);
                            }
                        } else if (data[0].type === InternalApi.NEW_CHAT) {
                            const chatInfo = data[0] as NewChatEvent;
                            if (!promises.resolve(data[0].internalMessageId, chatInfo.info)) {
                                this.#notifier.notify(SfuEvent.NEW_CHAT, chatInfo.info);
                            }
                        } else if (data[0].type === InternalApi.CONTACT_INVITE) {
                            const invite = data[0] as ContactInviteEvent;
                            if (!promises.resolve(data[0].internalMessageId, invite.invite)) {
                                this.#notifier.notify(SfuEvent.CONTACT_INVITE, invite.invite);
                            }
                        } else if (data[0].type === InternalApi.CONTACT_UPDATED) {
                            const contact = data[0] as ContactUpdateEvent;
                            if (!promises.resolve(data[0].internalMessageId, contact.contact)) {
                                this.#notifier.notify(SfuEvent.CONTACT_UPDATE, contact.contact);
                            }
                        } else if (data[0].type === InternalApi.CONTACT_REMOVED) {
                            const contact = data[0] as ContactRemovedEvent;
                            if (!promises.resolve(data[0].internalMessageId, contact.contact)) {
                                this.#notifier.notify(SfuEvent.CONTACT_REMOVED, contact.contact);
                            }
                        } else if (data[0].type === InternalApi.CHAT_DELETED) {
                            const chat = data[0] as RemovedChatEvent;
                            if (!promises.resolve(data[0].internalMessageId, chat.info)) {
                                this.#notifier.notify(SfuEvent.CHAT_DELETED, chat.info);
                            }
                        } else if (data[0].type === InternalApi.CHAT_UPDATED) {
                            const chat = data[0] as UpdateChatEvent;
                            if (!promises.resolve(data[0].internalMessageId, chat.info)) {
                                this.#notifier.notify(SfuEvent.CHAT_UPDATED, chat.info);
                            }
                        } else if (data[0].type === InternalApi.USER_CHATS) {
                            const chats = data[0] as ChatsEvent;
                            promises.resolve(data[0].internalMessageId, chats.chats);
                            this.#notifier.notify(SfuEvent.USER_CHATS, chats.chats);
                        } else if (data[0].type === InternalApi.PUBLIC_CHANNELS) {
                            const channels = data[0] as PublicChannelsEvent;
                            promises.resolve(data[0].internalMessageId, channels.channels);
                            this.#notifier.notify(SfuEvent.PUBLIC_CHANNELS, channels.channels);
                        } else if (data[0].type === InternalApi.CHAT_LOADED) {
                            const chat = data[0] as ChatLoadedEvent;
                            promises.resolve(data[0].internalMessageId, chat.chat);
                            this.#notifier.notify(SfuEvent.CHAT_LOADED, chat.chat);
                        } else if (data[0].type === SfuEvent.CHAT_MESSAGES) {
                            const messagesEvent = data[0] as ChatMessagesEvent;
                            promises.resolve(data[0].internalMessageId, messagesEvent.messages);
                            this.#notifier.notify(SfuEvent.CHAT_MESSAGES, messagesEvent);
                        } else if (data[0].type === SfuEvent.CHAT_SEARCH_RESULT) {
                            const messagesEvent = data[0] as ChatSearchResultEvent;
                            promises.resolve(data[0].internalMessageId, messagesEvent.messages);
                            this.#notifier.notify(SfuEvent.CHAT_SEARCH_RESULT, messagesEvent);
                        } else if (data[0].type === RoomEvent.CREATED) {
                            const state = data[0] as CreatedRoom;
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().nickname, state.creationTime, state.config, this.#loggerPrefix);
                            this.#rooms[room.id()] = room;
                            const self = this;
                            const cleanup = () => {
                                if (self.#rooms[room.id()].pc()) {
                                    self.#rooms[room.id()].pc().close();
                                    self.#rooms[room.id()].pc().dispatchEvent(new Event("connectionstatechange"));
                                }
                                delete self.#rooms[room.id()];
                            };
                            room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.ENDED, cleanup
                            ).on(RoomEvent.FAILED, cleanup
                            ).on(RoomEvent.OPERATION_FAILED, function (e: OperationFailedEvent) {
                                if (Operations.ROOM_JOIN === e.operation) {
                                    cleanup();
                                }
                            });
                            promises.resolve(data[0].internalMessageId, room);
                        } else if (data[0].type === RoomEvent.AVAILABLE) {
                            const state = data[0] as RoomAvailable;
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().nickname, state.creationTime, state.config, this.#loggerPrefix);
                            this.#rooms[room.id()] = room;
                            const self = this;
                            const cleanup = () => {
                                if (self.#rooms[room.id()].pc()) {
                                    self.#rooms[room.id()].pc().close();
                                    self.#rooms[room.id()].pc().dispatchEvent(new Event("connectionstatechange"));
                                }
                                delete self.#rooms[room.id()];
                            };
                            room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                if (participant.name === room.nickname()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.ENDED, cleanup
                            ).on(RoomEvent.FAILED, cleanup
                            ).on(RoomEvent.OPERATION_FAILED, function (e: OperationFailedEvent) {
                                if (Operations.ROOM_JOIN === e.operation) {
                                    cleanup();
                                }
                            });
                            promises.resolve(data[0].internalMessageId, room);
                        } else if (data[0].type === SfuEvent.USER_ROOMS) {
                            const state = data[0] as UserRoomsEvent;
                            state.rooms.forEach((info) => {
                                const room = new RoomExtended(this.#connection, info.id, info.owner, info.name, info.pin, this.user().nickname, info.creationTime, info.config, this.#loggerPrefix);
                                this.#rooms[room.id()] = room;
                                const self = this;
                                const cleanup = () => {
                                    if (self.#rooms[room.id()].pc()) {
                                        self.#rooms[room.id()].pc().close();
                                        self.#rooms[room.id()].pc().dispatchEvent(new Event("connectionstatechange"));
                                    }
                                    delete self.#rooms[room.id()];
                                };
                                room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                    if (participant.name === room.nickname()) {
                                        cleanup();
                                    }
                                }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                    if (participant.name === room.nickname()) {
                                        cleanup();
                                    }
                                }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                    if (participant.name === room.nickname()) {
                                        cleanup();
                                    }
                                }).on(RoomEvent.ENDED, cleanup
                                ).on(RoomEvent.FAILED, cleanup
                                ).on(RoomEvent.OPERATION_FAILED, function (e: OperationFailedEvent) {
                                    if (Operations.ROOM_JOIN === e.operation) {
                                        cleanup();
                                    }
                                });
                            });
                            promises.resolve(data[0].internalMessageId, state.rooms);
                        } else if (data[0].type === RoomEvent.OPERATION_FAILED && promises.promised(data[0].internalMessageId)) {
                            promises.reject(data[0].internalMessageId, data[0] as OperationFailedEvent);
                            if (data[0].roomId && data[0].roomId.length > 0) {
                                //hand over to processEvent where the OperationTypeEvent handled for a room
                                const room = this.#rooms[data[0].roomId];
                                if (room) {
                                    room.processEvent(data[0]);
                                }
                            }
                        } else if (data[0].type === SfuEvent.ACK && promises.promised(data[0].internalMessageId)) {
                            promises.resolve(data[0].internalMessageId);
                        } else if (data[0].roomId && data[0].roomId.length > 0) {
                            //room event
                            const room = this.#rooms[data[0].roomId];
                            if (room) {
                                room.processEvent(data[0]);
                            }
                        } else if (data[0].type === SfuEvent.USER_INFO) {
                            const event = data[0] as UserInfoEvent;
                            promises.resolve(event.internalMessageId, event.userInfo)
                            this.#notifier.notify(SfuEvent.USER_INFO, event.userInfo);
                        } else if (data[0].type === SfuEvent.USER_EMAIL_CHANGED) {
                            const event = data[0] as UserEmailChangedEvent;
                            if (promises.resolve(event.internalMessageId)) {
                                this.#_user.email = event.email;
                            }
                        } else if (data[0].type === SfuEvent.USER_NICKNAME_CHANGED) {
                            const event = data[0] as UserNicknameChangedEvent;
                            if (promises.resolve(event.internalMessageId)) {
                                this.#_user.nickname = event.nickname;
                            }
                        } else if (data[0].type === SfuEvent.CHAT_MESSAGE_EDITED) {
                            const message = data[0] as MessageEdited;
                            if (!promises.resolve(data[0].internalMessageId, message)) {
                                this.#notifier.notify(SfuEvent.CHAT_MESSAGE_EDITED, message);
                            }
                        } else if (data[0].type === SfuEvent.CHAT_MESSAGE_DELETED) {
                            const message = data[0] as MessageDeleted;
                            if (!promises.resolve(data[0].internalMessageId, message)) {
                                this.#notifier.notify(SfuEvent.CHAT_MESSAGE_DELETED, message);
                            }
                        } else {
                            this.#notifier.notify(data[0].type as SfuEvent, data[0]);
                        }
                        break;
                    case "failed":
                        this.#notifier.notify(SfuEvent.FAILED, data[0]);
                        break;
                }
            },
            (name: string, data: ArrayBuffer) => {
                switch (name) {
                    case InternalApi.BINARY_DATA:
                        const buffer = new Uint8Array(data);
                        const id = buffer[1];
                        const eof = buffer[2];
                        const attachment = this.#attachmentState.find(attachment => attachment.tmpId === id);
                        if (attachment) {
                            if (!attachment.payload) {
                                attachment.payload = data.slice(3, data.byteLength);
                            } else {
                                //ToDo (igor): optimize ArrayBuffer merging
                                const newData = new Uint8Array(attachment.payload.byteLength + (data.byteLength - 3));
                                newData.set(new Uint8Array(attachment.payload), 0);
                                newData.set(new Uint8Array(data.slice(3, data.byteLength)), attachment.payload.byteLength);
                                attachment.payload = newData.buffer;
                            }
                            if (eof === 1) {
                                this.#notifyMessageAttachmentState(attachment, AttachmentState.DOWNLOADED);
                                const index = this.#attachmentState.indexOf(attachment);
                                this.#attachmentState.splice(index, 1);
                                // ToDo (igor): need to resolve or reject in any case
                                promises.resolve(attachment.internalMessageId, attachment);
                            } else {
                                this.#notifyMessageAttachmentState(attachment, AttachmentState.PENDING);
                            }
                        } else {
                            this.#logger.info("Unable to find attachment " + id);
                        }
                        break;
                    default:
                        console.error("Unknown binary data type " + name);
                }
            },
            (e) => {
                self.#_state = State.FAILED;
                self.#notifier.notify(SfuEvent.CONNECTION_FAILED, e as InternalMessage);
            },
            (e) => {
                self.#_state = State.DISCONNECTED;
                self.disconnect();
                self.#attachmentState.length = 0;
                if (e.reason === 'Normal disconnect') {
                    self.#notifier.notify(SfuEvent.DISCONNECTED, e as InternalMessage);
                } else {
                    self.#notifier.notify(SfuEvent.CONNECTION_FAILED, e as InternalMessage);
                }
            },
            this.#logger
        );
    }

    #emmitAction(action: InternalApi, data: object, resolve: Function, reject: Function) {
        const id = uuidv4();
        promises.add(id, resolve, reject);
        this.#connection.send(action, {
            ...data,
            internalMessageId: id
        });
    }

    #emmitBinaryAction(data: any) {
        this.#connection.sendBinaryData(data);
    }

    #checkAuthenticated() {
        if (this.#_state !== State.AUTHENTICATED) {
            throw new Error("User isn't authenticated, current state " + this.#_state);
        }
    }

    public signUp(options: {
        url: string,
        timeout?: number,
        email: string,
        password: string
    }) {
        const connectionConfig = this.#getConnectionConfigForAnonymousUser(options.url, options.timeout);
        const self = this;
        return new Promise<SignUpStatus>(async (resolve, reject) => {
            if (self.#signUpId && promises.promised(self.#signUpId)) {
                promises.reject(self.#signUpId, new Error(UserManagementError.EMAIL_IS_NOT_VERIFIED));
                self.#signUpId = '';
            }
            if (self.#_state === State.CONNECTED) {
                await self.disconnect();
            }
            self.#connection = new Connection(
                (name: string, data: InternalMessage[]) => {
                    if (name === InternalApi.DEFAULT_METHOD) {
                        if (data[0].type === SfuEvent.SIGN_UP_STATUS) {
                            const status = data[0] as SignUpStatus;
                            if (status.verified) {
                                promises.resolve(data[0].internalMessageId, status);
                                self.#signUpId = '';
                                self.disconnect();
                                this.#notifier.notify(SfuEvent.SIGN_UP_STATUS, status);
                            } else {
                                this.#notifier.notify(SfuEvent.SIGN_UP_STATUS, status);
                            }
                        } else if (data[0].type === RoomEvent.OPERATION_FAILED && promises.promised(data[0].internalMessageId)) {
                            promises.reject(data[0].internalMessageId, data[0] as OperationFailedEvent);
                            self.#signUpId = '';
                            self.disconnect();
                        }
                    }
                },
                () => {
                },
                (e) => {
                    reject(new Error(UserManagementError.CONNECTION_ERROR));
                    self.#signUpId = '';
                    self.#_state = State.FAILED;
                },
                (e) => {
                    if (e.reason === 'Normal disconnect') {
                        promises.reject(self.#signUpId, new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
                        self.#_state = State.DISCONNECTED;
                        self.#signUpId = '';
                        self.disconnect();
                    } else {
                        promises.reject(self.#signUpId, new Error(UserManagementError.CONNECTION_FAILED));
                        self.#_state = State.DISCONNECTED;
                        self.#signUpId = '';
                        self.disconnect();
                    }
                },
                this.#logger);
            await self.#connection.connect(connectionConfig);
            self.#_state = State.CONNECTED;
            const id = uuidv4();
            self.#signUpId = id;
            promises.add(id, resolve, reject);
            self.#connection.send(InternalApi.SIGN_UP, {
                email: options.email,
                password: options.password,
                internalMessageId: id
            });
        });
    }

    public removeUser(options: {
        url: string,
        timeout?: number,
        id: string
    }) {
        const connectionConfig = this.#getConnectionConfigForAnonymousUser(options.url, options.timeout);
        const self = this;
        return new Promise<void>(async (resolve, reject) => {
            const promiseId = uuidv4();
            if (self.#_state === State.CONNECTED) {
                await self.disconnect();
            }
            self.#connection = new Connection(
                (name: string, data: InternalMessage[]) => {
                    if (name === InternalApi.DEFAULT_METHOD) {
                        if (data[0].type === SfuEvent.ACK && promises.promised(data[0].internalMessageId)) {
                            promises.resolve(data[0].internalMessageId);
                        } else if (data[0].type === RoomEvent.OPERATION_FAILED && promises.promised(data[0].internalMessageId)) {
                            promises.reject(data[0].internalMessageId, data[0] as OperationFailedEvent);
                        }
                        self.disconnect();
                    }
                },
                () => {
                },
                (e) => {
                    reject(new Error(UserManagementError.CONNECTION_ERROR));
                    self.#_state = State.FAILED;
                },
                (e) => {
                    if (e.reason === 'Normal disconnect') {
                        reject(new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
                        self.#_state = State.DISCONNECTED;
                        self.disconnect();
                    } else {
                        reject(new Error(UserManagementError.CONNECTION_FAILED));
                        self.#_state = State.DISCONNECTED;
                        self.disconnect();
                    }
                },
                this.#logger);
            await self.#connection.connect(connectionConfig);
            promises.add(promiseId, resolve, reject);
            self.#connection.send(InternalApi.REMOVE_USER, {
                id: options.id,
                internalMessageId: promiseId
            });
        });
    }

    #getConnectionConfigForAnonymousUser(url: string, timeout?: number) {
        return {
            url: url,
            appName: InternalApi.Z_USER_MANAGEMENT_APP,
            timeout: timeout ? timeout : 10000,
            custom: {
                username: "",
                password: "",
                nickname: ""
            }
        };
    };

    public sendMessage(msg: {
        body?: string,
        to?: string,
        parentId?: string,
        chatId: string,
        attachments?: Array<MessageAttachment>
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<MessageStatus>(function (resolve, reject) {
            self.#checkAuthenticated();
            if (!msg) {
                reject(new Error(ChatError.CAN_NOT_SEND_NULL_MESSAGE));
            } else if ((!msg.body || msg.body === "") && (!msg.attachments || msg.attachments.length === 0)) {
                reject(new Error(ChatError.CAN_NOT_SEND_MESSAGE_WITHOUT_CONTENT));
            } else if (!msg.chatId || msg.chatId === "") {
                reject(new Error(ChatError.CAN_NOT_SEND_MESSAGE_WITHOUT_CHAT_ID));
            } else {
                self.#emmitAction(InternalApi.SEND_MESSAGE, {
                    to: msg.to,
                    parentId: msg.parentId,
                    body: msg.body,
                    chatId: msg.chatId,
                    attachments: msg.attachments
                }, resolve, reject);
            }
        });
    };

    public getSendingAttachmentsHandler(attachments: Array<MessageAttachmentData>, messageId: string) {
        const self = this;
        const cancelledAttachments: {[key: number]: {status: AttachmentStatus}} = {};
        let promiseForWaitResultMessageStatus: {resolve: Function, reject: Function};
        let resultMessageStatus: MessageStatus;
        let attachmentsIsReady = false;

        function sendMessageWithAttachments(messageId: string) {
            return new Promise<MessageStatus>(function (resolve, reject) {
                promises.add(messageId, resolve, reject);
                self.#connection.send(InternalApi.SEND_MESSAGE_WITH_ATTACHMENTS, {
                    id: messageId
                });
            })
        }

        function cancelSendAttachment(attachmentId: number) {
            return new Promise<AttachmentStatus>(function (resolve, reject) {
                self.#emmitAction(InternalApi.CANCEL_SENDING_ATTACHMENT, {
                    id: attachmentId}, resolve, reject);
            })
        }

        function sendAttachmentChunk(data: Blob, id: number, end: number, index: number) {
            return new Promise<AttachmentStatus>(function (resolve, reject) {
                promises.add(id.toString(), resolve, reject);
                /**
                 * 3-bytes header:
                 * 1st byte - command (10 - sendMessageAttachment)
                 * 2nd byte - attachment id
                 * 3rd byte - end of attachment
                 * @type {Uint8Array}
                 */
                const header = new Uint8Array([10, id, end]);
                const start = index * self.#binaryChunkSize;
                const chunk = new Blob([header, data.slice(start, start + self.#binaryChunkSize)]);
                self.#emmitBinaryAction(chunk);
            })
        }

        async function uploadAttachment(attachment: MessageAttachmentData) {
            return new Promise<AttachmentStatus>(async function (resolve, reject) {
                const id = attachment.id;
                const {payload} = attachment;
                const data = new Blob([payload]);
                const chunks = Math.ceil(data.size / self.#binaryChunkSize);
                for (let i = 0; i < chunks; i++) {
                    let end = 0;
                    if (i === chunks - 1) {
                        end = 1;
                    }
                    const cancellationPromise = cancelledAttachments[id];
                    if (cancellationPromise === undefined) {
                        const result = await sendAttachmentChunk(data, id, end, i);
                        const attachmentState = result as AttachmentStatus;
                        if (attachmentState.state === AttachmentState.UPLOADED) {
                            resolve(attachmentState);
                        }
                    } else {
                        delete cancelledAttachments[id];
                        resolve(cancellationPromise.status);
                        break;
                    }
                }
            });
        }

        function sendAttachments() {
            return {
                send: () => new Promise<MessageStatus>(async function (resolve, reject) {
                    self.#checkAuthenticated();
                    if (attachments.length) {
                        for (let i = 0; i < attachments.length; i++) {
                            const attachmentId = attachments[i].id;
                            const cancellationPromise = cancelledAttachments[attachmentId];
                            if (cancellationPromise === undefined) {
                                await uploadAttachment(attachments[i]);
                            } else {
                                delete cancelledAttachments[attachmentId];
                            }
                        }
                        attachmentsIsReady = true;
                        const result = await sendMessageWithAttachments(messageId);
                        if (promiseForWaitResultMessageStatus) {
                            promiseForWaitResultMessageStatus.resolve(result);
                        }
                        resultMessageStatus = result;
                        resolve(result);
                    } else {
                        reject(new Error("No attachments"));
                    }
                }),
                cancel: (attachment: MessageAttachment) => new Promise<AttachmentStatus>(async function (resolve, reject) {
                    if (!attachmentsIsReady) {
                        const result = await cancelSendAttachment(attachment.id);
                        if (result.uploadedSize !== attachment.size) {
                            cancelledAttachments[attachment.id] =  {status: result};
                        }
                        resolve(result);
                    } else {
                        reject(new Error(ChatError.CAN_NOT_CANCEL_SENDING_ATTACHMENT));
                    }
                }),
                waitAndGetMessageStatus: () => new Promise<MessageStatus>(function (resolve, reject) {
                    if (resultMessageStatus) {
                        resolve(resultMessageStatus);
                    } else {
                        promiseForWaitResultMessageStatus = {resolve, reject};
                    }
                }),
                getAttachmentsData: () => {
                    return attachments;
                }
            }
        }

        return new SendingAttachmentsHandler(sendAttachments());
    }

    public getMessageAttachment(attachment: AttachmentRequest) {
        this.#checkAuthenticated();
        const self = this;
        const {attachmentId, name, messageId, chatId} = attachment;
        if (!messageId || messageId === '') {
            throw new Error('Empty messageId');
        }
        if (!chatId || chatId === '') {
            throw new Error('Empty chatId');
        }
        if (!name || name === '') {
            throw new Error('Empty attachment name');
        }
        if (attachmentId === null) {
            throw new Error('Empty attachment id');
        }
        return new Promise<Attachment>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_ATTACHMENT, {
                messageId: messageId,
                chatId: chatId,
                attachmentId: attachmentId,
                name: name,
                size: self.#binaryChunkSize
            }, resolve, reject);
        })
    }

    #notifyMessageAttachmentState(attachment: Attachment, state: AttachmentState) {
        const status: AttachmentStatus = {
            chatId: attachment.chatId,
            messageId: attachment.messageId,
            id: attachment.attachmentId,
            name: attachment.name,
            state: state,
            downloadedSize: attachment.payload.byteLength
        };
        this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, status);
    }

    public markMessageRead(msg: {
        id: string,
        chatId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function(resolve, reject) {
            if (!msg) {
                reject(new Error("Can't mark null message"));
            } else if (!msg.chatId || msg.chatId === "") {
                reject(new Error("Can't mark message without a chatId"));
            } else if (!msg.id || msg.id === "") {
                reject(new Error("Can't mark message without massage id"));
            } else {
                self.#emmitAction(InternalApi.MARK_MESSAGE_READ, {
                    id: msg.id,
                    chatId: msg.chatId
                }, resolve, reject);
            }
        });
    }

    public markMessageUnread(msg: {
        id: string,
        chatId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function(resolve, reject) {
            if (!msg) {
                reject(new Error("Can't mark null message"));
            } else if (!msg.chatId || msg.chatId === "") {
                reject(new Error("Can't mark message without a chatId"));
            } else if (!msg.id || msg.id === "") {
                reject(new Error("Can't mark message without massage id"));
            } else {
                self.#emmitAction(InternalApi.MARK_MESSAGE_UNREAD, {
                    id: msg.id,
                    chatId: msg.chatId
                }, resolve, reject);
            }
        });
    }

    public getUserList() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<User>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_LIST, {}, resolve, reject);
        });
    };

    public getUserCalendar() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Calendar>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_CALENDAR, {}, resolve, reject);
        });
    };

    public getUserPmiSettings() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserPmiSettings>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_PMI_SETTINGS, {}, resolve, reject);
        });
    }

    public updateUserPmiSettings(settings: {
        allowJoinAtAnyTime: boolean,
        useMuteAudioOnJoin: boolean,
        useLocalAutoRecord: boolean,
        useAccessCode: boolean,
        useWaitingRoom: boolean,
        useOwnerVideo: boolean,
        useParticipantsVideo: boolean,
        accessCode: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserPmiSettings>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_USER_PMI_SETTINGS, {
                ...settings
            }, resolve, reject);
        });
    }

    public getUserInfo() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_INFO, {}, resolve, reject);
        })
    }

    public changeUserEmail(email: UserEmail) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_EMAIL, {
                email: email
            }, resolve, reject);
        })
    };

    public changeUserPassword(currentPassword: UserPassword, newPassword: UserPassword) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_PASSWORD, {
                password: {
                    currentPassword: currentPassword,
                    newPassword: newPassword
                }
            }, resolve, reject);
        })
    };

    public changeUserNickname(nickname: UserNickname) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_NICKNAME, {
                nickname: nickname
            }, resolve, reject);
        })
    };

    public changeUserPhoneNumber(phoneNumber: UserPhoneNumber) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_PHONE_NUMBER, {
                phoneNumber: phoneNumber
            }, resolve, reject);
        })
    };

    public changeUserHostKey(hostKey: UserHostKey) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_HOST_KEY, {
                hostKey: hostKey
            }, resolve, reject);
        })
    };

    public changeUserTimezone(timezone: UserTimezone) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CHANGE_USER_TIMEZONE, {
                timezone: timezone
            }, resolve, reject);
        })
    };

    public addCalendarEvent(event: {
        title: string,
        description: string,
        start: number,
        end: number,
        recurring: boolean,
        accessCode?: string,
        waitingRoom: boolean,
        usePMI: boolean,
        ownerVideo: boolean,
        participantVideo: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<CalendarEvent>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CALENDAR_EVENT, {
                event: event
            }, resolve, reject);
        });
    };

    public removeCalendarEvent(event: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<CalendarEvent>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CALENDAR_EVENT, {
                event: event
            }, resolve, reject);
        });
    };

    public updateCalendarEvent(event: {
        id: string,
        title: string,
        description: string,
        start: number,
        end: number,
        recurring: boolean,
        accessCode?: string,
        waitingRoom: boolean,
        usePMI: boolean,
        ownerVideo: boolean,
        participantVideo: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<CalendarEvent>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_CALENDAR_EVENT, {
                event: event
            }, resolve, reject);
        });
    }

    public getUserChats() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMap>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_CHATS, {}, resolve, reject);
        });
    };

    public getPublicChannels() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMap>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_PUBLIC_CHANNELS, {}, resolve, reject);
        });
    };

    public loadChat(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Chat>(function (resolve, reject) {
            self.#emmitAction(InternalApi.LOAD_CHAT, {id: chat.id}, resolve, reject);
        });
    };

    public loadChatMessages(params: {
        chatId: string,
        timeFrame?: {
            start: number,
            end: number,
            limit?: number
        },
        boundaries?: {
            dateMark: number,
            lowerLimit: number,
            upperLimit: number
        }
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<Message>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.LOAD_CHAT_MESSAGES, params, resolve, reject);
        });
    };

    public searchChatMessages(params: {
        chatId: string,
        searchString: string,
        searchId?: string,
        limit?: number
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<Message>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.SEARCH_CHAT_MESSAGES, params, resolve, reject);
        });
    };

    public createChat(chat: {
        id?: string,
        name?: string,
        members?: Array<UserId>,
        favourite?: boolean,
        channel?: boolean,
        channelType?: ChannelType,
        channelSendPolicy?: ChannelSendPolicy,
        sendPermissionList?: Array<string>,
        allowedToAddExternalUser?: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_CHAT, {
                id: chat.id,
                name: chat.name,
                members: chat.members,
                favourite: chat.favourite,
                channel: chat.channel,
                channelType: chat.channelType,
                channelSendPolicy: chat.channelSendPolicy,
                sendPermissionList: chat.sendPermissionList,
                allowedToAddExternalUser: chat.allowedToAddExternalUser
            }, resolve, reject);
        });
    };

    public deleteChat(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_CHAT, {id: chat.id}, resolve, reject);
        });
    };

    public renameChat(chat: {
        id: string,
        name: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.RENAME_CHAT, {id: chat.id, name: chat.name}, resolve, reject);
        });
    };

    public editChatMessage(msg: {
        chatId: string,
        messageId: string,
        body: string,
        attachmentsToSend?: Array<MessageAttachment>,
        attachmentIdsToDelete?: number[]
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<MessageStatus>(function (resolve, reject) {
            self.#emmitAction(InternalApi.EDIT_CHAT_MESSAGE, {
                id: msg.messageId,
                chatId: msg.chatId,
                body: msg.body,
                attachments: msg.attachmentsToSend,
                attachmentIdsToDelete: msg.attachmentIdsToDelete
            }, resolve, reject);
        });
    }

    public deleteChatMessage(msg: {
        chatId: string,
        messageId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<MessageStatus>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_CHAT_MESSAGE, {
                id: msg.messageId,
                chatId: msg.chatId,
            }, resolve, reject);
        });
    }

    public addMemberToChat(chat: {
        id: string,
        member: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_MEMBER_TO_CHAT, {id: chat.id, member: chat.member}, resolve, reject);
        });
    };

    public removeMemberFromChat(chat: {
        id: string,
        member: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_MEMBER_FROM_CHAT, {id: chat.id, member: chat.member}, resolve, reject);
        });
    };

    public inviteContact(invite: {
        to: UserId | UserEmail
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.INVITE_CONTACT, {from: self.#_user.username, to: invite.to}, resolve, reject);
        });
    }

    public addContactToFavourites(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CONTACT_TO_FAVOURITES, {id: contact.id}, resolve, reject);
        });
    }

    public removeContactFromFavourites(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CONTACT_FROM_FAVOURITES, {id: contact.id}, resolve, reject);
        });
    }

    public confirmContact(invite: {
        id: string,
        from: UserId,
        to: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CONFIRM_CONTACT, {
                from: invite.from,
                to: invite.to,
                id: invite.id
            }, resolve, reject);
        });
    }

    public removeContact(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CONTACT, {id: contact.id}, resolve, reject);
        });
    }

    public updateChannelSendPolicy(channel: {
        id: string,
        channelSendPolicy: ChannelSendPolicy
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_CHANNEL_SEND_POLICY, {
                id: channel.id,
                channelSendPolicy: channel.channelSendPolicy
            }, resolve, reject);
        });
    }

    public updateChatReceivePolicy(channel: {
        id: string,
        chatReceivePolicy: ChatReceivePolicy
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_CHAT_RECEIVE_POLICY, {
                id: channel.id,
                chatReceivePolicy: channel.chatReceivePolicy
            }, resolve, reject);
        });
    }

    public addChannelSendPermissionListMember(channel: {
        id: string,
        member: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CHANNEL_SEND_PERMISSION_LIST_MEMBER, {
                id: channel.id,
                member: channel.member
            }, resolve, reject);
        });
    }

    public removeChannelSendPermissionListMember(channel: {
        id: string,
        member: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CHANNEL_SEND_PERMISSION_LIST_MEMBER, {
                id: channel.id,
                member: channel.member
            }, resolve, reject);
        });
    }

    public updateChatConfiguration(chat: {
        id: string,
        channelType?: ChannelType,
        channelSendPolicy?: ChannelSendPolicy,
        sendPermissionList?: Array<string>,
        allowedToAddExternalUser?: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_CHAT_CONFIGURATION, chat, resolve, reject);
        });
    }

    public addChatToFavourites(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CHAT_TO_FAVOURITES, {id: chat.id}, resolve, reject);
        });
    }

    public removeChatFromFavourites(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CHAT_FROM_FAVOURITES, {id: chat.id}, resolve, reject);
        });
    }

    public createRoom(options: {
        name?: string,
        pin?: string,
        id?: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RoomExtended>((resolve, reject) => {
            self.#emmitAction(InternalApi.CREATE_ROOM, {
                id: options.id,
                name: options.name,
                pin: options.pin
            }, resolve, reject);
        });
    };

    public createRoomFromEvent(event: {
        id: string,
        title: string,
        description: string,
        start: number,
        end: number,
        recurring: boolean,
        accessCode?: string,
        waitingRoom: boolean,
        usePMI: boolean,
        ownerVideo: boolean,
        participantVideo: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RoomExtended>((resolve, reject) => {
            this.#emmitAction(InternalApi.CREATE_ROOM_FROM_EVENT, {
                event: event
            }, resolve, reject);
        });
    }

    public loadActiveRooms() {
        const self = this;
        return new Promise<Array<RoomInfo>>((resolve, reject) => {
            self.#emmitAction(InternalApi.GET_ACTIVE_ROOMS, {}, resolve, reject);
        });
    }

    public roomAvailable(options: {
        id: string,
        pin?: string
        nickname?: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RoomExtended>((resolve, reject) => {
            self.#emmitAction(InternalApi.ROOM_AVAILABLE, {
                id: options.id,
                pin: options.pin
            }, resolve, reject);
        });
    };

    public roomExists(options: {
        id: string,
        pin?: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>((resolve, reject) => {
            self.#emmitAction(InternalApi.ROOM_EXISTS, {
                id: options.id,
                pin: options.pin
            }, resolve, reject);
        });
    };

    public getRoom(options: {
        id: string
    }) {
        if (!options) {
            throw new TypeError("No options provided");
        }
        this.#checkAuthenticated();
        return this.#rooms[options.id];
    }

    public async disconnect() {
        for (const [key, value] of Object.entries(this.#rooms)) {
            value.leaveRoom();
        }
        this.#_user = undefined;
        if (this.#_state !== State.DISCONNECTED) {
            await this.#connection.close();
            this.#_state = State.DISCONNECTED;
        }
        this.#rooms = {};
    };

    public user() {
        return this.#_user;
    }

    public server() {
        return this.#_server;
    }

    public state() {
        return this.#_state;
    }

    public on(event: SfuEvent, callback: (arg0: NotifyUnion) => void): SfuExtended {
        this.#notifier.add(event, callback);
        return this;
    };

    public off(event: SfuEvent, callback: (arg0: NotifyUnion) => void): SfuExtended {
        this.#notifier.remove(event, callback);
        return this;
    };

}