import { it, describe, expect, vi, beforeEach } from "vitest";

vi.spyOn(console, "log").mockImplementation(() => { });
vi.spyOn(console, "error").mockImplementation(() => { });

let errors, report, ERROR_BUFFER_LIMIT, showLast;
let normalizeError, isAuthError, formatError;

beforeEach(async () => {
  vi.resetModules();
  const module = await import("../src/modules/ErrorModule");
  errors = module.errors;
  report = module.report;
  ERROR_BUFFER_LIMIT = module.ERROR_BUFFER_LIMIT;
  showLast = module.showLast;
  normalizeError = module.normalizeError;
  isAuthError = module.isAuthError;
  formatError = module.formatError;
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

describe('normalizeError', () => {
  it('should turn a plain rejected object into a real Error', () => {
    // The shape puter.js rejects with, which Node renders as "#<Object>".
    const err = normalizeError({ status: 401, message: 'Unauthorized' });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Unauthorized');
    expect(err.status).toBe(401);
  });

  it('should unwrap a nested driver error', () => {
    const err = normalizeError({ error: { code: 'permission_denied', message: 'Nope' } });

    expect(err.message).toBe('Nope');
    expect(err.code).toBe('permission_denied');
  });

  it('should fall back to the code when there is no message', () => {
    expect(normalizeError({ code: 'subject_does_not_exist' }).message)
      .toBe('subject_does_not_exist');
  });

  it('should never render an object as "#<Object>"', () => {
    const err = normalizeError({ status: 500 });

    expect(err.message).not.toContain('#<Object>');
    expect(err.message).toBe('{"status":500}');
  });

  it('should pass an Error through untouched', () => {
    const original = new Error('boom');
    expect(normalizeError(original)).toBe(original);
  });

  it('should handle non-object throws', () => {
    expect(normalizeError('bad thing').message).toBe('bad thing');
    expect(normalizeError(undefined).message).toBe('Unknown error');
  });
});

describe('isAuthError', () => {
  it('should detect the 401 that puter.js rejects with', () => {
    expect(isAuthError({ status: 401, message: 'Unauthorized' })).toBe(true);
  });

  it('should detect a 403', () => {
    expect(isAuthError({ status: 403, message: 'Forbidden' })).toBe(true);
  });

  it('should detect token failure codes', () => {
    expect(isAuthError({ code: 'token_auth_failed' })).toBe(true);
    expect(isAuthError({ error: { code: 'invalid_token' } })).toBe(true);
  });

  it('should not flag unrelated failures', () => {
    expect(isAuthError({ status: 500, message: 'Server error' })).toBe(false);
    expect(isAuthError({ code: 'subject_does_not_exist' })).toBe(false);
    expect(isAuthError(new Error('ENOTFOUND api.puter.com'))).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe('formatError', () => {
  it('should give a readable message for a rejected plain object', () => {
    expect(formatError({ status: 401, message: 'Unauthorized' })).toBe('Unauthorized');
  });
});
