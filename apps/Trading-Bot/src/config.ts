import {parseList} from "./utils/helpers";

function validateEnvironmentVariables(): void {
    const requiredVariables = [
        "APCA_API_KEY",
        "APCA_SECRET_KEY",
        "DB_SERVICE_URL",
    ];

    const missingVariables = requiredVariables.filter((environmentKey) => !process.env[environmentKey]);

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingVariables.join(", ")}\n` +
            "Please copy .env.example to .env and fill in the values.",
        );
    }
}

export const alpacaConfig = {
    apiKey: process.env["APCA_API_KEY"]!,
    secretKey: process.env["APCA_SECRET_KEY"]!,
    paper: process.env["APCA_PAPER"] === "true",
    baseUrl: process.env["APCA_API_BASE_URL"] || "https://paper-api.alpaca.markets",
};

export const dbConfig = {
    serviceUrl: process.env["DB_SERVICE_URL"]!,
};

export const strategyConfig = {
    fastMAPeriod: parseInt(process.env["FAST_MA_PERIOD"] || "10", 10),
    slowMAPeriod: parseInt(process.env["SLOW_MA_PERIOD"] || "50", 10),
    timeframe: process.env["TIMEFRAME"] || "1d",
    symbols: parseList(process.env["SYMBOLS"] || "AAPL,SPY"),
    useEMA: process.env["USE_EMA"] === "true",
    minSignalStrength: parseFloat(process.env["MIN_SIGNAL_STRENGTH"] || "0.5"),
};

export const tradingConfig = {
    positionSizePercent: parseInt(process.env["POSITION_SIZE_PERCENT"] || "10", 10),
    maxPositions: parseInt(process.env["MAX_POSITIONS"] || "5", 10),
    accountId: process.env["ACCOUNT_ID"] || "default",
    dryRun: process.env["DRY_RUN"] === "true",
};

export const scheduleConfig = {
    executionSchedule: process.env["EXECUTION_SCHEDULE"] || "0 16 * * 1-5",
    runOnce: process.env["RUN_ONCE"] === "true",
    enableSchedule: process.env["ENABLE_SCHEDULE"] === "true",
};

export const logConfig = {
    level: (process.env["LOG_LEVEL"] || "info") as "debug" | "info" | "warn" | "error",
};

export const config = {
    alpaca: alpacaConfig,
    db: dbConfig,
    strategy: strategyConfig,
    trading: tradingConfig,
    schedule: scheduleConfig,
    log: logConfig,
};

export function initConfig(): typeof config {
    validateEnvironmentVariables();
    return config;
}

export default config;