/**
 * SfuEvent
 * Used to receive events from the server with SfuExtended.on()
 */
export enum SfuEvent {
    /** Used without callback event */
    CONNECTED = "CONNECTED",
    /** Used to receive {@link OperationFailed} */
    FAILED = "FAILED",
    /** Used to receive {@link ConnectionFailedEvent} */
    CONNECTION_FAILED = "CONNECTION_FAILED",
    /** Used without callback event */
    DISCONNECTED = "DISCONNECTED",
    /** Used to receive {@link Message} */
    MESSAGE = "MESSAGE",
    /** Used to receive {@link ChatsEvent} */
    USER_CHATS = "USER_CHATS",
    /** Used to receive {@link Chat} */
    CHAT_LOADED = "CHAT_LOADED",
    /** Used to receive {@link ChatMessagesEvent} */
    CHAT_MESSAGES = "CHAT_MESSAGES",
    /** Used to receive {@link ChatSearchResultEvent} */
    CHAT_SEARCH_RESULT = "CHAT_SEARCH_RESULT",
    /** Used to receive {@link UserSpecificChatInfo} */
    NEW_CHAT = "NEW_CHAT",
    /** Used to receive {@link UserSpecificChatInfo} */
    CHAT_DELETED = "CHAT_DELETED",
    /** Used to receive {@link UserSpecificChatInfo} */
    CHAT_UPDATED = "CHAT_UPDATED",
    /** Used to receive {@link MessageStatus} */
    MESSAGE_STATE = "MESSAGE_STATE",
    /** Used to receive {@link AttachmentStatus} */
    MESSAGE_ATTACHMENT_STATE = "MESSAGE_ATTACHMENT_STATE",
    /** Used to receive {@link LastReadMessageUpdated} */
    LAST_READ_MESSAGE_UPDATED = "LAST_READ_MESSAGE_UPDATED",
    /** Used to receive {@link UpdateMessagesDeliveryStatusEvent} */
    UPDATE_MESSAGES_DELIVERY_STATUS = "UPDATE_MESSAGES_DELIVERY_STATUS",
    /** @deprecated */
    PUBLIC_CHANNELS = "PUBLIC_CHANNELS",
    /** Used to receive {@link Calendar} */
    USER_CALENDAR = "USER_CALENDAR",
    /** Used to receive {@link CalendarEvent} */
    NEW_CALENDAR_ENTRY = "NEW_CALENDAR_ENTRY",
    /** Used to receive {@link CalendarEvent} */
    REMOVE_CALENDAR_ENTRY = "REMOVE_CALENDAR_ENTRY",
    /** Used to receive {@link CalendarEvent} */
    UPDATE_CALENDAR_EVENT = "UPDATE_CALENDAR_EVENT",
    /** Used without callback event */
    ACK = "ACK",
    ATTACHMENT_DATA = "ATTACHMENT_DATA",
    USER_ROOMS = "USER_ROOMS",
    ATTACHMENT = "ATTACHMENT",
    /** Used to receive {@link UserPmiSettings} */
    SFU_USER_PMI_SETTINGS = "SFU_USER_PMI_SETTINGS",
    /** Used to receive {@link UserPmiSettings} */
    UPDATE_USER_PMI_SETTINGS = "UPDATE_USER_PMI_SETTINGS",
    /** Used to receive {@link UserInfo} */
    USER_INFO = "USER_INFO",
    /** Used to receive {@link UserInfoChangedEvent} */
    USER_INFO_CHANGED = "USER_INFO_CHANGED",
    /** Used to receive {@link MessageEdited} */
    CHAT_MESSAGE_EDITED = "CHAT_MESSAGE_EDITED",
    /** Used to receive {@link MessageDeleted} */
    CHAT_MESSAGE_DELETED = "CHAT_MESSAGE_DELETED",
    /** Used to receive {@link AddedRemovedReactionOnMessage} */
    REACTION_ON_MESSAGE_ADDED = "REACTION_ON_MESSAGE_ADDED",
    /** Used to receive {@link AddedRemovedReactionOnMessage} */
    REACTION_ON_MESSAGE_REMOVED = "REACTION_ON_MESSAGE_REMOVED",
    /** Used to receive {@link SignUpStatus} */
    SIGN_UP_STATUS = "SIGN_UP_STATUS",
    /** Used to receive {@link ResetPasswordRequestStatus} */
    RESET_PASSWORD_REQUEST_STATUS = "RESET_PASSWORD_REQUEST_STATUS",
    /** Used to receive {@link ChatMessagesCount} */
    CHAT_MESSAGES_COUNT = "CHAT_MESSAGES_COUNT",
    /** Used to receive {@link FirstAndLastChatMessage} */
    FIRST_AND_LAST_CHAT_MESSAGE = "FIRST_AND_LAST_CHAT_MESSAGE",
    /** Used to receive {@link UnreadMessagesCountEvent} */
    UNREAD_MESSAGES_COUNT = "UNREAD_MESSAGES_COUNT",
    /** Used to receive {@link UnreadMessagesCountUpdate} */
    UNREAD_MESSAGES_COUNT_UPDATE = "UNREAD_MESSAGES_COUNT_UPDATE",
    /** Used to receive {@link MessageAttachmentsSearchResult} */
    MESSAGE_ATTACHMENTS_SEARCH_RESULT = "MESSAGE_ATTACHMENTS_SEARCH_RESULT",
    /** Used to receive {@link LoadMessagesWithMentionsResult} */
    LOAD_MESSAGES_WITH_MENTIONS_RESULT = "LOAD_MESSAGES_WITH_MENTIONS_RESULT",
    /** Used to receive {@link Message} */
    SEND_MESSAGE_SYNC = "SEND_MESSAGE_SYNC",
    /** Used to receive {@link AuthenticationStatusEvent} */
    AUTHENTICATION_STATUS = "AUTHENTICATION_STATUS",
    /** Used to receive {@link NewMeeting} */
    NEW_MEETING = "NEW_MEETING",
    /** Used to receive {@link MeetingsPreviewEvent} */
    USER_MEETINGS = "USER_MEETINGS",
    /** Used to receive {@link UserContacts} */
    USER_CONTACTS = "USER_CONTACTS",
    /** Used to receive {@link NewFriendInvite} */
    NEW_INCOMING_FRIEND_INVITE = "NEW_INCOMING_FRIEND_INVITE",
    /** Used to receive {@link NewFriendInvite} */
    NEW_OUTGOING_FRIEND_INVITE = "NEW_OUTGOING_FRIEND_INVITE",
    /** Used to receive {@link FriendInviteDeleted} */
    INCOMING_FRIEND_INVITE_DELETED = "INCOMING_FRIEND_INVITE_DELETED",
    /** Used to receive {@link FriendInviteDeleted} */
    OUTGOING_FRIEND_INVITE_DELETED = "OUTGOING_FRIEND_INVITE_DELETED",
    /** Used to receive {@link UserPresenceStatusUpdated} */
    USER_PRESENCE_STATUS_UPDATED = "USER_PRESENCE_STATUS_UPDATED",
    /** Used to receive {@link NewContact} */
    NEW_CONTACT = "NEW_CONTACT",
    /** Used to receive {@link ContactUpdated} */
    CONTACT_UPDATED = "CONTACT_UPDATED",
    /** Used to receive {@link ContactDeleted} */
    CONTACT_DELETED = "CONTACT_DELETED",
    /** Used to receive {@link UserEncryptionInfoEvent} */
    USER_ENCRYPTION_INFO_ADDED = "USER_ENCRYPTION_INFO_ADDED",
    /** Used to receive {@link UserEncryptionInfoEvent} */
    USER_ENCRYPTION_INFO = "USER_ENCRYPTION_INFO"
}

