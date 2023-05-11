import Logger from "./logger";
import {StatsType} from "./constants"

type CodecDescription = {
    name: string;
    sampleRate: string;
}

type TrackStats = {
    track: MediaStreamTrack;
    type: StatsType;
    bytesCount: number;
    seconds: number;
}

type TrackStatsMap = {
    [index: string]: TrackStats;
}

export class WebRTCStats {
    protected pc: RTCPeerConnection;
    protected logger: Logger;
    protected tracks: TrackStatsMap;

    public constructor(pc: RTCPeerConnection) {
        this.pc = pc;
        this.logger = new Logger();
        this.tracks = {};
    }

    #fillStatObject(id: string, report: any): any {
        let statObject = {};
        let codec = this.#getCurrentCodecAndSampleRate(report.mediaType);
        let bitrate = this.#getBitrate(id, report);

        statObject["codec"] = codec.name;
        statObject["sampleRate"] = codec.sampleRate;
        if (bitrate > -1) {
            statObject["bitrate"] = bitrate;
        }
        Object.keys(report).forEach((key) => {
            statObject[key] = report[key];
        });

        return statObject;
    }

    #getCurrentSDP(): string {
        let description = this.pc.currentRemoteDescription != undefined ? this.pc.currentRemoteDescription : this.pc.remoteDescription;
        let sdp = "";

        if (description && description.sdp) {
            sdp = description.sdp;
        }
        return sdp;
    }

    #getCurrentCodecAndSampleRate(mediaType: string): CodecDescription {
        let sdp = this.#getCurrentSDP();
        let rows = sdp.split("\n");
        let codecPt: string;
        let result: CodecDescription = {name: "undefined", sampleRate: "undefined"};
        for (let i = 0; i < rows.length ; i++) {
            if (codecPt && rows[i].indexOf("a=rtpmap:" + codecPt) != -1) {
                result.name = rows[i].split(" ")[1].split("/")[0];
                result.sampleRate = rows[i].split(" ")[1].split("/")[1];
                return result;
            }
            if (rows[i].indexOf("m=" + mediaType) != -1) {
                codecPt = rows[i].split(" ")[3].trim();
            }
        }
        return result;
    }

    #getBytesCount(type: StatsType, report: any): number {
        let bytesCount = 0;

        if (type == StatsType.INBOUND) {
            bytesCount = report["bytesReceived"];
        } else if (type == StatsType.OUTBOUND) {
            bytesCount = report["bytesSent"];
        }

        return bytesCount;
    }

    #getBitrate(id: string, report: any): number {
        let bitrate = -1;

        if (this.tracks[id]) {
            let currentBytesCount = this.#getBytesCount(this.tracks[id].type, report);
            let currentSeconds = Math.round(new Date().getTime() / 1000);
            let timePassed = currentSeconds - this.tracks[id].seconds;
            if (timePassed > 0) {
                bitrate = ((currentBytesCount - this.tracks[id].bytesCount) * 8) / timePassed;
            }
            this.tracks[id].bytesCount = currentBytesCount;
            this.tracks[id].seconds = currentSeconds;
        }

        return bitrate;
    }

    public async getStats(track: MediaStreamTrack, type: StatsType, callback: Function): Promise<void> {
        let statsObject = {};

        if (!track) {
            throw new Error("Can't get statistics for track " + track);
        }

        if (!this.tracks[track.id]) {
            this.tracks[track.id] = {track: track, type: type, bytesCount: 0, seconds: Math.round(new Date().getTime() / 1000)};
        }

        let stat = await this.pc.getStats(track);
        if (stat) {
            stat.forEach((report) => {
                if (!report.isRemote) {
                    if (report.type == type) {
                        statsObject = this.#fillStatObject(track.id, report);
                    }
                }
            });
        }
        callback(statsObject);
    }
}