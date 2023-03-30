import {v4 as uuidv4} from 'uuid';
import promises from "./promises";
import {Notifier} from "./notifier";
import {
    AddRemoveTracks,
    CreatedRoom,
    SfuEvent,
    FragmentedMessage,
    InternalApi,
    InternalMessage, JoinedRoom, LeftRoom, EvictedFromRoom,
    ParticipantRenamed,
    RoomMessage, OperationFailed,
    Operations,
    ParticipantRole,
    RemoteSdp,
    RemoteSdpType, RoleAssigned,
    RoomError,
    RoomEvent,
    RoomState, WaitingRoomUpdate, UserNickname, RemoteSdpInfo
} from "./constants";
import {Connection} from "./connection";
import Logger from "./logger";

export class Room {
    static readonly #CONTROL_CHANNEL = "control";

    #_state: RoomState = RoomState.NEW;
    #_role: ParticipantRole = ParticipantRole.PARTICIPANT;
    #inviteId: string;
    protected notifier: Notifier<RoomEvent, InternalMessage> = new Notifier<RoomEvent, InternalMessage>();
    protected connection: Connection;
    #_pc: RTCPeerConnection;
    _id: string;
    _name: string;
    _pin: string;
    _nickname: string;
    #incomingMessageQueue: {
        [key: string]: Array<FragmentedMessage>
    } = {};
    #dChannel: RTCDataChannel;
    #_creationTime: number;
    protected logger: Logger;
    _uid: string;
    _crutch: {
        settingRemoteOffer: boolean,
        settingRemoteAnswer: boolean,
        tid: string
    }

    public constructor(connection: Connection, name: string, pin: string, nickname: UserNickname, creationTime: number) {
        this.connection = connection;
        this._id = name;
        this._name = name;
        this._nickname = nickname;
        this._pin = pin;
        this._nickname = nickname;
        this.#_creationTime = creationTime;
        this.logger = new Logger();
        this._uid = uuidv4();
        this._crutch = {
            settingRemoteOffer: false,
            settingRemoteAnswer: false,
            tid: ""
        }
    }

    #dChannelSend(msg: string) {
        this.logger.info("dchannel ", "==>", msg);
        this.#dChannel.send(msg);
    };

    #applyContentTypeConfig(sdp: string, config: {
        [key: string]: string
    }) {
        let ret = "";
        for (const str of sdp.split("\n")) {
            if (str && str.length > 0) {
                ret += str + "\n";
                if (str.indexOf("a=msid:") > -1) {
                    const msid = str.substring(str.indexOf(" ") + 1).trim();
                    if (config[msid]) {
                        ret += InternalApi.TRACK_CONTENT_HEADER + config[msid] + "\r\n";
                    }
                }
            }
        }
        return ret;
    };

    async #setRemoteDescription(remoteSdp: RemoteSdpInfo) {
        try {
            await this.#_pc.setRemoteDescription(remoteSdp.info);
        } catch (e) {
            this.logger.warn(e);
            this.logger.debug("Was trying to set " + remoteSdp.info.sdp);
            this.logger.debug("Local sdp is " + this.#_pc.localDescription.sdp);
            throw e;
        }
    };

    //TODO refactor types
    public async processEvent(e: InternalMessage) {
        this.logger.info("<==", e);
        if (e.type === RoomEvent.REMOTE_SDP) {
            if (this.#_state !== RoomState.FAILED && this.#_state !== RoomState.DISPOSED && this.#_pc.signalingState !== "closed") {
                try {
                    const remoteSdp = e as RemoteSdp;
                    switch (remoteSdp.info.type) {
                        case RemoteSdpType.OFFER:
                            if (this._crutch.settingRemoteAnswer) {
                                this.logger.debug(new Error("Clashing with the answer!"));
                                function sleep(millis: number) {
                                    return new Promise(resolve => setTimeout(resolve, millis));
                                }
                                while (this._crutch.settingRemoteAnswer) {
                                    await sleep(100);
                                    this.logger.debug("Waiting for answer " + this._crutch.settingRemoteAnswer);
                                }
                            }
                            this._crutch.tid = remoteSdp.info.tid;
                            this.logger.debug("setTid " + this._crutch.tid);
                            this._crutch.settingRemoteOffer = true;
                            if (this.#_pc.signalingState === "have-local-offer") {
                                await this.#setRemoteDescription({
                                    info: {
                                        sdp: "",
                                        type: RemoteSdpType.ROLLBACK,
                                        tid: ""
                                    }
                                });
                            }
                            await this.#setRemoteDescription(remoteSdp);
                            const answer = await this.#_pc.createAnswer();
                            answer.sdp = answer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                            await this.#_pc.setLocalDescription(answer);
                            if (this.#_pc.connectionState !== "closed") {
                                this.connection.send(InternalApi.UPDATE_ROOM_STATE, {
                                    id: this._id,
                                    pin: this._pin,
                                    sdp: this.#_pc.localDescription.sdp,
                                    tid: this._crutch.tid,
                                    sdpType:RemoteSdpType.ANSWER
                                });
                            }
                            this._crutch.settingRemoteOffer = false;
                            break;
                        case RemoteSdpType.ANSWER:
                            this._crutch.settingRemoteAnswer = true;
                            await this.#setRemoteDescription(remoteSdp);
                            this._crutch.settingRemoteAnswer = false;
                            break;
                    }
                } catch (error) {
                    this.logger.error("Failed to process remote sdp", error);
                }
            }
        } else if (e.type === RoomEvent.ROLE_ASSIGNED) {
            const roleAssigned = e as RoleAssigned;
            if (this._nickname === roleAssigned.name) {
                this.#_role = roleAssigned.role;
            }
            this.notifier.notify(RoomEvent.ROLE_ASSIGNED, roleAssigned);
        } else if (e.type === RoomEvent.CREATED) {
            const createdRoom = e as CreatedRoom;
            this.#inviteId = createdRoom.inviteId;
            if (!promises.resolve(createdRoom.internalMessageId, e)) {
                this.notifier.notify(RoomEvent.CREATED, createdRoom);
            }
        } else if (e.type === RoomEvent.OPERATION_FAILED) {
            const operationFailed = e as OperationFailed;
            if (promises.promised(operationFailed.internalMessageId)) {
                promises.reject(operationFailed.internalMessageId, operationFailed);
            } else if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.ROOM_DESTROYED){
                this.notifier.notify(RoomEvent.ENDED);
            } else if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.AUTHORIZATION_FAILED) {
                const evictedEvent: EvictedFromRoom = {
                    ...operationFailed,
                    name: this._nickname
                }
                this.notifier.notify(RoomEvent.EVICTED, evictedEvent);
            } else if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.CANCEL_JOIN_ROOM) {
                const leftRoomEvent: LeftRoom = {
                    ...operationFailed,
                    name: this._nickname
                }
                this.notifier.notify(RoomEvent.LEFT, leftRoomEvent);
            } else {
                this.notifier.notify(RoomEvent.OPERATION_FAILED, operationFailed);
            }
        } else if (e.type === RoomEvent.JOINED) {
            const joinedRoom = e as JoinedRoom;
            if (!promises.resolve(joinedRoom.internalMessageId, joinedRoom)) {
                this.notifier.notify(RoomEvent.JOINED, joinedRoom);
            }
        } else if (e.type === RoomEvent.LEFT) {
            const leftRoom = e as LeftRoom;
            promises.resolve(leftRoom.internalMessageId, leftRoom);
            this.notifier.notify(RoomEvent.LEFT, leftRoom);
        } else if (e.type === RoomEvent.PARTICIPANT_RENAMED) {
            const participantRenamed = e as ParticipantRenamed;
            if (this._nickname === participantRenamed.previousName) {
                this._nickname = participantRenamed.updatedName;
            }
            if (!promises.promised(participantRenamed.internalMessageId)) {
                this.notifier.notify(RoomEvent.PARTICIPANT_RENAMED, participantRenamed);
            }
        } else if (e.type === RoomEvent.ADD_TRACKS) {
            const addTracks = e as AddRemoveTracks;
            if (!promises.resolve(addTracks.internalMessageId, addTracks)) {
                this.notifier.notify(RoomEvent.ADD_TRACKS, addTracks);
            }
        } else if (e.type === RoomEvent.REMOVE_TRACKS) {
            const removeTracks = e as AddRemoveTracks;
            if (!promises.resolve(removeTracks.internalMessageId, removeTracks)) {
                this.notifier.notify(RoomEvent.REMOVE_TRACKS, removeTracks);
            }
        } else if (e.type === RoomEvent.WAITING_ROOM_UPDATE) {
            const waitingRoomUpdate = e as WaitingRoomUpdate;
            if (promises.promised(e.internalMessageId)) {
                promises.resolve(e.internalMessageId, waitingRoomUpdate.enabled);
            } else {
                this.notifier.notify(RoomEvent.WAITING_ROOM_UPDATE, waitingRoomUpdate);
            }
        } else if (e.type === SfuEvent.ACK && promises.promised(e.internalMessageId)) {
            promises.resolve(e.internalMessageId);
        } else {
            //check this is a room event
            if (Object.values(RoomEvent).includes(e.type as RoomEvent)) {
                this.notifier.notify(e.type as RoomEvent, e);
            }
        }
    }

    //TODO(naz): safe guard based on state
    public join(pc: RTCPeerConnection, nickname?: UserNickname,  config?: {
        [key: string]: string
    }) {
        const self = this;
        this.#_pc = pc;
        this.#_pc.addEventListener("signalingstatechange", () => {
            this.logger.debug("Connection " + self._uid + " " + self.#_pc.signalingState);
        })
        if (nickname) {
            this._nickname = nickname;
        }
        this.#dChannel = this.#_pc.createDataChannel(Room.#CONTROL_CHANNEL);
        this.#dChannel.onmessage = (msg) => {
            this.logger.info("dchannel ", "<==", msg);
            const message: InternalMessage = JSON.parse(msg.data);
            if (message.type === RoomEvent.MESSAGE) {
                const msg = message as RoomMessage;
                if (msg.message.message.indexOf("\"payload\":") !== -1) {
                    try {
                        let innerMessage: FragmentedMessage = JSON.parse(msg.message.message);
                        if (!self.#incomingMessageQueue[innerMessage.id]) {
                            self.#incomingMessageQueue[innerMessage.id] = [];
                        }
                        self.#incomingMessageQueue[innerMessage.id].push(innerMessage);
                        if (innerMessage.last) {
                            let wholeMessage = "";
                            for (let i = 0; i < self.#incomingMessageQueue[innerMessage.id].length; i++) {
                                wholeMessage += self.#incomingMessageQueue[innerMessage.id][i].payload;
                            }
                            delete self.#incomingMessageQueue[innerMessage.id];
                            msg.message.message = wholeMessage;
                            self.notifier.notify(message.type, msg);
                        }
                    } catch (e) {
                        this.logger.info("Failed to process inner message: " + msg.message);
                        self.notifier.notify(message.type, msg);
                    }
                }
            } else if (message.type === SfuEvent.ACK && promises.promised(message.internalMessageId)) {
                promises.resolve(message.internalMessageId);
            } else {
                if (Object.values(RoomEvent).includes(message.type as RoomEvent)) {
                    self.notifier.notify(message.type as RoomEvent, message);
                }
            }
        }
        return new Promise<JoinedRoom>(async (resolve, reject) => {
            if (self.#_state === RoomState.NEW) {
                self.#_state = RoomState.JOINED;
                try {
                    const offer = await self.#_pc.createOffer();
                    if (config) {
                        offer.sdp = self.#applyContentTypeConfig(offer.sdp, config);
                    }
                    offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                    await self.#_pc.setLocalDescription(offer);
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    self.connection.send(InternalApi.JOIN_ROOM, {
                        id: self._id,
                        pin: self._pin,
                        sdp: offer.sdp,
                        nickname: nickname,
                        internalMessageId: id,
                        sdpType:RemoteSdpType.OFFER
                    });
                } catch (e) {
                    reject(e);
                }
            } else {
                reject("Can't joined room with state " + this.#_state);
            }
        });
    };

    public updateState(config?: {
        [key: string]: string
    }) {
        const self = this;
        return new Promise<void>(async (resolve, reject) => {
            if (self.#_pc.signalingState !== "stable") {
                reject("Peer connection signaling state is " + self.#_pc.signalingState + ". Can't update room while negotiation is in progress");
                return;
            }
            try {
                const offer = await self.#_pc.createOffer();
                if (self._crutch.settingRemoteOffer) {
                    reject("Setting remote offer");
                    return;
                }
                offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                await self.#_pc.setLocalDescription(offer);
                if (config) {
                    offer.sdp = self.#applyContentTypeConfig(offer.sdp, config);
                }
                const id = uuidv4();
                promises.add(id, resolve, reject);
                self.connection.send(InternalApi.UPDATE_ROOM_STATE, {
                    id: self._id,
                    pin: self._pin,
                    sdp: offer.sdp,
                    internalMessageId: id,
                    sdpType:RemoteSdpType.OFFER,
                    tid:this._crutch.tid
                });
            } catch(e) {
                reject(e);
            }
        });
    };

    public destroyRoom() {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            self.#_state = RoomState.DISPOSED;
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.DESTROY_ROOM, {
                id: self._id,
                pin: self._pin,
                internalMessageId: id
            });
        });
    };

    public leaveRoom() {
        const self = this;
        return new Promise<LeftRoom>((resolve, reject) => {
            self.#_state = RoomState.DISPOSED;
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.LEAVE_ROOM, {
                id: self._id,
                pin: self._pin,
                internalMessageId: id
            });
            if (self.#_pc) {
                self.#_pc.close();
                // zapp-28, react-native-webrtc fire 'connectionstatechange' byself
                if (typeof document !== 'undefined') {
                    self.#_pc.dispatchEvent(new Event("connectionstatechange"));
                }
            }
        });
    };

    public evictParticipant(nickname: UserNickname) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.EVICT_PARTICIPANT, {
                id: self._id,
                nickname: nickname,
                internalMessageId: id
            });
        })
    }

    public renameParticipant(nickname: UserNickname, newNickname: UserNickname) {
        const self = this;
        return new Promise<void>(((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.RENAME_PARTICIPANT, {
                roomId: self._id,
                nickname: nickname,
                newNickname: newNickname,
                internalMessageId: id
            });
        }));
    }

    public sendMessage(msg: string) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            /**
             * Note self in case of chunked message promise will be resolved only after sending last message (last: true)
             */
            promises.add(id, resolve, reject);
            const chunkSize = 16384;
            if (msg.length > chunkSize) {
                const chunks = msg.match(new RegExp("(.|[\r\n]){1,"+chunkSize+"}", "g"));
                for (let i = 0; i < chunks.length; i++) {
                    self.#dChannelSend(JSON.stringify({
                        id: id,
                        last: i === chunks.length - 1,
                        payload: chunks[i]
                    }));
                }
            } else {
                self.#dChannelSend(JSON.stringify({
                    id: id,
                    payload: msg
                }));
            }
        });
    };

    public changeQuality(trackId: string, quality: string, tid: number) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.CHANGE_QUALITY, {
                roomId: self._id,
                id: trackId,
                quality: quality,
                tid: tid,
                internalMessageId: id
            });
        });
    };

    public muteTrack(trackId: string, mute: boolean) {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.MUTE_TRACK, {
                roomId: self._id,
                id: trackId,
                mute: mute
            });
        });
    };

    public on(event: RoomEvent, callback: (arg0: InternalMessage) => void): Room {
        this.notifier.add(event, callback);
        return this;
    };

    public off(event: RoomEvent, callback: (arg0: InternalMessage) => void): Room {
        this.notifier.remove(event, callback);
        return this;
    };

    public id() {
        return this._id;
    }

    public name() {
        return this._name;
    }

    public pin() {
        return this._pin;
    }

    public nickname() {
        return this._nickname;
    }

    public pc() {
        return this.#_pc;
    }

    public role() {
        return this.#_role;
    }

    public invite() {
        return this.#inviteId;
    }

    public state() {
        return this.#_state;
    }

    public creationTime() {
        return this.#_creationTime;
    }

}
