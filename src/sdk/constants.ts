export enum SfuEvent {
    CONNECTED = "CONNECTED",
    FAILED = "FAILED",
    CONNECTION_FAILED = "CONNECTION_FAILED",
    DISCONNECTED = "DISCONNECTED",
    MESSAGE = "MESSAGE",
    USER_LIST = "USER_LIST",
    USER_CHATS = "USER_CHATS",
    CHAT_LOADED = "CHAT_LOADED",
    CHAT_MESSAGES = "CHAT_MESSAGES",
    CHAT_SEARCH_RESULT = "CHAT_SEARCH_RESULT",
    NEW_CHAT = "NEW_CHAT",
    CHAT_DELETED = "CHAT_DELETED",
    CHAT_UPDATED = "CHAT_UPDATED",
    MESSAGE_STATE = "MESSAGE_STATE",
    MESSAGE_ATTACHMENT_STATE = "MESSAGE_ATTACHMENT_STATE",
    MESSAGE_STATE_BULK = "MESSAGE_STATE_BULK",
    CONTACT_UPDATE = "CONTACT_UPDATE",
    CONTACT_REMOVED = "CONTACT_REMOVED",
    CONTACT_INVITE = "CONTACT_INVITE",
    PUBLIC_CHANNELS = "PUBLIC_CHANNELS",
    USER_CALENDAR = "USER_CALENDAR",
    NEW_CALENDAR_ENTRY = "NEW_CALENDAR_ENTRY",
    REMOVE_CALENDAR_ENTRY = "REMOVE_CALENDAR_ENTRY",
    UPDATE_CALENDAR_EVENT = "UPDATE_CALENDAR_EVENT",
    ACK = "ACK",
    ATTACHMENT_DATA = "ATTACHMENT_DATA",
    USER_ROOMS = "USER_ROOMS",
    ATTACHMENT = "ATTACHMENT",
    SFU_USER_PMI_SETTINGS = "SFU_USER_PMI_SETTINGS",
    UPDATE_USER_PMI_SETTINGS = "UPDATE_USER_PMI_SETTINGS"
}

export enum RoomEvent {
    CREATED = "CREATED",
    ENDED = "ENDED",
    AVAILABLE = "AVAILABLE",
    FAILED = "FAILED",
    ADD_TRACKS = "ADD_TRACKS",
    REMOVE_TRACKS = "REMOVE_TRACKS",
    MESSAGE = "MESSAGE",
    CONTROL_MESSAGE = "CONTROL_MESSAGE",
    JOINED = "JOINED",
    LEFT = "LEFT",
    DETACHED = "DETACHED",
    EVICTED = "EVICTED",
    DROPPED = "DROPPED",
    REMOTE_SDP = "REMOTE_SDP",
    TRACK_QUALITY_STATE = "TRACK_QUALITY_STATE",
    OPERATION_FAILED = "OPERATION_FAILED",
    WAITING_LIST = "SFU_WAITING_LIST",
    WAITING_ROOM_UPDATE = "SFU_WAITING_ROOM_UPDATE",
    MUTE_TRACKS = "MUTE_TRACKS",
    PARTICIPANT_LIST = "PARTICIPANT_LIST",
    ROLE_ASSIGNED = "ROLE_ASSIGNED",
    ROLES_LIST = "ROLES_LIST",
    ROOM_CONFIG = "ROOM_CONFIG",
    ROOM_LOCKED = "ROOM_LOCKED",
    ROOM_INITIAL_AUDIO_MUTED = "ROOM_INITIAL_AUDIO_MUTED",
    ROOM_INITIAL_VIDEO_MUTED = "ROOM_INITIAL_VIDEO_MUTED",
    ROOM_INITIAL_SCREEN_SHARING_MUTED = "ROOM_INITIAL_SCREEN_SHARING_MUTED",
    ROOM_AUDIO_MUTED = "ROOM_AUDIO_MUTED",
    ROOM_VIDEO_MUTED = "ROOM_VIDEO_MUTED",
    ROOM_SCREEN_SHARING_MUTED = "ROOM_SCREEN_SHARING_MUTED",
    ROOM_CHAT_MUTED = "ROOM_CHAT_MUTED",
    ROOM_CAN_CHANGE_NICKNAME = "ROOM_CAN_CHANGE_NICKNAME",
    ROOM_SCREEN_SHARING_MULTIPLE_SHARES = "ROOM_SCREEN_SHARING_MULTIPLE_SHARES",
    ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE = "ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE",
    ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE = "ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE",
    PARTICIPANT_CONFIG = "PARTICIPANT_CONFIG",
    SCREEN_SHARING_CONFIG = "SCREEN_SHARING_CONFIG",
    PARTICIPANT_AUDIO_MUTED = "PARTICIPANT_AUDIO_MUTED",
    PARTICIPANT_VIDEO_MUTED = "PARTICIPANT_VIDEO_MUTED",
    PARTICIPANT_SCREEN_SHARING_MUTED = "PARTICIPANT_SCREEN_SHARING_MUTED",
    PARTICIPANT_RENAMED = "PARTICIPANT_RENAMED",
    STOP_SCREEN_SHARING = "STOP_SCREEN_SHARING",
    STOP_TRACK = "STOP_TRACK"
}

