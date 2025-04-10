import chalk from 'chalk';
import yargsParser from 'yargs-parser';

/**
 * Convert "2024-10-07T15:03:53.000Z" to "10/7/2024, 15:03:53"
 * @param {Date} value date value
 * @returns formatted date string
 */
export function formatDate(value) {
    const date = new Date(value);
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: 'UTC'
    });
}

/**
 * Format timestamp to date or time
 * @param {number} timestamp value
 * @returns string
 */
export function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000); // Convert to milliseconds
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) { // Less than 24 hours
        return date.toLocaleTimeString();
    } else {
        return date.toLocaleDateString();
    }
}
/**
 * Format file size in human readable format
 * @param {number} size File size value
 * @returns string formatted in human readable format
 */
export function formatSize(size) {
    if (size === null || size === undefined) return '0';
    if (size === 0) return '0';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
}

/**
 * Display non null values in formatted table
 * @param {Object} data Object to display
 * @returns null
 */
export function displayNonNullValues(data) {
    if (typeof data !== 'object' || data === null) {
      console.error("Invalid input: Input must be a non-null object.");
      return;
    }
    const tableData = [];
    function flattenObject(obj, parentKey = '') {
      for (const key in obj) {
        const value = obj[key];
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (value !== null) {
          if (typeof value === 'object') {
            flattenObject(value, newKey);
          } else {
            tableData.push({ key: newKey, value: value });
          }
        }
      }
    }
  
    flattenObject(data);
    // Determine max key length for formatting
    const maxKeyLength = tableData.reduce((max, item) => Math.max(max, item.key.length), 0);
    // Format and output the table
    console.log(chalk.cyan('-'.repeat(maxKeyLength*3)));
    console.log(chalk.cyan(`| ${'Key'.padEnd(maxKeyLength)} | Value`));
    console.log(chalk.cyan('-'.repeat(maxKeyLength*3)));
    tableData.forEach(item => {
        const key = item.key.padEnd(maxKeyLength);
        const value = String(item.value);
        console.log(chalk.green(`| ${chalk.dim(key)} | ${value}`));
    });
    console.log(chalk.cyan('-'.repeat(maxKeyLength*3)));
    console.log(chalk.cyan(`You have ${chalk.green(tableData.length)} key/value pair(s).`));
  }

  /**
 * Parse command line arguments including quoted strings
 * @param {string} input Raw command line input
 * @returns {Object} Parsed arguments
 */
export function parseArgs(input, options = {}) {
  const result = yargsParser(input, options);
  return result;
}

/**
 * Checks if a given string is a valid UUID of any version
 * @param {string} uuid - The string to validate.
 * @returns {boolean} - True if the string is a valid UUID, false otherwise.
 */
export function isValidAppUuid (uuid) {
  return uuid.startsWith('app-') && is_valid_uuid4(uuid.slice(4));
}

/**
 * Checks if a given string is a valid UUID version 4.
 * @param {string} uuid - The string to validate.
 * @returns {boolean} - True if the string is a valid UUID version 4, false otherwise.
 */
export function is_valid_uuid4 (uuid) {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}

/**
 * Get system editor
 * @returns {string} - System editor
 * @example
 * getSystemEditor()
 * // => 'nano'
 */
export function getSystemEditor() {
  return process.env.EDITOR || process.env.VISUAL || 
  (process.platform === 'win32' ? 'notepad' : 'vi')
}