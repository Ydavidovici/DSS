// src/utils/notifications.js
import notifier from 'node-notifier';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

export function sendNotification(message, type = 'info') {
    let title = 'Coding Assistant';
    let iconPath;

    // Define icons based on notification type
    switch(type) {
        case 'success':
            iconPath = path.join('src', 'utils', 'assets', 'success.png');
            break;
        case 'error':
            iconPath = path.join('src', 'utils', 'assets', 'error.png');
            break;
        case 'warning':
            iconPath = path.join('src', 'utils', 'assets', 'warning.png');
            break;
        default:
            iconPath = path.join('src', 'utils', 'assets', 'info.png');
    }

    notifier.notify({
        title: title,
        message: message,
        icon: fs.existsSync(iconPath) ? iconPath : undefined, // Use icon if it exists
        sound: true,
        wait: false
    });

    // Also log to console with colors
    switch(type) {
        case 'success':
            console.log(chalk.green(`[SUCCESS] ${message}`));
            break;
        case 'error':
            console.log(chalk.red(`[ERROR] ${message}`));
            break;
        case 'warning':
            console.log(chalk.yellow(`[WARN] ${message}`));
            break;
        default:
            console.log(chalk.blue(`[INFO] ${message}`));
    }
}
