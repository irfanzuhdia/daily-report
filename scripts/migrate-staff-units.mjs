import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not found in environment variables.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Starting migration to initialize staff units...');

  // 1. Identify users to be updated for dry-run logging
  const targetUsers = await sql`
    SELECT user_id, user_name, user_email, user_team, user_unit 
    FROM users 
    WHERE LOWER(user_occupation) = 'staff' 
      AND user_team IS NOT NULL 
      AND (user_unit IS NULL OR user_unit = '')
  `;

  console.log(`Found ${targetUsers.length} staff members with a team but no unit:`);
  for (const u of targetUsers) {
    console.log(` - User: ${u.user_name || u.user_email} (Team: "${u.user_team}")`);
  }

  if (targetUsers.length === 0) {
    console.log('No users need updating. Migration skipped.');
    return;
  }

  // 2. Perform the update
  const result = await sql`
    UPDATE users 
    SET user_unit = user_team 
    WHERE LOWER(user_occupation) = 'staff' 
      AND user_team IS NOT NULL 
      AND (user_unit IS NULL OR user_unit = '')
  `;

  console.log('Migration completed successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
