import {v4 as uuidv4} from 'uuid';
import promises from "./promises";
import {Connection} from "./connection";
import {
    ATTACHMENT_CHUNK_SIZE,
    ATTACHMENT_ID_LENGTH,
    Calendar,
    CalendarEvent,
    CalendarEventEvent,
    AttachmentRequest,
    AttachmentRequestAck,
    Attachment,
    ChannelSendPolicy,
    ChatType,
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
    UserInfo,
    UserInfoEvent,
    MessageEdited,
    MessageDeleted,
    UserTimezone,
    UserHostKey,
    UserPhoneNumber,
    SignUpStatus,
    UserManagementError,
    ResetPasswordRequestStatus,
    ChatMessagesCount,
    MessageAttachmentsSearchResult,
    MessageAttachmentMediaType,
    SortOrder,
    LoadBookmarkedMessagesResult,
    LoadMessagesWithMentionsResult,
    BookmarkDeleted,
    ChatWithBookmarksDeleted,
    BookmarkEdited,
    FirstAndLastChatMessage,
    UserInfoChangedEvent,
    LastReadMessageUpdated,
    ConnectionDetails,
    AuthenticationStatusEvent,
    MessageWithUploadingAttachments,
    UpdateMessagesDeliveryStatusEvent,
    ConnectionFailedEvent,
} from "./constants";
import {Notifier} from "./notifier";
import {RoomExtended} from "./room-extended";
import {SendingAttachmentsHandler} from "./sending-attachments-handler";
import Logger, {PrefixFunction, Verbosity} from "./logger";
import {ResetPasswordHandler} from "./reset-password-handler";

type NotifyUnion = InternalMessage | Message | MessageStatus | AttachmentStatus | Array<User> | Calendar | UserSpecificChatInfo | Invite | User | ChatMap | Chat | ArrayBuffer | CalendarEvent | Attachment | UserInfo;

type MessageWithUploadingAttachmentState = {
    [messageId: string] : MessageWithUploadingAttachments
}

export class SfuExtended {

