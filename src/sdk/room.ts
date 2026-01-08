import {v4 as uuidv4} from 'uuid';
import promises from "./promises";
import {Notifier} from "./notifier";
import {
    AddRemoveTracks,
    BitrateTestStatus,
    CreatedRoom,
    EvictedFromRoom,
    ForcefullyLeftEvent,
    FragmentedMessage,
    InternalApi,
    InternalMessage,
    JoinedRoom,
    LeftRoom,
    OperationFailed,
    Operations,
    ParticipantRenamed,
    ParticipantRole,
    RemoteSdp,
    RemoteSdpInfo,
    RemoteSdpType,
    RoleAssigned,
    RoomError,
    RoomEvent,
    RoomMessage,
    RoomState,
    RTCMetricsDescriptionUpdate,
    RTCMetricsTokenRefresh,
    SfuEvent,
    StatsType,
    TracksQualityState,
    TrackType,
    TransportType,
    UserId,
    UserNickname,
    WaitingRoomUpdate,
} from "./constants";
import {Connection} from "./connection";
import {WebRTCStats} from "./webrtc-stats";
import Logger from "./logger";
import {Queue} from 'queue-typescript';
import {BitrateComponentEventBus, BitrateTest, BitrateTestController, BitrateTestListener} from "./BitrateTest";
import {Mutex} from "async-mutex";
import {
    InactiveInboundTrackRTCStatsReportFilter,
    InactiveOutboundTrackRTCStatsReportFilter,
    RTCMetricsCollector,
    RTCMetricsCollectorBuilder,
    RTCMetricsCollectType,
    RTCMetricsHttpSender,
    RTCMetricsServerDescription
} from '@flashphoner/web-sdk-metrics';


export class Room {
    static readonly #CONTROL_CHANNEL = "control";
    static readonly #BITRATE_CHANNEL = "bitrate";

