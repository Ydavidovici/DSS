// src/utils/settings.js
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { logAction } from './logger.js';

export async function updateSettings(config) {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'prettierEnforcement',
            message: 'How often should Prettier be enforced?',
            choices: ['pre-commit', 'on save', 'manually'],
            default: config.prettierPreferences.enforcement,
        },
        {
            type: 'list',
            name: 'prettierStrictness',
            message: 'Prettier strictness level:',
            choices: ['strict', 'flexible'],
            default: config.prettierPreferences.strictness,
        },
        {
            type: 'list',
            name: 'eslintEnforcement',
            message: 'How often should ESLint be enforced?',
            choices: ['on save', 'pre-commit', 'manually'],
            default: config.eslintPreferences.enforcement,
        },
        {
            type: 'list',
            name: 'eslintStrictness',
            message: 'ESLint strictness level:',
            choices: ['strict', 'moderate', 'custom'],
            default: config.eslintPreferences.strictness,
        },
        {
            type: 'list',
            name: 'gitBranching',
            message: 'Git branching strategy:',
            choices: ['new branch for new features', 'single branch'],
            default: config.gitPreferences.branching,
        },
        {
            type: 'confirm',
            name: 'gitAutoCommit',
            message: 'Automatically commit changes?',
            default: config.gitPreferences.autoCommit,
        },
        {
            type: 'confirm',
            name: 'gitAutoPush',
            message: 'Automatically push commits to remote?',
            default: config.gitPreferences.autoPush,
        },
    ]);

    // Update the config object
    config.prettierPreferences.enforcement = answers.prettierEnforcement;
    config.prettierPreferences.strictness = answers.prettierStrictness;
    config.eslintPreferences.enforcement = answers.eslintEnforcement;
    config.eslintPreferences.strictness = answers.eslintStrictness;
    config.gitPreferences.branching = answers.gitBranching;
    config.gitPreferences.autoCommit = answers.gitAutoCommit;
    config.gitPreferences.autoPush = answers.gitAutoPush;

    // Save the updated config to codePreferences.json
    const configPath = path.resolve('src', 'config', 'codePreferences.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logAction('Settings updated successfully.');
    console.log('\nSettings have been updated.\n');
}
