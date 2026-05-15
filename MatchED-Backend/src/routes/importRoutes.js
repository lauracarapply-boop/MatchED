const express = require('express');
const { readDatabase } = require('../database/db');
const { importFromSheets } = require('../import/sheetsImporter');

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
