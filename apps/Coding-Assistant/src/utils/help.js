// src/utils/help.js
import chalk from 'chalk';

export function displayHelp() {
    console.log(chalk.green('\n=== Coding Assistant Help ===\n'));
    console.log(`
    Available Commands:
    - ${chalk.blue('Generate and Refine Code')}: Start a new coding task based on your prompt.
    - ${chalk.blue('Run Tests')}: Execute all tests in the project.
    - ${chalk.blue('View Logs')}: View the latest logs of actions and errors.
    - ${chalk.blue('View Metrics')}: View usage and performance metrics.
    - ${chalk.blue('Update Settings')}: Change your coding and tool preferences.
    - ${chalk.blue('Help')}: Display this help message.
    - ${chalk.blue('Exit')}: Quit the assistant.

    Usage Tips:
    - Use descriptive prompts for better code generation results.
    - Regularly view logs and metrics to monitor performance.
    - Keep your Git repository updated with automated commits.
    - Update settings to tailor the assistant to your workflow.
    `);
}
