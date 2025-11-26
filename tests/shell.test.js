import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execCommand, getPrompt } from '../src/executor.js';
import { getProfileModule } from '../src/modules/ProfileModule.js';
import readline from 'node:readline';

vi.mock('../src/executor.js');
vi.mock('../src/modules/ProfileModule.js');
vi.mock('node:readline');
vi.mock('conf', () => {
  const Conf = vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  }));
  return { default: Conf };
});

vi.spyOn(console, 'log').mockImplementation(() => { });
vi.spyOn(console, 'error').mockImplementation(() => { });

let updatePrompt;
let startShell;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  vi.mocked(getPrompt).mockReturnValue('puter@/> ');
  vi.mocked(getProfileModule).mockReturnValue({
    checkLogin: vi.fn(),
  });

  const mockOn = vi.fn().mockReturnThis();
  vi.mocked(readline.createInterface).mockReturnValue({
    setPrompt: vi.fn(),
    prompt: vi.fn(),
    on: mockOn,
  });

  const module = await import('../src/commands/shell.js');
  updatePrompt = module.updatePrompt;
  startShell = module.startShell;
});

describe('updatePrompt', () => {
  it('should call rl.setPrompt with getPrompt result', async () => {
    await startShell();
    const rl = readline.createInterface.mock.results[0].value;
    rl.setPrompt.mockClear();

    updatePrompt('/test/path');

    expect(rl.setPrompt).toHaveBeenCalledWith('puter@/> ');
  });
});

describe('startShell', () => {
  it('should call checkLogin', async () => {
    await startShell();
    expect(getProfileModule().checkLogin).toHaveBeenCalled();
  });

  describe('with command argument', () => {
    let mockExit;

    beforeEach(() => {
      mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      mockExit.mockRestore();
    });

    it('should execute command and exit when command is provided', async () => {
      await expect(startShell('help')).rejects.toThrow('process.exit called');
      expect(execCommand).toHaveBeenCalledWith('help');
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should not create readline interface when command is provided', async () => {
      vi.mocked(readline.createInterface).mockClear();
      await expect(startShell('help')).rejects.toThrow('process.exit called');
      expect(readline.createInterface).not.toHaveBeenCalled();
    });
  });

  describe('without command argument (interactive mode)', () => {
    it('should create readline interface', async () => {
      await startShell();
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: null,
      });
    });

    it('should display welcome message', async () => {
      await startShell();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Welcome to Puter-CLI'));
    });

    it('should set prompt and call prompt()', async () => {
      await startShell();
      const rl = readline.createInterface.mock.results[0].value;
      expect(rl.setPrompt).toHaveBeenCalledWith('puter@/> ');
      expect(rl.prompt).toHaveBeenCalled();
    });

    it('should register line and close event handlers', async () => {
      await startShell();
      const rl = readline.createInterface.mock.results[0].value;
      expect(rl.on).toHaveBeenCalledWith('line', expect.any(Function));
      expect(rl.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('line event handler', () => {
    let lineHandler;
    let rl;

    beforeEach(async () => {
      await startShell();
      rl = readline.createInterface.mock.results[0].value;
      lineHandler = rl.on.mock.calls.find(call => call[0] === 'line')[1];
    });

    it('should execute trimmed command', async () => {
      await lineHandler('  ls  ');
      expect(execCommand).toHaveBeenCalledWith('ls');
    });

    it('should not execute empty line', async () => {
      vi.mocked(execCommand).mockClear();
      await lineHandler('   ');
      expect(execCommand).not.toHaveBeenCalled();
    });

    it('should call prompt after executing command', async () => {
      rl.prompt.mockClear();
      await lineHandler('ls');
      expect(rl.prompt).toHaveBeenCalled();
    });

    it('should log error message when execCommand throws', async () => {
      vi.mocked(execCommand).mockRejectedValueOnce(new Error('Command failed'));
      await lineHandler('badcmd');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Command failed'));
    });

    it('should still call prompt after error', async () => {
      vi.mocked(execCommand).mockRejectedValueOnce(new Error('Command failed'));
      rl.prompt.mockClear();
      await lineHandler('badcmd');
      expect(rl.prompt).toHaveBeenCalled();
    });
  });

  describe('close event handler', () => {
    let closeHandler;
    let mockExit;

    beforeEach(async () => {
      mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { });
      await startShell();
      const rl = readline.createInterface.mock.results[0].value;
      closeHandler = rl.on.mock.calls.find(call => call[0] === 'close')[1];
    });

    afterEach(() => {
      mockExit.mockRestore();
    });

    it('should display goodbye message', () => {
      closeHandler();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Goodbye'));
    });

    it('should exit with code 0', () => {
      closeHandler();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});
