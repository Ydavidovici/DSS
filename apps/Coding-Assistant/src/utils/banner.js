// src/utils/banner.js
import figlet from 'figlet';
import chalk from 'chalk';

export function displayBanner() {
    console.log(
        chalk.green(
            figlet.textSync('Coding Assistant', { horizontalLayout: 'full' })
        )
    );
    console.log(chalk.blue('Welcome to the Coding Assistant!\n'));
}
