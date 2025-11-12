import { describe, vi, expect, it } from "vitest";
import { infoSite, listSites } from "../src/commands/sites";
import { getSubdomains } from "../src/commands/subdomains";
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
      created_at: new Date().toISOString(),
      protected: false
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
      created_at: new Date().toISOString(),
      protected: false
    });
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        get: mockHostingGet
      }
    })

    await infoSite("hehe.puter.site")
    expect(getPuter).toHaveBeenCalled();
    expect(mockHostingGet).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hehe.puter.site"))
  })
})