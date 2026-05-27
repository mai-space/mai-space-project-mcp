import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Database } from '@mai/db';
import { TaskOrchestrator } from '@mai/core';
import { createMcpServer } from '@mai/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerRoutes } from './routes/index.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  dbPath?: string;
}

export async function startServer(options: ServerOptions = {}) {
  const port = options.port ?? 3456;
  const host = options.host ?? 'localhost';
  const dbPath = options.dbPath ?? process.env.MAI_DB_PATH ?? './mai.db';

  const db = new Database(dbPath);
  const orchestrator = new TaskOrchestrator(db);
  const { server: mcpServer } = createMcpServer(orchestrator);

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  registerRoutes(app, orchestrator);

  let mcpTransport: SSEServerTransport | null = null;

  app.get('/mcp', async (req, reply) => {
    mcpTransport = new SSEServerTransport('/mcp/message', reply.raw);
    await mcpServer.connect(mcpTransport);
  });

  app.post('/mcp/message', async (req, reply) => {
    if (!mcpTransport) {
      return reply.status(400).send({ error: 'No active MCP session' });
    }
    await mcpTransport.handlePostMessage(req.raw, reply.raw);
  });

  try {
    await app.register(import('@fastify/static'), {
      root: new URL('../../dashboard/dist', import.meta.url),
      prefix: '/',
      wildcard: false,
    });
  } catch {
  }

  app.get('/', async (_req, reply) => {
    return reply.redirect('/health');
  });

  const url = await app.listen({ port, host });
  return { server: app, url };
}
