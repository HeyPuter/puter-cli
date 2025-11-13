import { it, describe, expect, vi, beforeEach } from "vitest";

vi.spyOn(console, "log").mockImplementation(() => { });
vi.spyOn(console, "error").mockImplementation(() => { });

let errors, report, ERROR_BUFFER_LIMIT, showLast;

beforeEach(async () => {
  vi.resetModules();
  const module = await import("../src/modules/ErrorModule");
  errors = module.errors;
  report = module.report;
  ERROR_BUFFER_LIMIT = module.ERROR_BUFFER_LIMIT;
  showLast = module.showLast;
});

describe("report", () => {
  it("should be able to report error", () => {
    report("hehe")
    expect(errors).toHaveLength(1)
  })

  it("should not exceed error buffer limit", () => {
    for (let i = 0; i < 100; i++) {
      report(`error ${i}`)
    }
    expect(errors.length).lessThanOrEqual(ERROR_BUFFER_LIMIT);
  })
})

describe("showLast", () => {
  it("should not log error if no error exists", () => {
    showLast();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No errors to report"));
  })

  it("should log error if error exists", () => {
    report("hehe")
    showLast();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("hehe"));
  })
})