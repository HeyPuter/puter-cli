import fs from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import fetch from 'node-fetch';
import { API_BASE, BASE_URL, PROJECT_NAME, getHeaders } from './commons.js';
import { formatDate, formatDateTime, formatSize } from './utils.js';
import inquirer from 'inquirer';
import { getAuthToken, getCurrentDirectory, getCurrentUserName } from './auth.js';
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
        path = resolvePath(getCurrentDirectory(), path);
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

function showDiskSpaceUsage(data) {
    const freeSpace = parseInt(data.capacity) - parseInt(data.used);
    const usagePercentage = (parseInt(data.used) / parseInt(data.capacity)) * 100;
    console.log(chalk.cyan('Disk Usage Information:'));
    console.log(chalk.dim('----------------------------------------'));
    console.log(chalk.cyan(`Total Capacity: `) + chalk.white(formatSize(data.capacity)));
    console.log(chalk.cyan(`Used Space: `) + chalk.white(formatSize(data.used)));
    console.log(chalk.cyan(`Free Space: `) + chalk.white(formatSize(freeSpace)));
    // format the usagePercentage with 2 decimal floating point value:
    console.log(chalk.cyan(`Usage Percentage: `) + chalk.white(`${usagePercentage.toFixed(2)}%`));
    console.log(chalk.dim('----------------------------------------'));
    console.log(chalk.green('Done.'));
}

/**
 * Fetch disk usage information
 * @param {Object} body - Optional arguments to include in the request body.
 */
