// src/utils/fileSelector.js
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

export async function selectFiles(directory) {
    const files = fs
        .readdirSync(directory)
        .filter((file) => file.endsWith('.js'));
    if (files.length === 0) {
        console.log('No JavaScript files found in the directory.');
        return [];
    }
    const answers = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedFiles',
            message: 'Select files to perform actions on:',
            choices: files,
        },
    ]);
    return answers.selectedFiles.map((file) => path.join(directory, file));
}
