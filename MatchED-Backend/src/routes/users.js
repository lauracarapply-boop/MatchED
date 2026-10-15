const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireSelf } = require('../middleware/auth');
const { latestProfile, sanitizeProfileInput } = require('../lib/profile');
const { touchStreak } = require('../lib/xp');
const { safeUser } = require('./auth');

const router = express.Router();

function findUser(req, res) {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.targetUserId);
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return null; }
  return { db, user };
}

router.get('/:userId', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  res.json(safeUser(r.user));
});

// Only name and reminder preference can be changed here.
router.put('/:userId', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  const { name, reminderEmails } = req.body || {};
  if (typeof name === 'string' && name.trim()) r.user.name = name.trim().slice(0, 80);
  if (typeof reminderEmails === 'boolean') r.user.reminderEmails = reminderEmails;
  writeDatabase(r.db);
  res.json(safeUser(r.user));
});

router.get('/:userId/profile', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  res.json({ profile: latestProfile(r.db, r.user) });
});

function upsertProfile(db, user, updates) {
  const key = user.userPath === 'college' ? 'collegeProfiles' : 'highSchoolProfiles';
  const existing = latestProfile(db, user);
  if (existing) {
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() });
    return existing;
  }
  const profile = { id: uuidv4(), userId: user.id, ...updates, createdAt: new Date().toISOString() };
  db[key].push(profile);
  return profile;
}

router.put('/:userId/profile', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  const profile = upsertProfile(r.db, r.user, sanitizeProfileInput(req.body));
  writeDatabase(r.db);
  res.json({ ok: true, profile });
});

// POST /api/users/:userId/activity — called when the app opens; updates the daily streak
router.post('/:userId/activity', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  const changed = touchStreak(r.user);
  if (changed) writeDatabase(r.db);
  res.json({ currentStreak: r.user.currentStreak || 0, streakChanged: changed, xpTotal: r.user.xpTotal || 0, level: r.user.level || 1 });
});

router.put('/:userId/path', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  const { userPath } = req.body || {};
  if (!['high-school', 'college'].includes(userPath)) return res.status(400).json({ error: 'Caminho inválido' });
  r.user.userPath = userPath;
  writeDatabase(r.db);
  res.json(safeUser(r.user));
});

router.get('/:userId/badges', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  const badges = r.db.userBadges.filter(ub => ub.userId === r.user.id).map(ub => {
    const badge = r.db.badges.find(b => b.id === ub.badgeId) || {};
    return { ...badge, unlockedDate: ub.unlockedDate, isLocked: ub.isLocked, progress: ub.progress };
  });
  res.json({ badges });
});

// Onboarding endpoints (kept for compatibility): both upsert the current profile.
router.post('/profiles/high-school', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  if (!r.user.userPath) r.user.userPath = 'high-school';
  const profile = upsertProfile(r.db, r.user, sanitizeProfileInput(req.body));
  writeDatabase(r.db);
  res.json(profile);
});

router.post('/profiles/college', requireSelf, (req, res) => {
  const r = findUser(req, res); if (!r) return;
  if (!r.user.userPath) r.user.userPath = 'college';
  const profile = upsertProfile(r.db, r.user, sanitizeProfileInput(req.body));
  writeDatabase(r.db);
  res.json(profile);
});

module.exports = router;
