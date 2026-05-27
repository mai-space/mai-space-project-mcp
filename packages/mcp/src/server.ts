import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { TaskOrchestrator } from "@mai/core";

export function createMcpServer(orchestrator: TaskOrchestrator) {
  const server = new McpServer(
    { name: "mai-project-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.tool(
    "list_projects",
    "List all projects, optionally filtered by slug",
    { slug: z.string().optional() },
    async ({ slug }) => {
      const projects = await orchestrator.listProjects(slug);
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
    }
  );

  server.tool(
    "create_project",
    "Create a new project",
    {
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      repository: z.string().optional(),
    },
    async ({ slug, name, description, repository }) => {
      const project = await orchestrator.createProject({ slug, name, description: description ?? undefined, repository: repository ?? undefined });
      return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }] };
    }
  );

  server.tool(
    "list_tasks",
    "List tasks with optional filters",
    { projectId: z.string().optional(), status: z.string().optional(), limit: z.number().optional(), offset: z.number().optional() },
    async ({ projectId, status, limit, offset }) => {
      const tasks = await orchestrator.listTasks({ projectId, status: status as any, limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.tool(
    "get_task",
    "Get a single task by ID",
    { taskId: z.string() },
    async ({ taskId }) => {
      const task = await orchestrator.getTask(taskId);
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "search_tasks",
    "Search tasks by text query",
    { query: z.string(), projectId: z.string().optional(), status: z.string().optional(), limit: z.number().optional() },
    async ({ query, projectId, status, limit }) => {
      const tasks = await orchestrator.searchTasks(query, projectId, status, limit);
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.tool(
    "claim_task",
    "Claim the highest priority available task for an agent",
    { projectId: z.string(), agentId: z.string(), capabilities: z.array(z.string()).optional() },
    async ({ projectId, agentId, capabilities }) => {
      const result = await orchestrator.claimTask(projectId, agentId, capabilities);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "renew_lease",
    "Renew the lease on a claimed task",
    { taskId: z.string(), agentId: z.string() },
    async ({ taskId, agentId }) => {
      const result = await orchestrator.renewLease(taskId, agentId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "complete_task",
    "Mark a claimed task as completed",
    { taskId: z.string(), agentId: z.string(), notes: z.string().optional() },
    async ({ taskId, agentId, notes }) => {
      const task = await orchestrator.completeTask(taskId, agentId, notes);
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "block_task",
    "Mark a claimed task as blocked",
    { taskId: z.string(), agentId: z.string(), reason: z.string() },
    async ({ taskId, agentId, reason }) => {
      const task = await orchestrator.blockTask(taskId, agentId, reason);
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "release_task",
    "Release a claimed task back to OPEN",
    { taskId: z.string(), agentId: z.string() },
    async ({ taskId, agentId }) => {
      const task = await orchestrator.releaseTask(taskId, agentId);
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "create_task",
    "Create a new task in a project",
    { projectId: z.string(), title: z.string(), description: z.string().optional(), priority: z.number().optional(), createdBy: z.string().optional() },
    async ({ projectId, title, description, priority, createdBy }) => {
      const project = await orchestrator.getProject(projectId);
      const task = await orchestrator.createTask({ projectId: project.id, title, description: description ?? undefined, priority: priority ?? 50, createdBy: createdBy ?? undefined });
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    }
  );

  server.tool(
    "create_blocker_task",
    "Create a task that blocks another task",
    { projectId: z.string(), title: z.string(), description: z.string().optional(), blockedTaskId: z.string(), createdBy: z.string().optional() },
    async ({ projectId, title, description, blockedTaskId, createdBy }) => {
      const project = await orchestrator.getProject(projectId);
      const result = await orchestrator.createBlockerTask({ projectId: project.id, title, description: description ?? undefined, blockedTaskId, createdBy: createdBy ?? undefined });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "register_agent",
    "Register an agent with its capabilities",
    { agentId: z.string(), capabilities: z.array(z.string()) },
    async ({ agentId, capabilities }) => {
      await orchestrator.registerAgent(agentId, capabilities);
      return { content: [{ type: "text", text: `Agent ${agentId} registered` }] };
    }
  );

  server.tool(
    "find_suitable_tasks",
    "Find tasks matching an agent's capabilities",
    { agentId: z.string(), projectId: z.string().optional(), limit: z.number().optional() },
    async ({ agentId, projectId, limit }) => {
      const tasks = await orchestrator.findSuitableTasks(agentId, projectId, limit);
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.resource(
    "projects_overview",
    "projects://overview",
    async (uri) => {
      const projects = await orchestrator.listProjects();
      const overview = await Promise.all(projects.map(async (p) => {
        const tasks = await orchestrator.listTasks({ projectId: p.id });
        const counts: Record<string, number> = {};
        for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
        return { slug: p.slug, name: p.name, taskCount: tasks.length, statusCounts: counts };
      }));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(overview, null, 2) }] };
    }
  );

  server.resource(
    "project_tasks",
    new ResourceTemplate("project://{slug}/tasks", { list: undefined }),
    async (_uri, variables) => {
      const slug = variables.slug as string;
      const project = await orchestrator.getProject(slug);
      const tasks = await orchestrator.listTasks({ projectId: project.id });
      return { contents: [{ uri: `project://${slug}/tasks`, mimeType: "application/json", text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.resource(
    "task_detail",
    new ResourceTemplate("task://{taskId}", { list: undefined }),
    async (_uri, variables) => {
      const taskId = variables.taskId as string;
      const task = await orchestrator.getTask(taskId);
      const [deps, blockers, activity] = await Promise.all([
        orchestrator.getTaskDependencies(taskId),
        orchestrator.getTaskBlockers(taskId),
        orchestrator.getProjectActivity(task.projectId, 20),
      ]);
      const detail = { task, dependencies: deps, blockers, recentActivity: activity.filter((a) => a.taskId === taskId) };
      return { contents: [{ uri: `task://${taskId}`, mimeType: "application/json", text: JSON.stringify(detail, null, 2) }] };
    }
  );

  server.prompt(
    "find-next-task",
    "Given agent capabilities and project, suggests the next best task to work on",
    { agentId: z.string(), projectSlug: z.string().optional() },
    async ({ agentId, projectSlug }) => {
      const projectId = projectSlug ? (await orchestrator.getProject(projectSlug)).id : undefined;
      const tasks = await orchestrator.findSuitableTasks(agentId, projectId);
      return { messages: [{ role: "user", content: { type: "text", text: `Find the next task for agent ${agentId}.\n\nAvailable tasks:\n${JSON.stringify(tasks, null, 2)}\n\nRecommend which task to claim and why.` } }] };
    }
  );

  server.prompt(
    "analyze-blockers",
    "Analyze all blocked tasks in a project and their reasons",
    { projectSlug: z.string() },
    async ({ projectSlug }) => {
      const project = await orchestrator.getProject(projectSlug);
      const blocked = await orchestrator.listTasks({ projectId: project.id, status: "BLOCKED" });
      const blockers = await Promise.all(blocked.map(async (t) => ({ task: t, blockingTasks: await orchestrator.getTaskBlockers(t.id) })));
      return { messages: [{ role: "user", content: { type: "text", text: `Analyze blockers for project ${projectSlug}.\n\nBlocked tasks and their blockers:\n${JSON.stringify(blockers, null, 2)}\n\nSummarize the blocker situation and suggest next steps.` } }] };
    }
  );

  server.prompt(
    "project-summary",
    "Summarize project progress including task counts and recent activity",
    { projectSlug: z.string() },
    async ({ projectSlug }) => {
      const project = await orchestrator.getProject(projectSlug);
      const tasks = await orchestrator.listTasks({ projectId: project.id });
      const activity = await orchestrator.getProjectActivity(project.id, 10);
      const counts: Record<string, number> = {};
      for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
      const summary = { project, totalTasks: tasks.length, statusCounts: counts, recentActivity: activity };
      return { messages: [{ role: "user", content: { type: "text", text: `Generate a project summary.\n\nData:\n${JSON.stringify(summary, null, 2)}\n\nProvide a concise status report.` } }] };
    }
  );

  async function connectStdio() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return { server, connectStdio };
}
