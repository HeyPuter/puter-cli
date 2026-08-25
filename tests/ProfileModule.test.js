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
  HOME: '~',
  PROJECT_NAME: 'puter-sh',
  getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
  reconfigureURLs: vi.fn(),
  setHomePath: vi.fn(),
  expandHome: vi.fn((p) => p),
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
    // username and cwd live on the profile now, not at the top level.
    expect(mockConfig.set).not.toHaveBeenCalledWith('username', expect.anything());
    expect(mockConfig.set).not.toHaveBeenCalledWith('cwd', expect.anything());
    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      expect.objectContaining({ uuid: 'test-uuid', cwd: '/testuser' }),
    ]);
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

describe('ProfileModule.rehomePaths', () => {
  const setup = (cwd, profile) => {
    const stored = { ...profile, cwd };
    mockConfig.get.mockImplementation((key) => {
      if (key === 'profiles') return [stored];
      if (key === 'selected_profile') return stored.uuid;
      return undefined;
    });
    initProfileModule();
    return getProfileModule();
  };

  it('should re-point the cwd at the new home after a rename', () => {
    const profile = { uuid: 'p1', username: 'oldname', cwd: '/oldname', host: 'https://puter.com' };
    const profileModule = setup('/oldname/Desktop/notes', profile);

    profileModule.rehomePaths('oldname', 'newname');

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      expect.objectContaining({ cwd: '/newname/Desktop/notes' }),
    ]);
  });

  it('should re-point a cwd sitting exactly at the old home', () => {
    const profile = { uuid: 'p1', username: 'oldname', cwd: '/oldname', host: 'https://puter.com' };
    const profileModule = setup('/oldname', profile);

    profileModule.rehomePaths('oldname', 'newname');

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      expect.objectContaining({ cwd: '/newname' }),
    ]);
  });

  it('should leave a cwd under another user\'s tree alone', () => {
    const profile = { uuid: 'p1', username: 'oldname', cwd: '/oldname', host: 'https://puter.com' };
    const profileModule = setup('/someoneelse/public', profile);

    profileModule.rehomePaths('oldname', 'newname');

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      expect.objectContaining({ cwd: '/someoneelse/public' }),
    ]);
  });

  it('should not rewrite a prefix that only partially matches', () => {
    const profile = { uuid: 'p1', username: 'bob', cwd: '/bob', host: 'https://puter.com' };
    const profileModule = setup('/bobby/files', profile);

    profileModule.rehomePaths('bob', 'robert');

    expect(mockConfig.set).toHaveBeenCalledWith('profiles', [
      expect.objectContaining({ cwd: '/bobby/files' }),
    ]);
  });

  it('should do nothing when the username is unchanged', () => {
    const profile = { uuid: 'p1', username: 'bob', cwd: '/bob', host: 'https://puter.com' };
    const profileModule = setup('/bob/files', profile);

    profileModule.rehomePaths('bob', 'bob');

    expect(mockConfig.set).not.toHaveBeenCalled();
  });
});