export async function getDiskUsage(body = null) {
    console.log(chalk.green('Fetching disk usage information...\n'));
    try {
        const response = await fetch(`${API_BASE}/df`, {
            method: 'POST',
            headers: getHeaders(),
            body: body ? JSON.stringify(body) : null
        });

        const data = await response.json();
        console.log(data);
        if (response.ok && data) {
            showDiskSpaceUsage(data);
        } else {
            console.error(chalk.red('Unable to fetch disk usage information.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to fetch disk usage information.\nError: ${error.message}`));
    }
}

/**
 * Create a new empty file (similar to Unix "touch" command).
 * @param {Array} args - The arguments passed to the command (file name and optional path).
 */
export async function createFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: touch <file_name> [content]'));
        return;
    }

    const fileName = args[0];
    // Extract all the other values from "args" starting from 1 to the length of args:
    const content = args.length > 1 ? args.slice(1).join(' ') : ''; // Optional content
    const path = resolvePath(getCurrentDirectory(), '.');
    const dedupeName = false; // Default: false
    const overwrite = true; // Default: true
    console.log(chalk.green(`Creating file "${fileName}" in "${path}" ${content.length > 0?`with content: '${content}'`:''}...\n`));
    try {
        // Step 1: Check if the file already exists
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: `${path}/${fileName}`
            })
        });

        if (statResponse.ok) {
            const statData = await statResponse.json();
            if (statData && statData.id) {
                if (!overwrite) {
                    console.error(chalk.red(`File "${fileName}" already exists. Use --overwrite=true to replace it.`));
                    return;
                }
                console.log(chalk.yellow(`File "${fileName}" already exists. It will be overwritten.`));
            }
        } else if (statResponse.status !== 404) {
            console.error(chalk.red('Failed to check if file exists.'));
            return;
        }

        // Step 2: Check disk space
        const dfResponse = await fetch(`${API_BASE}/df`, {
            method: 'POST',
            headers: getHeaders(),
            body: null
        });

        if (!dfResponse.ok) {
            console.error(chalk.red('Unable to check disk space.'));
            return;
        }

        const dfData = await dfResponse.json();
        if (dfData.used >= dfData.capacity) {
            console.error(chalk.red('Not enough disk space to create the file.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return;
        }

        // Step 3: Create the file using /batch
        const operationId = crypto.randomUUID(); // Generate a unique operation ID
        const socketId = 'undefined'; // Placeholder socket ID
        const boundary = `----WebKitFormBoundary${crypto.randomUUID().replace(/-/g, '')}`;
        // Prepare the file as a Blob
        const fileBlob = new Blob([content || ''], { type: 'text/plain' });
        // Prepare FormData
        const formData = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="operation_id"\r\n\r\n${operationId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="socket_id"\r\n\r\n${socketId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="original_client_socket_id"\r\n\r\n${socketId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="fileinfo"\r\n\r\n${JSON.stringify({
                name: fileName,
                type: 'text/plain',
                size: fileBlob.size
            })}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="operation"\r\n\r\n${JSON.stringify({
                op: 'write',
                dedupe_name: dedupeName,
                overwrite: overwrite,
                operation_id: operationId,
                path: path,
                name: fileName,
                item_upload_id: 0
            })}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: text/plain\r\n\r\n${content || ''}\r\n` +
            `--${boundary}--\r\n`;
        
        // Send the request
        const createResponse = await fetch(`${API_BASE}/batch`, {
            method: 'POST',
            headers: getHeaders(`multipart/form-data; boundary=${boundary}`),
            body: formData
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error(chalk.red(`Failed to create file. Server response: ${errorText}. status: ${createResponse.status}`));
            return;
        }

        const createData = await createResponse.json();
        if (createData && createData.results && createData.results.length > 0) {
            const file = createData.results[0];
            console.log(chalk.green(`File "${fileName}" created successfully!`));
            console.log(chalk.dim(`Path: ${file.path}`));
            console.log(chalk.dim(`UID: ${file.uid}`));
        } else {
            console.error(chalk.red('Failed to create file. Invalid response from server.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to create file.\nError: ${error.message}`));
    }
}

/**
 * Read and display the content of a file (similar to Unix "cat" command).
 * @param {Array} args - The arguments passed to the command (file path).
 */
export async function readFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: cat <file_path>'));
        return;
    }

    const filePath = resolvePath(getCurrentDirectory(), args[0]);
    console.log(chalk.green(`Reading file "${filePath}"...\n`));

    try {
        // Step 1: Fetch the file content
        const response = await fetch(`${API_BASE}/read?file=${encodeURIComponent(filePath)}`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            console.error(chalk.red(`Failed to read file. Server response: ${response.statusText}`));
            return;
        }

        const data = await response.text();

        // Step 2: Dispaly the content
        if (data.length) {
            console.log(chalk.cyan(data));
        } else {
            console.error(chalk.red('File is empty.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to read file.\nError: ${error.message}`));
    }
}

/**
 * Upload a file from the host machine to the Puter server (similar to FTP "put" command).
 * @param {Array} args - The arguments passed to the command (local file path, remote path, dedupe_name, overwrite).
 */
export async function uploadFile(args = []) {
    if (args.length < 2) {
        console.log(chalk.red('Usage: put <local_file_path> [<remote_path>]'));
        return;
    }

    const localFilePath = args[0];
    const remotePath = resolvePath(getCurrentDirectory(), args.length > 1 ? args[1] : '.');
    const dedupeName = true; // Default: true
    const overwrite = false; // Default: false

    console.log(chalk.green(`Uploading file "${localFilePath}" to "${remotePath}"...\n`));
    try {
        // Step 1: Read the file from the local filesystem
        const fileContent = fs.readFileSync(localFilePath, 'utf8');
        const fileName = localFilePath.split('/').pop(); // Extract the file name from the path

        // Step 2: Check disk space
        const dfResponse = await fetch(`${API_BASE}/df`, {
            method: 'POST',
            headers: getHeaders(), // Use a dummy boundary for non-multipart requests
            body: null
        });

        if (!dfResponse.ok) {
            console.error(chalk.red('Unable to check disk space.'));
            return;
        }

        const dfData = await dfResponse.json();
        if (dfData.used >= dfData.capacity) {
            console.error(chalk.red('Not enough disk space to upload the file.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return;
        }

        // Step 3: Prepare the upload request
        const operationId = crypto.randomUUID(); // Generate a unique operation ID
        const socketId = 'undefined'; // Placeholder socket ID
        const boundary = `----WebKitFormBoundary${crypto.randomUUID().replace(/-/g, '')}`;

        // Prepare FormData
        const formData = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="operation_id"\r\n\r\n${operationId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="socket_id"\r\n\r\n${socketId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="original_client_socket_id"\r\n\r\n${socketId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="fileinfo"\r\n\r\n${JSON.stringify({
                name: fileName,
                type: 'text/plain',
                size: Buffer.byteLength(fileContent, 'utf8')
            })}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="operation"\r\n\r\n${JSON.stringify({
                op: 'write',
                dedupe_name: dedupeName,
                overwrite: overwrite,
                operation_id: operationId,
                path: remotePath,
                name: fileName,
                item_upload_id: 0
            })}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: text/plain\r\n\r\n${fileContent}\r\n` +
            `--${boundary}--\r\n`;

        // Step 4: Send the upload request
        const uploadResponse = await fetch(`${API_BASE}/batch`, {
            method: 'POST',
            headers: getHeaders(`multipart/form-data; boundary=${boundary}`),
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(chalk.red(`Failed to upload file. Server response: ${errorText}`));
            return;
        }

        const uploadData = await uploadResponse.json();
        if (uploadData && uploadData.results && uploadData.results.length > 0) {
            const file = uploadData.results[0];
            console.log(chalk.green(`File "${fileName}" uploaded successfully!`));
            console.log(chalk.dim(`Path: ${file.path}`));
            console.log(chalk.dim(`UID: ${file.uid}`));
        } else {
            console.error(chalk.red('Failed to upload file. Invalid response from server.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to upload file.\nError: ${error.message}`));
    }
}

/**
 * Download a file from the Puter server to the host machine (similar to FTP "get" command).
 * @param {Array} args - The arguments passed to the command (remote file path, local path).
 */
export async function downloadFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: get <remote_file_path> [local_path]'));
        return;
    }

    const remoteFilePath = resolvePath(getCurrentDirectory(), args[0]); // Resolve the remote file path
    const localFilePath = args.length > 1 ? args[1] : remoteFilePath.split('/').pop(); // Default to the file name

    console.log(chalk.green(`Downloading file "${remoteFilePath}" to "${localFilePath}"...\n`));

    try {
        // Step 1: Fetch the anti-CSRF token
        const csrfResponse = await fetch(`${BASE_URL}/get-anticsrf-token`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!csrfResponse.ok) {
            console.error(chalk.red('Failed to fetch anti-CSRF token.'));
            return;
        }

        const csrfData = await csrfResponse.json();
        // check for token
        if (!csrfData || !csrfData.token) {
            console.error(chalk.red('Failed to fetch anti-CSRF token.'));
            return;
        }

        const antiCsrfToken = csrfData.token;

        // Step 2: Download the file using the anti-CSRF token
        const downloadResponse = await fetch(`${BASE_URL}/down?path=${encodeURIComponent(remoteFilePath)}`, {
        // const downloadResponse = await fetch(`${BASE_URL}/down?path=${remoteFilePath}`, {
            method: 'POST',
            headers: {
                ...getHeaders('application/x-www-form-urlencoded'),
                "cookie": `puter_auth_token=${getAuthToken()};`
            },
            "referrerPolicy": "strict-origin-when-cross-origin",
            body: `anti_csrf=${antiCsrfToken}`
        });

        if (!downloadResponse.ok) {
            console.error(chalk.red(`Failed to download file. Server response: ${downloadResponse.statusText}`));
            return;
        }

        // Step 3: Save the file content to the local filesystem
        const fileContent = await downloadResponse.text();
        fs.writeFileSync(localFilePath, fileContent, 'utf8');
        const fileSize = fs.statSync(localFilePath).size;
        console.log(chalk.green(`File: "${remoteFilePath}" downloaded to "${localFilePath}" (size: ${formatSize(fileSize)})`));
    } catch (error) {
        console.error(chalk.red(`Failed to download file.\nError: ${error.message}`));
    }
}