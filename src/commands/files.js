import fs from 'node:fs';
import { glob } from 'glob';
import path from 'path';
import { minimatch } from 'minimatch';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import fetch from 'node-fetch';
import { API_BASE, BASE_URL, PROJECT_NAME, getHeaders, showDiskSpaceUsage, resolvePath } from '../commons.js';
import { formatDate, formatDateTime, formatSize } from '../utils.js';
import inquirer from 'inquirer';
import { getAuthToken, getCurrentDirectory, getCurrentUserName } from './auth.js';
import { updatePrompt } from './shell.js';
import crypto from '../crypto.js';

const config = new Conf({ projectName: PROJECT_NAME });


/**
 * List files in given path
 * @param {string} path Path to the file or directory
 * @returns List of files found
 */
export async function listRemoteFiles(path) {
    const response = await fetch(`${API_BASE}/readdir`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ path })
    });
    return await response.json();
}

/**
 * List files in the current working directory.
 * @param {string} args Default current working directory
 */
export async function listFiles(args = []) {
  const names = args.length > 0 ? args : ['.'];
  for (let path of names)
    try {
        if (!path.startsWith('/')){
            path =  resolvePath(getCurrentDirectory(), path);
        }
        if (!(await pathExists(path))){
            console.log(chalk.yellow(`Directory ${chalk.red(path)} doesn't exists!`));
            continue;
        }
        console.log(chalk.green(`Listing files in ${chalk.dim(path)}:\n`));
        const files = await listRemoteFiles(path);
        if (Array.isArray(files) && files.length > 0) {
            console.log(chalk.cyan(`Type  Name                 Size    Modified          UID`));
            console.log(chalk.dim('----------------------------------------------------------------------------------'));
            files.forEach(file => {
                const type = file.is_dir ? 'd' : '-';
                const write = file.writable ? 'w' : '-';
                const name = file.name.padEnd(20);
                const size = file.is_dir ? '0' : formatSize(file.size);
                const modified = formatDateTime(file.modified);
                const uid = file.uid;
                console.log(`${type}${write}   ${name} ${size.padEnd(8)} ${modified}  ${uid}`);
            });
            console.log(chalk.green(`There are ${files.length} object(s).`));
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
        console.log(chalk.red('Usage: mkdir <directory_name>'));
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
 * Helper function to recursively find files matching the pattern
 * @param {Array} files List of files
 * @param {string} pattern The pattern to find
 * @param {string} basePath the base path
 * @returns array of matching files
 */
async function findMatchingFiles(files, pattern, basePath) {
    const matchedPaths = [];

    for (const file of files) {
        const filePath = path.join(basePath, file.name);

        // Check if the current file/directory matches the pattern
        if (minimatch(filePath, pattern, { dot: true })) {
            matchedPaths.push(filePath);
        }

        // If it's a directory, recursively search its contents
        if (file.is_dir) {
            const dirResponse = await fetch(`${API_BASE}/readdir`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ path: filePath })
            });

            if (dirResponse.ok) {
                const dirFiles = await dirResponse.json();
                const dirMatches = await findMatchingFiles(dirFiles, pattern, filePath);
                matchedPaths.push(...dirMatches);
            }
        }
    }

    return matchedPaths;
}


/**
 * Find files matching the pattern in the local directory (DEPRECATED: Not used)
 * @param {string} localDir - Local directory path.
 * @param {string} pattern - File pattern (e.g., "*.html", "myapp/*").
 * @returns {Array} - Array of file objects with local and relative paths.
 */
