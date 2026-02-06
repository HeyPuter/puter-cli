import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAIProxyServer, startAIProxyServer } from '../src/commands/ai.js';
import { getPuter } from '../src/modules/PuterModule.js';
import { getProfileModule } from '../src/modules/ProfileModule.js';

vi.mock('../src/modules/PuterModule.js', () => ({
  getPuter: vi.fn()
}));
vi.mock('../src/modules/ProfileModule.js', () => ({
  getProfileModule: vi.fn()
}));

let serverInstance;

const startServer = async (puterMock) => {
  vi.mocked(getPuter).mockReturnValue(puterMock);
  vi.mocked(getProfileModule).mockReturnValue({
    getAuthToken: vi.fn(() => 'test-token')
  });
  serverInstance = createAIProxyServer({ host: '127.0.0.1', port: 0 });
  const { port } = await serverInstance.start();
  return { port };
};

afterEach(async () => {
  if (serverInstance) {
    await serverInstance.stop();
    serverInstance = null;
  }
  vi.clearAllMocks();
});

describe('AI proxy server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves models list', async () => {
    const puterMock = {
      ai: {
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/v1/models`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.object).toBe('list');
    expect(data.data[0].id).toBe('gpt-4.1-nano');
  });

  it('serves root heartbeat', async () => {
    const puterMock = {
      ai: {
        listModels: vi.fn().mockResolvedValue([])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('serves non-streaming chat completion', async () => {
    const puterMock = {
      ai: {
        chat: vi.fn().mockResolvedValue('Hello there'),
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.object).toBe('chat.completion');
    expect(data.choices[0].message.content).toBe('Hello there');
  });

  it('passes testMode when provided', async () => {
    const chat = vi.fn().mockResolvedValue('Hello there');
    const puterMock = {
      ai: {
        chat,
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        testMode: true,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.choices[0].message.content).toBe('Hello there');
    expect(chat).toHaveBeenCalledWith('USER: Hi', true, expect.objectContaining({
      model: 'gpt-4.1-nano'
    }));
  });

  it('serves streaming chat completion', async () => {
    const puterMock = {
      ai: {
        chat: vi.fn().mockResolvedValue('Hello world'),
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        stream: true,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('data: ');
    expect(text).toContain('[DONE]');
  });

  it('rejects unknown model', async () => {
    const puterMock = {
      ai: {
        chat: vi.fn().mockResolvedValue('Hello world'),
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    };
    const { port } = await startServer(puterMock);
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'missing-model',
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.message).toContain('Unknown model');
  });

  it('rejects unknown model before startup', async () => {
    vi.mocked(getProfileModule).mockReturnValue({
      getAuthToken: vi.fn(() => 'test-token')
    });
    const listModels = vi.fn().mockResolvedValue(['gpt-4.1-nano']);
    vi.mocked(getPuter).mockReturnValue({
      ai: {
        listModels
      }
    });
    const server = await startAIProxyServer({ model: 'missing-model', port: 0 });
    expect(server).toBeNull();
    expect(listModels).toHaveBeenCalled();
  });

  it('starts server when model exists', async () => {
    vi.mocked(getProfileModule).mockReturnValue({
      getAuthToken: vi.fn(() => 'test-token')
    });
    vi.mocked(getPuter).mockReturnValue({
      ai: {
        listModels: vi.fn().mockResolvedValue(['gpt-4.1-nano'])
      }
    });
    const server = await startAIProxyServer({ model: 'gpt-4.1-nano', port: 0 });
    await server.stop();
  });
});
