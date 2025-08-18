// src/utils/approval.js
import inquirer from 'inquirer';

export async function awaitApproval(message) {
    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'approve',
            message: message,
            default: true,
        },
    ]);
    return answers.approve;
}
