import { describe, vi, expect, it, beforeEach } from "vitest";

vi.mock('conf', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

vi.mock("../src/commands/files");
vi.mock("../src/commands/sites");
vi.mock("../src/modules/PuterModule");

vi.spyOn(console, "log").mockImplementation(() => { });

let deploy;
let syncDirectory;
let createSite;
let getPuter;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const deployModule = await import("../src/commands/deploy");
  deploy = deployModule.deploy;

  const filesModule = await import("../src/commands/files");
  syncDirectory = vi.mocked(filesModule.syncDirectory);

  const sitesModule = await import("../src/commands/sites");
  createSite = vi.mocked(sitesModule.createSite);

  const puterModule = await import("../src/modules/PuterModule");
  getPuter = vi.mocked(puterModule.getPuter);
});

describe("deploy", () => {
  it("should show usage when no args provided", async () => {
    await deploy([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("should deploy successfully", async () => {
    const mockMkdir = vi.fn().mockResolvedValue({
      path: "~/sites/test-app/deployment"
    });
    getPuter.mockReturnValue({
      fs: {
        mkdir: mockMkdir
      }
    });
    syncDirectory.mockResolvedValue();
    createSite.mockResolvedValue({
      subdomain: "test-app.puter.site"
    });

    await deploy(["./dist", "--subdomain=test-app"]);

    expect(mockMkdir).toHaveBeenCalledWith("~/sites/test-app/deployment", {
      dedupeName: true,
      createMissingParents: true
    });
    expect(syncDirectory).toHaveBeenCalled();
    expect(createSite).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Deployment successful!"));
  });

  it("should show updated message when site already exists", async () => {
    const mockMkdir = vi.fn().mockResolvedValue({
      path: "~/sites/test-app/deployment"
    });
    getPuter.mockReturnValue({
      fs: {
        mkdir: mockMkdir
      }
    });
    syncDirectory.mockResolvedValue();
    createSite.mockResolvedValue(null);

    await deploy(["./dist", "--subdomain=test-app"]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Deployment successfuly updated!"));
  });
});
