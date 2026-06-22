import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not found in environment variables.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Connecting to database...');
  
  const indexStatements = [
    {
      name: 'idx_project_teams_user',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_project_teams_user ON project_teams(user_id)`
    },
    {
      name: 'idx_task_teams_user',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_task_teams_user ON task_teams(user_id)`
    },
    {
      name: 'idx_daily_reports_user',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_reports(user_id)`
    },
    {
      name: 'idx_daily_reports_date',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date)`
    },
    {
      name: 'idx_projects_created_by',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by)`
    },
    {
      name: 'idx_tasks_created_by',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by)`
    }
  ];

  for (const statement of indexStatements) {
    console.log(`Creating index: ${statement.name}...`);
    try {
      await statement.sql;
      console.log(`Success: Created/Verified ${statement.name}`);
    } catch (err) {
      console.error(`Error creating index ${statement.name}:`, err.message);
    }
  }

  console.log('\nVerifying indexes on tables...');
  const verifyRes = await sql`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (
        tablename = 'project_teams'
        OR tablename = 'task_teams'
        OR tablename = 'daily_reports'
        OR tablename = 'projects'
        OR tablename = 'tasks'
      )
    ORDER BY tablename, indexname
  `;
  console.table(verifyRes);
}

main().catch(console.error);
