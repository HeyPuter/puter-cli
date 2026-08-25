#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { login, logout } from '../src/commands/auth.js';
import { startShell } from '../src/commands/shell.js';
import { PROJECT_NAME, getLatestVersion } from '../src/commons.js';
import { initProfileModule } from '../src/modules/ProfileModule.js';
import { initPuterModule } from '../src/modules/PuterModule.js';
import { formatError, isAuthError, report } from '../src/modules/ErrorModule.js';

// puter.js attaches an async 'load' listener to its XHRs, so a failed request
// rejects twice: once on the promise we await, and once on a promise nothing
// holds. Without this guard Node kills the CLI and prints the rejected plain
// object as "#<Object>". Auth failures are already surfaced with a re-login
// prompt by checkLogin(), so only report what is not handled elsewhere.
process.on('unhandledRejection', (error) => {
  report(error);
  if (!isAuthError(error)) {
    console.error(chalk.red(`Error: ${formatError(error)}`));
    console.error(chalk.dim('Run "last-error" in the shell for the full details.'));
  }
});

async function main() {
  initProfileModule();
  initPuterModule();

  const version = await getLatestVersion(PROJECT_NAME);

  const program = new Command();
  program
    .name('puter')
    .description('CLI tool for Puter cloud platform')
    .version(version);

  program
    .command('login')
    .description('Login to Puter account')
    .option('-s, --save', 'Save authentication token in .env file')
    .option('--web', 'Use browser-based login (default)')
    .option('--with-credentials', 'Use username/password login')
    .option('--host <url>', 'Puter host URL', 'https://puter.com')
    .action(async (options) => {
      await login(options);
      process.exit(0);
    });

  program
    .command('logout')
    .description('Logout from Puter account')
    .action(async () => {
      await logout();
      process.exit(0);
    });

  program
    .command('shell')
    .description('Start interactive shell')
    .action(() => startShell());


  if (process.argv.length === 2) {
    startShell();
  } else {
    program.parse(process.argv);
  }
}

main().catch((err) => {
  report(err);
  if (isAuthError(err)) {
    console.error(chalk.red('Your session has expired or its token is no longer valid.'));
    console.error(chalk.cyan('Run "puter login" to sign in again.'));
  } else {
    console.error(chalk.red(`Error: ${formatError(err)}`));
  }
  process.exit(1);
});