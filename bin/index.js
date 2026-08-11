#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { login, logout } from '../src/commands/auth.js';
import { init } from '../src/commands/init.js';
import { startShell } from '../src/commands/shell.js';
import { PROJECT_NAME, getLatestVersion } from '../src/commons.js';
import { appInfo, createApp, listApps, deleteApp, updateApp } from '../src/commands/apps.js';
import inquirer from 'inquirer';
import { initProfileModule, getProfileModule } from '../src/modules/ProfileModule.js';
import { initPuterModule } from '../src/modules/PuterModule.js';
import { createSite, infoSite, listSites, deleteSite } from '../src/commands/sites.js';

async function main() {
  initProfileModule();
  initPuterModule();

  const profileModule = getProfileModule();

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
    .command('init')
    .description('Initialize a new Puter app')
    .action(init);

  program
    .command('shell')
    .description('Start interactive shell')
    .action(() => startShell());


  // App commands
  program
    .command('apps')
    .description('List all your apps')
    .argument('[period]', 'period: today, yesterday, 7d, 30d, this_month, last_month')
    .action(async (period) => {
      await profileModule.checkLogin();
      await listApps({
        statsPeriod: period || 'all'
      });
      process.exit(0);
    });

  const app = program
    .command('app')
    .description('App management commands');

  app
    .command('info')
    .description('Get application information')
    .argument('<app_name>', 'Name of the application')
    .action(async (app_name) => {
      await profileModule.checkLogin();
      await appInfo([app_name]);
      process.exit(0);
    });

  app
    .command('create')
    .description('Create a new app')
    .argument('<name>', 'Name of the application')
    .argument('<remote_dir>', 'Remote directory URL')
    .action(async (name, remote_dir) => {
      try {
        await profileModule.checkLogin();
        await createApp({
          name: name,
          directory: remote_dir || '',
          description: '',
          url: 'https://dev-center.puter.com/coming-soon.html'
        });
      } catch (error) {
        console.error(chalk.red(error.message));
      }
      process.exit(0);
    });

  app
    .command('update')
    .description('Update an app')
    .argument('<name>', 'Name of the application')
    .argument('[dir]', 'Directory path', '.')
    .action(async (name, dir) => {
      await profileModule.checkLogin();
      await updateApp([name, dir]);
      process.exit(0);
    });

  app
    .command('delete')
    .description('Delete an app')
    .argument('<name>', 'Name of the application')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (name, options) => {
      await profileModule.checkLogin();
      let shouldDelete = options.force;

      if (!shouldDelete) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete the app "${name}"?`,
            default: false
          }
        ]);
        shouldDelete = answer.confirm;
      }

      if (shouldDelete) {
        await deleteApp(name);
      } else {
        console.log(chalk.yellow('App deletion cancelled.'));
      }
      process.exit(0);
    });

  program
    .command('sites')
    .description('List sites and subdomains')
    .action(async () => {
      await profileModule.checkLogin();
      await listSites();
      process.exit(0);
    });

  const site = program
    .command('site')
    .description('Site management commands');

  site
    .command('info')
    .description('Get site information by UID')
    .argument('<site_uid>', 'Site UID')
    .action(async (site_uid) => {
      await profileModule.checkLogin();
      await infoSite([site_uid]);
      process.exit(0);
    });

  site
    .command('create')
    .description('Create a static website from directory')
    .argument('<app_name>', 'Application name')
    .argument('[dir]', 'Directory path')
    .option('--subdomain <name>', 'Subdomain name')
    .action(async (app_name, dir, options) => {
      await profileModule.checkLogin();
      const args = [app_name];
      if (dir) args.push(dir);
      if (options.subdomain) args.push(`--subdomain=${options.subdomain}`)

      await createSite(args)
      process.exit(0);
    });

  site
    .command('deploy')
    .description('Deploy a local web project to Puter')
    .argument('[local_dir]', 'Local directory path')
    .argument('[subdomain]', 'Deployment subdomain (<subdomain>.puter.site)')
    .action(async (local_dir, subdomain) => {
      await profileModule.checkLogin();
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

      await startShell(`site:deploy ${local_dir}${subdomain ? ` --subdomain=${subdomain}` : ''}`)
      process.exit(0);
    });

  site
    .command('delete')
    .description('Delete a site by UID')
    .argument('<uid>', 'Site UID')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (uid, options) => {
      await profileModule.checkLogin();
      let shouldDelete = options.force;

      if (!shouldDelete) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete the site with UID "${uid}"?`,
            default: false
          }
        ]);
        shouldDelete = answer.confirm;
      }

      if (shouldDelete) {
        await deleteSite([uid]);
      } else {
        console.log(chalk.yellow('Site deletion cancelled.'));
      }
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