/**
 * RoomEvent
 * Used to receive events from the server with room.on()
 */
export enum RoomEvent {
    CREATED = "CREATED",
    ENDED = "ENDED",
    AVAILABLE = "AVAILABLE",
    FAILED = "FAILED",
    /** Used to receive {@link AddRemoveTracks} */
    ADD_TRACKS = "ADD_TRACKS",
    /** Used to receive {@link AddRemoveTracks} */
    REMOVE_TRACKS = "REMOVE_TRACKS",
    MESSAGE = "MESSAGE",
    /** Used to receive {@link ControlMessageEvent} */
    CONTROL_MESSAGE = "CONTROL_MESSAGE",
    /** Used to receive {@link JoinedRoom} */
    JOINED = "JOINED",
    /** Used to receive {@link LeftRoom} */
    LEFT = "LEFT",
    /** Used to receive {@link ForcefullyLeftEvent} */
    FORCEFULLY_LEFT = "FORCEFULLY_LEFT",
    /** Used to receive {@link PlacedInLobbyEvent} */
    PLACED_IN_LOBBY = "PLACED_IN_LOBBY",
    /** Used without callback event */
    PLACED_IN_WAITING_ROOM = "PLACED_IN_WAITING_ROOM",
    /** Used without callback event */
    DETACHED = "DETACHED",
    /** Used to receive {@link EvictedFromRoom} */
    EVICTED = "EVICTED",
    /** Used without callback event */
    DROPPED = "DROPPED",
    REMOTE_SDP = "REMOTE_SDP",
    /** Used to receive {@link TracksQualityState} */
    TRACK_QUALITY_STATE = "TRACK_QUALITY_STATE",
    /** Used to receive {@link OperationFailedEvent} */
    OPERATION_FAILED = "OPERATION_FAILED",
    /** Used to receive {@link WaitingListEvent} */
    WAITING_LIST = "SFU_WAITING_LIST",
    /** Used to receive {@link WaitingRoomUpdate} */
    WAITING_ROOM_UPDATE = "SFU_WAITING_ROOM_UPDATE",
    /** Used to receive {@link AddRemoveTracks} */
    MUTE_TRACKS = "MUTE_TRACKS",
    /** Used to receive {@link ParticipantsListEvent} */
    PARTICIPANT_LIST = "PARTICIPANT_LIST",
    /** Used to receive {@link RoleAssigned} */
    ROLE_ASSIGNED = "ROLE_ASSIGNED",
    /** Used to receive {@link RolesListEvent} */
    ROLES_LIST = "ROLES_LIST",
    /** Used to receive {@link RoomConfigEvent} */
    ROOM_CONFIG = "ROOM_CONFIG",
    /** Used to receive {@link BooleanEvent} */
    ROOM_LOCKED = "ROOM_LOCKED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_INITIAL_AUDIO_MUTED = "ROOM_INITIAL_AUDIO_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_INITIAL_VIDEO_MUTED = "ROOM_INITIAL_VIDEO_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_INITIAL_SCREEN_SHARING_MUTED = "ROOM_INITIAL_SCREEN_SHARING_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_AUDIO_MUTED = "ROOM_AUDIO_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_VIDEO_MUTED = "ROOM_VIDEO_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_SCREEN_SHARING_MUTED = "ROOM_SCREEN_SHARING_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_CHAT_MUTED = "ROOM_CHAT_MUTED",
    /** Used to receive {@link BooleanEvent} */
    ROOM_CAN_CHANGE_NICKNAME = "ROOM_CAN_CHANGE_NICKNAME",
    /** Used to receive {@link BooleanEvent} */
    ROOM_SCREEN_SHARING_MULTIPLE_SHARES = "ROOM_SCREEN_SHARING_MULTIPLE_SHARES",
    /** Used to receive {@link BooleanEvent} */
    ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE = "ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE",
    /** Used to receive {@link BooleanEvent} */
    ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE = "ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE",
    /** Used to receive {@link ParticipantConfigEvent} */
    PARTICIPANT_CONFIG = "PARTICIPANT_CONFIG",
    /** Used to receive {@link RoomScreenSharingConfigEvent} */
    SCREEN_SHARING_CONFIG = "SCREEN_SHARING_CONFIG",
    /** Used to receive {@link ParticipantAVSMutedEvent} */
    PARTICIPANT_AUDIO_MUTED = "PARTICIPANT_AUDIO_MUTED",
    /** Used to receive {@link ParticipantAVSMutedEvent} */
    PARTICIPANT_VIDEO_MUTED = "PARTICIPANT_VIDEO_MUTED",
    /** Used to receive {@link ParticipantAVSMutedEvent} */
    PARTICIPANT_SCREEN_SHARING_MUTED = "PARTICIPANT_SCREEN_SHARING_MUTED",
    /** Used to receive {@link ParticipantRenamed} */
    PARTICIPANT_RENAMED = "PARTICIPANT_RENAMED",
    /** Used to receive {@link StopScreenSharingEvent} */
    STOP_SCREEN_SHARING = "STOP_SCREEN_SHARING",
    /** Used to receive {@link StopTrackEvent} */
    STOP_TRACK = "STOP_TRACK",
    /** Used to receive {@link BitrateTestStatus} */
    BITRATE_TEST_STATUS = "BITRATE_TEST_STATUS",
    /** Used to receive {@link RoomNameUpdated} */
    ROOM_NAME_UPDATED = "ROOM_NAME_UPDATED",
    // Todo (Igor): add docs
    ROOM_RECORD_STARTED = "ROOM_RECORD_STARTED",
    ROOM_RECORD_STOPPED = "ROOM_RECORD_STOPPED",
    ROOM_RECORD_PAUSED = "ROOM_RECORD_PAUSED",
    ROOM_RECORD_FAILED = "ROOM_RECORD_FAILED"
}

/**
 * SpaceEvent
 * Used to receive events from the server with SfuExtended.on()
 */
