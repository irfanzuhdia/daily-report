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
  console.log('Connecting to database to add more performance indexes...');
  
  const indexStatements = [
    {
      name: 'idx_notifications_user_unread',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read)`
    },
    {
      name: 'idx_notifications_user_created',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`
    },
    {
      name: 'idx_comments_project_id',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id)`
    },
    {
      name: 'idx_comments_task_id',
      sql: sql`CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id)`
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

  console.log('\nVerifying indexes on notifications and comments...');
  const verifyRes = await sql`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (
        tablename = 'notifications'
        OR tablename = 'comments'
      )
    ORDER BY tablename, indexname
  `;
  console.table(verifyRes);
}

main().catch(console.error);
