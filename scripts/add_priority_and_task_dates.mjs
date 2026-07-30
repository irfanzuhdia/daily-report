import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log('Adding priority and task date columns if not exists...');
  await client.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date VARCHAR(100) DEFAULT NULL;

    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date VARCHAR(100) DEFAULT NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date VARCHAR(100) DEFAULT NULL;
  `);
  console.log('Columns migration completed successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Error running migration:', err);
  process.exit(1);
});