export enum State {
    NEW = "NEW",
    PENDING = "PENDING",
    CONNECTED = "CONNECTED",
    AUTHENTICATED = "AUTHENTICATED",
    DISCONNECTED = "DISCONNECTED",
    FAILED = "FAILED"
}

export enum RoomState {
    NEW = "NEW",
    PENDING = "PENDING",
    JOINED = "JOINED",
    FAILED = "FAILED",
    DISPOSED = "DISPOSED"
}

export enum Operations {
    ROOM_CREATE = "ROOM_CREATE",
    ROOM_CREATE_FROM_EVENT = "ROOM_CREATE_FROM_EVENT",
    ROOM_JOIN = "ROOM_JOIN",
    ROOM_AVAILABLE = "ROOM_AVAILABLE",
    ROOM_DESTROY = "ROOM_DESTROY",
    ROOM_LEAVE = "ROOM_LEAVE",
    SEND_MESSAGE = "SEND_MESSAGE",
    SEND_CONTROL_MESSAGE = "SEND_CONTROL_MESSAGE",
    USER_LIST = "USER_LIST",
    USER_CALENDAR = "USER_CALENDAR",
    ADD_CALENDAR_EVENT = "ADD_CALENDAR_EVENT",
    REMOVE_CALENDAR_EVENT = "REMOVE_CALENDAR_EVENT",
    UPDATE_CALENDAR_EVENT = "UPDATE_CALENDAR_EVENT",
    ROOM_UPDATE = "ROOM_UPDATE",
    MUTE_TRACKS = "MUTE_TRACKS",
    ASSIGN_ROLE = "ASSIGN_ROLE",
    SUBSCRIBE_TO_WAITING_PARTICIPANT = "SUBSCRIBE_TO_WAITING_PARTICIPANT",
    UNSUBSCRIBE_FROM_WAITING_PARTICIPANT = "UNSUBSCRIBE_FROM_WAITING_PARTICIPANT",
    MOVE_TO_WAITING_ROOM = "MOVE_TO_WAITING_ROOM",
    CREATE_CHAT = "CREATE_CHAT",
    DELETE_CHAT = "DELETE_CHAT",
    RENAME_CHAT = "RENAME_CHAT",
    LOAD_CHAT = "LOAD_CHAT",
    LOAD_CHAT_MESSAGES = "LOAD_CHAT_MESSAGES",
    SEARCH_CHAT_MESSAGES = "SEARCH_CHAT_MESSAGES",
    ADD_MEMBER_TO_CHAT = "ADD_MEMBER_TO_CHAT",
    REMOVE_MEMBER_FROM_CHAT = "REMOVE_MEMBER_FROM_CHAT",
    UPDATE_CHAT_PREFERENCES = "UPDATE_CHAT_PREFERENCES",
    GET_USER_CHATS = "GET_USER_CHATS",
    UPDATE_CHAT_CONFIGURATION = "UPDATE_CHAT_CONFIGURATION",
    GET_ACTIVE_ROOMS = "GET_ACTIVE_ROOMS",
    ROOM_EXISTS = "ROOM_EXISTS",
    LOAD_ATTACHMENT = "LOAD_ATTACHMENT",
    CHANGE_QUALITY = "CHANGE_QUALITY",
    RECLAIM_OWNER_RIGHTS = "RECLAIM_OWNER_RIGHTS",
    CONFIGURE_WAITING_ROOM = "CONFIGURE_WAITING_ROOM",
    AUTHORIZE_WAITING_LIST = "AUTHORIZE_WAITING_LIST",
    ADD_CHAT_TO_FAVOURITES = "ADD_CHAT_TO_FAVOURITES",
    REMOVE_CHAT_FROM_FAVOURITES = "REMOVE_CHAT_FROM_FAVOURITES",
    INVITE_CONTACT = "INVITE_CONTACT",
    REMOVE_CONTACT = "REMOVE_CONTACT",
    CONFIRM_CONTACT = "CONFIRM_CONTACT",
    ADD_CONTACT_TO_FAVOURITES = "ADD_CONTACT_TO_FAVOURITES",
    REMOVE_CONTACT_FROM_FAVOURITES = "REMOVE_CONTACT_FROM_FAVOURITES",
    CANCEL_UPLOAD_ATTACHMENTS = "CANCEL_UPLOAD_ATTACHMENTS",
    ROOM_SET_LOCK = "ROOM_SET_LOCK",
    ROOM_SET_INITIAL_AUDIO_MUTED = "ROOM_SET_INITIAL_AUDIO_MUTED",
    ROOM_SET_INITIAL_VIDEO_MUTED = "ROOM_SET_INITIAL_VIDEO_MUTED",
    ROOM_SET_INITIAL_SCREEN_SHARING_MUTED = "ROOM_SET_INITIAL_SCREEN_SHARING_MUTED",
    ROOM_SET_AUDIO_MUTED = "ROOM_SET_AUDIO_MUTED",
    ROOM_SET_VIDEO_MUTED = "ROOM_SET_VIDEO_MUTED",
    ROOM_SET_SCREEN_SHARING_MUTED = "ROOM_SET_SCREEN_SHARING_MUTED",
    ROOM_SET_CHAT_MUTED = "ROOM_SET_CHAT_MUTED",
    ROOM_SET_CAN_CHANGE_NICKNAME = "ROOM_SET_CAN_CHANGE_NICKNAME",
    ROOM_SET_SCREEN_SHARING_MULTIPLE_SHARES = "ROOM_SET_SCREEN_SHARING_MULTIPLE_SHARES",
    ROOM_SET_SCREEN_SHARING_EVERYONE_CAN_SHARE = "ROOM_SET_SCREEN_SHARING_EVERYONE_CAN_SHARE",
    ROOM_SET_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE = "ROOM_SET_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE",
    PARTICIPANT_AUDIO_MUTED = "PARTICIPANT_AUDIO_MUTED",
    PARTICIPANT_VIDEO_MUTED = "PARTICIPANT_VIDEO_MUTED",
    PARTICIPANT_SCREEN_SHARING_MUTED = "PARTICIPANT_SCREEN_SHARING_MUTED",
    RENAME_PARTICIPANT = "RENAME_PARTICIPANT",
    TURN_OFF_PARTICIPANT_SCREEN_SHARING = "TURN_OFF_PARTICIPANT_SCREEN_SHARING"
}

