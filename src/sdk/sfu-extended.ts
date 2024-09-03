import {v4 as uuidv4} from 'uuid';
import promises from "./promises";
import {Connection} from "./connection";
import {
    AddedRoleToMember,
    Attachment,
    ATTACHMENT_CHUNK_SIZE,
    AttachmentRequest,
    AttachmentRequestAck,
    AttachmentState,
    AttachmentStatus,
    AttachmentStatusEvent,
    AuthenticationStatusEvent,
    Calendar,
    CalendarEvent,
    CalendarEventEvent,
    SfuSpaceCategory,
    ChannelSendPolicy,
    Chat,
    ChatError,
    ChatLoadedEvent,
    ChatMap,
    ChatMessagesCount,
    ChatMessagesEvent,
    ChatReceivePolicy,
    ChatSearchResultEvent,
    ChatsEvent,
    ChatType,
    ConnectionDetails,
    ConnectionFailedEvent,
    ContactInviteEvent,
    ContactRemovedEvent,
    ContactUpdateEvent,
    CreatedRoom,
    FirstAndLastChatMessage,
    InternalApi,
    InternalMessage,
    Invite,
    LastReadMessageUpdated,
    LeftRoom,
    LoadMessagesWithMentionsResult,
    Message,
    MessageAttachment,
    MessageAttachmentData,
    MessageAttachmentMediaType,
    MessageAttachmentsSearchResult,
    MessageDeleted,
    MessageEdited,
    MessageStatus,
    MessageStatusEvent,
    MessageWithUploadingAttachments,
    NewChatEvent,
    NewSpaceRoleAdded,
    NewSpaceCategoryEvent,
    OperationFailedEvent,
    Operations,
    PublicChannelsEvent,
    RemovedChatEvent,
    ResetPasswordRequestStatus,
    RoomAvailable,
    RoomEvent,
    RoomInfo,
    SfuEvent,
    SfuMessageEvent,
    SignUpStatus,
    SortOrder,
    SfuSpace,
    SpaceInviteCreated,
    SfuSpaceRole,
    State,
    UpdateChatEvent,
    UpdateMessagesDeliveryStatusEvent,
    User,
    UserCalendarEvent,
    UserEmail,
    UserHostKey,
    UserId,
    UserInfo,
    UserInfoChangedEvent,
    UserInfoEvent,
    UserListEvent,
    UserManagementError,
    UserNickname,
    UserPassword,
    UserPhoneNumber,
    UserPmiSettings,
    UserRoomsEvent,
    UserSpacesEvent,
    UserSpecificChatInfo,
    UserTimezone,
    SfuSpaceInvite,
    NewSpaceEvent,
    NewSpaceChannelEvent,
    SfuSpaceChannel,
    UserJoinedToSpaceEvent,
    SpaceRoleDeleted,
    RemovedRoleFromMember,
    SpaceCategoryDeleted,
    SpaceChannelDeleted,
    SpaceDeletedEvent,
    SpaceOverviewUpdated,
    SpaceCategoryUpdated,
    UserLeftSpace,
    NewSpaceThreadEvent,
    SfuSpaceThread,
    SpaceThreadDeleted,
    SpaceThreadUpdated,
    SpaceChannelUpdated,
    SfuSpaceRolePermissionSection,
    RolePermissionSectionsEvent,
    SpaceRoleUpdated,
    SpaceInviteRevoked,
    SpaceChannelMoved,
    SpaceEvent,
    MessageTargetEntityType,
    MessageTargetEntityId,
    SpaceCreatedEvent,
    NewMeeting,
    MeetingSyncEvent,
    JoinedRoomSync,
    AddRemoveTracksSync,
    ParticipantsListSyncEvent,
    MeetingEndedSync,
    LeftMeetingSync,
    MeetingsPreviewEvent,
    EvictedSync,
    MeetingNameUpdatedSync,
    UnreadMessagesCountEvent,
    UnreadMessagesCountUpdate,
} from "./constants";
import {Notifier} from "./notifier";
import {RoomExtended} from "./room-extended";
import {SendingAttachmentsHandler} from "./sending-attachments-handler";
import Logger, {PrefixFunction, Verbosity} from "./logger";
import {ResetPasswordHandler} from "./reset-password-handler";

type NotifyUnion = InternalMessage | Message | MessageStatus | AttachmentStatus | Array<User> | Calendar | UserSpecificChatInfo | Invite | User | ChatMap | Chat | ArrayBuffer | CalendarEvent | Attachment | UserInfo | Array<SfuSpace>;

