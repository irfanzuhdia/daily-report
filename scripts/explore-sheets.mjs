import { google } from 'googleapis';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  env[key] = value;
}

const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
  });

  console.log('=== SPREADSHEET TITLE:', meta.data.properties.title, '===\n');

  for (const sheet of meta.data.sheets) {
    const title = sheet.properties.title;
    console.log('--- Sheet:', title, '---');

    const range = `'${title}'!A1:Z10`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
      range: range,
    });

    if (res.data.values) {
      res.data.values.forEach((row, i) => {
        console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
      });
    } else {
      console.log('(empty)');
    }
    console.log('');
  }
}

main().catch(console.error);
