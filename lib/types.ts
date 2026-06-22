// Domain types derived from spreadsheet schema

export interface User {
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_occupation: string | null;
  user_division: string | null;
  user_departement: string | null;
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

