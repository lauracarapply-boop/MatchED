const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { importRows } = require('./importRows');

const SHEET_ID = '1qm81DqE78HDC9KKaQAhZnDklOGNuLZvtVe9in5XHEW4';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Simple CSV parser that handles quoted fields with commas/newlines
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row = [];
    while (i < n && text[i] !== '\n') {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < n) {
          if (text[i] === '"' && text[i + 1] === '"') {
            field += '"'; i += 2;
          } else if (text[i] === '"') {
            i++; break;
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (text[i] === ',') i++;
      } else {
        // Unquoted field
        let field = '';
        while (i < n && text[i] !== ',' && text[i] !== '\n') field += text[i++];
        row.push(field.trim());
        if (text[i] === ',') i++;
      }
    }
    if (text[i] === '\n') i++;
    if (row.length > 0 && row.some(f => f !== '')) rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}

async function fetchCSV() {
  const res = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
  return res.text();
}

async function importFromSheets(importedBy = 'system') {
  const meta = { importSource: 'google_sheets', sheetName: 'Sheet1', spreadsheetId: SHEET_ID, importedBy };
  const db = readDatabase();
  let log;
  try {
    const csv = await fetchCSV();
    const rows = rowsToObjects(parseCSV(csv)).map(raw => ({ raw }));
    log = importRows(db, rows, meta);
  } catch (err) {
    const now = new Date().toISOString();
    log = {
      id: uuidv4(), import_source: meta.importSource, spreadsheet_id: SHEET_ID, sheet_name: meta.sheetName,
      started_at: now, finished_at: now, total_rows: 0, imported_rows: 0, updated_rows: 0, skipped_rows: 0,
      duplicate_rows: 0, error_rows: 0, status: 'error', error_details: [{ error: err.message }], created_by: importedBy,
    };
    if (!db.importLogs) db.importLogs = [];
    db.importLogs.unshift(log);
  }
  writeDatabase(db);
  return log;
}

module.exports = { importFromSheets, SHEET_ID };
