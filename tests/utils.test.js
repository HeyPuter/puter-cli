import { describe, it, expect, vi } from 'vitest';
import { formatDate, formatDateTime, formatSize, displayNonNullValues, parseArgs, isValidAppUuid, is_valid_uuid4 } from '../src/utils.js';

describe('formatDate', () => {
  it('should format a date string correctly', () => {
    const dateString = '2024-10-07T15:03:53.000Z';
    const expected = '10/07/2024, 15:03:53';
    expect(formatDate(dateString)).toBe(expected);
  });

  it('should format a date object correctly', () => {
    const dateObject = new Date(Date.UTC(2024, 9, 7, 15, 3, 53)); // Month is 0-indexed
    const expected = '10/07/2024, 15:03:53';
    expect(formatDate(dateObject)).toBe(expected);
  });

  it('should handle different date and time', () => {
    const dateString = '2023-01-01T01:30:05.000Z';
    const expected = '01/01/2023, 01:30:05';
    expect(formatDate(dateString)).toBe(expected);
  });

  it('should handle invalid date', () => {
      const dateString = 'invalid-date';
      expect(formatDate(dateString)).toBe('Invalid Date');
  });
});

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

describe('displayNonNullValues', () => {
    it('should display non-null values in a formatted table', () => {
        const data = {
            name: 'John Doe',
            age: 30,
            address: {
                street: '123 Main St',
                city: 'Anytown',
                zip: null
            },
            email: null
        };

        const consoleLogSpy = vi.spyOn(console, 'log');
        displayNonNullValues(data);
        expect(consoleLogSpy).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    it('should handle empty object', () => {
        const data = {};
        const consoleLogSpy = vi.spyOn(console, 'log');
        displayNonNullValues(data);
        expect(consoleLogSpy).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    it('should handle nested objects with all null values', () => {
        const data = { a: null, b: { c: null, d: null } };
        const consoleLogSpy = vi.spyOn(console, 'log');
        displayNonNullValues(data);
        expect(consoleLogSpy).toHaveBeenCalledTimes(5);
        consoleLogSpy.mockRestore();
    });

    it('should handle non-object input', () => {
        const data = "not an object";
        const consoleErrorSpy = vi.spyOn(console, 'error');
        displayNonNullValues(data);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Invalid input: Input must be a non-null object.");
        consoleErrorSpy.mockRestore();
    });
});

describe('parseArgs', () => {
  it('should parse simple arguments', () => {
    const input = 'command --arg1 val1 --arg2 val2';
    const expected = { _: ['command'], arg1: 'val1', arg2: 'val2' };
    expect(parseArgs(input)).toEqual(expect.objectContaining(expected));
  });

  it('should parse command line arguments with different types', () => {
    const input = 'command --name="John Doe" --age=30';
    const result = parseArgs(input);
    expect(result).toEqual({ _: ['command'], name: 'John Doe', age: 30 });
  });  

  it('should parse quoted arguments', () => {
    const input = 'command --arg "quoted value"';
    const expected = { _: ['command'], arg: 'quoted value' };
    expect(parseArgs(input)).toEqual(expect.objectContaining(expected));
  });

  it('should parse arguments with equals sign', () => {
    const input = 'command --arg1=val1 --arg2=val2';
    const expected = { _: ['command'], arg1: 'val1', arg2: 'val2' };
    expect(parseArgs(input)).toEqual(expect.objectContaining(expected));
  });

  it('should handle empty input', () => {
    const result = parseArgs('');
    expect(result).toEqual({ _: []});
  });

  it('should parse empty arguments', () => {
      const input = '';
      const expected = { _: [] };
      expect(parseArgs(input)).toEqual(expect.objectContaining(expected));
  });
});

describe('isValidAppUuid', () => {
  it('should return true for a valid app UUID', () => {
    const uuid = 'app-a1b2c3d4-e5f6-4789-8abc-def012345678';
    expect(isValidAppUuid(uuid)).toBe(true);
  });

  it('should return false if UUID does not start with "app-"', () => {
    const uuid = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    expect(isValidAppUuid(uuid)).toBe(false);
  });

  it('should return false for an invalid UUID after "app-"', () => {
    const uuid = 'app-invalid-uuid';
    expect(isValidAppUuid(uuid)).toBe(false);
  });
});

describe('is_valid_uuid4', () => {
  it('should return true for a valid UUID v4', () => {
    const uuid = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    expect(is_valid_uuid4(uuid)).toBe(true);
  });

  it('should return false for an invalid UUID v4', () => {
    const uuid = 'a1b2c3d4-e5f6-5789-8abc-def012345678'; // Invalid version
    expect(is_valid_uuid4(uuid)).toBe(false);
  });

  it('should return false for a completely invalid UUID', () => {
    const uuid = 'invalid-uuid';
    expect(is_valid_uuid4(uuid)).toBe(false);
  });
});