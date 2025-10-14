import  chalk from 'chalk';
import { getAuthToken } from './commands/auth.js';
import { formatSize } from './utils.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const PROJECT_NAME = 'puter-cli';
// If you haven't defined your own values in .env file, we'll assume you're running Puter on a local instance:
export let API_BASE = process.env.PUTER_API_BASE || 'https://api.puter.com';
export let BASE_URL = process.env.PUTER_BASE_URL || 'https://puter.com';
export const NULL_UUID = '00000000-0000-0000-0000-000000000000';

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
 * Generate a random app name
 * @returns a random app name or null if it fails
 * @see: [randName](https://github.com/HeyPuter/puter/blob/06a67a3b223a6cbd7ec2e16853b6d2304f621a88/src/puter-js/src/index.js#L389)
 */
export function generateAppName(separateWith = '-'){
  console.log(chalk.cyan('Generating random name...'));
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
      console.log(chalk.green(`Name: "${appName}"`));
      return appName;
  } catch (error) {
      console.error(`Error: ${error.message}`);
      return null;
  }
}

/**
 * Display data in a structured format
 * @param {Array} data - The data to display
 * @param {Object} options - Display options
 * @param {Array} options.headers - Headers for the table
 * @param {Array} options.columns - Columns to display
 * @param {number} options.columnWidth - Width of each column
 */
export function displayTable(data, options = {}) {
  const { headers = [], columns = [], columnWidth = 20 } = options;

  // Create the header row
  const headerRow = headers.map(header => chalk.cyan(header.padEnd(columnWidth))).join(' | ');
  console.log(headerRow);
  console.log(chalk.dim('-'.repeat(headerRow.length)));

  // Create and display each row of data
  data.forEach(item => {
      const row = columns.map(col => {
          const value = item[col] || 'N/A';
          return value.toString().padEnd(columnWidth);
      }).join(' | ');
      console.log(row);
  });
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
 * Resolve a relative path to an absolute path
 * @param {string} currentPath - The current working directory
 * @param {string} relativePath - The relative path to resolve
 * @returns {string} The resolved absolute path
 */
export function resolvePath(currentPath, relativePath) {
    // Normalize the current path (remove trailing slashes)
    currentPath = currentPath.replace(/\/+$/, '');

    // Split the relative path into parts
    const parts = relativePath.split('/').filter(p => p); // Remove empty parts

    // Handle each part of the relative path
    for (const part of parts) {
        if (part === '..') {
            // Move one level up
            const currentParts = currentPath.split('/').filter(p => p);
            if (currentParts.length > 0) {
                currentParts.pop(); // Remove the last part
            }
            currentPath = '/' + currentParts.join('/');
        } else if (part === '.') {
            // Stay in the current directory (no change)
            continue;
        } else {
            // Move into a subdirectory
            currentPath += `/${part}`;
        }
    }

    // Normalize the final path (remove duplicate slashes)
    currentPath = currentPath.replace(/\/+/g, '/');

    // Ensure the path ends with a slash if it's the root
    if (currentPath === '') {
        currentPath = '/';
    }

    return currentPath;
}

/**
 * Resolve a remote path to an absolute path, handling both absolute and relative paths.
 * @param {string} currentPath - The current working directory.
 * @param {string} remotePath - The remote path to resolve.
 * @returns {string} The resolved absolute path.
 */
export function resolveRemotePath(currentPath, remotePath) {
    if (remotePath.startsWith('/')) {
        return remotePath;
    }
    return resolvePath(currentPath, remotePath);
}

/**
* Checks if a given string is a valid app name.
* The name must:
*  - Not be '.' or '..'
*  - Not contain path separators ('/' or '\\')
*  - Not contain wildcard characters ('*')
*  - (Optional) Contain only allowed characters (letters, numbers, spaces, underscores, hyphens)
*
* @param {string} name - The app name to validate.
* @returns {boolean} - Returns true if valid, false otherwise.
*/
export function isValidAppName(name) {
   // Ensure the name is a non-empty string
   if (typeof name !== 'string' || name.trim().length === 0) {
       return false;
   }

   // Trim whitespace from both ends
   const trimmedName = name.trim();

   // Reject reserved names
   if (trimmedName === '.' || trimmedName === '..') {
       return false;
   }

   // Regex patterns for invalid characters
   const invalidPattern = /[\/\\*]/; // Disallow /, \, and *

   if (invalidPattern.test(trimmedName)) {
       return false;
   }

   // Optional: Define allowed characters pattern
   // Uncomment the following lines if you want to enforce allowed characters
   /*
   const allowedPattern = /^[A-Za-z0-9 _-]+$/;
   if (!allowedPattern.test(trimmedName)) {
       return false;
   }
   */

   // All checks passed
   return true;
}

/**
 * Generate the default home page for a new web application
 * @param {string} appName The name of the web application
 * @returns HTML template of the app
 */
export function getDefaultHomePage(appName, jsFiles = [], cssFiles= []) {
    const defaultIndexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName}</title>
    ${cssFiles.map(css => `<link href="${css}" rel="stylesheet">`).join('\n  ')}
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f9fafb;
            color: #1f2937;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2563eb;
            margin-bottom: 1rem;
        }
        .code-block {
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 4px;
            font-family: monospace;
            overflow-x: auto;
        }
        .tip {
            background: #dbeafe;
            border-left: 4px solid #2563eb;
            padding: 1rem;
            margin: 1rem 0;
        }
        .links {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        .links a {
            color: #2563eb;
            text-decoration: none;
        }
        .links a:hover {
            text-decoration: underline;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            color: var(--color-grey);
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to ${appName}!</h1>
        
        <p>This is your new website powered by Puter. You can start customizing it right away!</p>

        <div class="tip">
            <strong>Quick Tip:</strong> Replace this content with your own by editing the <code>index.html</code> file.
        </div>

        <h2>🌟 Getting Started</h2>
        
        <p>Here's a simple example using Puter.js:</p>
        
        <div class="code-block">
&lt;script src="https://js.puter.com/v2/">&lt;/script>
&lt;script>
    // Create a new file in the cloud
    puter.fs.write('hello.txt', 'Hello, Puter!')
        .then(file => console.log(\`File created at: \${file.path}\`));
&lt;/script>
        </div>

        <h2>💡 Key Features</h2>
        <ul>
            <li>Cloud Storage</li>
            <li>AI Services (GPT-4, DALL-E)</li>
            <li>Static Website Hosting</li>
            <li>Key-Value Store</li>
            <li>Authentication</li>
        </ul>

        <div class="links">
            <a href="https://docs.puter.com" target="_blank">📚 Documentation</a>
            <a href="https://discord.gg/puter" target="_blank">💬 Discord Community</a>
            <a href="https://github.com/HeyPuter" target="_blank">👩‍💻 GitHub</a>
        </div>
    </div>

<footer class="footer">
    &copy; 2025 ${appName}. All rights reserved.
</footer>

    <div id="${(jsFiles.length && jsFiles.some(f => f.includes('react'))) ? 'root' : 'app'}"></div>
${jsFiles.map(js => 
`<script ${js.endsWith('app.js') ? 'type="text/babel"' : ''} src="${js}"></script>`
).join('\n  ')}
</body>
</html>`;
    
    return defaultIndexContent;
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