export enum ParticipantRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    PARTICIPANT = "PARTICIPANT"
}

export enum TrackType {
    AUDIO = "AUDIO",
    VIDEO = "VIDEO"
}

export enum InternalApi {
    Z_APP = "sfuZClientApp",
    P_APP = "sfuApp",
    DEFAULT_METHOD = "sfuCallback",
    BINARY_DATA = "binaryData",
    JOIN_ROOM = "joinRoom",
    CREATE_ROOM = "createRoom",
    ROOM_AVAILABLE = "roomAvailable",
    ROOM_EXISTS = "roomExists",
    UPDATE_ROOM_STATE = "updateRoomState",
    DESTROY_ROOM = "destroyRoom",
    LEAVE_ROOM = "leaveRoom",
    EVICT_PARTICIPANT = "evictParticipant",
    RENAME_PARTICIPANT = "renameParticipant",
    CHANGE_QUALITY = "changeQuality",
    AUTHORIZE_WAITING_LIST = "authorizeWaitingList",
    MESSAGE = "SFU_MESSAGE",
    MESSAGE_STATE = "SFU_MESSAGE_STATE",
    MESSAGE_ATTACHMENT_STATE = "SFU_MESSAGE_ATTACHMENT_STATE",
    MESSAGE_STATE_BULK = "SFU_MESSAGE_STATE_BULK",
    SFU_ATTACHMENT_REQUEST_ACK = "SFU_ATTACHMENT_REQUEST_ACK",
    USER_LIST = "SFU_USER_LIST",
    USER_CALENDAR = "SFU_USER_CALENDAR",
    USER_CHATS = "SFU_USER_CHATS",
    PUBLIC_CHANNELS = "SFU_PUBLIC_CHANNELS",
    CHAT_LOADED = "SFU_CHAT_LOADED",
    NEW_CHAT = "SFU_NEW_CHAT",
    CHAT_DELETED = "SFU_CHAT_DELETED",
    CHAT_UPDATED = "SFU_UPDATE_CHAT",
    CONTACT_UPDATED = "SFU_CONTACT_UPDATE",
    CONTACT_INVITE = "SFU_CONTACT_INVITE",
    CONTACT_REMOVED = "SFU_CONTACT_REMOVED",
    GET_USER_LIST = "getUserList",
    GET_USER_CALENDAR = "getUserCalendar",
    GET_USER_PMI_SETTINGS = "getUserPmiSettings",
    UPDATE_USER_PMI_SETTINGS = "updateUserPmiSettings",
    ADD_CALENDAR_EVENT = "addCalendarEvent",
    REMOVE_CALENDAR_EVENT = "removeCalendarEvent",
    UPDATE_CALENDAR_EVENT = "updateCalendarEvent",
    CREATE_ROOM_FROM_EVENT = "createRoomFromEvent",
    MUTE_TRACK = "muteTrack",
    SEND_MESSAGE = "sendMessage",
    GET_ATTACHMENT = "downloadAttachment",
    SEND_CONTROL_MESSAGE = "sendControlMessage",
    MARK_MESSAGE_READ = "markMessageRead",
    MARK_MESSAGE_UNREAD = "markMessageUnread",
    INVITE_CONTACT = "inviteContact",
    REMOVE_CONTACT = "removeContact",
    CONFIRM_CONTACT = "confirmContact",
    ASSIGN_ROLE = "assignRole",
    SUBSCRIBE_TO_WAITING_PARTICIPANT = "subscribeToWaitingParticipant",
    UNSUBSCRIBE_FROM_WAITING_PARTICIPANT = "unsubscribeFromWaitingParticipant",
    MOVE_TO_WAITING_ROOM = "moveToWaitingRoom",
    CONFIGURE_WAITING_ROOM = "configureWaitingRoom",
    TRACK_CONTENT_HEADER = "a=content:",
    GET_USER_CHATS = "getUserChats",
    GET_PUBLIC_CHANNELS = "getPublicChannels",
    LOAD_CHAT = "loadChat",
    LOAD_CHAT_MESSAGES = "loadChatMessages",
    SEARCH_CHAT_MESSAGES = "searchChatMessages",
    CREATE_CHAT = "createChat",
    DELETE_CHAT = "deleteChat",
    RENAME_CHAT = "renameChat",
    ADD_MEMBER_TO_CHAT = "addMemberToChat",
    REMOVE_MEMBER_FROM_CHAT = "removeMemberFromChat",
    UPDATE_CHANNEL_SEND_POLICY = "updateChannelSendPolicy",
    UPDATE_CHAT_RECEIVE_POLICY = "updateChatReceivePolicy",
    ADD_CHANNEL_SEND_PERMISSION_LIST_MEMBER = "addChannelSendPermissionListMember",
    REMOVE_CHANNEL_SEND_PERMISSION_LIST_MEMBER = "removeChannelSendPermissionListMember",
    UPDATE_CHAT_CONFIGURATION = "updateChatConfiguration",
    ADD_CHAT_TO_FAVOURITES = "addChatToFavourites",
    REMOVE_CHAT_FROM_FAVOURITES = "removeChatFromFavourites",
    ADD_CONTACT_TO_FAVOURITES = "addContactToFavourites",
    REMOVE_CONTACT_FROM_FAVOURITES = "removeContactFromFavourites",
    GET_ACTIVE_ROOMS = "getActiveRooms",
    RECLAIM_OWNER_RIGHTS = "reclaimOwnerRights",
    CANCEL_UPLOAD_ATTACHMENT = "cancelUploadAttachment",
    SEND_MESSAGE_WITH_ATTACHMENTS = "sendMessageWithAttachments",
    SET_ROOM_LOCK = "setRoomLock",
    SET_ROOM_INITIAL_AUDIO_MUTED = "setRoomInitialAudioMuted",
    SET_ROOM_INITIAL_VIDEO_MUTED = "setRoomInitialVideoMuted",
    SET_ROOM_INITIAL_SCREEN_SHARING_MUTED = "setRoomInitialScreenSharingMuted",
    SET_ROOM_AUDIO_MUTED = "setRoomAudioMuted",
    SET_ROOM_VIDEO_MUTED = "setRoomVideoMuted",
    SET_ROOM_SCREEN_SHARING_MUTED = "setRoomScreenSharingMuted",
    SET_ROOM_CHAT_MUTED = "setRoomChatMuted",
    SET_ROOM_CAN_CHANGE_NICKNAME = "setRoomCanChangeNickname",
    SET_ROOM_SCREEN_SHARING_MULTIPLE_SHARES = "setRoomScreenSharingMultipleShares",
    SET_ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE = "setRoomScreenSharingEveryoneCanShare",
    SET_ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE = "setRoomScreenSharingEveryoneCanDoSubsequentShare",
    SET_PARTICIPANT_AUDIO_MUTED = "setParticipantAudioMuted",
    SET_PARTICIPANT_VIDEO_MUTED = "setParticipantVideoMuted",
    SET_PARTICIPANT_SCREEN_SHARING_MUTED = "setParticipantScreenSharingMuted",
    TURN_OFF_PARTICIPANT_SCREEN_SHARING = "turnOffParticipantScreenSharing"
}

