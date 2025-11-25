import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.spyOn(console, 'log').mockImplementation(() => { });
vi.spyOn(console, 'error').mockImplementation(() => { });

const mockGetAuthToken = vi.hoisted(() => vi.fn(() => 'mock-token'));
const mockFormatSize = vi.hoisted(() => vi.fn((size) => `${size} bytes`));
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('../src/commands/auth.js', () => ({
  getAuthToken: mockGetAuthToken,
}));

vi.mock('../src/utils.js', () => ({
  formatSize: mockFormatSize,
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

let commons;

beforeEach(async () => {
  vi.resetModules();
  mockGetAuthToken.mockReturnValue('mock-token');
  commons = await import('../src/commons.js');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('constants', () => {
  it('should export PROJECT_NAME', () => {
    expect(commons.PROJECT_NAME).toBe('puter-cli');
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

describe('generateAppName', () => {
  it('should generate a name with default separator', () => {
    const name = commons.generateAppName();

    expect(name).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  it('should generate a name with custom separator', () => {
    const name = commons.generateAppName('_');

    expect(name).toMatch(/^[a-z]+_[a-z]+_\d+$/);
  });
});

describe('displayTable', () => {
  it('should display a table with headers and data', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    const data = [
      { name: 'App1', status: 'running' },
      { name: 'App2', status: 'stopped' },
    ];

    commons.displayTable(data, {
      headers: ['Name', 'Status'],
      columns: ['name', 'status'],
      columnWidth: 15,
    });

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should handle empty data', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    commons.displayTable([], {
      headers: ['Name'],
      columns: ['name'],
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(2); // header + separator
  });

  it('should display N/A for missing values', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    const data = [{ name: 'App1' }];

    commons.displayTable(data, {
      headers: ['Name', 'Status'],
      columns: ['name', 'status'],
      columnWidth: 10,
    });

    const calls = consoleLogSpy.mock.calls.flat();
    expect(calls.some(call => call.includes('N/A'))).toBe(true);
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
    expect(mockFormatSize).toHaveBeenCalledWith('1000000000'); // capacity
    expect(mockFormatSize).toHaveBeenCalledWith('500000000'); // used
    expect(mockFormatSize).toHaveBeenCalledWith(500000000); // free space
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
});

describe('resolveRemotePath', () => {
  it('should return absolute path as-is', () => {
    expect(commons.resolveRemotePath('/home/user', '/absolute/path')).toBe('/absolute/path');
  });

  it('should resolve relative path', () => {
    expect(commons.resolveRemotePath('/home/user', 'relative/path')).toBe('/home/user/relative/path');
  });
});

describe('isValidAppName', () => {
  it('should return true for valid app name', () => {
    expect(commons.isValidAppName('my-app')).toBe(true);
  });

  it('should return true for app name with spaces', () => {
    expect(commons.isValidAppName('my app')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(commons.isValidAppName('')).toBe(false);
  });

  it('should return false for whitespace only', () => {
    expect(commons.isValidAppName('   ')).toBe(false);
  });

  it('should return false for reserved name "."', () => {
    expect(commons.isValidAppName('.')).toBe(false);
  });

  it('should return false for reserved name ".."', () => {
    expect(commons.isValidAppName('..')).toBe(false);
  });

  it('should return false for name with forward slash', () => {
    expect(commons.isValidAppName('my/app')).toBe(false);
  });

  it('should return false for name with backslash', () => {
    expect(commons.isValidAppName('my\\app')).toBe(false);
  });

  it('should return false for name with wildcard', () => {
    expect(commons.isValidAppName('my*app')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(commons.isValidAppName(123)).toBe(false);
    expect(commons.isValidAppName(null)).toBe(false);
    expect(commons.isValidAppName(undefined)).toBe(false);
  });
});

describe('getDefaultHomePage', () => {
  it('should generate HTML with app name', () => {
    const html = commons.getDefaultHomePage('TestApp');

    expect(html).toContain('<title>TestApp</title>');
    expect(html).toContain('Welcome to TestApp!');
  });

  it('should include CSS files when provided', () => {
    const html = commons.getDefaultHomePage('TestApp', [], ['style.css', 'theme.css']);

    expect(html).toContain('<link href="style.css" rel="stylesheet">');
    expect(html).toContain('<link href="theme.css" rel="stylesheet">');
  });

  it('should include JS files when provided', () => {
    const html = commons.getDefaultHomePage('TestApp', ['app.js', 'utils.js']);

    expect(html).toContain('<script type="text/babel" src="app.js"></script>');
    expect(html).toContain('<script  src="utils.js"></script>');
  });

  it('should use id="root" when react is included', () => {
    const html = commons.getDefaultHomePage('TestApp', ['react.js']);

    expect(html).toContain('id="root"');
  });

  it('should use id="app" when no react', () => {
    const html = commons.getDefaultHomePage('TestApp', ['vanilla.js']);

    expect(html).toContain('id="app"');
  });
});

describe('getVersionFromPackage', () => {
  it('should return version from package.json', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ version: '1.2.3' }));

    const version = await commons.getVersionFromPackage();

    expect(version).toBe('1.2.3');
  });

  it('should fallback to production package.json on dev error', async () => {
    mockReadFile
      .mockRejectedValueOnce(new Error('File not found'))
      .mockResolvedValueOnce(JSON.stringify({ version: '2.0.0' }));

    const version = await commons.getVersionFromPackage();

    expect(version).toBe('2.0.0');
  });

  it('should return null on error', async () => {
    mockReadFile.mockRejectedValue(new Error('Read error'));

    const version = await commons.getVersionFromPackage();

    expect(version).toBeNull();
  });
});

describe('getLatestVersion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return up-to-date status when versions match', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-cli');

    expect(result).toBe('v1.0.0 (up-to-date)');
  });

  it('should return latest version when different', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-cli');

    expect(result).toBe('v1.0.0 (latest: 2.0.0)');
  });

  it('should return offline status when fetch fails', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await commons.getLatestVersion('puter-cli');

    expect(result).toBe('v1.0.0 (offline)');
  });

  it('should handle unknown current version', async () => {
    mockReadFile.mockRejectedValue(new Error('Read error'));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    });

    const result = await commons.getLatestVersion('puter-cli');

    expect(result).toBe('vunknown (latest: 2.0.0)');
  });
});
