import chalk from 'chalk';
import { promises as fs } from 'fs';

const commands = {
  help: showHelp,
  exit: () => process.exit(0),
  logout: async () => {
    await import('./auth.js').then(m => m.logout());
    process.exit(0);
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
    await commands[cmd](args);
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

// Placeholder functions for file operations
// These will be implemented with actual Puter SDK integration
async function listFiles(args) {
  console.log('Listing files...');
}

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