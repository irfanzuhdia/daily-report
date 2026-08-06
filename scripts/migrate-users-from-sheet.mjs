/**
 * Migrasi user baru dari Google Sheet `users2_db` ke tabel users.
 *
 * Sheet menyimpan relasi sebagai id (user_site_id, user_division_id, ...),
 * sedangkan tabel users menyimpan namanya. Script ini menerjemahkan lewat
 * sheet lookup: sites, divisions, teams, departements.
 *
 * Default dry-run. Tambahkan --apply untuk benar-benar menulis.
 *
 *   node --env-file=.env scripts/migrate-users-from-sheet.mjs
 *   node --env-file=.env scripts/migrate-users-from-sheet.mjs --apply
 *   node --env-file=.env scripts/migrate-users-from-sheet.mjs --from 275 --apply
 */
import { google } from 'googleapis';
import postgres from 'postgres';

const APPLY = process.argv.includes('--apply');
const fromArg = process.argv.indexOf('--from');
const FROM = fromArg !== -1 ? parseInt(process.argv[fromArg + 1], 10) : 275;

const OCCUPATION = 'Staff'; // role_id "M" (Members) dipetakan ke Staff = level 1 di role_levels
const CREATED_BY = 'SEED';

const { DATABASE_URL, GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_CREDENTIALS } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL tidak ada di env');
if (!GOOGLE_SPREADSHEET_ID) throw new Error('GOOGLE_SPREADSHEET_ID tidak ada di env');

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  }),
});

async function fetchSheet(name, range = 'A1:AD2000') {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    range: `'${name}'!${range}`,
  });
  const values = res.data.values || [];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values
    .slice(1)
    .filter((row) => row.some((c) => c && String(c).trim()))
    .map((row) => {
      const o = {};
      headers.forEach((h, i) => {
        const v = row[i];
        o[h] = v === undefined || String(v).trim() === '' ? null : String(v).trim();
      });
      return o;
    });
}

const idNum = (userId) => {
  const m = /^U-(\d+)$/.exec(String(userId || '').trim());
  return m ? parseInt(m[1], 10) : null;
};

const lookup = (rows, idKey, nameKey) =>
  new Map(rows.filter((r) => r[idKey]).map((r) => [r[idKey], r[nameKey]]));

async function main() {
  const [users, sites, divisions, teams, departements] = await Promise.all([
    fetchSheet('users'),
    fetchSheet('sites', 'A1:C200'),
    fetchSheet('divisions', 'A1:C200'),
    fetchSheet('teams', 'A1:C200'),
    fetchSheet('departements', 'A1:C200'),
  ]);

  const siteOf = lookup(sites, 'site_id', 'site_name');
  const divisionOf = lookup(divisions, 'division_id', 'division_name');
  const teamOf = lookup(teams, 'team_id', 'team_name');
  const departementOf = lookup(departements, 'departement_id', 'departement_name');

  const candidates = users.filter((u) => {
    const n = idNum(u.user_id);
    return n !== null && n >= FROM && !u.deleted_at;
  });

  const sql = postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 3 });
  const existing = await sql`SELECT user_id, lower(user_email) AS email FROM users`;
  const existingIds = new Set(existing.map((r) => r.user_id));
  const existingEmails = new Set(existing.map((r) => r.email));

  const now = new Date().toISOString();
  const rows = [];
  const skipped = [];
  const unmapped = [];

  for (const u of candidates) {
    if (existingIds.has(u.user_id)) { skipped.push(`${u.user_id} — user_id sudah ada`); continue; }
    if (!u.user_email) { skipped.push(`${u.user_id} — email kosong`); continue; }
    if (existingEmails.has(u.user_email.toLowerCase())) { skipped.push(`${u.user_id} — email sudah ada (${u.user_email})`); continue; }

    // id yang ada di sheet user tapi tidak ada di sheet lookup -> jangan diam-diam jadi null
    for (const [key, map] of [
      ['user_site_id', siteOf], ['user_division_id', divisionOf],
      ['user_team_id', teamOf], ['user_departement_id', departementOf],
    ]) {
      if (u[key] && !map.has(u[key])) unmapped.push(`${u.user_id}: ${key}="${u[key]}" tidak ada di sheet lookup`);
    }

    const team = u.user_team_id ? teamOf.get(u.user_team_id) ?? null : null;
    rows.push({
      user_id: u.user_id,
      user_email: u.user_email,
      user_name: u.user_name,
      user_occupation: OCCUPATION,
      user_division: u.user_division_id ? divisionOf.get(u.user_division_id) ?? null : null,
      user_departement: u.user_departement_id ? departementOf.get(u.user_departement_id) ?? null : null,
      user_site: u.user_site_id ? siteOf.get(u.user_site_id) ?? null : null,
      user_team: team,
      user_unit: team, // konvensi existing: user_unit mengikuti user_team
      created_by: CREATED_BY,
      created_at: now,
    });
  }

  console.log(`Kandidat di sheet (U-${String(FROM).padStart(4, '0')}+): ${candidates.length}`);
  console.log(`Akan di-insert: ${rows.length}`);
  if (skipped.length) console.log('Dilewati:\n  ' + skipped.join('\n  '));
  if (unmapped.length) console.log('PERINGATAN id tanpa padanan:\n  ' + unmapped.join('\n  '));

  console.log('\nuser_id  | name                         | site     | division         | team                | departement');
  for (const r of rows) {
    console.log(
      [r.user_id.padEnd(8), (r.user_name || '').slice(0, 28).padEnd(28),
       (r.user_site || '-').padEnd(8), (r.user_division || '-').padEnd(16),
       (r.user_team || '-').padEnd(19), r.user_departement || '-'].join(' | ')
    );
  }

  if (!APPLY) {
    console.log('\n[DRY RUN] tidak ada yang ditulis. Tambahkan --apply untuk menjalankan.');
    await sql.end();
    return;
  }

  if (rows.length === 0) {
    console.log('\nTidak ada yang perlu di-insert.');
    await sql.end();
    return;
  }

  const inserted = await sql.begin((tx) => [
    tx`INSERT INTO users ${tx(rows, 'user_id', 'user_email', 'user_name', 'user_occupation',
      'user_division', 'user_departement', 'user_site', 'user_team', 'user_unit',
      'created_by', 'created_at')} RETURNING user_id`,
  ]);

  console.log(`\n[APPLIED] ${inserted[0].length} user ter-insert.`);
  const total = await sql`SELECT count(*)::int AS c FROM users`;
  console.log(`Total user sekarang: ${total[0].c}`);
  await sql.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
