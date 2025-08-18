// src/processManager.js
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { generateInitialCode, refineCode } from './assistants/codeGenerator.js';
import { writeToFile } from './assistants/fileManager.js';
import { runTests } from './assistants/testRunner.js';
import {
    trackApiUsage,
    trackAccuracy,
    logMetrics,
    resetMetrics,
} from './assistants/statsTracker.js';
import { awaitApproval } from './utils/approval.js';
import { logAction, logError } from './utils/logger.js';
import { handleGitOperations } from './utils/gitHandler.js';
import { sendNotification } from './utils/notifications.js';
import { loadConfig } from './config/config.js';

const config = loadConfig();

export async function startProcess(prompt) {
    try {
        resetMetrics();
        logAction(`Starting process for prompt: "${prompt}"`);
        sendNotification(`Starting process for prompt: "${prompt}"`, 'info');

        // Step 1: Create a new Git branch if needed
        if (config.gitPreferences.branching === 'new branch for new features') {
            const { branchName } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'branchName',
                    message: 'Enter a name for the new feature branch:',
                    default: `feature-${Date.now()}`,
                },
            ]);
            execSync(`git checkout -b ${branchName}`);
            logAction(`Created and switched to branch: "${branchName}"`);
            sendNotification(`Created and switched to branch: "${branchName}"`, 'success');
        }

        // Step 2: Generate Initial Code
        const initialCode = await generateInitialCode(prompt);
        const filename = config.filePreferences.filename || 'generatedCode.js';
        writeToFile(filename, initialCode);
        logAction(`Initial code generated and written to "${filename}"`);
        sendNotification(`Initial code generated and written to "${filename}"`, 'success');
        trackApiUsage(initialCode.length);

        // Step 3: Run Tests
        let testResults = await runTests();

        // Step 4: Refinement Loop
        while (!testResults.success) {
            logAction('Tests failed. Initiating code refinement...');
            sendNotification('Tests failed. Refining code...', 'warning');

            const refinementPrompt = `Refine the following code to fix the failing tests:\n\n${initialCode}`;
            const refinedCode = await refineCode(refinementPrompt, initialCode);
            writeToFile(filename, refinedCode);
            logAction(`Code refined and written to "${filename}"`);
            sendNotification(`Code refined and written to "${filename}"`, 'info');
            trackApiUsage(refinedCode.length);

            // Re-run tests after refinement
            testResults = await runTests();
            trackAccuracy(testResults.passed, testResults.total);
        }

        logAction('All tests passed successfully!');
        sendNotification('All tests passed successfully!', 'success');
        logMetrics();

        // Step 5: Await User Approval to Finalize
        const approved = await awaitApproval(
            'Code is ready and all tests passed. Do you want to approve and commit?'
        );
        if (approved) {
            logAction('User approved the code.');
            sendNotification('User approved the code. Committing changes...', 'info');
            // Commit and push changes
            await handleGitOperations(config, prompt);
            sendNotification('Changes have been committed and pushed successfully!', 'success');
        } else {
            logAction('User requested further changes.');
            sendNotification('User requested further changes.', 'warning');
            // Optionally handle further changes or loop back
        }
    } catch (error) {
        logError(`Error in startProcess: ${error.message}`);
        console.error('An error occurred:', error.message);
        sendNotification(`An error occurred: ${error.message}`, 'error');

        // Interactive error handling
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: ['Retry', 'View Error Details', 'Abort'],
            },
        ]);

        switch (action) {
            case 'Retry':
                await startProcess(prompt);
                break;
            case 'View Error Details':
                console.error(error.stack);
                sendNotification(`Error Details: ${error.message}`, 'error');
                await startProcess(prompt);
                break;
            case 'Abort':
                console.log('Process aborted.');
                sendNotification('Process aborted by user.', 'warning');
                break;
        }
    }
}
