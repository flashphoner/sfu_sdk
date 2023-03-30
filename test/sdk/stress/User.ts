import {SfuExtended} from "../../../src";
import {RoomExtended} from "../../../src/sdk/room-extended";
const wrtc = require("wrtc");
const RTCAudioSourceSineWave = require("../../lib/rtcaudiosourcesinewave");
import {url} from "../../util/constants";

export class User {
    readonly URL = url;
    #sfu: SfuExtended;
    #userConfig;
    #room: RoomExtended;
    #aSender: RTCRtpSender;
    #aTrack: MediaStreamTrack;
    #interval: NodeJS.Timer;

    constructor(userConfig: {
        username: string,
        password: string,
        nickname: string
    }) {
        this.#sfu = new SfuExtended();
        this.#userConfig = userConfig;
    }

    public async connect(): Promise<void> {
        await this.#sfu.connect({
            url: this.URL,
            ...this.#userConfig
        });
    }

    public async join(id: string): Promise<void> {
        const room = await this.#sfu.roomAvailable({id: id, pin: "p@ssw0rd"});
        this.#room = room;
        const pc = new wrtc.RTCPeerConnection();
        await room.join(pc);
    }

    public async joinWithAudio(id: string): Promise<void> {
        const room = await this.#sfu.roomAvailable({id: id, pin: "p@ssw0rd"});
        this.#room = room;
        const pc = new wrtc.RTCPeerConnection();
        const self = this;
        pc.onsignalingstatechange = (e) => {
            this.log("Signal state changed " + pc.signalingState);
        }
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        this.#aSender = pc.addTrack(aTrack);
        await room.join(pc);
    }

    public async addTrack() {
        const aSource = new RTCAudioSourceSineWave();
        const aTrack = aSource.createTrack();
        this.#aSender = this.#room.pc().addTransceiver(aTrack, {
            direction: "sendonly"
        }).sender;
        try {
            await this.#room.updateState({});
        } catch(e) {
            console.log("failed add track" + e);
            this.#room.pc().removeTrack(this.#aSender);
            this.#aSender = null;
            this.#aTrack = null;
        }
    }

    public removeTrack() {
        if (this.#aSender) {
            // this.#aTrack.stop();
            this.#room.pc().removeTrack(this.#aSender);
            this.#aSender = null;
            this.#aTrack = null;
            return this.#room.updateState({});
        }
    }

    public async leave(): Promise<void> {
        await this.#room.leaveRoom();
    }

    public async disconnect(): Promise<void> {
        stop();
        await this.#sfu.disconnect();
    }

    public start(): void {
        const i = this.getIntervalTime();
        this.#interval = setInterval(async () => {
            this.log("change track after " + i + " ms");
            try {
                if (this.#aSender) {
                    this.log("remove track");
                    await this.removeTrack();
                } else {
                    this.log("add track");
                    await this.addTrack();
                }
            } catch (e) {
                this.log("Failed to update state", e);
            }
        }, i);
    }

    public stop(): void {
        clearInterval(this.#interval);
    }

    private getIntervalTime(): number {
        return Math.floor(Math.random() * (6000 - 1000) + 1000);
    }

    private log(msg: string, ...msgs): void {
        console.log('[' + new Date().toUTCString() + '] ' + this.#userConfig.username + " | " + msg, msgs);
    }
}