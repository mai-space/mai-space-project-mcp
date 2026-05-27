import { Kysely, SqliteDialect, type ColumnType } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import type {
  Project, Task, TaskRelation, ActivityLog, Agent,
  CreateProjectInput, CreateTaskInput, CreateRelationInput,
  TaskFilters, TaskStatus,
} from '@mai-space/shared-types';

interface ProjectsTable {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repository: string | null;
  createdAt: ColumnType<string, string, never>;
  updatedAt: ColumnType<string, string, string>;
}

interface TasksTable {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  createdBy: string | null;
  assignedTo: string | null;
  references: string;
  blockerReason: string | null;
  claimCount: number;
  lastClaimedAt: string | null;
  executionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskRelationsTable {
  fromTaskId: string;
  toTaskId: string;
  type: string;
}

interface ActivityLogsTable {
  id: string;
  taskId: string | null;
  projectId: string | null;
  agentId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

interface AgentsTable {
  agentId: string;
  capabilities: string;
  lastSeenAt: string | null;
}

interface DatabaseSchema {
  projects: ProjectsTable;
  tasks: TasksTable;
  taskRelations: TaskRelationsTable;
  activityLogs: ActivityLogsTable;
  agents: AgentsTable;
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function parseTaskRow(row: TasksTable): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status as TaskStatus,
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt ? new Date(row.lockedAt) : null,
    lockExpiresAt: row.lockExpiresAt ? new Date(row.lockExpiresAt) : null,
    createdBy: row.createdBy,
    assignedTo: row.assignedTo,
    references: JSON.parse(row.references || '[]'),
    blockerReason: row.blockerReason,
    claimCount: row.claimCount,
    lastClaimedAt: row.lastClaimedAt ? new Date(row.lastClaimedAt) : null,
    executionNotes: row.executionNotes,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
  };
}

export class Database {
  private db: Kysely<DatabaseSchema>;
  private sqlite: BetterSqlite3.Database;

