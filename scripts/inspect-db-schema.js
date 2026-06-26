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
  console.error('No DATABASE_URL found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('--- TABLES ---');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  for (const t of tables) {
    const tableName = t.table_name;
    console.log(`\nTable: ${tableName}`);
    
    // Columns
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    console.log('Columns:');
    console.log(cols.map(c => `${c.column_name} (${c.data_type}, ${c.is_nullable})`).join(', '));
    
    // Indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${tableName}
    `;
    console.log('Indexes:');
    for (const idx of indexes) {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    }
  }
}

main().catch(console.error);