type EventUnion = SfuEvent | SpaceEvent | MeetingSyncEvent;

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
    #notifier: Notifier<EventUnion, NotifyUnion> = new Notifier<SfuEvent, NotifyUnion>();
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

    /**
     * Connects the user to the server.
     *
     * The user can connect using either a username and password or an authToken.
     *
     * Once the connection is successful, the {@link state} will change to {@link State.AUTHENTICATED}.
     * After that, the sfu-sdk will emit the event {@link SfuEvent.CONNECTED}.
     *
     * @param options.username - The user's username (optional if `authToken` is provided).
     * @param options.password - The user's password (optional if `authToken` is provided).
     * @param options.authToken - The authentication token for direct login (optional if `username` and `password` are provided).
     */
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
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().username, this.user().nickname, state.creationTime, state.config, state.waitingRoomEnabled, this.#loggerPrefix, state.conferenceType);
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
                            const room = new RoomExtended(this.#connection, state.roomId, state.owner, state.name, state.pin, this.user().username, this.user().nickname, state.creationTime, state.config, state.waitingRoomEnabled, this.#loggerPrefix, state.conferenceType);
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
                        } else if (data[0].type === SfuEvent.UNREAD_MESSAGES_COUNT) {
                            const event = data[0] as UnreadMessagesCountEvent;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SfuEvent.UNREAD_MESSAGES_COUNT, event);
                            }
                        } else if (data[0].type === SfuEvent.UNREAD_MESSAGES_COUNT_UPDATE) {
                            const event = data[0] as UnreadMessagesCountUpdate;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SfuEvent.UNREAD_MESSAGES_COUNT_UPDATE, event);
                            }
                        } else if (data[0].type === SfuEvent.MESSAGE_ATTACHMENTS_SEARCH_RESULT) {
                            const result = data[0] as MessageAttachmentsSearchResult;
                            if (!promises.resolve(data[0].internalMessageId, result)) {
                                this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENTS_SEARCH_RESULT, result);
                            }
                        } else if (data[0].type === SfuEvent.LOAD_MESSAGES_WITH_MENTIONS_RESULT) {
                            const result = data[0] as LoadMessagesWithMentionsResult;
                            if (!promises.resolve(data[0].internalMessageId, result)) {
                                this.#notifier.notify(SfuEvent.LOAD_MESSAGES_WITH_MENTIONS_RESULT, result);
                            }
                        } else if (data[0].type === SfuEvent.SEND_MESSAGE_SYNC) {
                            const message = (data[0] as SfuMessageEvent).message;
                            this.#notifier.notify(SfuEvent.SEND_MESSAGE_SYNC, message);
                        } else if (data[0].type === SfuEvent.AUTHENTICATION_STATUS) {
                            const event = data[0] as AuthenticationStatusEvent;
                            this.#notifier.notify(SfuEvent.AUTHENTICATION_STATUS, event);
                        } else if (data[0].type === SpaceEvent.SPACE_CREATED) {
                            const event = data[0] as SpaceCreatedEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.space)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CREATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.NEW_SPACE) {
                            const event = data[0] as NewSpaceEvent;
                            promises.resolve(data[0].internalMessageId, event.space)
                            this.#notifier.notify(SpaceEvent.NEW_SPACE, event);
                        } else if (data[0].type === SpaceEvent.SPACE_DELETED) {
                            const event = data[0] as SpaceDeletedEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.id)) {
                                this.#notifier.notify(SpaceEvent.SPACE_DELETED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_OVERVIEW_UPDATED) {
                            const event = data[0] as SpaceOverviewUpdated;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_OVERVIEW_UPDATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.NEW_SPACE_CATEGORY) {
                            const event = data[0] as NewSpaceCategoryEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.category)) {
                                this.#notifier.notify(SpaceEvent.NEW_SPACE_CATEGORY, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_CATEGORY_DELETED) {
                            const event = data[0] as SpaceCategoryDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CATEGORY_DELETED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_CATEGORY_UPDATED) {
                            const event = data[0] as SpaceCategoryUpdated;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CATEGORY_UPDATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.NEW_SPACE_CHANNEL) {
                            const event = data[0] as NewSpaceChannelEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.channel)) {
                                this.#notifier.notify(SpaceEvent.NEW_SPACE_CHANNEL, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_CHANNEL_UPDATED) {
                            const event = data[0] as SpaceChannelUpdated;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CHANNEL_UPDATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_CHANNEL_DELETED) {
                            const event = data[0] as SpaceChannelDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CHANNEL_DELETED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_CHANNEL_MOVED) {
                            const event = data[0] as SpaceChannelMoved;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_CHANNEL_MOVED, event);
                            }
                        } else if (data[0].type === SpaceEvent.NEW_SPACE_THREAD) {
                            const event = data[0] as NewSpaceThreadEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.thread)) {
                                this.#notifier.notify(SpaceEvent.NEW_SPACE_THREAD, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_THREAD_UPDATED) {
                            const event = data[0] as SpaceThreadUpdated;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_THREAD_UPDATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_THREAD_DELETED) {
                            const event = data[0] as SpaceThreadDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_THREAD_DELETED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_INVITE_CREATED) {
                            const event = data[0] as SpaceInviteCreated;
                            if (!promises.resolve(data[0].internalMessageId, event.invite)) {
                                this.#notifier.notify(SpaceEvent.SPACE_INVITE_CREATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_INVITE_REVOKED) {
                            const event = data[0] as SpaceInviteRevoked;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_INVITE_REVOKED, event);
                            }
                        } else if (data[0].type === SpaceEvent.NEW_SPACE_ROLE) {
                            const event = data[0] as NewSpaceRoleAdded;
                            if (!promises.resolve(data[0].internalMessageId, event.role)) {
                                this.#notifier.notify(SpaceEvent.NEW_SPACE_ROLE, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_ROLE_UPDATED) {
                            const event = data[0] as SpaceRoleUpdated;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_ROLE_UPDATED, event);
                            }
                        } else if (data[0].type === SpaceEvent.SPACE_ROLE_DELETED) {
                            const event = data[0] as SpaceRoleDeleted;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.SPACE_ROLE_DELETED, event);
                            }
                        } else if (data[0].type === SpaceEvent.ADDED_ROLE_TO_MEMBER) {
                            const event = data[0] as AddedRoleToMember;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.ADDED_ROLE_TO_MEMBER, event);
                            }
                        } else if (data[0].type === SpaceEvent.REMOVED_ROLE_FROM_MEMBER) {
                            const event = data[0] as RemovedRoleFromMember;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.REMOVED_ROLE_FROM_MEMBER, event);
                            }
                        } else if (data[0].type === SpaceEvent.USER_SPACES) {
                            const event = data[0] as UserSpacesEvent;
                            promises.resolve(data[0].internalMessageId, event.spaces)
                            this.#notifier.notify(SpaceEvent.USER_SPACES, event.spaces);
                        } else if (data[0].type === SpaceEvent.USER_JOINED_TO_SPACE) {
                            const event = data[0] as UserJoinedToSpaceEvent;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.USER_JOINED_TO_SPACE, event);
                            }
                        } else if (data[0].type === SpaceEvent.USER_LEFT_SPACE) {
                            const event = data[0] as UserLeftSpace;
                            if (!promises.resolve(data[0].internalMessageId, event)) {
                                this.#notifier.notify(SpaceEvent.USER_LEFT_SPACE, event);
                            }
                        } else if (data[0].type === SpaceEvent.ROLE_PERMISSION_SECTIONS) {
                            const event = data[0] as RolePermissionSectionsEvent;
                            if (!promises.resolve(data[0].internalMessageId, event.permissionSections)) {
                                this.#notifier.notify(SpaceEvent.ROLE_PERMISSION_SECTIONS, event);
                            }
                        } else if (data[0].type === SfuEvent.USER_MEETINGS) {
                            const event = data[0] as MeetingsPreviewEvent;
                            this.#notifier.notify(SfuEvent.USER_MEETINGS, event);
                        } else if (data[0].type === SfuEvent.NEW_MEETING) {
                            const event = data[0] as NewMeeting;
                            this.#notifier.notify(SfuEvent.NEW_MEETING, event);
                        } else if (data[0].type === MeetingSyncEvent.MEETING_ENDED_SYNC) {
                            const event = data[0] as MeetingEndedSync;
                            this.#notifier.notify(MeetingSyncEvent.MEETING_ENDED_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.JOINED_MEETING_SYNC) {
                            const event = data[0] as JoinedRoomSync;
                            this.#notifier.notify(MeetingSyncEvent.JOINED_MEETING_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.LEFT_MEETING_SYNC) {
                            const event = data[0] as LeftMeetingSync;
                            this.#notifier.notify(MeetingSyncEvent.LEFT_MEETING_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.EVICTED_SYNC) {
                            const event = data[0] as EvictedSync;
                            this.#notifier.notify(MeetingSyncEvent.EVICTED_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.ADD_TRACKS_SYNC) {
                            const event = data[0] as AddRemoveTracksSync;
                            this.#notifier.notify(MeetingSyncEvent.ADD_TRACKS_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.REMOVE_TRACKS_SYNC) {
                            const event = data[0] as AddRemoveTracksSync;
                            this.#notifier.notify(MeetingSyncEvent.REMOVE_TRACKS_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.MUTE_TRACKS_SYNC) {
                            const event = data[0] as AddRemoveTracksSync;
                            this.#notifier.notify(MeetingSyncEvent.MUTE_TRACKS_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.PARTICIPANT_LIST_SYNC) {
                            const event = data[0] as ParticipantsListSyncEvent;
                            this.#notifier.notify(MeetingSyncEvent.PARTICIPANT_LIST_SYNC, event);
                        } else if (data[0].type === MeetingSyncEvent.MEETING_NAME_UPDATED_SYNC) {
                            const event = data[0] as MeetingNameUpdatedSync;
                            this.#notifier.notify(MeetingSyncEvent.MEETING_NAME_UPDATED_SYNC, event);
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

    /**
     * Method to disconnect from the server
     *
     * When disconnecting, user leaves all active rooms
     *
     * {@link state} changed to {@link State.DISCONNECTED | DISCONNECTED}
     */
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

    /**
     * Sign up for new users
     *
     * Works in a separate connection
     */
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

    /**
     * Reset password
     *
     * When calls, returns {@link ResetPasswordHandler} then need to call {@link ResetPasswordHandler.resetPassword} to reset the password
     */
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

    /**
     * Remove user (internal using)
     */
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

    /**
     * Logout from app
     */
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

    /**
     * Load messages for Direct chat | Channel | Thread
     *
     * @param params.timeFrame to load by start date to end date. For load all messages used with start = 0, end = -1.
     * @param params.boundaries to load messages by specifying a particular message using its date,
     * along with the number of messages above and below it. Upper limit includes message with date dateMark.
     */
    public loadMessages(params: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
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
            self.#emmitAction(InternalApi.LOAD_MESSAGES, params, resolve, reject);
        });
    };

    /**
     * Send a message to a Direct chat | Channel | Thread
     *
     * Members will receive {@link SfuEvent.MESSAGE} with {@link Message}
     *
     * @param msg.parentId to send reply message
     * @param msg.to to send a private message
     */
    public sendMessage(msg: {
        body?: string,
        to?: string,
        parentId?: string,
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
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
            } else {
                self.#emmitAction(InternalApi.SEND_MESSAGE, {
                    to: msg.to,
                    parentId: msg.parentId,
                    body: msg.body,
                    targetEntityType: msg.targetEntityType,
                    targetEntityId: msg.targetEntityId,
                    attachments: msg.attachments
                }, resolve, reject);
            }
        });
    };

    /**
     * Edit a message in a Direct chat | Channel | Thread
     *
     * Members will receive {@link SfuEvent.CHAT_MESSAGE_EDITED} with {@link MessageEdited}
     *
     * @param msg.attachmentsToSend to add attachments to sent message
     * @param msg.attachmentIdsToDelete to send a private message
     */
    public editMessage(msg: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
        messageId: string,
        body: string,
        attachmentsToSend?: Array<MessageAttachment>,
        attachmentIdsToDelete?: string[]
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<MessageStatus>(function (resolve, reject) {
            self.#emmitAction(InternalApi.EDIT_MESSAGE, {
                id: msg.messageId,
                targetEntityType: msg.targetEntityType,
                targetEntityId: msg.targetEntityId,
                body: msg.body,
                attachments: msg.attachmentsToSend,
                attachmentIdsToDelete: msg.attachmentIdsToDelete
            }, resolve, reject);
        });
    }

    /**
     * Delete a message in a Direct chat | Channel | Thread
     *
     * The message body will be changed to an empty string.
     * The {@link Message.status} will be changed to {@link MessageState.DELETED}
     *
     * Attachments will be removed.
     *
     * Members will receive {@link SfuEvent.CHAT_MESSAGE_DELETED} with {@link MessageDeleted}
     */
    public deleteMessage(msg: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
        messageId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_MESSAGE, {
                id: msg.messageId,
                targetEntityType: msg.targetEntityType,
                targetEntityId: msg.targetEntityId,
            }, resolve, reject);
        });
    }

    /**
     * Mark message as read in a Direct chat | Channel | Thread
     *
     * In targetEntity will change lastReadMessageId and lastReadMessageDate
     *
     * All unread messages with a {@link Message.date} earlier than or equal to the marked one will be marked as read.
     * The sender of each message will receive {@link SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS}
     * with {@link UpdateMessagesDeliveryStatusEvent} and {@link Message.deliveryStatus} will be changed at the server side to {@link DeliveryStatus.READ}.
     */
    public markMessageRead(msg: {
        id: string,
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<LastReadMessageUpdated>(function (resolve, reject) {
            if (!msg) {
                reject(new Error("Can't mark null message"));
            } else if (!msg.id || msg.id === "") {
                reject(new Error("Can't mark message without massage id"));
            } else {
                self.#emmitAction(InternalApi.MARK_MESSAGE_READ, {
                    id: msg.id,
                    targetEntityType: msg.targetEntityType,
                    targetEntityId: msg.targetEntityId,
                }, resolve, reject);
            }
        });
    }

    /**
     * Mark message as unread in a Direct chat | Channel | Thread
     *
     * In targetEntity will change lastReadMessageId and lastReadMessageDate. {@link Message.deliveryStatus}
     *
     * {@link Message.deliveryStatus} will not be changed at the server side. Senders will not receive events,
     * however if the previous lastReadMessageDate is earlier than the updated value,
     * the senders of those messages will receive {@link SfuEvent.UPDATE_MESSAGES_DELIVERY_STATUS}
     * with {@link UpdateMessagesDeliveryStatusEvent} and {@link Message.deliveryStatus} will be changed at the server side to {@link DeliveryStatus.READ}.
     */
    public markMessageUnread(msg: {
        id: string,
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<LastReadMessageUpdated>(function (resolve, reject) {
            if (!msg) {
                reject(new Error("Can't mark null message"));
            } else if (!msg.id || msg.id === "") {
                reject(new Error("Can't mark message without massage id"));
            } else {
                self.#emmitAction(InternalApi.MARK_MESSAGE_UNREAD, {
                    id: msg.id,
                    targetEntityType: msg.targetEntityType,
                    targetEntityId: msg.targetEntityId,
                }, resolve, reject);
            }
        });
    }

    /**
     * Get messages count in entity from {@link MessageTargetEntityType}
     */
    public getMessagesCount(options: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMessagesCount>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_MESSAGES_COUNT, {
                targetEntityType: options.targetEntityType,
                targetEntityId: options.targetEntityId
            }, resolve, reject);
        });
    }

    /**
     * Get first message and last message in entity from {@link MessageTargetEntityType}
     */
    public getFirstAndLastMessage(options: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<FirstAndLastChatMessage>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_FIRST_AND_LAST_MESSAGE, {
                targetEntityType: options.targetEntityType,
                targetEntityId: options.targetEntityId
            }, resolve, reject);
        });
    }

    /**
     * Get count of unread messages in entity from {@link MessageTargetEntityType}
     */
    public getUnreadMessagesCount(options: {
        targetEntityType: MessageTargetEntityType,
        targetEntityId: MessageTargetEntityId,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UnreadMessagesCountEvent>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_UNREAD_MESSAGES_COUNT, {
                targetEntityType: options.targetEntityType,
                targetEntityId: options.targetEntityId
            }, resolve, reject);
        });
    }

    /**
     * This method is recommended for using to generate attachment id before sending.
     * Sending and downloading attachments may not work with other generating options.
     * @return string of 36 ASCII characters
     **/
    public static generateAttachmentId(): string {
        return uuidv4();
    }

    /**
     * Get handler for send or cancel sending attachments
     *
     * Can't cancel sent attachment
     */
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
                            cancelledAttachments[attachment.id] = {status: result};
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

    /**
     * Load attachment from server
     *
     * On client side should receive {@link SfuEvent.MESSAGE_ATTACHMENT_STATE} with {@link AttachmentStatus} to show progress
     */
    public getMessageAttachment(attachment: AttachmentRequest) {
        this.#checkAuthenticated();
        const self = this;
        const {targetEntityType, targetEntityId, messageId, attachmentId, name} = attachment;
        if (!messageId || messageId === '') {
            throw new Error('Empty messageId');
        }
        if (!name || name === '') {
            throw new Error('Empty attachment name');
        }
        if (attachmentId === null) {
            throw new Error('Empty attachment id');
        }
        return new Promise<Attachment>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_ATTACHMENT, {
                targetEntityType: targetEntityType,
                targetEntityId: targetEntityId,
                messageId: messageId,
                attachmentId: attachmentId,
                name: name,
                size: self.#binaryChunkSize
            }, resolve, reject);
        })
    }

    #notifyMessageAttachmentState(attachment: Attachment, state: AttachmentState) {
        const status: AttachmentStatus = {
            targetEntityType: attachment.targetEntityType,
            targetEntityId: attachment.targetEntityId,
            messageId: attachment.messageId,
            id: attachment.attachmentId,
            name: attachment.name,
            state: state,
            downloadedSize: attachment.payload.byteLength
        };
        this.#notifier.notify(SfuEvent.MESSAGE_ATTACHMENT_STATE, status);
    }

    /**
     * Get all users from server
     */
    public getUserList() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<User>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_LIST, {}, resolve, reject);
        });
    };

    /**
     * Invite user to contacts
     *
     * UserId must be passed if user exist. That user will receive {@link SfuEvent.CONTACT_INVITE} with {@link Invite}
     *
     * UserEmail must be passed if there is no such user yet. In this case user will be created at the server side with {@link UserState.PENDING_REGISTRATION} and default parameters
     */
    public inviteContact(invite: {
        to: UserId | UserEmail
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.INVITE_CONTACT, {from: self.#_user.username, to: invite.to}, resolve, reject);
        });
    }

    /**
     * Add contact to favourites
     *
     * {@link User.favourite} will be changed to true at the server side
     */
    public addContactToFavourites(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CONTACT_TO_FAVOURITES, {id: contact.id}, resolve, reject);
        });
    }

    /**
     * Remove contact from favourites
     *
     * {@link User.favourite} will be changed to false at the server side
     */
    public removeContactFromFavourites(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CONTACT_FROM_FAVOURITES, {id: contact.id}, resolve, reject);
        });
    }

    /**
     * Confirm contact
     *
     * {@link User.confirmed} will be changed to true for both users.
     *
     * @param invite.from - user with that userId will receive {@link SfuEvent.CONTACT_UPDATE} with {@link User}
     */
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

    /**
     * Confirm contact
     *
     * {@link User.confirmed} will be changed to true for both users.
     *
     * @param contact.id - user with that userId will receive {@link SfuEvent.CONTACT_REMOVED} with {@link User}
     */
    public removeContact(contact: {
        id: UserId
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<User>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CONTACT, {id: contact.id}, resolve, reject);
        });
    }

    /**
     * Get all user calendar events
     */
    public getUserCalendar() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Calendar>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_CALENDAR, {}, resolve, reject);
        });
    };

    /**
     * Add calendar event
     *
     * @param event.usePMI - if true then user PMI settings will be updated and user will receive {@link SfuEvent.UPDATE_USER_PMI_SETTINGS} with {@link UserPmiSettings}
     */
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

    /**
     * Update calendar event
     *
     * @param event.usePMI - if true then user PMI settings will be updated and user will receive {@link SfuEvent.UPDATE_USER_PMI_SETTINGS} with {@link UserPmiSettings}
     */
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

    /**
     * Get user pmi settings
     *
     * Used for create meetings
     */
    public getUserPmiSettings() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserPmiSettings>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_PMI_SETTINGS, {}, resolve, reject);
        });
    }

    /**
     * Update user pmi settings
     */
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

    /**
     * Get user info
     *
     * Usually used to display profile info
     */
    public getUserInfo() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_INFO, {}, resolve, reject);
        })
    }

    /**
     * Change user email
     *
     * Users will receive {@link SfuEvent.CONTACT_UPDATED} with changed email
     */
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

    /**
     * Change user email
     *
     * Users will receive {@link SfuEvent.CONTACT_UPDATED} with changed nickname
     */
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

    /**
     * @deprecated
     */
    public getPublicChannels() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMap>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_PUBLIC_CHANNELS, {}, resolve, reject);
        });
    };

    /**
     * @deprecated
     */
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

    /**
     * @deprecated
     */
    public searchMessageAttachments(params: {
        chatId?: string,
        attachmentsType?: MessageAttachmentMediaType,
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
                from: params.from,
                timeFrame: params.timeFrame,
                boundaries: params.boundaries,
                searchString: params.searchString,
                sortOrder: params.sortOrder,
            }, resolve, reject);
        });
    };

    /**
     * @deprecated
     */
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

    /**
     * Get chats.
     *
     * To work with messages in the chat, you need to use {@link MessageTargetEntityType.CHAT}
     */
    public getUserChats() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<ChatMap>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_CHATS, {}, resolve, reject);
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

    /**
     * Create chat
     *
     * @param chat.members - these members will receive {@link SfuEvent.NEW_CHAT} with {@link UserSpecificChatInfo}
     * @param chat.type - @deprecated
     * @param chat.channelSendPolicy - @deprecated
     * @param chat.sendPermissionList - @deprecated
     * @param chat.allowedToAddExternalUser - @deprecated
     */
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

    /**
     * Delete chat
     *
     * Chat members will receive {@link SfuEvent.CHAT_DELETED} with {@link UserSpecificChatInfo}
     *
     * If a direct meeting was started, it will end, and chat participants will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     */
    public deleteChat(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_CHAT, {id: chat.id}, resolve, reject);
        });
    };

    /**
     * Update chat
     *
     * Chat members will receive {@link SfuEvent.CHAT_UPDATED} with {@link UserSpecificChatInfo}
     */
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

    /**
     *  Add a member to chat
     *
     * Chat members will receive {@link SfuEvent.CHAT_UPDATED} with {@link UserSpecificChatInfo}
     *
     * If a direct meeting was started, user will receive {@link SfuEvent.NEW_MEETING} with {@link NewMeeting}.
     *
     * @param chat.member - user will receive {@link SfuEvent.NEW_CHAT} with {@link UserSpecificChatInfo}.
     */
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

    /**
     *  Remove a member to chat
     *
     * Chat members will receive {@link SfuEvent.CHAT_UPDATED} with {@link UserSpecificChatInfo}
     *
     * If a direct meeting was started and user was , user will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     * If the user was a participant in the meeting, users will receive {@link RoomEvent.EVICTED} with {@link EvictedFromRoom}.
     *
     * @param chat.member - user will receive {@link SfuEvent.CHAT_DELETED} with {@link UserSpecificChatInfo}.
     */
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

    /**
     * @deprecated
     */
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

    /**
     * @deprecated
     */
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

    /**
     * @deprecated
     */
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

    /**
     * @deprecated
     */
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

    /**
     * Used to change {@link UserSpecificChatInfo.favourite} to true
     */
    public addChatToFavourites(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_CHAT_TO_FAVOURITES, {id: chat.id}, resolve, reject);
        });
    }

    /**
     * Used to change {@link UserSpecificChatInfo.favourite} to false
     */
    public removeChatFromFavourites(chat: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<UserSpecificChatInfo>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_CHAT_FROM_FAVOURITES, {id: chat.id}, resolve, reject);
        });
    }

    /**
     * Create room
     *
     * To create with PMI settings, PMI must be specified as the ID.
     *
     * To join, you need to use room.join.
     *
     * @return {@link RoomExtended} with {@link RoomExtended.conferenceType()} that equal {@link ConferenceType.GLOBAL}
     */
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

    /**
     * Create channel meeting
     *
     * {@link Room.id()} will be equal channelId
     *
     * @return {@link RoomExtended} with {@link RoomExtended.conferenceType()} that equal {@link ConferenceType.CHANNEL}
     */
    public createChannelMeeting(options: {
        spaceId: string,
        channelId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RoomExtended>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_CHANNEL_MEETING, {
                spaceId: options.spaceId,
                channelId: options.channelId
            }, resolve, reject);
        });
    }

    /**
     * Create channel meeting
     *
     * {@link Room.id()} will be equal directChatId
     *
     * @return {@link RoomExtended} with {@link RoomExtended.conferenceType()} that equal {@link ConferenceType.DIRECT}
     */
    public createDirectMeeting(options: {
        directChatId: string;
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RoomExtended>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_DIRECT_MEETING, {
                directChatId: options.directChatId,
            }, resolve, reject);
        });
    }

    /**
     * Creating a room based on a calendar event created using {@link addCalendarEvent}.
     *
     * To join, you need to use room.join()
     */
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

    /**
     * Get running rooms
     */
    public loadActiveRooms() {
        const self = this;
        return new Promise<Array<RoomInfo>>((resolve, reject) => {
            self.#emmitAction(InternalApi.GET_ACTIVE_ROOMS, {}, resolve, reject);
        });
    }

    /**
     * Check and get an available room.
     *
     * To join, you need to use room.join()
     */
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

    /**
     * Checks for the existence of a running room.
     */
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

    /**
     * Get user spaces
     *
     * If channel meetings were started, user will receive {@link SfuEvent.USER_MEETINGS} with {@link MeetingsPreviewEvent}.
     */
    public getUserSpaces() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<SfuSpace>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_USER_SPACES, {}, resolve, reject);
        });
    }

    /**
     * The space is created with the default category Category1, default channel Channel1 and default role "@everyone".
     */
    public createSpace(space: {
        name: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpace>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_SPACE, {
                name: space.name,
            }, resolve, reject);
        });
    }

    /**
     * Update space overview
     *
     * Space members will receive {@link SpaceEvent.SPACE_OVERVIEW_UPDATED} with {@link SpaceOverviewUpdated}
     */
    public updateSpaceOverview(space: {
        id: string;
        name: string;
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_SPACE_OVERVIEW, {
                id: space.id,
                name: space.name,
            }, resolve, reject);
        });
    }

    /**
     * Delete space
     *
     * Space members will receive {@link SpaceEvent.SPACE_DELETED} with {@link SpaceDeletedEvent}
     *
     * If channel meetings were started, users will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     */
    public deleteSpace(space: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<string>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_SPACE, {
                id: space.id,
            }, resolve, reject);
        });
    }

    /**
     * Leave space
     *
     * Space members will receive {@link SpaceEvent.USER_LEFT_SPACE} with {@link UserLeftSpace}
     *
     * After receiving the event, it is necessary to remove the user from the list of members in the space and channels/threads.
     *
     * If channel meetings were started, user will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     * If the user was a participant in the meeting, users will receive {@link RoomEvent.EVICTED} with {@link EvictedFromRoom}.
     */
    public leaveSpace(space: {
        id: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.LEAVE_SPACE, {
                id: space.id,
            }, resolve, reject);
        });
    }

    /**
     * Generate space invite
     *
     * If user has permission to create a space invite - generating invite code with 8 symbols.
     * To create invite link - use 'ws:{serverUrl}:{port}/join-space/inviteCode'
     */
    public generateNewSpaceInvite(options: {
        spaceId: string,
        lifespan: number
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceInvite>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GENERATE_SPACE_INVITE, {
                spaceId: options.spaceId,
                lifespan: options.lifespan
            }, resolve, reject);
        });
    }

    /**
     * Removing the space invite
     */
    public revokeSpaceInvite(options: {
        spaceId: string,
        inviteCode: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceInvite>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REVOKE_SPACE_INVITE, {
                spaceId: options.spaceId,
                inviteCode: options.inviteCode
            }, resolve, reject);
        });
    }

    /**
     * Join space by invite code
     *
     * Space members will receive {@link SpaceEvent.USER_JOINED_TO_SPACE} with {@link UserJoinedToSpaceEvent}.
     * On the client side, this user should be added to the list of participants in public channels and threads.
     *
     * If channel meetings were started, user will receive {@link SfuEvent.USER_MEETINGS} with {@link MeetingsPreviewEvent}.
     */
    public joinSpaceByInviteCode(inviteCode: string) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpace>(function (resolve, reject) {
            self.#emmitAction(InternalApi.JOIN_SPACE_BY_INVITE_CODE, {
                inviteCode: inviteCode,
            }, resolve, reject);
        });
    }

    /**
     * Create space category
     *
     * For space owner/user that has permission to manage categories
     *
     * Space members will receive {@link SpaceEvent.NEW_SPACE_CATEGORY} with {@link NewSpaceCategoryEvent}
     */
    public createSpaceCategory(category: {
        spaceId: string,
        name: string,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceCategory>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_SPACE_CATEGORY, {
                spaceId: category.spaceId,
                name: category.name,
            }, resolve, reject);
        });
    }

    /**
     * Delete space category
     *
     * For space owner/category creator/user that has permission to manage categories
     *
     * Space members will receive {@link SpaceEvent.SPACE_CATEGORY_DELETED} with {@link SpaceCategoryDeleted}
     */
    public deleteSpaceCategory(options: {
        spaceId: string,
        categoryId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceCategory>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_SPACE_CATEGORY, {
                spaceId: options.spaceId,
                categoryId: options.categoryId
            }, resolve, reject);
        });
    }

    /**
     * Delete space category
     *
     * For space owner/category creator/user that has permission to manage categories
     *
     * Space members will receive {@link SpaceEvent.SPACE_CATEGORY_UPDATED} with {@link SpaceCategoryUpdated}
     */
    public updateSpaceCategory(options: {
        spaceId: string,
        categoryId: string,
        name: string,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_SPACE_CATEGORY, {
                spaceId: options.spaceId,
                categoryId: options.categoryId,
                name: options.name
            }, resolve, reject);
        });
    }

    /**
     * Create space channel
     *
     * For space owner/user that has permission to manage channels
     *
     * Channel members will receive {@link SpaceEvent.NEW_SPACE_CHANNEL} with {@link NewSpaceChannelEvent}
     *
     * @param channel.roles - used to create a private channel. Array of role ids or empty array.
     * @param channel.members - used to create a private channel. Array of member ids or empty array.
     */
    public createSpaceChannel(channel: {
        spaceId: string,
        categoryId?: string,
        name: string,
        isPrivate: boolean,
        roles?: Array<string>,
        members?: Array<string>
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceChannel>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_SPACE_CHANNEL, {
                spaceId: channel.spaceId,
                categoryId: channel.categoryId,
                name: channel.name,
                private: channel.isPrivate,
                roles: channel.roles,
                members: channel.members
            }, resolve, reject);
        });
    }

    /**
     * Update space channel
     *
     * For space owner/user that has permission to manage channels
     *
     * Channel members will receive {@link SpaceEvent.SPACE_CHANNEL_UPDATED} with {@link SpaceChannelUpdated}
     * In the private channel added members will receive {@link SpaceEvent.NEW_SPACE_CHANNEL} with {@link NewSpaceChannelEvent}.
     * If the channel meeting was started, added members will receive {@link SfuEvent.NEW_MEETING} with {@link NewMeeting}.
     *
     * In the private channel deleted members will receive {@link SpaceEvent.SPACE_CHANNEL_DELETED} with {@link SpaceChannelDeleted}
     * If the channel meeting was started, deleted members will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     * If the deleted user was a participant in the meeting, users will receive {@link RoomEvent.EVICTED} with {@link EvictedFromRoom}.
     *
     * @param channel.roles - used to create a private channel. Array of role ids or empty array.
     * @param channel.members - used to create a private channel. Array of member ids or empty array.
     */
    public updateSpaceChannel(channel: {
        spaceId: string,
        channelId: string,
        name: string,
        isPrivate: boolean,
        roles?: Array<string>,
        members?: Array<string>
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SpaceChannelUpdated>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_SPACE_CHANNEL, {
                spaceId: channel.spaceId,
                channelId: channel.channelId,
                name: channel.name,
                private: channel.isPrivate,
                roles: channel.roles,
                members: channel.members
            }, resolve, reject);
        });
    }

    /**
     * Move space channel
     *
     * Channel members will receive {@link SpaceEvent.SPACE_CHANNEL_MOVED} with {@link SpaceChannelMoved}
     *
     * @param channel.categoryId - Specify the identifier of the category to which you want to move the channel, or an empty string to leave the channel uncategorized.
     */
    public moveSpaceChannel(channel: {
        spaceId: string,
        categoryId: string,
        channelId: string,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SpaceChannelMoved>(function (resolve, reject) {
            self.#emmitAction(InternalApi.MOVE_SPACE_CHANNEL, {
                spaceId: channel.spaceId,
                categoryId: channel.categoryId,
                channelId: channel.channelId,
            }, resolve, reject);
        });
    }

    /**
     * Delete space channel
     *
     * Channel members will receive {@link SpaceEvent.SPACE_CHANNEL_DELETED} with {@link SpaceChannelDeleted}
     *
     * If the channel meeting was started, members will receive {@link MeetingSyncEvent.MEETING_ENDED_SYNC} with {@link MeetingEndedSync}.
     */
    public deleteSpaceChannel(options: {
        spaceId: string,
        channelId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_SPACE_CHANNEL, {
                spaceId: options.spaceId,
                channelId: options.channelId
            }, resolve, reject);
        });
    }

    /**
     * Create space thread
     *
     * Thread members will receive {@link SpaceEvent.NEW_SPACE_THREAD} with {@link NewSpaceThreadEvent}
     */
    public createSpaceThread(thread: {
        spaceId: string,
        channelId: string,
        name: string,
        isPrivate: boolean
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceThread>(function (resolve, reject) {
            self.#emmitAction(InternalApi.CREATE_SPACE_THREAD, {
                spaceId: thread.spaceId,
                channelId: thread.channelId,
                name: thread.name,
                private: thread.isPrivate
            }, resolve, reject);
        });
    }

    /**
     * Update space thread
     *
     * For space owner/thread creator
     *
     * Thread members will receive {@link SpaceEvent.SPACE_THREAD_UPDATED} with {@link SpaceThreadUpdated}
     */
    public updateSpaceThread(options: {
        spaceId: string,
        channelId: string,
        threadId: string,
        name: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_SPACE_THREAD, {
                spaceId: options.spaceId,
                channelId: options.channelId,
                threadId: options.threadId,
                name: options.name
            }, resolve, reject);
        });
    }

    /**
     * Delete space thread
     *
     * For space owner/thread creator
     *
     * Thread members will receive {@link SpaceEvent.SPACE_THREAD_DELETED} with {@link SpaceThreadDeleted}
     */
    public deleteSpaceThread(options: {
        spaceId: string,
        channelId: string,
        threadId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<void>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_SPACE_THREAD, {
                spaceId: options.spaceId,
                channelId: options.channelId,
                threadId: options.threadId
            }, resolve, reject);
        });
    }

    /**
     * Add space role
     *
     * For space owner/user that has permission to manage roles
     *
     * Space members will receive {@link SpaceEvent.NEW_SPACE_ROLE} with {@link NewSpaceRoleAdded}
     *
     * On the client side, a new role must be added to the participants listed in the {@link NewSpaceRoleAdded.members}
     */
    public addSpaceRole(role: {
        spaceId: string,
        name: string,
        color: string,
        permissions: Array<string>,
        members: Array<string>
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SfuSpaceRole>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_SPACE_ROLE, {
                spaceId: role.spaceId,
                roleName: role.name,
                color: role.color,
                permissions: role.permissions,
                members: role.members
            }, resolve, reject);
        });
    }

    /**
     * Update space role
     *
     * For space owner/user that has permission to manage roles
     *
     * Space members will receive {@link SpaceEvent.SPACE_ROLE_UPDATED} with {@link SpaceRoleUpdated}
     *
     * On the client side, a new role must be added to the participants listed in the {@link SpaceRoleUpdated.membersForAddRole}
     * and must be removed from participants listed in the {@link SpaceRoleUpdated.membersForDeleteRole}
     *
     * Participants from whom this role will be removed will receive {@link SpaceEvent.SPACE_CHANNEL_DELETED} with {@link SpaceChannelDeleted} for each channel they were part of because of this role.
     *
     * Participants who are assigned this role will receive {@link SpaceEvent.NEW_SPACE_CHANNEL} with {@link NewSpaceChannelEvent} for each channel that has this role in its access rights.
     *
     * Participants who had the role before the update and still have it afterward will receive {@link SpaceEvent.SPACE_CHANNEL_UPDATED} with {@link SpaceChannelUpdated} for each channel that has this role in its access rights.
     */
    public updateSpaceRole(role: {
        spaceId: string,
        roleId: string,
        name: string,
        color: string,
        permissions: Array<string>,
        members: Array<string>
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SpaceRoleUpdated>(function (resolve, reject) {
            self.#emmitAction(InternalApi.UPDATE_SPACE_ROLE, {
                spaceId: role.spaceId,
                roleId: role.roleId,
                roleName: role.name,
                color: role.color,
                permissions: role.permissions,
                members: role.members
            }, resolve, reject);
        });
    }

    /**
     * Delete space role
     *
     * For space owner/user that has permission to manage roles
     *
     * Space members will receive {@link SpaceEvent.SPACE_ROLE_DELETED} with {@link SpaceRoleDeleted}
     *
     * On the client side, should remove this role from channel's access rights and update channel members list
     */
    public deleteSpaceRole(options: {
        spaceId: string,
        roleId: string,
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<SpaceRoleDeleted>(function (resolve, reject) {
            self.#emmitAction(InternalApi.DELETE_SPACE_ROLE, {
                spaceId: options.spaceId,
                roleId: options.roleId
            }, resolve, reject);
        });
    }

    /**
     * Add space role to member
     *
     * For space owner/user that has permission to manage roles
     *
     * Space members will receive {@link SpaceEvent.ADDED_ROLE_TO_MEMBER} with {@link AddedRoleToMember}
     *
     * Member who are assigned this role will receive {@link SpaceEvent.NEW_SPACE_CHANNEL} with {@link NewSpaceChannelEvent} for each channel that has this role in its access rights.
     * Other members of these channels will receive {@link SpaceEvent.SPACE_CHANNEL_UPDATED} with {@link SpaceChannelUpdated}.
     */
    public addRoleToMember(options: {
        spaceId: string,
        roleId: string,
        memberId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<AddedRoleToMember>(function (resolve, reject) {
            self.#emmitAction(InternalApi.ADD_ROLE_TO_MEMBER, {
                spaceId: options.spaceId,
                roleId: options.roleId,
                memberId: options.memberId
            }, resolve, reject);
        });
    }

    /**
     * Remove space role from member
     *
     * For space owner/user that has permission to manage roles
     *
     * Space members will receive {@link SpaceEvent.REMOVED_ROLE_FROM_MEMBER} with {@link RemovedRoleFromMember}
     *
     * Participant from whom this role will be removed will receive {@link SpaceEvent.SPACE_CHANNEL_DELETED} with {@link SpaceChannelDeleted} for each channel they were part of because of this role.
     * Other members of these channels will receive {@link SpaceEvent.SPACE_CHANNEL_UPDATED} with {@link SpaceChannelUpdated}.
     */
    public removeRoleFromMember(options: {
        spaceId: string,
        roleId: string,
        memberId: string
    }) {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<RemovedRoleFromMember>(function (resolve, reject) {
            self.#emmitAction(InternalApi.REMOVE_ROLE_FROM_MEMBER, {
                spaceId: options.spaceId,
                roleId: options.roleId,
                memberId: options.memberId
            }, resolve, reject);
        });
    }

    public getRolePermissions() {
        this.#checkAuthenticated();
        const self = this;
        return new Promise<Array<SfuSpaceRolePermissionSection>>(function (resolve, reject) {
            self.#emmitAction(InternalApi.GET_ROLE_PERMISSIONS, {}, resolve, reject);
        });
    }

    public user() {
        return this.#_user;
    }

    public server() {
        return this.#_server;
    }

    public state() {
        return this.#_state;
    }

    public on(event: EventUnion, callback: (arg0: NotifyUnion) => void): SfuExtended {
        this.#notifier.add(event, callback);
        return this;
    };

    public off(event: EventUnion, callback: (arg0: NotifyUnion) => void): SfuExtended {
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
