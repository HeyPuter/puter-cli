import  chalk from 'chalk';
import { getAuthToken } from './auth.js';

export const PROJECT_NAME = 'puter-cli';
export const API_BASE = 'https://api.puter.com';
export const BASE_URL = 'https://puter.com';

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
      'Origin': 'https://puter.com',
      'Referer': 'https://puter.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
}

/**
 * Generate a random app name
 * @returns a random app name or null if it fails
 * @see: [randName](https://github.com/HeyPuter/puter/blob/06a67a3b223a6cbd7ec2e16853b6d2304f621a88/src/puter-js/src/index.js#L389)
 */
export function generateAppName(separateWith = '-'){
  console.log('Generating random app name...\n');
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
      console.log(`AppName: "${appName}"`);
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