  constructor(dbPath: string = './mai.db') {
    this.sqlite = new BetterSqlite3(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: this.sqlite }),
    });
    this.createTables();
  }

  private createTables(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        repository TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT,
        priority INTEGER NOT NULL DEFAULT 50,
        status TEXT NOT NULL DEFAULT 'OPEN',
        lockedBy TEXT,
        lockedAt TEXT,
        lockExpiresAt TEXT,
        createdBy TEXT,
        assignedTo TEXT,
        "references" TEXT NOT NULL DEFAULT '[]',
        blockerReason TEXT,
        claimCount INTEGER NOT NULL DEFAULT 0,
        lastClaimedAt TEXT,
        executionNotes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS taskRelations (
        fromTaskId TEXT NOT NULL REFERENCES tasks(id),
        toTaskId TEXT NOT NULL REFERENCES tasks(id),
        type TEXT NOT NULL,
        PRIMARY KEY (fromTaskId, toTaskId)
      );

      CREATE TABLE IF NOT EXISTS activityLogs (
        id TEXT PRIMARY KEY,
        taskId TEXT,
        projectId TEXT,
        agentId TEXT,
        action TEXT NOT NULL,
        details TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        agentId TEXT PRIMARY KEY,
        capabilities TEXT NOT NULL DEFAULT '[]',
        lastSeenAt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_activityLogs_projectId ON activityLogs(projectId);
      CREATE INDEX IF NOT EXISTS idx_activityLogs_agentId ON activityLogs(agentId);
    `);
  }

  close(): void {
    this.db.destroy();
  }

  getRawDb(): BetterSqlite3.Database {
    return this.sqlite;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = uuid();
    const ts = now();
    await this.db.insertInto('projects')
      .values({ id, slug: input.slug, name: input.name, description: input.description ?? null, repository: input.repository ?? null, createdAt: ts, updatedAt: ts })
      .execute();
    return { id, slug: input.slug, name: input.name, description: input.description ?? null, repository: input.repository ?? null, createdAt: new Date(ts), updatedAt: new Date(ts) };
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const row = await this.db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? { ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) } : undefined;
  }

  async getProjectBySlug(slug: string): Promise<Project | undefined> {
    const row = await this.db.selectFrom('projects').selectAll().where('slug', '=', slug).executeTakeFirst();
    return row ? { ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) } : undefined;
  }

  async listProjects(slug?: string): Promise<Project[]> {
    let query = this.db.selectFrom('projects').selectAll();
    if (slug) query = query.where('slug', '=', slug);
    const rows = await query.execute();
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) }));
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const id = uuid();
    const ts = now();
    await this.db.insertInto('tasks')
      .values({
        id, projectId: input.projectId, title: input.title,
        description: input.description ?? null, priority: input.priority ?? 50,
        status: 'OPEN', lockedBy: null, lockedAt: null, lockExpiresAt: null,
        createdBy: input.createdBy ?? null, assignedTo: input.assignedTo ?? null,
        references: JSON.stringify(input.references ?? []),
        blockerReason: null, claimCount: 0, lastClaimedAt: null,
        executionNotes: null, createdAt: ts, updatedAt: ts, completedAt: null,
      })
      .execute();
    return {
      id, projectId: input.projectId, title: input.title,
      description: input.description ?? null, priority: input.priority ?? 50,
      status: 'OPEN', lockedBy: null, lockedAt: null, lockExpiresAt: null,
      createdBy: input.createdBy ?? null, assignedTo: input.assignedTo ?? null,
      references: input.references ?? [], blockerReason: null,
      claimCount: 0, lastClaimedAt: null, executionNotes: null,
      createdAt: new Date(ts), updatedAt: new Date(ts), completedAt: null,
    };
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const row = await this.db.selectFrom('tasks').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? parseTaskRow(row) : undefined;
  }

  async listTasks(filters: TaskFilters): Promise<Task[]> {
    let query = this.db.selectFrom('tasks').selectAll();
    if (filters.projectId) query = query.where('projectId', '=', filters.projectId);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.where('status', 'in', filters.status);
      } else {
        query = query.where('status', '=', filters.status);
      }
    }
    if (filters.assignedTo) query = query.where('assignedTo', '=', filters.assignedTo);
    if (filters.lockedBy) query = query.where('lockedBy', '=', filters.lockedBy);
    if (filters.priority?.min !== undefined) query = query.where('priority', '>=', filters.priority.min);
    if (filters.priority?.max !== undefined) query = query.where('priority', '<=', filters.priority.max);
    query = query.orderBy('priority asc').orderBy('createdAt asc');
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);
    const rows = await query.execute();
    return rows.map(parseTaskRow);
  }

  async searchTasks(query: string, projectId?: string, status?: string, limit?: number): Promise<Task[]> {
    let q = this.db.selectFrom('tasks').selectAll();
    if (projectId) q = q.where('projectId', '=', projectId);
    if (status) q = q.where('status', '=', status);
    q = q.where((eb) => eb('title', 'like', `%${query}%`).or(eb('description', 'like', `%${query}%`)));
    if (limit) q = q.limit(limit);
    const rows = await q.execute();
    return rows.map(parseTaskRow);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const ts = now();
    const dbUpdates: Record<string, unknown> = { updatedAt: ts };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.lockedBy !== undefined) dbUpdates.lockedBy = updates.lockedBy;
    if (updates.lockedAt !== undefined) dbUpdates.lockedAt = updates.lockedAt instanceof Date ? updates.lockedAt.toISOString() : updates.lockedAt;
    if (updates.lockExpiresAt !== undefined) dbUpdates.lockExpiresAt = updates.lockExpiresAt instanceof Date ? updates.lockExpiresAt.toISOString() : updates.lockExpiresAt;
    if (updates.assignedTo !== undefined) dbUpdates.assignedTo = updates.assignedTo;
    if (updates.references !== undefined) dbUpdates.references = JSON.stringify(updates.references);
    if (updates.blockerReason !== undefined) dbUpdates.blockerReason = updates.blockerReason;
    if (updates.claimCount !== undefined) dbUpdates.claimCount = updates.claimCount;
    if (updates.lastClaimedAt !== undefined) dbUpdates.lastClaimedAt = updates.lastClaimedAt instanceof Date ? updates.lastClaimedAt.toISOString() : updates.lastClaimedAt;
    if (updates.executionNotes !== undefined) dbUpdates.executionNotes = updates.executionNotes;
    if (updates.completedAt !== undefined) dbUpdates.completedAt = updates.completedAt instanceof Date ? updates.completedAt.toISOString() : updates.completedAt;

    await this.db.updateTable('tasks').set(dbUpdates).where('id', '=', id).execute();
    return this.getTaskById(id);
  }

  claimTask(projectId: string, agentId: string, leaseDurationMs: number): Task | undefined {
    const expiresAt = new Date(Date.now() + leaseDurationMs).toISOString();
    const ts = now();
    const row = this.sqlite.prepare(`
      UPDATE tasks
      SET status = 'IN_PROGRESS',
          lockedBy = ?,
          lockedAt = ?,
          lockExpiresAt = ?,
          claimCount = claimCount + 1,
          lastClaimedAt = ?,
          updatedAt = ?
      WHERE id = (
        SELECT t.id FROM tasks t
        LEFT JOIN taskRelations tr ON tr.fromTaskId = t.id AND tr.type = 'depends_on'
        LEFT JOIN tasks dep ON dep.id = tr.toTaskId AND dep.status != 'DONE'
        WHERE t.projectId = ?
          AND t.status = 'OPEN'
          AND dep.id IS NULL
        ORDER BY t.priority ASC, t.createdAt ASC
        LIMIT 1
      )
      RETURNING *
    `).get(agentId, ts, expiresAt, ts, ts, projectId) as TasksTable | undefined;

    return row ? parseTaskRow(row) : undefined;
  }

  async releaseTask(taskId: string): Promise<Task | undefined> {
    const ts = now();
    await this.db.updateTable('tasks')
      .set({ status: 'OPEN', lockedBy: null, lockedAt: null, lockExpiresAt: null, updatedAt: ts })
      .where('id', '=', taskId)
      .execute();
    return this.getTaskById(taskId);
  }

  async renewLease(taskId: string, leaseDurationMs: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + leaseDurationMs).toISOString();
    const ts = now();
    const result = await this.db.updateTable('tasks')
      .set({ lockExpiresAt: expiresAt, updatedAt: ts })
      .where('id', '=', taskId)
      .where('status', '=', 'IN_PROGRESS')
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async createRelation(input: CreateRelationInput): Promise<void> {
    await this.db.insertInto('taskRelations')
      .values({ fromTaskId: input.fromTaskId, toTaskId: input.toTaskId, type: input.type })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async getTaskRelations(taskId: string): Promise<TaskRelation[]> {
    const rows = await this.db.selectFrom('taskRelations').selectAll()
      .where((eb) => eb('fromTaskId', '=', taskId).or(eb('toTaskId', '=', taskId)))
      .execute();
    return rows.map(r => ({ fromTaskId: r.fromTaskId, toTaskId: r.toTaskId, type: r.type as TaskRelation['type'] }));
  }

  async getDependencies(taskId: string): Promise<Task[]> {
    const rows = await this.db.selectFrom('taskRelations')
      .innerJoin('tasks', 'tasks.id', 'taskRelations.toTaskId')
      .selectAll('tasks')
      .where('taskRelations.fromTaskId', '=', taskId)
      .where('taskRelations.type', '=', 'depends_on')
      .execute();
    return rows.map(parseTaskRow);
  }

  async getBlockedBy(taskId: string): Promise<Task[]> {
    const rows = await this.db.selectFrom('taskRelations')
      .innerJoin('tasks', 'tasks.id', 'taskRelations.toTaskId')
      .selectAll('tasks')
      .where('taskRelations.fromTaskId', '=', taskId)
      .where('taskRelations.type', '=', 'blocks')
      .execute();
    return rows.map(parseTaskRow);
  }

  async createActivityLog(taskId: string | null, projectId: string | null, agentId: string | null, action: string, details: string | null): Promise<void> {
    const id = uuid();
    const ts = now();
    await this.db.insertInto('activityLogs')
      .values({ id, taskId, projectId, agentId, action, details, createdAt: ts })
      .execute();
  }

  async getProjectActivityLog(projectId: string, limit?: number): Promise<ActivityLog[]> {
    let query = this.db.selectFrom('activityLogs').selectAll().where('projectId', '=', projectId).orderBy('createdAt desc');
    if (limit) query = query.limit(limit);
    const rows = await query.execute();
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async getAgentActivityLog(agentId: string, limit?: number): Promise<ActivityLog[]> {
    let query = this.db.selectFrom('activityLogs').selectAll().where('agentId', '=', agentId).orderBy('createdAt desc');
    if (limit) query = query.limit(limit);
    const rows = await query.execute();
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async registerAgent(agentId: string, capabilities: string[]): Promise<void> {
    const ts = now();
    await this.db.insertInto('agents')
      .values({ agentId, capabilities: JSON.stringify(capabilities), lastSeenAt: ts })
      .onConflict((oc) => oc.doUpdateSet({ capabilities: JSON.stringify(capabilities), lastSeenAt: ts }))
      .execute();
  }

  async getAgent(agentId: string): Promise<Agent | undefined> {
    const row = await this.db.selectFrom('agents').selectAll().where('agentId', '=', agentId).executeTakeFirst();
    return row ? { agentId: row.agentId, capabilities: JSON.parse(row.capabilities), lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null } : undefined;
  }

  async getAgentsByCapability(capability: string): Promise<Agent[]> {
    const rows = await this.db.selectFrom('agents').selectAll().execute();
    return rows
      .map(r => ({ agentId: r.agentId, capabilities: JSON.parse(r.capabilities) as string[], lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt) : null }))
      .filter(a => a.capabilities.includes(capability));
  }
}
