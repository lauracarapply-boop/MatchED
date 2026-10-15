const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireSelf, requireAuth, ownsRecord } = require('../middleware/auth');

const router = express.Router();

// POST /api/saved-opportunities — save (no duplicates; re-saving restores a removed item)
router.post('/', requireSelf, (req, res) => {
  const { opportunityId, saveType } = req.body || {};
  const db = readDatabase();
  if (!db.opportunities.some(o => o.id === opportunityId)) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const userId = req.targetUserId;
  const existing = db.savedOpportunities.find(s => s.userId === userId && s.opportunityId === opportunityId);
  if (existing) {
    existing.status = 'pending';
    writeDatabase(db);
    return res.json(existing);
  }
  const saved = { id: uuidv4(), userId, opportunityId, saveType: saveType || 'manual', status: 'pending', notesFromUser: '', savedDate: new Date().toISOString() };
  db.savedOpportunities.push(saved);
  writeDatabase(db);
  res.json(saved);
});

router.get('/', requireSelf, (req, res) => {
  const db = readDatabase();
  res.json({ savedOpportunities: db.savedOpportunities.filter(s => s.userId === req.targetUserId) });
});

router.put('/:id', requireAuth, (req, res) => {
  const db = readDatabase();
  const item = db.savedOpportunities.find(s => s.id === req.params.id);
  if (!ownsRecord(req, item)) return res.status(404).json({ error: 'Item não encontrado' });
  const { status, notesFromUser } = req.body || {};
  if (['pending', 'removed'].includes(status)) item.status = status;
  if (typeof notesFromUser === 'string') item.notesFromUser = notesFromUser.slice(0, 1000);
  writeDatabase(db);
  res.json(item);
});

module.exports = router;
