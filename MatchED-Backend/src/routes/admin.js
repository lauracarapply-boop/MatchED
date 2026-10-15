const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { publicOpp } = require('../lib/opportunities');
const { impactStats } = require('../lib/metrics');

const router = express.Router();

// GET /api/admin/check — is the logged-in user an admin?
router.get('/check', requireAuth, (req, res) => res.json({ isAdmin: Boolean(req.isAdmin) }));

router.use(requireAdmin);

const EDITABLE = ['programName', 'organizationName', 'description', 'category', 'audience', 'fundingType', 'modality',
  'deadline', 'eligibility', 'location', 'duration', 'websiteUrl', 'tags', 'competitionLevel', 'active', 'fundingAmount',
  'description_pt', 'eligibility_pt'];

function pickEditable(body = {}) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.websiteUrl && !/^https?:\/\//i.test(out.websiteUrl)) delete out.websiteUrl;
  if (out.programName) out.title = out.programName;
  if (out.organizationName !== undefined) out.organization = out.organizationName;
  if (out.websiteUrl) out.url = out.websiteUrl;
  return out;
}

// GET /api/admin/opportunities?q=&limit=&offset= — live list with search + paging
router.get('/opportunities', (req, res) => {
  const db = readDatabase();
  let list = db.opportunities.map(o => publicOpp(o));
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    list = list.filter(o => (o.programName + ' ' + o.organizationName).toLowerCase().includes(q));
  }
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  res.json({ opportunities: list.slice(offset, offset + limit), total: list.length });
});

router.post('/opportunities', (req, res) => {
  const db = readDatabase();
  const data = pickEditable(req.body);
  if (!data.programName) return res.status(400).json({ error: 'Nome obrigatório' });
  const opp = { id: uuidv4(), ...data, status: 'published', source_type: 'manual', createdAt: new Date().toISOString(), updated_at: new Date().toISOString() };
  db.opportunities.push(opp);
  writeDatabase(db);
  res.json(opp);
});

router.put('/opportunities/:id', (req, res) => {
  const db = readDatabase();
  const opp = db.opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Não encontrada' });
  Object.assign(opp, pickEditable(req.body), { updated_at: new Date().toISOString() });
  writeDatabase(db);
  res.json(opp);
});

router.delete('/opportunities/:id', (req, res) => {
  const db = readDatabase();
  const idx = db.opportunities.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrada' });
  db.opportunities.splice(idx, 1);
  writeDatabase(db);
  res.json({ success: true });
});

router.get('/pending', (req, res) => {
  res.json({ pending: readDatabase().pendingOpportunities });
});

