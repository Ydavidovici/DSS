// src/utils/logger.js
import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

const logDir = path.resolve(config.logsDirectory || 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
    ),
    transports: [
        new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new transports.File({ filename: path.join(logDir, 'combined.log') })
    ]
});

// If not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(info => {
                switch(info.level) {
                    case 'info':
                        return `\x1b[34m[INFO]\x1b[0m ${info.message}`;
                    case 'warn':
                        return `\x1b[33m[WARN]\x1b[0m ${info.message}`;
                    case 'error':
                        return `\x1b[31m[ERROR]\x1b[0m ${info.message}`;
                    default:
                        return info.message;
                }
            })
        )
    }));
}

export function logAction(message) {
    logger.info(message);
}

export function logError(message) {
    logger.error(message);
}
