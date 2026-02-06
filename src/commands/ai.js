import chalk from 'chalk';
import crypto from '../crypto.js';
import { getPuter } from '../modules/PuterModule.js';
import { getProfileModule } from '../modules/ProfileModule.js';
import { createMiniServer, sendJson, sendSseData, sendSseHeaders } from '../utils/mini-server.js';

const normalizeNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const buildDefaults = (options = {}) => {
  const requestedModel = normalizeString(options.model);
  return {
    defaults: {
      host: options.host || '127.0.0.1',
      port: normalizeNumber(options.port, 8080),
      model: requestedModel || process.env.PUTER_AI_MODEL || 'gpt-4.1-nano',
      system: options.system ?? process.env.PUTER_AI_SYSTEM ?? '',
      maxTokens: normalizeNumber(options.maxTokens, 2048),
      temperature: normalizeNumber(options.temperature, 1),
      testMode: normalizeBoolean(options.testMode, false)
    },
    requestedModel
  };
};

const estimateTokens = (text) => {
  if (!text) return 0;
  const trimmed = String(text).trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const extractText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.text === 'string') return item.text;
      return '';
    }).join('');
  }
  if (content && typeof content.text === 'string') return content.text;
  return '';
};

const buildPromptFromMessages = (messages = []) => {
  return messages.map((msg) => {
    const role = msg?.role ? String(msg.role).toUpperCase() : 'USER';
    const content = extractText(msg?.content);
    return `${role}: ${content}`;
  }).join('\n');
};

const buildCompletionResponse = ({ id, created, model, content }) => {
  const completionTokens = estimateTokens(content);
  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: completionTokens,
      total_tokens: completionTokens
    }
  };
};

const streamCompletion = ({ res, id, created, model, content }) => {
  sendSseHeaders(res);
  const chunkSize = 80;
  let offset = 0;
  let isFirst = true;
  while (offset < content.length) {
    const chunk = content.slice(offset, offset + chunkSize);
    const delta = isFirst ? { role: 'assistant', content: chunk } : { content: chunk };
    const payload = {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: null }]
    };
    sendSseData(res, JSON.stringify(payload));
    offset += chunkSize;
    isFirst = false;
  }
  const endPayload = {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
  };
  sendSseData(res, JSON.stringify(endPayload));
  sendSseData(res, '[DONE]');
  res.end();
};

const extractSystemPrompt = (messages, explicitSystem) => {
  if (explicitSystem !== undefined) return explicitSystem;
  if (!Array.isArray(messages)) return undefined;
  const systemMessage = messages.find((msg) => msg?.role === 'system');
  if (!systemMessage) return undefined;
  return extractText(systemMessage.content);
};

const filterNonSystemMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages.filter((msg) => msg?.role !== 'system');
};

const buildModelListResponse = (models, fallbackModel) => {
  const now = Math.floor(Date.now() / 1000);
  const data = Array.isArray(models) ? models.map((model) => {
    if (typeof model === 'string') {
      return { id: model, object: 'model', created: now, owned_by: 'puter' };
    }
    if (model && model.id) {
      return { id: model.id, object: 'model', created: now, owned_by: model.owned_by || 'puter' };
    }
    return null;
  }).filter(Boolean) : [];

  if (!data.length && fallbackModel) {
    data.push({ id: fallbackModel, object: 'model', created: now, owned_by: 'puter' });
  }

  return { object: 'list', data };
};

const normalizeModelIds = (models) => {
  if (!Array.isArray(models)) return [];
  return models.map((model) => {
    if (typeof model === 'string') return model;
    if (model && model.id) return model.id;
    return null;
  }).filter(Boolean);
};

const resolveAvailableModelsRaw = async (puter) => {
  if (!puter.ai || typeof puter.ai.listModels !== 'function') return [];
  const models = await puter.ai.listModels();
  return Array.isArray(models) ? models : [];
};

