// Domain types derived from spreadsheet schema

export interface User {
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_occupation: string | null;
  user_division: string | null;
  user_departement: string | null;
  user_site: string | null;
  user_team: string | null;
  user_unit: string | null;
  level?: number;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface Project {
  project_id: string;
  project_name: string | null;
  project_description: string | null;
  project_start_date_plan: string | null;
  project_end_date_plan: string | null;
  project_status: string | null;
  project_file: string | null;
  additional_link: string | null;
  category: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface ProjectTeam {
  id: string;
  project_id: string;
  user_id: string;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  task_description: string | null;
  task_status: string | null;
  task_latest_percentage: string | null;
  task_file: string | null;
  additional_link: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}


export interface TaskTeam {
  id: string;
  task_id: string;
  user_id: string;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface DailyReport {
  report_id: string;
  task_id: string;
  date: string | null;
  progress_percentage: string | null;
  total_hours: string | null;
  remarks: string | null;
  user_id: string | null;
  created_by: string | null;
  created_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface Status {
  id: string;
  name: string;
}

export interface ProjectLog {
  id: string;
  project_id: string;
  project_status_old: string | null;
  project_status_new: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  task_status_old: string | null;
  task_status_new: string | null;
  created_by: string | null;
  created_at: string | null;
}

// Auth types
export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  user_id: string;
  user_occupation: string | null;
  user_division: string | null;
  user_departement: string | null;
  user_site: string | null;
  user_team: string | null;
  user_unit: string | null;
}

// Dashboard types
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalReports: number;
  totalHours: number;
  recentReports: (DailyReport & { task_description?: string; project_name?: string; user_name?: string })[];
  projectsByStatus: { status: string; count: number }[];
  contributionData: Record<string, number>;
}

// Google Drive upload
export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  downloadLink: string;
}

export interface EnrichedProjectLog extends ProjectLog {
  createdByName?: string;
  targetUserName?: string;
}

export interface EnrichedTaskLog extends TaskLog {
  createdByName?: string;
  targetUserName?: string;
}

export interface FileRecord {
  id: string;
  project_id: string | null;
  task_id: string | null;
  report_id: string | null;
  file_url: string;
  file_description: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
}

export interface Comment {
  id: string;
  project_id: string | null;
  task_id: string | null;
  parent_id: string | null;
  content: string;
  created_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface UserLog {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  created_by: string;
  created_at: string;
  target_name?: string | null;
  target_email?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
}


