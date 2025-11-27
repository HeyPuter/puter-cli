import { it } from "vitest";
import { beforeEach } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { vi } from "vitest";

const mockConfig = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  delete: vi.fn(),
};

vi.mock('conf', () => {
  const Conf = vi.fn(() => mockConfig);
  return { default: Conf };
});

vi.mock('../src/commons.js', () => ({
  BASE_URL: 'https://puter.com',
  NULL_UUID: '00000000-0000-0000-0000-000000000000',
  PROJECT_NAME: 'puter-cli',
  getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
  reconfigureURLs: vi.fn(),
}));

vi.mock('./PuterModule.js', () => ({
  initPuterModule: vi.fn(),
}));

let initProfileModule;
let getProfileModule;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mockConfig.get.mockReset();
  mockConfig.set.mockReset();
  mockConfig.delete.mockReset();
  const module = await import('../src/modules/ProfileModule');
  initProfileModule = module.initProfileModule;
  getProfileModule = module.getProfileModule;
});

describe("initProfileModule", () => {
  it("should initialize profile module", () => {
    initProfileModule();
    const profileModule = getProfileModule();
    expect(profileModule).toBeDefined();
  })
})

describe('getProfileModule', () => {
  it('should return profile module if initialized', () => {
    initProfileModule();
    const result = getProfileModule();
    expect(result).toBeDefined();
  });

  it('should throw error if not initialized', () => {
    expect(() => getProfileModule()).toThrow('Call initprofileModule() first');
  });
});

describe('ProfileModule.getProfiles', () => {
  it('should return profiles from config', () => {
    const mockProfiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com' },
      { uuid: '2', username: 'user2', host: 'https://puter.com' },
    ];
    mockConfig.get.mockReturnValue(mockProfiles);

    initProfileModule();
    const profileModule = getProfileModule();
    const profiles = profileModule.getProfiles();

    expect(profiles).toEqual(mockProfiles);
    expect(mockConfig.get).toHaveBeenCalledWith('profiles');
  });

  it('should return empty array if no profiles exist', () => {
    mockConfig.get.mockReturnValue(undefined);

    initProfileModule();
    const profileModule = getProfileModule();
    const profiles = profileModule.getProfiles();

    expect(profiles).toEqual([]);
  });
});

describe('ProfileModule.addProfile', () => {
  it('should add a new profile to existing profiles', () => {
    const existingProfiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com' },
    ];
    const newProfile = { uuid: '2', username: 'user2', host: 'https://puter.com' };
    mockConfig.get.mockReturnValue(existingProfiles);

    initProfileModule();
    const profileModule = getProfileModule();
    profileModule.addProfile(newProfile);

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [...existingProfiles, newProfile]);
  });

  it('should filter out transient profiles when adding', () => {
    const existingProfiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com', transient: true },
      { uuid: '2', username: 'user2', host: 'https://puter.com' },
    ];
    const newProfile = { uuid: '3', username: 'user3', host: 'https://puter.com' };
    mockConfig.get.mockReturnValue(existingProfiles);

    initProfileModule();
    const profileModule = getProfileModule();
    profileModule.addProfile(newProfile);

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      { uuid: '2', username: 'user2', host: 'https://puter.com' },
      newProfile,
    ]);
  });
});

describe('ProfileModule.selectProfile', () => {
  it('should set selected profile in config', () => {
    const profile = { uuid: 'test-uuid', username: 'testuser', host: 'https://puter.com' };
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return [profile];
      if (key === 'selected_profile') return 'test-uuid';
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    profileModule.selectProfile(profile);

    expect(mockConfig.set).toHaveBeenCalledWith('selected_profile', 'test-uuid');
    expect(mockConfig.set).toHaveBeenCalledWith('username', 'testuser');
    expect(mockConfig.set).toHaveBeenCalledWith('cwd', '/testuser');
  });
});

describe('ProfileModule.getCurrentProfile', () => {
  it('should return the currently selected profile', () => {
    const profiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com' },
      { uuid: '2', username: 'user2', host: 'https://puter.com' },
    ];
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return profiles;
      if (key === 'selected_profile') return '2';
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    const currentProfile = profileModule.getCurrentProfile();

    expect(currentProfile).toEqual(profiles[1]);
  });

  it('should return undefined if no profile matches', () => {
    const profiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com' },
    ];
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return profiles;
      if (key === 'selected_profile') return 'non-existent';
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    const currentProfile = profileModule.getCurrentProfile();

    expect(currentProfile).toBeUndefined();
  });
});

describe('ProfileModule.getAuthToken', () => {
  it('should return auth token for selected profile', () => {
    const profiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com', token: 'token1' },
      { uuid: '2', username: 'user2', host: 'https://puter.com', token: 'token2' },
    ];
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return profiles;
      if (key === 'selected_profile') return '2';
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    const token = profileModule.getAuthToken();

    expect(token).toBe('token2');
  });

  it('should return undefined if no profile is selected', () => {
    const profiles = [
      { uuid: '1', username: 'user1', host: 'https://puter.com', token: 'token1' },
    ];
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return profiles;
      if (key === 'selected_profile') return undefined;
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    const token = profileModule.getAuthToken();

    expect(token).toBeUndefined();
  });
});

describe('ProfileModule.getDefaultProfile', () => {
  it('should return default profile if auth_token exists', () => {
    mockConfig.get.mockImplementation((key) => {
      if (key === 'auth_token') return 'legacy-token';
      if (key === 'username') return 'legacyuser';
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    const defaultProfile = profileModule.getDefaultProfile();

    expect(defaultProfile).toEqual({
      host: 'puter.com',
      username: 'legacyuser',
      token: 'legacy-token',
    });
  });

  it('should return undefined if no auth_token exists', () => {
    mockConfig.get.mockReturnValue(undefined);

    initProfileModule();
    const profileModule = getProfileModule();
    const defaultProfile = profileModule.getDefaultProfile();

    expect(defaultProfile).toBeUndefined();
  });
});

describe('ProfileModule.migrateLegacyConfig', () => {
  it('should migrate legacy config to profile format', () => {
    mockConfig.get.mockImplementation((key) => {
      if (key === 'auth_token') return 'legacy-token';
      if (key === 'username') return 'legacyuser';
      if (key === 'profiles') return [];
      return undefined;
    });

    initProfileModule();
    const profileModule = getProfileModule();
    profileModule.migrateLegacyConfig();

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      {
        host: 'https://puter.com',
        username: 'legacyuser',
        cwd: '/legacyuser',
        token: 'legacy-token',
        uuid: '00000000-0000-0000-0000-000000000000',
      },
    ]);
    expect(mockConfig.delete).toHaveBeenCalledWith('auth_token');
    expect(mockConfig.delete).toHaveBeenCalledWith('username');
  });
});
