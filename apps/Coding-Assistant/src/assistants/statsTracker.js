// src/assistants/statsTracker.js
import fs from 'fs';
import path from 'path';
import { logAction } from '../utils/logger.js';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

let apiUsage = 0;
let tokensUsed = 0;
let successfulTests = 0;
let totalTests = 0;
let executionTime = 0;

export function trackApiUsage(tokens) {
    apiUsage += 1;
    tokensUsed += tokens;
}

export function trackAccuracy(passed, total) {
    successfulTests += passed;
    totalTests += total;
}

export function addExecutionTime(time) {
    executionTime += time; // Time in milliseconds
}

export function logMetrics() {
    const accuracy = totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(2) : '0.00';
    const metrics = {
        apiUsage,
        tokensUsed,
        codeAccuracy: `${accuracy}%`,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
    };

    const logDir = path.resolve(config.logsDirectory || 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        logAction(`Created logs directory at ${logDir}`);
    }

    const logPath = path.join(logDir, `session-log-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(logPath, JSON.stringify(metrics, null, 2), 'utf-8');
    logAction(`Metrics logged to ${logPath}`);
}

export function resetMetrics() {
    apiUsage = 0;
    tokensUsed = 0;
    successfulTests = 0;
    totalTests = 0;
    executionTime = 0;
    logAction('Metrics have been reset.');
}