function findLocalMatchingFiles(localDir, pattern) {
    const files = [];
    const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath); // Recursively traverse directories
            } else if (minimatch(fullPath, path.join(localDir, pattern), { dot: true })) {
                files.push({
                    localPath: fullPath,
                    relativePath: path.relative(localDir, fullPath)
                });
            }
        }
    };

    walkDir(localDir);
    return files;
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

    const skipConfirmation = args.includes('-f'); // Check the flag if provided
    const names = skipConfirmation ? args.filter(option => option !== '-f') : args;

    try {
        // Step 1: Fetch the list of files and directories from the server
        const listResponse = await fetch(`${API_BASE}/readdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: getCurrentDirectory() })
        });

        if (!listResponse.ok) {
            console.error(chalk.red('Failed to list files from the server.'));
            return;
        }

        const files = await listResponse.json();
        if (!Array.isArray(files) || files.length == 0) {
            console.error(chalk.red('No files or directories found on the server.'));
            return;
        }

        // Step 2: Find all files/directories matching the provided patterns
        const matchedPaths = [];
        for (const name of names) {
            if (name.startsWith('/')){
                const pattern = resolvePath('/', name);
                matchedPaths.push(pattern);
                continue;
            }
            const pattern = resolvePath(getCurrentDirectory(), name);
            const matches = await findMatchingFiles(files, pattern, getCurrentDirectory());
            matchedPaths.push(...matches);
        }

        if (matchedPaths.length === 0) {
            console.error(chalk.red('No files or directories found matching the pattern.'));
            return;
        }

        // Step 3: Prompt for confirmation (unless -f flag is provided)
        if (!skipConfirmation) {
            console.log(chalk.yellow(`The following items will be moved to Trash:`));
            console.log(chalk.cyan('Hint: Execute "clean" to empty the Trash.'));
            matchedPaths.forEach(path => console.log(chalk.dim(`- ${path}`)));

            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to move these ${matchedPaths.length} item(s) to Trash?`,
                    default: false
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('Operation canceled.'));
                return;
            }
        }

        // Step 4: Move each matched file/directory to Trash
        for (const path of matchedPaths) {
            try {
                console.log(chalk.green(`Preparing to remove "${path}"...`));

                // Step 4.1: Get the UID of the file/directory
                const statResponse = await fetch(`${API_BASE}/stat`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ path })
                });

                const statData = await statResponse.json();
                if (!statData || !statData.uid) {
                    console.error(chalk.red(`Could not find file or directory with path "${path}".`));
                    continue;
                }

                const uid = statData.uid;
                const originalPath = statData.path;

                // Step 4.2: Perform the move operation to Trash
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
                            original_name: path.split('/').pop(),
                            original_path: originalPath,
                            trashed_ts: Math.floor(Date.now() / 1000) // Current timestamp
                        }
                    })
                });

                const moveData = await moveResponse.json();
                if (moveData && moveData.moved) {
                    console.log(chalk.green(`Successfully moved "${path}" to Trash!`));
                    console.log(chalk.dim(`Moved to: ${moveData.moved.path}`));
                } else {
                    console.error(chalk.red(`Failed to move "${path}" to Trash.`));
                }
            } catch (error) {
                console.error(chalk.red(`Failed to remove "${path}".`));
                console.error(chalk.red(`Error: ${error.message}`));
            }
        }
    } catch (error) {
        console.error(chalk.red('Failed to remove items.'));
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
    // Handle "/","~",".." and deeper navigation
    const newPath = path.startsWith('/')? path: (path === '~'? `/${getCurrentUserName()}` :resolvePath(currentPath, path));
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
 * Check if a path exists
 * @param {string} filePath List of files/directories
 */
export async function pathExists(filePath) {
    if (filePath.length < 1) {
        console.log(chalk.red('No path provided.'));
        return false;
    }
    try {
        // Step 1: Check if the file already exists
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: filePath
            })
        });

        return statResponse.ok;
    } catch (error){
        console.error(chalk.red('Failed to check if file exists.'));
            return false;
    }    
}

/**
 * Create a new file (similar to Unix "touch" command).
 * @param {Array} args - The arguments passed to the command (file name and optional content).
 * @returns {boolean} - True if the file was created successfully, false otherwise.
 */
