import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { displayNonNullValues, formatDate } from './utils.js';
import { API_BASE, getHeaders, getDefaultHomePage, isValidAppName, resolvePath } from './commons.js';
import { createSubdomain, getSubdomains } from './subdomains.js';
import { deleteSite } from './sites.js';
import { copyFile, createFile, listRemoteFiles, pathExists, removeFileOrDirectory } from './files.js';
import { getCurrentDirectory } from './auth.js';
import crypto from './crypto.js';

/**
 * List all apps
 * 
 * @param {object} options 
 * ```json
 * {
 *  statsPeriod: [all (default), today, yesterday, 7d, 30d, this_month, last_month, this_year, last_year, month_to_date, year_to_date, last_12_months],
 *  iconSize: [16, 32, 64, 128, 256, 512]
 * }
 * ```
 */
export async function listApps({ statsPeriod = 'all', iconSize = 64 } = {}) {
    console.log(chalk.green(`Listing of apps during period "${chalk.red(statsPeriod)}":\n`));
    try {
        const response = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "select",
                args: {
                    params: { icon_size: iconSize },
                    predicate: ["user-can-edit"],
                    stats_period: statsPeriod,
                }
            })
        });
        const data = await response.json();
        if (data && data['result']) {
            // Create a new table instance
            const table = new Table({
                head: [
                    chalk.cyan('#'),
                    chalk.cyan('Title'),
                    chalk.cyan('Name'),
                    chalk.cyan('Created'),
                    chalk.cyan('Subdomain'),
                    // chalk.cyan('Description'),
                    chalk.cyan('#Open'),
                    chalk.cyan('#User')
                ],
                colWidths: [5, 20, 30, 25, 35, 8, 8],
                wordWrap: false
            });

            // Populate the table with app data
            let i = 0;
            for (const app of data['result']) {
                table.push([
                    i++,
                    app['title'],
                    app['name'],
                    formatDate(app['created_at']),
                    app['index_url']?app['index_url'].split('.')[0].split('//')[1]:'<NO_URL>',
                    // app['description'].slice(0, 10) || 'N/A',
                    app['stats']['open_count'],
                    app['stats']['user_count']
                ]);
            }

            // Display the table
            console.log(table.toString());
            console.log(chalk.green(`You have in total: ${chalk.red(data['result'].length)} application(s).`));
        } else {
            console.error(chalk.red('Unable to list your apps. Please check your credentials.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to list apps. Error: ${error.message}`));
    }
}

/**
 * Get app informations
 * 
 * @param {Array} List of options (only "name" is supported at the moment)
 * @example:
 * ```json
 * const data = await appInfo("app name");
 * ```
 */
export async function appInfo(args = []) {
    if (!args || args.length == 0){
        console.log(chalk.red('Usage: app <name>'));
        return;
    }
    const appName = args[0].trim()
    console.log(chalk.green(`Looking for "${chalk.dim(appName)}" app informations:\n`));
    try {
        const response = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "read",
                args: {
                    id: {
                        name: appName
                    }
                }
            })
        });
        const data = await response.json();
        if (data && data['result']) {
            // Display the informations
            displayNonNullValues(data['result']);
        } else {
            console.error(chalk.red('Could not find this app.'));
        }
    } catch (error) {
        console.error(chalk.red(`Failed to get app info. Error: ${error.message}`));
    }
}

/**
 * Create a new web application
 * @param {string} name The name of the App
 * @param {string} description A description of the App
 * @param {string} url A default coming-soon URL
 * @returns Output JSON data
 */
