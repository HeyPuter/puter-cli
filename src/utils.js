
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