export async function createFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: touch <file_name> [content]'));
        return false;
    }

    const filePath = args[0]; // File path (e.g., "app/index.html")
    const content = args.length > 1 ? args.slice(1).join(' ') : ''; // Optional content
    let fullPath = filePath;
    if (!filePath.startsWith(`/${getCurrentUserName()}/`)){
        fullPath = resolvePath(getCurrentDirectory(), filePath); // Resolve the full path
    }
    const dirName = path.dirname(fullPath); // Extract the directory name
    const fileName = path.basename(fullPath); // Extract the file name
    const dedupeName = false; // Default: false
    const overwrite = true; // Default: true

    console.log(chalk.green(`Creating file:\nFileName: "${chalk.dim(fileName)}"\nPath: "${chalk.dim(dirName)}"\nContent Length: ${chalk.dim(content.length)}`));
    try {
        // Step 1: Check if the file already exists
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: fullPath
            })
        });

        if (statResponse.ok) {
            const statData = await statResponse.json();
            if (statData && statData.id) {
                if (!overwrite) {
                    console.error(chalk.red(`File "${filePath}" already exists. Use --overwrite=true to replace it.`));
                    return false;
                }
                console.log(chalk.yellow(`File "${filePath}" already exists. It will be overwritten.`));
            }
        } else if (statResponse.status !== 404) {
            console.error(chalk.red('Failed to check if file exists.'));
            return false;
        }

        // Step 2: Check disk space
        const dfResponse = await fetch(`${API_BASE}/df`, {
            method: 'POST',
            headers: getHeaders(),
            body: null
        });

        if (!dfResponse.ok) {
            console.error(chalk.red('Unable to check disk space.'));
            return false;
        }

        const dfData = await dfResponse.json();
        if (dfData.used >= dfData.capacity) {
            console.error(chalk.red('Not enough disk space to create the file.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return false;
        }

        // Step 3: Create the nested directories if they don't exist
        const dirStatResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: dirName
            })
        });

        if (!dirStatResponse.ok || dirStatResponse.status === 404) {
            // Create the directory if it doesn't exist
            await fetch(`${API_BASE}/mkdir`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    parent: path.dirname(dirName),
                    path: path.basename(dirName),
                    overwrite: false,
                    dedupe_name: true,
                    create_missing_parents: true
                })
            });
        }

        // Step 4: Create the file using /batch
        const operationId = crypto.randomUUID(); // Generate a unique operation ID
        const socketId = 'undefined'; // Placeholder socket ID
        const boundary = `----WebKitFormBoundary${crypto.randomUUID().replace(/-/g, '')}`;
        const fileBlob = new Blob([content || ''], { type: 'text/plain' });

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
                path: dirName,
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
            return false;
        }

        const createData = await createResponse.json();
        if (createData && createData.results && createData.results.length > 0) {
            const file = createData.results[0];
            console.log(chalk.green(`File "${filePath}" created successfully!`));
            console.log(chalk.dim(`Path: ${file.path}`));
            console.log(chalk.dim(`UID: ${file.uid}`));
        } else {
            console.error(chalk.red('Failed to create file. Invalid response from server.'));
            return false;
        }
    } catch (error) {
        console.error(chalk.red(`Failed to create file.\nError: ${error.message}`));
        return false;
    }
    return true;
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
 * Upload a file from the host machine to the Puter server
 * @param {Array} args - The arguments passed to the command: (<local_path> [remote_path] [dedupe_name] [overwrite])
 */
