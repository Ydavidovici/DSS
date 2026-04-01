export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    data?: Record<string, unknown>;
}

class Logger {
    private logLevel: LogLevel;
    private levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };

    constructor(logLevel: LogLevel = "info") {
        this.logLevel = logLevel;
    }

    /**
     * Set the minimum log level
     */
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Check if a log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.logLevel];
    }

    /**
     * Format and output a log entry
     */
    private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = {
            level,
            timestamp: new Date().toISOString(),
            message,
            data,
        };

        const colors = {
            debug: "\x1b[36m", // Cyan
            info: "\x1b[32m",  // Green
            warn: "\x1b[33m",  // Yellow
            error: "\x1b[31m", // Red
        };
        const reset = "\x1b[0m";

        const prefix = `${colors[level]}[${entry.level.toUpperCase()}]${reset}`;
        const timestamp = `\x1b[90m${entry.timestamp}${reset}`;

        if (data) {
            console.log(`${prefix} ${timestamp} ${message}`, data);
        } else {
            console.log(`${prefix} ${timestamp} ${message}`);
        }
    }

    /**
     * Log debug message
     */
    debug(message: string, data?: Record<string, unknown>): void {
        this.log("debug", message, data);
    }

    /**
     * Log info message
     */
    info(message: string, data?: Record<string, unknown>): void {
        this.log("info", message, data);
    }

    /**
     * Log warning message
     */
    warn(message: string, data?: Record<string, unknown>): void {
        this.log("warn", message, data);
    }

    /**
     * Log error message
     */
    error(message: string, data?: Record<string, unknown>): void {
        this.log("error", message, data);
    }

    /**
     * Log trade execution
     */
    trade(symbol: string, side: string, quantity: number, price: number): void {
        this.info(`Trade executed: ${side.toUpperCase()} ${quantity} ${symbol} @ $${price.toFixed(2)}`, {
            symbol,
            side,
            quantity,
            price,
            value: quantity * price,
        });
    }

    /**
     * Log trading signal
     */
    signal(symbol: string, type: string, price: number, reason: string): void {
        this.info(`Signal generated: ${type.toUpperCase()} ${symbol} @ $${price.toFixed(2)}`, {
            symbol,
            type,
            price,
            reason,
        });
    }
}

// Export singleton instance
export const logger = new Logger(
    (process.env["LOG_LEVEL"] as LogLevel) || "info",
);

export default logger;
