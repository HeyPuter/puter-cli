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
        hour12: false
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