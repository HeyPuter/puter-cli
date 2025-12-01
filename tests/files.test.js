import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFile, listFiles, pathExists, makeDirectory, renameFileOrDirectory } from "../src/commands/files.js";
import chalk from "chalk";
import * as PuterModule from "../src/modules/PuterModule.js";
import * as auth from "../src/commands/auth.js";
import * as commons from "../src/commons.js";
import path from "path";
import * as utils from "../src/utils.js";

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
vi.mock("../src/utils.js");

const mockPuter = {
  fs: {
    stat: vi.fn(),
    space: vi.fn(),
    mkdir: vi.fn(),
    upload: vi.fn(),
    readdir: vi.fn(),
    move: vi.fn(),
    rename: vi.fn(),
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

describe("listFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PuterModule, "getPuter").mockReturnValue(mockPuter);
    vi.spyOn(auth, "getCurrentUserName").mockReturnValue("testuser");
    vi.spyOn(auth, "getCurrentDirectory").mockReturnValue("/testuser/files");
    vi.spyOn(commons, "resolvePath").mockImplementation((current, newPath) =>
      path.join(current, newPath)
    );
    vi.spyOn(utils, "formatSize").mockImplementation((size) => `${size}B`);
    vi.spyOn(utils, "formatDateTime").mockImplementation(() => "2024-01-01 12:00");
  });

  it("should list files successfully with mocked items", async () => {
    const mockFiles = [
      { name: "file1.txt", is_dir: false, writable: true, size: 1024, modified: 1704067200, uid: "abc-123-def-456" },
      { name: "folder1", is_dir: true, writable: true, size: 0, modified: 1704067200, uid: "ghi-789-jkl-012" },
    ];

    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockResolvedValue(mockFiles);

    await listFiles(["/testuser/files"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Listing files in")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("file1.txt")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("folder1")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("There are 2 object(s).")
    );
  });

  it("should handle empty directory", async () => {
    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockResolvedValue([]);

    await listFiles(["/testuser/files"]);

    expect(console.log).toHaveBeenCalledWith(
      chalk.red("No files or directories found.")
    );
  });

  it("should handle error when listing files fails", async () => {
    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockRejectedValue(new Error("Network error"));

    await listFiles(["/testuser/files"]);

    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Failed to list files.")
    );
    expect(console.error).toHaveBeenCalledWith(
      chalk.red("Error: Network error")
    );
  });

  it("should resolve relative path using getCurrentDirectory", async () => {
    const mockFiles = [
      { name: "test.txt", is_dir: false, writable: true, size: 512, modified: 1704067200, uid: "xyz-999-abc-111" },
    ];

    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockResolvedValue(mockFiles);

    await listFiles(["subdir"]);

    expect(commons.resolvePath).toHaveBeenCalledWith("/testuser/files", "subdir");
    expect(mockPuter.fs.readdir).toHaveBeenCalledWith("/testuser/files/subdir");
  });

  it("should use absolute path directly without resolving", async () => {
    const mockFiles = [
      { name: "test.txt", is_dir: false, writable: true, size: 512, modified: 1704067200, uid: "xyz-999-abc-111" },
    ];

    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockResolvedValue(mockFiles);

    await listFiles(["/absolute/path"]);

    expect(commons.resolvePath).not.toHaveBeenCalled();
    expect(mockPuter.fs.readdir).toHaveBeenCalledWith("/absolute/path");
  });

  it("should show message when path does not exist", async () => {
    mockPuter.fs.stat.mockRejectedValue({ code: "subject_does_not_exist" });

    await listFiles(["/nonexistent/path"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("doesn't exists!")
    );
    expect(mockPuter.fs.readdir).not.toHaveBeenCalled();
  });

  it("should list files when path exists", async () => {
    const mockFiles = [
      { name: "exists.txt", is_dir: false, writable: false, size: 256, modified: 1704067200, uid: "aaa-bbb-ccc-ddd" },
    ];

    mockPuter.fs.stat.mockResolvedValue({ id: "existing-dir" });
    mockPuter.fs.readdir.mockResolvedValue(mockFiles);

    await listFiles(["/existing/path"]);

    expect(mockPuter.fs.stat).toHaveBeenCalledWith("/existing/path");
    expect(mockPuter.fs.readdir).toHaveBeenCalledWith("/existing/path");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("exists.txt")
    );
  });

  it("should use current directory when no arguments provided", async () => {
    const mockFiles = [
      { name: "default.txt", is_dir: false, writable: true, size: 100, modified: 1704067200, uid: "def-ault-uid-000" },
    ];

    mockPuter.fs.stat.mockResolvedValue({ id: "dir-id" });
    mockPuter.fs.readdir.mockResolvedValue(mockFiles);

    await listFiles([]);

    expect(commons.resolvePath).toHaveBeenCalledWith("/testuser/files", ".");
  });
});

