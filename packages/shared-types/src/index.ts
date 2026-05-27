export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';

export type RelationType = 'depends_on' | 'related_to' | 'blocks';

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repository: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProjectInput = {
  slug: string;
  name: string;
  description?: string;
  repository?: string;
};

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: number;
  status: TaskStatus;
  lockedBy: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  createdBy: string | null;
  assignedTo: string | null;
  references: string[];
  blockerReason: string | null;
  claimCount: number;
  lastClaimedAt: Date | null;
  executionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
  createdBy?: string;
  assignedTo?: string;
  references?: string[];
};

export interface TaskRelation {
  fromTaskId: string;
  toTaskId: string;
  type: RelationType;
}

export type CreateRelationInput = {
  fromTaskId: string;
  toTaskId: string;
  type: RelationType;
};

export interface Agent {
  agentId: string;
  capabilities: string[];
  lastSeenAt: Date | null;
}

export interface ActivityLog {
  id: string;
  taskId: string | null;
  projectId: string | null;
  agentId: string | null;
  action: string;
  details: string | null;
  createdAt: Date;
}

export interface ClaimResult {
  taskId: string;
  title: string;
  status: TaskStatus;
  lockedBy: string;
  leaseExpiresAt: Date;
}

export interface LeaseRenewalResult {
  taskId: string;
  lockedBy: string;
  lockExpiresAt: Date;
  renewed: boolean;
}

export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: { min?: number; max?: number };
  assignedTo?: string;
  lockedBy?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetProjectsInput {
  slug?: string;
}

export interface GetTasksInput {
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetTaskInput {
  taskId: string;
}

export interface ClaimTaskInput {
  projectId: string;
  agentId: string;
  capabilities?: string[];
}

export interface RenewLeaseInput {
  taskId: string;
  agentId: string;
}

export interface CompleteTaskInput {
  taskId: string;
  agentId: string;
  notes?: string;
}

export interface BlockTaskInput {
  taskId: string;
  agentId: string;
  reason: string;
}

export interface ReleaseTaskInput {
  taskId: string;
  agentId: string;
}

export interface CreateBlockerTaskInput {
  projectId: string;
  title: string;
  description?: string;
  blockedTaskId: string;
  createdBy?: string;
}

export interface SearchTasksInput {
  query: string;
  projectId?: string;
  status?: string;
  limit?: number;
}

export interface RegisterAgentInput {
  agentId: string;
  capabilities: string[];
}
