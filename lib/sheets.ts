import { google, sheets_v4 } from 'googleapis';
import { cache } from 'react';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo';

let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

export function resetSheetsClient() {
  cachedClient = null;
}

/**
 * Read all rows from a sheet and map them to objects using the header row.
 * Memoized per-request using React's cache.
 */
export const readSheet = cache(async (sheetName: string): Promise<Record<string, string>[]> => {
  const sheets = getSheetsClient();
  const range = `'${sheetName}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const values = res.data.values;
  if (!values || values.length < 2) return [];

  const headers = values[0] as string[];
  const rows = values.slice(1);

  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? '';
    });
    return obj;
  });
});

/**
 * Append a row to a sheet.
 */
export async function appendRow(sheetName: string, values: string[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

/**
 * Update a specific row in a sheet (1-indexed, including header).
 */
export async function updateRow(sheetName: string, rowNumber: number, values: string[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

/**
 * Get the headers of a sheet. (Cached via readSheet)
 */
export async function getHeaders(sheetName: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:Z1`,
  });
  return (res.data.values?.[0] as string[]) ?? [];
}

/**
 * Find the row number (1-indexed, including header) of a row matching a column value.
 * Uses cached in-memory array.
 */
export async function findRowByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<number> {
  const rows = await readSheet(sheetName);
  const index = rows.findIndex((row) => row[columnName]?.toLowerCase() === value?.toLowerCase());
  if (index === -1) return -1;
  return index + 2; // 1-indexed: 0-based index + 1 for offset + 1 for header row
}

/**
 * Get a single row by column value.
 * Uses cached in-memory array.
 */
export async function getRowByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<Record<string, string> | null> {
  const rows = await readSheet(sheetName);
  const row = rows.find((r) => r[columnName]?.toLowerCase() === value?.toLowerCase());
  return row ?? null;
}

/**
 * Get all rows matching a column value.
 * Uses cached in-memory array.
 */
export async function getRowsByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<Record<string, string>[]> {
  const rows = await readSheet(sheetName);
  return rows.filter((r) => r[columnName]?.toLowerCase() === value?.toLowerCase());
}

/**
 * Delete (clear) a specific row. Clears cache.
 */
export async function deleteRow(sheetName: string, rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${rowNumber}:Z${rowNumber}`,
  });
}

/**
 * Delete a row completely (shifting subsequent rows up).
 */
export async function deleteRowDimension(sheetName: string, rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Sheet ${sheetName} not found`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

/**
 * Get the next ID for a sheet by counting existing rows.
 * Uses cached in-memory array.
 */
export async function getNextId(sheetName: string, idPrefix: string): Promise<string> {
  const rows = await readSheet(sheetName);
  const count = rows.length + 1;
  return `${idPrefix}-${String(count).padStart(3, '0')}`;
}

