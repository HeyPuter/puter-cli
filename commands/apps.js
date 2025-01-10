import fs from 'node:fs';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { minimatch } from 'minimatch';
import { formatDate } from './utils.js';
import { getCurrentUserName, getCurrentDirectory } from './auth.js';
import { API_BASE, getHeaders, generateAppName, resolvePath } from './commons.js';
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
    console.log(chalk.green(`Listing of apps during period "${statsPeriod}":\n`));
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
                    chalk.cyan('Opened'),
                    chalk.cyan('User(s)')
                ],
                colWidths: [20, 30, 25, 35, 5, 5],
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
            console.log('\n');
            console.log(chalk.green(`You have in total: ${data['result'].length} application(s).`));
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
    console.log(chalk.green(`Creating app "${name}"...\n`));
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
                        name,
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
            spinner.fail(chalk.red(`Failed to create app "${name}"`));
            return;
        }
        const appUid = createAppData.result.uid;
        console.log(chalk.green(`App "${name}" created successfully!`));
        console.log(chalk.dim(`UID: ${appUid}`));

        // Step 2: Create a directory for the app
        console.log(chalk.green(`Creating directory for app "${name}"...\n`));
        const createDirResponse = await fetch(`${API_BASE}/mkdir`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                parent: `/${createAppData.result.owner.username}/AppData/${appUid}`,
                path: `app-${crypto.randomUUID()}`,
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
        console.log(chalk.green(`Creating subdomain for app "${name}"...\n`));
        const subdomainName = `${name}-${crypto.randomUUID().split('-')[0]}`;
        const createSubdomainResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-subdomains",
                method: "create",
                args: {
                    object: {
                        subdomain: subdomainName,
                        root_dir: `/${createAppData.result.owner.username}/AppData/${appUid}/${createDirData.name}`
                    }
                }
            })
        });
        const createSubdomainData = await createSubdomainResponse.json();
        if (!createSubdomainData || !createSubdomainData.success) {
            console.error(chalk.red(`Failed to create subdomain for app "${name}"`));
            return;
        }
        console.log(chalk.green(`Subdomain created successfully!`));
        console.log(chalk.dim(`Subdomain: ${subdomainName}`));

        /*/ Step 4: Update the app's index_url to point to the subdomain
        console.log(chalk.green(`Updating app "${name}" with new subdomain...\n`)));
        const updateAppResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "update",
                args: {
                    id: { name: subdomainName },
                    object: {
                        name: subdomainName,
                        index_url: `https://${subdomainName}.puter.site`,
                        title: name,
                        description: description,
                        maximize_on_start: false,
                        background: false,
                        metadata: {
                            window_resizable: true
                        }
                    }
                }
            })
        });
        const updateAppData = await updateAppResponse.json();
        console.log(updateAppData);
        console.log('\n\n');
        if (!updateAppData || !updateAppData.success) {
            console.error(chalk.red(`Failed to update app "${name}" with new subdomain`));
            return;
        }
        console.log(chalk.green(`App updated successfully!`));
        console.log(chalk.dim(`Index URL: https://${subdomainName}.puter.site`));
        */
        return createAppData.result;
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
            console.log(chalk.green(`App "${name}" deleted successfully!`));
            // return true;
        } else {
            console.error(chalk.red(`Failed to delete app "${name}".\nP.S. You may need to provide the 'name' not the 'title'.`));
            // return false;
        }
    } catch (error) {
        console.error(chalk.red(`Failed to delete app "${name}".\nError: ${error.message}`));
        // return false;
    }
}

/**
 * Get list of subdomains.
 * @param {Object} args - Options for the query.
 * @returns {Array} - Array of subdomains.
 */
async function getSubdomains(args = {}) {
    const response = await fetch(`${API_BASE}/drivers/call`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            interface: 'puter-subdomains',
            method: 'select',
            args: args
        })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch subdomains.');
    }
    return await response.json();
}

/**
 * Listing subdomains
 */
export async function listSubdomains(args = {}) {
    try {
      const data = await getSubdomains(args);

      if (!data.success || !Array.isArray(data.result)) {
        throw new Error('Failed to fetch subdomains');
      }
  
      // Create table instance
      const table = new Table({
        head: [
          chalk.cyan('UID'),
          chalk.cyan('Subdomain'),
          chalk.cyan('Created'),
          chalk.cyan('Protected'),
        //   chalk.cyan('Owner'),
          chalk.cyan('Directory')
        ],
        style: {
          head: [], // Disable colors in header
          border: [] // Disable colors for borders
        }
      });
  
      // Format and add data to table
      data.result.forEach(domain => {
        const createdDate = new Date(domain.created_at).toLocaleDateString();        
        table.push([
          domain.uid,
          chalk.green(`${domain.subdomain}.puter.site`),
          createdDate,
          domain.protected ? chalk.red('Yes') : chalk.green('No'),
        //   domain.owner['username'],
          domain?.root_dir?.path.split('/').pop()
        ]);
      });
  
      // Print table
      if (data.result.length === 0) {
        console.log(chalk.yellow('No subdomains found'));
      } else {
        console.log(chalk.bold('\nYour Subdomains:'));
        console.log(table.toString());
        console.log(chalk.dim(`Total subdomains: ${data.result.length}`));
      }
  
    } catch (error) {
      console.error(chalk.red('Error listing subdomains:'), error.message);
      throw error;
    }
}

