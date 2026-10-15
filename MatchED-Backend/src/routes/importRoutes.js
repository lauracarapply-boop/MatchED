const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readDatabase, writeDatabase } = require('../database/db');
const { importFromSheets } = require('../import/sheetsImporter');
const { importFromXlsx, removeDemoOpportunities } = require('../import/xlsxImporter');

const router = express.Router();

// POST /api/import/sheets — trigger import
router.post('/sheets', async (req, res) => {
  try {
    const { importedBy = 'admin' } = req.body || {};
    const log = await importFromSheets(importedBy);
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/import/xlsx — admin uploads the private spreadsheet straight from the browser.
// The file is processed and deleted; it never goes into the code repository.
router.post('/xlsx', express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: 'Envie um arquivo .xlsx' });
  if (buf.slice(0, 2).toString() !== 'PK') return res.status(400).json({ error: 'O arquivo não parece ser um .xlsx' });
  const tmp = path.join(os.tmpdir(), `matched-upload-${Date.now()}.xlsx`);
  try {
    fs.writeFileSync(tmp, buf);
    const db = readDatabase();
    const log = await importFromXlsx(db, tmp, (req.user && req.user.email) || 'admin-upload');
    const demoRemoved = removeDemoOpportunities(db);
    writeDatabase(db);
    res.json({ ...log, demoRemoved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.rm(tmp, () => {});
  }
});

// GET /api/import/logs — list import logs
router.get('/logs', (req, res) => {
  try {
    const db = readDatabase();
    const logs = db.importLogs || [];
    res.json({ logs, total: logs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
