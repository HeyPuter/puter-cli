import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { API_BASE, getHeaders } from './commons.js';
import { formatDate, formatDateTime, formatSize } from './utils.js';
import Table from 'cli-table3';
import { getCurrentUserName } from './auth.js';

/**
 * List files in the current working directory.
 * @param {string} args Default current working directory
 */
export async function listFiles(args = ['/']) {
  const username = getCurrentUserName();
  const path = `/${username}/${args.join('/')}`;
  console.log(chalk.green(`Listing files in ${path}...\n`));
  try {
      const response = await fetch(`${API_BASE}/readdir`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ path })
      });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
          console.log(`Type  Name                 Size    Modified          UID`);
          console.log('---------------------------------------------------------------');
          data.forEach(file => {
              const type = file.is_dir ? 'd' : '-';
              const name = file.name.padEnd(20);
              const size = file.is_dir ? '0' : formatSize(file.size);
              const modified = formatDateTime(file.modified);
              const uid = file.uid;
              console.log(`${type}    ${name} ${size.padEnd(8)} ${modified}  ${uid}`);
          });
          console.log(chalk.green(`There are ${data.length} object(s).`));
      } else {
          console.log(chalk.red('No files or directories found.'));
      }
  } catch (error) {
      console.log(chalk.red('Failed to list files.'));
      console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Create a folder in the current working directory.
 * @param {Array} args Options
 * @returns void
 */
export async function makeDirectory(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: mkdir <directory_name> [parent_directory]'));
        return;
    }

    const username = getCurrentUserName();
    const directoryName = args[0];
    const parentDirectory = args[1] || `/${username}`; // Default to user's root directory
    const path = `${parentDirectory}/${directoryName}`;

    console.log(chalk.green(`Creating directory "${directoryName}" in "${parentDirectory}"...\n`));

    try {
        const response = await fetch(`${API_BASE}/mkdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                parent: parentDirectory,
                path: directoryName,
                overwrite: false,
                dedupe_name: true,
                create_missing_parents: false
            })
        });

        const data = await response.json();
        if (data && data.id) {
            console.log(chalk.green(`Directory "${directoryName}" created successfully!`));
            console.log(chalk.dim(`Path: ${data.path}`));
            console.log(chalk.dim(`UID: ${data.uid}`));
        } else {
            console.log(chalk.red('Failed to create directory. Please check your input.'));
        }
    } catch (error) {
        console.log(chalk.red('Failed to create directory.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

/**
 * Rename a file or directory
 * @param {Array} args Options
 * @returns void
 */
export async function renameFileOrDirectory(args = []) {
    if (args.length < 2) {
        console.log(chalk.red('Usage: rename <old_name> <new_name>'));
        return;
    }

    const username = getCurrentUserName();
    const oldName = args[0];
    const newName = args[1];

    console.log(chalk.green(`Renaming "${oldName}" to "${newName}"...\n`));

    try {
        // Step 1: Get the UID of the file/directory using the old name
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: `/${username}/${oldName}`
            })
        });

        const statData = await statResponse.json();
        if (!statData || !statData.uid) {
            console.log(chalk.red(`Could not find file or directory with name "${oldName}".`));
            return;
        }

        const uid = statData.uid;

        // Step 2: Perform the rename operation using the UID
        const renameResponse = await fetch(`${API_BASE}/rename`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                uid: uid,
                new_name: newName
            })
        });

        const renameData = await renameResponse.json();
        if (renameData && renameData.uid) {
            console.log(chalk.green(`Successfully renamed "${oldName}" to "${newName}"!`));
            console.log(chalk.dim(`Path: ${renameData.path}`));
            console.log(chalk.dim(`UID: ${renameData.uid}`));
        } else {
            console.log(chalk.red('Failed to rename item. Please check your input.'));
        }
    } catch (error) {
        console.log(chalk.red('Failed to rename item.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}