    _webRTCMetricsServerDescription: RTCMetricsServerDescription;
    _mediaSessionId: string;
    #_statCollector: RTCMetricsCollector;
    #_httpStatSender: RTCMetricsHttpSender | null;
    #_state: RoomState = RoomState.NEW;
    #_role: ParticipantRole = ParticipantRole.PARTICIPANT;
    #inviteId: string;
    protected notifier: Notifier<RoomEvent, InternalMessage> = new Notifier<RoomEvent, InternalMessage>();
    protected connection: Connection;
    #_pc: RTCPeerConnection;
    _id: string;
    _name: string;
    _userId: string;
    _pin: string;
    _nickname: string;
    #incomingMessageQueue: {
        [key: string]: Array<FragmentedMessage>
    } = {};
    #dChannel: RTCDataChannel;
    #wrappedDataChannel: WrappedDatachannel;
    #_creationTime: number;
    protected logger: Logger;
    _uid: string;
    _crutch: {
        mutex: Mutex,
        tid: string
    };
    protected stats: WebRTCStats;
    #vacantTransceivers: { video: Queue<RTCRtpTransceiver>, audio: Queue<RTCRtpTransceiver> };


    public constructor(connection: Connection, name: string, pin: string, nickname: UserNickname, creationTime: number, userId?: UserId, webRTCMetricsServerDescription?: RTCMetricsServerDescription) {
        this.connection = connection;
        this._webRTCMetricsServerDescription = webRTCMetricsServerDescription;
        this._id = name;
        this._name = name;
        this._nickname = nickname;
        this._pin = pin;
        this._userId = userId;
        this.#_creationTime = creationTime;
        this.logger = new Logger();
        this._uid = uuidv4();
        // defines usage of the pc as a critical section, must be replaced
        this._crutch = {
            mutex: new Mutex(),
            tid: ""
        }
        this.#vacantTransceivers = {audio: new Queue<RTCRtpTransceiver>(), video: new Queue<RTCRtpTransceiver>()};
    }

    #dChannelSend(msg: string): void {
        this.logger.info("dchannel ", "==>", msg);
        this.#dChannel.send(msg);
    };

    #applyContentTypeConfig(sdp: string, config: {
        [key: string]: string
    }): string {
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

    async #setRemoteDescription(remoteSdp: RemoteSdpInfo): Promise<void> {
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
    public async processEvent(e: InternalMessage): Promise<void> {
        this.logger.info("<==", e);
        if (e.type === RoomEvent.REMOTE_SDP) {
            if (this.#_state !== RoomState.FAILED && this.#_state !== RoomState.DISPOSED && this.#_pc.signalingState !== "closed") {
                const remoteSdp = e as RemoteSdp;
                const self = this;
                switch (remoteSdp.info.type) {
                    case RemoteSdpType.OFFER:
                        this._crutch.mutex.runExclusive(async () => {
                            self.logger.debug("Setting remote offer, tid " + remoteSdp.info.tid);
                            try {
                                if (!self._crutch.tid || self._crutch.tid != remoteSdp.info.tid) {
                                    self.logger.debug("Tid mismatch, rollback. Remote tid " + remoteSdp.info.tid + ", local tid " + self._crutch.tid);
                                }

                                let reOfferNeeded = false;
                                if (self.#_pc.signalingState === "have-local-offer") {
                                    self.logger.debug("Rollback, tid " + remoteSdp.info.tid);
                                    reOfferNeeded = true;
                                    await self.#setRemoteDescription({
                                        info: {
                                            sdp: "",
                                            type: RemoteSdpType.ROLLBACK,
                                            tid: ""
                                        }
                                    });
                                }
                                await self.#setRemoteDescription(remoteSdp);
                                const answer = await self.#_pc.createAnswer();
                                answer.sdp = answer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                                if (self.#_pc.connectionState !== "closed") {
                                    await self.#_pc.setLocalDescription(answer);
                                    const tid = self._crutch.tid;
                                    self.logger.debug("Sent answer, remote tid " + remoteSdp.info.tid + ", local tid " + tid);
                                    self.connection.send(InternalApi.UPDATE_ROOM_STATE, {
                                        id: self._id,
                                        pin: self._pin,
                                        sdp: self.#_pc.localDescription.sdp,
                                        tid: tid,
                                        sdpType: RemoteSdpType.ANSWER
                                    });
                                }
                                if (reOfferNeeded) {
                                    self.logger.debug("Setting local reoffer, tid " + remoteSdp.info.tid);
                                    const offer = await self.#_pc.createOffer();
                                    offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                                    if (self.#_pc.connectionState !== "closed") {
                                        await self.#_pc.setLocalDescription(offer);
                                        const tid = self._crutch.tid;
                                        self.logger.debug("Sent reoffer,  remote tid " + remoteSdp.info.tid + ", local tid " + tid);
                                        self.connection.send(InternalApi.UPDATE_ROOM_STATE, {
                                            id: self._id,
                                            pin: self._pin,
                                            sdp: offer.sdp,
                                            internalMessageId: "",
                                            sdpType: RemoteSdpType.OFFER,
                                            tid: tid
                                        });
                                    }
                                }
                            } catch (error) {
                                self.logger.error("Failed to process remote sdp, type " + remoteSdp.info.type + ", tid " + remoteSdp.info.tid, error);
                            }
                            self.logger.debug("Ended setting remote offer with tid " + remoteSdp.info.tid);
                        });
                        break;
                    case RemoteSdpType.ANSWER:
                        this._crutch.mutex.runExclusive(async () => {
                            self.logger.debug("Setting remote answer, tid " + remoteSdp.info.tid);
                            try {
                                if (self.#_pc.signalingState !== "have-local-offer") {
                                    self.logger.debug("Reject remote answer, bad state");
                                    return
                                }
                                if (!self._crutch.tid || self._crutch.tid != remoteSdp.info.tid) {
                                    self.logger.debug("Reject remote answer,bad tid " + remoteSdp.info.tid);
                                    return;
                                }
                                self.logger.debug("Apply remote answer with tid " + remoteSdp.info.tid + ", local tid " + self._crutch.tid);
                                await self.#setRemoteDescription(remoteSdp);
                            } catch (error) {
                                self.logger.error("Failed to process remote sdp, type " + remoteSdp.info.type + ", tid " + remoteSdp.info.tid, error);
                            }
                            self.logger.debug("Ended setting answer with tid " + remoteSdp.info.tid);
                        });
                        break;
                }
            }
        } else if (e.type === RoomEvent.ROLE_ASSIGNED) {
            const roleAssigned = e as RoleAssigned;
            if (this._userId === roleAssigned.userId) {
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
                if (operationFailed.operation === Operations.ROOM_JOIN) {
                    this.#_state = RoomState.DISPOSED;
                    this.#wrappedDataChannel.close();
                }
                promises.reject(operationFailed.internalMessageId, operationFailed);
            }
            if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.ROOM_DESTROYED) {
                this.notifier.notify(RoomEvent.ENDED);
            } else if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.AUTHORIZATION_FAILED) {
                const evictedEvent: EvictedFromRoom = {
                    ...operationFailed,
                    userId: this._userId,
                    name: this._nickname
                }
                this.notifier.notify(RoomEvent.EVICTED, evictedEvent);
            } else if (operationFailed.operation === Operations.ROOM_JOIN && operationFailed.error === RoomError.CANCEL_JOIN_ROOM) {
                const leftRoomEvent: LeftRoom = {
                    ...operationFailed,
                    userId: this._userId,
                    name: this._nickname
                }
                this.notifier.notify(RoomEvent.LEFT, leftRoomEvent);
            } else {
                this.notifier.notify(RoomEvent.OPERATION_FAILED, operationFailed);
            }
        } else if (e.type === RoomEvent.JOINED) {
            const joinedRoom = e as JoinedRoom;
            this.#_state = RoomState.JOINED;
            if (promises.promised(joinedRoom.internalMessageId)) {
                this._userId = joinedRoom.userId;
                this._mediaSessionId = joinedRoom.mediaSessionId;

                if (this._webRTCMetricsServerDescription && !this.#_statCollector) {
                    const builder: RTCMetricsCollectorBuilder = new RTCMetricsCollectorBuilder()
                        .id(this._mediaSessionId)
                        .logger(this.logger)
                        .peerConnection(this.#_pc)
                        .websocketSender(this.connection)
                        .description(this._webRTCMetricsServerDescription)
                        .addFilter(new InactiveInboundTrackRTCStatsReportFilter())
                        .addFilter(new InactiveOutboundTrackRTCStatsReportFilter())
                    if (this._webRTCMetricsServerDescription.ingestPoint != null &&
                        this._webRTCMetricsServerDescription.ingestPoint.startsWith("http")) {
                        this.#_httpStatSender = new RTCMetricsHttpSender(this._webRTCMetricsServerDescription.ingestPoint, {
                            Authorization: this._webRTCMetricsServerDescription.authorization
                        });
                        builder.httpSender(this.#_httpStatSender);
                    }
                    this.#_statCollector = builder.build();
                    this.#_statCollector.start();
                }
                promises.resolve(joinedRoom.internalMessageId, joinedRoom);
            } else {
                this.notifier.notify(RoomEvent.JOINED, joinedRoom);
            }
        } else if (e.type === RoomEvent.LEFT) {
            const leftRoom = e as LeftRoom;
            promises.resolve(leftRoom.internalMessageId, leftRoom);
            this.notifier.notify(RoomEvent.LEFT, leftRoom);
        } else if (e.type === RoomEvent.FORCEFULLY_LEFT) {
            const forcefullyLeft = e as ForcefullyLeftEvent;
            this.notifier.notify(RoomEvent.FORCEFULLY_LEFT, forcefullyLeft);
        } else if (e.type === RoomEvent.PARTICIPANT_RENAMED) {
            const participantRenamed = e as ParticipantRenamed;
            if (this._userId === participantRenamed.userId) {
                this._nickname = participantRenamed.updatedName;
            }
            if (!promises.resolve(participantRenamed.internalMessageId, participantRenamed)) {
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
        } else if (e.type === RoomEvent.TRACK_QUALITY_STATE) {
            const state = e as TracksQualityState;
            this.notifier.notify(RoomEvent.TRACK_QUALITY_STATE, state);
        } else if (e.type === RoomEvent.WAITING_ROOM_UPDATE) {
            const waitingRoomUpdate = e as WaitingRoomUpdate;
            if (promises.promised(e.internalMessageId)) {
                promises.resolve(e.internalMessageId, waitingRoomUpdate);
            } else {
                this.notifier.notify(RoomEvent.WAITING_ROOM_UPDATE, waitingRoomUpdate);
            }
        } else if (e.type === SfuEvent.ACK && promises.promised(e.internalMessageId)) {
            promises.resolve(e.internalMessageId);
        } else if (e.type === RoomEvent.BITRATE_TEST_STATUS) {
            const bitrateTest = e as BitrateTestStatus;
            if (promises.promised(e.internalMessageId)) {
                promises.resolve(e.internalMessageId, bitrateTest.latency);
            }
        } else if (e.type == RoomEvent.WEBRTC_METRICS_DESCRIPTION_UPDATE) {
            if (this.#_statCollector == null) {
                return;
            }
            const updateDescription = e as RTCMetricsDescriptionUpdate;
            if (updateDescription.collect === RTCMetricsCollectType.on) {
                this.#_statCollector.collect(true);
            } else {
                this.#_statCollector.collect(false);
            }
            this.notifier.notify(RoomEvent.WEBRTC_METRICS_DESCRIPTION_UPDATE, updateDescription);
        } else if (e.type == RoomEvent.WEBRTC_METRICS_TOKEN_REFRESH) {
            const tokenRefresh = e as RTCMetricsTokenRefresh;
            if (this.#_httpStatSender != null) {
                this.#_httpStatSender.headers = {
                    ...this.#_httpStatSender.headers,
                    Authorization: tokenRefresh.authorization,
                }
            }
        } else {
            //check this is a room event
            if (Object.values(RoomEvent).includes(e.type as RoomEvent)) {
                this.notifier.notify(e.type as RoomEvent, e);
            }
        }
    }

    //TODO(naz): safe guard based on state
    /**
     * Join the room
     *
     * @param pc - peer connection
     * @param nickname - user nickname
     * @param config - [track.id] : track content type
     * @param predefinedTracksCount - Initial number of allocated transceivers.
     * @param transportType - Ice transport protocol. "UDP"/"TCP".
     */
    public join(pc: RTCPeerConnection, nickname?: UserNickname, config?: {
        [key: string]: string
    }, predefinedTracksCount?: number, transportType?: TransportType): Promise<JoinedRoom> {
        const self = this;
        this.#_pc = pc;
        this.#_pc.addEventListener("signalingstatechange", () => {
            this.logger.debug("Connection " + self._uid + " " + self.#_pc.signalingState);
        })
        if (nickname) {
            this._nickname = nickname;
        }
        if (predefinedTracksCount > 0) {
            for (let i = 0; i < predefinedTracksCount; i++) {
                let transceiver = pc.addTransceiver("video", {direction: "recvonly"});
                this.#vacantTransceivers.video.enqueue(transceiver);
            }
        }
        this.#dChannel = this.#_pc.createDataChannel(Room.#CONTROL_CHANNEL);
        const Channel = this.#_pc.createDataChannel(Room.#BITRATE_CHANNEL);

        this.#wrappedDataChannel = new WrappedDatachannel(Channel);
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
            } else if (promises.promised(message.internalMessageId)) {
                if (message.type === SfuEvent.ACK) {
                    promises.resolve(message.internalMessageId);
                } else if (message.type === SfuEvent.FAILED) {
                    const failedEvent = message as OperationFailed;
                    promises.reject(message.internalMessageId, failedEvent.error);
                }
            } else {
                if (Object.values(RoomEvent).includes(message.type as RoomEvent)) {
                    self.notifier.notify(message.type as RoomEvent, message);
                }
            }
        }
        this.stats = new WebRTCStats(this.#_pc);
        return new Promise<JoinedRoom>(async (resolve, reject) => {
            if (self.#_state === RoomState.NEW) {
                try {
                    const offer = await self.#_pc.createOffer();
                    if (config) {
                        offer.sdp = self.#applyContentTypeConfig(offer.sdp, config);
                    }
                    offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                    await self.#_pc.setLocalDescription(offer);
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    self._crutch.tid = uuidv4();
                    self.connection.send(InternalApi.JOIN_ROOM, {
                        id: self._id,
                        pin: self._pin,
                        sdp: offer.sdp,
                        nickname: nickname,
                        internalMessageId: id,
                        sdpType: RemoteSdpType.OFFER,
                        tid: self._crutch.tid,
                        transport: transportType
                    });
                } catch (e) {
                    reject(e);
                }
            } else {
                reject("Can't joined room with state " + this.#_state);
            }
        });
    };

    /**
     * Used for SDP exchange
     */
    public updateState(config?: {
        [key: string]: string
    }): Promise<void> {
        const self = this;
        return new Promise<void>(async (resolve, reject) => {
            self._crutch.mutex.runExclusive(async () => {
                try {
                    this.logger.debug("updateState " + this._nickname);
                    if (self.#_pc.signalingState === "closed") {
                        throw new Error("Bad state");
                    }

                    const offer = await self.#_pc.createOffer();
                    if (config) {
                        offer.sdp = self.#applyContentTypeConfig(offer.sdp, config);
                    }
                    offer.sdp = offer.sdp.replace(/a=sendrecv/g, "a=sendonly");
                    await self.#_pc.setLocalDescription(offer);
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    const localTid = uuidv4();
                    self._crutch.tid = localTid;
                    self.logger.debug("Created tid " + localTid);

                    self.connection.send(InternalApi.UPDATE_ROOM_STATE, {
                        id: self._id,
                        pin: self._pin,
                        sdp: offer.sdp,
                        internalMessageId: id,
                        sdpType: RemoteSdpType.OFFER,
                        tid: localTid
                    });
                    self.logger.debug("Sent local offer with tid " + localTid);
                } catch (e) {
                    self.logger.error("Reject update state " + e);
                    reject(e);
                }
            });
        });
    };

    /**
     * Destroy room
     *
     * Participants will receive {@link RoomEvent.ENDED}.
     * {@link state} will be {@link RoomState.DISPOSED}
     */
    public destroyRoom(): Promise<void> {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            self.#_state = RoomState.DISPOSED;
            if (self.#wrappedDataChannel) {
                self.#wrappedDataChannel.close();
            }
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.DESTROY_ROOM, {
                id: self._id,
                pin: self._pin,
                internalMessageId: id
            });
        });
    };

    public getBitrateTest(): BitrateTestController {
        const self = this;
        if (this.#_state !== RoomState.JOINED) {
            throw new Error("Room must be in joined state");
        }
        const bitrateTest = new BitrateTest(new class implements BitrateComponentEventBus {
            active(): boolean {
                return self.#_state === RoomState.JOINED && self.#_pc.connectionState === "connected";
            }

            requestTestStatus(): Promise<number> {
                if (self.#_state !== RoomState.JOINED) {
                    throw new Error("Room must be in joined state");
                }
                return new Promise((resolve, reject) => {
                    const messageId = uuidv4();
                    promises.add(messageId, resolve, reject);
                    self.connection.send(InternalApi.GET_TEST_LATENCY, {
                        roomId: self._id,
                        internalMessageId: messageId
                    });
                });
            }

            send(object: ArrayBuffer): boolean {
                return self.#wrappedDataChannel.send(object);
            }

            startTest(): Promise<void> {
                if (self.#_state !== RoomState.JOINED) {
                    throw new Error("Room must be in joined state");
                }
                return new Promise((resolve, reject) => {
                    const messageId = uuidv4();
                    promises.add(messageId, resolve, reject);
                    self.connection.send(InternalApi.START_BITRATE_TEST, {
                        roomId: self._id,
                        internalMessageId: messageId
                    });
                });
            }

            stopTest(): Promise<void> {
                if (self.#_state !== RoomState.JOINED) {
                    throw new Error("Room must be in joined state");
                }
                return new Promise((resolve, reject) => {
                    if (self.#wrappedDataChannel._closed) {
                        resolve();
                        return;
                    }
                    const messageId = uuidv4();
                    promises.add(messageId, resolve, reject);
                    self.connection.send(InternalApi.END_BITRATE_TEST, {
                        roomId: self._id,
                        internalMessageId: messageId
                    });
                });
            }
        })
        return new class implements BitrateTestController {

            test(timeout: number, maxBitrate?: number): Promise<number> {
                return bitrateTest.advisedBitrate(timeout);
            }

            stop(): void {
                bitrateTest.interruptTest();
            }

            setListener(listener: BitrateTestListener) {
                bitrateTest.setListener(listener);
            }
        }
    }

    /**
     * Leave room
     *
     * Participants will receive {@link RoomEvent.LEFT} with {@link LeftRoom}.
     * {@link state} will be {@link RoomState.DISPOSED}
     */
    public leaveRoom(): Promise<LeftRoom> {
        const self = this;
        return new Promise<LeftRoom>((resolve, reject) => {
            self.#_state = RoomState.DISPOSED;
            if (self.#wrappedDataChannel) {
                self.#wrappedDataChannel.close();
            }

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

    /**
     * Evict participant
     *
     * Participants will receive {@link RoomEvent.EVICTED} with {@link EvictedFromRoom}.
     */
    public evictParticipant(userId: UserId): Promise<void> {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.EVICT_PARTICIPANT, {
                id: self._id,
                userId: userId,
                internalMessageId: id
            });
        })
    }

    /**
     * Rename participant
     *
     * Participants will receive {@link RoomEvent.PARTICIPANT_RENAMED} with {@link ParticipantRenamed}.
     */
    public renameParticipant(userId: UserId, newNickname: UserNickname): Promise<ParticipantRenamed> {
        const self = this;
        return new Promise<ParticipantRenamed>(((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.RENAME_PARTICIPANT, {
                roomId: self._id,
                userId: userId,
                newNickname: newNickname,
                internalMessageId: id
            });
        }));
    }

    public sendMessage(msg: string): Promise<void> {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            /**
             * Note self in case of chunked message promise will be resolved only after sending last message (last: true)
             */
            promises.add(id, resolve, reject);
            const chunkSize = 16384;
            if (msg.length > chunkSize) {
                const chunks = msg.match(new RegExp("(.|[\r\n]){1," + chunkSize + "}", "g"));
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

    /**
     * Change the quality of the requested track
     */
    public changeQuality(trackId: string, quality: string, tid: number): Promise<void> {
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

    /**
     * Mute track
     *
     * Participants will receive {@link RoomEvent.MUTE_TRACKS} with {@link AddRemoveTracks}
     */
    public muteTrack(trackId: string, mute: boolean): Promise<void> {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.MUTE_TRACK, {
                roomId: self._id,
                id: trackId,
                mute: mute,
                internalMessageId: id
            });
        });
    };

    private muteRemoteTrack(mid: string, mute: boolean): Promise<void> {
        const self = this;
        return new Promise<void>((resolve, reject) => {
            const id = uuidv4();
            promises.add(id, resolve, reject);
            self.connection.send(InternalApi.MUTE_REMOTE_TRACK, {
                roomId: self._id,
                id: mid,
                mute: mute,
                internalMessageId: id
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

    public id(): string {
        return this._id;
    }

    protected updateName(name: string): void {
        this._name = name;
    }

    public name(): string {
        return this._name;
    }

    public userId(): string {
        return this._userId;
    }

    public pin(): string {
        return this._pin;
    }

    public nickname(): string {
        return this._nickname;
    }

    public pc(): RTCPeerConnection {
        return this.#_pc;
    }

    public role(): ParticipantRole {
        return this.#_role;
    }

    public invite(): string {
        return this.#inviteId;
    }

    public state(): RoomState {
        return this.#_state;
    }

    public creationTime(): number {
        return this.#_creationTime;
    }

    public getStats(track: MediaStreamTrack, type: StatsType, callback: Function): void {
        this.stats.getStats(track, type, callback);
    }

    public async getRemoteTrack(kind: TrackType, force: boolean): Promise<RemoteTrack | undefined> {
        let transceiver = this.#vacantTransceivers[kind.toLowerCase()].dequeue();
        if (!transceiver) {
            if (force) {
                transceiver = this.pc().addTransceiver(kind.toLowerCase(), {direction: "recvonly"});
                await this.updateState();
            } else {
                return undefined;
            }
        }
        const room = this;
        return {
            track: transceiver.receiver.track,
            preferredQuality: undefined,
            tid: undefined,
            sid: undefined,
            disposed: false,
            demandTrack(remoteTrackId?: string): Promise<void> {
                if (this.disposed && !!remoteTrackId) {
                    return new Promise<void>(((resolve, reject) => reject(new Error(RoomError.TRACK_ALREADY_DISPOSED))));
                }
                const self = this;
                return new Promise<void>((resolve, reject) => {
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    room.connection.send(InternalApi.LEASE_TRACK, {
                        roomId: room._id,
                        remoteTrackId: remoteTrackId,
                        localMid: transceiver.mid,
                        internalMessageId: id
                    });
                }).catch(function (error) {
                    // If the track was deleted before the promise was resolved, need to release the transceiver
                    if (!self.disposed) {
                        self.disposed = true;
                        if (transceiver.receiver && transceiver.receiver.track) {
                            room.#vacantTransceivers[transceiver.receiver.track.kind].enqueue(transceiver);
                        }
                    }
                    throw error;
                });
            }, mute(): Promise<void> {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject(new Error(RoomError.TRACK_ALREADY_DISPOSED))));
                }
                return room.muteRemoteTrack(transceiver.mid, true).then(() => {
                    transceiver.receiver.track.enabled = false
                });
            }, unmute(): Promise<void> {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject(new Error(RoomError.TRACK_ALREADY_DISPOSED))));
                }
                transceiver.receiver.track.enabled = true;
                return room.muteRemoteTrack(transceiver.mid, false);
            }, setPreferredQuality(quality?: string): Promise<void> {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject()));
                }
                const self = this;
                return new Promise<void>((resolve, reject) => {
                    if (quality !== undefined) {
                        self.preferredQuality = quality;
                    }
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    room.connection.send(InternalApi.CHANGE_QUALITY, {
                        roomId: room._id,
                        id: transceiver.mid,
                        quality: self.preferredQuality,
                        internalMessageId: id
                    });
                });
            }, setSid(sid: number): Promise<void> {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject()));
                }
                this.sid = sid;
                const self = this;
                return new Promise<void>((resolve, reject) => {
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    room.connection.send(InternalApi.CHANGE_SID, {
                        roomId: room._id,
                        id: transceiver.mid,
                        sid: self.sid,
                        internalMessageId: id
                    });
                });
            }, setTid(tid: number): Promise<void> {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject()));
                }
                this.tid = tid;
                const self = this;
                return new Promise<void>((resolve, reject) => {
                    const id = uuidv4();
                    promises.add(id, resolve, reject);
                    room.connection.send(InternalApi.CHANGE_TID, {
                        roomId: room._id,
                        id: transceiver.mid,
                        tid: self.tid,
                        internalMessageId: id
                    });
                });
            }, async dispose() {
                if (this.disposed) {
                    return new Promise<void>(((resolve, reject) => reject(new Error(RoomError.TRACK_ALREADY_DISPOSED))));
                }
                this.disposed = true;
                try {
                    await this.demandTrack(null);
                } catch (e) {

                } finally {
                    if (transceiver.receiver && transceiver.receiver.track) {
                        room.#vacantTransceivers[transceiver.receiver.track.kind].enqueue(transceiver);
                    }
                }
            }
        };
    }
}

