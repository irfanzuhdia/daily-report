import { google } from 'googleapis';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}
if (!GOOGLE_SPREADSHEET_ID) {
  console.error('No GOOGLE_SPREADSHEET_ID found in env');
  process.exit(1);
}

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sql = neon(DATABASE_URL);

  console.log('Fetching sheet data...');

  // Helper to fetch sheet data as objects
  async function fetchSheetData(sheetName) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z1000`,
    });
    const values = res.data.values;
    if (!values || values.length < 2) return [];
    
    const headers = values[0];
    return values.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] !== undefined && row[index] !== '' ? row[index] : null;
      });
      return obj;
    });
  }

  // Fetch organizational sheets only (users, roles, departments, etc.)
  const rawRoles = await fetchSheetData('roles');
  const rawDepts = await fetchSheetData('departements');
  const rawSites = await fetchSheetData('sites');
  const rawDivs = await fetchSheetData('divisions');
  const rawTeams = await fetchSheetData('teams');
  const rawUsers = await fetchSheetData('users');

  console.log(`Loaded ${rawRoles.length} roles, ${rawDepts.length} departments, ${rawSites.length} sites, ${rawDivs.length} divisions, ${rawTeams.length} teams, and ${rawUsers.length} users.`);

  // Create lookups
  const deptMap = new Map(rawDepts.map(d => [d.departement_id, d.departement_name]));
  const siteMap = new Map(rawSites.map(s => [s.site_id, s.site_name]));
  const divMap = new Map(rawDivs.map(d => [d.division_id, d.division_name]));
  const teamMap = new Map(rawTeams.map(t => [t.team_id, t.team_name]));
  const roleMap = new Map(rawRoles.map(r => [r.role_id, {
    name: r.role_name,
    level: parseInt(r.role_level || '0', 10)
  }]));

  // Only truncate users and role_levels — NOT projects/tasks/reports which are app-created data
  console.log('Truncating users and role_levels...');
  await sql.query('TRUNCATE TABLE users CASCADE');
  await sql.query('TRUNCATE TABLE role_levels CASCADE');

  console.log('Seeding role access levels...');
  // Seed roles from the sheet. Super User (SU) and CO - Super User (COSU) are mapped to Level 7.
  // We clamp role levels between 1 and 7, and skip level 0 (Members) so it defaults to level 1.
  for (const r of rawRoles) {
    let roleLevel = parseInt(r.role_level || '0', 10);
    if (r.role_id === 'SU' || r.role_id === 'COSU') {
      roleLevel = 7;
    }
    
    // Clamp level between 1 and 7, skip if level is 0
    if (roleLevel === 0) continue;
    if (roleLevel > 7) roleLevel = 7;
    if (roleLevel < 1) roleLevel = 1;

    console.log(`Inserting role level: ${r.role_name} -> Level ${roleLevel}`);
    await sql.query(
      'INSERT INTO role_levels (role_name, level) VALUES ($1, $2) ON CONFLICT (role_name) DO UPDATE SET level = $2',
      [r.role_name, roleLevel]
    );
  }

  console.log('Seeding users...');
  let successCount = 0;
  for (const u of rawUsers) {
    if (!u.user_id) continue;

    // Resolve email (generate unique placeholder if empty)
    let email = u.user_email ? u.user_email.trim().toLowerCase() : null;
    if (!email) {
      email = `${u.user_id.toLowerCase()}@noemail.placeholder.com`;
    }

    // Resolve structural parameters
    const deptName = deptMap.get(u.user_departement_id) || null;
    const siteName = siteMap.get(u.user_site_id) || null;
    const divName = divMap.get(u.user_division_id) || null;
    const teamName = teamMap.get(u.user_team_id) || null;
    
    // Resolve role / occupation
    const roleInfo = roleMap.get(u.user_role_id);
    let occupation = roleInfo ? roleInfo.name : 'Staff';
    
    // Map SU/COSU roles to their respective administrative titles
    if (u.user_role_id === 'SU') {
      if (u.user_email.toLowerCase().trim() === 'gadmin@multidayamitra.co.id') {
        occupation = 'Super User';
      } else {
        occupation = 'CO - Super User';
      }
    } else if (u.user_role_id === 'COSU') {
      occupation = 'CO - Super User';
    }

    if (email === 'irfanzuhdiabdillah@gmail.com') {
      occupation = 'Staff';
    }

    const now = new Date().toISOString();
    const deletedAt = u.user_status_id === 'NA' ? now : null;
    const deletedBy = u.user_status_id === 'NA' ? 'SEED' : null;
    const userUnit = occupation === 'Staff' ? teamName : null;

    await sql.query(`
      INSERT INTO users (
        user_id, user_email, user_name, user_occupation, user_division, user_departement,
        user_site, user_team, user_unit,
        created_by, created_at, deleted_by, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      u.user_id,
      email,
      u.user_name || email.split('@')[0],
      occupation,
      divName,
      deptName,
      siteName,
      teamName,
      userUnit,
      'SEED',
      now,
      deletedBy,
      deletedAt
    ]);
    successCount++;
  }

  console.log(`\nSuccess! Seeded ${successCount} users into PostgreSQL database.`);
}

main().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
