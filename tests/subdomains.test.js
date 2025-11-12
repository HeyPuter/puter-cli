import { vi } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { getSubdomains } from "../src/commands/subdomains";
import { expect } from "vitest";
import { getPuter } from "../src/modules/PuterModule";

vi.mock("../src/modules/PuterModule")
vi.mock("conf", () => {
  const Conf = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  }));
  return { default: Conf };
});

describe("getSubdomains", () => {
  it("should get subdomains successfully", async () => {
    const mockHostingList = vi.fn().mockResolvedValue([{
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/some/path" },
    }]);
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        list: mockHostingList
      }
    })
    const result = await getSubdomains();
    expect(getPuter).toHaveBeenCalled();
    expect(result).toHaveLength(1)
  })
})