const express = require('express');
const { readDatabase } = require('../database/db');
const { requireSelf } = require('../middleware/auth');
const { firstUrl, tidyCaps, sentenceCaps } = require('../lib/opportunities');

const router = express.Router();

// Deadlines of everything the student is following (quests > saved > liked).
function followedMeta(db, userId) {
  const meta = {};
  db.applicationQuests.filter(q => q.userId === userId && q.status !== 'withdrawn').forEach(q => {
    if (!meta[q.opportunityId]) meta[q.opportunityId] = { source: 'quest', questId: q.id, questStatus: q.status, progressPercentage: q.progressPercentage || 0 };
  });
  db.savedOpportunities.filter(s => s.userId === userId && s.status !== 'removed').forEach(s => {
    if (!meta[s.opportunityId]) meta[s.opportunityId] = { source: 'saved', savedId: s.id };
  });
  db.swipeEvents.filter(s => s.userId === userId && s.action === 'like').forEach(s => {
    if (!meta[s.opportunityId]) meta[s.opportunityId] = { source: 'liked' };
  });
  return meta;
}

function deadlinesFor(db, userId, now = new Date()) {
  const meta = followedMeta(db, userId);
  const result = db.resultTracking.filter(r => r.userId === userId).reduce((m, r) => { m[r.opportunityId] = r.status; return m; }, {});

  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  const out = [];
  for (const [oppId, m] of Object.entries(meta)) {
    const opp = db.opportunities.find(o => o.id === oppId);
    if (!opp || !opp.deadline) continue;
    const day = new Date(String(opp.deadline).slice(0, 10) + 'T00:00:00Z');
    const daysLeft = Math.round((day - today) / 86400000);
    let urgency;
    if (daysLeft < 0) urgency = 'expired';
    else if (daysLeft <= 3) urgency = 'critical';
    else if (daysLeft <= 7) urgency = 'high';
    else if (daysLeft <= 30) urgency = 'medium';
    else urgency = 'low';
    out.push({
      opportunityId: oppId,
      programName: tidyCaps(opp.programName || opp.title) || '—',
      organizationName: tidyCaps(opp.organizationName || opp.organization || ''),
      category: opp.category || 'scholarship',
      deadline: opp.deadline, daysLeft, urgency, source: m,
      resultStatus: result[oppId] || null,
      websiteUrl: firstUrl(opp) || null,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

// Followed opportunities without an exact date (rolling, "usually December to March"…)
function undatedFor(db, userId) {
  const meta = followedMeta(db, userId);
  const out = [];
  for (const [oppId, m] of Object.entries(meta)) {
    const opp = db.opportunities.find(o => o.id === oppId);
    if (!opp || opp.deadline) continue;
    out.push({
      opportunityId: oppId,
      programName: tidyCaps(opp.programName || opp.title) || '—',
      organizationName: tidyCaps(opp.organizationName || opp.organization || ''),
      deadline_text: opp.deadline_text ? sentenceCaps(opp.deadline_text) : null,
      last_known_deadline: opp.last_known_deadline || null,
      source: m, websiteUrl: firstUrl(opp) || null,
    });
  }
  return out;
}

router.get('/:userId', requireSelf, (req, res) => {
  const db = readDatabase();
  res.json({ deadlines: deadlinesFor(db, req.targetUserId), undated: undatedFor(db, req.targetUserId) });
});

module.exports = router;
module.exports.deadlinesFor = deadlinesFor;
