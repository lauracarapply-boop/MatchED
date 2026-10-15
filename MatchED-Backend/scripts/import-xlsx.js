#!/usr/bin/env node
// Load the MatchED opportunities spreadsheet into the JSON database.
//
//   npm run import:xlsx -- "path/to/MatchED Apply - database.xlsx"            (writes the db)
//   npm run import:xlsx -- "path/to/MatchED Apply - database.xlsx" --dry-run  (report only)
//
// Uses DB_PATH like the server does (defaults to ./data/db.json).
// Safe to re-run: rows already in the database are matched and only fill empty fields.

require('dotenv').config();
const fs = require('fs');
const { initializeDatabase, readDatabase, writeDatabase, dbPath } = require('../src/database/db');
const { importFromXlsx } = require('../src/import/xlsxImporter');

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--'));
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run import:xlsx -- <file.xlsx> [--dry-run]');
    process.exit(1);
  }

  initializeDatabase();
  const db = readDatabase();
  const before = { opportunities: db.opportunities.length, captured: (db.capturedOpportunities || []).length, sources: (db.sources || []).length };

  const log = await importFromXlsx(db, file, 'cli');

  console.log(`\n${dryRun ? '[dry run] ' : ''}Imported ${file}`);
  console.log(`  rows read:            ${log.total_rows}`);
  console.log(`  new live opportunities: ${log.by_destination.opportunities}`);
  console.log(`  new for review:       ${log.by_destination.captured_opportunities}`);
  console.log(`  new recurring sources: ${log.by_destination.sources}`);
  console.log(`  duplicates merged:    ${log.duplicate_rows}`);
  console.log(`  skipped / errors:     ${log.skipped_rows} / ${log.error_rows}`);
  console.log(`  totals: opportunities ${before.opportunities} → ${db.opportunities.length}, review queue ${before.captured} → ${db.capturedOpportunities.length}, sources ${before.sources} → ${db.sources.length}`);
  if (log.error_details.length) console.log('  first errors:', log.error_details.slice(0, 5));

  if (!dryRun) {
    writeDatabase(db);
    console.log(`\nSaved to ${dbPath}`);
  }
})().catch(err => { console.error(err); process.exit(1); });
