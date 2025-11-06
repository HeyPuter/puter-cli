import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listApps, appInfo, createApp, updateApp, deleteApp } from '../src/commands/apps.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as PuterModule from '../src/modules/PuterModule.js';
import * as subdomains from '../src/commands/subdomains.js';
import * as sites from '../src/commands/sites.js';
import * as files from '../src/commands/files.js';
import * as auth from '../src/commands/auth.js';
import * as commons from '../src/commons.js';
import * as utils from '../src/utils.js';
import crypto from '../src/crypto.js';

// Mock console to prevent actual logging
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock("conf", () => {
  const Conf = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  }));
  return { default: Conf };
});

// Mock dependencies
vi.mock('chalk', () => ({
  default: {
    green: vi.fn(text => text),
    red: vi.fn(text => text),
    dim: vi.fn(text => text),
    yellow: vi.fn(text => text),
    cyan: vi.fn(text => text),
    cyanBright: vi.fn(text => text),
    bold: vi.fn(text => text),
  }
}));
vi.mock('cli-table3');
vi.mock('node-fetch');
vi.mock('../src/modules/PuterModule.js');
vi.mock('../src/commands/subdomains.js');
vi.mock('../src/commands/sites.js');
vi.mock('../src/commands/files.js');
vi.mock('../src/commands/auth.js');
vi.mock('../src/commons.js');
vi.mock('../src/utils.js');
vi.mock('../src/crypto.js');

const mockPuter = {
  apps: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  fs: {
    mkdir: vi.fn(),
  },
};

describe('apps.js', () => {
  let mockTable;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PuterModule, 'getPuter').mockReturnValue(mockPuter);
    vi.spyOn(auth, 'getCurrentDirectory').mockReturnValue('/testuser');
    vi.spyOn(commons, 'isValidAppName').mockReturnValue(true);
    vi.spyOn(commons, 'resolvePath').mockImplementation((_, newPath) => newPath);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid');

    mockTable = {
      push: vi.fn(),
      toString: vi.fn(() => 'table string'),
    };
    Table.mockImplementation(() => mockTable);
  });

  describe('listApps', () => {
    it('should list apps successfully', async () => {
      const mockApps = [
        { title: 'App 1', name: 'app-1', created_at: new Date().toISOString(), index_url: 'https://app-1.puter.site', stats: { open_count: 10, user_count: 5 } },
        { title: 'App 2', name: 'app-2', created_at: new Date().toISOString(), index_url: 'https://app-2.puter.site', stats: { open_count: 20, user_count: 15 } },
      ];
      mockPuter.apps.list.mockResolvedValue(mockApps);
      vi.spyOn(utils, 'formatDate').mockReturnValue('formatted-date');

      await listApps();

      expect(mockPuter.apps.list).toHaveBeenCalled();
      expect(mockTable.push).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith('table string');
    });

    it('should handle API error when listing apps', async () => {
      mockPuter.apps.list.mockRejectedValue(new Error('API Error'));
      await listApps();
      expect(console.error).toHaveBeenCalledWith('Failed to list apps. Error: API Error');
    });
  });

  describe('appInfo', () => {
    it('should show app info successfully', async () => {
        const mockApp = { name: 'test-app', title: 'Test App' };
        mockPuter.apps.get.mockResolvedValue(mockApp);
        vi.spyOn(utils, 'displayNonNullValues').mockImplementation(() => {});

        await appInfo(['test-app']);

        expect(mockPuter.apps.get).toHaveBeenCalledWith('test-app');
        expect(utils.displayNonNullValues).toHaveBeenCalledWith(mockApp);
    });

    it('should show usage if no app name is provided', async () => {
        await appInfo([]);
        expect(console.log).toHaveBeenCalledWith(chalk.red('Usage: app <name>'));
    });

    it('should handle app not found', async () => {
        mockPuter.apps.get.mockResolvedValue(null);
        await appInfo(['non-existent-app']);
        expect(console.error).toHaveBeenCalledWith(chalk.red('Could not find this app.'));
    });
  });

  describe('createApp', () => {
    beforeEach(() => {
        mockPuter.apps.create.mockResolvedValue({ uid: 'app-uid', name: 'new-app', owner: { username: 'testuser' } });
        mockPuter.fs.mkdir.mockResolvedValue({ uid: 'dir-uid', name: 'app-mock-uuid' });
        vi.spyOn(subdomains, 'createSubdomain').mockResolvedValue(true);
        vi.spyOn(files, 'createFile').mockResolvedValue(true);
        mockPuter.apps.update.mockResolvedValue(true);
    })
    it('should create an app successfully', async () => {
      await createApp({ name: 'new-app' });

      expect(mockPuter.apps.create).toHaveBeenCalled();
      expect(mockPuter.fs.mkdir).toHaveBeenCalled();
      expect(subdomains.createSubdomain).toHaveBeenCalled();
      expect(files.createFile).toHaveBeenCalled();
      expect(mockPuter.apps.update).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(chalk.green('App deployed successfully at:'));
    });

    it('should show usage if app name is invalid', async () => {
        vi.spyOn(commons, 'isValidAppName').mockReturnValue(false);
        await createApp({ name: 'invalid-' });
        expect(console.log).toHaveBeenCalledWith(chalk.red('Usage: app:create <name> <directory>'));
    });
  });

  describe('updateApp', () => {
    it('should update an app successfully', async () => {
        mockPuter.apps.get.mockResolvedValue({ uid: 'app-uid', name: 'test-app', owner: { username: 'testuser' }, index_url: 'https://test.puter.site' });
        vi.spyOn(files, 'pathExists').mockResolvedValue(true);
        vi.spyOn(subdomains, 'getSubdomains').mockResolvedValue([{ root_dir: { dirname: 'app-uid', path: '/path/to/app' }, uid: 'sub-uid' }]);
        vi.spyOn(files, 'listRemoteFiles').mockResolvedValue([{ name: 'index.html' }]);
        vi.spyOn(files, 'copyFile').mockResolvedValue(true);
        vi.spyOn(files, 'removeFileOrDirectory').mockResolvedValue(true);

        await updateApp(['test-app', '.']);

        expect(mockPuter.apps.get).toHaveBeenCalledWith('test-app');
        expect(files.listRemoteFiles).toHaveBeenCalled();
        expect(files.copyFile).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(chalk.green('App updated successfully at:'));
    });
  });

  describe('deleteApp', () => {
    it('should delete an app successfully', async () => {
        mockPuter.apps.get.mockResolvedValue({ uid: 'app-uid', name: 'test-app', title: 'Test App', created_at: new Date().toISOString() });
        mockPuter.apps.delete.mockResolvedValue(true);
        vi.spyOn(subdomains, 'getSubdomains').mockResolvedValue([{ root_dir: { dirname: 'app-uid' }, uid: 'sub-uid' }]);
        vi.spyOn(sites, 'deleteSite').mockResolvedValue(true);

        const result = await deleteApp('test-app');

        expect(result).toBe(true);
        expect(mockPuter.apps.delete).toHaveBeenCalledWith('test-app');
        expect(sites.deleteSite).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(chalk.green('App "test-app" deleted successfully!'));
    });

     it('should return false if app not found', async () => {
        mockPuter.apps.get.mockResolvedValue(null);
        const result = await deleteApp('non-existent-app');
        expect(result).toBe(false);
        expect(console.log).toHaveBeenCalledWith(chalk.red('App "non-existent-app" not found.'));
    });
  });
});