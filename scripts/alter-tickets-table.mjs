import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Parse .env file
const envContent = readFileSync('.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  env[key] = value.replace(/(^["']|["']$)/g, '');
}

const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Altering tickets table to make request_to_division nullable...');
  await sql`ALTER TABLE tickets ALTER COLUMN request_to_division DROP NOT NULL;`;
  console.log('Altered successfully!');
}

main().catch(console.error);
