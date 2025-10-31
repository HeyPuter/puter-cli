import readline from 'node:readline';
import chalk from 'chalk';
import Conf from 'conf';
import { execCommand, getPrompt } from '../executor.js';
import { PROJECT_NAME } from '../commons.js';
import { getProfileModule } from '../modules/ProfileModule.js';

const config = new Conf({ projectName: PROJECT_NAME });

export let rl;

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
export async function startShell(command) {
  const profileModule = getProfileModule();
  await profileModule.checkLogin();

  // This argument enables the `puter <subcommand>` commands
  if (command) {
    await execCommand(command);
    process.exit(0);
  }

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: null
  })

  try {
    console.log(chalk.green('Welcome to Puter-CLI! Type "help" for available commands.'));
    rl.setPrompt(getPrompt());
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
