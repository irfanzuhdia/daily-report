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

  console.log('Creating push_subscriptions table in PostgreSQL...');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Successfully created push_subscriptions table in PostgreSQL!');
  process.exit(0);
}

run();
