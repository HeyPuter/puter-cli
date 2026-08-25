import chalk from 'chalk';
import Conf from 'conf';
import {
  listFiles, makeDirectory, renameFileOrDirectory,
  removeFileOrDirectory, emptyTrash, changeDirectory, showCwd,
  getInfo, getDiskUsage, createFile, readFile, uploadFile,
  downloadFile, copyFile, syncDirectory, editFile
} from './commands/files.js';
import { getUserInfo, getUsageInfo, login, getCurrentDirectory } from './commands/auth.js';
import { PROJECT_NAME, API_BASE, HOME, expandHome, getHeaders } from './commons.js';
import { exec } from 'node:child_process';
import { getSystemEditor } from './utils.js';
import { rl } from './commands/shell.js';
import { showLast, report, formatError, isAuthError } from './modules/ErrorModule.js'

const config = new Conf({ projectName: PROJECT_NAME });

// History of commands
const commandHistory = [];

/**
 * Update the prompt function
 * @returns The current prompt
 */
export function getPrompt() {
  return chalk.cyan(`puter@${getCurrentDirectory().slice(1)}> `);
}

const commands = {
  help: showHelp,
  exit: () => process.exit(0),
  logout: async () => {
    await import('./commands/auth.js').then(m => m.logout());
    process.exit(0);
  },
  login: login,
  whoami: getUserInfo,
  stat: getInfo,
  history: async (args) => {
    const lineNumber = parseInt(args[0]);

    if (isNaN(lineNumber)) {
      // Display full history
      commandHistory.forEach((command, index) => {
        console.log(chalk.cyan(`${index + 1}: ${command}`));
      });
    } else {
      // Copy the command at the specified line number
      if (lineNumber < 1 || lineNumber > commandHistory.length) {
        console.error(chalk.red(`Invalid line number. History has ${commandHistory.length} entries.`));
        return;
      }

      const commandToCopy = commandHistory[lineNumber - 1];
      // Simulate typing the command in the shell
      rl.write(commandToCopy);
    }
  },
  'last-error': showLast,
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
  edit: editFile,
};

/**
 * Execute a command
 * @param {string} input The command line input
 */
export async function execCommand(input) {
  const [cmd, ...args] = input ? input.split(' ') : [];

  // Add the command to history (skip the "history" command itself)
  if (cmd !== 'history') {
    commandHistory.push(input);
  }

  if (cmd === 'help') {
    // Handle help command
    const command = args[0];
    showHelp(command);
    return;
  }
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
    return;
  }
  if (commands[cmd]) {
    try {
      await commands[cmd](args);
    } catch (error) {
      report(error);
      if (isAuthError(error)) {
        console.error(chalk.red('Your session has expired or its token is no longer valid.'));
        console.error(chalk.cyan('Type "login" to sign in again.'));
      } else {
        console.error(chalk.red(`Error executing command: ${formatError(error)}`));
      }
    }
    return;
  }

  if (!['Y', 'N'].includes(cmd.toUpperCase()[0])) {
    console.log(chalk.red(`Unknown command: ${cmd}`));
    showHelp();
  }
}

/**
 * Display help for a specific command or general help if no command is provided.
 * @param {string} [command] - The command to display help for.
 */
function showHelp(command) {
  // Consider using `program.helpInformation()` function for global "help" command...
  const commandHelp = {
    help: `
      ${chalk.cyan('help [command]')}
      Display help for a specific command or show general help.
      Example: help ls
    `,
    exit: `
      ${chalk.cyan('exit')}
      Exit the shell.
    `,
    logout: `
      ${chalk.cyan('logout')}
      Logout from Puter account.
    `,
    whoami: `
      ${chalk.cyan('whoami')}
      Show user information.
    `,
    stat: `
      ${chalk.cyan('stat <path>')}
      Show file or directory information.
      Example: stat /path/to/file
    `,
    df: `
      ${chalk.cyan('df')}
      Show disk usage information.
    `,
    usage: `
      ${chalk.cyan('usage')}
      Show usage information.
    `,
    ls: `
      ${chalk.cyan('ls [dir]')}
      List files and directories.
      Example: ls /path/to/dir
    `,
    cd: `
      ${chalk.cyan('cd [dir]')}
      Change the current working directory.
      Example: cd /path/to/dir
    `,
    pwd: `
      ${chalk.cyan('pwd')}
      Print the current working directory.
    `,
    mkdir: `
      ${chalk.cyan('mkdir <dir>')}
      Create a new directory.
      Example: mkdir /path/to/newdir
    `,
    mv: `
      ${chalk.cyan('mv <src> <dest>')}
      Move or rename a file or directory.
      Example: mv /path/to/src /path/to/dest
    `,
    rm: `
      ${chalk.cyan('rm <file>')}
      Move a file or directory to the system's Trash.
      Example: rm /path/to/file
    `,
    clean: `
      ${chalk.cyan('clean')}
      Empty the system's Trash.
    `,
    cp: `
      ${chalk.cyan('cp <src> <dest>')}
      Copy files or directories.
      Example: cp /path/to/src /path/to/dest
    `,
    touch: `
      ${chalk.cyan('touch <file>')}
      Create a new empty file.
      Example: touch /path/to/file
    `,
    cat: `
      ${chalk.cyan('cat <file>')}
      Output file content to the console.
      Example: cat /path/to/file
    `,
    push: `
      ${chalk.cyan('push <file>')}
      Upload file to Puter cloud.
      Example: push /path/to/file
    `,
    pull: `
      ${chalk.cyan('pull <file>')}
      Download file from Puter cloud.
      Example: pull /path/to/file
    `,
    update: `
      ${chalk.cyan('update <src> <dest> [--delete] [-r]')}
      Sync local directory with remote cloud.
      Example: update /local/path /remote/path
    `,
    edit: `
      ${chalk.cyan('edit <file>')}
      Edit a remote file using your local text editor.
      Example: edit /path/to/file

      System editor: ${chalk.green(getSystemEditor())}
    `,
    '!': `
      ${chalk.cyan('!<command>')}
      Execute a command on the host machine.
      Example: !ls -la
    `,
    'history [line]': `
      ${chalk.cyan('history [line]')}
      Display history of commands or copy command by line number
      Example: history 2
    `,
  };

  if (command && commandHelp[command]) {
    console.log(chalk.yellow(`\nHelp for command: ${chalk.cyan(command)}`));
    console.log(commandHelp[command]);
  } else if (command) {
    console.log(chalk.red(`Unknown command: ${command}`));
    console.log(chalk.yellow('Use "help" to see a list of available commands.'));
  } else {
    console.log(chalk.yellow('\nAvailable commands:'));
    for (const cmd in commandHelp) {
      console.log(chalk.cyan(cmd.padEnd(20)) + '- ' + commandHelp[cmd].split('\n')[2].trim());
    }
    console.log(chalk.yellow('\nUse "help <command>" for detailed help on a specific command.'));
  }
}