const express = require('express');
const { readDatabase } = require('../database/db');
const { requireSelf } = require('../middleware/auth');
const { firstUrl } = require('../lib/opportunities');

const router = express.Router();

// Deadlines of everything the student is following (quests > saved > liked).
function deadlinesFor(db, userId, now = new Date()) {
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
      programName: opp.programName || opp.title || '—',
      organizationName: opp.organizationName || opp.organization || '',
      category: opp.category || 'scholarship',
      deadline: opp.deadline, daysLeft, urgency, source: m,
      resultStatus: result[oppId] || null,
      websiteUrl: firstUrl(opp) || null,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

router.get('/:userId', requireSelf, (req, res) => {
  res.json({ deadlines: deadlinesFor(readDatabase(), req.targetUserId) });
});

module.exports = router;
module.exports.deadlinesFor = deadlinesFor;
