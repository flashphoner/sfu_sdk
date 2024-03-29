import {v4 as uuidv4} from 'uuid';
import {Room} from "./room";
import {Connection} from "./connection";
import promises from "./promises";
import {
    AddRemoveTracks, BooleanEvent,
    CreatedRoom,
    InternalApi, InternalMessage, ParticipantAVSMutedEvent, ParticipantConfigEvent,
    ParticipantRole, RoomEvent, RoomExtendedConfig, RoomConfigEvent,
    UserId,
    UserNickname,
    WaitingRoomUpdate,
    StopScreenSharingEvent,
    RoomScreenSharingConfigEvent,
    StopTrackEvent
} from "./constants";
import {PrefixFunction} from "./logger";

export class RoomExtended extends Room {

    #config: RoomExtendedConfig;
    #owner: string;
    #waitingRoomEnabled: boolean;
    public constructor(connection: Connection, id: string, owner: string, name: string, pin: string, userId: UserId, nickname: UserNickname, creationTime: number, config: RoomExtendedConfig, waitingRoomEnabled: boolean, loggerPrefix?: PrefixFunction) {
       super(connection, name, pin, nickname, creationTime, userId);
       this._id = id;
       this.#owner = owner;
       if (!config.participantsConfig) {
           config.participantsConfig = {};
       }
       this.#config = config;
       this.#waitingRoomEnabled = waitingRoomEnabled;
       if (loggerPrefix) {
           this.logger.setPrefix(() => {
               return "[Room] " + loggerPrefix();
           })
       } else {
           this.logger.setPrefix(() => "[Room]");
       }
    }

    public config() {
        return this.#config;
    }

    public waitingRoomEnabled() {
        return this.#waitingRoomEnabled;
    }

