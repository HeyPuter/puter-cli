import { it } from "vitest";
import { beforeEach } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { vi } from "vitest";

vi.mock('conf', () => {
  const Conf = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  }));
  return { default: Conf };
});

let initProfileModule;
let getProfileModule;

beforeEach(async () => {
  vi.resetModules();
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