export enum ContactError {
    USER_CAN_NOT_SEND_INVITE_TO_HIMSELF = "User can not send invite to himself"
}

export enum ChatError {
    CAN_NOT_SEND_MESSAGE_WITHOUT_CONTENT = "Can't send message without content",
    CAN_NOT_SEND_NULL_MESSAGE = "Can't send null message",
    CAN_NOT_SEND_MESSAGE_WITHOUT_CHAT_ID = "Can't send message without a chatId",
    USER_MUST_BE_A_CHAT_MEMBER_TO_SEND_MESSAGES = "User must be a chat member to send messages",
    CAN_NOT_CANCEL_UPLOADED_ATTACHMENT = "Can't cancel uploading attachment, attachment has uploaded state"
}

export enum RoomError {
    AUTHORIZATION_FAILED = "Authorization failed by owner",
    ROOM_DESTROYED = "Room destroyed",
    WRONG_PIN = "Wrong pin",
    NOT_FOUND = "Room not found",
    NICKNAME_UNAVAILABLE = "Nickname unavailable",
    NICKNAME_ALREADY_TAKEN = "This nickname is already taken",
    ID_IS_NULL = "id can't be null",
    EVENT_ID_IS_NULL = "event.id can't be null",
    USER_ALREADY_JOINED = "User already joined",
    CANCEL_JOIN_ROOM = "Joining to room canceled by user",
    ROOM_IS_LOCKED = "Room is locked",
    RENAMING_PROHIBITED = "Renaming prohibited by the owner"
}

