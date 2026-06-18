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

  // Get all user rows
  console.log('=== ALL USERS ===');
  const usersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'user'!A1:Z20",
  });
  if (usersRes.data.values) {
    usersRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all project rows
  console.log('\n=== ALL PROJECTS ===');
  const projectsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'project'!A1:Z20",
  });
  if (projectsRes.data.values) {
    projectsRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all task rows
  console.log('\n=== ALL TASKS ===');
  const tasksRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'task'!A1:Z20",
  });
  if (tasksRes.data.values) {
    tasksRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all report rows
  console.log('\n=== ALL REPORTS ===');
  const reportsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'report'!A1:Z20",
  });
  if (reportsRes.data.values) {
    reportsRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all status rows
  console.log('\n=== ALL STATUS ===');
  const statusRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'status'!A1:Z20",
  });
  if (statusRes.data.values) {
    statusRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all project_team rows
  console.log('\n=== ALL PROJECT TEAMS ===');
  const ptRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'project_team'!A1:Z20",
  });
  if (ptRes.data.values) {
    ptRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }

  // Get all task_team rows
  console.log('\n=== ALL TASK TEAMS ===');
  const ttRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo',
    range: "'task_team'!A1:Z20",
  });
  if (ttRes.data.values) {
    ttRes.data.values.forEach((row, i) => {
      console.log('Row ' + (i + 1) + ':', JSON.stringify(row));
    });
  }
}

main().catch(console.error);