export async function createApp(args = []) {
    if (args.length < 1 || !isValidAppName(args[0])) {
        console.log(chalk.red('Usage: app:create <valid_name_app> [<remote_dir>] [--url=<url>]'));
        console.log(chalk.yellow('Example: app:create myapp'));
        console.log(chalk.yellow('Example: app:create myapp ./myapp'));
        return;
    }
    const name = args[0]; // App name (required)
    // Use the default home page if the root directory if none specified
    const localDir = (args[1] && !args[1].startsWith('--'))? resolvePath(getCurrentDirectory(), args[1]):'';
    // Optional description (disabled at the moment)
    const description = ''; // (args.find(arg => arg.toLocaleLowerCase().startsWith('--description='))?.split('=')[1]) || '';
    const url = (args.find(arg => arg.toLocaleLowerCase().startsWith('--url='))?.split('=')[1]) || 'https://dev-center.puter.com/coming-soon.html'; // Optional url

    console.log(chalk.dim(`Creating app: ${chalk.green(name)}...\n`));
    try {
        // Step 1: Create the app
        const createAppResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "create",
                args: {
                    object: {
                        name: name,
                        index_url: url,
                        title: name,
                        description: description,
                        maximize_on_start: false,
                        background: false,
                        metadata: {
                            window_resizable: true
                        }
                    },
                    options: {
                        dedupe_name: true
                    }
                }
            })
        });
        const createAppData = await createAppResponse.json();
        if (!createAppData || !createAppData.success) {
            console.error(chalk.red(`Failed to create app "${name}"`));
            return;
        }
        const appUid = createAppData.result.uid;
        const appName = createAppData.result.name;
        const username = createAppData.result.owner.username;
        console.log(chalk.green(`App "${chalk.dim(name)}" created successfully!`));
        console.log(chalk.cyan(`AppName: ${chalk.dim(appName)}\nUID: ${chalk.dim(appUid)}\nUsername: ${chalk.dim(username)}`));

        // Step 2: Create a directory for the app
        const uid = crypto.randomUUID();
        const appDir = `/${username}/AppData/${appUid}`;
        console.log(chalk.green(`Creating directory...\nPath: ${chalk.dim(appDir)}\nApp: ${chalk.dim(name)}\nUID: ${chalk.dim(uid)}\n`));
        const createDirResponse = await fetch(`${API_BASE}/mkdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                parent: appDir,
                path: `app-${uid}`,
                overwrite: true,
                dedupe_name: false,
                create_missing_parents: true
            })
        });
        const createDirData = await createDirResponse.json();
        if (!createDirData || !createDirData.uid) {
            console.error(chalk.red(`Failed to create directory for app "${name}"`));
            return;
        }
        const dirUid = createDirData.uid;
        console.log(chalk.green(`Directory created successfully!`));
        console.log(chalk.cyan(`Directory UID: ${chalk.dim(dirUid)}`));

        // Step 3: Create a subdomain for the app
        const subdomainName = `${name}-${uid.split('-')[0]}`;
        const remoteDir = `${appDir}/${createDirData.name}`;
        console.log(chalk.green(`Linking to subdomain...\nSubdomain: "${chalk.dim(subdomainName)}"\nPath: ${chalk.dim(remoteDir)}\n`));
        const subdomainResult = await createSubdomain(subdomainName, remoteDir);
        if (!subdomainResult) {
            console.error(chalk.red(`Failed to create subdomain: "${subdomainName}"`));
            return;
        }
        console.log(chalk.green(`Subdomain created successfully!`));
        console.log(chalk.cyan(`Subdomain: ${chalk.dim(subdomainName)}`));

        // Step 4: Create a home page
        if (localDir.length > 0){
            // List files in the current "localDir" then copy them to the "remoteDir"
                const files = await listRemoteFiles(localDir);
                if (Array.isArray(files) && files.length > 0) {
                    console.log(chalk.cyan(`Copying ${chalk.dim(files.length)} files from: ${chalk.dim(localDir)}`));
                    console.log(chalk.cyan(`To destination: ${chalk.dim(remoteDir)}`));
                    for (const file of files) {
                        const fileSource = path.join(localDir, file.name);
                        await copyFile([fileSource, remoteDir]);
                    }
                } else {
                    console.log(chalk.yellow("We could not find any file in the specified directory!"));
                }
        } else {
            const homePageResult = await createFile([path.join(remoteDir, 'index.html'), getDefaultHomePage(appName)]);
            if (!homePageResult){
                console.log(chalk.yellow("We could not create the home page file!"));
            }
        }

        // Step 5: Update the app's index_url to point to the subdomain
        console.log(chalk.green(`Set "${chalk.dim(subdomainName)}" as a subdomain for app: "${chalk.dim(appName)}"...\n`));
        const updateAppResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "update",
                args: {
                    id: { name: appName },
                    object: {
                        index_url: `https://${subdomainName}.puter.site`,
                        title: name
                    }
                }
            })
        });
        const updateAppData = await updateAppResponse.json();
        if (!updateAppData || !updateAppData.success) {
            console.error(chalk.red(`Failed to update app "${name}" with new subdomain`));
            return;
        }
        console.log(chalk.green(`App deployed successfully at:`));
        console.log(chalk.cyanBright(`https://${subdomainName}.puter.site`));        
    } catch (error) {
        console.error(chalk.red(`Failed to create app "${name}".\nError: ${error.message}`));
    }
}

/**
 * Update an application from the directory
 * @param {string} name The name of the App
 * @param {string} remote_dir The remote directory
 */
