export type TaskStatus = 'inbox' | 'backlog' | 'next' | 'in_progress' | 'waiting' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  project_id: string | null;
  project_name?: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Attachment {
  id: string;
  task_id: string | null;
  project_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface DashboardStats {
  today: number;
  pending: number;
  inProgress: number;
  overdue: number;
  completedWeek: number;
  activeProjects: number;
  focusSecondsToday: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  message: string;
  created_at: string;
}