export enum SpaceEvent {
    /** Used to receive {@link SfuSpace[]} */
    USER_SPACES = "USER_SPACES",
    /** Used to receive {@link SpaceCreatedEvent} */
    SPACE_CREATED = "SPACE_CREATED",
    /** Used to receive {@link NewSpaceEvent} */
    NEW_SPACE = "NEW_SPACE",
    /** Used to receive {@link SpaceDeletedEvent} */
    SPACE_DELETED = "SPACE_DELETED",
    /** Used to receive {@link SpaceOverviewUpdated} */
    SPACE_OVERVIEW_UPDATED = "SPACE_OVERVIEW_UPDATED",
    /** Used to receive {@link NewSpaceCategoryEvent} */
    NEW_SPACE_CATEGORY = "NEW_SPACE_CATEGORY",
    /** Used to receive {@link SpaceCategoryDeleted} */
    SPACE_CATEGORY_DELETED = "SPACE_CATEGORY_DELETED",
    /** Used to receive {@link SpaceCategoryUpdated} */
    SPACE_CATEGORY_UPDATED = "SPACE_CATEGORY_UPDATED",
    /** Used to receive {@link NewSpaceChannelEvent} */
    NEW_SPACE_CHANNEL = "NEW_SPACE_CHANNEL",
    /** Used to receive {@link SpaceChannelUpdated} */
    SPACE_CHANNEL_UPDATED = "SPACE_CHANNEL_UPDATED",
    /** Used to receive {@link SpaceChannelDeleted} */
    SPACE_CHANNEL_DELETED = "SPACE_CHANNEL_DELETED",
    /** Used to receive {@link SpaceChannelMoved} */
    SPACE_CHANNEL_MOVED = "SPACE_CHANNEL_MOVED",
    /** Used to receive {@link NewSpaceThreadEvent} */
    NEW_SPACE_THREAD = "NEW_SPACE_THREAD",
    /** Used to receive {@link SpaceThreadDeleted} */
    SPACE_THREAD_DELETED = "SPACE_THREAD_DELETED",
    /** Used to receive {@link SpaceThreadUpdated} */
    SPACE_THREAD_UPDATED = "SPACE_THREAD_UPDATED",
    /** Used to receive {@link AddedMembersToThread} */
    ADDED_MEMBERS_TO_THREAD = "ADDED_MEMBERS_TO_THREAD",
    /** Used to receive {@link RemovedMemberFromThread} */
    REMOVED_MEMBER_FROM_THREAD = "REMOVED_MEMBER_FROM_THREAD",
    /** Used to receive {@link SpaceInviteCreated} */
    SPACE_INVITE_CREATED = "SPACE_INVITE_CREATED",
    /** Used to receive {@link SpaceInviteRevoked} */
    SPACE_INVITE_REVOKED = "SPACE_INVITE_REVOKED",
    /** Used to receive {@link NewSpaceRoleAdded} */
    NEW_SPACE_ROLE = "NEW_SPACE_ROLE",
    /** Used to receive {@link SpaceRoleUpdated} */
    SPACE_ROLE_UPDATED = "SPACE_ROLE_UPDATED",
    /** Used to receive {@link SpaceRoleDeleted} */
    SPACE_ROLE_DELETED = "SPACE_ROLE_DELETED",
    /** Used to receive {@link UserJoinedToSpaceEvent} */
    USER_JOINED_TO_SPACE = "USER_JOINED_TO_SPACE",
    /** Used to receive {@link UserLeftSpace} */
    USER_LEFT_SPACE = "USER_LEFT_SPACE",
    /** Used to receive {@link AddedRoleToMember} */
    ADDED_ROLE_TO_MEMBER = "ADDED_ROLE_TO_MEMBER",
    /** Used to receive {@link RemovedRoleFromMember} */
    REMOVED_ROLE_FROM_MEMBER = "REMOVED_ROLE_FROM_MEMBER",
    /** Used to receive {@link RolePermissionSectionsEvent} */
    ROLE_PERMISSION_SECTIONS = "ROLE_PERMISSION_SECTIONS",
    /** Used to receive {@link UserSpaceNicknameUpdated} */
    USER_SPACE_NICKNAME_UPDATED = "USER_SPACE_NICKNAME_UPDATED"
}

/**
 * MeetingSyncEvent
 * Used to receive meeting sync events from the server with SfuExtended.on()
 */
export enum MeetingSyncEvent {
    /** Used to receive {@link MeetingEndedSync} */
    MEETING_ENDED_SYNC = "MEETING_ENDED_SYNC",
    /** Used to receive {@link JoinedRoomSync} */
    JOINED_MEETING_SYNC = "JOINED_MEETING_SYNC",
    /** Used to receive {@link LeftMeetingSync} */
    LEFT_MEETING_SYNC = "LEFT_MEETING_SYNC",
    /** Used to receive {@link EvictedSync} */
    EVICTED_SYNC = "EVICTED_SYNC",
    /** Used to receive {@link AddRemoveTracksSync} */
    ADD_TRACKS_SYNC = "ADD_TRACKS_SYNC",
    /** Used to receive {@link AddRemoveTracksSync} */
    REMOVE_TRACKS_SYNC = "REMOVE_TRACKS_SYNC",
    /** Used to receive {@link AddRemoveTracksSync} */
    MUTE_TRACKS_SYNC = "MUTE_TRACKS_SYNC",
    /** Used to receive {@link ParticipantsListSyncEvent} */
    PARTICIPANT_LIST_SYNC = "PARTICIPANT_LIST_SYNC",
    /** Used to receive {@link MeetingNameUpdatedSync} */
    MEETING_NAME_UPDATED_SYNC = "MEETING_NAME_UPDATED_SYNC",
}