export async function uploadFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: push <local_path> [remote_path] [dedupe_name] [overwrite]'));
        return;
    }

    const localPath = args[0];
    let remotePath = '';
    if (args.length > 1){
        remotePath = args[1].startsWith('/')? args[1]: resolvePath(getCurrentDirectory(), args[1]);
    } else {
        remotePath = resolvePath(getCurrentDirectory(), '.');
    }
    const dedupeName = args.length > 2 ? args[2] === 'true' : true; // Default: true
    const overwrite = args.length > 3 ? args[3] === 'true' : false; // Default: false

    console.log(chalk.green(`Uploading files from "${localPath}" to "${remotePath}"...\n`));
    try {
        // Step 1: Find all matching files (excluding hidden files)
        const files = glob.sync(localPath, { nodir: true, dot: false });

        if (files.length === 0) {
            console.error(chalk.red('No files found to upload.'));
            return;
        }

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
            console.error(chalk.red('Not enough disk space to upload the files.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return;
        }

        // Step 3: Upload each file
        for (const filePath of files) {
            const fileName = path.basename(filePath);
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Prepare the upload request
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

            // Send the upload request
            const uploadResponse = await fetch(`${API_BASE}/batch`, {
                method: 'POST',
                headers: getHeaders(`multipart/form-data; boundary=${boundary}`),
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error(chalk.red(`Failed to upload file "${fileName}". Server response: ${errorText}`));
                continue;
            }

            const uploadData = await uploadResponse.json();
            if (uploadData && uploadData.results && uploadData.results.length > 0) {
                const file = uploadData.results[0];
                console.log(chalk.green(`File "${fileName}" uploaded successfully!`));
                console.log(chalk.dim(`Path: ${file.path}`));
                console.log(chalk.dim(`UID: ${file.uid}`));
            } else {
                console.error(chalk.red(`Failed to upload file "${fileName}". Invalid response from server.`));
            }
        }
    } catch (error) {
        console.error(chalk.red(`Failed to upload files.\nError: ${error.message}`));
    }
}

/**
 * Get a temporary CSRF Token
 * @returns The CSRF token
 */
async function getCsrfToken() {
    const csrfResponse = await fetch(`${BASE_URL}/get-anticsrf-token`, {
        method: 'GET',
        headers: getHeaders()
    });

    if (!csrfResponse.ok) {
        console.error(chalk.red('Failed to fetch CSRF token.'));
        return;
    }

    const csrfData = await csrfResponse.json();
    if (!csrfData || !csrfData.token) {
        console.error(chalk.red('Failed to fetch anti-CSRF token.'));
        return;
    }

    return csrfData.token;
}

/**
 * Download a file from the Puter server to the host machine 
 * @param {Array} args - The arguments passed to the command (remote file path, Optional: local path).
 */
export async function downloadFile(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: pull <remote_file_path> [local_path] [overwrite]'));
        return;
    }

    const remotePathPattern = resolvePath(getCurrentDirectory(), args[0]); // Resolve the remote file path pattern
    const localBasePath = path.dirname(args.length > 1 ? args[1] : '.'); // Default to the current directory
    const overwrite = args.length > 2 ? args[2] === 'true' : false; // Default: false

    console.log(chalk.green(`Downloading files matching "${remotePathPattern}" to "${localBasePath}"...\n`));

    try {
        // Step 1: Fetch the list of files and directories from the server
        const listResponse = await fetch(`${API_BASE}/readdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: getCurrentDirectory() })
        });

        if (!listResponse.ok) {
            console.error(chalk.red('Failed to list files from the server.'));
            return;
        }

        const files = await listResponse.json();
        if (!Array.isArray(files) || files.length === 0) {
            console.error(chalk.red('No files or directories found on the server.'));
            return;
        }

        // Step 2: Recursively find files matching the pattern
        const matchedFiles = await findMatchingFiles(files, remotePathPattern, getCurrentDirectory());

        if (matchedFiles.length === 0) {
            console.error(chalk.red('No files found matching the pattern.'));
            return;
        }

        // Step 3: Download each matched file
        for (const remoteFilePath of matchedFiles) {
            const relativePath = path.relative(getCurrentDirectory(), remoteFilePath);
            const localFilePath = path.join(localBasePath, relativePath);

            // Ensure the local directory exists
            if (!fs.existsSync(path.dirname(localFilePath))){
                fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
            }

            console.log(chalk.green(`Downloading file "${remoteFilePath}" to "${localFilePath}"...`));

                    // Fetch the anti-CSRF token
            const antiCsrfToken = await getCsrfToken();

            const downloadResponse = await fetch(`${BASE_URL}/down?path=${remoteFilePath}`, {
                method: 'POST',
                headers: {
                    ...getHeaders('application/x-www-form-urlencoded'),
                    "cookie": `puter_auth_token=${getAuthToken()};`
                },
                "referrerPolicy": "strict-origin-when-cross-origin",
                body: `anti_csrf=${antiCsrfToken}`
            });

            if (!downloadResponse.ok) {
                console.error(chalk.red(`Failed to download file "${remoteFilePath}". Server response: ${downloadResponse.statusText}`));
                continue;
            }

            // Step 5: Save the file content to the local filesystem
            const fileContent = await downloadResponse.text();

            // Check if the file exists, if so then delete it before writing.
            if (overwrite && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                console.log(chalk.yellow(`File "${localFilePath}" already exists. Overwriting...`));
            }

            fs.writeFileSync(localFilePath, fileContent, 'utf8');
            const fileSize = fs.statSync(localFilePath).size;
            console.log(chalk.green(`File: "${remoteFilePath}" downloaded to "${localFilePath}" (size: ${formatSize(fileSize)})`));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to download files.\nError: ${error.message}`));
    }
}

/**
 * Copy files or directories from one location to another on the Puter server (similar to Unix "cp" command).
 * @param {Array} args - The arguments passed to the command (source path, destination path).
 */
