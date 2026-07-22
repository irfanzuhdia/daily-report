-- Migration: Add Performance Indexes for heavy queries
-- Add index on deleted_at for all soft-delete tables
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_reports_deleted_at ON daily_reports (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments (deleted_at) WHERE deleted_at IS NULL;

-- Add index on frequently filtered columns
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON projects (status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON tasks (status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project_id ON daily_reports (project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_task_id ON daily_reports (task_id);

-- Add index on user IDs for fast RBAC joins
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON daily_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_project_team_user_id ON project_team (user_id);
CREATE INDEX IF NOT EXISTS idx_task_team_user_id ON task_team (user_id);
