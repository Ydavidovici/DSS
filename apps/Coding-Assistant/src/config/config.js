// src/config/config.js
import fs from 'fs';
import path from 'path';

export function loadConfig() {
    const configPath = path.resolve('src', 'config', 'codePreferences.json');
    if (!fs.existsSync(configPath)) {
        console.error('Configuration file not found:', configPath);
        process.exit(1);
    }
    const configData = fs.readFileSync(configPath, 'utf-8');
    try {
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error parsing configuration file:', error);
        process.exit(1);
    }
}