export const ATTACHMENT_CHUNK_SIZE = 100000;

export type InternalMessage = {
    type: SfuEvent | RoomEvent | InternalApi,
    roomId: string,
    internalMessageId: string
}

export type OperationFailed = InternalMessage & {
    operation: Operations,
    error: string,
    info: any
}

export type BooleanEvent = InternalMessage & {
    value: boolean
}

export type RoomMessage = InternalMessage & {
    message: {
        nickName: UserNickname,
        message: string
    }
}

export type FragmentedMessage = {
    id: string,
    last: boolean,
    payload: string
}

export enum RemoteSdpType {
    OFFER = "offer",
    ANSWER = "answer"
}

export type RemoteSdp = InternalMessage & {
    info: {
        sdp: string,
        type: RemoteSdpType
    }
}

export type RoleAssigned = InternalMessage & {
    name: UserNickname,
    role: ParticipantRole
}

export type RolesListEvent = InternalMessage & {
    roles: Array<{
        name: UserNickname,
        role: ParticipantRole
    }>
}

export type CreatedRoom = InternalMessage & {
    name: string,
    pin: string,
    inviteId: string,
    chatId: string,
    //unix epoch in UTC
    creationTime: number,
    config?: RoomExtendedConfig
}

export type RoomInfo = {
    id: string,
    name: string,
    pin: string,
    creationTime: number,
    config: RoomExtendedConfig
}

