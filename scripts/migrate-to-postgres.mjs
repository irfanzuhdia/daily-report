import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

// Parse .env file
let envContent = '';
try {
  envContent = readFileSync('.env', 'utf-8');
} catch (e) {
  console.error('Error reading .env file:', e);
  process.exit(1);
}

const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  env[key] = value.replace(/(^["']|["']$)/g, ''); // strip quotes
}

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing from .env file.');
  process.exit(1);
}

const GOOGLE_SPREADSHEET_ID = env.GOOGLE_SPREADSHEET_ID || '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo';

const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sql = neon(DATABASE_URL);

  console.log('Connecting to Neon PostgreSQL...');
  
  // Helper to run multi-statement SQL blocks by splitting them
  async function executeSqlBlock(block) {
    const queries = block.split(';').map(q => q.trim()).filter(Boolean);
    for (const q of queries) {
      await sql.query(q);
    }
  }

  // 1. Drop existing tables to ensure clean schema (cascade handles foreign keys)
  console.log('Dropping existing tables...');
  await executeSqlBlock(`
    DROP TABLE IF EXISTS files CASCADE;
    DROP TABLE IF EXISTS task_logs CASCADE;
    DROP TABLE IF EXISTS project_logs CASCADE;
    DROP TABLE IF EXISTS daily_reports CASCADE;
    DROP TABLE IF EXISTS task_teams CASCADE;
    DROP TABLE IF EXISTS tasks CASCADE;
    DROP TABLE IF EXISTS project_teams CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS statuses CASCADE;
  `);

  // 2. Create tables
  console.log('Creating database schema...');
  await executeSqlBlock(`
    CREATE TABLE IF NOT EXISTS statuses (
      id VARCHAR(10) PRIMARY KEY,
      name VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(50) PRIMARY KEY,
      user_email VARCHAR(255) UNIQUE NOT NULL,
      user_name VARCHAR(255),
      user_occupation VARCHAR(255),
      user_division VARCHAR(255),
      user_departement VARCHAR(255),
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS projects (
      project_id VARCHAR(50) PRIMARY KEY,
      project_name VARCHAR(255) NOT NULL,
      project_description TEXT,
      project_start_date_plan VARCHAR(50),
      project_end_date_plan VARCHAR(50),
      project_status VARCHAR(10) REFERENCES statuses(id),
      project_file TEXT,
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS project_teams (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(project_id) ON DELETE CASCADE,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(project_id) ON DELETE CASCADE,
      task_description TEXT,
      task_status VARCHAR(10) REFERENCES statuses(id),
      task_latest_percentage VARCHAR(50),
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS task_teams (
      id VARCHAR(50) PRIMARY KEY,
      task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      report_id VARCHAR(50) PRIMARY KEY,
      task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
      date VARCHAR(50),
      progress_percentage VARCHAR(50),
      total_hours VARCHAR(50),
      remarks TEXT,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS project_logs (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(project_id) ON DELETE CASCADE,
      project_status_old TEXT,
      project_status_new TEXT,
      created_by VARCHAR(50),
      created_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id VARCHAR(50) PRIMARY KEY,
      task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
      task_status_old TEXT,
      task_status_new TEXT,
      created_by VARCHAR(50),
      created_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS files (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50),
      task_id VARCHAR(50),
      report_id VARCHAR(50),
      file_url TEXT NOT NULL,
      file_description TEXT,
      created_by VARCHAR(50),
      created_at VARCHAR(100),
      updated_by VARCHAR(50),
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50),
      deleted_at VARCHAR(100)
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(user_email);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(project_status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_task ON daily_reports(task_id);
    CREATE INDEX IF NOT EXISTS idx_project_teams_project ON project_teams(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_teams_task ON task_teams(task_id);
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_files_task ON files(task_id);
  `);

  // Helper to fetch values from Google Sheets
  async function fetchSheetData(sheetName, range = 'A1:Z5000') {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
    });
    const values = res.data.values;
    if (!values || values.length < 2) return [];
    
    const headers = values[0];
    return values.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined && row[index] !== '' ? row[index] : null;
      });
      return obj;
    });
  }

  // 3. Migrate Statuses
  console.log('Migrating statuses...');
  const statuses = await fetchSheetData('status', 'A1:Z50');
  for (const s of statuses) {
    if (s.id && s.name) {
      await sql.query(
        `INSERT INTO statuses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2`,
        [s.id, s.name]
      );
    }
  }
  console.log(`Migrated ${statuses.length} statuses.`);

  // 4. Migrate Users
  console.log('Migrating users...');
  const users = await fetchSheetData('user', 'A1:Z1000');
  for (const u of users) {
    if (u.user_id && u.user_email) {
      await sql.query(
        `INSERT INTO users (
          user_id, user_email, user_name, user_occupation, user_division, user_departement,
          created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
          user_email = $2, user_name = $3, user_occupation = $4, user_division = $5, user_departement = $6,
          updated_by = $9, updated_at = $10, deleted_by = $11, deleted_at = $12`,
        [
          u.user_id, u.user_email, u.user_name, u.user_occupation, u.user_division, u.user_departement,
          u.created_by, u.created_at, u.updated_by, u.updated_at, u.deleted_by, u.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${users.length} users.`);

  // 5. Migrate Projects
  console.log('Migrating projects...');
  const projects = await fetchSheetData('project', 'A1:Z1000');
  for (const p of projects) {
    if (p.project_id && p.project_name) {
      await sql.query(
        `INSERT INTO projects (
          project_id, project_name, project_description, project_start_date_plan, project_end_date_plan,
          project_status, project_file, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (project_id) DO UPDATE SET
          project_name = $2, project_description = $3, project_start_date_plan = $4, project_end_date_plan = $5,
          project_status = $6, project_file = $7, updated_by = $10, updated_at = $11, deleted_by = $12, deleted_at = $13`,
        [
          p.project_id, p.project_name, p.project_description, p.project_start_date_plan, p.project_end_date_plan,
          p.project_status, p.project_file, p.created_by, p.created_at, p.updated_by, p.updated_at, p.deleted_by, p.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${projects.length} projects.`);

  // 6. Migrate Project Teams
  console.log('Migrating project teams...');
  const projectTeams = await fetchSheetData('project_team', 'A1:Z2000');
  for (const pt of projectTeams) {
    if (pt.id && pt.project_id && pt.user_id) {
      await sql.query(
        `INSERT INTO project_teams (
          id, project_id, user_id, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          project_id = $2, user_id = $3, updated_by = $6, updated_at = $7, deleted_by = $8, deleted_at = $9`,
        [
          pt.id, pt.project_id, pt.user_id, pt.created_by, pt.created_at, pt.updated_by, pt.updated_at, pt.deleted_by, pt.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${projectTeams.length} project team records.`);

  // 7. Migrate Tasks
  console.log('Migrating tasks...');
  const tasks = await fetchSheetData('task', 'A1:Z2000');
  for (const t of tasks) {
    if (t.id && t.project_id && t.task_description) {
      await sql.query(
        `INSERT INTO tasks (
          id, project_id, task_description, task_status, task_latest_percentage,
          created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          project_id = $2, task_description = $3, task_status = $4, task_latest_percentage = $5,
          updated_by = $8, updated_at = $9, deleted_by = $10, deleted_at = $11`,
        [
          t.id, t.project_id, t.task_description, t.task_status, t.task_latest_percentage,
          t.created_by, t.created_at, t.updated_by, t.updated_at, t.deleted_by, t.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${tasks.length} tasks.`);

  // 8. Migrate Task Teams
  console.log('Migrating task teams...');
  const taskTeams = await fetchSheetData('task_team', 'A1:Z2000');
  for (const tt of taskTeams) {
    if (tt.id && tt.task_id && tt.user_id) {
      await sql.query(
        `INSERT INTO task_teams (
          id, task_id, user_id, created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          task_id = $2, user_id = $3, updated_by = $6, updated_at = $7, deleted_by = $8, deleted_at = $9`,
        [
          tt.id, tt.task_id, tt.user_id, tt.created_by, tt.created_at, tt.updated_by, tt.updated_at, tt.deleted_by, tt.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${taskTeams.length} task team records.`);

  // 9. Migrate Daily Reports
  console.log('Migrating daily reports...');
  const reports = await fetchSheetData('report', 'A1:Z3000');
  for (const r of reports) {
    if (r.report_id && r.task_id) {
      await sql.query(
        `INSERT INTO daily_reports (
          report_id, task_id, date, progress_percentage, total_hours, remarks, user_id,
          created_by, created_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (report_id) DO UPDATE SET
          task_id = $2, date = $3, progress_percentage = $4, total_hours = $5, remarks = $6, user_id = $7,
          deleted_by = $10, deleted_at = $11`,
        [
          r.report_id, r.task_id, r.date, r.progress_percentage, r.total_hours, r.remarks, r.user_id,
          r.created_by, r.created_at, r.deleted_by, r.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${reports.length} daily reports.`);

  // 10. Migrate Project Logs
  console.log('Migrating project logs...');
  const projectLogs = await fetchSheetData('project_log', 'A1:Z5000');
  for (const pl of projectLogs) {
    if (pl.id && pl.project_id) {
      await sql.query(
        `INSERT INTO project_logs (
          id, project_id, project_status_old, project_status_new, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING`,
        [pl.id, pl.project_id, pl.project_status_old, pl.project_status_new, pl.created_by, pl.created_at]
      );
    }
  }
  console.log(`Migrated ${projectLogs.length} project logs.`);

  // 11. Migrate Task Logs
  console.log('Migrating task logs...');
  const taskLogs = await fetchSheetData('task_log', 'A1:Z5000');
  for (const tl of taskLogs) {
    if (tl.id && tl.task_id) {
      await sql.query(
        `INSERT INTO task_logs (
          id, task_id, task_status_old, task_status_new, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING`,
        [tl.id, tl.task_id, tl.task_status_old, tl.task_status_new, tl.created_by, tl.created_at]
      );
    }
  }
  console.log(`Migrated ${taskLogs.length} task logs.`);

  // 12. Migrate Files
  console.log('Migrating file attachments...');
  const files = await fetchSheetData('files', 'A1:Z2000');
  for (const f of files) {
    if (f.id && f.file_url) {
      await sql.query(
        `INSERT INTO files (
          id, project_id, task_id, report_id, file_url, file_description,
          created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          project_id = $2, task_id = $3, report_id = $4, file_url = $5, file_description = $6,
          updated_by = $9, updated_at = $10, deleted_by = $11, deleted_at = $12`,
        [
          f.id, f.project_id, f.task_id, f.report_id, f.file_url, f.file_description,
          f.created_by, f.created_at, f.updated_by, f.updated_at, f.deleted_by, f.deleted_at
        ]
      );
    }
  }
  console.log(`Migrated ${files.length} file records.`);

  console.log('\nMigration to PostgreSQL completed successfully!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
