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
    #_logger: any = console;

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
            this.#_logger.error(this.#prefix(), ...args);
        }
    };
    warn = (...args) => {
        if (this.#level >= Verbosity.WARN) {
            this.#_logger.warn(this.#prefix(), ...args);
        }
    };
    info = (...args) => {
        if (this.#level >= Verbosity.INFO) {
            this.#_logger.info(this.#prefix(), ...args);
        }
    };
    debug = (...args) => {
        if (this.#level >= Verbosity.DEBUG) {
            this.#_logger.debug(this.#prefix(), ...args);
        }
    };
    trace = (...args) => {
        if (this.#level >= Verbosity.TRACE) {
            this.#_logger.trace(this.#prefix(), ...args);
        }
    };

    getLogger(): any {
        return this.#_logger;
    }

    setLogger(value: any) {
        this.#_logger = value;
    }
}

export default Logger;