    public createRoom() {
        const self = this;
        return new Promise<CreatedRoom>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.CREATE_ROOM, {
                name: self._name,
                pin: self._pin,
                internalMessageId: id
            });
        });
    };

    public sendControlMessage(msg: string, broadcast: boolean, to?: UserId) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.SEND_CONTROL_MESSAGE, {
                roomId: self._id,
                broadcast: broadcast,
                from: "",
                to: to,
                body: msg,
                internalMessageId: id
            });
        });
    };

    public authorizeWaitingList(userId: UserId, authorized: boolean) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.AUTHORIZE_WAITING_LIST, {
                id: self._id,
                userId: userId,
                authorized: authorized,
                internalMessageId: id
            });
        });
    };

    public moveToWaitingRoom(userId: UserId) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.MOVE_TO_WAITING_ROOM, {
                roomId: self._id,
                userId: userId,
                internalMessageId: id
            });
        });
    };

    public configureWaitingRoom(enabled: boolean) {
        const self = this;
        return new Promise<WaitingRoomUpdate>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.CONFIGURE_WAITING_ROOM, {
                id: self._id,
                enabled: enabled,
                internalMessageId: id
            });
        });
    };

    public assignRole(userId: UserId, role: ParticipantRole) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.ASSIGN_ROLE, {
                roomId: self._id,
                userId: userId,
                role: role,
                internalMessageId: id
            });
        });
    };

    public reclaimOwnerRights() {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.RECLAIM_OWNER_RIGHTS, {
                roomId: self._id,
                internalMessageId: id
            });
        });
    };

    public subscribeToWaitingParticipant(userId: UserId) {
        const self = this;
        return new Promise<AddRemoveTracks>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.SUBSCRIBE_TO_WAITING_PARTICIPANT, {
                roomId: self._id,
                userId: userId,
                internalMessageId: id
            });
        });
    };

    public unsubscribeFromWaitingParticipant(userId: UserId) {
        const self = this;
        return new Promise<AddRemoveTracks>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.UNSUBSCRIBE_FROM_WAITING_PARTICIPANT, {
                roomId: self._id,
                userId: userId,
                internalMessageId: id
            });
        });
    };

    public setLock(locked: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_LOCK, {id: self._id, value: locked}, resolve, reject);
        });
    };

    public setInitialAudioMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_INITIAL_AUDIO_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setInitialVideoMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_INITIAL_VIDEO_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setInitialScreenSharingMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_INITIAL_SCREEN_SHARING_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setAudioMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_AUDIO_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setVideoMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_VIDEO_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setScreenSharingMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_SCREEN_SHARING_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setChatMuted(muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_CHAT_MUTED, {id: self._id, value: muted}, resolve, reject);
        });
    };

    public setCanChangeNickname(canChange: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_CAN_CHANGE_NICKNAME, {id: self._id, value: canChange}, resolve, reject);
        });
    };

    public setScreenSharingMultipleShares(multipleShares: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_SCREEN_SHARING_MULTIPLE_SHARES, {id: self._id, value: multipleShares}, resolve, reject);
        });
    };

    public setScreenSharingEveryoneCanShare(everyoneCanShare: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE, {id: self._id, value: everyoneCanShare}, resolve, reject);
        });
    };

    public setScreenSharingEveryoneCanDoSubsequentShare(canDoSubsequentShare: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE, {id: self._id, value: canDoSubsequentShare}, resolve, reject);
        });
    };

    public setParticipantAudioMuted(userId: UserId, muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_PARTICIPANT_AUDIO_MUTED, {id: self._id, value: muted, userId: userId}, resolve, reject);
        });
    };

    public setParticipantVideoMuted(userId: UserId, muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_PARTICIPANT_VIDEO_MUTED, {id: self._id, value: muted, userId: userId}, resolve, reject);
        });
    };

    public setParticipantScreenSharingMuted(userId: UserId, muted: boolean) {
        const self = this;
        return new Promise<boolean>((resolve, reject) => {
            self.#emmitAction(InternalApi.SET_PARTICIPANT_SCREEN_SHARING_MUTED, {id: self._id, value: muted, userId: userId}, resolve, reject);
        });
    };

    public turnOffParticipantScreenSharing(userId?: UserId, reason?: string) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            self.#emmitAction(InternalApi.TURN_OFF_PARTICIPANT_SCREEN_SHARING, {id: self._id, userId: userId, reason: reason}, resolve, reject);
        });
    }

    public async processEvent(e: InternalMessage) {
        if (e.type === RoomEvent.ROOM_CONFIG) {
            const roomConfigEvent = (e as RoomConfigEvent);
            this.#config.locked = roomConfigEvent.config.locked;
            this.#config.initialAudioMuted = roomConfigEvent.config.initialAudioMuted;
            this.#config.initialVideoMuted = roomConfigEvent.config.initialVideoMuted;
            this.#config.initialScreenSharingMuted = roomConfigEvent.config.initialScreenSharingMuted;
            this.#config.audioMuted = roomConfigEvent.config.audioMuted;
            this.#config.videoMuted = roomConfigEvent.config.videoMuted;
            this.#config.screenSharingMuted = roomConfigEvent.config.screenSharingMuted;
            this.#config.chatMuted = roomConfigEvent.config.chatMuted;
            this.#config.canChangeNickname = roomConfigEvent.config.canChangeNickname;
            this.#config.screenSharingConfig = roomConfigEvent.config.screenSharingConfig;
            this.#resolveOrNotify(e, e.type, roomConfigEvent);
        } else if (e.type === RoomEvent.ROOM_LOCKED) {
            const value = (e as BooleanEvent).value;
            this.#config.locked = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_INITIAL_AUDIO_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.initialAudioMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_INITIAL_VIDEO_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.initialVideoMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_INITIAL_SCREEN_SHARING_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.initialScreenSharingMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_AUDIO_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.audioMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_VIDEO_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.videoMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_SCREEN_SHARING_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.screenSharingMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.STOP_SCREEN_SHARING) {
            const event = e as StopScreenSharingEvent;
            this.#resolveOrNotify(e, e.type, event);
        } else if (e.type === RoomEvent.ROOM_CHAT_MUTED) {
            const value = (e as BooleanEvent).value;
            this.#config.chatMuted = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_CAN_CHANGE_NICKNAME) {
            const value = (e as BooleanEvent).value;
            this.#config.canChangeNickname = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_SCREEN_SHARING_MULTIPLE_SHARES) {
            const value = (e as BooleanEvent).value;
            this.#config.screenSharingConfig.multipleShares = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_SCREEN_SHARING_EVERYONE_CAN_SHARE) {
            const value = (e as BooleanEvent).value;
            this.#config.screenSharingConfig.everyoneCanShare = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.ROOM_SCREEN_SHARING_EVERYONE_CAN_DO_SUBSEQUENT_SHARE) {
            const value = (e as BooleanEvent).value;
            this.#config.screenSharingConfig.everyoneCanDoSubsequentShare = value;
            this.#resolveOrNotify(e, e.type, value);
        } else if (e.type === RoomEvent.PARTICIPANT_CONFIG) {
            const pConfig = e as ParticipantConfigEvent;
            this.#config.participantsConfig[pConfig.userId] = pConfig.config;
            this.#resolveOrNotify(e, e.type, e);
        } else if (e.type === RoomEvent.SCREEN_SHARING_CONFIG) {
            const screenSharingConfigEvent = e as RoomScreenSharingConfigEvent;
            this.#config.screenSharingConfig.multipleShares = screenSharingConfigEvent.config.multipleShares;
            this.#config.screenSharingConfig.everyoneCanShare = screenSharingConfigEvent.config.everyoneCanShare;
            this.#config.screenSharingConfig.everyoneCanDoSubsequentShare = screenSharingConfigEvent.config.everyoneCanDoSubsequentShare;
            this.#resolveOrNotify(e, e.type, screenSharingConfigEvent);
        } else if (e.type === RoomEvent.PARTICIPANT_AUDIO_MUTED) {
            const mutedEvent = e as ParticipantAVSMutedEvent;
            this.#config.participantsConfig[mutedEvent.userId].audioMuted = mutedEvent.value;
            this.#resolveOrNotify(e, e.type, mutedEvent.value);
        } else if (e.type === RoomEvent.PARTICIPANT_VIDEO_MUTED) {
            const mutedEvent = e as ParticipantAVSMutedEvent;
            this.#config.participantsConfig[mutedEvent.userId].videoMuted = mutedEvent.value;
            this.#resolveOrNotify(e, e.type, mutedEvent.value);
        } else if (e.type === RoomEvent.PARTICIPANT_SCREEN_SHARING_MUTED) {
            const mutedEvent = e as ParticipantAVSMutedEvent;
            this.#config.participantsConfig[mutedEvent.userId].screenSharingMuted = mutedEvent.value;
            this.#resolveOrNotify(e, e.type, mutedEvent.value);
        } else if (e.type === RoomEvent.STOP_TRACK) {
            const event = e as StopTrackEvent;
            this.#resolveOrNotify(e, e.type, event);
        } else if (e.type === RoomEvent.WAITING_ROOM_UPDATE) {
            const waitingRoomUpdate = e as WaitingRoomUpdate;
            this.#waitingRoomEnabled = waitingRoomUpdate.enabled;
            if (promises.promised(e.internalMessageId)) {
                promises.resolve(e.internalMessageId, waitingRoomUpdate);
            } else {
                this.notifier.notify(RoomEvent.WAITING_ROOM_UPDATE, waitingRoomUpdate);
            }
        } else {
            super.processEvent(e);
        }
    }

    public owner() {
        return this.#owner;
    }

    #resolveOrNotify(e: InternalMessage, type: RoomEvent, value: boolean | {}) {
        if (!promises.resolve(e.internalMessageId, value)) {
            this.notifier.notify(type, e);
        }
    }

    #emmitAction(action: InternalApi, data: object, resolve: Function, reject: Function) {
        const id = uuidv4();
        promises.add(id, resolve, reject);
        this.connection.send(action, {
            ...data,
            internalMessageId: id
        });
    }
}
