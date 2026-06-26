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
  console.error('DATABASE_URL environment variable is missing from .env file.');
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
  console.log('Connecting to database & setting up ticketing tables...');
  
  await executeSqlBlock(`
    CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      request_by VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      request_to_division VARCHAR(255) NOT NULL,
      tag_person VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      problem_type VARCHAR(255) NOT NULL,
      division_category VARCHAR(255),
      due_date VARCHAR(50),
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      status VARCHAR(20) NOT NULL DEFAULT 'Open',
      attachment_link TEXT,
      attachment_file TEXT,
      created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      created_at VARCHAR(100),
      updated_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      updated_at VARCHAR(100),
      deleted_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      deleted_at VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id VARCHAR(50) PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_logs (
      id VARCHAR(50) PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      created_by VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at VARCHAR(100) NOT NULL
    );
  `);

  console.log('Ticketing tables setup successfully!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
