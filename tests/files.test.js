import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFile } from "../src/commands/files.js";
import chalk from "chalk";
import * as PuterModule from "../src/modules/PuterModule.js";
import * as auth from "../src/commands/auth.js";
import * as commons from "../src/commons.js";
import path from "path";

// Mock console to prevent actual logging
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// Mock dependencies
vi.mock("chalk", () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    dim: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
  },
}));
vi.mock("node-fetch");
vi.mock("conf", () => {
  const Conf = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  }));
  return { default: Conf };
});
vi.mock("../src/modules/PuterModule.js");
vi.mock("../src/commands/auth.js");
vi.mock("../src/commons.js");

const mockPuter = {
  fs: {
    stat: vi.fn(),
    space: vi.fn(),
    mkdir: vi.fn(),
    upload: vi.fn(),
  },
};

describe("createFile", () => {
    
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PuterModule, "getPuter").mockReturnValue(mockPuter);
    vi.spyOn(auth, "getCurrentUserName").mockReturnValue("testuser");
    vi.spyOn(auth, "getCurrentDirectory").mockReturnValue("/testuser/files");
    vi.spyOn(commons, "resolvePath").mockImplementation((current, newPath) =>
      path.join(current, newPath)
    );
  });

  it("should create a file successfully", async () => {
    mockPuter.fs.stat.mockRejectedValue({ code: "subject_does_not_exist" });
    mockPuter.fs.space.mockResolvedValue({ used: 500, capacity: 1000 });
    mockPuter.fs.upload.mockResolvedValue({
      name: "test.txt",
      path: "/testuser/files/test.txt",
      uid: "file-uid",
    });

    const result = await createFile(["test.txt", "hello world"]);

    expect(result).toBe(true);
    expect(mockPuter.fs.upload).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('File "test.txt" created successfully!')
    );
  });

  it("should show usage and return false if no arguments are provided", async () => {
    const result = await createFile([]);
    expect(result).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Usage: touch <file_name> [content]")
    );
  });

  it("should overwrite an existing file", async () => {
    mockPuter.fs.stat.mockResolvedValue({ id: "existing-file-id" });
    mockPuter.fs.space.mockResolvedValue({ used: 500, capacity: 1000 });
    mockPuter.fs.upload.mockResolvedValue({
      name: "test.txt",
      path: "/testuser/files/test.txt",
      uid: "file-uid",
    });

    const result = await createFile(["test.txt", "new content"]);

    expect(result).toBe(true);
    expect(console.log).toHaveBeenCalledWith(
      chalk.yellow('File "test.txt" already exists. It will be overwritten.')
    );
    expect(mockPuter.fs.upload).toHaveBeenCalled();
  });

  it("should return false if there is not enough disk space", async () => {
    mockPuter.fs.stat.mockRejectedValue({ code: "subject_does_not_exist" });
    mockPuter.fs.space.mockResolvedValue({ used: 1000, capacity: 1000 });
    vi.spyOn(commons, "showDiskSpaceUsage").mockImplementation(() => {});

    const result = await createFile(["test.txt"]);

    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      chalk.red("Not enough disk space to create the file.")
    );
    expect(commons.showDiskSpaceUsage).toHaveBeenCalled();
  });

  it("should create missing directories", async () => {
    // First stat for file fails, second for directory also fails
    mockPuter.fs.stat
      .mockRejectedValueOnce({ code: "subject_does_not_exist" }) // file check
      .mockRejectedValueOnce({ code: "subject_does_not_exist" }); // dir check
    mockPuter.fs.space.mockResolvedValue({ used: 500, capacity: 1000 });
    mockPuter.fs.mkdir.mockResolvedValue({});
    mockPuter.fs.upload.mockResolvedValue({
      name: "test.txt",
      path: "/testuser/files/newdir/test.txt",
      uid: "file-uid",
    });

    const result = await createFile(["newdir/test.txt", "content"]);

    expect(result).toBe(true);
    expect(mockPuter.fs.mkdir).toHaveBeenCalledWith("/testuser/files/newdir", {
      overwrite: false,
      dedupeName: true,
      createMissingParents: true,
    });
    expect(mockPuter.fs.upload).toHaveBeenCalled();
  });

  it("should handle API errors during file creation", async () => {
    mockPuter.fs.stat.mockRejectedValue({ code: "subject_does_not_exist" });
    mockPuter.fs.space.mockResolvedValue({ used: 500, capacity: 1000 });
    mockPuter.fs.upload.mockRejectedValue(new Error("API Error"));

    const result = await createFile(["test.txt"]);

    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      chalk.red("Failed to create file.\nError: API Error")
    );
  });
});
