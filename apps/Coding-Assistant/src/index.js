// src/index.js
import inquirer from 'inquirer';
import { startProcess } from './processManager.js';
import { loadConfig } from './config/config.js';
import { viewLogs, viewMetrics } from './utils/viewer.js';
import { updateSettings } from './utils/settings.js';
import { displayHelp } from './utils/help.js';
import { displayBanner } from './utils/banner.js';

const config = loadConfig();

async function mainMenu() {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'Generate and Refine Code',
                'Run Tests',
                'View Logs',
                'View Metrics',
                'Update Settings',
                'Help',
                'Exit',
            ],
        },
    ]);

    switch (answers.action) {
        case 'Generate and Refine Code':
            const { prompt } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'prompt',
                    message: 'Enter your coding prompt:',
                },
            ]);
            await startProcess(prompt, config);
            break;
        case 'Run Tests':
            // Implement test running logic
            await runTestsInteractive(config);
            break;
        case 'View Logs':
            viewLogs();
            break;
        case 'View Metrics':
            viewMetrics();
            break;
        case 'Update Settings':
            await updateSettings(config);
            break;
        case 'Help':
            displayHelp();
            break;
        case 'Exit':
            console.log('Goodbye!');
            process.exit(0);
    }

    mainMenu(); // Loop back to the menu after action completes
}

displayBanner();
mainMenu();
