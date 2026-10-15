#!/usr/bin/env node
// One-time local setup:
//   1. creates .env from .env.example (with a fresh JWT secret) if it doesn't exist
//   2. seeds the database with demo data if it doesn't exist
//   3. imports every .xlsx found in ../data-import (your private opportunity sheets)
//
// Usage: npm run setup            (safe to run again — never deletes data)
//        npm run setup -- --reset (wipes the local database and starts over)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
    .replace(/^NODE_ENV=.*$/m, 'NODE_ENV=development')
    .replace(/^DB_PATH=.*$/m, 'DB_PATH=')
    .replace(/^FRONTEND_URL=.*$/m, 'FRONTEND_URL=http://localhost:3000');
  fs.writeFileSync(envPath, example);
  console.log('✅ Created MatchED-Backend/.env (edit ADMIN_EMAILS and SMTP_* there).');
}
require('dotenv').config({ path: envPath });

(async () => {
  const { dbPath } = require('../src/database/db');
  const reset = process.argv.includes('--reset');
  if (reset && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (!fs.existsSync(dbPath)) {
    await require('../src/seed-data/seed').seedDatabase();
  } else {
    console.log('ℹ️  Database already exists at', dbPath, '(use --reset to start over)');
  }

  const importDir = path.join(root, '..', 'data-import');
  const files = fs.existsSync(importDir) ? fs.readdirSync(importDir).filter(f => f.toLowerCase().endsWith('.xlsx')) : [];
  if (!files.length) {
    console.log('ℹ️  No spreadsheets in data-import/. Put your "MatchED Apply - database.xlsx" there and run setup again to load real opportunities.');
  }
  const { readDatabase, writeDatabase } = require('../src/database/db');
  const { importFromXlsx } = require('../src/import/xlsxImporter');
  for (const f of files) {
    const db = readDatabase();
    const log = await importFromXlsx(db, path.join(importDir, f), 'setup');
    writeDatabase(db);
    console.log(`✅ Imported ${f}: ${log.by_destination.opportunities} live, ${log.by_destination.captured_opportunities} for review, ${log.by_destination.sources} sources, ${log.duplicate_rows} duplicates merged.`);
  }
  console.log('\nNext: npm start  →  http://localhost:3000');
  console.log('Admin access: npm run create-admin -- you@email.com "a-strong-password"\n');
})().catch(e => { console.error(e); process.exit(1); });
