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

// ── Privacy (LGPD): a student can download or erase everything about them ──
const PERSONAL = ['highSchoolProfiles', 'collegeProfiles', 'savedOpportunities', 'swipeEvents', 'applicationQuests',
  'questTasks', 'deadlines', 'userBadges', 'notifications', 'xpTransactions', 'resultTracking', 'subscriptionPlans'];

function personalData(db, userId) {
  const out = {};
  for (const c of PERSONAL) out[c] = (db[c] || []).filter(r => r && r.userId === userId);
  out.suggestedOpportunities = (db.pendingOpportunities || []).filter(p => p.submittedBy === userId)
    .map(({ submittedByEmail, ...rest }) => rest);
  out.reports = (db.opportunityReports || []).filter(r => r.userId === userId);
  return out;
}

// GET /api/users/:userId/export — all of the student's data as a JSON file
router.get('/:userId/export', requireSelf, (req, res) => {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.targetUserId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.setHeader('Content-Disposition', 'attachment; filename="matched-meus-dados.json"');
  res.json({ exportedAt: new Date().toISOString(), account: safeUser(user), ...personalData(db, user.id) });
});

// DELETE /api/users/:userId — erase the account and everything linked to it.
// Body must carry {"confirm":"EXCLUIR"} so it never happens by accident.
// Reports and suggestions are kept for curation but no longer point to the person.
router.delete('/:userId', requireSelf, (req, res) => {
  if (!req.body || req.body.confirm !== 'EXCLUIR') return res.status(400).json({ error: 'Para excluir, envie a confirmação "EXCLUIR".' });
  const db = readDatabase();
  const id = req.targetUserId;
  if (!db.users.some(u => u.id === id)) return res.status(404).json({ error: 'Usuário não encontrado' });
  for (const c of PERSONAL) db[c] = (db[c] || []).filter(r => !r || r.userId !== id);
  for (const p of db.pendingOpportunities || []) if (p.submittedBy === id) { p.submittedBy = null; p.submittedByName = null; p.submittedByEmail = null; }
  for (const r of db.opportunityReports || []) if (r.userId === id) r.userId = null;
  db.reminderLog = (db.reminderLog || []).filter(r => !String(r.key || '').startsWith(id + '|'));
  db.users = db.users.filter(u => u.id !== id);
  writeDatabase(db);
  res.json({ deleted: true });
});

module.exports = router;
