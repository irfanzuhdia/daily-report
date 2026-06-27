-- scripts/add_computed_columns.sql

-- 1. Add computed columns to Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_percentage NUMERIC(5, 2) DEFAULT 0;

-- 2. Add computed columns to Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_progress NUMERIC(5, 2) DEFAULT 0;

-- 3. Function to update task's total hours and percentage when a report is added/updated/deleted
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id VARCHAR;
BEGIN
    -- Determine which task_id we are operating on
    IF (TG_OP = 'DELETE') THEN
        v_task_id := OLD.task_id;
    ELSE
        v_task_id := NEW.task_id;
    END IF;

    -- Update the specific task
    UPDATE tasks
    SET 
        total_hours = (
            SELECT COALESCE(SUM(NULLIF(regexp_replace(total_hours, '[^0-9.]', '', 'g'), '')::numeric), 0)
            FROM daily_reports
            WHERE task_id = v_task_id AND deleted_at IS NULL
        ),
        task_percentage = (
            SELECT COALESCE((
                SELECT NULLIF(regexp_replace(progress_percentage, '[^0-9.]', '', 'g'), '')::numeric
                FROM daily_reports
                WHERE task_id = v_task_id AND deleted_at IS NULL
                ORDER BY date DESC LIMIT 1
            ), 0)
        )
    WHERE id = v_task_id;
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger on daily_reports
DROP TRIGGER IF EXISTS trigger_update_task_progress ON daily_reports;
CREATE TRIGGER trigger_update_task_progress
AFTER INSERT OR UPDATE OR DELETE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_task_progress();

-- 5. Function to update project's total hours and progress when a task is updated
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id VARCHAR;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_project_id := OLD.project_id;
    ELSE
        v_project_id := NEW.project_id;
    END IF;

    -- Skip if project_id is null (some tasks might not be tied to projects if schema allows)
    IF v_project_id IS NOT NULL THEN
        UPDATE projects
        SET 
            total_hours = (
                SELECT COALESCE(SUM(total_hours), 0)
                FROM tasks
                WHERE project_id = v_project_id AND deleted_at IS NULL
            ),
            project_progress = (
                SELECT COALESCE(AVG(task_percentage), 0)
                FROM tasks
                WHERE project_id = v_project_id AND deleted_at IS NULL
            )
        WHERE project_id = v_project_id;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger on tasks
DROP TRIGGER IF EXISTS trigger_update_project_progress ON tasks;
CREATE TRIGGER trigger_update_project_progress
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_project_progress();

-- 7. Initial Backfill Script
-- This will run the calculations once for existing data
UPDATE tasks t
SET 
    total_hours = COALESCE((
        SELECT SUM(NULLIF(regexp_replace(total_hours, '[^0-9.]', '', 'g'), '')::numeric)
        FROM daily_reports
        WHERE task_id = t.id AND deleted_at IS NULL
    ), 0),
    task_percentage = COALESCE((
        SELECT NULLIF(regexp_replace(progress_percentage, '[^0-9.]', '', 'g'), '')::numeric
        FROM daily_reports
        WHERE task_id = t.id AND deleted_at IS NULL
        ORDER BY date DESC LIMIT 1
    ), 0)
WHERE t.deleted_at IS NULL;

UPDATE projects p
SET 
    total_hours = COALESCE((
        SELECT SUM(total_hours)
        FROM tasks
        WHERE project_id = p.project_id AND deleted_at IS NULL
    ), 0),
    project_progress = COALESCE((
        SELECT AVG(task_percentage)
        FROM tasks
        WHERE project_id = p.project_id AND deleted_at IS NULL
    ), 0)
WHERE p.deleted_at IS NULL;
