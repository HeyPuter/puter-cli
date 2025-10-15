import chalk from 'chalk';
import fetch from 'node-fetch';
import { API_BASE, getHeaders } from '../commons.js';
import { getPuter } from '../modules/PuterModule.js';

/**
 * Get list of subdomains.
 * @param {Object} args - Options for the query.
 * @returns {Array} - Array of subdomains.
 */
export async function getSubdomains(args = {}) {
    const puter = getPuter();
    let result;

    try {
        result = await puter.hosting.list();    
    } catch (error) {
        console.log(chalk.red(`Error when getting subdomains.\nError: ${error?.message}`));
    }

    return result;
}

/**
 * Delete a subdomain by id
 * @param {Array} subdomain IDs
 * @return {boolean} Result of the operation
 */
export async function deleteSubdomain(args = []) {
    if (args.length < 1){
        console.log(chalk.red('Usage: domain:delete <subdomain_id>'));
        return false;
    }
    const puter = getPuter();
    const subdomains = args;
    for (const subdomain of subdomains)
        try {
        const success = await puter.hosting.delete(subdomain);
    
        if (!success) {
            console.log(chalk.red(`Failed to delete subdomain: ${data.error?.message}`));
            return false;
        }
        console.log(chalk.green('Subdomain deleted successfully'));
        } catch (error) {
            if (error.error?.code === 'entity_not_found') {
                console.log(chalk.red(`Subdomain: "${subdomain}" not found`));
                return false;
            }
            console.error(chalk.red('Error deleting subdomain:'), error.message);
        }
        return true;
}

/**
 * Create a new subdomain into remote directory
 * @param {string} subdomain - Subdomain name.
 * @param {string} remoteDir - Remote directory path.
 * @returns {Object} - Hosting details (e.g., subdomain).
 */
export async function createSubdomain(subdomain, remoteDir) {
    const puter = getPuter();
    let result;

    try {
        result = await puter.hosting.create(subdomain, remoteDir);
    } catch (error) {
        if (error?.error?.code === 'already_in_use') {
            console.log(chalk.yellow(`Subdomain already taken!\nMessage: ${error?.error?.message}`));
            return false;
        }
        console.log(chalk.red(`Error when creating "${subdomain}".\nError: ${error?.error?.message}\nCode: ${error?.error?.code}`));
    }
    return result;
}

/**
 * Update a subdomain into remote directory
 * @param {string} subdomain - Subdomain name.
 * @param {string} remoteDir - Remote directory path.
 * @returns {Object} - Hosting details (e.g., subdomain).
 */
export async function updateSubdomain(subdomain, remoteDir) {
    const puter = getPuter();
    let result;

    try {
        result = await puter.hosting.update(subdomain, remoteDir);
    } catch (error) {
        console.log(chalk.red(`Error when updating "${subdomain}".\nError: ${error?.message}`));
        return null;
    }

    return result;
}