/**
 * Delete a subdomain by id
 * @param {Array} subdomain IDs
 * @return {boolean} Result of the operation
 */
async function deleteSubdomain(args = []) {
    if (args.length < 1){
        console.log(chalk.red('Usage: domain:delete <subdomain_id>'));
        return false;
    }
    const subdomains = args;
    for (const subdomainId of subdomains)
        try {
        const response = await fetch(`${API_BASE}/drivers/call`, {
            headers: getHeaders(),
            method: 'POST',
            body: JSON.stringify({
            interface: 'puter-subdomains',
            method: 'delete',
            args: {
                id: { subdomainId }
            }
            })
        });
    
        const data = await response.json();
        if (!data.success) {
            if (data.error?.code === 'entity_not_found') {
                console.log(chalk.red(`Subdomain ID: "${subdomainId}" not found`));
                return false;
            }
            console.log(chalk.red(`Failed to delete subdomain: ${data.error?.message}`));
            return false;
        }
        console.log(chalk.green('Subdomain deleted successfully'));
        } catch (error) {
            console.error(chalk.red('Error deleting subdomain:'), error.message);
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
        // The uuid must be prefixed with: 'sd-'
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
                console.log(chalk.green(`Site: "${uuid}" should be deleted.`));
            }
        }
    } catch (error) {
        console.error(chalk.red('Error deleting site:'), error.message);
    }
}

/**
 * Host a directory under a subdomain.
 * @param {string} subdomain - Subdomain name.
 * @param {string} remoteDir - Remote directory path.
 * @returns {Object} - Hosting details (e.g., subdomain).
 */
async function hostDirectory(subdomain, remoteDir) {
    const response = await fetch(`${API_BASE}/drivers/call`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            interface: 'puter-subdomains',
            method: 'create',
            args: {
                object: {
                    subdomain: subdomain,
                    root_dir: remoteDir
                }
            }
        })
    });

    if (!response.ok) {
        throw new Error('Failed to host directory.');
    }
    const data = await response.json();
    return data.result;
}

/**
 * Deploy a static web app from the current directory to Puter cloud.
 * @param {string[]} args - Command-line arguments (e.g., [name, --subdomain=<subdomain>]).
 */
export async function deploySite(args = []) {
    if (args.length < 1) {
        console.log(chalk.red('Usage: deploy <name> [<remote_dir>] [--subdomain=<subdomain>]'));
        console.log(chalk.yellow('Example: deploy myapp'));
        console.log(chalk.yellow('Example: deploy myapp ./myapp'));
        console.log(chalk.yellow('Example: deploy myapp --subdomain=myapp'));
        return;
    }

    const appName = args[0]; // App name (required)
    const subdomainOption = args.find(arg => arg.startsWith('--subdomain='))?.split('=')[1]; // Optional subdomain
    // Use the current directory as the root directory if none specified
    const remoteDir = args[1]?(args[1].startsWith('--')?getCurrentDirectory(): resolvePath(getCurrentDirectory(), args[1])):getCurrentDirectory();

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
        const data = await getSubdomains(args);
        if (!data.success || !Array.isArray(data.result)) {
          throw new Error('Failed to fetch subdomains');
        }

        const subdomains = data.result;        
        if (subdomains.some(sd => sd.subdomain === subdomain)) {
            console.error(chalk.red(`The subdomain "${subdomain}" is already in use.`));
            // It would be better to check the owner of the subdomain, then overwrite it if possible before creating a new random one
            subdomain = generateAppName(); // Generate a random subdomain
            console.error(chalk.cyan(`New generated subdomain: "${subdomain}" will be used.`));
        }

        // Step 3: Host the current directory under the subdomain
        console.log(chalk.cyan(`Hosting app "${appName}" under subdomain "${subdomain}"...`));
        const site = await hostDirectory(subdomain, remoteDir);

        console.log(chalk.green(`App "${appName}" deployed successfully!`));
        console.log(chalk.green(`Website hosted at: https://${site.subdomain}.puter.site`));
    } catch (error) {
        console.error(chalk.red('Failed to deploy app.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}