export enum ExamplesEvent {
    FREE_EXAMPLES_USER = "FREE_EXAMPLES_USER"
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
    TURN_OFF_PARTICIPANT_SCREEN_SHARING = "TURN_OFF_PARTICIPANT_SCREEN_SHARING",
    GET_USER_INFO = "GET_USER_INFO",
    CHANGE_USER_EMAIL = "CHANGE_USER_EMAIL",
    CHANGE_USER_PASSWORD = "CHANGE_USER_PASSWORD",
    CHANGE_USER_NICKNAME = "CHANGE_USER_NICKNAME",
    CHANGE_USER_PHONE_NUMBER = "CHANGE_USER_PHONE_NUMBER",
    CHANGE_USER_HOST_KEY = "CHANGE_USER_HOST_KEY",
    CHANGE_USER_TIMEZONE = "CHANGE_USER_TIMEZONE",
    EDIT_CHAT_MESSAGE = "EDIT_CHAT_MESSAGE",
    DELETE_CHAT_MESSAGE = "DELETE_CHAT_MESSAGE",
    SIGN_UP = "SIGN_UP",
    REMOVE_USER = "REMOVE_USER",
    RESET_PASSWORD = "RESET_PASSWORD",
    GET_CHAT_MESSAGES_COUNT = "GET_CHAT_MESSAGES_COUNT",
    SEARCH_MESSAGE_ATTACHMENTS = "SEARCH_MESSAGE_ATTACHMENTS",
    LOAD_MESSAGES_WITH_MENTIONS = "LOAD_MESSAGES_WITH_MENTIONS",
    LEASE_TRACK = "LEASE_TRACK"
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
    Z_USER_MANAGEMENT_APP = "sfuZUserManagementApp",
    Z_EXAMPLES_MANAGEMENT_APP = "sfuZExamplesManagementApp",
    Z_ATTACHMENTS_TRANSFER_APP = "sfuZAttachmentsTransferHandler",
    DEFAULT_METHOD = "sfuCallback",
    BINARY_DATA = "binaryData",
    JOIN_ROOM = "joinRoom",
    CREATE_ROOM = "createRoom",
    ROOM_AVAILABLE = "roomAvailable",
    ROOM_EXISTS = "roomExists",
    UPDATE_ROOM_STATE = "updateRoomState",
    DESTROY_ROOM = "destroyRoom",
    LEAVE_ROOM = "leaveRoom",
    START_ROOM_RECORD = "startRoomRecord",
    STOP_ROOM_RECORD = "stopRoomRecord",
    EVICT_PARTICIPANT = "evictParticipant",
    RENAME_PARTICIPANT = "renameParticipant",
    CHANGE_QUALITY = "changeQuality",
    CHANGE_SID = "changeSid",
    CHANGE_TID = "changeTid",
    AUTHORIZE_WAITING_LIST = "authorizeWaitingList",
    MESSAGE = "SFU_MESSAGE",
    MESSAGE_STATE = "SFU_MESSAGE_STATE",
    MESSAGE_ATTACHMENT_STATE = "SFU_MESSAGE_ATTACHMENT_STATE",
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
    MUTE_REMOTE_TRACK = "muteRemoteTrack",
    SEND_MESSAGE = "sendMessage",
    GET_ATTACHMENT = "downloadAttachment",
    SEND_CONTROL_MESSAGE = "sendControlMessage",
    MARK_MESSAGE_READ = "markMessageRead",
    MARK_MESSAGE_UNREAD = "markMessageUnread",
    ASSIGN_ROLE = "assignRole",
    SUBSCRIBE_TO_WAITING_PARTICIPANT = "subscribeToWaitingParticipant",
    UNSUBSCRIBE_FROM_WAITING_PARTICIPANT = "unsubscribeFromWaitingParticipant",
    MOVE_TO_WAITING_ROOM = "moveToWaitingRoom",
    CONFIGURE_WAITING_ROOM = "configureWaitingRoom",
    TRACK_CONTENT_HEADER = "a=content:",
    GET_USER_CHATS = "getUserChats",
    GET_PUBLIC_CHANNELS = "getPublicChannels",
    LOAD_CHAT = "loadChat",
    LOAD_MESSAGES = "loadMessages",
    SEARCH_CHAT_MESSAGES = "searchChatMessages",
    GET_MESSAGES_COUNT = "getMessagesCount",
    GET_FIRST_AND_LAST_MESSAGE = "getFirstAndLastMessage",
    GET_UNREAD_MESSAGES_COUNT = "getUnreadMessagesCount",
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
    UPDATE_CHAT_HIDING = "updateChatHiding",
    ADD_CONTACT_TO_FAVOURITES = "addContactToFavourites",
    REMOVE_CONTACT_FROM_FAVOURITES = "removeContactFromFavourites",
    GET_ACTIVE_ROOMS = "getActiveRooms",
    RECLAIM_OWNER_RIGHTS = "reclaimOwnerRights",
    CANCEL_SENDING_ATTACHMENT = "cancelSendingAttachment",
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
    TURN_OFF_PARTICIPANT_SCREEN_SHARING = "turnOffParticipantScreenSharing",
    GET_USER_INFO = "getUserInfo",
    CHANGE_USER_EMAIL = "changeUserEmail",
    CHANGE_USER_PASSWORD = "changeUserPassword",
    CHANGE_USER_NICKNAME = "changeUserNickname",
    CHANGE_USER_PHONE_NUMBER = "changeUserPhoneNumber",
    CHANGE_USER_HOST_KEY = "changeUserHostKey",
    CHANGE_USER_TIMEZONE = "changeUserTimezone",
    EDIT_MESSAGE = "editMessage",
    DELETE_MESSAGE = "deleteMessage",
    ADD_REACTION_ON_MESSAGE = "addReactionOnMessage",
    REMOVE_REACTION_ON_MESSAGE = "removeReactionOnMessage",
    SIGN_UP = "signUp",
    ENSURE_USERNAME_AVAILABLE = "ensureUsernameAvailable",
    REMOVE_USER = "removeUser",
    RESET_PASSWORD_REQUEST = "resetPasswordRequest",
    RESET_PASSWORD = "resetPassword",
    SEARCH_MESSAGE_ATTACHMENTS = "searchMessageAttachments",
    LOAD_MESSAGES_WITH_MENTIONS = "loadMessagesWithMentions",
    LEASE_TRACK = "leaseTrack",
    LOGOUT = "logout",
    START_BITRATE_TEST = "startBitrateTest",
    END_BITRATE_TEST = "endBitrateTest",
    GET_TEST_LATENCY = "getBitrateLatency",
    GET_USER_SPACES = "getUserSpaces",
    CREATE_SPACE = "createSpace",
    DELETE_SPACE = "deleteSpace",
    LEAVE_SPACE = "leaveSpace",
    UPDATE_SPACE_OVERVIEW = "updateSpaceOverview",
    CREATE_SPACE_CATEGORY = "createSpaceCategory",
    DELETE_SPACE_CATEGORY = "deleteSpaceCategory",
    UPDATE_SPACE_CATEGORY = "updateSpaceCategory",
    CREATE_SPACE_CHANNEL = "createSpaceChannel",
    UPDATE_SPACE_CHANNEL = "updateSpaceChannel",
    MOVE_SPACE_CHANNEL = "moveSpaceChannel",
    DELETE_SPACE_CHANNEL = "deleteSpaceChannel",
    CREATE_SPACE_THREAD = "createSpaceThread",
    UPDATE_SPACE_THREAD = "updateSpaceThread",
    ADD_MEMBERS_TO_THREAD = "addMembersToThread",
    REMOVE_MEMBER_FROM_THREAD = "removeMemberFromThread",
    DELETE_SPACE_THREAD = "deleteSpaceThread",
    GENERATE_SPACE_INVITE =  "generateNewSpaceInvite",
    REVOKE_SPACE_INVITE = "revokeSpaceInvite",
    JOIN_SPACE_BY_INVITE_CODE =  "joinSpaceByInviteCode",
    ADD_SPACE_ROLE = "addSpaceRole",
    UPDATE_SPACE_ROLE = "updateSpaceRole",
    DELETE_SPACE_ROLE = "deleteSpaceRole",
    ADD_ROLE_TO_MEMBER = "addRoleToMember",
    REMOVE_ROLE_FROM_MEMBER = "removeRoleFromMember",
    GET_ROLE_PERMISSIONS = "getRolePermissions",
    CREATE_CHANNEL_MEETING = "createChannelMeeting",
    CREATE_DIRECT_MEETING = "createDirectMeeting",
    GET_CONTACTS = "getContacts",
    ADD_FRIEND = "addFriend",
    REMOVE_FRIEND = "removeFriend",
    REVOKE_FRIEND_INVITE = "revokeFriendInvite",
    ACCEPT_FRIEND_INVITE = "acceptFriendInvite",
    REJECT_FRIEND_INVITE = "rejectFriendInvite",
    UPDATE_PRESENCE_STATUS = "updatePresenceStatus",
    UPDATE_ACTIVITY_STATUS = "updateActivityStatus",
    GET_EXAMPLES_FREE_USER = "getFreeUser",
    ADD_USER_ENCRYPTION_INFO = "addUserEncryptionInfo",
    GET_USER_ENCRYPTION_INFO = "getUserEncryptionInfo",
    UPDATE_SPACE_NICKNAME = "updateSpaceNickname"
}

