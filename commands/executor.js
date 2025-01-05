import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import path from 'path';
import { formatDate } from './utils.js';
import { listApps, createApp, deleteApp } from './apps.js';
import { listFiles, makeDirectory, renameFileOrDirectory, 
  removeFileOrDirectory, emptyTrash, changeDirectory, showCwd, getInfo, getDiskUsage } from './files.js';
import { getCurrentUserName, getUserInfo, getUsageInfo } from './auth.js';
import { PROJECT_NAME, API_BASE, getHeaders } from './commons.js';
import inquirer from 'inquirer';
import { exec } from 'node:child_process';

const config = new Conf({ projectName: PROJECT_NAME });

/**
 * Update the prompt function
 * @returns The current prompt
 */
export function getPrompt() {
  return chalk.cyan(`puter@${config.get('cwd')}> `);
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
        statsPeriod: args[0] || 'all',
        iconSize: parseInt(args[1]) || 64
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
    // return await deleteApp(name);
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
  touch: touchFile,
  put: uploadFile,
  get: downloadFile,
  update: syncDirectory
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
          console.log(chalk.cyan(`Press <Enter> to return.`));
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
  ${chalk.cyan('help')}     Show this help message
  ${chalk.cyan('exit')}     Exit the shell
  ${chalk.cyan('logout')}   Logout from Puter account
  ${chalk.cyan('whoami')}   Show user informations
  ${chalk.cyan('stat')}     Show statistical informations
  ${chalk.cyan('df')}       Show disk usage informations
  ${chalk.cyan('usage')}    Show usage informations
  ${chalk.cyan('stat')}     Show statistical informations
  ${chalk.cyan('apps [period] [iconSize]')}  List all your apps
                      period: today, yesterday, 7d, 30d, this_month, last_month
                      iconSize: 16, 32, 64, 128, 256, 512
  ${chalk.cyan('app:create')}        Create a new app: app:create <name> [url]
  ${chalk.cyan('app:delete')}        Delete an app: app:delete <name>
  ${chalk.cyan('ls')}       List files and directories
  ${chalk.cyan('cd')}       Change the current working directory
  ${chalk.cyan('pwd')}      Print the current working directory
  ${chalk.cyan('mkdir')}    Create a new directory
  ${chalk.cyan('mv')}       Rename a file or directory
  ${chalk.cyan('rm')}       Move a file or directory to the system's Trash
  ${chalk.cyan('clean')}    Empty the system's Trash
  ${chalk.cyan('cp')}       Copy files or directories
  ${chalk.cyan('touch')}    Create a new empty file
  ${chalk.cyan('put')}      Upload file to Puter cloud
  ${chalk.cyan('get')}      Download file from Puter cloud
  ${chalk.cyan('update')}   Sync local directory with cloud
  `);
}


async function copyFile(args) {
  if (args.length < 2) {
    throw new Error('Source and destination required');
  }
  console.log(`Copying ${args[0]} to ${args[1]}...`);
}

async function touchFile(args) {
  if (!args.length) {
    throw new Error('File name is required');
  }
  console.log(`Creating file ${args[0]}...`);
}

async function uploadFile(args) {
  if (!args.length) {
    throw new Error('File name is required');
  }
  console.log(`Uploading ${args[0]}...`);
}

async function downloadFile(args) {
  if (!args.length) {
    throw new Error('File name is required');
  }
  console.log(`Downloading ${args[0]}...`);
}

async function syncDirectory(args) {
  console.log('Syncing directory...');
}