import {Connection} from "./connection";
import {
    InternalApi,
    InternalMessage,
    RoomState,
    SfuEvent,
    State,
    UserNickname
} from "./constants";
import {Notifier} from "./notifier";
import {Room} from "./room";
import Logger, {PrefixFunction, Verbosity} from "./logger";

export class Sfu {
    #connection: Connection;
    #url: string;
    #_nickname: UserNickname;
    #_state: State = State.NEW;
    #_room: Room;
    //TODO(naz): Provide union instead of InternalMessage
    #notifier: Notifier<SfuEvent, InternalMessage> = new Notifier<SfuEvent, InternalMessage>();
    #logger: Logger = new Logger();
    #loggerPrefix: PrefixFunction;

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
        timeout?: number,
        failedProbesThreshold?: number,
        pingInterval?: number,
        nickname: UserNickname,
        logGroup: string
    }) {
        if (!options) {
            throw new TypeError("No options provided");
        }
        this.#url = options.url;
        this.#_nickname = options.nickname;
        const connectionConfig = {
            url: options.url,
            appName: InternalApi.P_APP,
            timeout: options.timeout,
            failedProbesThreshold: options.failedProbesThreshold,
            pingInterval: options.pingInterval,
            custom: {
                nickname: options.nickname,
                //TODO(naz): rename to logGroup
                roomName: options.logGroup
            }
        };
        const self = this;
        return new Promise<void>(async (resolve, reject) => {
            self.#connection = new Connection(
                (name, data) =>  {
                    this.#logger.debug("onMessage: ", data[0]);
                    switch (name) {
                        case InternalApi.DEFAULT_METHOD:
                            if (data[0].roomId && data[0].roomId.length > 0) {
                                //room event
                                if (this.#_room) {
                                    this.#_room.processEvent(data[0]);
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
                () => {
                    // Supported only in sfu-extended
                },
                (e) => {
                    self.#_state = State.FAILED;
                    self.#notifier.notify(SfuEvent.FAILED, e as InternalMessage);
                    reject(e);
                },
                () => {
                    self.#_state = State.DISCONNECTED;
                    self.#notifier.notify(SfuEvent.DISCONNECTED);
                },
                this.#logger
            );
            try {
                await this.#connection.connect(connectionConfig);
                self.#_state = State.CONNECTED;
                this.#notifier.notify(SfuEvent.CONNECTED);
                resolve();
            } catch(e) {
                self.#_state = State.FAILED;
                this.#notifier.notify(SfuEvent.FAILED, e);
                reject(e);
            }
        });
    };

    public createRoom(options: {
        name: string,
        pin: string
    }) {
        if (this.#_room) {
            switch (this.#_room.state()) {
                case RoomState.NEW:
                case RoomState.JOINED:
                case RoomState.PENDING:
                    throw new Error("Only one room at a time, already have one with state " + this.#_room.state());
                case RoomState.FAILED:
                case RoomState.DISPOSED:
                    this.#_room = new Room(this.#connection, options.name, options.pin, this.#_nickname, Date.now());
                    break;
                default:
                    throw new Error("Unknown room state " + this.#_room.state());
            }
        } else {
            this.#_room = new Room(this.#connection, options.name, options.pin, this.#_nickname, Date.now());
        }
        return this.#_room;
    }

    public disconnect() {
        if (this.#_room) {
            this.#_room.leaveRoom();
        }
        if (this.#connection) {
            this.#connection.close();
        }
    }
    
    public room() {
        return this.#_room;
    }
    
    public nickname() {
        return this.#_nickname;
    }

    public state() {
        return this.#_state;
    }

    public on(event: SfuEvent, callback: (arg0: InternalMessage) => void): Sfu {
        this.#notifier.add(event, callback);
        return this;
    };

    public off(event: SfuEvent, callback: (arg0: InternalMessage) => void): Sfu {
        this.#notifier.remove(event, callback);
        return this;
    };

}