export const createAIProxyServer = (options = {}) => {
  const { defaults } = buildDefaults(options);
  const availableModelsRaw = options.availableModelsRaw;
  const availableModelsNormalized = Array.isArray(availableModelsRaw)
    ? normalizeModelIds(availableModelsRaw)
    : null;

  const modelsHandler = async ({ res }) => {
    try {
      if (Array.isArray(availableModelsRaw)) {
        return sendJson(res, 200, buildModelListResponse(availableModelsRaw, defaults.model));
      }
      const puter = getPuter();
      const models = await resolveAvailableModelsRaw(puter);
      return sendJson(res, 200, buildModelListResponse(models, defaults.model));
    } catch (error) {
      return sendJson(res, 500, { error: { message: error.message || 'Failed to list models' } });
    }
  };

  const routes = [
    {
      method: 'GET',
      path: '/',
      handler: async ({ res }) => {
        return sendJson(res, 200, { status: 'ok', message: 'Puter AI running on /v1' });
      }
    },
    {
      method: 'GET',
      path: '/v1/models',
      handler: modelsHandler
    },
    {
      method: 'POST',
      path: '/v1/chat/completions',
      handler: async ({ res, body }) => {
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { error: { message: 'Invalid JSON body' } });
        }

        const messages = Array.isArray(body.messages) ? body.messages : [];
        const systemPrompt = extractSystemPrompt(messages, body.system ?? defaults.system);
        const promptMessages = filterNonSystemMessages(messages);
        const prompt = typeof body.prompt === 'string' && body.prompt.trim()
          ? body.prompt
          : buildPromptFromMessages(promptMessages);

        if (!prompt) {
          return sendJson(res, 400, { error: { message: 'No prompt provided' } });
        }

        const model = body.model || defaults.model;
        const temperature = normalizeNumber(body.temperature, defaults.temperature);
        const maxTokens = normalizeNumber(body.max_tokens, defaults.maxTokens);
        const stream = !!body.stream;
        const testMode = typeof body.testMode === 'boolean' ? body.testMode : defaults.testMode;

        try {
          const profileModule = getProfileModule();
          const authToken = profileModule.getAuthToken();
          if (!authToken) {
            return sendJson(res, 401, { error: { message: 'Not authenticated. Run: puter login', type: 'unauthorized' } });
          }

          const puter = getPuter();
          if (!puter.ai || typeof puter.ai.chat !== 'function') {
            return sendJson(res, 500, { error: { message: 'AI service not available', type: 'service_unavailable' } });
          }

          if (availableModelsNormalized) {
            if (availableModelsNormalized.length > 0 && !availableModelsNormalized.includes(model)) {
              return sendJson(res, 400, { error: { message: `Unknown model: ${model}`, type: 'invalid_request_error' } });
            }
          } else if (typeof puter.ai.listModels === 'function') {
            const availableModels = normalizeModelIds(await puter.ai.listModels());
            if (availableModels.length > 0 && !availableModels.includes(model)) {
              return sendJson(res, 400, { error: { message: `Unknown model: ${model}`, type: 'invalid_request_error' } });
            }
          }

          const result = await puter.ai.chat(prompt, testMode, {
            model,
            temperature,
            maxTokens,
            system: systemPrompt
          });
          const content = typeof result === 'string'
            ? result
            : (result?.text ?? result?.message ?? JSON.stringify(result));
          const id = `chatcmpl-${crypto.randomUUID()}`;
          const created = Math.floor(Date.now() / 1000);
          if (stream) {
            return streamCompletion({ res, id, created, model, content });
          }
          return sendJson(res, 200, buildCompletionResponse({ id, created, model, content }));
        } catch (error) {
          const message = error?.error?.message || error?.message || 'AI request failed';
          const type = error?.error?.code || error?.code;
          return sendJson(res, 500, { error: { message, type } });
        }
      }
    }
  ];

  return createMiniServer({
    host: defaults.host,
    port: defaults.port,
    routes
  });
};

export const startAIProxyServer = async (options = {}) => {
  const { defaults, requestedModel } = buildDefaults(options);
  const profileModule = getProfileModule();
  const authToken = profileModule.getAuthToken();
  if (!authToken) {
    throw new Error('Not authenticated. Run: puter login');
  }

  const puter = getPuter();
  const availableModelsRaw = await resolveAvailableModelsRaw(puter);
  const availableModels = normalizeModelIds(availableModelsRaw);
  if (requestedModel && availableModels.length > 0 && !availableModels.includes(requestedModel)) {
    console.error(chalk.red(`Unknown model: ${requestedModel}`));
    const normalizedQuery = requestedModel.toLowerCase();
    const tokens = normalizedQuery.split(/[-_/]/).filter(Boolean);
    const primaryToken = tokens[0];
    const prefix = normalizedQuery.slice(0, 3);
    const suggestedModels = Array.from(new Set(availableModels.filter((model) => {
      const lower = model.toLowerCase();
      if (primaryToken && lower.includes(primaryToken)) return true;
      if (!primaryToken && normalizedQuery.length > 3 && lower.includes(prefix)) return true;
      return false;
    })));
    if (suggestedModels.length > 0) {
      console.log(chalk.cyan('Try one of the following:'));
      for (const suggestedModel of suggestedModels) {
        console.log(chalk.dim(`  ${suggestedModel}`));
      }
    }
    return null;
  }

  const server = createAIProxyServer({ ...defaults, availableModelsRaw });
  const { host, port } = await server.start();
  const trimmedSystem = String(defaults.system || '').trim();
  const systemPreview = trimmedSystem
    ? (trimmedSystem.length > 80 ? `${trimmedSystem.slice(0, 77)}...` : trimmedSystem)
    : 'none';

  console.log(chalk.green(`AI proxy server listening at http://${host}:${port}`));
  console.log(chalk.cyan('Defaults'));
  console.log(chalk.dim(`  model: ${defaults.model}`));
  console.log(chalk.dim(`  system: ${systemPreview}`));
  console.log(chalk.dim(`  max_tokens: ${defaults.maxTokens}`));
  console.log(chalk.dim(`  temperature: ${defaults.temperature}`));
  console.log(chalk.dim(`  testMode: ${defaults.testMode}`));
  console.log(chalk.cyan('Usage'));
  console.log(chalk.dim(`  GET  http://${host}:${port}/v1/models`));
  console.log(chalk.dim(`  POST http://${host}:${port}/v1/chat/completions`));
  console.log(chalk.dim(`  curl -X POST http://${host}:${port}/v1/chat/completions -H "content-type: application/json" -d '{"messages":[{"role":"user","content":"Hello"}]}'`));
  return server;
};
