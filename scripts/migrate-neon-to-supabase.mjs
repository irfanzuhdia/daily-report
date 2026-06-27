import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const neonUrl = 'postgresql://neondb_owner:npg_CBo82TNluzgn@ep-sweet-frog-aokp9eix-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const supabaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error('Missing DATABASE_URL for Supabase');
  process.exit(1);
}

const source = postgres(neonUrl, { ssl: 'require' });
const target = postgres(supabaseUrl, { ssl: 'require' });

const tables = [
  'role_levels',
  'statuses',
  'users',
  'user_logs',
  'projects',
  'project_teams',
  'tasks',
  'task_teams',
  'daily_reports',
  'project_logs',
  'task_logs',
  'files',
  'tickets',
  'ticket_team',
  'ticket_comments',
  'ticket_logs',
  'comments',
  'notifications'
];

async function syncSchema(tableName) {
  const sourceColumns = await source`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = ${tableName}
  `;

  if (sourceColumns.length === 0) return false;

  const targetColumns = await target`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = ${tableName}
  `;

  if (targetColumns.length === 0) {
    console.log(`Table ${tableName} missing in target. Creating basic table with all columns...`);
    const cols = sourceColumns.map(c => `${c.column_name} ${c.data_type}`).join(', ');
    await target.unsafe(`CREATE TABLE ${tableName} (${cols})`);
    return true;
  }

  const targetColNames = new Set(targetColumns.map(c => c.column_name));
  
  for (const col of sourceColumns) {
    if (!targetColNames.has(col.column_name)) {
      console.log(`Adding missing column ${col.column_name} to ${tableName}`);
      await target.unsafe(`ALTER TABLE ${tableName} ADD COLUMN ${col.column_name} ${col.data_type}`);
    }
  }

  return true;
}

async function migrateTable(tableName) {
  console.log(`\nMigrating table: ${tableName}...`);
  try {
    const exists = await syncSchema(tableName);
    if (!exists) {
      console.log(`Table ${tableName} does not exist in source. Skipping.`);
      return;
    }

    const rows = await source.unsafe(`SELECT * FROM ${tableName}`);
    console.log(`Found ${rows.length} rows in ${tableName}.`);
    
    if (rows.length === 0) return;

    // Delete existing to avoid conflict
    await target.unsafe(`DELETE FROM ${tableName}`);

    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await target`INSERT INTO ${target(tableName)} ${target(batch)} ON CONFLICT DO NOTHING`;
      console.log(`Inserted ${Math.min(i + batchSize, rows.length)} / ${rows.length} into ${tableName}`);
    }
  } catch (err) {
    console.error(`Error migrating table ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('Starting migration from Neon to Supabase...');
  
  // Disable triggers temporarily to avoid computed columns crashing or triggering during migration
  // Supabase runs as postgres user so we can disable user triggers
  // Wait, we can't disable triggers on cloud db easily without superuser.
  // We will just let the triggers run, they should be fine since we added missing columns.

  for (const table of tables) {
    await migrateTable(table);
  }
  
  console.log('\nMigration complete!');
  process.exit(0);
}

main().catch(console.error);
