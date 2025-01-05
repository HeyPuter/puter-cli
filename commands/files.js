import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import fetch from 'node-fetch';
import { API_BASE, PROJECT_NAME, getHeaders } from './commons.js';
import { formatDate, formatDateTime, formatSize } from './utils.js';
import inquirer from 'inquirer';
import { getCurrentDirectory, getCurrentUserName } from './auth.js';
import { updatePrompt } from './shell.js';

const config = new Conf({ projectName: PROJECT_NAME });

/**
 * List files in the current working directory.
 * @param {string} args Default current working directory
 */
export async function listFiles(args = []) {
  const names = args.length > 0 ? args : ['.'];
  for (let path of names)
    try {
        path = `${getCurrentDirectory()}/${path}`
        console.log(chalk.green(`Listing files in ${path}:\n`));
        const response = await fetch(`${API_BASE}/readdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path })
        });
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            console.log(chalk.cyan(`Type  Name                 Size    Modified          UID`));
            console.log(chalk.dim('----------------------------------------------------------------------------------'));
            data.forEach(file => {
                const type = file.is_dir ? 'd' : '-';
                const write = file.writable ? 'w' : '-';
                const name = file.name.padEnd(20);
                const size = file.is_dir ? '0' : formatSize(file.size);
                const modified = formatDateTime(file.modified);
                const uid = file.uid;
                console.log(`${type}${write}   ${name} ${size.padEnd(8)} ${modified}  ${uid}`);
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

    const directoryName = args[0];
    console.log(chalk.green(`Creating directory "${directoryName}" in "${getCurrentDirectory()}"...\n`));

    try {
        const response = await fetch(`${API_BASE}/mkdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                parent: getCurrentDirectory(),
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
        console.log(chalk.red('Usage: mv <old_name> <new_name>'));
        return;
    }

    const currentPath = getCurrentDirectory();
    const oldName = args[0];
    const newName = args[1];

    console.log(chalk.green(`Renaming "${oldName}" to "${newName}"...\n`));

    try {
        // Step 1: Get the UID of the file/directory using the old name
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: `${currentPath}/${oldName}`
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

/**
 * Move a file/directory to the Trash
 * @param {Array} args Options:
 * -f: Force delete (no confirmation)
 * @returns void
 */
export async function removeFileOrDirectory(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: rm <name> [-f]'));
        return;
    }

    // const username = getCurrentUserName();
    const skipConfirmation = args.includes('-f'); // Check the flag if provided
    const names = skipConfirmation? args.filter(option => option != '-f'):args;

    for (const name of names)
        try {
            console.log(chalk.green(`Preparing to remove "${name}"...\n`));
            // Step 1: Get the UID of the file/directory using the name
            const statResponse = await fetch(`${API_BASE}/stat`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    path: `${getCurrentDirectory()}/${name}`
                })
            });

            const statData = await statResponse.json();
            if (!statData || !statData.uid) {
                console.log(chalk.red(`Could not find file or directory with name "${name}".`));
                return;
            }

            const uid = statData.uid;
            const originalPath = statData.path;

            // Step 2: Prompt for confirmation (unless -f flag is provided)
            if (!skipConfirmation) {
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Are you sure you want to move "${name}" to Trash?`,
                        default: false
                    }
                ]);

                if (!confirm) {
                    console.log(chalk.yellow('Operation canceled.'));
                    return;
                }
            }

            // Step 3: Perform the move operation to Trash
            const moveResponse = await fetch(`${API_BASE}/move`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    source: uid,
                    destination: `/${getCurrentUserName()}/Trash`,
                    overwrite: false,
                    new_name: uid, // Use the UID as the new name in Trash
                    create_missing_parents: false,
                    new_metadata: {
                        original_name: name,
                        original_path: originalPath,
                        trashed_ts: Math.floor(Date.now() / 1000) // Current timestamp
                    }
                })
            });

            const moveData = await moveResponse.json();
            if (moveData && moveData.moved) {
                console.log(chalk.green(`Successfully moved "${name}" to Trash!`));
                console.log(chalk.dim(`Moved to: ${moveData.moved.path}`));
                // console.log(chalk.dim(`UID: ${moveData.moved.uid}`));
            } else {
                console.log(chalk.red('Failed to move item to Trash. Please check your input.'));
            }
        } catch (error) {
            console.log(chalk.red('Failed to remove item.'));
            console.error(chalk.red(`Error: ${error.message}`));
        }
}

/**
 * Delete a folder and its contents (PREVENTED BY PUTER API)
 * @param {string} folderPath - The path of the folder to delete (defaults to Trash).
 * @param {boolean} skipConfirmation - Whether to skip the confirmation prompt.
 */
export async function deleteFolder(folderPath, skipConfirmation = false) {
    console.log(chalk.green(`Preparing to delete "${folderPath}"...\n`));

    try {
        // Step 1: Prompt for confirmation (unless skipConfirmation is true)
        if (!skipConfirmation) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to delete all contents of "${folderPath}"?`,
                    default: false
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('Operation canceled.'));
                return;
            }
        }

        // Step 2: Perform the delete operation
        const deleteResponse = await fetch(`${API_BASE}/delete`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                paths: [folderPath],
                descendants_only: true, // Delete only the contents, not the folder itself
                recursive: true // Delete all subdirectories and files
            })
        });

        const deleteData = await deleteResponse.json();
        if (deleteResponse.ok) {
            console.log(chalk.green(`Successfully deleted all contents of "${folderPath}"!`));
        } else {
            console.log(chalk.red('Failed to delete folder. Please check your input.'));
        }
    } catch (error) {
        console.log(chalk.red('Failed to delete folder.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

/**
 * Empty the Trash (wrapper for deleteFolder).
 * @param {boolean} skipConfirmation - Whether to skip the confirmation prompt.
 */
export async function emptyTrash(skipConfirmation = true) {
    const trashPath = `/${getCurrentUserName()}/Trash`;
    await deleteFolder(trashPath, skipConfirmation);
}

/**
 * Show statistical information about the current working directory.
 * @param {Array} args array of path names
 */
export async function getInfo(args = []) {
    const names = args.length > 0 ? args : ['.'];
    for (let name of names)
        try {
            name = `${getCurrentDirectory()}/${name}`;
            console.log(chalk.green(`Getting stat info for: "${name}"...\n`));
            const response = await fetch(`${API_BASE}/stat`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    path: name
                })
            });
            const data = await response.json();
            if (response.ok && data) {
                console.log(chalk.cyan('File/Directory Information:'));
                console.log(chalk.dim('----------------------------------------'));
                console.log(chalk.cyan(`Name: `) + chalk.white(data.name));
                console.log(chalk.cyan(`Path: `) + chalk.white(data.path));
                console.log(chalk.cyan(`Type: `) + chalk.white(data.is_dir ? 'Directory' : 'File'));
                console.log(chalk.cyan(`Size: `) + chalk.white(data.size ? formatSize(data.size) : 'N/A'));
                console.log(chalk.cyan(`Created: `) + chalk.white(new Date(data.created * 1000).toLocaleString()));
                console.log(chalk.cyan(`Modified: `) + chalk.white(new Date(data.modified * 1000).toLocaleString()));
                console.log(chalk.cyan(`Writable: `) + chalk.white(data.writable ? 'Yes' : 'No'));
                console.log(chalk.cyan(`Owner: `) + chalk.white(data.owner.username));
                console.log(chalk.dim('----------------------------------------'));
                console.log(chalk.green('Done.'));
            } else {
                console.error(chalk.red('Unable to get stat info. Please check your credentials.'));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to get stat info.\nError: ${error.message}`));
        }
}

/**
 * Show the current working directory
 */
export async function showCwd() {
    console.log(chalk.green(`${config.get('cwd')}`));
}

/**
 * Change the current working directory
 * @param {Array} args - The path arguments
 * @returns void
 */
export async function changeDirectory(args) {
    let currentPath = config.get('cwd');

    // If no arguments, print the current directory
    if (!args.length) {
        console.log(chalk.green(currentPath));
        return;
    }

    const path = args[0];
    // Handle ".." and deeper navigation
    const newPath = resolvePath(currentPath, path);
    try {
        // Check if the new path is a valid directory
        const response = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: newPath
            })
        });

        const data = await response.json();
        if (response.ok && data && data.is_dir) {
            // Update the newPath to use the correct name from the response
            const arrayDirs = newPath.split('/');
            arrayDirs.pop();
            arrayDirs.push(data.name);
            updatePrompt(arrayDirs.join('/')); // Update the shell prompt
        } else {
            console.log(chalk.red(`"${newPath}" is not a directory`));
        }
    } catch (error) {
        console.log(chalk.red(`Cannot access "${newPath}": ${error.message}`));
    }
}

/**
 * Resolve a relative path to an absolute path
 * @param {string} currentPath - The current working directory
 * @param {string} relativePath - The relative path to resolve
 * @returns {string} The resolved absolute path
 */
function resolvePath(currentPath, relativePath) {
    // Normalize the current path (remove trailing slashes)
    currentPath = currentPath.replace(/\/+$/, '');

    // Split the relative path into parts
    const parts = relativePath.split('/').filter(p => p); // Remove empty parts

    // Handle each part of the relative path
    for (const part of parts) {
        if (part === '..') {
            // Move one level up
            const currentParts = currentPath.split('/').filter(p => p);
            if (currentParts.length > 0) {
                currentParts.pop(); // Remove the last part
            }
            currentPath = '/' + currentParts.join('/');
        } else if (part === '.') {
            // Stay in the current directory (no change)
            continue;
        } else {
            // Move into a subdirectory
            currentPath += `/${part}`;
        }
    }

    // Normalize the final path (remove duplicate slashes)
    currentPath = currentPath.replace(/\/+/g, '/');

    // Ensure the path ends with a slash if it's the root
    if (currentPath === '') {
        currentPath = '/';
    }

    return currentPath;
}