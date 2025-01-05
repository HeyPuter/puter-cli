import readline from 'node:readline';
import chalk from 'chalk';
import Conf from 'conf';
import { execCommand, getPrompt } from './executor.js';
import { getAuthToken } from './auth.js';
import { PROJECT_NAME } from './commons.js';

const config = new Conf({ projectName: PROJECT_NAME });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: getPrompt()
});

/**
 * Update the current shell prompt
 */
export function updatePrompt(currentPath) {
  config.set('cwd', currentPath);
  rl.setPrompt(getPrompt());
}

/**
 * Start the interactive shell
 */
export function startShell() {
  if (!getAuthToken()) {
    console.log(chalk.red('Please login first using: puter login'));
    process.exit(1);
  }

  try {
    console.log(chalk.green('Welcome to Puter-CLI! Type "help" for available commands.'));
    rl.prompt();

    rl.on('line', async (line) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        try {
          await execCommand(trimmedLine);
        } catch (error) {
          console.error(chalk.red(error.message));
        }
      }
      rl.prompt();
    }).on('close', () => {
      console.log(chalk.yellow('\nGoodbye!'));
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red('Error starting shell:', error));
  }
}