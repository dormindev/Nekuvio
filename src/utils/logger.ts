const levels = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof levels)[number];

function isLogLevel(value: string | undefined): value is LogLevel {
    return value !== undefined && levels.includes(value as LogLevel);
}

const configuredLevel = process.env.LOG_LEVEL;

const minLevel: LogLevel = isLogLevel(configuredLevel)
    ? configuredLevel
    : "info";

function shouldLog(level: LogLevel): boolean {
    return levels.indexOf(level) >= levels.indexOf(minLevel);
}

export const logger = {
    debug(...args: unknown[]) {
        if (shouldLog("debug")) {
            console.debug("[DEBUG]", ...args);
        }
    },

    info(...args: unknown[]) {
        if (shouldLog("info")) {
            console.info("[INFO]", ...args);
        }
    },

    warn(...args: unknown[]) {
        if (shouldLog("warn")) {
            console.warn("[WARN]", ...args);
        }
    },

    error(...args: unknown[]) {
        if (shouldLog("error")) {
            console.error("[ERROR]", ...args);
        }
    },
};
