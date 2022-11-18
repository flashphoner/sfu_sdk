type CachedPromise = {
    resolve: Function,
    reject: Function
}
type PromisesMap = {
    [index: string] : CachedPromise
}

const promises: PromisesMap = {};

export function add(id: string, resolve: Function, reject: Function): void {
    if (promises[id]) {
        throw new Error("Already have promise with id " + id);
    }
    promises[id] = {resolve, reject};
}

export function resolve(id: string, args?: any): boolean {
    const promise = getAndRemovePromise(id);
    if (!promise) {
        return false;
    }
    promise.resolve(args);
    return true;
}

export function reject(id: string, args?: any): boolean {
    const promise = getAndRemovePromise(id);
    if (!promise) {
        return false;
    }
    promise.reject(args);
    return true;
}

function promised(id: string): boolean {
    return promises[id] !== undefined;
}

function getAndRemovePromise(id: string) : CachedPromise  {
    const promise = promises[id];
    if (!promise) {
        return;
    }
    delete promises[id];
    return promise;
}

export default {
    add,
    resolve,
    reject,
    promised
}