import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

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

const DATABASE_URL = env.DATABASE_URL;
const sql = neon(DATABASE_URL);

async function main() {
  console.log('Querying Project Teams...');
  try {
    const projectTeams = await sql`
      SELECT pt.*, p.project_name, u.user_name, u.user_email
      FROM project_teams pt
      JOIN projects p ON pt.project_id = p.project_id
      JOIN users u ON pt.user_id = u.user_id
      WHERE pt.deleted_at IS NULL
    `;
    console.log('Project Teams:', projectTeams);

    console.log('\nQuerying Task Teams...');
    const taskTeams = await sql`
      SELECT tt.*, t.task_description, u.user_name, u.user_email
      FROM task_teams tt
      JOIN tasks t ON tt.task_id = t.id
      JOIN users u ON tt.user_id = u.user_id
      WHERE tt.deleted_at IS NULL
    `;
    console.log('Task Teams:', taskTeams);

    console.log('\nQuerying Projects...');
    const projects = await sql`SELECT project_id, project_name, created_by FROM projects WHERE deleted_at IS NULL`;
    console.log('Projects:', projects);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
