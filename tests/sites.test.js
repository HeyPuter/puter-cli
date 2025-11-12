import { describe, vi, expect, it } from "vitest";
import { createSite, deleteSite, infoSite, listSites } from "../src/commands/sites";
import { createSubdomain, deleteSubdomain, getSubdomains } from "../src/commands/subdomains";
import { getPuter } from "../src/modules/PuterModule.js";

vi.mock("../src/commands/subdomains")
vi.mock("../src/modules/PuterModule")
vi.spyOn(console, "log").mockImplementation(() => { });

describe("listSites", () => {
  it("should list sites successfully", async () => {
    vi.mocked(getSubdomains).mockResolvedValue([{
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/some/path" },
    }])
    await listSites();
    expect(getSubdomains).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Total Sites: 1"))
  })
})

describe("infoSite", () => {
  it("should get site info successfully", async () => {
    const mockHostingGet = vi.fn().mockResolvedValue({
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/some/path" },
    });
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        get: mockHostingGet
      }
    })

    await infoSite(["hehe.puter.site"])
    expect(getPuter).toHaveBeenCalled();
    expect(mockHostingGet).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hehe.puter.site"))
  })
})

describe("deleteSite", () => {
  it("should delete site successfully", async () => {
    vi.mocked(deleteSubdomain)
    const result = await deleteSite(["hehe.puter.site"]);
    expect(result).toBe(true);
  })
})

describe("createSite", () => {
  it("should create site successfully", async () => {
    vi.mocked(createSubdomain).mockResolvedValue({
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/some/path" },
    })
    const result = await createSite(["hehe hehe --subdomain=hehe"]);
    expect(result).toMatchObject({
      subdomain: "hehe.puter.site"
    })
  })
})
