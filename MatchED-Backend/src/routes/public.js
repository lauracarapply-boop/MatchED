// Public, no-login endpoints: impact numbers and partner lookup.
const express = require('express');
const { readDatabase } = require('../database/db');
const { impactStats } = require('../lib/metrics');

const router = express.Router();
let statsCache = { at: 0, data: null };

// GET /api/public/stats — the public impact page. Cached for 5 minutes.
router.get('/stats', (req, res) => {
  if (!statsCache.data || Date.now() - statsCache.at > 5 * 60_000) {
    const s = impactStats(readDatabase());
    // Small counts could identify people; only publish rates once there is enough data.
    if (s.profilesWithSchoolType < 20) s.publicSchoolShare = null;
    delete s.states;
    statsCache = { at: Date.now(), data: s };
  }
  res.json(statsCache.data);
});

// GET /api/public/partners/:code — name of the school/organization behind a referral link
router.get('/partners/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const p = readDatabase().partners.find(x => x.code === code);
  if (!p) return res.status(404).json({ error: 'Código não encontrado' });
  res.json({ code: p.code, name: p.name, type: p.type, city: p.city, state: p.state });
});

module.exports = router;
