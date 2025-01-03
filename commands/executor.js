import chalk from 'chalk';
import { promises as fs } from 'fs';
import ora from 'ora';
import Conf from 'conf';
import path from 'path';
import { formatDate } from './utils.js';
import { listApps } from './apps.js';
import { getCurrentUserName } from './auth.js';

const config = new Conf({ projectName: 'puter-cli' });

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
  ls: listFiles,
  mkdir: makeDirectory,
  rm: removeFile,
  cp: copyFile,
  touch: touchFile,
  put: uploadFile,
  get: downloadFile,
  update: syncDirectory,
};

export async function execCommand(input) {
  const [cmd, ...args] = input.split(' ');
  
  if (commands[cmd]) {
    try {
      await commands[cmd](args);
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error.message}`));
    }
  } else {
    console.log(chalk.red(`Unknown command: ${cmd}`));
    showHelp();
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
  ${chalk.cyan('ls')}       List files and directories
  ${chalk.cyan('mkdir')}    Create a new directory
  ${chalk.cyan('rm')}       Remove a file or directory
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

// Placeholder functions for file operations
// These will be implemented with actual Puter SDK integration
async function listFiles(args = ['/']) {
  const path = '/'+config.get('username') + '/'+ (args.length > 0? args.join(' '): '');
  const spinner = ora(chalk.green(`Listing files in ${path}...\n`)).start();
  try {
    const response = await fetch('https://api.puter.com/readdir', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        path
      })
    }
  );
    const data = await response.json();
    console.log(`Permissions\t|Size\t|UID\t|Created\t|Name`);
    console.log('---------------------------------------------------------------------');
    if (data && data.length > 0) {
      for (const file of data){
        console.log(`${file.is_dir?'d':'-'}${file.writable?'w':'-'}\t|${file.size?file.size:'-'}\t|${file.uid}\t|${file.created}\t|${file.name}`);
      }
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
  "headers": {
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoic2Vzc2lvbiIsInZlcnNpb24iOiIwLjAuMCIsInV1aWQiOiIzNzJhMDExMC1kMTZjLTQyYTAtYjIxYy1mNTFiOWUzNzFkNzMiLCJtZXRhIjp7ImZyb21fdXBncmFkZSI6dHJ1ZSwiaXAiOiI6OmZmZmY6MTI3LjAuMC4xIiwic2VydmVyIjoiZnJhbmtmdXJ0IiwidXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMTYuMC4wLjAgU2FmYXJpLzUzNy4zNiIsInJlZmVyZXIiOiJodHRwczovL3B1dGVyLmNvbS8iLCJvcmlnaW4iOiJodHRwczovL3B1dGVyLmNvbSIsImNyZWF0ZWQiOiIyMDI0LTA0LTEzVDExOjQ0OjM1LjA5NFoiLCJjcmVhdGVkX3VuaXgiOjE3MTMwMDg2NzV9LCJ1c2VyX3VpZCI6ImUzMWRiMDczLWZiNDEtNGYxZC1hNDM2LThlNzhjYjJjMzI0MCIsImlhdCI6MTcxMzAwODY3NX0.MhE0YCdWQ144fFoe6ug9pzFmEuqigKn23tX7sUiPhFo",
    "content-type": "application/json;charset=UTF-8",
    "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "Referer": "https://puter.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": null,
  "method": "POST"
});*/
// - batch:
/*
fetch("https://api.puter.com/batch", {
  "headers": {
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoic2Vzc2lvbiIsInZlcnNpb24iOiIwLjAuMCIsInV1aWQiOiIzNzJhMDExMC1kMTZjLTQyYTAtYjIxYy1mNTFiOWUzNzFkNzMiLCJtZXRhIjp7ImZyb21fdXBncmFkZSI6dHJ1ZSwiaXAiOiI6OmZmZmY6MTI3LjAuMC4xIiwic2VydmVyIjoiZnJhbmtmdXJ0IiwidXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMTYuMC4wLjAgU2FmYXJpLzUzNy4zNiIsInJlZmVyZXIiOiJodHRwczovL3B1dGVyLmNvbS8iLCJvcmlnaW4iOiJodHRwczovL3B1dGVyLmNvbSIsImNyZWF0ZWQiOiIyMDI0LTA0LTEzVDExOjQ0OjM1LjA5NFoiLCJjcmVhdGVkX3VuaXgiOjE3MTMwMDg2NzV9LCJ1c2VyX3VpZCI6ImUzMWRiMDczLWZiNDEtNGYxZC1hNDM2LThlNzhjYjJjMzI0MCIsImlhdCI6MTcxMzAwODY3NX0.MhE0YCdWQ144fFoe6ug9pzFmEuqigKn23tX7sUiPhFo",
    "content-type": "multipart/form-data; boundary=----WebKitFormBoundary9qbZOtGMqNWdo0HK",
    "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "Referer": "https://puter.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": "------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"operation_id\"\r\n\r\n14ef8286-1492-4c97-a74f-3b9de8290ad6\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"socket_id\"\r\n\r\nB8R97dMkUxcJdLUaBE9Z\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"original_client_socket_id\"\r\n\r\nB8R97dMkUxcJdLUaBE9Z\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"fileinfo\"\r\n\r\n{\"name\":\"New File.txt\",\"type\":\"\",\"size\":0}\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"operation\"\r\n\r\n{\"op\":\"write\",\"dedupe_name\":true,\"overwrite\":false,\"operation_id\":\"14ef8286-1492-4c97-a74f-3b9de8290ad6\",\"path\":\"/bitsnaps/Documents/Apps/NutriExpert\",\"name\":\"New File.txt\",\"item_upload_id\":0}\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK\r\nContent-Disposition: form-data; name=\"file\"; filename=\"New File.txt\"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n------WebKitFormBoundary9qbZOtGMqNWdo0HK--\r\n",
  "method": "POST"
});
*/
// Implement: rename
/*
fetch("https://api.puter.com/rename", {
  "headers": {
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoic2Vzc2lvbiIsInZlcnNpb24iOiIwLjAuMCIsInV1aWQiOiIzNzJhMDExMC1kMTZjLTQyYTAtYjIxYy1mNTFiOWUzNzFkNzMiLCJtZXRhIjp7ImZyb21fdXBncmFkZSI6dHJ1ZSwiaXAiOiI6OmZmZmY6MTI3LjAuMC4xIiwic2VydmVyIjoiZnJhbmtmdXJ0IiwidXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMTYuMC4wLjAgU2FmYXJpLzUzNy4zNiIsInJlZmVyZXIiOiJodHRwczovL3B1dGVyLmNvbS8iLCJvcmlnaW4iOiJodHRwczovL3B1dGVyLmNvbSIsImNyZWF0ZWQiOiIyMDI0LTA0LTEzVDExOjQ0OjM1LjA5NFoiLCJjcmVhdGVkX3VuaXgiOjE3MTMwMDg2NzV9LCJ1c2VyX3VpZCI6ImUzMWRiMDczLWZiNDEtNGYxZC1hNDM2LThlNzhjYjJjMzI0MCIsImlhdCI6MTcxMzAwODY3NX0.MhE0YCdWQ144fFoe6ug9pzFmEuqigKn23tX7sUiPhFo",
    "content-type": "application/json;charset=UTF-8",
    "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "Referer": "https://puter.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": "{\"original_client_socket_id\":\"ZZEfohhwRCBPCHtBBKPc\",\"new_name\":\"test.txt\",\"uid\":\"f372ebad-f626-4d88-857e-900f483291a5\"}",
  "method": "POST"
});
*/
async function makeDirectory(args) {
    const dirName = args[0];
    if (!args.length || !dirName.length) {
        throw new Error('Directory name is required');
    }
  
    console.log(`Creating directory: ${dirName}...`);
    // Create project directory
    await fs.mkdir(dirName, { recursive: true });
}

async function removeFile(args) {
    const pathName = args[0];
    if (!args.length || !pathName.length) {
        throw new Error('File/directory name is required');
    }
    console.log(`Removing: ${pathName}...`);
    // Delete a directory
    await fs.rmdir(pathName);
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