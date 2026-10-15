const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { optionalAuth, requireAuth, requireSelf } = require('../middleware/auth');
const { computeMatch, deadlineInfo } = require('../lib/eligibility');
const { publicOpp, isLive } = require('../lib/opportunities');
const { matchingProfile, sanitizeProfileInput } = require('../lib/profile');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

function haystack(o) {
  return [o.programName, o.organizationName, o.description, o.eligibility, ...(o.tags || [])].join(' ').toLowerCase();
}

// Shared filtering used by the public explorer and the eligibility check.
function applyFilters(list, q) {
  let out = list;
  if (q.q) {
    const terms = String(q.q).toLowerCase().split(/\s+/).filter(Boolean);
    out = out.filter(o => { const h = haystack(o); return terms.every(t => h.includes(t)); });
  }
  if (q.category && q.category !== 'all') out = out.filter(o => o.category === q.category);
  if (q.level === 'high-school') out = out.filter(o => !o.education_levels.length ? o.audience !== 'college' : o.education_levels.some(l => ['high_school', 'middle_school'].includes(l)));
  if (q.level === 'college') out = out.filter(o => !o.education_levels.length ? o.audience !== 'high-school' : o.education_levels.some(l => ['undergraduate', 'graduate', 'gap_year', 'young_professional'].includes(l)));
  if (q.funded === '1') out = out.filter(o => o.flags.funded);
  if (q.brazil === '1') out = out.filter(o => o.flags.brazilFocused);
  if (q.publicSchool === '1') out = out.filter(o => o.flags.publicSchoolFriendly);
  if (q.noFee === '1') out = out.filter(o => !o.flags.hasFee);
  if (q.includeUSOnly !== '1') out = out.filter(o => !o.flags.requiresUSCitizenship);
  if (q.open === '1') out = out.filter(o => deadlineInfo(o).status !== 'closed');
  return out;
}

function sortList(list, sort) {
  if (sort === 'deadline') {
    const rank = o => { const d = deadlineInfo(o); return d.status === 'upcoming' ? d.daysLeft : d.status === 'open' ? 10000 : 20000; };
    return list.sort((a, b) => rank(a) - rank(b));
  }
  if (sort === 'match') return list.sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));
  if (sort === 'recent') return list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return list;
}

function page(list, q) {
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 24));
  const offset = Math.max(0, Number(q.offset) || 0);
  return { total: list.length, limit, offset, opportunities: list.slice(offset, offset + limit) };
}

// GET /api/opportunities — public explorer (no login needed). With a login,
// results also carry a personal match score.
router.get('/', optionalAuth, (req, res) => {
  const db = readDatabase();
  let list = db.opportunities.filter(isLive).map(o => publicOpp(o));
  list = applyFilters(list, req.query);
  if (req.user) {
    const profile = matchingProfile(db, req.user);
    list = list.map(o => ({ ...o, ...computeMatch(o, profile) }));
  }
  res.json(page(sortList(list, req.query.sort || (req.user ? 'match' : 'deadline')), req.query));
});

// GET /api/opportunities/by-ids?ids=a,b,c — used by Saved/Quests/Results/Deadlines
router.get('/by-ids', optionalAuth, (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 300);
  const set = new Set(ids);
  const db = readDatabase();
  res.json({ opportunities: db.opportunities.filter(o => set.has(o.id)).map(o => publicOpp(o)) });
});

// GET /api/opportunities/match/:userId — personal feed, best matches first,
// without the ones the student already swiped.
router.get('/match/:userId', requireSelf, (req, res) => {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.targetUserId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const profile = matchingProfile(db, user);
  const swiped = new Set(db.swipeEvents.filter(s => s.userId === user.id).map(s => s.opportunityId));
  const liked = new Set(db.swipeEvents.filter(s => s.userId === user.id && s.action === 'like')
    .map(s => (db.opportunities.find(o => o.id === s.opportunityId) || {}).category).filter(Boolean));
  let list = db.opportunities.filter(o => isLive(o) && !swiped.has(o.id)).map(o => publicOpp(o));
  list = applyFilters(list, { ...req.query, includeUSOnly: '0' });
  list = list.map(o => ({ ...o, ...computeMatch(o, profile, { likedCategories: liked }) }))
    .filter(o => o.deadlineStatus !== 'closed' || req.query.includeClosed === '1');
  list.sort((a, b) => (b.eligible - a.eligible) || (b.computedScore - a.computedScore));
  const limit = Math.min(300, Number(req.query.limit) || 150);
  res.json({ opportunities: list.slice(0, limit), total: list.length });
});

