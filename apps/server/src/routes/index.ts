import type { FastifyInstance } from 'fastify';
import type { TaskOrchestrator } from '@mai/core';
import type { CreateBlockerTaskInput, CreateProjectInput, CreateTaskInput } from '@mai/shared-types';

export function registerRoutes(app: FastifyInstance, orchestrator: TaskOrchestrator) {

  app.get('/api/projects', async (_req, reply) => {
    const projects = await orchestrator.listProjects();
    return reply.send(projects);
  });

  app.post<{ Body: CreateProjectInput }>('/api/projects', async (req, reply) => {
    try {
      const project = await orchestrator.createProject(req.body);
      return reply.status(201).send(project);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.get<{ Params: { slug: string } }>('/api/projects/:slug', async (req, reply) => {
    try {
      const project = await orchestrator.getProject(req.params.slug);
      return reply.send(project);
    } catch (e: any) {
      return reply.status(404).send({ error: e.message });
    }
  });

  app.get('/api/tasks', async (req, reply) => {
    const query = req.query as any;
    const tasks = await orchestrator.listTasks({
      projectId: query.projectId,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
    return reply.send(tasks);
  });

  app.post<{ Body: CreateTaskInput }>('/api/tasks', async (req, reply) => {
    try {
      const task = await orchestrator.createTask(req.body);
      return reply.status(201).send(task);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    try {
      const task = await orchestrator.getTask(req.params.id);
      return reply.send(task);
    } catch (e: any) {
      return reply.status(404).send({ error: e.message });
    }
  });

  app.post<{ Body: { query: string; projectId?: string; status?: string; limit?: number } }>('/api/tasks/search', async (req, reply) => {
    const tasks = await orchestrator.searchTasks(req.body.query, req.body.projectId, req.body.status, req.body.limit);
    return reply.send(tasks);
  });

  app.post<{ Params: { id: string }; Body: { agentId: string; capabilities?: string[] } }>('/api/tasks/:id/claim', async (req, reply) => {
    try {
      const result = await orchestrator.claimTask(req.params.id, req.body.agentId, req.body.capabilities);
      return reply.send(result);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string }; Body: { agentId: string; notes?: string } }>('/api/tasks/:id/complete', async (req, reply) => {
    try {
      const task = await orchestrator.completeTask(req.params.id, req.body.agentId, req.body.notes);
      return reply.send(task);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string }; Body: { agentId: string; reason: string } }>('/api/tasks/:id/block', async (req, reply) => {
    try {
      const task = await orchestrator.blockTask(req.params.id, req.body.agentId, req.body.reason);
      return reply.send(task);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string }; Body: { agentId: string } }>('/api/tasks/:id/release', async (req, reply) => {
    try {
      const task = await orchestrator.releaseTask(req.params.id, req.body.agentId);
      return reply.send(task);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string }; Body: { agentId: string } }>('/api/tasks/:id/renew', async (req, reply) => {
    try {
      const result = await orchestrator.renewLease(req.params.id, req.body.agentId);
      return reply.send(result);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Body: CreateBlockerTaskInput & { projectId: string } }>('/api/tasks/blocker', async (req, reply) => {
    try {
      const result = await orchestrator.createBlockerTask(req.body);
      return reply.send(result);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  app.post<{ Body: { agentId: string; capabilities: string[] } }>('/api/agents/register', async (req, reply) => {
    await orchestrator.registerAgent(req.body.agentId, req.body.capabilities);
    return reply.send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id/tasks', async (req, reply) => {
    const query = req.query as any;
    const tasks = await orchestrator.findSuitableTasks(req.params.id, query.projectId, query.limit ? Number(query.limit) : undefined);
    return reply.send(tasks);
  });

  app.get<{ Params: { slug: string } }>('/api/projects/:slug/activity', async (req, reply) => {
    const query = req.query as any;
    try {
      const project = await orchestrator.getProject(req.params.slug);
      const activity = await orchestrator.getProjectActivity(project.id, query.limit ? Number(query.limit) : undefined);
      return reply.send(activity);
    } catch (e: any) {
      return reply.status(404).send({ error: e.message });
    }
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id/activity', async (req, reply) => {
    const query = req.query as any;
    const activity = await orchestrator.getAgentActivity(req.params.id, query.limit ? Number(query.limit) : undefined);
    return reply.send(activity);
  });
}
