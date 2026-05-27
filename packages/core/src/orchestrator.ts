import type {
  Project, Task, ClaimResult, LeaseRenewalResult, ActivityLog, Agent,
  CreateProjectInput, CreateTaskInput, CreateBlockerTaskInput,
  TaskFilters, TaskStatus,
} from '@mai/shared-types';
import { Database } from '@mai/db';

export interface OrchestratorConfig {
  defaultLeaseDurationMs?: number;
}

const DEFAULT_LEASE_MS = 30 * 60 * 1000;

export class TaskOrchestrator {
  private db: Database;
  private config: Required<OrchestratorConfig>;

  constructor(db: Database, config?: OrchestratorConfig) {
    this.db = db;
    this.config = {
      defaultLeaseDurationMs: config?.defaultLeaseDurationMs ?? DEFAULT_LEASE_MS,
    };
  }

  getDatabase(): Database {
    return this.db;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const existing = await this.db.getProjectBySlug(input.slug);
    if (existing) throw new Error(`Project with slug '${input.slug}' already exists`);
    const project = await this.db.createProject(input);
    await this.db.createActivityLog(null, project.id, null, 'project.created', `Project '${input.slug}' created`);
    return project;
  }

  async listProjects(slug?: string): Promise<Project[]> {
    return this.db.listProjects(slug);
  }

  async getProject(slugOrId: string): Promise<Project> {
    const bySlug = await this.db.getProjectBySlug(slugOrId);
    if (bySlug) return bySlug;
    const byId = await this.db.getProjectById(slugOrId);
    if (byId) return byId;
    throw new Error(`Project not found: ${slugOrId}`);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const task = await this.db.createTask(input);
    await this.db.createActivityLog(task.id, task.projectId, input.createdBy ?? null, 'task.created', `Task '${input.title}' created`);
    return task;
  }

  async getTask(taskId: string): Promise<Task> {
    const task = await this.db.getTaskById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  async listTasks(filters: TaskFilters): Promise<Task[]> {
    return this.db.listTasks(filters);
  }

  async searchTasks(query: string, projectId?: string, status?: string, limit?: number): Promise<Task[]> {
    return this.db.searchTasks(query, projectId, status, limit);
  }

  async claimTask(projectId: string, agentId: string, capabilities?: string[]): Promise<ClaimResult> {
    const leaseDuration = this.config.defaultLeaseDurationMs;
    const task = this.db.claimTask(projectId, agentId, leaseDuration);
    if (!task) throw new Error('No available tasks to claim');
    const leaseExpiresAt = new Date(Date.now() + leaseDuration);
    await this.db.createActivityLog(task.id, projectId, agentId, 'task.claimed', `Agent ${agentId} claimed task`);
    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      lockedBy: agentId,
      leaseExpiresAt,
    };
  }

  async renewLease(taskId: string, agentId: string): Promise<LeaseRenewalResult> {
    const task = await this.db.getTaskById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.lockedBy !== agentId) throw new Error(`Task ${taskId} is not locked by agent ${agentId}`);
    const renewed = await this.db.renewLease(taskId, this.config.defaultLeaseDurationMs);
    const lockExpiresAt = new Date(Date.now() + this.config.defaultLeaseDurationMs);
    await this.db.createActivityLog(taskId, task.projectId, agentId, 'task.lease_renewed', null);
    return { taskId, lockedBy: agentId, lockExpiresAt, renewed };
  }

  async completeTask(taskId: string, agentId: string, notes?: string): Promise<Task> {
    const task = await this.db.getTaskById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.lockedBy !== agentId) throw new Error(`Task ${taskId} is not locked by agent ${agentId}`);
    if (task.status === 'DONE') throw new Error(`Task ${taskId} is already completed`);
    const updated = await this.db.updateTask(taskId, {
      status: 'DONE' as TaskStatus,
      completedAt: new Date(),
      executionNotes: notes ?? task.executionNotes,
    });
    if (!updated) throw new Error(`Failed to complete task ${taskId}`);
    await this.db.createActivityLog(taskId, task.projectId, agentId, 'task.completed', notes ?? null);
    return updated;
  }

  async blockTask(taskId: string, agentId: string, reason: string): Promise<Task> {
    const task = await this.db.getTaskById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.lockedBy !== agentId) throw new Error(`Task ${taskId} is not locked by agent ${agentId}`);
    const updated = await this.db.updateTask(taskId, {
      status: 'BLOCKED' as TaskStatus,
      blockerReason: reason,
    });
    if (!updated) throw new Error(`Failed to block task ${taskId}`);
    await this.db.createActivityLog(taskId, task.projectId, agentId, 'task.blocked', reason);
    return updated;
  }

  async releaseTask(taskId: string, agentId: string): Promise<Task> {
    const task = await this.db.getTaskById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.lockedBy !== agentId) throw new Error(`Task ${taskId} is not locked by agent ${agentId}`);
    const updated = await this.db.releaseTask(taskId);
    if (!updated) throw new Error(`Failed to release task ${taskId}`);
    await this.db.createActivityLog(taskId, task.projectId, agentId, 'task.released', `Agent ${agentId} released task`);
    return updated;
  }

  async createBlockerTask(input: CreateBlockerTaskInput): Promise<{ blocker: Task; original: Task }> {
    const original = await this.getTask(input.blockedTaskId);
    const blocker = await this.db.createTask({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      createdBy: input.createdBy,
    });
    await this.db.createRelation({ fromTaskId: blocker.id, toTaskId: original.id, type: 'blocks' });
    await this.db.updateTask(original.id, { status: 'BLOCKED', blockerReason: `Blocked by: ${input.title}` });
    const updatedOriginal = await this.getTask(original.id);
    await this.db.createActivityLog(blocker.id, input.projectId, input.createdBy ?? null, 'task.blocker_created', `Blocker for ${original.id}`);
    return { blocker, original: updatedOriginal };
  }

  async getTaskDependencies(taskId: string): Promise<Task[]> {
    return this.db.getDependencies(taskId);
  }

  async getTaskBlockers(taskId: string): Promise<Task[]> {
    return this.db.getBlockedBy(taskId);
  }

  async areDependenciesResolved(taskId: string): Promise<boolean> {
    const deps = await this.db.getDependencies(taskId);
    return deps.every((d) => d.status === 'DONE');
  }

  async getProjectActivity(projectId: string, limit?: number): Promise<ActivityLog[]> {
    return this.db.getProjectActivityLog(projectId, limit);
  }

  async getAgentActivity(agentId: string, limit?: number): Promise<ActivityLog[]> {
    return this.db.getAgentActivityLog(agentId, limit);
  }

  async registerAgent(agentId: string, capabilities: string[]): Promise<void> {
    return this.db.registerAgent(agentId, capabilities);
  }

  async findSuitableTasks(agentId: string, projectId?: string, limit?: number): Promise<Task[]> {
    const agent = await this.db.getAgent(agentId);
    if (!agent) return [];
    const tasks = await this.db.listTasks({
      status: 'OPEN' as TaskStatus,
      projectId,
      limit: limit ?? 10,
    });
    return tasks;
  }
}