export type UserRoomsEvent = InternalMessage & {
    rooms: Array<RoomInfo>
}

export type RoomAvailable = InternalMessage & {
    name: string,
    pin: string,
    creationTime: number,
    config: RoomExtendedConfig
}

export type RoomExtendedParticipantConfig = {
    audioMuted: boolean,
    videoMuted: boolean,
    screenSharingMuted: boolean
}

export type RoomExtendedParticipantsConfig = {
    [key: UserNickname]: RoomExtendedParticipantConfig
}

export type RoomExtendedScreenSharingConfig = {
    multipleShares: boolean,
    everyoneCanShare: boolean,
    everyoneCanDoSubsequentShare: boolean
}

export type RoomExtendedConfig = {
    locked: boolean,
    initialAudioMuted: boolean,
    initialVideoMuted: boolean,
    initialScreenSharingMuted: boolean,
    audioMuted: boolean,
    videoMuted: boolean,
    screenSharingMuted: boolean,
    chatMuted: boolean,
    canChangeNickname: boolean,
    screenSharingConfig: RoomExtendedScreenSharingConfig,
    participantsConfig?: RoomExtendedParticipantsConfig
}

export type JoinedRoom = InternalMessage & {
    name: UserNickname,
    chatId: string,
    owner: boolean
}

export type LeftRoom = InternalMessage & {
    name: UserNickname
}

export type EvictedFromRoom = InternalMessage & {
    name: UserNickname
}

export type ParticipantRenamed = InternalMessage & {
    previousName: UserNickname,
    updatedName: UserNickname
}

export type ParticipantsListEvent = InternalMessage & {
    participants: Array<UserNickname>
}

export type WaitingListEvent = InternalMessage & {
    users: Array<User>
}

export type RoomConfigEvent = InternalMessage & {
    config: RoomExtendedConfig
}

export type ParticipantConfigEvent = InternalMessage & {
    nickname: UserNickname,
    config: RoomExtendedParticipantConfig
}

export type RoomScreenSharingConfigEvent = InternalMessage & {
    config: RoomExtendedScreenSharingConfig
}

export type ParticipantAVSMutedEvent = InternalMessage & {
    nickname: UserNickname,
    value: boolean
}

export type StopScreenSharingEvent = InternalMessage & {
    nickname: UserNickname,
    reason: string
}

export type StopTrackEvent = InternalMessage & {
    nickname: UserNickname,
    id: string,
    tracksMid: Array<string>
}

