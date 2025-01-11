import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { formatDate } from './utils.js';
import { getCurrentUserName, getCurrentDirectory } from './auth.js';
import { API_BASE, getHeaders, generateAppName, resolvePath, isValidAppName } from './commons.js';
import { getSubdomains, deleteSubdomain, createSubdomain } from './subdomains.js';
import { createFile, uploadFile } from './files.js';

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
                    chalk.cyan('Title'),
                    chalk.cyan('Name'),
                    chalk.cyan('Created'),
                    chalk.cyan('Subdomain'),
                    // chalk.cyan('Description'),
                    chalk.cyan('#Open'),
                    chalk.cyan('#User')
                ],
                colWidths: [20, 30, 25, 35, 8, 8],
                wordWrap: false
            });

            // Populate the table with app data
            for (const app of data['result']) {
                table.push([
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
 * Create a new web application
 * @param {string} name The name of the App
 * @param {string} description A description of the App
 * @param {string} url A default coming-soon URL
 * @returns Output JSON data
 */
export async function createApp(name, description = '', url = 'https://dev-center.puter.com/coming-soon.html') {
    console.log(chalk.green(`Creating app: "${chalk.red(name)}"...\n`));
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
        console.log(chalk.green(`App "${chalk.red(name)}" created successfully!`));
        console.log(chalk.dim(`AppName: ${appName}\nUID: ${appUid}\nUsername: ${username}`));

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
        console.log(chalk.dim(`Directory UID: ${dirUid}`));

        // Create a dummy home page
        const createFileResult = await createFile([path.join(appDir, 'index.html'), '<h1>My New App</h1']);
        if (!createFileResult){
            console.log(chalk.red("We could not create the home page file!"));
        }

        // Step 3: Create a subdomain for the app
        const subdomainName = `${name}-${uid.split('-')[0]}`;
        console.log(chalk.green(`Creating subdomain: "${chalk.red(subdomainName)}"...\n`));
        const subdomainResult = await createSubdomain(subdomainName, `/${username}/AppData/${appUid}/${createDirData.name}`);
        if (!subdomainResult) {
            console.error(chalk.red(`Failed to create subdomain: "${chalk.red(subdomainName)}"`));
            return;
        }
        console.log(chalk.green(`Subdomain created successfully!`));
        console.log(chalk.dim(`Subdomain: ${subdomainName}`));

        // Step 4: Update the app's index_url to point to the subdomain
        console.log(chalk.green(`Set "${chalk.red(subdomainName)}" as a subdomain for app: "${chalk.red(appName)}"...\n`));
        const updateAppResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "update",
                args: {
                    id: { name: appName },
                    object: {
                        index_url: `https://${appName}.puter.site`,
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
        console.log(chalk.dim(`https://${subdomainName}.puter.site`));        
    } catch (error) {
        console.error(chalk.red(`Failed to create app "${name}".\nError: ${error.message}`));
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
            console.log(chalk.red(`App "${name}" not found.`));
            return false;
        }

        // Show app details and confirm deletion
        console.log(chalk.cyan('\nApp Details:'));
        console.log(chalk.dim('----------------------------------------'));
        console.log(`Name: ${readData.result.name}`);
        console.log(`Title: ${readData.result.title}`);
        console.log(`Created: ${new Date(readData.result.created_at).toLocaleString()}`);
        console.log(`URL: ${readData.result.index_url}`);
        console.log(chalk.dim('----------------------------------------'));

        // Step 2: Delete the app
        console.log(chalk.green(`Deleting app "${name}"...`));
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
        });

        const deleteData = await deleteResponse.json();
        
        if (deleteData.success) {
            console.log(chalk.green(`App "${chalk.red(name)}" deleted successfully!`));
            return true;
        } else {
            console.error(chalk.red(`Failed to delete app "${name}".\nP.S. You may need to provide the 'name' not the 'title'.`));
            return false;
        }
    } catch (error) {
        console.error(chalk.red(`Failed to delete app "${name}".\nError: ${error.message}`));
        return false;
    }
    return true;
}

/**
 * Delete hosted web site
 * @param {any[]} args Array of site uuid
 */
export async function deleteSite(args = []) {
    if (args.length < 1){
        console.log(chalk.red('Usage: site:delete <siteUUID>'));
        return;
    }
    for (const uuid of args)
        try {
        // The uuid must be prefixed with: 'subdomainObj-'
        const response = await fetch(`${API_BASE}/delete-site`, {
            headers: getHeaders(),
            method: 'POST',
            body: JSON.stringify({
                site_uuid: uuid
            })
        });
    
        if (!response.ok) {
            throw new Error(`Failed to delete site (Status: ${response.status})`);
        }
    
        const data = await response.json();
        const result = await deleteSubdomain(uuid);
        if (result){
            // check if data is empty object
            if (Object.keys(data).length === 0){
                console.log(chalk.green(`Site ID: "${uuid}" should be deleted.`));
            }
        }
        console.log(chalk.yellow(`Site ID: "${uuid}" may already be deleted!`));
    } catch (error) {
        console.error(chalk.red('Error deleting site:'), error.message);
    }
}

/**
 * Deploy a static web app from the current directory to Puter cloud.
 * @param {string[]} args - Command-line arguments (e.g., [name, --subdomain=<subdomain>]).
 */
export async function deploySite(args = []) {
    if (args.length < 1 || !isValidAppName(args[0])) {
        console.log(chalk.red('Usage: deploy <valid_name_app> [<remote_dir>] [--subdomain=<subdomain>]'));
        console.log(chalk.yellow('Example: deploy myapp'));
        console.log(chalk.yellow('Example: deploy myapp ./myapp'));
        console.log(chalk.yellow('Example: deploy myapp --subdomain=myapp'));
        return;
    }

    const appName = args[0]; // App name (required)
    const subdomainOption = args.find(arg => arg.toLocaleLowerCase().startsWith('--subdomain='))?.split('=')[1]; // Optional subdomain
    // Use the current directory as the root directory if none specified
    const remoteDir = resolvePath(getCurrentDirectory(), (args[1] && !args[1].startsWith('--'))?args[1]:'.');

    console.log(chalk.green(`Deploying app "${appName}" from "${remoteDir}"...\n`));
    try {
        // Step 1: Determine the subdomain
        let subdomain;
        if (subdomainOption) {
            subdomain = subdomainOption; // Use the provided subdomain
        } else {
            subdomain = appName; // Default to the app name as the subdomain
        }

        // Step 2: Check if the subdomain already exists
        const data = await getSubdomains();
        if (!data.success || !Array.isArray(data.result)) {
          throw new Error('Failed to fetch subdomains');
        }

        const subdomains = data.result;
        const subdomainObj = subdomains.find(sd => sd.subdomain === subdomain);      
        if (subdomainObj) {
            console.error(chalk.cyan(`The subdomain "${subdomain}" is already in use and owned by: "${subdomainObj.owner['username']}"`));
            if (subdomainObj.owner['username'] === getCurrentUserName()){
                console.log(chalk.green(`It's yours, and linked to: ${subdomainObj.root_dir?.path}`));
                if (subdomainObj.root_dir?.path === remoteDir){
                    console.log(chalk.cyan(`Which is already the selected directory, and deployed at:`));
                    console.log(chalk.green(`https://${subdomain}.puter.site`));
                    return;
                } else {
                    console.log(chalk.yellow(`However, It's linked to different directory at: ${subdomainObj.root_dir?.path}`));
                    console.log(chalk.cyan(`We'll try to unlink this subdomain from that directory...`));
                    const result = await deleteSubdomain(subdomainObj.uid);
                    if (result) {
                        console.log(chalk.green('Looks like this subdomain is free again, please try again.'));
                        return;
                    } else {
                        console.log(chalk.red('Could not release this subdomain.'));
                    }
                }
            }
        } else {
            console.log(chalk.yellow(`The subdomain: "${subdomain}" is already taken, so let's generate a new random one:`));
            subdomain = generateAppName(); // Generate a random subdomain
            console.log(chalk.cyan(`New generated subdomain: "${subdomain}" will be used.`));
        }

        // Step 3: Host the current directory under the subdomain
        console.log(chalk.cyan(`Hosting app "${appName}" under subdomain "${subdomain}"...`));
        const site = await createSubdomain(subdomain, remoteDir);
        if (!site){
            console.error(chalk.red(`Failed to create subdomain: "${chalk.red(subdomain)}"`));
            return;
        }

        console.log(chalk.green(`App "${chalk.red(appName)}" deployed successfully at:`));
        console.log(chalk.dim(`https://${site.subdomain}.puter.site`));
    } catch (error) {
        console.error(chalk.red('Failed to deploy app.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}