const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');

const router = express.Router();

// GET /api/sources
router.get('/', (req, res) => {
  try {
    const db = readDatabase();
    const sources = db.sources || [];
    const { trust_tier, active, search } = req.query;
    let result = sources;
    if (trust_tier) result = result.filter(s => s.trust_tier === trust_tier);
    if (active !== undefined) result = result.filter(s => String(s.active) === active);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => (s.name || '').toLowerCase().includes(q) || (s.base_url || '').toLowerCase().includes(q));
    }
    res.json({ sources: result, total: result.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sources
router.post('/', (req, res) => {
  try {
    const db = readDatabase();
    if (!db.sources) db.sources = [];
    const source = {
      id: uuidv4(),
      ...req.body,
      last_checked_at: null,
      last_successful_check_at: null,
      failed_checks_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.sources.push(source);
    writeDatabase(db);
    res.json(source);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sources/:id
router.put('/:id', (req, res) => {
  try {
    const db = readDatabase();
    const idx = (db.sources || []).findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.sources[idx] = { ...db.sources[idx], ...req.body, updated_at: new Date().toISOString() };
    writeDatabase(db);
    res.json(db.sources[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sources/:id
router.delete('/:id', (req, res) => {
  try {
    const db = readDatabase();
    const idx = (db.sources || []).findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.sources.splice(idx, 1);
    writeDatabase(db);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
