import  chalk from 'chalk';
import { getAuthToken } from './auth.js';

export const API_BASE = 'https://api.puter.com';

/**
 * Default Headers data
 */
export function getHeaders() {
    return {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Authorization': `Bearer ${getAuthToken()}`,
      'Connection': 'keep-alive',
      // 'Host': 'api.puter.com',
      'Content-Type': 'application/json',
      'Origin': 'https://puter.com',
      'Referer': 'https://puter.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
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