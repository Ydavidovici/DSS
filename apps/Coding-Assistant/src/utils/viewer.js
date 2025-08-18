// src/utils/viewer.js
import fs from 'fs';
import path from 'path';
import { logAction, logError } from './logger.js';

export function viewLogs() {
    const logPath = path.join('logs', 'combined.log');
    if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf-8');
        console.log('\n=== Logs ===\n');
        console.log(logs);
    } else {
        console.log('No logs found.');
    }
}

export function viewMetrics() {
    const metricsFiles = fs
        .readdirSync('logs')
        .filter((file) => file.startsWith('session-log-'));
    if (metricsFiles.length === 0) {
        console.log('No metrics found.');
        return;
    }
    metricsFiles.forEach((file) => {
        const metrics = JSON.parse(
            fs.readFileSync(path.join('logs', file), 'utf-8')
        );
        console.log(`\n=== Metrics for ${file} ===`);
        console.table(metrics);
    });
}