export enum ConnectionError {
    CONNECTION_ALREADY_ESTABLISHED = "Connection is already established.",
    CONNECTION_ALREADY_IN_PROGRESS = "Connection is already in progress."
}

export enum ContactError {
    USER_CAN_NOT_SEND_INVITE_TO_HIMSELF = "User can not send invite to himself"
}

export enum ChatError {
    CAN_NOT_SEND_MESSAGE_WITHOUT_CONTENT = "Can't send message without content",
    CAN_NOT_SEND_NULL_MESSAGE = "Can't send null message",
    CAN_NOT_SEND_MESSAGE_WITHOUT_CHAT_ID = "Can't send message without a chatId",
    USER_MUST_BE_A_CHAT_MEMBER_TO_SEND_MESSAGES = "User must be a chat member to send messages",
    CAN_NOT_CANCEL_SENDING_ATTACHMENT = "Can't cancel sending attachment",
    CAN_NOT_EDIT_MESSAGE_WITHOUT_MESSAGE_ID = "Can't edit message without messageId",
    EDIT_MESSAGE_ERROR_CHAT_DOES_NOT_EXISTS = "Failed to edit message, chat doesn't exist",
    EDIT_MESSAGE_ERROR_MESSAGE_DOES_NOT_EXISTS = "Failed to edit message, message doesn't exist",
    EDIT_MESSAGE_ERROR_MESSAGE_CAN_NOT_BE_WITHOUT_CONTENT = "Failed to edit message, message must have body or attachments",
    DELETE_MESSAGE_ERROR_CHAT_DOES_NOT_EXISTS = "Failed to delete message, chat doesn't exist",
    DELETE_MESSAGE_ERROR_MESSAGE_DOES_NOT_EXISTS = "Failed to delete message, message doesn't exist",
    CAN_NOT_ADD_MEMBER_TO_PRIVATE_CHAT = "Adding a member to the private chat is not allowed",
    CAN_NOT_REMOVE_MEMBER_FROM_PRIVATE_CHAT = "Removing a member from the private chat is not allowed",
    CAN_NOT_RENAME_PRIVATE_CHAT = "Renaming the private chat is not allowed",
    INCORRECT_CHAT_ENCRYPTION_SETTINGS = "Incorrect chat encryption settings",
    DOWNLOADING_ATTACHMENT_FAILED = "Downloading failed"
}

export enum ChatSectionsError {
    PAGE_NOT_FOUND = "Page not found"
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
    RENAMING_PROHIBITED = "Renaming prohibited by the owner",
    TRACK_ALREADY_DISPOSED = "Track already disposed"
}

export enum UserInfoError {
    EMAIL_ADDRESS_ALREADY_TAKEN = "User with this email already exists",
    CURRENT_PASSWORD_IS_INCORRECT = "You entered incorrect current password",
    CURRENT_PASSWORD_IS_NULL = "Current password can't be null",
    NEW_PASSWORD_IS_NULL = "New password can't be null",
    PASSWORD_POLICY_ERROR = "New password should be at least 6 characters"
}

export enum UserManagementError {
    EMAIL_ADDRESS_ALREADY_TAKEN = "User with this email already exists",
    USERNAME_ALREADY_IN_USE = "Username is already in use",
    USER_NOT_FOUND = "User not found",
    USER_IS_NOT_REMOVED = "Failed to remove user",
    EMAIL_IS_NOT_VERIFIED = "Email is not verified",
    OPERATION_FAILED_BY_DISCONNECT = "Operation failed by disconnect",
    CONNECTION_ERROR = "Connection error",
    CONNECTION_FAILED = "Connection failed",
    EMAIL_VERIFICATION_DECLINED = "Email verification is declined",
    EMAIL_VERIFICATION_FAILED_BY_TIMEOUT = "Email verification failed by timeout",
    EMAIL_NOT_FOUND = "Email not found"
}

export enum SpaceError {
    USER_ALREADY_JOINED = "User already joined",
    RESTRICTED_ACCESS = "Restricted access"
}

export enum ExamplesError {
    OPERATION_FAILED_BY_DISCONNECT = "Operation failed by disconnect",
    CONNECTION_ERROR = "Connection error",
    CONNECTION_FAILED = "Connection failed",
}

export const ATTACHMENT_CHUNK_SIZE = 100000;

export type InternalMessage = {
    type: SfuEvent | RoomEvent | SpaceEvent | MeetingSyncEvent | InternalApi | ExamplesEvent,
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
    ANSWER = "answer",
    ROLLBACK = "rollback"
}

export type RemoteSdp = InternalMessage & RemoteSdpInfo;

export type RemoteSdpInfo = {
    info: {
        sdp: string,
        type: RemoteSdpType,
        tid: string
    }
}

export type RoleAssigned = InternalMessage & {
    userId: UserId,
    name: UserNickname,
    role: ParticipantRole
}

export type RolesListEvent = InternalMessage & {
    roles: Array<{
        userId: UserId,
        role: ParticipantRole
    }>
}

export type CreatedRoom = InternalMessage & {
    name: string,
    owner: string,
    pin: string,
    conferenceType: ConferenceType,
    inviteId: string,
    chatId: string,
    //unix epoch in UTC
    creationTime: number,
    waitingRoomEnabled: boolean,
    config?: RoomExtendedConfig
}

export type RoomInfo = {
    id: string,
    owner: string,
    name: string,
    pin: string,
    creationTime: number,
    waitingRoomEnabled: boolean,
    config: RoomExtendedConfig
}

export type UserRoomsEvent = InternalMessage & {
    rooms: Array<RoomInfo>
}

