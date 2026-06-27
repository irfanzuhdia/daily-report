import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const sqlPath = path.join(process.cwd(), 'scripts', 'add_computed_columns.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing SQL migration script...');
  
  // Neon serverless handles multiple statements poorly sometimes if passed as one big string.
  // We'll split by empty lines or some statement boundaries if needed, but let's try a direct execution first.
  // Actually, standard serverless driver might have issues with triggers and functions in a single query.
  // Let's use standard pg driver if possible, or just split statements manually.
  
  // To be safe with PostgreSQL triggers, let's use the pg package directly since it handles complex queries better.
  const { Client } = await import('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    await client.query(sqlContent);
    console.log('Successfully executed the SQL script!');
  } catch (err) {
    console.error('Error executing SQL script:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
