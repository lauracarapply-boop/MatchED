const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');

const router = express.Router();

const REJECTION_REASONS = [
  'irrelevant', 'unreliable_source', 'expired_deadline', 'duplicate',
  'not_for_students', 'no_clear_benefit', 'broken_link', 'missing_information', 'other',
];

// GET /api/captured-opportunities
router.get('/', (req, res) => {
  try {
    const db = readDatabase();
    let list = db.capturedOpportunities || [];
    const { status, search, type, limit = 50, offset = 0 } = req.query;
    if (status) list = list.filter(o => o.status === status);
    if (type) list = list.filter(o => o.opportunity_type === type);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => (o.title || '').toLowerCase().includes(q) || (o.organization || '').toLowerCase().includes(q));
    }
    const total = list.length;
    list = list.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ opportunities: list, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/captured-opportunities/:id
router.get('/:id', (req, res) => {
  try {
    const db = readDatabase();
    const opp = (db.capturedOpportunities || []).find(o => o.id === req.params.id);
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/captured-opportunities/:id — edit
router.put('/:id', (req, res) => {
  try {
    const db = readDatabase();
    const idx = (db.capturedOpportunities || []).findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.capturedOpportunities[idx] = { ...db.capturedOpportunities[idx], ...req.body, updated_at: new Date().toISOString() };
    writeDatabase(db);
    res.json(db.capturedOpportunities[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/captured-opportunities/:id/approve — move to opportunities
router.post('/:id/approve', (req, res) => {
  try {
    const db = readDatabase();
    if (!db.capturedOpportunities) return res.status(404).json({ error: 'Not found' });
    const idx = db.capturedOpportunities.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const captured = db.capturedOpportunities[idx];
    const { reviewedBy = 'admin', publishNow = true, ...overrides } = req.body || {};

    const published = {
      id: uuidv4(),
      title: captured.title || captured.raw_title,
      organization: captured.organization || '',
      category: captured.opportunity_type || 'scholarship',
      description: captured.short_description || captured.raw_description || '',
      tags: captured.focus_areas || [],
      deadline: captured.deadline || null,
      url: captured.monitored_url || captured.official_url || captured.raw_url || '',
      official_url: captured.official_url || captured.monitored_url || '',
      focus_areas: captured.focus_areas || [],
      education_levels: captured.education_levels || [],
      opportunity_types: captured.opportunity_type ? [captured.opportunity_type] : [],
      trust_tier: captured.trust_tier || 'approved',
      reliability_score: captured.reliability_score || 70,
      quality_score: captured.quality_score || 60,
      source_type: captured.source_type || 'official',
      base_url: captured.base_url || '',
      monitored_url: captured.monitored_url || '',
      notes: captured.notes || captured.short_description || '',
      active: true,
      status: publishNow ? 'published' : 'approved',
      review_status: 'ready',
      source_scope: 'specific_opportunity',
      imported_from: captured.imported_from || null,
      audience: (captured.education_levels || []).includes('high_school') ? 'high-school'
        : (captured.education_levels || []).includes('undergraduate') ? 'college' : 'both',
      location: captured.country || null,
      modality: captured.format || 'remote',
      competitionLevel: 'medium',
      fundingType: 'free',
      ...overrides,
      createdAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!db.opportunities) db.opportunities = [];
    db.opportunities.push(published);

    // Update source reliability_score (small boost on approval)
    if (captured.source_id && db.sources) {
      const sIdx = db.sources.findIndex(s => s.id === captured.source_id);
      if (sIdx >= 0) {
        const current = db.sources[sIdx].reliability_score || 70;
        db.sources[sIdx].reliability_score = Math.min(100, current + 0.5);
      }
    }

    // Mark captured as approved
    db.capturedOpportunities[idx] = {
      ...captured,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    };

    writeDatabase(db);
    res.json({ published, captured: db.capturedOpportunities[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/captured-opportunities/:id/reject
router.post('/:id/reject', (req, res) => {
  try {
    const db = readDatabase();
    const idx = (db.capturedOpportunities || []).findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { reason = 'other', reviewedBy = 'admin' } = req.body || {};
    if (!REJECTION_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid rejection reason' });

    db.capturedOpportunities[idx] = {
      ...db.capturedOpportunities[idx],
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    };

    // Penalize source reliability
    const captured = db.capturedOpportunities[idx];
    if (captured.source_id && db.sources) {
      const sIdx = db.sources.findIndex(s => s.id === captured.source_id);
      if (sIdx >= 0) {
        const current = db.sources[sIdx].reliability_score || 70;
        db.sources[sIdx].reliability_score = Math.max(0, current - 1);
      }
    }

    writeDatabase(db);
    res.json(db.capturedOpportunities[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/captured-opportunities/:id
router.delete('/:id', (req, res) => {
  try {
    const db = readDatabase();
    const idx = (db.capturedOpportunities || []).findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.capturedOpportunities.splice(idx, 1);
    writeDatabase(db);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