export type AddRemoveTracks = InternalMessage & {
    info: {
        nickName: UserNickname,
        waitingRoom: boolean,
        info: Array<{
            id: string,
            type: TrackType,
            contentType: string,
            mid: string,
            quality: Array<string>,
            mute: boolean,
            creationTime: number
        }>
    }
}

export type WaitingRoomUpdate = InternalMessage & {
    enabled: boolean
}

export enum MessageState {
    NO_DELIVERY_NO_READ = "NO_DELIVERY_NO_READ",
    PARTIAL_DELIVERY_NO_READ = "PARTIAL_DELIVERY_NO_READ",
    PARTIAL_DELIVERY_PARTIAL_READ = "PARTIAL_DELIVERY_PARTIAL_READ",
    FULL_DELIVERY_NO_READ = "FULL_DELIVERY_NO_READ",
    FULL_DELIVERY_PARTIAL_READ = "FULL_DELIVERY_PARTIAL_READ",
    FULL_DELIVERY_FULL_READ = "FULL_DELIVERY_FULL_READ",
    PENDING_ATTACHMENTS = "PENDING_ATTACHMENTS",
    DELIVERY_CANCELLED = "DELIVERY_CANCELLED"
}

export enum DeliveryStatus {
    PENDING = "PENDING",
    DELIVERED = "DELIVERED",
    READ = "READ",
    UNREAD = "UNREAD"
}

export enum AttachmentState {
    PENDING = "PENDING",
    UPLOADED = "UPLOADED",
    DOWNLOADED = "DOWNLOADED",
    CANCELLED = "CANCELLED"
}

export type MessageDeliveryStatus = {
    [key:UserId] : DeliveryStatus
}

export type MessageStatusUpdate = {
    id: string;
    state: MessageState;
    deliveryStatus: MessageDeliveryStatus;
}

export type MessageStatus = {
    id: string;
    chatId: string;
    delivered: boolean;
    state: MessageState;
    lastReadMessageId: string;
    info: string;
    date: number;
    attachments: Array<MessageAttachment>;
    deliveryStatus: MessageDeliveryStatus;
}

export type AttachmentStatus = {
    chatId: string;
    messageId: string;
    id: number;
    name: string;
    state: AttachmentState;
    uploadedSize?: number;
    downloadedSize?: number;
}

export enum MessageAttachmentType {
    file = "file",
    picture = "picture"
}

export type MessageAttachment = {
    type: MessageAttachmentType;
    name: string;
    size: number;
    id: number;
}

export type MessageAttachmentData = {
    payload: ArrayBuffer;
    id: number;
}

export type AttachmentRequest = {
    chatId: string;
    messageId: string;
    attachmentId: number;
    name: string;
    tmpId?: number;
}

export type Attachment = AttachmentRequest & {
    internalMessageId: string;
    payload: ArrayBuffer
}

export type AttachmentRequestAck = InternalMessage & {
    attachmentRequest: AttachmentRequest
}

export type Message = {
    id: string;
    parentId?: string;
    chatId: string;
    date: number;
    from: UserId;
    to?: UserId;
    status: MessageState;
    body: string;
    attachments: Array<MessageAttachment>;
    deliveryStatus: MessageDeliveryStatus;
    privateMessage: boolean;
}

export type SfuMessageEvent = InternalMessage & {
    message: Message
}

export type MessageStatusEvent = InternalMessage & {
    status: MessageStatus
}

export type AttachmentStatusEvent = InternalMessage & {
    status: AttachmentStatus
}

export type MessageStatusBulkEvent = InternalMessage & {
    chatId: string,
    update: Array<MessageStatusUpdate>
}

export type ControlMessage = {
    from: UserNickname,
    to: UserNickname,
    body: string,
    broadcast: boolean
}

export type ControlMessageEvent = InternalMessage & {
    message: ControlMessage
}