// POST /api/opportunities/check — "Isso vale pra mim?" Anonymous eligibility check.
// Takes a mini-profile, returns matching opportunities. Logs an anonymous event
// (no personal data) so the team can measure the funnel.
router.post('/check', rateLimit({ windowMs: 60_000, max: 30 }), optionalAuth, (req, res) => {
  const body = req.body || {};
  const profile = {
    userPath: body.userPath === 'college' ? 'college' : 'high-school',
    ...sanitizeProfileInput(body),
  };
  const db = readDatabase();
  let list = db.opportunities.filter(isLive).map(o => publicOpp(o));
  list = list.map(o => ({ ...o, ...computeMatch(o, profile) }))
    .filter(o => o.eligible && o.deadlineStatus !== 'closed');
  list.sort((a, b) => b.computedScore - a.computedScore);
  const counts = {
    eligible: list.length,
    funded: list.filter(o => o.flags.funded).length,
    brazil: list.filter(o => o.flags.brazilFocused).length,
    closingSoon: list.filter(o => o.daysLeft !== null && o.daysLeft <= 30).length,
  };
  db.checkEvents.push({
    id: uuidv4(), at: new Date().toISOString(), loggedIn: Boolean(req.user),
    userPath: profile.userPath, gradeLevel: profile.gradeLevel || null, schoolType: profile.schoolType || null,
    state: profile.state || null, results: counts.eligible, ref: String(body.ref || '').slice(0, 40) || null,
  });
  if (db.checkEvents.length > 20000) db.checkEvents.splice(0, db.checkEvents.length - 20000);
  writeDatabase(db);
  res.json({ counts, opportunities: list.slice(0, Math.min(30, Number(body.limit) || 12)) });
});

// POST /api/opportunities/submit — a logged-in student suggests an opportunity.
router.post('/submit', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.programName || !/^https?:\/\//i.test(b.websiteUrl || '')) {
    return res.status(400).json({ error: 'Informe o nome e o link oficial (começando com https://).' });
  }
  const allowed = ['programName', 'organizationName', 'description', 'category', 'audience', 'fundingType', 'modality',
    'deadline', 'eligibility', 'location', 'duration', 'websiteUrl', 'tags', 'competitionLevel'];
  const data = {};
  for (const k of allowed) if (b[k] !== undefined) data[k] = typeof b[k] === 'string' ? b[k].slice(0, 4000) : b[k];
  if (!Array.isArray(data.tags)) data.tags = [];
  const db = readDatabase();
  const pending = {
    id: uuidv4(), ...data,
    submittedBy: req.user.id, submittedByName: req.user.name, submittedByEmail: req.user.email,
    submittedAt: new Date().toISOString(), status: 'pending',
  };
  db.pendingOpportunities.push(pending);
  writeDatabase(db);
  res.json({ success: true, pending });
});

// POST /api/opportunities/:id/report — anyone can flag a problem (broken link,
// wrong deadline, not open to Brazilians...). Goes to the admin queue.
const REPORT_REASONS = ['broken_link', 'wrong_deadline', 'not_for_brazilians', 'requires_payment', 'wrong_info', 'other'];
router.post('/:id/report', rateLimit({ windowMs: 60_000, max: 10 }), optionalAuth, (req, res) => {
  const db = readDatabase();
  const opp = db.opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const reason = REPORT_REASONS.includes(req.body && req.body.reason) ? req.body.reason : 'other';
  db.opportunityReports.push({
    id: uuidv4(), opportunityId: opp.id, opportunityName: opp.programName || opp.title, reason,
    note: String((req.body && req.body.note) || '').slice(0, 500),
    userId: req.user ? req.user.id : null, status: 'open', createdAt: new Date().toISOString(),
  });
  writeDatabase(db);
  res.json({ ok: true });
});

// GET /api/opportunities/:id — public detail (full description).
router.get('/:id', optionalAuth, (req, res) => {
  const db = readDatabase();
  const opp = db.opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  let out = publicOpp(opp, { full: true });
  if (req.user) out = { ...out, ...computeMatch(out, matchingProfile(db, req.user)) };
  res.json(out);
});

module.exports = router;
module.exports.REPORT_REASONS = REPORT_REASONS;
