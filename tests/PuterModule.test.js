import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.spyOn(console, 'log').mockImplementation(() => { });

const mockSetAuthToken = vi.hoisted(() => vi.fn());

vi.mock('conf', () => {
  const Conf = vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'selected_profile') return 'test-uuid';
      if (key === 'profiles') return [{
        uuid: 'test-uuid',
        token: 'test-token'
      }];
      return null;
    }),
    set: vi.fn(),
    clear: vi.fn(),
  }));
  return { default: Conf };
});

vi.mock('@heyputer/puter.js', () => ({
  puter: {
    setAuthToken: mockSetAuthToken,
  }
}));

let initPuterModule;
let getPuter;

beforeEach(async () => {
  vi.resetModules();
  const module = await import('../src/modules/PuterModule.js');
  initPuterModule = module.initPuterModule;
  getPuter = module.getPuter;
});

describe('initPuterModule', () => {
  it('should call setAuthToken when initialized', () => {
    initPuterModule();
    expect(mockSetAuthToken).toHaveBeenCalledWith(expect.stringContaining('test-token'));
  });
});

describe('getPuter', () => {
  it('should return puter module if initialized', () => {
    initPuterModule();
    const result = getPuter();
    expect(result).toBeDefined();
  });

  it('should throw error if not initialized', () => {
    expect(() => getPuter()).toThrow('Call initPuterModule() first');
  });
});