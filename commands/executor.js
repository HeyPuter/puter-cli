import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import path from 'path';
import { formatDate } from './utils.js';
import { listApps, createApp, deleteApp } from './apps.js';
import { listFiles, makeDirectory, renameFileOrDirectory, 
  removeFileOrDirectory, emptyTrash, changeDirectory, showCwd } from './files.js';
import { getCurrentUserName } from './auth.js';
import { PROJECT_NAME } from './commons.js';
import inquirer from 'inquirer';
import { exec } from 'node:child_process';

const config = new Conf({ projectName: PROJECT_NAME });

// Update the prompt function
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
      const options = {
          statsPeriod: args[0] || 'all',
          iconSize: parseInt(args[1]) || 64
      };
      await listApps(options);
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
  // rmdir: deleteFolder,
  clean: emptyTrash,
  cp: copyFile,
  touch: touchFile,
  put: uploadFile,
  get: downloadFile,
  update: syncDirectory
};

export async function execCommand(input) {
  const [cmd, ...args] = input.split(' ');


  if (cmd.startsWith('!')) {
    // Execute the command on the host machine
    const hostCommand = input.slice(1); // Remove the "!"
      exec(hostCommand, (error, stdout, stderr) => {
          if (error) {
              console.error(chalk.red(`Error executing host command: ${error.message}`));
              return;
          }
          if (stderr) {
              console.error(chalk.red(stderr));
              return;
          }
          console.log(stdout);
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

function showHelp() {
  console.log(chalk.yellow('\nAvailable commands:'));
  console.log(`
  ${chalk.cyan('help')}     Show this help message
  ${chalk.cyan('exit')}     Exit the shell
  ${chalk.cyan('logout')}   Logout from Puter account
  ${chalk.cyan('whoami')}   Show user informations
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


async function getUserInfo() {
  const spinner = ora(chalk.green('Getting user info...\n')).start();
  try {
    const response = await fetch('https://api.puter.com/whoami', {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await response.json();
    if (data) {
      console.dir(data, { depth: null});
      console.log('\n');
      spinner.succeed(chalk.green('Done.'));
    } else {
      spinner.fail(chalk.red('Unable to get your info. Please check your credentials.'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to get user info'));
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

async function getInfo(args = ['/']) {
  const path = '/'+getCurrentUsername() + '/'+ (args.length > 0? args.join(' '): '');
  const spinner = ora(chalk.green('Getting stat info...\n')).start();
  try {
    const response = await fetch('https://api.puter.com/stat', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        path
      })
    }
  );
    const data = await response.json();
    if (data) {
      console.dir(data, { depth: null});
      console.log('\n');
      spinner.succeed(chalk.green('Done.'));
    } else {
      spinner.fail(chalk.red('Unable to get stat info. Please check your credentials.'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to get stat info'));
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

// TODO:
// - Implement: df
/*fetch("https://api.puter.com/df", {
  "headers": headers,
  "body": null,
  "method": "POST"
});*/
// - batch:
/*
fetch("https://api.puter.com/batch", {
  "headers": headers,
  "body": "------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"operation_id\"\r\n\r\n14ef8286-1492-4c97-a74f-3b9de8290ad6\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"socket_id\"\r\n\r\nB8R97dMkUxcJdLUaBE9Z\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"original_client_socket_id\"\r\n\r\nB8R97dMkUxcJdLUaBE9Z\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"fileinfo\"\r\n\r\n{\"name\":\"New File.txt\",\"type\":\"\",\"size\":0}\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"operation\"\r\n\r\n{\"op\":\"write\",\"dedupe_name\":true,\"overwrite\":false,\"operation_id\":\"14ef8286-1492-4c97-a74f-3b9de8290ad6\",\"path\":\"/bitsnaps/Documents/Apps/NutriExpert\",\"name\":\"New File.txt\",\"item_upload_id\":0}\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"file\"; filename=\"New File.txt\"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK--\r\n",
  "method": "POST"
});
*/


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