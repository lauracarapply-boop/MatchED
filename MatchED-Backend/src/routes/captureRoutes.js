const express = require('express');
const { readDatabase } = require('../database/db');
const { importRecurringSources, captureOpportunities, checkSource } = require('../capture/captureBot');

const router = express.Router();

// POST /api/capture/import-sources
// Import/update all recurring sources from the hardcoded list
router.post('/import-sources', async (req, res) => {
  try {
    const result = await importRecurringSources();
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[captureRoutes] import-sources error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/capture/run
// Run full capture cycle across all due sources
router.post('/run', async (req, res) => {
  try {
    // Respond immediately, run async
    res.json({ success: true, message: 'Capture started in background' });
    captureOpportunities().catch(err => console.error('[CaptureBot] run error:', err));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/capture/source/:id
// Manually trigger capture for one specific source
router.post('/source/:id', async (req, res) => {
  try {
    const result = await checkSource(req.params.id);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[captureRoutes] checkSource error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/capture/logs
router.get('/logs', (req, res) => {
  try {
    const db = readDatabase();
    const logs = (db.captureLogs || []).slice(0, 50);
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/capture/stats
// Returns per-source capture stats (captured count, approval rate)
router.get('/stats', (req, res) => {
  try {
    const db = readDatabase();
    const captured = db.capturedOpportunities || [];
    const stats = {};
    for (const c of captured) {
      if (!c.source_id) continue;
      if (!stats[c.source_id]) stats[c.source_id] = { total: 0, approved: 0, rejected: 0, needs_review: 0 };
      stats[c.source_id].total++;
      if (c.status === 'approved' || c.status === 'published') stats[c.source_id].approved++;
      else if (c.status === 'rejected') stats[c.source_id].rejected++;
      else stats[c.source_id].needs_review++;
    }
    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
