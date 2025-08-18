// src/assistants/fileManager.js
import fs from 'fs';
import path from 'path';
import { logAction, logError } from '../utils/logger.js';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

export function writeToFile(filename, content) {
    try {
        const projectDir = path.resolve(config.projectDirectory || 'project');
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
            logAction(`Created project directory at ${projectDir}`);
        }

        const filePath = path.join(projectDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        logAction(`Written to file: ${filePath}`);
    } catch (error) {
        logError(`Error writing to file ${filename}: ${error.message}`);
        throw error;
    }
}

export function readFile(filename) {
    try {
        const projectDir = path.resolve(config.projectDirectory || 'project');
        const filePath = path.join(projectDir, filename);
        const data = fs.readFileSync(filePath, 'utf-8');
        logAction(`Read file: ${filePath}`);
        return data;
    } catch (error) {
        logError(`Error reading file ${filename}: ${error.message}`);
        throw error;
    }
}

export function listFiles(extension = '.js') {
    try {
        const projectDir = path.resolve(config.projectDirectory || 'project');
        if (!fs.existsSync(projectDir)) {
            logError(`Project directory does not exist at ${projectDir}`);
            return [];
        }

        const files = fs.readdirSync(projectDir).filter(file => file.endsWith(extension));
        logAction(`Listed ${files.length} files with extension ${extension} in ${projectDir}`);
        return files;
    } catch (error) {
        logError(`Error listing files: ${error.message}`);
        throw error;
    }
}
