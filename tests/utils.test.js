import { describe, it, expect, vi } from 'vitest';
import { formatDateTime, formatSize } from '../src/utils.js';

describe('formatDateTime', () => {
  it('should format as time if within 24 hours', () => {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000) - 3600; // 1 hour ago
    const expected = new Date(timestamp * 1000).toLocaleTimeString();
    expect(formatDateTime(timestamp)).toBe(expected);
  });

  it('should format as date if older than 24 hours', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 86400 * 2; // 2 days ago
    const expected = new Date(timestamp * 1000).toLocaleDateString();
    expect(formatDateTime(timestamp)).toBe(expected);
  });
    it('should format timestamp 0', () => {
        const timestamp = 0;
        const expected = new Date(timestamp * 1000).toLocaleDateString();
        expect(formatDateTime(timestamp)).toBe(expected);
    });
});

describe('formatSize', () => {
  it('should format 0 bytes correctly', () => {
    expect(formatSize(0)).toBe('0');
  });

  it('should format bytes correctly', () => {
    expect(formatSize(512)).toBe('512.0 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatSize(1024 * 2)).toBe('2.0 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatSize(1024 * 1024 * 3)).toBe('3.0 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatSize(1024 * 1024 * 1024 * 4)).toBe('4.0 GB');
  });

  it('should format terabytes correctly', () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024 * 5)).toBe('5.0 TB');
  });

  it('should handle null and undefined', () => {
    expect(formatSize(null)).toBe('0');
    expect(formatSize(undefined)).toBe('0');
  });
});
