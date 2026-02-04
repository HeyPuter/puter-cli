import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { generateAppName } from '../commons.js';
import { createSite } from './sites.js';
import { getPuter } from '../modules/PuterModule.js';

/**
 * Recursively get all files in a directory
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative path calculation
 * @returns {Promise<Array<{path: string, relativePath: string}>>}
 */
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      files.push({
        path: fullPath,
        relativePath: path.relative(baseDir, fullPath)
      });
    }
  }

  return files;
}

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
    // 1. Read all files from source directory
    const files = await getAllFiles(sourceDir);

    if (files.length === 0) {
      console.log(chalk.yellow('No files found in source directory.'));
      return;
    }

    // 2. Create File objects for upload
    const fileObjects = await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(file.path);
        return new File([content], file.relativePath);
      })
    );

    // 3. Upload files
    console.log(chalk.cyan(`Uploading ${files.length} file(s)...`));
    await puter.fs.upload(fileObjects, directory.path, { createMissingParents: true });

    // 4. Create the site
    const site = await createSite([subdomain, directory.path, `--subdomain=${subdomain}`]);

    if (site) {
      console.log(chalk.green('Deployment successful!'));
    } else {
      console.log(chalk.yellow('Deployment successfully updated!'));
    }
  } catch (error) {
    console.log(error);
    console.error(chalk.red(`Deployment failed: ${error.message}`));
  }
}