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

  console.log('Enabling Supabase Realtime Publication for tables...');

  const commands = [
    // Create publication if not exists
    `DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
        CREATE PUBLICATION supabase_realtime; 
      END IF; 
    END $$;`,

    // Add tables to publication for WebSockets
    `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE ticket_comments`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE ticket_logs`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE tickets`,
  ];

  for (const cmd of commands) {
    try {
      await sql.unsafe(cmd);
      console.log('Successfully executed:', cmd);
    } catch (e) {
      console.log('Notice:', cmd, e.message);
    }
  }

  console.log('Supabase Realtime Publication configuration completed!');
  process.exit(0);
}

run();
