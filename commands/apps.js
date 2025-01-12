import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { formatDate } from './utils.js';
import { API_BASE, getHeaders, getDefaultHomePage } from './commons.js';
import { createSubdomain } from './subdomains.js';
import { createFile } from './files.js';

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

        // Step 3: Create a subdomain for the app
        const subdomainName = `${name}-${uid.split('-')[0]}`;
        const remoteDir = `${appDir}/${createDirData.name}`;
        console.log(chalk.green(`Linking to subdomain...\nSubdomain: "${chalk.dim(subdomainName)}"\nPath: ${chalk.dim(remoteDir)}\n`));
        const subdomainResult = await createSubdomain(subdomainName, remoteDir);
        if (!subdomainResult) {
            console.error(chalk.red(`Failed to create subdomain: "${chalk.red(subdomainName)}"`));
            return;
        }
        console.log(chalk.green(`Subdomain created successfully!`));
        console.log(chalk.dim(`Subdomain: ${subdomainName}`));

        // Step 4: Create a home page
        const homePageResult = await createFile([path.join(remoteDir, 'index.html'), getDefaultHomePage(appName)]);
        if (!homePageResult){
            console.log(chalk.red("We could not create the home page file!"));
        }

        // Step 5: Update the app's index_url to point to the subdomain
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
            console.log(chalk.log(`App "${chalk.red(name)}" not found.`));
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
        });

        const deleteData = await deleteResponse.json();
        if (!deleteData.success) {
            console.error(chalk.red(`Failed to delete app "${name}".\nP.S. Make sure to provide the 'name' attribute not the 'title'.`));
            return false;
        }
        
        // TODO: Try to lookup subdomainUID then delete it
        // await deleteSite(readData.result.index_url);

        console.log(chalk.green(`App "${chalk.red(name)}" deleted successfully!`));
    } catch (error) {
        console.error(chalk.red(`Failed to delete app "${name}".\nError: ${error.message}`));
        return false;
    }
    return true;
}
