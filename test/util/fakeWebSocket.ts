export class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static readonly created: FakeWebSocket[] = [];

    static last(): FakeWebSocket {
        return FakeWebSocket.created[FakeWebSocket.created.length - 1];
    }

    static install(): () => void {
        const native = window.WebSocket;
        FakeWebSocket.created.length = 0;
        (window as any).WebSocket = FakeWebSocket;
        return () => {
            window.WebSocket = native;
        };
    }

    readyState = 0;
    binaryType = "blob";
    readonly sent: string[] = [];
    onopen: (event: object) => void = null;
    onclose: (event: object) => void = null;
    onerror: (event: object) => void = null;
    onmessage: (event: object) => void = null;

    constructor(readonly url: string) {
        FakeWebSocket.created.push(this);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close() {
        if (this.readyState >= 2) {
            return;
        }
        const established = this.readyState === 1;
        this.readyState = 2;
        Promise.resolve().then(() => established ? this.drop({code: 1000, reason: ""}) : this.fail());
    }

    open() {
        this.readyState = 1;
        this.onopen?.({});
    }

    receive(message: string, ...data: unknown[]) {
        this.onmessage?.({data: JSON.stringify({message, data})});
    }

    receiveBinary(data: ArrayBuffer) {
        this.onmessage?.({data});
    }

    fail(error: object = {type: "error"}, closed: object = {code: 1006, reason: ""}) {
        this.onerror?.(error);
        this.drop(closed);
    }

    drop(closed: object = {code: 1006, reason: ""}) {
        this.readyState = 3;
        this.onclose?.(closed);
    }

    sentMessages(): Array<{message: string, data: unknown[]}> {
        return this.sent.map((raw) => JSON.parse(raw));
    }
}

export const outcomeOf = <T>(promise: Promise<T>) => {
    const outcome: {state: "pending" | "resolved" | "rejected", value?: T, reason?: unknown} = {state: "pending"};
    promise.then(
        (value) => Object.assign(outcome, {state: "resolved", value}),
        (reason) => Object.assign(outcome, {state: "rejected", reason})
    );
    return outcome;
};

export const flushPromises = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
};