export async function copyFile(args = []) {
    if (args.length < 2) {
        console.log(chalk.red('Usage: cp <source_path> <destination_path>'));
        return;
    }

    const sourcePath = args[0].startsWith(`/${getCurrentUserName()}`) ? args[0] : resolvePath(getCurrentDirectory(), args[0]); // Resolve the source path
    const destinationPath = args[1].startsWith(`/${getCurrentUserName()}`) ? args[1] : resolvePath(getCurrentDirectory(), args[1]); // Resolve the destination path

    console.log(chalk.green(`Copy: "${chalk.dim(sourcePath)}" to: "${chalk.dim(destinationPath)}"...\n`));
    try {
        // Step 1: Check if the source is a directory or a file
        const statResponse = await fetch(`${API_BASE}/stat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                path: sourcePath
            })
        });

        if (!statResponse.ok) {
            console.error(chalk.red(`Failed to check source path. Server response: ${await statResponse.text()}`));
            return;
        }

        const statData = await statResponse.json();
        if (!statData || !statData.id) {
            console.error(chalk.red(`Source path "${sourcePath}" does not exist.`));
            return;
        }

        if (statData.is_dir) {
            // Step 2: If source is a directory, copy all files recursively
            const files = await listFiles([sourcePath]);
            for (const file of files) {
                const relativePath = file.path.replace(sourcePath, '');
                const destPath = path.join(destinationPath, relativePath);

                const copyResponse = await fetch(`${API_BASE}/copy`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        source: file.path,
                        destination: destPath
                    })
                });

                if (!copyResponse.ok) {
                    console.error(chalk.red(`Failed to copy file "${file.path}". Server response: ${await copyResponse.text()}`));
                    continue;
                }

                const copyData = await copyResponse.json();
                if (copyData && copyData.length > 0 && copyData[0].copied) {
                    console.log(chalk.green(`File "${chalk.dim(file.path)}" copied successfully to "${chalk.dim(copyData[0].copied.path)}"!`));
                } else {
                    console.error(chalk.red(`Failed to copy file "${file.path}". Invalid response from server.`));
                }
            }
        } else {
            // Step 3: If source is a file, copy it directly
            const copyResponse = await fetch(`${API_BASE}/copy`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    source: sourcePath,
                    destination: destinationPath
                })
            });

            if (!copyResponse.ok) {
                console.error(chalk.red(`Failed to copy file. Server response: ${await copyResponse.text()}`));
                return;
            }

            const copyData = await copyResponse.json();
            if (copyData && copyData.length > 0 && copyData[0].copied) {
                console.log(chalk.green(`File "${sourcePath}" copied successfully to "${copyData[0].copied.path}"!`));
                console.log(chalk.dim(`UID: ${copyData[0].copied.uid}`));
            } else {
                console.error(chalk.red('Failed to copy file. Invalid response from server.'));
            }
        }
    } catch (error) {
        console.error(chalk.red(`Failed to copy file.\nError: ${error.message}`));
    }
}


/**
 * List all files in a local directory.
 * @param {string} localDir - The local directory path.
 * @returns {Array} - Array of local file objects.
 */
function listLocalFiles(localDir) {
    const files = [];
    const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else {
                files.push({
                    relativePath: path.relative(localDir, fullPath),
                    localPath: fullPath,
                    size: fs.statSync(fullPath).size,
                    modified: fs.statSync(fullPath).mtime.getTime()
                });
            }
        }
    };

    walkDir(localDir);
    return files;
}

/**
 * Compare local and remote files to determine actions.
 * @param {Array} localFiles - Array of local file objects.
 * @param {Array} remoteFiles - Array of remote file objects.
 * @param {string} localDir - Local directory path.
 * @param {string} remoteDir - Remote directory path.
 * @returns {Object} - Object containing files to upload, download, and delete.
 */
function compareFiles(localFiles, remoteFiles, localDir, remoteDir) {
    const toUpload = []; // Files to upload to remote
    const toDownload = []; // Files to download from remote
    const toDelete = []; // Files to delete from remote

    // Create a map of remote files for quick lookup
    const remoteFileMap = new Map();
    remoteFiles.forEach(file => {
        remoteFileMap.set(file.name, {
            size: file.size,
            modified: new Date(file.modified).getTime()
        });
    });

    // Check local files
    for (const file of localFiles) {
        const remoteFile = remoteFileMap.get(file.relativePath);
        if (!remoteFile || file.modified > remoteFile.modified) {
            toUpload.push(file); // New or updated file
        }
    }

    // Check remote files
    for (const file of remoteFiles) {
        const localFile = localFiles.find(f => f.relativePath === file.name);
        if (localFile){
            console.log(`localFile: ${localFile.relativePath}, modified: ${localFile.modified}`);
        }
        console.log(`file: ${file.name}, modified: ${file.modified}`);
        if (!localFile) {
            toDelete.push({ relativePath: file.name }); // Extra file in remote
        } else if (file.modified > parseInt(localFile.modified / 1000)) {
            toDownload.push(localFile); // New or updated file in remote
        }
    }

    return { toUpload, toDownload, toDelete };
}

/**
 * Find conflicts where the same file has been modified in both locations.
 * @param {Array} toUpload - Files to upload.
 * @param {Array} toDownload - Files to download.
 * @returns {Array} - Array of conflicting file paths.
 */
function findConflicts(toUpload, toDownload) {
    const conflicts = [];
    const uploadPaths = toUpload.map(file => file.relativePath);
    const downloadPaths = toDownload.map(file => file.relativePath);

    for (const path of uploadPaths) {
        if (downloadPaths.includes(path)) {
            conflicts.push(path);
        }
    }

    return conflicts;
}

/**
 * Resolve given local path directory
 * @param {string} localPath The local path to resolve
 * @returns {Promise<string>} The resolved absolute path
 * @throws {Error} If the path does not exist or is not a directory
 */
async function resolveLocalDirectory(localPath) {
    // Resolve the path to an absolute path
    const absolutePath = path.resolve(localPath);
  
    // Check if the path exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }
  
    // Check if the path is a directory
    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${absolutePath}`);
    }
    return absolutePath;
}

