import readline from 'node:readline';
import chalk from 'chalk';
import Conf from 'conf';
import { execCommand, getPrompt } from '../executor.js';
import { PROJECT_NAME } from '../commons.js';
import SetContextModule from '../modules/SetContextModule.js';
import ErrorModule from '../modules/ErrorModule.js';
import ProfileModule from '../modules/ProfileModule.js';
import putility from '@heyputer/putility';
import { initPuterModule } from '../modules/PuterModule.js';

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
  const modules = [
    SetContextModule,
    ErrorModule,
    ProfileModule,
  ];

  const context = new putility.libs.context.Context({
    events: new putility.libs.event.Emitter(),
  });

  for ( const module of modules ) module({ context });

  await context.events.emit('check-login', {});

  initPuterModule();
  
  // This argument enables the `puter <subcommand>` commands
  if ( command ) {
    await execCommand(context, command);
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
          await execCommand(context, trimmedLine);
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
