import chalk from 'chalk';
import { generateAppName } from '../commons.js';
import { syncDirectory } from './files.js';
import { createSite } from './sites.js';
import { getPuter } from '../modules/PuterModule.js';

/**
 * Deploy a local web project to Puter.
 * @param {string[]} args - Command-line arguments (e.g., <local_dir> [--subdomain=<subdomain>]).
 */
export async function deploy(args = []) {
  if (args.length < 1) {
    console.log(chalk.red('Usage: site:deploy <local_dir> [--subdomain=<subdomain>]'));
    console.log(chalk.yellow('Example: site:deploy .'));
    console.log(chalk.yellow('Example: site:deploy ./dist'));
    console.log(chalk.yellow('Example: site:deploy ./dist --subdomain=my-app-new'));
    return;
  }
  const puter = getPuter();

  const sourceDirArg = args.find(arg => !arg.startsWith('--'));
  const sourceDir = sourceDirArg || '.';

  let subdomain = args.find(arg => arg.startsWith('--subdomain='))?.split('=')[1];
  if (!subdomain) {
    subdomain = generateAppName();
  }

  const remoteDir = `~/sites/${subdomain}/deployment`;

  // this will handle the increments
  const directory = await puter.fs.mkdir(remoteDir, {
    dedupeName: true,
    createMissingParents: true
  })

  console.log(chalk.cyan(`Deploying '${sourceDir}' to '${subdomain}.puter.site'...`));

  try {
    // 1. Upload files
    await syncDirectory([sourceDir, directory.path, '--delete', '-r', '--overwrite']);

    // 2. Create the site
    const site = await createSite([subdomain, directory.path, `--subdomain=${subdomain}`]);

    if (site) {
      console.log(chalk.green('Deployment successful!'));
    } else {
      console.log(chalk.yellow('Deployment successfuly updated!'));
    }
  } catch (error) {
    console.error(chalk.red(`Deployment failed: ${error.message}`));
  }
}