class WrappedDatachannel {
    _queue = new Queue<string | ArrayBuffer>();
    _highWatermark = 262144 * 2;
    _lowWatermark = 262144;
    _dc: RTCDataChannel;
    _closed = false;

    constructor(dataChannel: RTCDataChannel) {
        this._dc = dataChannel;
        this._dc.bufferedAmountLowThreshold = this._lowWatermark;
        const self = this;
        this._dc.onbufferedamountlow = function () {
            self.sendFirst();
        }
    }

    public send(data: string | ArrayBuffer): boolean {
        if (this._closed) {
            return false;
        }
        if (this._dc.bufferedAmount > this._highWatermark) {
            return false;
        } else {
            if (typeof data === "string") {
                this._dc.send(data);
            } else if (data instanceof Uint8Array) {
                this._dc.send(data);
            }
        }
        return true;
    }

    public close(): void {
        this._closed = true;
    }

    private sendFirst(): void {
        if (this._queue.length > 0) {
            const data = this._queue.dequeue()
            this.send(data);
        }
    }
}

export interface RemoteTrack {
    readonly track: MediaStreamTrack;
    readonly preferredQuality?: string;
    readonly tid?: number;
    readonly sid?: number
    readonly disposed: boolean;

    demandTrack(remoteMid?: string): Promise<void>;

    mute(): Promise<void>;

    unmute(): Promise<void>;

    setPreferredQuality(quality?: string): Promise<void>;

    setSid(sid: number): Promise<void>;

    setTid(tid: number): Promise<void>;

    dispose(): Promise<void>;
}