export type RoomAvailable = InternalMessage & {
    name: string,
    owner: string,
    pin: string,
    conferenceType: ConferenceType,
    creationTime: number,
    waitingRoomEnabled: boolean,
    config: RoomExtendedConfig
}

export type RoomExtendedParticipantConfig = {
    audioMuted: boolean,
    videoMuted: boolean,
    screenSharingMuted: boolean
}

export type RoomExtendedParticipantsConfig = {
    [key: UserId]: RoomExtendedParticipantConfig
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

export type PlacedInWaitingRoomEvent = InternalMessage & {
    userId: UserId,
    name: UserNickname
}

export type PlacedInLobbyEvent = InternalMessage & {
    userId: UserId,
    name: UserNickname
}

export type JoinedRoom = InternalMessage & {
    userId: UserId,
    name: UserNickname,
    chatId: string,
    owner: boolean
}

export type LeftRoom = InternalMessage & {
    userId: UserId,
    name: UserNickname
}

export type EvictedFromRoom = InternalMessage & {
    userId: UserId,
    name: UserNickname
}

export type ForcefullyLeftEvent = InternalMessage & {
    userId: string,
    reason: string
}

export type ParticipantRenamed = InternalMessage & {
    userId: UserId,
    previousName: UserNickname,
    updatedName: UserNickname
}

export type WaitingParticipant = InternalMessage & {
    userId: UserId,
    name: string,
    isAudioEnabled: boolean,
    isVideoEnabled: boolean,
    isScreenSharingEnabled: boolean
}

export type Participant = InternalMessage & {
    userId: UserId,
    name: string
}

export type ParticipantsListEvent = InternalMessage & {
    participants: Array<Participant>
}

export type WaitingListEvent = InternalMessage & {
    users: Array<WaitingParticipant>
}

export type RoomConfigEvent = InternalMessage & {
    config: RoomExtendedConfig
}

export type ParticipantConfigEvent = InternalMessage & {
    userId: UserId,
    config: RoomExtendedParticipantConfig
}

export type RoomScreenSharingConfigEvent = InternalMessage & {
    config: RoomExtendedScreenSharingConfig
}

export type ParticipantAVSMutedEvent = InternalMessage & {
    userId: UserId,
    value: boolean
}

export type StopScreenSharingEvent = InternalMessage & {
    userId: UserId,
    reason: string
}

export type StopTrackEvent = InternalMessage & {
    userId: UserId,
    id: string,
    tracksMid: Array<string>
}

export type AddRemoveTracks = InternalMessage & {
    info: {
        userId: UserId,
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

export type TracksQualityState = InternalMessage & {
    info: {
        nickName: UserNickname,
        userId:UserId;
        tracks: Array<{
            mid: string,
            quality: Array<Quality>,
        }>
    }
}

export type RoomNameUpdated = InternalMessage & {
    name: string;
}

export enum ConferenceType {
    GLOBAL = "GLOBAL",
    CHANNEL = "CHANNEL",
    DIRECT = "DIRECT"
}

export type SFUMeetingParticipantPreview = {
    userId: UserId,
    nickname: UserNickname,
    audioEnabled: boolean,
    videoEnabled: boolean,
    screenSharingEnabled: boolean,
    owner: boolean,
    mediaConfig: {
        isAudioMuted: boolean,
        isVideoMuted: boolean,
        isScreenSharingMuted: boolean
    }
}

export type SFUMeetingPreview = {
    id: string;
    type: ConferenceType;
    owner: string;
    name?: string;
    userId: UserId;
    nickname: UserNickname;
    participants: Array<SFUMeetingParticipantPreview>;
    creationTime: number;
}

export type NewMeeting = InternalMessage & {
    id: string;
    conferenceType: ConferenceType;
    name: string;
    owner: string;
    pin: string;
    creationTime: number;
    participants: Array<SFUMeetingParticipantPreview>;
    config: RoomExtendedConfig;
}

export type MeetingsPreviewEvent = InternalMessage & {
    meetings: SFUMeetingPreview[];
}

export type JoinedRoomSync = InternalMessage & {
    id: string,
    userId: UserId,
    name: UserNickname,
    chatId: string,
    owner: boolean
}

export type LeftMeetingSync = InternalMessage & {
    id: string;
    userId: string;
}

export type EvictedSync = InternalMessage & {
    id: string;
    userId: string;
}

export type MeetingEndedSync = InternalMessage & {
    id: string;
}

export type ParticipantsListSyncEvent = ParticipantsListEvent & {
    id: string;
}

export type AddRemoveTracksSync = InternalMessage & {
    id: string;
    info: {
        userId: UserId,
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

export type MeetingNameUpdatedSync = InternalMessage & {
    id: string;
    name: string;
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
    DELIVERY_CANCELLED = "DELIVERY_CANCELLED",
    DELETED = "DELETED"
}

export enum DeliveryStatus {
    PENDING = "PENDING",
    DELIVERED = "DELIVERED",
    READ = "READ"
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
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    parentMessage: Message;
    delivered: boolean;
    state: MessageState;
    lastReadMessageId: string;
    info: string;
    date: number;
    attachments: Array<MessageAttachment>;
    deliveryStatus: MessageDeliveryStatus;
    edited: boolean,
    dateOfEdit: number,
    reactions: Array<string>
}

export type AttachmentStatus = {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messageId: string;
    id: string;
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
    mediaType?: MessageAttachmentMediaType;
    name: string;
    size: number;
    id: string;
}

export type MessageAttachmentData = {
    payload: ArrayBuffer;
    id: string;
}

export type AttachmentRequest = {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messageId: string;
    attachmentId: string;
    name: string;
}

export type Attachment = AttachmentRequest & {
    internalMessageId: string;
    sessionId?: string;
    payload: ArrayBuffer
}

export type AttachmentRequestAck = InternalMessage & {
    sessionId: string;
    attachmentRequest: AttachmentRequest;
}

export enum MessageTargetEntityType {
    CHAT = "CHAT",
    CHANNEL = "CHANNEL",
    THREAD = "THREAD"
}

export type MessageTargetEntityId = {
    chatId?: string;
    spaceId?: string;
    channelId?: string;
    threadId?: string;
}

export type MessageReaction = {
    reaction: string;
    reactedUsers: Array<string>
}

export type Message = {
    id: string;
    parentMessage?: Message;
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    date: number;
    from: UserId;
    to?: UserId;
    status: MessageState;
    body: string;
    attachments: Array<MessageAttachment>;
    deliveryStatus: MessageDeliveryStatus;
    privateMessage: boolean;
    edited: boolean;
    dateOfEdit: number;
    reactions: Array<MessageReaction>;
}

export type SfuMessageEvent = InternalMessage & {
    message: Message
}

export type MessageStatusEvent = InternalMessage & {
    status: MessageStatus,
    waitingUploadingAttachments: boolean,
    messageWithUploadingAttachments: MessageWithUploadingAttachments
}

export type MessageWithUploadingAttachments = {
    messageId: string,
    messageTransferId: number,
    attachmentsInfo: Array<UploadingAttachmentInfo>
}

export type UploadingAttachmentInfo = {
    id: string,
    attachmentTransferId: number
}

export type AttachmentStatusEvent = InternalMessage & {
    status: AttachmentStatus
}

export type UpdateMessagesDeliveryStatusEvent = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    dateFrom: number,
    dateTo: number,
    userId: string,
    status: DeliveryStatus
}

export type LastReadMessageUpdated = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    updateInfo: LastReadMessageUpdate
}

export type LastReadMessageUpdate = {
    oldLastReadMessageDate: number,
    lastReadMessageDate: number,
    lastReadMessageId: string
}

export type AddedRemovedReactionOnMessage = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messageId: string;
    reactedUser: string;
    reaction: string;
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

export enum PresenceStatus {
    ONLINE = "ONLINE",
    IDLE = "IDLE",
    DO_NOT_DISTURB = "DO_NOT_DISTURB",
    OFFLINE = "OFFLINE"
}

export type UserInfo = {
    id: UserId,
    email: UserEmail,
    nickname: UserNickname,
    phoneNumber: UserPhoneNumber,
    hostKey: UserHostKey,
    timezone: UserTimezone,
    status: PresenceStatus,
}

export type CalendarEvent = {
    id: string;
    meetingId: string;
    scheduledMeetingId: string;
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
    allowJoinAtAnyTime: boolean;
    useMuteAudioOnJoin: boolean;
    useLocalAutoRecord: boolean;
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
    hidden: boolean;
    channel: boolean;
    name: string;
    owner: UserId;
    creationDate: number;
    members: Array<UserId>;
    lastReadMessageId: string;
    lastReadMessageDate: number;
    canSend: boolean;
    type: ChatType;
    channelSendPolicy: ChannelSendPolicy;
    chatReceivePolicy: ChatReceivePolicy;
    sendPermissionList: Array<string>;
    allowedToAddExternalUser: boolean;
    encryptionEnabled: boolean;
    encryptedPrivateKey: string;
    publicKey: string;
    encryptedChatPassword: string;
    encryptedAttachmentsSecretKey: string;
}
export enum ChatType {
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
    type: ChatType;
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
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
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

export type UserInfoEvent = InternalMessage & {
    userInfo: UserInfo
}

export type UserInfoChangedEvent = InternalMessage & {
    userId: UserId,
    info: UserInfo
}

export type UserNicknameChangedEvent = InternalMessage & {
    userId: UserId,
    nickname: UserNickname
}

export type UserHostKeyChangedEvent = InternalMessage & {
    userId: UserId,
    hostKey: UserHostKey
}

export type UserPhoneNumberChangedEvent = InternalMessage & {
    userId: UserId,
    phoneNumber: UserPhoneNumber
}

export type UserTimezoneChangedEvent = InternalMessage & {
    userId: UserId,
    timezone: UserTimezone
}

export type MessageEdited = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    message: Message
}

export type MessageDeleted = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messageId: string,
    state: MessageState
}

export type SignUpStatus = InternalMessage & {
    id: UserId,
    email: UserEmail,
    nickname: UserNickname,
    verified: boolean
}

export type ResetPasswordRequestStatus = InternalMessage & {
    email: string,
    confirmed: boolean
}

export type ChatMessagesCount = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messagesCount: number;
}

export type FirstAndLastChatMessage = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    firstMessageId: string;
    firstMessageDate: number;
    lastMessageId: string;
    lastMessageDate: number;
}

