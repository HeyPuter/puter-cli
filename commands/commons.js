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
