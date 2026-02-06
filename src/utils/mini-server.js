import http from 'node:http';

export const sendJson = (res, status, payload, headers = {}) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
};

export const sendSseHeaders = (res) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
};

export const sendSseData = (res, data) => {
  res.write(`data: ${data}\n\n`);
};

const readBody = (req, maxBodySize) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBodySize) {
      reject(new Error('payload_too_large'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const parseJsonBody = async (req, maxBodySize) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  const raw = await readBody(req, maxBodySize);
  if (!raw) return null;
  return JSON.parse(raw);
};

export const createMiniServer = ({
  host = '127.0.0.1',
  port = 8080,
  routes = [],
  maxBodySize = 2 * 1024 * 1024,
  notFoundHandler,
  errorHandler
} = {}) => {
  const routeMap = new Map();
  routes.forEach((route) => {
    routeMap.set(`${route.method.toUpperCase()} ${route.path}`, route.handler);
  });

  const server = http.createServer(async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/', `http://${host}`);
    const handler = routeMap.get(`${method} ${url.pathname}`);

    if (!handler) {
      if (notFoundHandler) {
        return notFoundHandler({ req, res, url });
      }
      return sendJson(res, 404, { error: { message: 'Not Found' } });
    }

    try {
      const body = await parseJsonBody(req, maxBodySize);
      return await handler({
        req,
        res,
        url,
        query: Object.fromEntries(url.searchParams.entries()),
        body
      });
    } catch (error) {
      if (error.message === 'payload_too_large') {
        return sendJson(res, 413, { error: { message: 'Payload too large' } });
      }
      if (errorHandler) {
        return errorHandler({ req, res, error });
      }
      return sendJson(res, 500, { error: { message: 'Internal Server Error' } });
    }
  });

  const start = (maxAttempts = 20) => new Promise((resolve, reject) => {
    let currentPort = port;
    let attempts = 0;

    const listenOnce = () => {
      server.listen(currentPort, host, () => {
        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : currentPort;
        resolve({ host, port: actualPort });
      });
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port !== 0 && attempts < maxAttempts) {
          attempts += 1;
          currentPort += 1;
          listenOnce();
        } else {
          reject(err);
        }
      });
    };

    listenOnce();
  });

  const stop = () => new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  return { server, start, stop };
};
