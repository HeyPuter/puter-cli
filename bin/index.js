#!/usr/bin/env node
import { Command } from 'commander';
import { login, logout } from '../commands/auth.js';
import { init } from '../commands/init.js';
import { startShell } from '../commands/shell.js';
import { PROJECT_NAME, getLatestVersion } from '../commands/commons.js';

async function main() {
  const { version } = await getLatestVersion(PROJECT_NAME);

  const program = new Command();
  program
    .name(PROJECT_NAME)
    .description('CLI tool for Puter cloud platform')
    .version(version);

  program
    .command('login')
    .description('Login to Puter account')
    .action(login);

  program
    .command('logout')
    .description('Logout from Puter account')
    .action(logout);

  program
    .command('init')
    .description('Initialize a new Puter app')
    .action(init);

  program
    .command('shell')
    .description('Start interactive shell')
    .action(startShell);


  // App commands
  program
    .command('app:create <name>')
    .description('Create a new Puter application')
    .argument('<name>', 'Name of the application')
    .argument('[directory]', 'Local directory path')
    .option('-d, --description <description>', 'Application description')
    .option('-u, --url <url>', 'Application URL', 'https://dev-center.puter.com/coming-soon.html')
    .action(async (name, directory, options) => {
      try {
        await createApp({
          name,
          directory: directory || '',
          description: options.description || '',
          url: options.url
        });
      } catch (error) {
        console.error(chalk.red(error.message));
      }
    });

  if (process.argv.length === 2) {
    startShell();
  } else {
    program.parse(process.argv);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});