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
  if (!DATABASE_URL) return;
  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  console.log('--- PUSH SUBSCRIPTIONS TABLE CONTENT ---');
  const rows = await sql`SELECT * FROM push_subscriptions`;
  console.log(rows);
  process.exit(0);
}

run();
