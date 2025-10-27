import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import path from 'path';
import { minimatch } from 'minimatch';
import chalk from 'chalk';
import Conf from 'conf';
import fetch from 'node-fetch';
import { API_BASE, BASE_URL, PROJECT_NAME, getHeaders, showDiskSpaceUsage, resolvePath, resolveRemotePath } from '../commons.js';
import { formatDateTime, formatSize, getSystemEditor } from '../utils.js';
import inquirer from 'inquirer';
import { getAuthToken, getCurrentDirectory, getCurrentUserName } from './auth.js';
import { updatePrompt } from './shell.js';
import crypto from '../crypto.js';
import { getPuter } from '../modules/PuterModule.js';


const config = new Conf({ projectName: PROJECT_NAME });


/**
 * List files in given path
 * @param {string} path Path to the file or directory
 * @returns List of files found
 */
export async function listRemoteFiles(path) {
    const puter = getPuter();
    return await puter.fs.readdir(path);
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
                const uid = file.uid?.split('-');
                console.log(`${type}${write}   ${name} ${size.padEnd(8)} ${modified}  ${uid[0]}-...-${uid.slice(-1)}`);
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

    const puter = getPuter();

    try {
        const data = await puter.fs.mkdir(`${getCurrentDirectory()}/${directoryName}`, {
            overwrite: false,
            dedupeName: true,
            createMissingParents: false
        })
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
        console.log(chalk.red('Usage: mv <source> <destination>'));
        return;
    }

    const sourcePath = args[0].startsWith('/') ? args[0] : resolvePath(getCurrentDirectory(), args[0]);
    const destPath = args[1].startsWith('/') ? args[1] : resolvePath(getCurrentDirectory(), args[1]);

    console.log(chalk.green(`Moving "${sourcePath}" to "${destPath}"...\n`));
    
    const puter = getPuter();
    try {
        // Step 1: Get the source file/directory info
        const statData = await puter.fs.stat(sourcePath);
        if (!statData || !statData.uid) {
            console.log(chalk.red(`Could not find source "${sourcePath}".`));
            return;
        }

        const sourceUid = statData.uid;
        const sourceName = statData.name;

        // Step 2: Check if destination is an existing directory
        let destData = null;
        try {
            destData = await puter.fs.stat(destPath);
        } catch (error) {
            if (error.code == "subject_does_not_exist") {
                // no-op
            } else {
                throw (error);
            }
        }
        
        // Determine if this is a rename or move operation
        const isMove = destData && destData.is_dir;
        const newName = isMove ? sourceName : path.basename(destPath);
        const destination = isMove ? destPath : path.dirname(destPath);

        if (isMove) {
            // Move operation: use /move endpoint
            const moveData = await puter.fs.move(sourceUid, destination, {
                overwrite: false,
                newName: newName,
                createMissingParents: false,
            });
            if (moveData && moveData.moved) {
                console.log(chalk.green(`Successfully moved "${sourcePath}" to "${moveData.moved.path}"!`));
            } else {
                console.log(chalk.red('Failed to move item. Please check your input.'));
            }
        } else {
            // Rename operation: use /rename endpoint
            const renameData = await puter.fs.rename(sourceUid, newName);
            if (renameData) {
                console.log(chalk.green(`Successfully renamed "${sourcePath}" to "${renameData.path}"!`));
            } else {
                console.log(chalk.red('Failed to rename item. Please check your input.'));
            }
        }
    } catch (error) {
        console.log(chalk.red('Failed to move/rename item.'));
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(error);
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
    const puter = getPuter();

    for (const file of files) {
        const filePath = path.join(basePath, file.name);

        // Check if the current file/directory matches the pattern
        if (minimatch(filePath, pattern, { dot: true })) {
            matchedPaths.push(filePath);
        }

        // If it's a directory, recursively search its contents
        if (file.is_dir) {
            const dirFiles = await puter.fs.readdir(filePath);
            if (dirFiles && dirFiles.length > 0) {
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

    const puter = getPuter();

    try {
        // Step 1: Fetch the list of files and directories from the server
        const files = await puter.fs.readdir(getCurrentDirectory());
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
                const statData = await puter.fs.stat(path);
                if (!statData || !statData.uid) {
                    console.error(chalk.red(`Could not find file or directory with path "${path}".`));
                    continue;
                }

                const uid = statData.uid;

                // Step 4.2: Perform the move operation to Trash
                const moveData = await puter.fs.move(uid, `/${getCurrentUserName()}/Trash`, {
                    overwrite: false,
                    newName: uid,
                    createMissingParents: false,
                });
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

    const puter = getPuter();
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
        const deleteData = await puter.fs.delete(folderPath, {
            descendantsOnly: true,
            recursive: true
        });
        if (Object.keys(deleteData).length == 0) {
            console.log(chalk.green(`Successfully deleted all contents from: ${chalk.cyan(folderPath)}`));
        } else {
            console.log(chalk.red('Failed to delete folder. Please check your input.'));
        }
    } catch (error) {
        console.log(chalk.red('Failed to delete folder.'));
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(error);
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
    const puter = getPuter();
    for (let name of names)
        try {
            name = `${getCurrentDirectory()}/${name}`;
            console.log(chalk.green(`Getting stat info for: "${name}"...\n`));
            const data = await puter.fs.stat(name);
            if (data) {
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
    const puter = getPuter();

    const path = args[0];
    // Handle "/","~",".." and deeper navigation
    const newPath = path.startsWith('/')? path: (path === '~'? `/${getCurrentUserName()}` :resolvePath(currentPath, path));
    try {
        // Check if the new path is a valid directory
        const data = await puter.fs.stat(newPath);
        if (data && data.is_dir) {
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
    const puter = getPuter();
    try {
        const data = await puter.fs.space();
        if (data) {
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
    const puter = getPuter();
    try {
        // Step 1: Check if the file already exists
        await puter.fs.stat(filePath);
        return true;
    } catch (error){
        if (error.code == "subject_does_not_exist") {
            return false;
        }
        console.error(chalk.red('Failed to check if file exists.'));
        console.error('ERROR', error);
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

    const puter = getPuter();
    console.log(chalk.green(`Creating file:\nFileName: "${chalk.dim(fileName)}"\nPath: "${chalk.dim(dirName)}"\nContent Length: ${chalk.dim(content.length)}`));
    try {
        // Step 1: Check if the file already exists
        try {
            const statData = await puter.fs.stat(fullPath);
            if (statData && statData.id) {
                if (!overwrite) {
                    console.error(chalk.red(`File "${filePath}" already exists. Use --overwrite=true to replace it.`));
                    return false;
                }
                console.log(chalk.yellow(`File "${filePath}" already exists. It will be overwritten.`));
            }
        } catch (error) {
            if (error.code == "subject_does_not_exist") {
                console.log(chalk.cyan('File does not exists. It will be created.'));
            } else {
                throw error;
            }
        }

        // Step 2: Check disk space
        const dfData = await puter.fs.space();
        if (dfData.used >= dfData.capacity) {
            console.error(chalk.red('Not enough disk space to create the file.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return false;
        }

        // Step 3: Create the nested directories if they don't exist
        try {
            await puter.fs.stat(dirName);
        } catch (error) {
            if (error.code == "subject_does_not_exist") {
                // Create the directory if it doesn't exist
                await puter.fs.mkdir(dirName, {
                    overwrite: false,
                    dedupeName: true,
                    createMissingParents: true
                })
            } else {
                throw error;
            }
        }

        // Step 4: Create the file
        const fileBlob = new Blob([content || ''], { type: 'text/plain' });

        const createData = await puter.fs.upload(fileBlob, dirName, {
            overwrite: overwrite,
            dedupeName: dedupeName,
            name: fileName
        });
        console.log(chalk.green(`File "${createData.name}" created successfully!`));
        console.log(chalk.dim(`Path: ${createData.path}`));
        console.log(chalk.dim(`UID: ${createData.uid}`));
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
    const puter = getPuter();

    const filePath = resolvePath(getCurrentDirectory(), args[0]);
    console.log(chalk.green(`Reading file "${filePath}"...\n`));

    try {
        // Step 1: Fetch the file content        
        const fileBlob = await puter.fs.read(filePath);
        if (!fileBlob) {
            console.error(chalk.red(`Failed to read file.`));
            return;
        }
        const data = await fileBlob.text();

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
    const puter = getPuter();
    try {
        // Step 1: Find all matching files (excluding hidden files)
        const files = glob.sync(localPath, { nodir: true, dot: false });

        if (files.length === 0) {
            console.error(chalk.red('No files found to upload.'));
            return;
        }

        // Step 2: Check disk space
        const dfData = await puter.fs.space();
        if (dfData.used >= dfData.capacity) {
            console.error(chalk.red('Not enough disk space to upload the files.'));
            showDiskSpaceUsage(dfData); // Display disk usage info
            return;
        }

        // Step 3: Upload each file
        for (const filePath of files) {
            const fileName = path.basename(filePath);
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]);

            const uploadData = await puter.fs.upload(blob, remotePath, {
                overwrite: overwrite,
                dedupeName: dedupeName,
                name: fileName
            });
            console.log(chalk.green(`File "${uploadData.name}" uploaded successfully!`));
            console.log(chalk.dim(`Path: ${uploadData.path}`));
            console.log(chalk.dim(`UID: ${uploadData.uid}`));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to upload files.\nError: ${error.message}`));
    }
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
    const puter = getPuter();
    try {
        // Step 1: Fetch the list of files and directories from the server
        const files = await puter.fs.readdir(getCurrentDirectory());
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

            const fileUrl = await puter.fs.getReadURL(remoteFilePath);
            const downloadResponse = await fetch(fileUrl);

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
    const puter = getPuter();
    try {
        // Step 1: Check if the source is a directory or a file
        let statData;
        try {
            statData = await puter.fs.stat(sourcePath);
        } catch (error) {
            if (error == "subject_does_not_exist") {
                console.error(chalk.red(`Source path "${sourcePath}" does not exist.`));
                return;
            } else {
                console.error(chalk.red(`Failed to check source path. Server response: ${await statResponse.text()}`));
                return;
            }
        }

        if (statData.is_dir) {
            // Step 2: If source is a directory, copy all files recursively
            const files = await listFiles([sourcePath]);
            for (const file of files) {
                const relativePath = file.path.replace(sourcePath, '');
                const destPath = path.join(destinationPath, relativePath);

                const copyData = await puter.fs.copy(file.path, destPath);
                if (copyData && copyData.length > 0 && copyData[0].copied) {
                    console.log(chalk.green(`File "${chalk.dim(file.path)}" copied successfully to "${chalk.dim(copyData[0].copied.path)}"!`));
                } else {
                    console.error(chalk.red(`Failed to copy file "${file.path}". Invalid response from server.`));
                }
            }
        } else {
            // Step 3: If source is a file, copy it directly
            const copyData = await puter.fs.copy(sourcePath, destinationPath);
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
 * @param {boolean} recursive - Whether to recursively list files in subdirectories
 * @returns {Array} - Array of local file objects.
 */
function listLocalFiles(localDir, recursive = false) {
    const files = [];
    const walkDir = (dir, baseDir) => {

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);
            if (entry.isDirectory()) {
                if (recursive) {
                    walkDir(fullPath, baseDir); // Recursively traverse directories if flag is set
                }
            } else {
                files.push({
                    relativePath: relativePath,
                    localPath: fullPath,
                    size: fs.statSync(fullPath).size,
                    modified: fs.statSync(fullPath).mtime.getTime()
                });
            }
        }

    };

    walkDir(localDir, localDir);
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
 * Ensure a remote directory exists, creating it if necessary
 * @param {string} remotePath - The remote directory path
 */
async function ensureRemoteDirectoryExists(remotePath) {
    const puter = getPuter();
    try {
        const exists = await pathExists(remotePath);
        if (!exists) {
            // Create the directory and any missing parents
            await puter.fs.mkdir(remotePath, {
                overwrite: false,
                dedupeName: true,
                createMissingParents: true
            })
        }
    } catch (error) {
        console.error(chalk.red(`Failed to create remote directory: ${remotePath}`));
        throw error;
    }
}

/**
 * Synchronize a local directory with a remote directory on Puter.
 * @param {string[]} args - Command-line arguments (e.g., [localDir, remoteDir, --delete, -r]).
 */
export async function syncDirectory(args = []) {
    const usageMessage = 'Usage: update <local_directory> <remote_directory> [--delete] [-r] [--overwrite]';
    if (args.length < 2) {
        console.log(chalk.red(usageMessage));
        return;
    }

    let localDir = '';
    let remoteDir = '';
    let deleteFlag = '';
    let recursiveFlag = false;
    let overwriteFlag = false;
    try {
        localDir = await resolveLocalDirectory(args[0]);
        remoteDir = resolveRemotePath(getCurrentDirectory(), args[1]);
        deleteFlag = args.includes('--delete'); // Whether to delete extra files
        recursiveFlag = args.includes('-r'); // Whether to recursively process subdirectories
        overwriteFlag = args.includes('--overwrite');
    } catch (error) {
        console.error(chalk.red(error.message));
        console.log(chalk.green(usageMessage));
        return;
    }

    console.log(chalk.green(`Syncing local directory ${chalk.cyan(localDir)}" with remote directory ${chalk.cyan(remoteDir)}"...\n`));

    try {
        // Step 1: Validate local directory
        if (!fs.existsSync(localDir)) {
            console.error(chalk.red(`Local directory "${localDir}" does not exist.`));
            return;
        }

        // Step 2: Fetch remote directory contents
        let remoteFiles = [];
        try {
            remoteFiles = await listRemoteFiles(remoteDir);
        } catch (error) {
            console.log(chalk.yellow('Remote directory is empty or does not exist. Continuing...'));
        }

        // Step 3: List local files
        const localFiles = listLocalFiles(localDir, recursiveFlag);

        // Step 4: Compare local and remote files
        let { toUpload, toDownload, toDelete } = compareFiles(localFiles, remoteFiles, localDir, remoteDir);
        let filteredToUpload = [...toUpload];
        let filteredToDownload = [...toDownload];

        // Step 5: Handle conflicts (if any)
        const conflicts = findConflicts(toUpload, toDownload);
        if (conflicts.length > 0) {
            if (overwriteFlag) {
                console.log(chalk.yellow('Overwriting existing files with local version.'));
                filteredToDownload = filteredToDownload.filter(file => !conflicts.includes(file.relativePath));
            } else {
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
                    filteredToDownload = filteredToDownload.filter(file => !conflicts.includes(file.relativePath));
                } else if (resolve === 'remote') {
                    filteredToUpload = filteredToUpload.filter(file => !conflicts.includes(file.relativePath));
                } else {
                    filteredToUpload = filteredToUpload.filter(file => !conflicts.includes(file.relativePath));
                    filteredToDownload = filteredToDownload.filter(file => !conflicts.includes(file.relativePath));
                }
            }
        }

        // Step 6: Perform synchronization
        console.log(chalk.green('Starting synchronization...'));

        // Upload new/updated files
        for (const file of filteredToUpload) {
            console.log(chalk.cyan(`Uploading "${file.relativePath}"...`));
            const dedupeName = 'false';
            const overwrite = 'true';

            // Create parent directories if needed
            const remoteFilePath = path.join(remoteDir, file.relativePath);
            const remoteFileDir = path.dirname(remoteFilePath);
            
            // Ensure remote directory exists
            await ensureRemoteDirectoryExists(remoteFileDir);

            await uploadFile([file.localPath, remoteFileDir, dedupeName, overwrite]);
        }

        // Download new/updated files
        for (const file of filteredToDownload) {
            console.log(chalk.cyan(`Downloading "${file.relativePath}"...`));
            const overwrite = 'true';
            // Create local parent directories if needed
            const localFilePath = path.join(localDir, file.relativePath);
            // const localFileDir = path.dirname(localFilePath);

            await downloadFile([file.remotePath, localFilePath, overwrite]);
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

/**
 * Edit a remote file using the local system editor
 * @param {Array} args - The file path to edit
 * @returns {Promise<void>}
 */
export async function editFile(args = []) {
  if (args.length < 1) {
    console.log(chalk.red('Usage: edit <file>'));
    return;
  }

  const filePath = args[0].startsWith('/') ? args[0] : resolvePath(getCurrentDirectory(), args[0]);
  console.log(chalk.green(`Fetching file: ${filePath}`));

  const puter = getPuter();

  try {
    // Step 1: Check if file exists
    const statData = await puter.fs.stat(filePath);
    if (!statData || statData.is_dir) {
      console.log(chalk.red(`File not found or is a directory: ${filePath}`));
      return;
    }

    // Step 2: Download the file content
    const fileBlob = await puter.fs.read(filePath);
    const fileContent = await fileBlob.text();
    if (!fileContent) {
      console.log(chalk.red(`Failed to download file: ${filePath}`));
      return;
    }
    console.log(chalk.green(`File fetched: ${filePath} (${formatSize(fileContent.length)} bytes)`));

    // Step 3: Create a temporary file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puter-'));
    const tempFilePath = path.join(tempDir, path.basename(filePath));
    fs.writeFileSync(tempFilePath, fileContent, 'utf-8');

    // Step 4: Determine the editor to use
    const editor = getSystemEditor();
    console.log(chalk.cyan(`Opening file with ${editor}...`));
    
    // Step 5: Open the file in the editor using execSync instead of spawn
    // This will block until the editor is closed, which is better for terminal-based editors
    try {
      execSync(`${editor} "${tempFilePath}"`, { 
        stdio: 'inherit',
        env: process.env
      });
      
      // Read the updated content after editor closes
      const updatedContent = fs.readFileSync(tempFilePath, 'utf8');
      const blob = new Blob([updatedContent]);
      console.log(chalk.cyan('Uploading changes...'));
      
      // Step 7: Upload the updated file content
      // Step 7.1: Check disk space
      const dfData = await puter.fs.space();
      if (dfData.used >= dfData.capacity) {
          console.log(chalk.red('Not enough disk space to upload the file.'));
          showDiskSpaceUsage(dfData); // Display disk usage info
          return;
      }

      // Step 7.2: Uploading the updated file
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);

      const uploadData = await puter.fs.upload(blob, dirName, {
        overwrite: true,
        dedupeName: false,
        name: fileName
      });
      console.log(chalk.green(`File saved: ${uploadData.path}`));
    } catch (error) {
      if (error.status === 130) {
        // This is a SIGINT (Ctrl+C), which is normal for some editors
        console.log(chalk.yellow('Editor closed without saving.'));
      } else {
        console.log(chalk.red(`Error during editing: ${error.message}`));
      }
    } finally {
      // Clean up temporary files
      try {
        fs.unlinkSync(tempFilePath);
        fs.rmdirSync(tempDir);
      } catch (e) {
        console.error(chalk.dim(`Failed to clean up temporary files: ${e.message}`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`Error: ${error.message}`));
  }
}