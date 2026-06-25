import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('--- Migrating database to add user_unit ---');
  
  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS user_unit VARCHAR(255) DEFAULT NULL
  `;
  console.log('Column user_unit added to users table successfully.');
}

main().catch(console.error);
