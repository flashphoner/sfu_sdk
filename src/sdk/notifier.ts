export type NotifierHandler<T> = (arg0?: T) => void;

export class Notifier<T extends string, A extends object> {

    #subscribers: {[key in T]?: Array<NotifierHandler<A>>} = {};

    public add(event: T, handler: NotifierHandler<A>) {
        if (!event) {
            throw new TypeError("Event can't be null");
        }
        if (!handler || typeof handler !== "function") {
            throw new Error("Callback needs to be a valid function");
        }
        if (!this.#subscribers[event]) {
            this.#subscribers[event] = [];
        }
        this.#subscribers[event].push(handler);
    }

    public remove(event: T, handler: NotifierHandler<A>) {
        if (!event) {
            throw new TypeError("Event can't be null");
        }
        if (!handler || typeof handler !== "function") {
            throw new Error("Callback needs to be a valid function");
        }
        if (!this.#subscribers[event]) {
            this.#subscribers[event] = [];
        }
        let index = this.#subscribers[event].findIndex(element => element === handler);
        if (index !== -1) {
            this.#subscribers[event].splice(index, 1);
        }
    }

    public notify(event: T, msg?: A) {
        if (this.#subscribers[event]) {
            for (const subscriber of this.#subscribers[event]) {
                subscriber(msg);
            }
        }
    };

    public clear() {
        this.#subscribers = {};
    }

}