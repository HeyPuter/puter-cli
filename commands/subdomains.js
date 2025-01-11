import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { API_BASE, getHeaders } from './commons.js';

/**
 * Get list of subdomains.
 * @param {Object} args - Options for the query.
 * @returns {Array} - Array of subdomains.
 */
export async function getSubdomains(args = {}) {
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
export async function deleteSubdomain(args = []) {
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
                id: { subdomain: subdomainId }
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
 * Create a new subdomain into remote directory
 * @param {string} subdomain - Subdomain name.
 * @param {string} remoteDir - Remote directory path.
 * @returns {Object} - Hosting details (e.g., subdomain).
 */
export async function createSubdomain(subdomain, remoteDir) {
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