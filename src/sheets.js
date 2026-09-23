// Google Sheets output via a service account. The Sheet must be shared with the
// service account's client_email (Editor). Credentials come from
// GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON or base64); target from SHEET_ID.
import { google } from 'googleapis';

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  let text = raw.trim();
  if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8');
  return JSON.parse(text);
}

// Quote a tab title for use in an A1 range (handles spaces and "/").
function a1(title, cell) {
  return `'${String(title).replace(/'/g, "''")}'!${cell}`;
}

export async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// Create any missing tabs and write their header row once.
export async function ensureTabs(sheets, spreadsheetId, specs) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties.title));

  const addRequests = specs
    .filter((s) => !existing.has(s.title))
    .map((s) => ({ addSheet: { properties: { title: s.title, hidden: !!s.hidden } } }));

  if (addRequests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: addRequests } });
    for (const s of specs) {
      if (!existing.has(s.title) && s.header) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: a1(s.title, 'A1'),
          valueInputOption: 'RAW',
          requestBody: { values: [s.header] },
        });
      }
    }
  }
  return existing;
}

export async function readColumn(sheets, spreadsheetId, title, col = 'A') {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: a1(title, `${col}2:${col}`),
    });
    return (res.data.values || []).map((r) => r[0]).filter(Boolean);
  } catch {
    return [];
  }
}

export async function appendRows(sheets, spreadsheetId, title, rows) {
  if (!rows || !rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1(title, 'A1'),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}