/**
 * Synchronize a local directory with a remote directory on Puter.
 * @param {string[]} args - Command-line arguments (e.g., [localDir, remoteDir]).
 */
export async function syncDirectory(args = []) {
    if (args.length < 2) {
        console.log(chalk.red('Usage: update <local_directory> <remote_directory> [--delete]'));
        return;
    }

    const localDir = await resolveLocalDirectory(args[0]);
    const remoteDir = resolvePath(getCurrentDirectory(), args[1]);
    const deleteFlag = args.includes('--delete'); // Whether to delete extra files

    console.log(chalk.green(`Syncing local directory "${localDir}" with remote directory "${remoteDir}"...\n`));

    try {
        // Step 1: Validate local directory
        if (!fs.existsSync(localDir)) {
            console.error(chalk.red(`Local directory "${localDir}" does not exist.`));
            return;
        }

        // Step 2: Fetch remote directory contents
        const remoteFiles = await listRemoteFiles(remoteDir);
        if (!Array.isArray(remoteFiles)) {
            console.error(chalk.red('Failed to fetch remote directory contents.'));
            return;
        }

        // Step 3: List local files
        const localFiles = listLocalFiles(localDir);

        // Step 4: Compare local and remote files
        let { toUpload, toDownload, toDelete } = compareFiles(localFiles, remoteFiles, localDir, remoteDir);

        // Step 5: Handle conflicts (if any)
        const conflicts = findConflicts(toUpload, toDownload);
        if (conflicts.length > 0) {
            console.log(chalk.yellow('The following files have conflicts:'));
            conflicts.forEach(file => console.log(chalk.dim(`- ${file}`)));

            const { resolve } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'resolve',
                    message: 'How would you like to resolve conflicts?',
                    choices: [
                        { name: 'Keep local version', value: 'local' },
                        { name: 'Keep remote version', value: 'remote' },
                        { name: 'Skip conflicting files', value: 'skip' }
                    ]
                }
            ]);

            if (resolve === 'local') {
                toDownload = toDownload.filter(file => !conflicts.includes(file.relativePath));
            } else if (resolve === 'remote') {
                toUpload = toUpload.filter(file => !conflicts.includes(file.relativePath));
            } else {
                toUpload = toUpload.filter(file => !conflicts.includes(file.relativePath));
                toDownload = toDownload.filter(file => !conflicts.includes(file.relativePath));
            }
        }

        // Step 6: Perform synchronization
        console.log(chalk.green('Starting synchronization...'));

        // Upload new/updated files
        for (const file of toUpload) {
            console.log(chalk.cyan(`Uploading "${file.relativePath}"...`));
            const dedupeName = 'false';
            const overwrite = 'true';
            await uploadFile([file.localPath, remoteDir, dedupeName, overwrite]);
        }

        // Download new/updated files
        for (const file of toDownload) {
            console.log(chalk.cyan(`Downloading "${file.relativePath}"...`));
            const overwrite = 'true';
            await downloadFile([file.relativePath, file.localPath, overwrite]);
        }

        // Delete extra files (if --delete flag is set)
        if (deleteFlag) {
            for (const file of toDelete) {
                console.log(chalk.yellow(`Deleting "${file.relativePath}"...`));
                await removeFileOrDirectory([path.join(remoteDir, file.relativePath), '-f']);
            }
        }

        console.log(chalk.green('Synchronization complete!'));
    } catch (error) {
        console.error(chalk.red('Failed to synchronize directories.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}
