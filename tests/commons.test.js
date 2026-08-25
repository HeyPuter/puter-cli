import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthToken } from '../src/commands/auth.js';
import { formatSize } from '../src/utils.js';
import { readFile } from 'fs/promises';

vi.mock('../src/commands/auth.js');
vi.mock('../src/utils.js');
vi.mock('fs/promises');
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

vi.spyOn(console, 'log').mockImplementation(() => { });
vi.spyOn(console, 'error').mockImplementation(() => { });

let commons;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  vi.mocked(getAuthToken).mockReturnValue('mock-token');
  vi.mocked(formatSize).mockImplementation((size) => `${size} bytes`);

  commons = await import('../src/commons.js');
});

describe('constants', () => {
  it('should export PROJECT_NAME', () => {
    expect(commons.PROJECT_NAME).toBe('puter-sh');
  });

  it('should export NULL_UUID', () => {
    expect(commons.NULL_UUID).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('should have default API_BASE', () => {
    expect(commons.API_BASE).toBeDefined();
  });

  it('should have default BASE_URL', () => {
    expect(commons.BASE_URL).toBeDefined();
  });
});

describe('reconfigureURLs', () => {
  it('should update API_BASE and BASE_URL', async () => {
    vi.resetModules();
    const freshCommons = await import('../src/commons.js');

    freshCommons.reconfigureURLs({ api: 'https://new-api.example.com', base: 'https://new.example.com' });

    expect(freshCommons.API_BASE).toBe('https://new-api.example.com');
    expect(freshCommons.BASE_URL).toBe('https://new.example.com');
  });
});

describe('getHeaders', () => {
  it('should return headers with default content type', () => {
    const headers = commons.getHeaders();

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer mock-token');
    expect(headers['Accept']).toBe('*/*');
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');
    expect(headers['Connection']).toBe('keep-alive');
  });

  it('should return headers with custom content type', () => {
    const headers = commons.getHeaders('multipart/form-data');

    expect(headers['Content-Type']).toBe('multipart/form-data');
  });

  it('should include Origin and Referer based on BASE_URL', async () => {
    vi.resetModules();
    const freshCommons = await import('../src/commons.js');
    freshCommons.reconfigureURLs({ api: 'https://api.test.com', base: 'https://test.com' });

    const headers = freshCommons.getHeaders();

    expect(headers['Origin']).toBe('https://test.com');
    expect(headers['Referer']).toBe('https://test.com/');
  });
});

describe('showDiskSpaceUsage', () => {
  it('should display disk usage information', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    const data = {
      capacity: '1000000000',
      used: '500000000',
    };

    commons.showDiskSpaceUsage(data);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(formatSize).toHaveBeenCalledWith('1000000000'); // capacity
    expect(formatSize).toHaveBeenCalledWith('500000000'); // used
    expect(formatSize).toHaveBeenCalledWith(500000000); // free space
  });

  it('should calculate usage percentage correctly', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    const data = {
      capacity: '100',
      used: '25',
    };

    commons.showDiskSpaceUsage(data);

    const calls = consoleLogSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('25.00%');
  });
});

describe('resolvePath', () => {
  it('should resolve simple relative path', () => {
    expect(commons.resolvePath('/home/user', 'documents')).toBe('/home/user/documents');
  });

  it('should resolve parent directory', () => {
    expect(commons.resolvePath('/home/user/documents', '..')).toBe('/home/user');
  });

  it('should resolve current directory', () => {
    expect(commons.resolvePath('/home/user', '.')).toBe('/home/user');
  });

  it('should resolve multiple parent directories', () => {
    expect(commons.resolvePath('/home/user/documents/files', '../..')).toBe('/home/user');
  });

  it('should handle trailing slashes', () => {
    expect(commons.resolvePath('/home/user/', 'documents')).toBe('/home/user/documents');
  });

  it('should handle empty relative path', () => {
    expect(commons.resolvePath('/home/user', '')).toBe('/home/user');
  });

  it('should return root when going above root', () => {
    expect(commons.resolvePath('/home', '../../../..')).toBe('/');
  });

  it('should normalize duplicate slashes', () => {
    expect(commons.resolvePath('/home//user', 'documents')).toBe('/home/user/documents');
  });

  it('should re-root on an absolute path instead of appending it', () => {
    expect(commons.resolvePath('/home/user', '/other/place')).toBe('/other/place');
  });

  it('should leave "~" unexpanded when no home is resolved yet', () => {
    commons.setHomePath(null);
    expect(commons.resolvePath('/home/user', '~/Desktop')).toBe('~/Desktop');
    expect(commons.resolvePath('/home/user', '~')).toBe('~');
  });

  it('should walk up within a home-anchored path', () => {
    commons.setHomePath(null);
    expect(commons.resolvePath('~/Desktop/notes', '..')).toBe('~/Desktop');
  });

  it('should clamp at the home anchor rather than escaping to root', () => {
    commons.setHomePath(null);
    expect(commons.resolvePath('~/Desktop', '../../..')).toBe('~');
  });
});