export async function updateApp(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: app:update <valid_name_app> [<remote_dir>]'));
        console.log(chalk.yellow('Example: app:create myapp'));
        console.log(chalk.yellow('Example: app:create myapp ./myapp'));
        return;
    }
    const name = args[0]; // App name (required)
    const remoteDir = resolvePath(getCurrentDirectory(), args[1] || '.');
    const remoteDirExists = await pathExists(remoteDir);
    
    if (!remoteDirExists){
        console.log(chalk.red(`Cannot find directory: ${chalk.dim(remoteDir)}...\n`));
        return;
    }

    console.log(chalk.green(`Updating app: "${chalk.dim(name)}" from directory: ${chalk.dim(remoteDir)}\n`));
    try {
        // Step 1: Get the app info
        const appResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "read",
                args: {
                    id: { name }
                }
            })
        });
        const data = await appResponse.json();
        if (!data || !data.success) {
            console.error(chalk.red(`Failed to find app: "${name}"`));
            return;
        }
        const appUid = data.result.uid;
        const appName = data.result.name;
        const username = data.result.owner.username;
        const indexUrl = data.result.index_url;
        const appDir = `/${username}/AppData/${appUid}`;
        console.log(chalk.cyan(`AppName: ${chalk.dim(appName)}\nUID: ${chalk.dim(appUid)}\nUsername: ${chalk.dim(username)}`));

        // Step 2: Find the path from subdomain
        const subdomains = await getSubdomains();
        const appSubdomain = subdomains.result.find(sd => sd.root_dir?.dirname?.endsWith(appUid));
        if (!appSubdomain){
            console.error(chalk.red(`Sorry! We could not find the subdomain for ${chalk.cyan(name)} application.`));
            return;
        }
        const subdomainDir = appSubdomain['root_dir']['path'];
        if (!subdomainDir){
            console.error(chalk.red(`Sorry! We could not find the path for ${chalk.cyan(name)} application.`));
            return;
        }

        // Step 3: List files in the current "remoteDir" then copy them to the "subdomainDir"
        const files = await listRemoteFiles(remoteDir);
        if (Array.isArray(files) && files.length > 0) {
            console.log(chalk.cyan(`Copying ${chalk.dim(files.length)} files from: ${chalk.dim(remoteDir)}`));
            console.log(chalk.cyan(`To destination: ${chalk.dim(subdomainDir)}`));
            for (const file of files) {
                const fileSource = path.join(remoteDir, file.name);
                const fileDest = path.join(subdomainDir, file.name);
                if ((await pathExists(fileDest))){
                    await removeFileOrDirectory([fileDest, '-f']);
                }
                await copyFile([fileSource, subdomainDir]);
            }
        } else {
            console.log(chalk.red("We could not find any file in the specified directory!"));
        }
        
        console.log(chalk.green(`App updated successfully at:`));
        console.log(chalk.dim(indexUrl));
    } catch (error) {
        console.error(chalk.red(`Failed to update app "${name}".\nError: ${error.message}`));
    }
}

/**
 * Delete an app by its name
 * @param {string} name The name of the app to delete
 * @returns a boolean success value
 */
export async function deleteApp(name) {
    if (!name || name.length == 0){
        console.log(chalk.red('Usage: app:delete <name>'));
        return false;
    }
    console.log(chalk.green(`Checking app "${name}"...\n`));
    try {
        // Step 1: Read app details
        const readResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "read",
                args: {
                    id: { name }
                }
            })
        });
        
        const readData = await readResponse.json();

        if (!readData.success || !readData.result) {
            console.log(chalk.red(`App "${chalk.bold(name)}" not found.`));
            return false;
        }

        // Show app details and confirm deletion
        console.log(chalk.cyan('\nApp Details:'));
        console.log(chalk.dim('----------------------------------------'));
        console.log(chalk.dim(`Name: ${chalk.cyan(readData.result.name)}`));
        console.log(chalk.dim(`Title: ${chalk.cyan(readData.result.title)}`));
        console.log(chalk.dim(`Created: ${chalk.cyan(formatDate(readData.result.created_at))}`));
        console.log(chalk.dim(`URL: ${readData.result.index_url}`));
        console.log(chalk.dim('----------------------------------------'));

        // Step 2: Delete the app
        console.log(chalk.green(`Deleting app "${chalk.red(name)}"...`));
        const deleteResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "delete",
                args: {
                    id: { name }
                }
            })
        });path

        const deleteData = await deleteResponse.json();
        if (!deleteData.success) {
            console.error(chalk.red(`Failed to delete app "${name}".\nP.S. Make sure to provide the 'name' attribute not the 'title'.`));
            return false;
        }
        
        // Lookup subdomainUID then delete it
        const subdomains = await getSubdomains();
        const appSubdomain = subdomains.result.find(sd => sd.root_dir?.dirname?.endsWith(readData.result.uid));
        const subdomainDeleted = await deleteSite([appSubdomain.uid]);
        if (subdomainDeleted){
            console.log(chalk.green(`Subdomain: ${chalk.dim(appSubdomain.uid)} deleted.`));
        }

        console.log(chalk.green(`App "${chalk.dim(name)}" deleted successfully!`));
    } catch (error) {
        console.error(chalk.red(`Failed to delete app "${name}".\nError: ${error.message}`));
        return false;
    }
    return true;
}