export enum UserState {
    OFFLINE = "OFFLINE",
    ONLINE = "ONLINE",
    PENDING_REGISTRATION = "PENDING_REGISTRATION"
}
export type Invite = InternalMessage & {
    id: string;
    from: UserId;
    to: UserId | UserEmail;
}
export type User = {
    state: UserState;
    id: UserId;
    email: UserEmail;
    nickname: UserNickname;
    confirmed: boolean;
    favourite: boolean;
    invite: Invite;
}

export type UserListEvent = InternalMessage & {
    list: Array<User>
}

export type ContactInviteEvent = InternalMessage & {
    invite: Invite
}

export type ContactUpdateEvent = InternalMessage & {
    contact: User
}

export type ContactRemovedEvent = InternalMessage & {
    contact: User
}

export type CalendarEvent = {
    id: string;
    accessCode?: string;
    description: string;
    title: string;
    start: number;
    end: number;
    ownerVideo: boolean;
    participantVideo: boolean;
    recurring: boolean;
    usePMI: boolean;
    waitingRoom: boolean;
}
export type Calendar = {
    events: Array<CalendarEvent>
}
export type UserCalendarEvent = InternalMessage & {
    calendar: Calendar;
}

export type CalendarEventEvent = InternalMessage & {
    entry: CalendarEvent
}

export type UserSpecificChatInfo = {
    id: string;
    roomId: string;
    favourite: boolean;
    channel: boolean;
    name: string;
    owner: UserId;
    members: Array<UserId>;
    lastReadMessageId: string;
    lastReadMessageDate: number;
    canSend: boolean;
    channelType: ChannelType;
    channelSendPolicy: ChannelSendPolicy;
    chatReceivePolicy: ChatReceivePolicy;
    sendPermissionList: Array<string>;
    allowedToAddExternalUser: boolean;
}
export enum ChannelType {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE"
}
export enum ChannelSendPolicy {
    EVERYONE = "EVERYONE",
    ADMIN = "ADMIN",
    ADMIN_AND_LIST = "ADMIN_AND_LIST"
}
export enum ChatReceivePolicy {
    EVERYONE = "EVERYONE",
    OWNER_ONLY = "OWNER_ONLY",
    NOBODY = "NOBODY"
}

//TODO(naz): should be a union with UserSpecificChatInfo
export type Chat = {
    id: string;
    name: string;
    owner: UserId;
    //TODO(naz): looks like this should be in a separate object
    member: UserId;
    favourite: boolean;
    members: Array<UserId>;
    messages: Array<Message>;
    channel: boolean;
    channelType: ChannelType;
    channelSendPolicy: ChannelSendPolicy;
    chatReceivePolicy: ChatReceivePolicy;
    sendPermissionList: Array<string>;
    allowedToAddExternalUser: boolean;
}

export type NewChatEvent = InternalMessage & {
    info: UserSpecificChatInfo
}

export type RemovedChatEvent = InternalMessage & {
    info: UserSpecificChatInfo
}

export type UpdateChatEvent = InternalMessage & {
    info: UserSpecificChatInfo
}

export type ChatMap = {[key: string]: UserSpecificChatInfo};

export type ChatsEvent = InternalMessage & {
    chats: ChatMap
}

export type PublicChannelsEvent = InternalMessage & {
    channels: ChatMap
}

export type ChatLoadedEvent = InternalMessage & {
    chat: Chat
}

export type ChatMessagesEvent = InternalMessage & {
    chatId: string,
    messages: Array<Message>
}

export type ChatSearchResultEvent = InternalMessage & {
    chatId: string,
    searchId: string,
    messages: Array<Message>
}

export type UserPmiSettings = InternalMessage & {
    pmiSettings: {
        allowJoinAtAnyTime: boolean,
        useMuteAudioOnJoin: boolean,
        useLocalAutoRecord: boolean,
        useAccessCode: boolean,
        useWaitingRoom: boolean,
        useOwnerVideo: boolean,
        useParticipantsVideo: boolean,
        accessCode: string
    }
}

export type OperationFailedEvent = InternalMessage & {
    operation: Operations,
    error: string,
    //TODO(naz): this is an object that was passed to API for processing, should be a union of arg types
    info: any
}

export type UserId = string;

export type UserNickname = string;

export type UserEmail = string;