describe('expandHome', () => {
  afterEach(() => commons.setHomePath(null));

  it('should expand "~" and "~/..." to the resolved home', () => {
    commons.setHomePath('/alice');
    expect(commons.expandHome('~')).toBe('/alice');
    expect(commons.expandHome('~/Desktop')).toBe('/alice/Desktop');
  });

  it('should leave non-home paths untouched', () => {
    commons.setHomePath('/alice');
    expect(commons.expandHome('/bob/public')).toBe('/bob/public');
    expect(commons.expandHome('notes.txt')).toBe('notes.txt');
  });

  it('should be a no-op before a home is resolved', () => {
    commons.setHomePath(null);
    expect(commons.expandHome('~/Desktop')).toBe('~/Desktop');
  });

  it('should follow a username change without touching stored paths', () => {
    commons.setHomePath('/alice');
    expect(commons.expandHome('~/Desktop')).toBe('/alice/Desktop');
    commons.setHomePath('/alice-renamed');
    expect(commons.expandHome('~/Desktop')).toBe('/alice-renamed/Desktop');
  });
});

describe('resolvePath with a resolved home', () => {
  afterEach(() => commons.setHomePath(null));

  it('should resolve "~" to the concrete home directory', () => {
    commons.setHomePath('/alice');
    expect(commons.resolvePath('/anywhere', '~')).toBe('/alice');
    expect(commons.resolvePath('/anywhere', '~/Desktop')).toBe('/alice/Desktop');
  });

  it('should resolve relative paths against a concrete cwd', () => {
    commons.setHomePath('/alice');
    expect(commons.resolvePath('/alice', 'Desktop')).toBe('/alice/Desktop');
    expect(commons.resolvePath('/alice/Desktop', '..')).toBe('/alice');
  });
});

describe('isAbsolutePath', () => {
  it('should accept root- and home-anchored paths', () => {
    expect(commons.isAbsolutePath('/a/b')).toBe(true);
    expect(commons.isAbsolutePath('~')).toBe(true);
    expect(commons.isAbsolutePath('~/a')).toBe(true);
  });

  it('should reject relative paths and non-strings', () => {
    expect(commons.isAbsolutePath('a/b')).toBe(false);
    expect(commons.isAbsolutePath('..')).toBe(false);
    expect(commons.isAbsolutePath(undefined)).toBe(false);
  });
});

describe('resolveRemotePath', () => {
  it('should return absolute path as-is', () => {
    expect(commons.resolveRemotePath('/home/user', '/absolute/path')).toBe('/absolute/path');
  });

  it('should resolve relative path', () => {
    expect(commons.resolveRemotePath('/home/user', 'relative/path')).toBe('/home/user/relative/path');
  });

  it('should expand a home-anchored path against the resolved home', () => {
    commons.setHomePath('/alice');
    expect(commons.resolveRemotePath('/home/user', '~/site')).toBe('/alice/site');
    commons.setHomePath(null);
  });
});

describe('getVersionFromPackage', () => {
  it('should return version from package.json', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: '1.2.3' }));

    const version = await commons.getVersionFromPackage();

    expect(version).toBe('1.2.3');
  });

  it('should fallback to production package.json on dev error', async () => {
    vi.mocked(readFile)
      .mockRejectedValueOnce(new Error('File not found'))
      .mockResolvedValueOnce(JSON.stringify({ version: '2.0.0' }));

    const version = await commons.getVersionFromPackage();

    expect(version).toBe('2.0.0');
  });

  it('should return null on error', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

    const version = await commons.getVersionFromPackage();

    expect(version).toBeNull();
  });
});

describe('getLatestVersion', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should return up-to-date status when versions match', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-sh');

    expect(result).toBe('v1.0.0 (up-to-date)');
  });

  it('should return latest version when different', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-sh');

    expect(result).toBe('v1.0.0 (latest: 2.0.0)');
  });

  it('should return offline status when fetch fails', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await commons.getLatestVersion('puter-sh');

    expect(result).toBe('v1.0.0 (offline)');
  });

  it('should handle unknown current version', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Read error'));
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-sh');

    expect(result).toBe('vunknown (latest: 2.0.0)');
  });
});
