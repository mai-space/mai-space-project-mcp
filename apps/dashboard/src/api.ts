export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repository: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  lockedBy: string | null;
  leaseExpiresAt: string | null;
  blockerReason: string | null;
  createdAt: string;
  updatedAt: string;
  dependencies: TaskRelation[];
}

export interface TaskRelation {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  sourceTask?: Task;
  targetTask?: Task;
}

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export function listProjects(slug?: string): Promise<Project[]> {
  const params = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  return request<Project[]>(`/projects${params}`);
}

export function createProject(data: { slug: string; name: string; description?: string | null; repository?: string | null }): Promise<Project> {
  return request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
}

export function getProject(slug: string): Promise<Project> {
  return request<Project>(`/projects/${encodeURIComponent(slug)}`);
}

export function listTasks(projectSlug: string, params?: { status?: string; limit?: number; offset?: number }): Promise<Task[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.offset) search.set('offset', String(params.offset));
  const qs = search.toString();
  return request<Task[]>(`/projects/${encodeURIComponent(projectSlug)}/tasks${qs ? `?${qs}` : ''}`);
}

export function createTask(projectSlug: string, data: { title: string; description?: string | null; priority?: number }): Promise<Task> {
  return request<Task>(`/projects/${encodeURIComponent(projectSlug)}/tasks`, { method: 'POST', body: JSON.stringify(data) });
}

export function claimTask(projectSlug: string, agentId: string): Promise<Task> {
  return request<Task>(`/projects/${encodeURIComponent(projectSlug)}/tasks/claim`, { method: 'POST', body: JSON.stringify({ agentId }) });
}

export function completeTask(taskId: string, agentId: string): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ agentId }) });
}

export function blockTask(taskId: string, agentId: string, reason: string): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/block`, { method: 'POST', body: JSON.stringify({ agentId, reason }) });
}

export function releaseTask(taskId: string, agentId: string): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/release`, { method: 'POST', body: JSON.stringify({ agentId }) });
}