export type UnreadMessagesCountEvent = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    unreadMessagesCount: number;
}

export type UnreadMessagesCountUpdate = InternalMessage & {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    updatesCount: number;
}

export enum MessageAttachmentMediaType {
    media = "media",
    other = "other"
}

export type AttachmentInfo = {
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    messageId: string;
    id: string;
    name: string;
    type: MessageAttachmentType,
    mediaType: MessageAttachmentMediaType;
    size: number;
    from: string;
    date: number;
}

export type MessageAttachmentsSearchResult = InternalMessage & {
    attachmentsInfo: Array<AttachmentInfo>,
    totalSize: number
}

export type MessageInfo = {
    id: string;
    targetEntityType: MessageTargetEntityType;
    targetEntityId: MessageTargetEntityId;
    parentMessage: MessageInfo;
    date: number;
    clientDate: number;
    from: string;
    to: string;
    body: string;
    attachments: Array<MessageAttachment>;
    privateMessage: boolean;
    edited: boolean;
    dateOfEdit: number;
}

export type LoadMessagesWithMentionsResult = InternalMessage & {
    messages: Array<MessageInfo>;
    totalSize: number;
}

export type SfuSpaceRolePermission = {
    name: string;
    displayName: string;
    description: string;
    position: number
}

export type SfuSpaceRolePermissionSection = {
    name: string;
    displayName: string;
    position: number;
    permissions: Array<SfuSpaceRolePermission>
}

export type SfuSpaceRole = {
    id: string;
    name: string;
    color: string;
    createdAt: number;
    permissions: Array<string>;
}

export type SfuSpaceMember = {
    userId: string;
    nickname: string;
    roles: Array<string>;
}

export type SfuSpaceCategory = {
    id: string;
    name: string;
    creator: string;
    createdAt: number;
}

export type SfuSpaceThread = {
    id: string;
    name: string;
    creator: string;
    private: boolean;
    createdAt: number;
    members: Array<string>;
    lastReadMessageId: string;
    lastReadMessageDate: number;
}

export type SfuSpaceChannel = {
    id: string;
    categoryId: string;
    name: string;
    creator: string;
    private: boolean;
    accessRights: SfuSpaceChannelAccessRights;
    createdAt: number;
    members: Array<string>;
    threads: Array<SfuSpaceThread>
    lastReadMessageId: string;
    lastReadMessageDate: number;
}

export type SfuSpaceInvite = {
    inviteCode: string;
    inviter: string;
    uses: number;
    createdAt: number;
    expiresAt: number;
}

export type SfuSpaceUserBan = {
    id: string;
    userId: string;
    bannedAt: number;
}

export type SfuSpaceChannelAccessRights = {
    roles: Array<string>;
    members: Array<string>;
}

export type SfuSpace = {
    id: string;
    name: string;
    owner: string;
    createdAt: number;
    roles: Array<SfuSpaceRole>;
    members: Array<SfuSpaceMember>;
    categories: Array<SfuSpaceCategory>;
    channels: Array<SfuSpaceChannel>;
    invites: Array<SfuSpaceInvite>;
    bans: Array<SfuSpaceUserBan>;
    permissions: Array<SfuSpaceRolePermission>;
}

export type SpaceCreatedEvent = InternalMessage & {
    space: SfuSpace;
}

export type NewSpaceEvent = InternalMessage & {
    space: SfuSpace;
}

export type SpaceDeletedEvent = InternalMessage & {
    id: string;
}

