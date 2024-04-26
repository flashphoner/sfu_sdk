import {v4 as uuidv4} from 'uuid';


export class BitrateTest {
    _stopped = false;
    _failed = false;
    _eventBus: BitrateComponentEventBus;
    _currentSender: PacedSender;
    _id: string;
    _listener: BitrateTestListener;

    constructor(eventBus: BitrateComponentEventBus) {
        this._eventBus = eventBus;
        this._id = uuidv4();
    }

    public async advisedBitrate(timeout: number, maxBitrate?: number): Promise<number> {
        try {
            await this._eventBus.startTest();
        } catch (e) {
            return 0;
        }
        const startTime = new Date().getTime();
        let currentTime = startTime;
        const self = this;
        const sender = new PacedSender(new class implements Sink {
            send(object: ArrayBuffer): boolean {
                return self._eventBus.send(object);
            }

            active(): boolean {
                return self._eventBus.active();
            }
        });
        let localMax = 10000;
        let localMin = 100;
        let latency = 1;
        let prevTime = startTime;
        let increase = 0;
        if (maxBitrate) {
            localMax = maxBitrate;
        }
        let sum = [];
        let lastValue = 0;

        let bitrate = 1000;

        sender.setTargetBitrate(bitrate);
        sender.start();
        while (!this._stopped && !this._failed && currentTime - startTime < timeout) {
            currentTime = new Date().getTime();
            let lastReceivedTime;
            try {
                lastReceivedTime = await this._eventBus.requestTestStatus();
            } catch (e) {
                this._failed = true;
                continue;
            }

            if (lastReceivedTime === 0) {
                continue;
            }
            const localTime = new Date().getTime();

            const localLatency = sender._lastSentTime - lastReceivedTime;
            const windowSize = sender._window.getWindowSize(localTime);
            sum.push(windowSize);
            let localSum = 0;
            for (let a = 0; a < sum.length; a++) {
                localSum += sum[a];
            }
            lastValue = Math.ceil(localSum / sum.length);

            this._listener.onStatusUpdate(lastValue);
            if (sum.length > 30) {
                sum.shift()
            }
            const latencyDelta = Math.min(300, localLatency - latency);


            if (localLatency > 300) {
                if (latencyDelta > 0) {
                    const speed = 1 - (latencyDelta) / (localTime - prevTime);
                    bitrate = bitrate * speed;
                } else {
                    bitrate = bitrate * 0.9;
                }
                increase = 0;
            } else if (localLatency < 100) {
                if (increase === 0) {
                    increase = bitrate * 0.1;
                } else {
                    increase *= 2;
                    sum = [];
                }
                bitrate = bitrate + increase;
            }
            bitrate = Math.min(localMax, bitrate);
            bitrate = Math.max(localMin, bitrate)
            sender.setTargetBitrate(bitrate);
            latency = localLatency;
            prevTime = currentTime;
            await new Promise(r => setTimeout(r, 300));
        }
        sender.stop();
        try {
            await this._eventBus.stopTest();
        } catch (ignored) {

        }
        return lastValue;
    }


    public setListener(listener: BitrateTestListener): void {
        this._listener = listener;
    }

    public interruptTest(): void {
        this._stopped = true;
        if (this._currentSender) {
            this._currentSender.stop();
        }
    }
}

export class PacedSender {
    _id: string;
    _sink: Sink;
    _ended = false;
    _window = new MovingWindow();
    _targetBitrate = 0;
    _lastSeq = 0;
    _defaultPacketSize = 20;
    _lastSentTime = 0;

    public constructor(sink: Sink) {
        this._sink = sink;
        this._id = uuidv4();
    }

    public async start(): Promise<void> {

        while (!this._ended && this._sink.active()) {
            const currentTime = new Date().getTime();
            const dynamicRate = this._window.getDynamicRate(this._defaultPacketSize, currentTime, this._targetBitrate);
            for (let i = 0; i < dynamicRate.count; i++) {
                const data = new Uint8Array(0.9 * (dynamicRate.size * 1024 / 8));
                let timestamp = currentTime;
                for (let j = 0; j < 8; j++) {
                    data[j] = timestamp % 256;
                    timestamp = Math.floor(timestamp / 256);
                }

                let seq = this._lastSeq++;
                for (let j = 8; j < 10; j++) {
                    data[j] = seq % 256;
                    seq = Math.floor(seq / 256);
                }
                if (this._sink.send(data)) {
                    this._window.processNext(dynamicRate.size, currentTime);
                    this._lastSentTime = currentTime;
                }
            }
            await new Promise(r => setTimeout(r, dynamicRate.sleep));
        }
    }

    public setTargetBitrate(rate: number) {
        this._targetBitrate = rate;
    }

    public stop() {
        this._ended = true;
    }
}

export interface Sink {
    send(object: ArrayBuffer): boolean;

    active(): boolean;
}

export interface BitrateComponentEventBus extends Sink {
    requestTestStatus(): Promise<number>;

    startTest(): Promise<void>;

    stopTest(): Promise<void>;
}

export interface BitrateTestController {
    test(timeout: number, maxBitrate?: number): Promise<number>;

    stop(): void;

    setListener(listener: BitrateTestListener);
}

export interface BitrateTestListener {
    onStatusUpdate(bitrate: number);
}

export type DynamicRate = {
    count: number,
    sleep: number,
    size: number
}

class MovingWindow {
    _window = new Array<{ timestamp: number, size: number }>();
    _cachedValue = 0;
    _timeCapacity = 1000;

    public processNext(size: number, timestamp: number): void {
        this._window.push({size: size, timestamp: timestamp});
        this._cachedValue += size;
    }

    public getDynamicRate(size: number, timestamp: number, targetBitrate: number): DynamicRate {
        const windowSize = this.getWindowSize(timestamp);
        if (targetBitrate - windowSize < size) {
            return {count: 0, sleep: 100, size: 0};
        }

        const targetSubwindow = targetBitrate - windowSize;
        const rate = (targetSubwindow / size);
        let sleepTime = 1;
        let count = 1
        let recommendedSize = size;
        if (rate > 20) {
            let time;
            if (this._window.length > 0) {
                time = this._timeCapacity - (this._window[this._window.length - 1].timestamp - this._window[0].timestamp);
            } else {
                time = this._timeCapacity;
            }
            sleepTime = 50;
            const timeWindow = (time / sleepTime);

            count = rate / timeWindow;
            count = Math.min(count, (targetBitrate / size) / (this._timeCapacity / sleepTime));
        } else if (rate <= 5) {
            recommendedSize = size / 4;
            sleepTime = 1000 / (rate * 4)
        } else {
            sleepTime = 1000 / rate
        }

        return {count: count, sleep: sleepTime, size: recommendedSize};
    }


    public getWindowSize(timestamp: number): number {
        if (!this._window[0]) {
            return 0;
        }
        let timeDelta = timestamp - this._window[0].timestamp;

        while (timeDelta > this._timeCapacity && this._window.length !== 0) {
            this._cachedValue -= this._window.shift().size;
            if (this._window[0]) {
                timeDelta = timestamp - this._window[0].timestamp;
            }
        }
        return this._cachedValue;
    }
}