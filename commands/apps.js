import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { API_BASE, getHeaders } from './commons.js';
import { formatDate } from './utils.js';
import Table from 'cli-table3';

export async function listApps({ statsPeriod = 'all', iconSize = 64 } = {}) {
    const spinner = ora(chalk.green('Listing apps...\n')).start();
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
                    // chalk.cyan('Name'),
                    chalk.cyan('Created'),
                    chalk.cyan('Index URL'),
                    // chalk.cyan('Description'),
                    chalk.cyan(`Opened (${statsPeriod})`),
                    chalk.cyan(`User(s) (${statsPeriod})`)
                ],
                colWidths: [20, 30, 50, 10, 10],
                wordWrap: false
            });

            // Populate the table with app data
            for (const app of data['result']) {
                table.push([
                    app['title'],
                    // app['name'],
                    formatDate(app['created_at']),
                    app['index_url'],
                    // app['description'] || 'N/A',
                    app['stats']['open_count'],
                    app['stats']['user_count']
                ]);
            }

            // Display the table
            console.log(table.toString());
            spinner.succeed(chalk.green(`You have in total: ${data['result'].length} application(s).`));
        } else {
            spinner.fail(chalk.red('Unable to list your apps. Please check your credentials.'));
        }
    } catch (error) {
        spinner.fail(chalk.red('Failed to list your apps.'));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}