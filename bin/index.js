#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { login, logout } from '../src/commands/auth.js';
import { init } from '../src/commands/init.js';
import { startShell } from '../src/commands/shell.js';
import { PROJECT_NAME, getLatestVersion } from '../src/commons.js';
import { createApp } from '../src/commands/apps.js';
import { deploy } from '../src/commands/deploy.js';
import inquirer from 'inquirer';

async function main() {
  const version = await getLatestVersion(PROJECT_NAME);

  const program = new Command();
  program
    .name(PROJECT_NAME)
    .description('CLI tool for Puter cloud platform')
    .version(version);

  program
    .command('login')
    .description('Login to Puter account')
    .option('-s, --save', 'Save authentication token in .env file', '')
    .action(() => {
      startShell('login');
    });

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
    .command('app:create')
    .description('Create a new Puter application')
    .argument('<name>', 'Name of the application')
    .argument('[remoteDir]', 'Remote directory path')
    .option('-d, --description [description]', 'Application description', '')
    .option('-u, --url <url>', 'Application URL', 'https://dev-center.puter.com/coming-soon.html')
    .action(async (name, remoteDir, options) => {
      try {
        await createApp({
          name,
          directory: remoteDir || '',
          description: options.description || '',
          url: options.url
        });
      } catch (error) {
        console.error(chalk.red(error.message));
      }
      process.exit(0);
    });

  const site = program
  .command('site')
  .description('Site management commands');

  site
    .command('deploy')
    .description('Deploy a local web project to Puter')
    .argument('[local_dir]', 'Local directory path')
    .argument('[subdomain]', 'Deployment subdomain (<subdomain>.puter.site)')
    .action(async (local_dir, subdomain) => {
      if (!local_dir) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'local_dir',
            message: 'Local directory path:',
            default: '.'
          }
        ]);
        local_dir = answer.local_dir;
      }

      if (!subdomain) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'subdomain',
            message: 'Deployment subdomain (leave empty for random):',
          }
        ]);
        subdomain = answer.subdomain;
      }

      await startShell(`site:deploy ${local_dir}${subdomain ? ` --subdomain=${subdomain}`: ''}`)
      process.exit(0);
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