    #connection: Connection;
    #_user: {
        username: UserId,
        email: UserEmail,
        nickname: UserNickname,
        authToken: string,
        pmi: string
    }
    #_server: string;
    #_state: State = State.NEW;
    #rooms: { [key: string]: RoomExtended } = {};
    //TODO(naz): Provide union instead of InternalMessage
    #notifier: Notifier<SfuEvent, NotifyUnion> = new Notifier<SfuEvent, NotifyUnion>();
    #uploadingAttachmentState: MessageWithUploadingAttachmentState = {}
    #downloadingAttachmentState: Array<Attachment> = [];
    #binaryChunkSize: number;
    #logger: Logger = new Logger();
    #loggerPrefix: PrefixFunction;
    #signUpId: string = '';
    #resetPasswordId: string = '';

    constructor(logLevel?: Verbosity, prefix?: PrefixFunction, log?: any) {
        this.#logger.setVerbosity(logLevel ? logLevel : Verbosity.ERROR);
        if (prefix) {
            this.#loggerPrefix = prefix;
            this.#logger.setPrefix(prefix);
        }
        if (log) {
            this.#logger.setLogger(log);
        }
        this.#logger.setVerbosity(logLevel ? logLevel : Verbosity.ERROR);
    }

    public connect(options: {
        url: string,
        username?: UserId,
        password?: string,
        nickname?: UserNickname,
        timeout?: number,
        binaryChunkSize?: number
        failedProbesThreshold?: number,
        authToken?: string,
        pingInterval?: number,
        device?: string,
        details?: ConnectionDetails
    }) {
        if (!options) {
            throw new TypeError("No options provided");
        }
        const connectionConfig = {
            url: options.url,
            appName: InternalApi.Z_APP,
            timeout: options.timeout ? options.timeout : 10000,
            failedProbesThreshold: options.failedProbesThreshold,
            pingInterval: options.pingInterval,
            authToken: options.authToken,
            custom: {
                username: options.username,
                password: options.password,
                nickname: options.nickname,
                device: options.device,
                details: options.details
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
            authToken: string,
        }>(async (resolve, reject) => {
            try {
                const userCredentials = await this.#connection.connect(connectionConfig);
                self.#_user = {
                    username: userCredentials.sipLogin,
                    email: userCredentials.email,
                    nickname: userCredentials.sipVisibleName,
                    authToken: userCredentials.authToken,
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
                            if (!!messageState.waitingUploadingAttachments) {
                                this.#uploadingAttachmentState[messageState.status.id] = messageState.messageWithUploadingAttachments;
                            }
                            if (!promises.resolve(data[0].internalMessageId, messageState.status)) {
                                this.#notifier.notify(SfuEvent.MESSAGE_STATE, messageState.status);
                            }
                        } else if (data[0].type === InternalApi.MESSAGE_ATTACHMENT_STATE) {
                            const attachmentState = data[0] as AttachmentStatusEvent;
                            promises.resolve(data[0].internalMessageId, attachmentState.status);
                            this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, attachmentState.status);
                        } else if (data[0].type === SfuEvent.LAST_READ_MESSAGE_UPDATED) {
                            const updateEvent = data[0] as LastReadMessageUpdated;
                            if (!promises.resolve(data[0].internalMessageId, updateEvent)) {
                                this.#notifier.notify(SfuEvent.LAST_READ_MESSAGE_UPDATED, updateEvent);
                            }
                        } else if (data[0].type === SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS) {
                            const updateEvent = data[0] as UpdateMessagesDeliveryStatusEvent;
                            if (!promises.resolve(data[0].internalMessageId, updateEvent)) {
                                this.#notifier.notify(SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS, updateEvent);
                            }
                        } else if (data[0].type === InternalApi.SFU_ATTACHMENT_REQUEST_ACK) {
                            const ack = data[0] as AttachmentRequestAck;
                            const request = ack.attachmentRequest as AttachmentRequest;
                            const state = this.#downloadingAttachmentState.find(s => s.messageId === ack.attachmentRequest.messageId);
                            if (!state) {
                                this.#downloadingAttachmentState.push({
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
                            //TODO: optimize - should use with if (zapp-420)
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
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().username, this.user().nickname, state.creationTime, state.config, state.waitingRoomEnabled, this.#loggerPrefix);
                            this.#rooms[room.id()] = room;
                            const self = this;
                            const cleanup = () => {
                                self.closePcAndFireEvent(room);
                                delete self.#rooms[room.id()];
                            };
                            room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
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
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().username, this.user().nickname, state.creationTime, state.config, state.waitingRoomEnabled, this.#loggerPrefix);
                            this.#rooms[room.id()] = room;
                            const self = this;
                            const cleanup = () => {
                                self.closePcAndFireEvent(room);
                                delete self.#rooms[room.id()];
                            };
                            room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
                                    cleanup();
                                }
                            }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                if (participant.userId === room.userId()) {
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
                                const room = new RoomExtended(this.#connection, info.id, info.owner, info.name, info.pin, this.user().username, this.user().nickname, info.creationTime, info.config, info.waitingRoomEnabled, this.#loggerPrefix);
                                this.#rooms[room.id()] = room;
                                const self = this;
                                const cleanup = () => {
                                    self.closePcAndFireEvent(room);
                                    delete self.#rooms[room.id()];
                                };
                                room.on(RoomEvent.LEFT, function (participant: LeftRoom) {
                                    if (participant.userId === room.userId()) {
                                        cleanup();
                                    }
                                }).on(RoomEvent.EVICTED, function (participant: LeftRoom) {
                                    if (participant.userId === room.userId()) {
                                        cleanup();
                                    }
                                }).on(RoomEvent.DROPPED, function (participant: LeftRoom) {
                                    if (participant.userId === room.userId()) {
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
                        } else if (data[0].type === SfuEvent.USER_INFO_CHANGED) {
                            const event = data[0] as UserInfoChangedEvent;
                            if (this.#_user.username === event.userId) {
                                this.#_user.email = event.info.email;
                                this.#_user.nickname = event.info.nickname;
                            }
                            if (!promises.resolve(event.internalMessageId)) {
                                this.#notifier.notify(SfuEvent.USER_INFO_CHANGED, event);
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
                        } else if (data[0].type === SfuEvent.CHAT_MESSAGES_COUNT) {
                            const messagesCount = data[0] as ChatMessagesCount;
                            if (!promises.resolve(data[0].internalMessageId, messagesCount)) {
                                this.#notifier.notify(SfuEvent.CHAT_MESSAGES_COUNT, messagesCount);
                            }
                        } else if (data[0].type === SfuEvent.FIRST_AND_LAST_CHAT_MESSAGE) {
                            const info = data[0] as FirstAndLastChatMessage;
                            if (!promises.resolve(data[0].internalMessageId, info)) {
                                this.#notifier.notify(SfuEvent.FIRST_AND_LAST_CHAT_MESSAGE, info);
                            }
                        } else if (data[0].type === SfuEvent.MESSAGE_ATTACHMENTS_SEARCH_RESULT) {
                            const result = data[0] as MessageAttachmentsSearchResult;
                            if (!promises.resolve(data[0].internalMessageId, result)) {
                                this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENTS_SEARCH_RESULT, result);
                            }
                        } else if (data[0].type === SfuEvent.LOAD_BOOKMARKED_MESSAGES_RESULT) {
                            const result = data[0] as LoadBookmarkedMessagesResult;
                            if (!promises.resolve(data[0].internalMessageId, result)) {
                                this.#notifier.notify(SfuEvent.LOAD_BOOKMARKED_MESSAGES_RESULT, result);
                            }
                        } else if (data[0].type === SfuEvent.LOAD_MESSAGES_WITH_MENTIONS_RESULT) {
                            const result = data[0] as LoadMessagesWithMentionsResult;
                            if (!promises.resolve(data[0].internalMessageId, result)) {
                                this.#notifier.notify(SfuEvent.LOAD_MESSAGES_WITH_MENTIONS_RESULT, result);
                            }
                        } else if (data[0].type === SfuEvent.BOOKMARK_DELETED) {
                            const event = data[0] as BookmarkDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SfuEvent.BOOKMARK_DELETED, event);
                            }
                        } else if (data[0].type === SfuEvent.BOOKMARK_EDITED) {
                            const bookmarkEdited = data[0] as BookmarkEdited;
                            if (!promises.resolve(data[0].internalMessageId, bookmarkEdited)) {
                                this.#notifier.notify(SfuEvent.BOOKMARK_EDITED, bookmarkEdited);
                            }
                        } else if (data[0].type === SfuEvent.CHAT_WITH_BOOKMARKS_DELETED) {
                            const event = data[0] as ChatWithBookmarksDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SfuEvent.CHAT_WITH_BOOKMARKS_DELETED, event);
                            }
                        } else if (data[0].type === SfuEvent.SEND_MESSAGE_SYNC) {
                            const message = (data[0] as SfuMessageEvent).message;
                            this.#notifier.notify(SfuEvent.SEND_MESSAGE_SYNC, message);
                        } else if (data[0].type === SfuEvent.AUTHENTICATION_STATUS) {
                            const event = data[0] as AuthenticationStatusEvent;
                            this.#notifier.notify(SfuEvent.AUTHENTICATION_STATUS, event);
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
                        const headerSize = 4;
                        const buffer = new Uint8Array(data);
                        const messageTransferId = buffer[1];
                        const attachmentTransferId = buffer[2];
                        const eof = buffer[headerSize - 1];
                        const attachment = this.#downloadingAttachmentState.find((attachment) => attachment.attachmentTransferId === attachmentTransferId && attachment.messageTransferId === messageTransferId);
                        if (attachment) {
                            if (!attachment.payload) {
                                attachment.payload = data.slice(headerSize, data.byteLength);
                            } else {
                                //ToDo (igor): optimize ArrayBuffer merging
                                const newData = new Uint8Array(attachment.payload.byteLength + (data.byteLength - headerSize));
                                newData.set(new Uint8Array(attachment.payload), 0);
                                newData.set(new Uint8Array(data.slice(headerSize, data.byteLength)), attachment.payload.byteLength);
                                attachment.payload = newData.buffer;
                            }
                            if (eof === 1) {
                                this.#notifyMessageAttachmentState(attachment, AttachmentState.DOWNLOADED);
                                const index = this.#downloadingAttachmentState.indexOf(attachment);
                                this.#downloadingAttachmentState.splice(index, 1);
                                // ToDo (igor): need to resolve or reject in any case
                                promises.resolve(attachment.internalMessageId, attachment);
                            } else {
                                this.#notifyMessageAttachmentState(attachment, AttachmentState.PENDING);
                            }
                        } else {
                            this.#logger.info("Unable to find attachment with messageTransferId " + messageTransferId + " attachmentTransferId " + attachmentTransferId);
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
                self.#downloadingAttachmentState.length = 0;
                self.#uploadingAttachmentState = {};
                const event: ConnectionFailedEvent = {
                    reason: e.reason,
                    code: e.code as number,
                    type: SfuEvent.DISCONNECTED,
                    roomId: '',
                    internalMessageId: ''
                }
                if (e.reason === 'Normal disconnect') {
                    self.#notifier.notify(SfuEvent.DISCONNECTED, event);
                } else {
                    event.type = SfuEvent.CONNECTION_FAILED;
                    self.#notifier.notify(SfuEvent.CONNECTION_FAILED, event);
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

    public resetPassword(options: {
        url: string,
        timeout?: number,
        email: string
    }) {
        const connectionConfig = this.#getConnectionConfigForAnonymousUser(options.url, options.timeout);
        const self = this;

        const resetPasswordRequest = async (): Promise<ResetPasswordRequestStatus> => {
            return new Promise<ResetPasswordRequestStatus>(function (resolve, reject) {
                const promiseId = uuidv4();
                self.#resetPasswordId = promiseId;
                promises.add(promiseId, resolve, reject);
                self.#connection.send(InternalApi.RESET_PASSWORD_REQUEST, {
                    email: options.email,
                    internalMessageId: promiseId
                });
            });
        };

        const resetPassword = async (password: string): Promise<void> => {
            return new Promise<void>(function (resolve, reject) {
                const promiseId = uuidv4();
                self.#resetPasswordId = promiseId;
                promises.add(promiseId, resolve, reject);
                self.#connection.send(InternalApi.RESET_PASSWORD, {
                    email: options.email,
                    password: password,
                    internalMessageId: promiseId
                });
            });
        }

        return new Promise<ResetPasswordHandler>(async (resolve, reject) => {
            if (self.#resetPasswordId && promises.promised(self.#resetPasswordId)) {
                promises.reject(self.#resetPasswordId, new Error(UserManagementError.EMAIL_IS_NOT_VERIFIED));
                self.#resetPasswordId = '';
            }
            if (self.#_state === State.CONNECTED) {
                await self.disconnect();
            }
            self.#connection = new Connection(
                (name: string, data: InternalMessage[]) => {
                    if (name === InternalApi.DEFAULT_METHOD) {
                        if (data[0].type === SfuEvent.RESET_PASSWORD_REQUEST_STATUS) {
                            const status = data[0] as ResetPasswordRequestStatus;
                            if (status.confirmed) {
                                promises.resolve(data[0].internalMessageId, status);
                                self.#resetPasswordId = '';
                                this.#notifier.notify(SfuEvent.RESET_PASSWORD_REQUEST_STATUS, status);
                            } else {
                                this.#notifier.notify(SfuEvent.RESET_PASSWORD_REQUEST_STATUS, status);
                            }
                        } else if (data[0].type === SfuEvent.ACK && promises.promised(data[0].internalMessageId)) {
                            promises.resolve(data[0].internalMessageId);
                            self.#resetPasswordId = '';
                            self.disconnect();
                        } else if (data[0].type === RoomEvent.OPERATION_FAILED && promises.promised(data[0].internalMessageId)) {
                            promises.reject(data[0].internalMessageId, data[0] as OperationFailedEvent);
                            self.#resetPasswordId = '';
                            self.disconnect();
                        }
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
                        promises.reject(self.#resetPasswordId, new Error(UserManagementError.OPERATION_FAILED_BY_DISCONNECT));
                        self.#resetPasswordId = '';
                        self.#_state = State.DISCONNECTED;
                        self.disconnect();
                    } else {
                        promises.reject(self.#resetPasswordId, new Error(UserManagementError.CONNECTION_FAILED));
                        self.#resetPasswordId = '';
                        self.#_state = State.DISCONNECTED;
                        self.disconnect();
                    }
                },
                this.#logger);
            await self.#connection.connect(connectionConfig);
            self.#_state = State.CONNECTED;
            let status;
            try {
                status = await resetPasswordRequest();
            } catch (error) {
                reject(error);
                return;
            }
            if (status.confirmed) {
                resolve(new ResetPasswordHandler(resetPassword));
            }
        })
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

    public logout() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<LastReadMessageUpdated>(function(resolve, reject) {
            self.#emmitAction(InternalApi.LOGOUT, {}, resolve, reject);
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

    /**
     * This method is recommended for using to generate attachment id before sending.
     * Sending and downloading attachments may not work with other generating options.
     * @return string of 36 ASCII characters
     **/
    public static generateAttachmentId(): string {
        return uuidv4();
    }

    public getSendingAttachmentsHandler(attachments: Array<MessageAttachmentData>, messageId: string) {
        const self = this;
        const messageWithAttachmentsState = self.#uploadingAttachmentState[messageId];
        if (!messageWithAttachmentsState) {
            return;
        }

        const messageTransferId = messageWithAttachmentsState.messageTransferId;
        const cancelledAttachments: {[key: number]: {status: AttachmentStatus}} = {};
        let promiseForWaitResultMessageStatus: {resolve: Function, reject: Function};
        let resultMessageStatus: MessageStatus;
        let attachmentsIsReady = false;

        function getAttachmentTransferId(attachmentId: string) {
            return messageWithAttachmentsState.attachmentsInfo.find((attachmentInfo) => attachmentInfo.id === attachmentId).attachmentTransferId;
        }

        function sendMessageWithAttachments(messageId: string) {
            return new Promise<MessageStatus>(function (resolve, reject) {
                promises.add(messageId, resolve, reject);
                self.#connection.send(InternalApi.SEND_MESSAGE_WITH_ATTACHMENTS, {
                    id: messageId,
                    transferId: messageTransferId
                });
            })
        }

        function cancelSendAttachment(attachmentId: string) {
            return new Promise<AttachmentStatus>(function (resolve, reject) {
                const attachmentTransferId = getAttachmentTransferId(attachmentId);
                self.#emmitAction(InternalApi.CANCEL_SENDING_ATTACHMENT, {
                    messageTransferId: messageTransferId,
                    attachmentTransferId: attachmentTransferId
                }, resolve, reject);
            })
        }

        function sendAttachmentChunk(data: Blob, messageTransferId: number, attachmentTransferId: number, end: number, index: number) {
            return new Promise<AttachmentStatus>(function (resolve, reject) {
                promises.add(messageTransferId.toString() + attachmentTransferId.toString(), resolve, reject);
                /**
                 * 4 -bytes header:
                 * 1st byte - command (10 - uploadAttachment)
                 * 2nd byte - message transfer id
                 * 3rd byte - attachment transfer id
                 * 4th byte - end of file (0 - false, 1 - true)
                 * @type {Uint8Array}
                 */

                const header = new Uint8Array(4);
                header[0] = 10;
                header[1] = messageTransferId;
                header[2] = attachmentTransferId;
                header[3] = end;
                const start = index * self.#binaryChunkSize;
                const chunk = new Blob([header, data.slice(start, start + self.#binaryChunkSize)]);
                self.#emmitBinaryAction(chunk);
            })
        }

        async function uploadAttachment(attachment: MessageAttachmentData) {
            return new Promise<AttachmentStatus>(async function (resolve, reject) {
                const {payload} = attachment;
                const attachmentTransferId = getAttachmentTransferId(attachment.id);
                const data = new Blob([payload]);
                const chunks = Math.ceil(data.size / self.#binaryChunkSize);
                for (let i = 0; i < chunks; i++) {
                    let end = 0;
                    if (i === chunks - 1) {
                        end = 1;
                    }
                    const cancellationPromise = cancelledAttachments[attachment.id];
                    if (cancellationPromise === undefined) {
                        const result = await sendAttachmentChunk(data, messageTransferId, attachmentTransferId, end, i);
                        const attachmentState = result as AttachmentStatus;
                        if (attachmentState.state === AttachmentState.UPLOADED) {
                            resolve(attachmentState);
                        }
                    } else {
                        delete cancelledAttachments[attachment.id];
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
        return new Promise<LastReadMessageUpdated>(function(resolve, reject) {
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
        return new Promise<LastReadMessageUpdated>(function(resolve, reject) {
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
        participantVideo: boolean,
        allowJoinAtAnyTime: boolean,
        useMuteAudioOnJoin: boolean,
        useLocalAutoRecord: boolean
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
        participantVideo: boolean,
        allowJoinAtAnyTime: boolean,
        useMuteAudioOnJoin: boolean,
        useLocalAutoRecord: boolean
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

    public getChatMessagesCount(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMessagesCount>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_CHAT_MESSAGES_COUNT, {
                chatId: chat.id
            }, resolve, reject);
        });
    }

    public getFirstAndLastMessage(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<FirstAndLastChatMessage>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_FIRST_AND_LAST_CHAT_MESSAGE, {
                chatId: chat.id
            }, resolve, reject);
        });
    }

    public searchMessageAttachments(params: {
        chatId?: string,
        attachmentsType?: MessageAttachmentMediaType,
        bookmarkedOnly: boolean,
        from?: UserId,
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
        searchString?: string,
        sortOrder: SortOrder
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<MessageAttachmentsSearchResult>(function (resolve, reject) {
            self.#emmitAction(InternalApi.SEARCH_MESSAGE_ATTACHMENTS, {
                chatId: params.chatId,
                attachmentsType: params.attachmentsType,
                bookmarkedOnly: params.bookmarkedOnly,
                from: params.from,
                timeFrame: params.timeFrame,
                boundaries: params.boundaries,
                searchString: params.searchString,
                sortOrder: params.sortOrder,
            }, resolve, reject);
        });
    };

    public loadBookmarkedMessages(params: {
        chatId?: string,
        timeFrame?: {
            start: number,
            end: number,
            limit?: number
        },
        pageRequest?: {
            page: number,
            pageSize: number
        }
        boundaries?: {
            dateMark: number,
            lowerLimit: number,
            upperLimit: number
        }
        sortOrder: SortOrder
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<LoadBookmarkedMessagesResult>(function (resolve, reject) {
            self.#emmitAction(InternalApi.LOAD_BOOKMARKED_MESSAGES, {
                chatId: params.chatId,
                timeFrame: params.timeFrame,
                pageRequest: params.pageRequest,
                boundaries: params.boundaries,
                sortOrder: params.sortOrder,
            }, resolve, reject);
        });
    };

    public loadMessagesWithMentions(params: {
        chatId?: string,
        userTag: string,
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
        sortOrder: SortOrder
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<LoadMessagesWithMentionsResult>(function (resolve, reject) {
            self.#emmitAction(InternalApi.LOAD_MESSAGES_WITH_MENTIONS, {
                chatId: params.chatId,
                userTag: params.userTag,
                timeFrame: params.timeFrame,
                boundaries: params.boundaries,
                sortOrder: params.sortOrder,
            }, resolve, reject);
        });
    };

    public createChat(chat: {
        id?: string,
        name?: string,
        members?: Array<UserId>,
        favourite?: boolean,
        channel?: boolean,
        type?: ChatType,
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
                type: chat.type,
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
        attachmentIdsToDelete?: string[]
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

    public addMessageToBookmarks(msg: {
        chatId: string,
        messageId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_MESSAGE_TO_BOOKMARKS, {
                id: msg.messageId,
                chatId: msg.chatId
            }, resolve, reject);
        });
    }

    public removeMessageFromBookmarks(msg: {
        chatId: string,
        messageId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_MESSAGE_FROM_BOOKMARKS, {
                chatId: msg.chatId,
                id: msg.messageId
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
        type?: ChatType,
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
        participantVideo: boolean,
        allowJoinAtAnyTime: boolean,
        useMuteAudioOnJoin: boolean,
        useLocalAutoRecord: boolean
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

    public static strToUTF8Array(str: string): Array<number> {
        let utf8Arr: Array<number> = [];
        for (let i = 0; i < str.length; i++) {
            let charCode = str.charCodeAt(i);
            if (charCode < 0x80) utf8Arr.push(charCode);
            else if (charCode < 0x800) {
                utf8Arr.push(0xc0 | (charCode >> 6),
                    0x80 | (charCode & 0x3f));
            } else if (charCode < 0xd800 || charCode >= 0xe000) {
                utf8Arr.push(0xe0 | (charCode >> 12),
                    0x80 | ((charCode >> 6) & 0x3f),
                    0x80 | (charCode & 0x3f));
            } else {
                i++;
                charCode = ((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff)
                utf8Arr.push(0xf0 | (charCode >> 18),
                    0x80 | ((charCode >> 12) & 0x3f),
                    0x80 | ((charCode >> 6) & 0x3f),
                    0x80 | (charCode & 0x3f));
            }
        }
        return utf8Arr;
    }

    public static fromUTF8ArrayToStr(data: Uint8Array): string {
        let str = '';
        for (let i = 0; i < data.byteLength; i++) {
            let value = data[i];

            if (value < 0x80) {
                str += String.fromCharCode(value);
            } else if (value > 0xBF && value < 0xE0) {
                str += String.fromCharCode((value & 0x1F) << 6 | data[i + 1] & 0x3F);
                i += 1;
            } else if (value > 0xDF && value < 0xF0) {
                str += String.fromCharCode((value & 0x0F) << 12 | (data[i + 1] & 0x3F) << 6 | data[i + 2] & 0x3F);
                i += 2;
            } else {
                let charCode = ((value & 0x07) << 18 | (data[i + 1] & 0x3F) << 12 | (data[i + 2] & 0x3F) << 6 | data[i + 3] & 0x3F) - 0x010000;
                str += String.fromCharCode(charCode >> 10 | 0xD800, charCode & 0x03FF | 0xDC00);
                i += 3;
            }
        }
        return str;
    }

    private closePcAndFireEvent(room: RoomExtended) {
        if (this.#rooms[room.id()].pc()) {
            this.#rooms[room.id()].pc().close();
            // zapp-28, react-native-webrtc will fire 'connectionstatechange' event
            if (typeof document !== 'undefined') {
                this.#rooms[room.id()].pc().dispatchEvent(new Event("connectionstatechange"));
            }
        }
    }
}
