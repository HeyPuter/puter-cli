import { PuterAuth } from '../commands/auth.js';
// const { PuterAuth } = require('../commands/auth.js');


// Mock Config store
class MockConfig {
  constructor() {
    this.store = new Map();
  }
  
  set(key, value) {
    this.store.set(key, value);
  }
  
  get(key) {
    return this.store.get(key);
  }
  
  clear() {
    this.store.clear();
  }
}

// Mock successful fetch response
const mockSuccessfulFetch = () => 
  Promise.resolve({
    json: () => Promise.resolve({
      proceed: true,
      token: 'mock_token_123'
    })
  });

// Mock failed fetch response
const mockFailedFetch = () =>
  Promise.resolve({
    json: () => Promise.resolve({
      proceed: false,
      error: 'Invalid credentials'
    })
  });

describe('PuterAuth', () => {
  let auth;
  let mockConfig;

  beforeEach(() => {
    mockConfig = new MockConfig();
    auth = new PuterAuth(mockConfig);
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      auth = new PuterAuth(mockConfig, mockSuccessfulFetch);
      
      const result = await auth.login({
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock_token_123');
      expect(result.username).toBe('testuser');
      expect(mockConfig.get('auth_token')).toBe('mock_token_123');
      expect(mockConfig.get('username')).toBe('testuser');
    });

    it('should fail login with invalid credentials', async () => {
      auth = new PuterAuth(mockConfig, mockFailedFetch);
      
      const result = await auth.login({
        username: 'wronguser',
        password: 'wrongpass'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(mockConfig.get('auth_token')).toBeUndefined();
    });

    it('should handle network errors', async () => {
      const mockErrorFetch = () => Promise.reject(new Error('Network error'));
      auth = new PuterAuth(mockConfig, mockErrorFetch);
      
      const result = await auth.login({
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('logout', () => {
    it('should successfully logout when authenticated', async () => {
      mockConfig.set('auth_token', 'some_token');
      
      const result = await auth.logout();

      expect(result.success).toBe(true);
      expect(mockConfig.get('auth_token')).toBeUndefined();
    });

    it('should fail logout when not authenticated', async () => {
      const result = await auth.logout();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not logged in');
    });
  });

  describe('authentication checks', () => {
    it('should correctly report authentication status', () => {
      expect(auth.isAuthenticated()).toBe(false);
      
      mockConfig.set('auth_token', 'some_token');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should return correct auth token', () => {
      const token = 'test_token_123';
      mockConfig.set('auth_token', token);
      
      expect(auth.getAuthToken()).toBe(token);
    });
  });
});