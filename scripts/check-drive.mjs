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
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Check report data
  console.log('=== REPORT DATA ===');
  const reportRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'report'!A1:Z10",
  });
  if (reportRes.data.values) {
    reportRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Check Google Drive folder
  console.log('\n=== GOOGLE DRIVE FOLDER ===');
  try {
    const folderRes = await drive.files.get({
      fileId: '1xY_3OUXINYxnq_KS_Xc8T_lPiK7AkEHi',
      fields: 'id, name, mimeType, webViewLink',
    });
    console.log('Folder:', JSON.stringify(folderRes.data, null, 2));
  } catch (e) {
    console.error('Drive folder error:', e.message);
  }

  // List files in folder
  console.log('\n=== FILES IN FOLDER ===');
  try {
    const filesRes = await drive.files.list({
      q: "'1xY_3OUXINYxnq_KS_Xc8T_lPiK7AkEHi' in parents and trashed = false",
      fields: 'files(id, name, mimeType, webViewLink, size)',
    });
    console.log('Files:', JSON.stringify(filesRes.data.files, null, 2));
  } catch (e) {
    console.error('List files error:', e.message);
  }
}

main().catch(console.error);
