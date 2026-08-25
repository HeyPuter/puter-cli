import  chalk from 'chalk';
import { getAuthToken } from './commands/auth.js';
import { formatSize } from './utils.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const PROJECT_NAME = 'puter-sh';
// If you haven't defined your own values in .env file, we'll assume you're running Puter on a local instance:
export let API_BASE = process.env.PUTER_API_BASE || 'https://api.puter.com';
export let BASE_URL = process.env.PUTER_BASE_URL || 'https://puter.com';

export const reconfigureURLs = ({ api, base }) => {
    API_BASE = api;
    BASE_URL = base;
};

/**
 * Get headers with the correct Content-Type for multipart form data.
 * @param {string} contentType - The "Content-Type" argument for the header ('application/json' is the default)
 * Use the multipart form data for upload a file.
 * @returns {Object} The headers object.
 */
export function getHeaders(contentType = 'application/json') {
    return {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Authorization': `Bearer ${getAuthToken()}`,
      'Connection': 'keep-alive',
      // 'Host': 'api.puter.com',
      'Content-Type': contentType,
      'Origin': `${BASE_URL}`,
      'Referer': `${BASE_URL}/`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
}

/**
 * Display structured ouput of disk usage informations
 */
export function showDiskSpaceUsage(data) {
  const freeSpace = parseInt(data.capacity) - parseInt(data.used);
  const usagePercentage = (parseInt(data.used) / parseInt(data.capacity)) * 100;
  console.log(chalk.cyan('Disk Usage Information:'));
  console.log(chalk.dim('----------------------------------------'));
  console.log(chalk.cyan(`Total Capacity: `) + chalk.white(formatSize(data.capacity)));
  console.log(chalk.cyan(`Used Space: `) + chalk.white(formatSize(data.used)));
  console.log(chalk.cyan(`Free Space: `) + chalk.white(formatSize(freeSpace)));
  // format the usagePercentage with 2 decimal floating point value:
  console.log(chalk.cyan(`Usage Percentage: `) + chalk.white(`${usagePercentage.toFixed(2)}%`));
  console.log(chalk.dim('----------------------------------------'));
}

/**
 * The home anchor as typed by the user.
 */
export const HOME = '~';

/**
 * The concrete home directory ("/<username>") for the active profile.
 *
 * Resolved from the token at login and refreshed on every run -- never read
 * from a cached username -- so it always names the account's current home.
 * Null until a profile is selected.
 */
export let HOME_PATH = null;

/**
 * Point the home anchor at the current account's home directory.
 * @param {string} homePath - The concrete home path, e.g. "/alice"
 */
export const setHomePath = (homePath) => {
    HOME_PATH = homePath;
};

/**
 * Expand a leading "~" to the resolved home directory. Paths that are not
 * home-anchored are returned untouched, as are all paths when no profile is
 * active yet (nothing to expand against).
 * @param {string} p - The path to expand
 * @returns {string} The expanded path
 */
export function expandHome(p) {
    if (!HOME_PATH || typeof p !== 'string') return p;
    if (p === HOME) return HOME_PATH;
    if (p.startsWith('~/')) return `${HOME_PATH}${p.slice(1)}`;
    return p;
}

/**
 * Check whether a path is already fully-qualified (root- or home-anchored) and
 * therefore must NOT be resolved against the current working directory.
 * @param {string} p - The path to test
 * @returns {boolean} True if the path is absolute or home-anchored
 */
export function isAbsolutePath(p) {
    if (typeof p !== 'string') return false;
    return p === HOME || p.startsWith('~/') || p.startsWith('/');
}

/**
 * Resolve a path against the current working directory.
 *
 * If `relativePath` is itself absolute ("/...") or home-anchored ("~", "~/..."),
 * it replaces `currentPath` entirely instead of being appended to it.
 *
 * @param {string} currentPath - The current working directory
 * @param {string} relativePath - The path to resolve
 * @returns {string} The resolved path, preserving a "~" root if present
 */
export function resolvePath(currentPath, relativePath) {
    // A fully-qualified path re-roots the resolution rather than extending it.
    if (isAbsolutePath(relativePath)) {
        currentPath = relativePath.startsWith('~') ? HOME : '/';
        relativePath = relativePath.replace(/^~/, '');
    }

    // Track whether we are anchored at home so "~" survives normalization.
    const atHome = currentPath === HOME || currentPath.startsWith('~/');
    const root = atHome ? HOME : '';

    // Strip the root and any trailing slashes, leaving bare segments.
    let parts = currentPath
        .replace(/^~/, '')
        .split('/')
        .filter(p => p);

    for (const part of relativePath.split('/').filter(p => p)) {
        if (part === '..') {
            // Clamp at the root: "~/.." stays at home, "/.." stays at "/".
            parts.pop();
        } else if (part === '.') {
            continue;
        } else {
            parts.push(part);
        }
    }

    const joined = parts.join('/');
    // Expand "~" so callers and the API always see a concrete "/<username>" path.
    if (!joined) return expandHome(root || '/');
    return expandHome(`${root}/${joined}`);
}

/**
 * Resolve a remote path to a fully-qualified path.
 * @param {string} currentPath - The current working directory.
 * @param {string} remotePath - The remote path to resolve.
 * @returns {string} The resolved path.
 */
export function resolveRemotePath(currentPath, remotePath) {
    if (isAbsolutePath(remotePath)) {
        return expandHome(remotePath);
    }
    return resolvePath(currentPath, remotePath);
}

/**
 * Read latest package from package file
 */
export async function getVersionFromPackage() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        
        // First try parent directory (dev mode)
        try {
            const devPackage = JSON.parse(
                await readFile(join(__dirname, '..', 'package.json'), 'utf8')
            );
            return devPackage.version;
        } catch (devError) {
            // Fallback to current directory (production)
            const prodPackage = JSON.parse(
                await readFile(join(__dirname, 'package.json'), 'utf8')
            );
            return prodPackage.version;
        }
    } catch (error) {
        console.error(`Error fetching latest version:`, error.message);
        return null;
    }
}

/**
 * Get latest package info from npm registery
 */
export async function getLatestVersion(packageName) {
    let currentVersion = 'unknown';
    let latestVersion = null;
    let status = 'offline'; // Default status

    try {
        // Attempt to get the current version first
        currentVersion = await getVersionFromPackage();
        if (!currentVersion) {
            currentVersion = 'unknown'; // Fallback if local version fetch fails
        }

        // Attempt to fetch the latest version from npm
        try {
            const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
            if (response.ok) {
                const data = await response.json();
                latestVersion = data.version;
            }
        } catch (fetchError) {
            // Ignore fetch errors
            // console.warn(chalk.yellow(`Could not fetch latest version for ${packageName}: ${fetchError.message}`));
        }

        // Determine the status based on fetched versions
        if (latestVersion) {
            if (currentVersion !== 'unknown' && latestVersion === currentVersion) {
                status = 'up-to-date';
            } else if (currentVersion !== 'unknown' && latestVersion !== currentVersion) {
                status = `latest: ${latestVersion}`;
            } else {
                // If currentVersion is unknown but we got latest, show latest
                status = `latest: ${latestVersion}`;
            }
        }
        // status remains 'offline'...

    } catch (error) {
        // Catch errors from getVersionFromPackage or other unexpected issues
        console.error(chalk.red(`Error determining version status: ${error.message}`));
        status = 'error'; // Indicate an error occurred
    }
    return `v${currentVersion} (${status})`;
}