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