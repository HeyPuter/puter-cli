import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import { listApps, createApp, deleteApp, listSubdomains, 
  deploySite, deleteSubdomain, deleteSite } from './apps.js';
import { listFiles, makeDirectory, renameFileOrDirectory, 
  removeFileOrDirectory, emptyTrash, changeDirectory, showCwd, 
  getInfo, getDiskUsage, createFile, readFile, uploadFile, 
  downloadFile, copyFile, syncDirectory } from './files.js';
import { getUserInfo, getUsageInfo } from './auth.js';
import { PROJECT_NAME, API_BASE, getHeaders } from './commons.js';
import inquirer from 'inquirer';
import { exec } from 'node:child_process';

const config = new Conf({ projectName: PROJECT_NAME });

/**
 * Update the prompt function
 * @returns The current prompt
 */
export function getPrompt() {
  return chalk.cyan(`puter@${config.get('cwd').slice(1)}> `);
}

const commands = {
  help: showHelp,
  exit: () => process.exit(0),
  logout: async () => {
    await import('./auth.js').then(m => m.logout());
    process.exit(0);
  },
  whoami: getUserInfo,
  stat: getInfo,
  apps: async (args) => {
      await listApps({
        statsPeriod: args[0] || 'all'
    });
  },
  'app:create': async (args) => {
    if (args.length < 1) {
        console.log(chalk.red('Usage: app:create <name> [description] [url]'));
        return;
    }
    await createApp(args[0], args[1]);
  },
  'app:delete': async (args) => {
    if (args.length < 1) {
        console.log(chalk.red('Usage: app:delete <name>'));
    }
    const name = args[0].trim();

    const { confirm } = await inquirer.prompt([
      {
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(`Are you sure you want to delete "${name}"?`),
          default: false
      }
    ]);

    if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'));
        return false;
    } 
    await deleteApp(name);
  },
  ls: listFiles,
  cd: async (args) => {
    await changeDirectory(args);
  },
  pwd: showCwd,
  mkdir: makeDirectory,
  mv: renameFileOrDirectory,
  rm: removeFileOrDirectory,
  // rmdir: deleteFolder, // Not implemented in Puter API
  clean: emptyTrash,
  df: getDiskUsage,
  usage: getUsageInfo,
  cp: copyFile,
  touch: createFile,
  cat: readFile,
  push: uploadFile,
  pull: downloadFile,
  update: syncDirectory,
  domains: listSubdomains,
  'domain:delete': deleteSubdomain,
  'site:delete': deleteSite,
  deploy: deploySite
};

/**
 * Execute a command
 * @param {string} input The command line input
 */
export async function execCommand(input) {
  const [cmd, ...args] = input.split(' ');


  if (cmd.startsWith('!')) {
    // Execute the command on the host machine
    const hostCommand = input.slice(1); // Remove the "!"
      exec(hostCommand, (error, stdout, stderr) => {
          if (error) {
              console.error(chalk.red(`Host Error: ${error.message}`));
              return;
          }
          if (stderr) {
              console.error(chalk.red(stderr));
              return;
          }
          console.log(stdout);
          console.log(chalk.green(`Press <Enter> to return.`));
      });
  } else if (commands[cmd]) {
    // const spinner = ora(chalk.green(`Executing command: ${cmd}...\n`)).start();
    try {
      await commands[cmd](args);
      // spinner.succeed(chalk.green(`Command "${cmd}" executed successfully!`));
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error.message}`));
      // spinner.fail(chalk.red(`Error executing command: ${error.message}`));
    }
  } else {
    if (!['Y','N'].includes(cmd.toUpperCase()[0])){
      console.log(chalk.red(`Unknown command: ${cmd}`));
      showHelp();
    }
  }
}

/**
 * Display help menu
 */
function showHelp() {
  console.log(chalk.yellow('\nAvailable commands:'));
  console.log(`
  ${chalk.cyan('help')}              Show this help message
  ${chalk.cyan('exit')}              Exit the shell
  ${chalk.cyan('logout')}            Logout from Puter account
  ${chalk.cyan('whoami')}            Show user informations
  ${chalk.cyan('stat')}              Show statistical informations
  ${chalk.cyan('df')}                Show disk usage informations
  ${chalk.cyan('usage')}             Show usage informations
  ${chalk.cyan('stat')}              Show statistical informations
  ${chalk.cyan('apps [period]')}     List all your apps
                      period: today, yesterday, 7d, 30d, this_month, last_month
  ${chalk.cyan('app:create')}        Create a new app: app:create <name> [url]
  ${chalk.cyan('app:delete')}        Delete an app: app:delete <name>
  ${chalk.cyan('ls')}                List files and directories
  ${chalk.cyan('cd [dir]')}          Change the current working directory
  ${chalk.cyan('cd ..')}             Go up one directory
  ${chalk.cyan('pwd')}               Print the current working directory
  ${chalk.cyan('mkdir')}             Create a new directory
  ${chalk.cyan('mv')}                Rename a file or directory
  ${chalk.cyan('rm')}                Move a file or directory to the system's Trash
  ${chalk.cyan('clean')}             Empty the system's Trash
  ${chalk.cyan('cp')}                Copy files or directories
  ${chalk.cyan('touch')}             Create a new empty file
  ${chalk.cyan('cat')}               Output file content to the console
  ${chalk.cyan('push')}              Upload file to Puter cloud
  ${chalk.cyan('pull')}              Download file from Puter cloud
  ${chalk.cyan('update')}            Sync local directory with remote cloud
  ${chalk.cyan('domains')}           Listing subdomains
  ${chalk.cyan('domain:delete')}     Delete a subdomain by UID (DEPRECATED: use site:delete instead)
  ${chalk.cyan('site:delete')}       Delete a site by UUID
  ${chalk.cyan('deploy')}            Deploy a local directory into a new app
  `);
}
