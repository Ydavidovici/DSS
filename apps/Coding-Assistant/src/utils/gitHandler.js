// src/utils/gitHandler.js
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { logAction, logError } from './logger.js';
import { sendNotification } from './notifications.js';
import { loadConfig } from '../config/config.js';

const config = loadConfig();

export async function handleGitOperations(config, prompt) {
    try {
        // Commit Changes
        const commitMessage = generateCommitMessage(config.gitPreferences.commitMessageFormat, prompt);
        execSync(`git add .`);
        execSync(`git commit -m "${commitMessage}"`);
        logAction(`Committed changes with message: "${commitMessage}"`);
        sendNotification(`Committed changes: "${commitMessage}"`, 'success');

        // Push Changes if autoPush is enabled
        if (config.gitPreferences.autoPush) {
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
            execSync(`git push origin ${currentBranch}`);
            logAction(`Pushed changes to branch: "${currentBranch}"`);
            sendNotification(`Pushed changes to branch: "${currentBranch}"`, 'success');
        }
    } catch (error) {
        logError(`Git operation failed: ${error.message}`);
        sendNotification(`Git operation failed: ${error.message}`, 'error');

        // Interactive error handling for Git operations
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Git operation failed. What would you like to do?',
                choices: [
                    'Retry Commit',
                    'View Error Details',
                    'Abort',
                ],
            },
        ]);

        switch (action) {
            case 'Retry Commit':
                await handleGitOperations(config, prompt);
                break;
            case 'View Error Details':
                console.error(error.stack);
                sendNotification(`Git Error Details: ${error.message}`, 'error');
                await handleGitOperations(config, prompt);
                break;
            case 'Abort':
                console.log('Git operations aborted.');
                sendNotification('Git operations aborted by user.', 'warning');
                break;
        }
    }
}

function generateCommitMessage(format, prompt) {
    // Replace placeholders with actual values
    let message = format.replace('[description]', prompt);
    // You can add more placeholder replacements if needed
    return message;
}
