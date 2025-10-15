import chalk from 'chalk';
import fetch from 'node-fetch';
import Table from 'cli-table3';
import { getCurrentUserName, getCurrentDirectory } from './auth.js';
import { API_BASE, getHeaders, generateAppName, resolveRemotePath, isValidAppName } from '../commons.js';
import { displayNonNullValues, formatDate, isValidAppUuid } from '../utils.js';
import { getSubdomains, createSubdomain, deleteSubdomain, updateSubdomain } from './subdomains.js';
import { ErrorAPI } from '../modules/ErrorModule.js';
import { getPuter } from '../modules/PuterModule.js';


/**
 * Listing subdomains
 */
export async function listSites(args = {}, context) {
    try {
      const result = await getSubdomains(args);
  
      // Create table instance
      const table = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('UID'),
          chalk.cyan('Subdomain'),
          chalk.cyan('Created'),
          chalk.cyan('Protected'),
        //   chalk.cyan('Owner'),
          chalk.cyan('Directory')
        ],
        wordWrap: false
      });
  
      // Format and add data to table
      let i = 0;
      result.forEach(domain => {
        let appDir = domain?.root_dir?.path.split('/').pop().split('-');
        table.push([
          i++,
          domain.uid,
          chalk.green(`${chalk.dim(domain.subdomain)}.puter.site`),
          formatDate(domain.created_at).split(',')[0],
          domain.protected ? chalk.red('Yes') : chalk.green('No'),
        //   domain.owner['username'],
          appDir && (isValidAppUuid(appDir.join('-'))?`${appDir[0]}-...-${appDir.slice(-1)}`:appDir.join('-'))
        ]);
      });
  
      // Print table
      if (result.length === 0) {
        console.log(chalk.yellow('No subdomains found'));
      } else {
        console.log(chalk.bold('\nYour Sites:'));
        console.log(table.toString());
        console.log(chalk.dim(`Total Sites: ${result.length}`));
      }
  
    } catch (error) {
      context.events.emit('error', { error });
      console.error(chalk.red('Error listing sites:'), error.message);
      throw error;
    }
}

/**
 * Get Site info
 * @param {any[]} args Array of site uuid
 */
export async function infoSite(args = []) {
    if (args.length < 1){
        console.log(chalk.red('Usage: site <siteUID>'));
        return;
    }
    const puter = getPuter();
    for (const subdomain of args)
      try {
        const result = await puter.hosting.get(subdomain);
        displayNonNullValues(result);
      } catch (error) {
        console.error(chalk.red('Error getting site info:'), error.message);
      }
  }
  
 /**
  * Delete hosted web site
  * @param {any[]} args Array of subdomain
  */
  export async function deleteSite(args = []) {
    if (args.length < 1){
        console.log(chalk.red('Usage: site:delete <subdomain>'));
        return false;
    }
    await deleteSubdomain(args);
    return true;
  }
  
 /**
  * Create a static web app from the current directory to Puter cloud.
  * @param {string[]} args - Command-line arguments (e.g., [name, --subdomain=<subdomain>]).
  */
  export async function createSite(args = []) {
    if (args.length < 1 || !isValidAppName(args[0])) {
        console.log(chalk.red('Usage: site:create <valid_name_app> [<remote_dir>] [--subdomain=<subdomain>]'));
        console.log(chalk.yellow('Example: site:create mysite'));
        console.log(chalk.yellow('Example: site:create mysite ./mysite'));
        console.log(chalk.yellow('Example: site:create mysite --subdomain=mysite'));
        return;
    }
  
    const appName = args[0]; // Site name (required)
    const subdomainOption = args.find(arg => arg.toLocaleLowerCase().startsWith('--subdomain='))?.split('=')[1]; // Optional subdomain
    const remoteDirArg = (args[1] && !args[1].startsWith('--')) ? args[1] : '.';
    
    // Use the current directory as the root directory if none specified
    const remoteDir = resolveRemotePath(getCurrentDirectory(), remoteDirArg);
  
    console.log(chalk.dim(`Creating site ${chalk.green(appName)} from: ${chalk.green(remoteDir)}...\n`));
    try {
        // Step 1: Determine the subdomain
        let subdomain;
        if (subdomainOption) {
            subdomain = subdomainOption; // Use the provided subdomain
        } else {
            subdomain = appName; // Default to the app name as the subdomain
        }
  
        // Step 2: Check if the subdomain already exists
        const subdomains = await getSubdomains();;
        const subdomainObj = subdomains.find(sd => sd.subdomain === subdomain);      
        if (subdomainObj) {
            console.error(chalk.cyan(`The subdomain "${subdomain}" is already in use and owned by: "${subdomainObj.owner['username']}"`));
            if (subdomainObj.owner['username'] === getCurrentUserName()){
                console.log(chalk.green(`It's yours, and linked to: ${subdomainObj.root_dir?.path}`));
                if (subdomainObj.root_dir?.path === remoteDir){
                    console.log(chalk.cyan(`Which is already the selected directory, and created at:`));
                    console.log(chalk.green(`https://${subdomain}.puter.site`));
                    return;
                } else {
                    console.log(chalk.yellow(`However, It's linked to different directory at: ${subdomainObj.root_dir?.path}`));
                    console.log(chalk.cyan(`Updating this subdomain directory...`));
                    const result = await updateSubdomain(subdomain, remoteDir);
                    if (result) {
                        console.log(chalk.green('Updating subdomain directory successful.'));
                        return;
                    } else {
                        console.log(chalk.red('Could not update this subdomain directory.'));
                        return;
                    }
                }
            }
        } 
            
        // Use the chosen "subdomain"
        console.log(chalk.cyan(`New generated subdomain: "${subdomain}" will be used if its not already in use.`));

        // Step 3: Host the current directory under the subdomain
        console.log(chalk.cyan(`Hosting app "${appName}" under subdomain "${subdomain}"...`));
        const site = await createSubdomain(subdomain, remoteDir);
        if (!site){
            console.error(chalk.red(`Failed to create subdomain: "${chalk.red(subdomain)}"`));
            return;
        }
  
        console.log(chalk.green(`App ${chalk.dim(appName)} created successfully and accessible at:`));
        console.log(chalk.cyan(`https://${site.subdomain}.puter.site`));
        return site;
    } catch (error) {
        console.error(chalk.red('Failed to create site.'));
        console.error(chalk.red(`Error: ${error.message}`));
        return null;
    }
  }
