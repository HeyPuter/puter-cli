import { describe, vi, expect, it } from "vitest";
import { listSites } from "../src/commands/sites";
import { getSubdomains } from "../src/commands/subdomains";

vi.mock("../src/commands/subdomains")
vi.spyOn(console, "log").mockImplementation(() => { });

describe("listSites", () => {
  it("should list sites successfully", async () => {
    vi.mocked(getSubdomains).mockResolvedValue([{
      uid: "123",
      subdomain: "hehe",
      root_dir: { path: "/some/path" },
      created_at: new Date().toISOString(),
      protected: false
    }])
    await listSites();
    expect(getSubdomains).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Total Sites: 1"))
  })
})