export type SpaceOverviewUpdated = InternalMessage & {
    id: string;
    name: string;
}

export type NewSpaceCategoryEvent = InternalMessage & {
    spaceId: string;
    category: SfuSpaceCategory;
}

export type SpaceCategoryDeleted = InternalMessage & {
    spaceId: string;
    categoryId: string;
}

export type SpaceCategoryUpdated = InternalMessage & {
    spaceId: string;
    categoryId: string;
    name: string;
}

export type NewSpaceChannelEvent = InternalMessage & {
    spaceId: string;
    channel: SfuSpaceChannel;
}

export type SpaceChannelUpdated = InternalMessage & {
    spaceId: string;
    channelId: string;
    private: boolean;
    name: string;
    accessRights: SfuSpaceChannelAccessRights;
    members: Array<string>;
}

export type SpaceChannelMoved = InternalMessage & {
    spaceId: string;
    categoryId: string;
    channelId: string;
}

export type SpaceChannelDeleted = InternalMessage & {
    spaceId: string;
    channelId: string;
}

export type NewSpaceThreadEvent = InternalMessage & {
    spaceId: string;
    channelId: string;
    thread: SfuSpaceThread;
}

export type SpaceThreadUpdated = InternalMessage & {
    spaceId: string;
    channelId: string;
    threadId: string;
    name: string;
}

export type AddedMembersToThread = InternalMessage & {
    spaceId: string;
    channelId: string;
    threadId: string;
    members: Array<string>;
}

export type RemovedMemberFromThread = InternalMessage & {
    spaceId: string;
    channelId: string;
    threadId: string;
    member: string;
}

export type SpaceThreadDeleted = InternalMessage & {
    spaceId: string;
    channelId: string;
    threadId: string;
}

export type SpaceInviteCreated = InternalMessage & {
    spaceId: string;
    invite: SfuSpaceInvite
}

export type SpaceInviteRevoked = InternalMessage & {
    spaceId: string;
    inviteCode: string;
}

export type NewSpaceRoleAdded = InternalMessage & {
    spaceId: string;
    role: SfuSpaceRole;
    members: Array<string>;
}

export type SpaceRoleUpdated = InternalMessage & {
    spaceId: string;
    roleId: string;
    name: string;
    color: string;
    permissions: Array<string>;
    membersForAddRole: Array<string>;
    membersForDeleteRole: Array<string>;
}

export type SpaceRoleDeleted = InternalMessage & {
    spaceId: string;
    roleId: string;
}

export type UserSpacesEvent = InternalMessage & {
    spaces: Array<SfuSpace>;
}

export type UserJoinedToSpaceEvent = InternalMessage & {
    spaceId: string;
    userId: string;
    nickname: string;
    channels: Array<string>;
    threads: Array<string>;
}

export type UserLeftSpace = InternalMessage & {
    spaceId: string;
    userId: string;
}

export type AddedRoleToMember = InternalMessage & {
    spaceId: string;
    roleId: string;
    memberId: string;
}

export type RemovedRoleFromMember = InternalMessage & {
    spaceId: string;
    roleId: string;
    memberId: string;
}

export type RolePermissionSectionsEvent = InternalMessage & {
    permissionSections: Array<SfuSpaceRolePermissionSection>;
}

export type FriendInvite = {
    userId: string;
    nickname: string;
    inviteId: string;
}

export type BannedContact = {
    userId: string;
    nickname: string;
    bannedAt: number;
}

export type Contact = {
    userId: string;
    nickname: string;
    friend: boolean;
    status: PresenceStatus;
    publicKey: string;
    encryptionEnabled: boolean;
}

export type UserContacts = {
    contacts: Array<Contact>;
    incomingFriendInvites: Array<FriendInvite>;
    outgoingFriendInvites: Array<FriendInvite>;
    bans: Array<BannedContact>;
}

export type UserContactsEvent = InternalMessage & {
    contacts: UserContacts;
}

export type NewFriendInvite = InternalMessage & {
    userId: string;
    nickname: string;
    inviteId: string;
}

export type FriendInviteDeleted = InternalMessage & {
    inviteId: string;
}

export type UserPresenceStatusUpdated = InternalMessage & {
    userId: string;
    status: PresenceStatus;
}

export type NewContact = InternalMessage & {
    contact: Contact;
}

export type ContactUpdated = InternalMessage & {
    contact: Contact;
}

export type ContactDeleted = InternalMessage & {
    userId: string;
}

export type UserChatEncryptedPassword = {
    userId: string;
    password: string;
}

export type UserEncryptionInfo = {
    privateKey: string;
    publicKey: string;
    encryptionEnabled: boolean;
    verificationHash: string;
    salt: string;
    iv: string;
}

export type UserEncryptionInfoEvent = InternalMessage & {
    info: UserEncryptionInfo;
}

export type UserSpaceNicknameUpdated = InternalMessage & {
    spaceId: string;
    userId: string;
    nickname: string;
}

export enum SortOrder {
    ASC, DESC
}

export type OperationFailedEvent = InternalMessage & {
    operation: Operations,
    error: string,
    //TODO(naz): this is an object that was passed to API for processing, should be a union of arg types
    info: any
}

export type ConnectionFailedEvent = InternalMessage & {
    reason: string,
    code?: number
}

export enum ConnectionType {
    MAIN = "MAIN",
    MEETING = "MEETING",
    CHAT = "CHAT",
    MEETING_CHAT = "MEETING_CHAT"
}

export type ConnectionDetails = {
    id: string,
    type: ConnectionType
}

export type BitrateTestStatus = InternalMessage & {
    latency: number
}

export enum AuthenticationStatus {
    VERIFYING_BY_EMAIL = "VERIFYING_BY_EMAIL"
}

export type AuthenticationStatusEvent = InternalMessage & {
    status: AuthenticationStatus
}

export type ExamplesUser = {
    userId: string;
    email: string;
    password: string;
}

export type ExamplesUserEvent = InternalMessage & {
    user: ExamplesUser;
}

export type UserId = string;

export type UserNickname = string;

export type UserEmail = string;

export type UserPassword = string;

export type UserPhoneNumber = string;

export type UserHostKey = string;

export type UserTimezone = string

export type Quality = {
    quality:string;
    available:boolean;
    layersInfo: {
        spatialLayers:Array<{
            resolution:{
                width:number;
                height:number;
            };
            sid:number;
        }>;
        temporalLayers:Array<{tid:number}>;
    }
}

export const WS_CONNECTION_TIMEOUT = 10000;

// Set server ping timeout as WCS default setting
export const WS_PING_INTERVAL_MS = 5000;

// Set missing pings threshold as a half of WCS default setting
export const WS_PINGS_MISSING_THRESHOLD = 5;

export const ATTACHMENT_ID_LENGTH = 36;

export enum StatsType {
    INBOUND = "inbound-rtp",
    OUTBOUND = "outbound-rtp"
}
