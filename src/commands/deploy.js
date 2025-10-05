import chalk from 'chalk';
import { generateAppName, isValidAppName } from '../commons.js';
import { syncDirectory } from './files.js';
import { createSite } from './sites.js';
import { getCurrentDirectory } from './auth.js';
import { getSubdomains } from './subdomains.js';

/**
 * Deploy a local web project to Puter.
 * @param {string[]} args - Command-line arguments (e.g., <valid_site_app> [<remote_dir>] [--subdomain=<subdomain>]).
 */
export async function deploy(args = []) {
  if (args.length < 1 || !isValidAppName(args[0])) {
    console.log(chalk.red('Usage: site:deploy <valid_site_app> [<remote_dir>] [--subdomain=<subdomain>]'));
    console.log(chalk.yellow('Example: site:deploy'));
    console.log(chalk.yellow('Example: site:deploy my-app'));
    console.log(chalk.yellow('Example: site:deploy my-app ./my-app'));
    console.log(chalk.yellow('Example: site:deploy my-app ./my-app --subdomain=my-app-new'));
    return;
  }
  const appName = args[0]; // && !args[0].startsWith('--') ? args[0] : generateAppName();
  const remoteDirArg = args.find(arg => !arg.startsWith('--') && arg !== appName);
  const remoteDir = remoteDirArg || '.'; // `./${appName}`;
  const subdomain = args.find(arg => arg.startsWith('--subdomain='))?.split('=')[1] || appName;
  const sourceDir = '.'; // Deploy from the current directory

  console.log(chalk.cyan(`Deploying '${appName}' from local '${sourceDir}' to remote '${remoteDir}' at '${subdomain}.puter.site'...`));

  try {
    // 1. Upload files
    console.log(chalk.cyan(`Uploading files from '${sourceDir}' to '${remoteDir}'...`));
    await syncDirectory([sourceDir, remoteDir, '--delete', '-r', '--overwrite']);

    // 2. Create the site
    console.log(chalk.cyan(`Creating site...`));
    const site = await createSite([appName, remoteDir, `--subdomain=${subdomain}`]);

    if (site) {
      console.log(chalk.green('Deployment successful!'));      
    } else {
      console.log(chalk.yellow('Deployment successfuly updated!'));
    }
    if (subdomain){
      console.log(chalk.cyan('Your site is live at:'));
      console.log(chalk.green(`https://${subdomain}.puter.site`));
    } else {
      console.log(chalk.red('Deployment failed. Subdomain cannot be reserved!'));
    }
  } catch (error) {
    console.error(chalk.red(`Deployment failed: ${error.message}`));
  }
}