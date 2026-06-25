import fs from 'fs';
import path from 'path';
import { SignJWT } from 'jose';
import { neon } from '@neondatabase/serverless';

// 1. Load .env manually
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

const databaseUrl = process.env.DATABASE_URL || '';
const jwtSecretKey = process.env.JWT_SECRET || 'daily-report-secret-key-change-in-production';
const JWT_SECRET = new TextEncoder().encode(jwtSecretKey);

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  // Find a super user or admin if possible, otherwise any active user
  const users = await sql`
    SELECT * FROM users 
    WHERE deleted_at IS NULL 
    ORDER BY 
      CASE WHEN user_occupation = 'Super User' THEN 1 
           WHEN user_occupation = 'Co Super User' THEN 2 
           ELSE 3 END, 
      user_email 
    LIMIT 1
  `;
  if (users.length === 0) {
    console.error("No active user found in database");
    process.exit(1);
  }
  const u = users[0];
  console.log("Selected user:", u.user_email, "Occupation:", u.user_occupation);

  const payload = {
    email: u.user_email,
    name: u.user_name || u.user_email,
    user_id: u.user_id,
    user_occupation: u.user_occupation || null,
    user_division: u.user_division || null,
    user_departement: u.user_departement || null,
    user_site: u.user_site || null,
    user_team: u.user_team || null,
    user_unit: u.user_unit || null,
  };

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(JWT_SECRET);

  console.log("SESSION_COOKIE_VALUE:" + token);
}

run().catch(console.error);
