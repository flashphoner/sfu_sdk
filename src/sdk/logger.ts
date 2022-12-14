export type PrefixFunction = () => string;

export enum Verbosity {
    ERROR,
    WARN,
    INFO,
    DEBUG,
    TRACE
}

class Logger {
    #prefix: PrefixFunction = () => "";
    #level: Verbosity = Verbosity.ERROR;

    setPrefix = (func:PrefixFunction) => {
        if (typeof func !== "function") {
            throw new Error("Prefix must be a function");
        }
        this.#prefix = func;
    };

    setVerbosity = (verbosityLevel: Verbosity) => {
        this.#level = verbosityLevel;
    }

    error = (...args) => {
        if (this.#level >= Verbosity.ERROR) {
            console.error(this.#prefix(), ...args);
        }
    };
    warn = (...args) => {
        if (this.#level >= Verbosity.WARN) {
            console.warn(this.#prefix(), ...args);
        }
    };
    info = (...args) => {
        if (this.#level >= Verbosity.INFO) {
            console.info(this.#prefix(), ...args);
        }
    };
    debug = (...args) => {
        if (this.#level >= Verbosity.DEBUG) {
            console.debug(this.#prefix(), ...args);
        }
    };
    trace = (...args) => {
        if (this.#level >= Verbosity.TRACE) {
            console.trace(this.#prefix(), ...args);
        }
    };
}

export default Logger;