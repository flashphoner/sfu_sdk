
export enum Verbosity {
    ERROR,
    WARN,
    INFO,
    DEBUG,
    TRACE
}

type PrefixFunction = () => string;
let prefix:PrefixFunction = () => "";
let level = Verbosity.ERROR;

const setPrefix = (func:PrefixFunction) => {
    if (typeof func !== "function") {
        throw new Error("Prefix must be a function");
    }
    prefix = func;
};

const setVerbosity = (verbosityLevel: Verbosity) => {
    level = verbosityLevel;
}

const error = (...args) => {
    if (level >= Verbosity.ERROR) {
        console.error(prefix(), ...args);
    }
};
const warn = (...args) => {
    if (level >= Verbosity.WARN) {
        console.warn(prefix(), ...args);
    }
};
const info = (...args) => {
    if (level >= Verbosity.INFO) {
        console.info(prefix(), ...args);
    }
};
const debug = (...args) => {
    if (level >= Verbosity.DEBUG) {
        console.debug(prefix(), ...args);
    }
};
const trace = (...args) => {
    if (level >= Verbosity.TRACE) {
        console.trace(prefix(), ...args);
    }
};



export default {
    setPrefix,
    setVerbosity,
    error,
    warn,
    info,
    debug,
    trace
}
