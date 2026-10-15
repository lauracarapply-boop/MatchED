const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireSelf, requireAuth, ownsRecord } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');

const router = express.Router();
const VALID_STATUSES = ['not_started', 'applying', 'applied', 'waiting', 'accepted', 'rejected', 'did_not_apply'];

function cleanAmount(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 50_000_000 ? Math.round(n) : null;
}

function applyUpdate(entry, { status, scholarshipAmountBRL, notes }) {
  const now = new Date().toISOString();
  if (status) entry.status = status;
  const amount = cleanAmount(scholarshipAmountBRL);
  if (amount !== undefined) entry.scholarshipAmountBRL = amount;
  if (typeof notes === 'string') entry.notes = notes.slice(0, 1000);
  if ((status === 'applied' || status === 'waiting') && !entry.appliedAt) entry.appliedAt = now;
  if ((status === 'accepted' || status === 'rejected') && !entry.decisionAt) entry.decisionAt = now;
  entry.updatedAt = now;
}

function rewardAcceptance(db, entry, before) {
  if (entry.status === 'accepted' && before !== 'accepted' && !entry.rewardedAccepted) {
    entry.rewardedAccepted = true;
    return awardXP(db, entry.userId, 50);
  }
  return { xpGained: 0 };
}

router.get('/', requireSelf, (req, res) => {
  const db = readDatabase();
  res.json({ results: db.resultTracking.filter(r => r.userId === req.targetUserId) });
});

// POST /api/results — create or update the entry for (user, opportunity)
router.post('/', requireSelf, (req, res) => {
  const { opportunityId, status } = req.body || {};
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId obrigatório' });
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const db = readDatabase();
  const userId = req.targetUserId;
  let entry = db.resultTracking.find(r => r.userId === userId && r.opportunityId === opportunityId);
  const before = entry ? entry.status : null;
  if (!entry) {
    entry = { id: uuidv4(), userId, opportunityId, status: 'not_started', scholarshipAmountBRL: null, notes: '', createdAt: new Date().toISOString() };
    db.resultTracking.push(entry);
  }
  applyUpdate(entry, req.body || {});
  const xp = rewardAcceptance(db, entry, before);
  writeDatabase(db);
  res.json({ ...entry, ...xp });
});

router.put('/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const db = readDatabase();
  const entry = db.resultTracking.find(r => r.id === req.params.id);
  if (!ownsRecord(req, entry)) return res.status(404).json({ error: 'Registro não encontrado' });
  const before = entry.status;
  applyUpdate(entry, req.body || {});
  const xp = rewardAcceptance(db, entry, before);
  writeDatabase(db);
  res.json({ ...entry, ...xp });
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = readDatabase();
  const idx = db.resultTracking.findIndex(r => r.id === req.params.id);
  if (idx === -1 || !ownsRecord(req, db.resultTracking[idx])) return res.status(404).json({ error: 'Registro não encontrado' });
  db.resultTracking.splice(idx, 1);
  writeDatabase(db);
  res.json({ success: true });
});

module.exports = router;
