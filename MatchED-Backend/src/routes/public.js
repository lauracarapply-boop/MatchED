// Public, no-login endpoints: impact numbers and partner lookup.
const express = require('express');
const { readDatabase } = require('../database/db');
const crypto = require('crypto');
const { impactStats, PUBLIC_SCHOOL } = require('../lib/metrics');
const { latestProfile } = require('../lib/profile');

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
  if (!p) return res.json({ found: false }); // unknown code: answer quietly, the site just shows no banner
  res.json({ code: p.code, name: p.name, type: p.type, city: p.city, state: p.state });
});

// GET /api/public/partners/:code/dashboard?t=TOKEN — the private page a partner
// school's coordinator opens. Only totals; any group with fewer than 5 students
// is shown as "<5" so nobody can be singled out. Wrong token = same answer as unknown code.
const MIN_GROUP = 5;
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const bucket = n => (n > 0 && n < MIN_GROUP ? '<5' : n);

router.get('/partners/:code/dashboard', (req, res) => {
  const db = readDatabase();
  const code = String(req.params.code || '').toUpperCase();
  const p = db.partners.find(x => x.code === code);
  if (!p || !p.viewToken || !safeEqual(p.viewToken, req.query.t || '')) return res.status(404).json({ error: 'Link inválido ou expirado' });
  const stats = impactStats(db, { userFilter: u => u.partnerCode === p.code });
  const users = db.users.filter(u => u.partnerCode === p.code && !u.demo);
  const profiles = users.map(u => latestProfile(db, u)).filter(Boolean);
  const count = (arr, key) => { const m = {}; arr.forEach(x => { const v = x[key]; if (v) m[v] = (m[v] || 0) + 1; }); return m; };
  const grades = count(profiles, 'gradeLevel');
  const interests = {};
  profiles.forEach(pr => (pr.interests || []).forEach(i => { interests[i] = (interests[i] || 0) + 1; }));
  const checks = db.checkEvents.filter(e => e.ref === p.code);
  const enough = users.length >= MIN_GROUP;
  res.json({
    partner: { name: p.name, code: p.code, type: p.type, city: p.city, state: p.state },
    totals: {
      checks: checks.length,
      students: stats.students,
      profilesComplete: profiles.filter(x => x.gradeLevel || x.university).length,
      applicationsStarted: stats.applicationsStarted,
      applicationsSubmitted: stats.applicationsSubmitted,
      acceptances: bucket(stats.acceptances),
      scholarshipBRL: enough ? stats.scholarshipBRL : null,
      publicSchoolShare: enough ? stats.publicSchoolShare : null,
    },
    byGrade: enough ? Object.fromEntries(Object.entries(grades).map(([k, v]) => [k, bucket(v)])) : null,
    topInterests: enough ? Object.entries(interests).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ interest: k, students: bucket(v) })) : null,
    minGroup: MIN_GROUP,
    updatedAt: new Date().toISOString(),
  });
});

module.exports = router;
