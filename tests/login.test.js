import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getUserInfo, isAuthenticated, getAuthToken, getCurrentUserName, 
  getCurrentDirectory, getUsageInfo } from '../src/commands/auth.js';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Conf from 'conf';
import { BASE_URL, PROJECT_NAME, API_BASE } from '../src/commons.js';
import { ProfileAPI } from '../src/modules/ProfileModule.js';
import * as contextHelpers from '../src/temporary/context_helpers.js';

// Mock console to prevent actual logging
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock dependencies
vi.mock('inquirer');
vi.mock('chalk', () => ({
  default: {
    green: vi.fn(text => text),
    red: vi.fn(text => text),
    dim: vi.fn(text => text),
    yellow: vi.fn(text => text),
    cyan: vi.fn(text => text),
  }
}));
vi.mock('node-fetch');

// Create a mock spinner object
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
};

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner)
}));

// Mock Conf
vi.mock('conf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      get: vi.fn(),
      clear: vi.fn(),
    })),
  };
});

const mockProfileModule = {
  switchProfileWizard: vi.fn(),
  getAuthToken: vi.fn(),
  getCurrentProfile: vi.fn(),
};

const mockContext = {
  [ProfileAPI]: mockProfileModule,
};

vi.spyOn(contextHelpers, 'get_context').mockReturnValue(mockContext);


describe('auth.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      await login({}, mockContext);
      expect(mockProfileModule.switchProfileWizard).toHaveBeenCalled();
    });

    it('should fail login with invalid credentials', async () => {
      mockProfileModule.switchProfileWizard.mockRejectedValue(new Error('Invalid credentials'));
      await expect(login({}, mockContext)).rejects.toThrow('Invalid credentials');
      expect(mockProfileModule.switchProfileWizard).toHaveBeenCalled();
    });

    it.skip('should handle login error', async () => {
      // This test needs to be updated to reflect the new login flow
    });
  });


  describe('logout', () => {
    let config;

    beforeEach(() => {
      vi.clearAllMocks();
      config = new Conf({ projectName: PROJECT_NAME });
    });

    it.skip('should logout successfully', async () => {
      // This test needs to be updated to reflect the new login flow
    });

    it('should handle already logged out', async () => {
      config.get = vi.fn().mockReturnValue(null);
      await logout();
      expect(mockSpinner.info).toHaveBeenCalledWith(chalk.yellow('Already logged out'));
    });

    it.skip('should handle logout error', async () => {
      // This test needs to be updated to reflect the new login flow
    });
    
  });
  

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      mockProfileModule.getAuthToken.mockReturnValue('testtoken');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({
          username: 'testuser',
        }),
        ok: true,
      });

      await getUserInfo();

      expect(fetch).toHaveBeenCalledWith(`${API_BASE}/whoami`, {
        method: 'GET',
        headers: expect.any(Object),
      });
    });

    it('should handle fetch user info error', async () => {
      mockProfileModule.getAuthToken.mockReturnValue('testtoken');
      fetch.mockRejectedValue(new Error('Network error'));
      await getUserInfo();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get user info.'));
    });
  });


  describe('Authentication', () => {
    it('should return false if auth token does not exist', () => {
      mockProfileModule.getAuthToken.mockReturnValue(null);
      const result = isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return null if the auth_token is not defined', () => {
      mockProfileModule.getAuthToken.mockReturnValue(null);
      const result = getAuthToken();
      expect(result).toBe(null);
    });

    it('should return the current username if it is defined', () => {
      mockProfileModule.getCurrentProfile.mockReturnValue({ username: 'testuser' });
      const result = getCurrentUserName();
      expect(result).toBe('testuser');
    });

  });

  describe('getUsageInfo', () => {
    it('should fetch usage info successfully', async () => {
      mockProfileModule.getAuthToken.mockReturnValue('testtoken');
      fetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: true,
      });

      await getUsageInfo();

      expect(fetch).toHaveBeenCalledWith(`${API_BASE}/drivers/usage`, {
        method: 'GET',
        headers: expect.any(Object),
      });
    });

    it('should handle fetch usage info error', async () => {
      mockProfileModule.getAuthToken.mockReturnValue('testtoken');
      fetch.mockRejectedValue(new Error('Network error'));
      await getUsageInfo();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch usage information.'));
    });
  });
  

});