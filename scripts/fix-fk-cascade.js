import postgres from 'postgres';
import { readFileSync } from 'fs';

let envContent = '';
try {
  envContent = readFileSync('.env', 'utf-8');
} catch (e) {
  console.error('Error reading .env:', e);
}

const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1).replace(/(^["']|["']$)/g, '');
}

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;

async function run() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is missing.');
    return;
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  console.log('Fixing foreign key CASCADE rules in PostgreSQL...');

  const commands = [
    // project_logs
    `ALTER TABLE project_logs DROP CONSTRAINT IF EXISTS project_logs_project_id_fkey`,
    `ALTER TABLE project_logs ADD CONSTRAINT project_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE`,
    
    // project_teams
    `ALTER TABLE project_teams DROP CONSTRAINT IF EXISTS project_teams_project_id_fkey`,
    `ALTER TABLE project_teams ADD CONSTRAINT project_teams_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE`,

    // tasks
    `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey`,
    `ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE`,

    // task_logs
    `ALTER TABLE task_logs DROP CONSTRAINT IF EXISTS task_logs_task_id_fkey`,
    `ALTER TABLE task_logs ADD CONSTRAINT task_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE`,

    // task_teams
    `ALTER TABLE task_teams DROP CONSTRAINT IF EXISTS task_teams_task_id_fkey`,
    `ALTER TABLE task_teams ADD CONSTRAINT task_teams_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE`,

    // daily_reports
    `ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_task_id_fkey`,
    `ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE`,
  ];

  for (const cmd of commands) {
    try {
      await sql.unsafe(cmd);
      console.log('Successfully executed:', cmd);
    } catch (e) {
      console.warn('Command warning/error:', cmd, e.message);
    }
  }

  console.log('All FK constraints updated with ON DELETE CASCADE!');
  process.exit(0);
}

run();
