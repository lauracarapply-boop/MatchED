const express = require('express');
const { readDatabase, writeDatabase } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'lauracar.apply@gmail.com').split(',').map(email => email.trim().toLowerCase());

function isAdmin(db, userId) {
  const user = db.users.find(u => u.id === userId);
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// GET /api/admin/opportunities?adminId=xxx
router.get('/opportunities', (req, res) => {
  try {
    const { adminId } = req.query;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ opportunities: db.opportunities || [] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/opportunities — add new live opportunity
router.post('/opportunities', (req, res) => {
  try {
    const { adminId, ...oppData } = req.body;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    const newOpp = { id: uuidv4(), ...oppData, createdAt: new Date().toISOString() };
    db.opportunities.push(newOpp);
    writeDatabase(db);
    res.json(newOpp);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/opportunities/:id — edit live opportunity
router.put('/opportunities/:id', (req, res) => {
  try {
    const { adminId, ...updates } = req.body;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    const idx = db.opportunities.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.opportunities[idx] = { ...db.opportunities[idx], ...updates };
    writeDatabase(db);
    res.json(db.opportunities[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/opportunities/:id
router.delete('/opportunities/:id', (req, res) => {
  try {
    const { adminId } = req.body;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    const idx = db.opportunities.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.opportunities.splice(idx, 1);
    writeDatabase(db);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/pending?adminId=xxx
router.get('/pending', (req, res) => {
  try {
    const { adminId } = req.query;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ pending: db.pendingOpportunities || [] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/pending/:id/approve — move pending to live opportunities
router.put('/pending/:id/approve', (req, res) => {
  try {
    const { adminId } = req.body;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    if (!db.pendingOpportunities) return res.status(404).json({ error: 'Not found' });
    const idx = db.pendingOpportunities.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const { submittedBy, submittedByName, submittedByEmail, submittedAt, status, ...oppData } = db.pendingOpportunities[idx];
    const live = { ...oppData, createdAt: new Date().toISOString() };
    db.opportunities.push(live);
    db.pendingOpportunities.splice(idx, 1);
    writeDatabase(db);
    res.json(live);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/pending/:id — reject pending submission
router.delete('/pending/:id', (req, res) => {
  try {
    const { adminId } = req.body;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });
    if (!db.pendingOpportunities) return res.status(404).json({ error: 'Not found' });
    const idx = db.pendingOpportunities.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.pendingOpportunities.splice(idx, 1);
    writeDatabase(db);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/results-metrics?adminId=xxx
router.get('/results-metrics', (req, res) => {
  try {
    const { adminId } = req.query;
    const db = readDatabase();
    if (!isAdmin(db, adminId)) return res.status(403).json({ error: 'Forbidden' });

    const results = db.resultTracking || [];
    const opps = {};
    (db.opportunities || []).forEach(o => { opps[o.id] = o; });
    const users = {};
    (db.users || []).forEach(u => { users[u.id] = u; });

    const statusCounts = { not_started: 0, applying: 0, applied: 0, waiting: 0, accepted: 0, rejected: 0 };
    let totalBRL = 0;
    const byCategoryAccepted = {};
    const rows = [];

    for (const r of results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      if (r.scholarshipAmountBRL) totalBRL += Number(r.scholarshipAmountBRL);
      const opp = opps[r.opportunityId];
      if (r.status === 'accepted' && opp) {
        const cat = opp.category || opp.opportunity_type || 'other';
        byCategoryAccepted[cat] = (byCategoryAccepted[cat] || 0) + 1;
      }
      rows.push({
        userId: r.userId,
        userName: users[r.userId]?.name || users[r.userId]?.email || r.userId,
        userEmail: users[r.userId]?.email || '',
        opportunityId: r.opportunityId,
        opportunityName: opp?.programName || opp?.title || r.opportunityId,
        organization: opp?.organizationName || opp?.organization || '',
        status: r.status,
        scholarshipAmountBRL: r.scholarshipAmountBRL,
        appliedAt: r.appliedAt,
        decisionAt: r.decisionAt,
        updatedAt: r.updatedAt,
      });
    }

    const totalWithDecision = (statusCounts.accepted || 0) + (statusCounts.rejected || 0);
    const acceptanceRate = totalWithDecision > 0
      ? Math.round((statusCounts.accepted / totalWithDecision) * 100)
      : null;

    res.json({
      summary: { ...statusCounts, totalBRL, acceptanceRate, totalTracking: results.length },
      byCategoryAccepted,
      rows: rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/check?adminId=xxx — quick admin check
router.get('/check', (req, res) => {
  try {
    const { adminId } = req.query;
    const db = readDatabase();
    res.json({ isAdmin: isAdmin(db, adminId) });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
