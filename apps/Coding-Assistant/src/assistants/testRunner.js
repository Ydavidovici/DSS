// src/assistants/testRunner.js
import { execSync } from 'child_process';
import ora from 'ora';
import { logAction, logError } from '../utils/logger.js';
import { loadConfig } from '../config/config.js';
import { addExecutionTime } from './statsTracker.js';

const config = loadConfig();

export async function runTests() {
    const spinner = ora('Running tests...').start();
    const startTime = Date.now();

    try {
        const testCommand = config.testing.command || 'npm test';
        const output = execSync(testCommand, { encoding: 'utf-8' });
        const endTime = Date.now();
        const duration = endTime - startTime;
        addExecutionTime(duration);

        spinner.succeed('Tests completed successfully.');
        logAction('Tests completed successfully.');

        // Simple parsing logic; adjust based on your test framework's output
        const passed = output.includes('PASS') && !output.includes('FAIL');
        const total = extractTotalTests(output);
        const failed = extractFailedTests(output);

        return {
            success: passed && failed === 0,
            passed,
            total,
        };
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        addExecutionTime(duration);

        spinner.fail('Tests failed.');
        logError(`Tests failed: ${error.message}`);

        return {
            success: false,
            passed: 0,
            total: 0,
        };
    }
}

function extractTotalTests(output) {
    const totalMatch = output.match(/(\d+) total/);
    return totalMatch ? parseInt(totalMatch[1], 10) : 0;
}

function extractFailedTests(output) {
    const failedMatch = output.match(/(\d+) failed/);
    return failedMatch ? parseInt(failedMatch[1], 10) : 0;
}
