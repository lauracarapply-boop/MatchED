const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireSelf } = require('../middleware/auth');
const { awardXP, touchStreak } = require('../lib/xp');

const router = express.Router();
const XP_VALUES = { like: 5, pass: 1, save: 3 };

// POST /api/swipes — record like/pass. XP is given once per opportunity.
router.post('/', requireSelf, (req, res) => {
  const { opportunityId, action, matchScore } = req.body || {};
  if (!['like', 'pass', 'save'].includes(action)) return res.status(400).json({ error: 'Ação inválida' });
  const db = readDatabase();
  if (!db.opportunities.some(o => o.id === opportunityId)) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const userId = req.targetUserId;
  const already = db.swipeEvents.some(s => s.userId === userId && s.opportunityId === opportunityId);
  const swipe = { id: uuidv4(), userId, opportunityId, action, matchScore: Number(matchScore) || null, timestamp: new Date().toISOString() };
  db.swipeEvents.push(swipe);
  const user = db.users.find(u => u.id === userId);
  touchStreak(user);
  const xp = already ? { xpGained: 0, xpTotal: user.xpTotal || 0, level: user.level || 1, levelUp: false } : awardXP(db, userId, XP_VALUES[action]);
  writeDatabase(db);
  res.json({ ...swipe, ...xp, currentStreak: user.currentStreak || 0 });
});

router.get('/', requireSelf, (req, res) => {
  const db = readDatabase();
  res.json({ swipes: db.swipeEvents.filter(s => s.userId === req.targetUserId) });
});

module.exports = router;
