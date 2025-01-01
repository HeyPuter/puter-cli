import readline from 'node:readline';
import chalk from 'chalk';
import Conf from 'conf';
import { execCommand } from './executor.js';

const config = new Conf({ projectName: 'puter-cli' });

export function startShell() {
  if (!config.get('auth_token')) {
    console.log(chalk.red('Please login first using: puter login'));
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('puter> ')
  });

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
}