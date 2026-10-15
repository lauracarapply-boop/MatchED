#!/usr/bin/env node
// Load the curated Brazilian opportunities (src/seed-data/brazil-opportunities.json).
//   npm run import:br
// Safe to re-run. Uses DB_PATH like the server does.
require('dotenv').config();
const { readDatabase, writeDatabase, dbPath } = require('../src/database/db');
const { importCurated } = require('../src/import/curated');

const db = readDatabase();
const log = importCurated(db);
writeDatabase(db);
console.log(`✅ Curated Brazilian opportunities: ${log.added} added, ${log.updated} refreshed, ${log.duplicatesArchived} spreadsheet duplicates archived (${dbPath}).`);
