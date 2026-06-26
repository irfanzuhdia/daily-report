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
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function executeSqlBlock(block) {
  const queries = block.split(';').map(q => q.trim()).filter(Boolean);
  for (const q of queries) {
    console.log(`Executing: ${q.slice(0, 80)}...`);
    await sql.query(q);
  }
}

async function main() {
  console.log('Connecting to database and provisioning optimized indexes...');
  
  await executeSqlBlock(`
    -- Ticketing table indexes
    CREATE INDEX IF NOT EXISTS idx_tickets_request_by ON tickets(request_by);
    CREATE INDEX IF NOT EXISTS idx_tickets_request_to_division ON tickets(request_to_division);
    CREATE INDEX IF NOT EXISTS idx_tickets_tag_person ON tickets(tag_person);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at);

    -- Ticket team mapping table indexes
    CREATE INDEX IF NOT EXISTS idx_ticket_team_ticket ON ticket_team(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_team_user ON ticket_team(user_id);

    -- Ticket comments indexes
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_created ON ticket_comments(created_at DESC);

    -- Ticket audit logs indexes
    CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket ON ticket_logs(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_logs_created ON ticket_logs(created_at DESC);

    -- Daily reports table indexes
    CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_deleted ON daily_reports(deleted_at);

    -- Projects table indexes
    CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);

    -- Tasks table indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(task_status);
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);

    -- Team mapping tables soft delete indexes
    CREATE INDEX IF NOT EXISTS idx_project_teams_deleted ON project_teams(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_task_teams_deleted ON task_teams(deleted_at);
  `);

  console.log('Database indexes provisioned successfully!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
