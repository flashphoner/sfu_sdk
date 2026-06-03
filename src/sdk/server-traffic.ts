import {ServerTrafficData, ServerTrafficUpdate} from "./constants";
import Logger from "./logger";

export class ServerTrafficMonitor {
    protected logger: Logger;
    #listeners: Array<(traffic: ServerTrafficData) => void> = [];
    #lastTraffic: ServerTrafficData | null = null;

    public constructor(logger?: Logger) {
        this.logger = logger || new Logger();
    }

    public addListener(listener: (traffic: ServerTrafficData) => void): void {
        this.#listeners.push(listener);
        if (this.#lastTraffic) {
            listener(this.#lastTraffic);
        }
    }

    public removeListener(listener: (traffic: ServerTrafficData) => void): void {
        const index = this.#listeners.indexOf(listener);
        if (index > -1) {
            this.#listeners.splice(index, 1);
        }
    }

    public handleUpdate(update: ServerTrafficUpdate | ServerTrafficData): void {
        try {
            const trafficData = this.#extractTrafficData(update);
            if (!trafficData) {
                return;
            }
            this.#lastTraffic = trafficData;
            this.#listeners.forEach(listener => listener(trafficData));
        } catch (error) {
            this.logger.error('Failed to handle server TRAFFIC_UPDATE:', error);
        }
    }

    public lastTraffic(): ServerTrafficData | null {
        return this.#lastTraffic;
    }

    #extractTrafficData(update: ServerTrafficUpdate | ServerTrafficData): ServerTrafficData | undefined {
        const event = update as ServerTrafficUpdate;
        if (event.data && Array.isArray(event.data) && event.data.length > 0) {
            return this.#normalizeTrafficData(event.data[0]);
        }
        const traffic = update as ServerTrafficData;
        if (traffic.badges) {
            return this.#normalizeTrafficData(traffic);
        }
        return undefined;
    }

    #normalizeTrafficData(traffic: ServerTrafficData): ServerTrafficData | undefined {
        if (!traffic || !traffic.badges) {
            return undefined;
        }

        const badges = traffic.badges;
        return {
            inboundBitrate: this.#normalizeNumber(traffic.inboundBitrate),
            outboundBitrate: this.#normalizeNumber(traffic.outboundBitrate),
            ping: this.#normalizeNumber(traffic.ping),
            badges: {
                participants: Array.isArray(badges.participants) ? badges.participants : [],
                links: Array.isArray(badges.links) ? badges.links : []
            }
        };
    }

    #normalizeNumber(value: number): number {
        return typeof value === "number" && !Number.isNaN(value) && value >= 0 ? value : 0;
    }
}
