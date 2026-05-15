const express = require('express');
const { readDatabase, writeDatabase } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const VALID_STATUSES = ['not_started', 'applying', 'applied', 'waiting', 'accepted', 'rejected'];

const LEVEL_THRESHOLDS = [0, 300, 700, 1300, 2100, 3100, 4300, 5800, 7600, 9800, 12500];

function computeLevel(xpTotal) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

function awardXP(db, userId, amount) {
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return { xpGained: 0, xpTotal: 0, level: 1, levelUp: false };
  const user = db.users[idx];
  const prevXp = user.xpTotal || 0;
  const newXp = prevXp + amount;
  const prevLevel = computeLevel(prevXp);
  const newLevel = computeLevel(newXp);
  db.users[idx] = { ...user, xpTotal: newXp, level: newLevel };
  return { xpGained: amount, xpTotal: newXp, level: newLevel, levelUp: newLevel > prevLevel };
}

// GET /api/results?userId=xxx
router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const db = readDatabase();
    const results = (db.resultTracking || []).filter(r => r.userId === userId);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/results — create or upsert tracking entry
router.post('/', (req, res) => {
  try {
    const { userId, opportunityId, status, scholarshipAmountBRL, notes } = req.body;
    if (!userId || !opportunityId) return res.status(400).json({ error: 'userId and opportunityId required' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const db = readDatabase();
    if (!db.resultTracking) db.resultTracking = [];

    const existing = db.resultTracking.find(r => r.userId === userId && r.opportunityId === opportunityId);
    if (existing) {
      const idx = db.resultTracking.indexOf(existing);
      db.resultTracking[idx] = {
        ...existing,
        status: status ?? existing.status,
        scholarshipAmountBRL: scholarshipAmountBRL !== undefined ? scholarshipAmountBRL : existing.scholarshipAmountBRL,
        notes: notes !== undefined ? notes : existing.notes,
        appliedAt: (status === 'applied' || status === 'waiting') && !existing.appliedAt ? new Date().toISOString() : existing.appliedAt,
        decisionAt: (status === 'accepted' || status === 'rejected') && !existing.decisionAt ? new Date().toISOString() : existing.decisionAt,
        updatedAt: new Date().toISOString(),
      };
      writeDatabase(db);
      return res.json(db.resultTracking[idx]);
    }

    const entry = {
      id: uuidv4(),
      userId,
      opportunityId,
      status: status || 'not_started',
      scholarshipAmountBRL: scholarshipAmountBRL || null,
      notes: notes || '',
      appliedAt: (status === 'applied' || status === 'waiting') ? new Date().toISOString() : null,
      decisionAt: (status === 'accepted' || status === 'rejected') ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.resultTracking.push(entry);
    writeDatabase(db);
    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/results/:id
router.put('/:id', (req, res) => {
  try {
    const { status, scholarshipAmountBRL, notes } = req.body;
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const db = readDatabase();
    if (!db.resultTracking) return res.status(404).json({ error: 'Not found' });
    const idx = db.resultTracking.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const prev = db.resultTracking[idx];
    const wasAccepted = prev.status === 'accepted';
    const becomingAccepted = status === 'accepted' && !wasAccepted;

    db.resultTracking[idx] = {
      ...prev,
      status: status ?? prev.status,
      scholarshipAmountBRL: scholarshipAmountBRL !== undefined ? scholarshipAmountBRL : prev.scholarshipAmountBRL,
      notes: notes !== undefined ? notes : prev.notes,
      appliedAt: (status === 'applied' || status === 'waiting') && !prev.appliedAt ? new Date().toISOString() : prev.appliedAt,
      decisionAt: (status === 'accepted' || status === 'rejected') && !prev.decisionAt ? new Date().toISOString() : prev.decisionAt,
      updatedAt: new Date().toISOString(),
    };

    let xpResult = { xpGained: 0, xpTotal: 0, level: 1, levelUp: false };
    if (becomingAccepted) xpResult = awardXP(db, prev.userId, 50);

    writeDatabase(db);
    res.json({ ...db.resultTracking[idx], ...xpResult });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/results/:id
router.delete('/:id', (req, res) => {
  try {
    const db = readDatabase();
    if (!db.resultTracking) return res.status(404).json({ error: 'Not found' });
    const idx = db.resultTracking.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.resultTracking.splice(idx, 1);
    writeDatabase(db);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