// PUT /api/admin/pending/:id/approve — publish a student suggestion; body may carry edits
router.put('/pending/:id/approve', (req, res) => {
  const db = readDatabase();
  const idx = db.pendingOpportunities.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrada' });
  const { submittedBy, submittedByName, submittedByEmail, submittedAt, status, ...data } = db.pendingOpportunities[idx];
  const live = {
    ...pickEditable(data), ...pickEditable(req.body),
    id: data.id, status: 'published', source_type: 'user_submission', submittedBy,
    createdAt: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  db.opportunities.push(live);
  db.pendingOpportunities.splice(idx, 1);
  writeDatabase(db);
  res.json(live);
});

router.delete('/pending/:id', (req, res) => {
  const db = readDatabase();
  const idx = db.pendingOpportunities.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrada' });
  db.pendingOpportunities.splice(idx, 1);
  writeDatabase(db);
  res.json({ success: true });
});

// Problem reports from students
router.get('/reports', (req, res) => {
  const db = readDatabase();
  const status = req.query.status || 'open';
  res.json({ reports: db.opportunityReports.filter(r => status === 'all' || r.status === status).reverse() });
});

router.put('/reports/:id', (req, res) => {
  const db = readDatabase();
  const r = db.opportunityReports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Não encontrado' });
  if (['open', 'resolved', 'dismissed'].includes(req.body && req.body.status)) r.status = req.body.status;
  r.updatedAt = new Date().toISOString();
  writeDatabase(db);
  res.json(r);
});

// Partner schools / organizations (referral codes)
router.get('/partners', (req, res) => {
  const db = readDatabase();
  const partners = db.partners.map(p => ({
    ...p,
    stats: impactStats(db, { userFilter: u => u.partnerCode === p.code }),
    checks: db.checkEvents.filter(e => e.ref === p.code).length,
  }));
  res.json({ partners });
});

router.post('/partners', (req, res) => {
  const db = readDatabase();
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  let code = String(b.code || name).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'ESCOLA';
  let n = 2; const base = code;
  while (db.partners.some(p => p.code === code)) code = base.slice(0, 10) + n++;
  const partner = {
    id: uuidv4(), code, name: name.slice(0, 120), type: ['escola', 'gremio', 'organizacao'].includes(b.type) ? b.type : 'escola',
    city: String(b.city || '').slice(0, 80), state: String(b.state || '').toUpperCase().slice(0, 2),
    contact: String(b.contact || '').slice(0, 120), createdAt: new Date().toISOString(),
  };
  db.partners.push(partner);
  writeDatabase(db);
  res.json(partner);
});

router.delete('/partners/:id', (req, res) => {
  const db = readDatabase();
  const idx = db.partners.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  db.partners.splice(idx, 1);
  writeDatabase(db);
  res.json({ success: true });
});

// Impact + funnel for the admin dashboard
router.get('/impact', (req, res) => {
  const db = readDatabase();
  const checks = db.checkEvents;
  res.json({
    impact: impactStats(db),
    funnel: {
      eligibilityChecks: checks.length,
      checksFromPartners: checks.filter(c => c.ref).length,
      signups: db.users.length,
      onboarded: db.users.filter(u => u.userPath).length,
      savedOrLiked: new Set([...db.savedOpportunities.map(s => s.userId), ...db.swipeEvents.filter(s => s.action === 'like').map(s => s.userId)]).size,
      startedQuest: new Set(db.applicationQuests.map(q => q.userId)).size,
      submitted: new Set(db.applicationQuests.filter(q => q.status !== 'in-progress' && q.status !== 'withdrawn').map(q => q.userId)).size,
    },
    openReports: db.opportunityReports.filter(r => r.status === 'open').length,
  });
});

// GET /api/admin/results-metrics — application outcomes (kept for the existing dashboard)
router.get('/results-metrics', (req, res) => {
  const db = readDatabase();
  const opps = Object.fromEntries(db.opportunities.map(o => [o.id, o]));
  const users = Object.fromEntries(db.users.map(u => [u.id, u]));
  const statusCounts = { not_started: 0, applying: 0, applied: 0, waiting: 0, accepted: 0, rejected: 0, did_not_apply: 0 };
  let totalBRL = 0;
  const byCategoryAccepted = {};
  const rows = db.resultTracking.map(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    const opp = opps[r.opportunityId];
    if (r.status === 'accepted') {
      totalBRL += Number(r.scholarshipAmountBRL) || 0;
      const cat = (opp && opp.category) || 'other';
      byCategoryAccepted[cat] = (byCategoryAccepted[cat] || 0) + 1;
    }
    return {
      userId: r.userId, userName: users[r.userId] ? users[r.userId].name : r.userId, userEmail: users[r.userId] ? users[r.userId].email : '',
      opportunityId: r.opportunityId, opportunityName: opp ? (opp.programName || opp.title) : r.opportunityId,
      organization: opp ? (opp.organizationName || opp.organization || '') : '', status: r.status,
      scholarshipAmountBRL: r.scholarshipAmountBRL, appliedAt: r.appliedAt, decisionAt: r.decisionAt, updatedAt: r.updatedAt,
    };
  });
  const decided = statusCounts.accepted + statusCounts.rejected;
  res.json({
    summary: { ...statusCounts, totalBRL, acceptanceRate: decided ? Math.round(statusCounts.accepted / decided * 100) : null, totalTracking: rows.length },
    byCategoryAccepted,
    rows: rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
  });
});

module.exports = router;
