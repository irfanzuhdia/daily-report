import { google, sheets_v4 } from 'googleapis';

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
 */
export async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
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
}

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
 * Get the headers of a sheet.
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
 * Returns -1 if not found.
 */
export async function findRowByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<number> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'`,
  });

  const values = res.data.values;
  if (!values || values.length < 1) return -1;

  const headers = values[0] as string[];
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[colIndex] === value) {
      return i + 1; // 1-indexed including header
    }
  }
  return -1;
}

/**
 * Get a single row by column value.
 */
export async function getRowByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<Record<string, string> | null> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'`,
  });

  const values = res.data.values;
  if (!values || values.length < 1) return null;

  const headers = values[0] as string[];
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return null;

  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[colIndex] === value) {
      const obj: Record<string, string> = {};
      headers.forEach((header, j) => {
        obj[header] = values[i]?.[j] ?? '';
      });
      return obj;
    }
  }
  return null;
}

/**
 * Get all rows matching a column value.
 */
export async function getRowsByColumn(
  sheetName: string,
  columnName: string,
  value: string
): Promise<Record<string, string>[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'`,
  });

  const values = res.data.values;
  if (!values || values.length < 1) return [];

  const headers = values[0] as string[];
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return [];

  const results: Record<string, string>[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[colIndex] === value) {
      const obj: Record<string, string> = {};
      headers.forEach((header, j) => {
        obj[header] = values[i]?.[j] ?? '';
      });
      results.push(obj);
    }
  }
  return results;
}

/**
 * Delete (clear) a specific row.
 */
export async function deleteRow(sheetName: string, rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${rowNumber}:Z${rowNumber}`,
  });
}

/**
 * Get the next ID for a sheet by counting existing rows.
 */
export async function getNextId(sheetName: string, idPrefix: string): Promise<string> {
  const rows = await readSheet(sheetName);
  const count = rows.length + 1;
  return `${idPrefix}-${String(count).padStart(3, '0')}`;
}