describe("makeDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PuterModule, "getPuter").mockReturnValue(mockPuter);
    vi.spyOn(auth, "getCurrentDirectory").mockReturnValue("/testuser/files");
  });

  it("should show usage when no arguments provided", async () => {
    await makeDirectory([]);

    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Usage: mkdir <directory_name>")
    );
    expect(mockPuter.fs.mkdir).not.toHaveBeenCalled();
  });

  it("should create directory successfully", async () => {
    mockPuter.fs.mkdir.mockResolvedValue({
      id: "new-dir-id",
      path: "/testuser/files/newdir",
      uid: "dir-uid-123",
    });

    await makeDirectory(["newdir"]);

    expect(mockPuter.fs.mkdir).toHaveBeenCalledWith("/testuser/files/newdir", {
      overwrite: false,
      dedupeName: true,
      createMissingParents: false,
    });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Directory "newdir" created successfully!')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Path: /testuser/files/newdir")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("UID: dir-uid-123")
    );
  });

  it("should handle case when mkdir returns invalid response", async () => {
    mockPuter.fs.mkdir.mockResolvedValue({});

    await makeDirectory(["newdir"]);

    expect(mockPuter.fs.mkdir).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Failed to create directory. Please check your input.")
    );
  });

  it("should handle case when mkdir returns null", async () => {
    mockPuter.fs.mkdir.mockResolvedValue(null);

    await makeDirectory(["newdir"]);

    expect(mockPuter.fs.mkdir).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Failed to create directory. Please check your input.")
    );
  });

  it("should handle error when mkdir throws", async () => {
    mockPuter.fs.mkdir.mockRejectedValue(new Error("Permission denied"));

    await makeDirectory(["newdir"]);

    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Failed to create directory.")
    );
    expect(console.error).toHaveBeenCalledWith(
      chalk.red("Error: Permission denied")
    );
  });
});

describe("renameFileOrDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PuterModule, "getPuter").mockReturnValue(mockPuter);
    vi.spyOn(auth, "getCurrentDirectory").mockReturnValue("/testuser/files");
    vi.spyOn(commons, "resolvePath").mockImplementation((current, newPath) =>
      path.join(current, newPath)
    );
  });

  it("should show usage when less than 2 arguments provided", async () => {
    await renameFileOrDirectory([]);
    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Usage: mv <source> <destination>")
    );

    vi.clearAllMocks();
    await renameFileOrDirectory(["onlyOne"]);
    expect(console.log).toHaveBeenCalledWith(
      chalk.red("Usage: mv <source> <destination>")
    );

    expect(mockPuter.fs.stat).not.toHaveBeenCalled();
  });

  it("should move file to directory successfully", async () => {
    // Source file exists
    mockPuter.fs.stat
      .mockResolvedValueOnce({ uid: "source-uid-123", name: "file.txt" }) // source stat
      .mockResolvedValueOnce({ is_dir: true }); // dest stat - it's a directory

    mockPuter.fs.move.mockResolvedValue({
      moved: { path: "/testuser/files/destdir/file.txt" },
    });

    await renameFileOrDirectory(["file.txt", "destdir"]);

    expect(mockPuter.fs.stat).toHaveBeenCalledWith("/testuser/files/file.txt");
    expect(mockPuter.fs.stat).toHaveBeenCalledWith("/testuser/files/destdir");
    expect(mockPuter.fs.move).toHaveBeenCalledWith(
      "source-uid-123",
      "/testuser/files/destdir",
      {
        overwrite: false,
        newName: "file.txt",
        createMissingParents: false,
      }
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Successfully moved")
    );
  });

  it("should rename file successfully when destination is not a directory", async () => {
    // Source file exists
    mockPuter.fs.stat
      .mockResolvedValueOnce({ uid: "source-uid-456", name: "oldname.txt" }) // source stat
      .mockRejectedValueOnce({ code: "subject_does_not_exist" }); // dest doesn't exist

    mockPuter.fs.rename.mockResolvedValue({
      path: "/testuser/files/newname.txt",
    });

    await renameFileOrDirectory(["oldname.txt", "newname.txt"]);

    expect(mockPuter.fs.stat).toHaveBeenCalledWith("/testuser/files/oldname.txt");
    expect(mockPuter.fs.rename).toHaveBeenCalledWith("source-uid-456", "newname.txt");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Successfully renamed")
    );
  });

  it("should handle absolute paths directly", async () => {
    mockPuter.fs.stat
      .mockResolvedValueOnce({ uid: "abs-uid", name: "source.txt" })
      .mockRejectedValueOnce({ code: "subject_does_not_exist" });

    mockPuter.fs.rename.mockResolvedValue({
      path: "/absolute/dest.txt",
    });

    await renameFileOrDirectory(["/absolute/source.txt", "/absolute/dest.txt"]);

    expect(commons.resolvePath).not.toHaveBeenCalled();
    expect(mockPuter.fs.stat).toHaveBeenCalledWith("/absolute/source.txt");
    expect(mockPuter.fs.rename).toHaveBeenCalledWith("abs-uid", "dest.txt");
  });
});
