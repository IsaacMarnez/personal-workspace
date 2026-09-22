import type { ActivityItem, Attachment, DashboardStats, Project, Task } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    credentials: 'include',
  });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try { const data = await response.json() as { error?: string }; message = data.error || message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<{ authenticated: boolean }>('/api/auth/me'),
  login: (password: string) => request<{ ok: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  dashboard: () => request<DashboardStats>('/api/dashboard'),
  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (data: Partial<Task>) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) => request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: string) => request<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  projects: () => request<Project[]>('/api/projects'),
  createProject: (data: Pick<Project, 'name'> & Partial<Project>) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  activity: () => request<ActivityItem[]>('/api/activity'),
  attachments: () => request<Attachment[]>('/api/attachments'),
  upload: (file: File, taskId?: string, projectId?: string) => {
    const body = new FormData(); body.append('file', file); if (taskId) body.append('taskId', taskId); if (projectId) body.append('projectId', projectId);
    return request<Attachment>('/api/attachments', { method: 'POST', body });
  },
  deleteAttachment: (id: string) => request<{ ok: boolean }>(`/api/attachments/${id}`, { method: 'DELETE' }),
  aiAsk: (prompt: string) => request<{ text: string }>('/api/ai/ask', { method: 'POST', body: JSON.stringify({ prompt }) }),
  focusStart: (taskId?: string) => request<{ id: string; started_at: string }>('/api/focus/start', { method: 'POST', body: JSON.stringify({ taskId }) }),
  focusStop: (id: string) => request<{ duration_seconds: number }>('/api/focus/stop', { method: 'POST', body: JSON.stringify({ id }) }),
};
