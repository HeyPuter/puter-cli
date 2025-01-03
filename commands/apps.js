import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { API_BASE, getHeaders } from './commons.js';
import { formatDate } from './utils.js';
import Table from 'cli-table3';
import inquirer from 'inquirer';

export async function listApps({ statsPeriod = 'all', iconSize = 64 } = {}) {
    const spinner = ora(chalk.green(`Listing of apps during period "${statsPeriod}":\n`)).start();
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
                    chalk.cyan('Index URL'),
                    // chalk.cyan('Description'),
                    chalk.cyan('Opened'),
                    chalk.cyan('User(s)')
                ],
                colWidths: [20, 30, 50, 10, 10],
                wordWrap: false
            });

            // Populate the table with app data
            for (const app of data['result']) {
                table.push([
                    app['title'],
                    app['name'],
                    formatDate(app['created_at']),
                    app['index_url'],
                    // app['description'] || 'N/A',
                    app['stats']['open_count'],
                    app['stats']['user_count']
                ]);
            }

            // Display the table
            console.log(table.toString());
            console.log('\n');
            spinner.succeed(chalk.green(`You have in total: ${data['result'].length} application(s).`));
        } else {
            spinner.fail(chalk.red('Unable to list your apps. Please check your credentials.'));
        }
    } catch (error) {
        spinner.fail(chalk.red('Failed to list your apps.'));
        console.error(chalk.red(`Error: ${error.message}`));
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
    const spinner = ora(chalk.green(`Creating app "${name}"...\n`)).start();
    try {
        const response = await fetch(`${API_BASE}/drivers/call`, {
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
        const data = await response.json();
        if (data && data.success) {
            spinner.succeed(chalk.green(`App "${data.result.name}" created successfully!`));
            console.log(chalk.dim(`UID: ${data.result.uid}`));
            return data.result;
        } else {
            spinner.fail(chalk.red(`Failed to create app "${name}"`));
        }
    } catch (error) {
        spinner.fail(chalk.red(`Failed to create app "${name}"`));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

/**
 * Delete an app by its name
 * @param {string} name The name of the app to delete
 * @returns a boolean success value
 */
export async function deleteApp(name) {
    const spinner = ora(chalk.green(`Checking app "${name}"...\n`)).start();
    try {
        // Step 1: Read app details
        const readResponse = await fetch(`${API_BASE}/drivers/call`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                interface: "puter-apps",
                method: "read",
                args: {
                    params: { icon_size: 16 },
                    id: { name }
                }
            })
        });
        
        const readData = await readResponse.json();
        spinner.stop();

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

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: chalk.yellow(`Are you sure you want to delete "${name}"?`),
                default: false
            }
        ]);

        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return false;
        }

        // Step 2: Delete the app
        spinner.start(chalk.green(`Deleting app "${name}"...`));
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
            spinner.succeed(chalk.green(`App "${name}" deleted successfully!`));
            return true;
        } else {
            spinner.fail(chalk.red(`Failed to delete app "${name}"`));
            return false;
        }
    } catch (error) {
        spinner.fail(chalk.red(`Failed to delete app "${name}"`));
        console.error(chalk.red(`Error: ${error.message}`));
        return false;
    }
}

/**
 * Generate a random app name
 * @returns a random app name or null if it fails
 * @see: [randName](https://github.com/HeyPuter/puter/blob/06a67a3b223a6cbd7ec2e16853b6d2304f621a88/src/puter-js/src/index.js#L389)
 */
export async function generateAppName(separateWith = '-'){
    const spinner = ora(chalk.green('Generating random app name...\n')).start();
    try {        
        const first_adj = ['helpful','sensible', 'loyal', 'honest', 'clever', 'capable','calm', 'smart', 'genius', 'bright', 'charming', 'creative', 'diligent', 'elegant', 'fancy', 
        'colorful', 'avid', 'active', 'gentle', 'happy', 'intelligent', 'jolly', 'kind', 'lively', 'merry', 'nice', 'optimistic', 'polite', 
        'quiet', 'relaxed', 'silly', 'victorious', 'witty', 'young', 'zealous', 'strong', 'brave', 'agile', 'bold'];

        const nouns = ['street', 'roof', 'floor', 'tv', 'idea', 'morning', 'game', 'wheel', 'shoe', 'bag', 'clock', 'pencil', 'pen', 
        'magnet', 'chair', 'table', 'house', 'dog', 'room', 'book', 'car', 'cat', 'tree', 
        'flower', 'bird', 'fish', 'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'mountain', 
        'river', 'lake', 'sea', 'ocean', 'island', 'bridge', 'road', 'train', 'plane', 'ship', 'bicycle', 
        'horse', 'elephant', 'lion', 'tiger', 'bear', 'zebra', 'giraffe', 'monkey', 'snake', 'rabbit', 'duck', 
        'goose', 'penguin', 'frog', 'crab', 'shrimp', 'whale', 'octopus', 'spider', 'ant', 'bee', 'butterfly', 'dragonfly', 
        'ladybug', 'snail', 'camel', 'kangaroo', 'koala', 'panda', 'piglet', 'sheep', 'wolf', 'fox', 'deer', 'mouse', 'seal',
        'chicken', 'cow', 'dinosaur', 'puppy', 'kitten', 'circle', 'square', 'garden', 'otter', 'bunny', 'meerkat', 'harp']

        // return a random combination of first_adj + noun + number (between 0 and 9999)
        // e.g. clever-idea-123
        const appName = first_adj[Math.floor(Math.random() * first_adj.length)] + separateWith + nouns[Math.floor(Math.random() * nouns.length)] + separateWith + Math.floor(Math.random() * 10000);
        spinner.succeed(chalk.green(`AppName: "${appName}"`));
        return appName;
    } catch (error) {
        spinner.fail(chalk.red(`Failed to create an app name.`));
        console.error(chalk.red(`Error: ${error.message}`));
        return null;
    }
}