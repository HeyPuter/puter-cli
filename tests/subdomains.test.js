import { vi } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { createSubdomain, deleteSubdomain, getSubdomains, updateSubdomain } from "../src/commands/subdomains";
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

vi.spyOn(console, "log").mockImplementation(() => { });

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

describe("deleteSubdomain", () => {
  it("should delete subdomain successfully", async () => {
    const mockHostingDelete = vi.fn().mockResolvedValue(true);
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        delete: mockHostingDelete
      }
    })
    const result = await deleteSubdomain(["hehe.puter.site"]);
    expect(result).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Subdomain deleted successfully"));
  })
})

describe("createSubdomain", () => {
  it("should create subdomain successfully", async () => {
    const mockHostingCreate = vi.fn().mockResolvedValue({
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/some/path" },
    });
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        create: mockHostingCreate
      }
    })
    const result = await createSubdomain("hehe", "/mydir")
    expect(result).toMatchObject({
      subdomain: "hehe.puter.site"
    })
  })
})

describe("updateSubdomain", () => {
  it("should update subdomain successfully", async () => {
    const mockHostingUpdate = vi.fn().mockResolvedValue({
      uid: "123",
      subdomain: "hehe.puter.site",
      root_dir: { path: "/newdir" },
    });
    vi.mocked(getPuter).mockReturnValue({
      hosting: {
        update: mockHostingUpdate
      }
    })
    const result = await updateSubdomain("hehe", "/newdir")
    expect(result).toMatchObject({
      root_dir: {
        path: "/newdir"
      }
    })
  })
})
