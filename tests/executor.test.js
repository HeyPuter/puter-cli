import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('conf', () => ({
  default: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'cwd') return '/mockuser';
      return null;
    }),
  })),
}));

vi.mock('node:child_process');

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

let executor;
let execMock;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  const childProcess = await import('node:child_process');
  execMock = vi.mocked(childProcess.exec);

  executor = await import('../src/executor.js');
});

describe('getPrompt', () => {
  it('should contain puter@<cwd name>', () => {
    const prompt = executor.getPrompt();

    expect(prompt).toContain('puter@mockuser');
  });
});

describe('showHelp', () => {
  it('should display available commands', async () => {
    await executor.execCommand('help');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Available commands'));
  });
});

describe('host command (!)', () => {
  it('should call exec with the command after !', async () => {
    await executor.execCommand('!ls -la');

    expect(execMock).toHaveBeenCalledWith('ls -la', expect.any(Function));
  });
});
