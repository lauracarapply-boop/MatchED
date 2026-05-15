const express = require('express');
const { readDatabase } = require('../database/db');

const router = express.Router();

router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();

    const now = new Date();
    const oppMeta = {}; // oppId → { source, questId?, questStatus?, savedId? }

    // Active quests (highest priority)
    (db.applicationQuests || [])
      .filter(q => q.userId === userId)
      .forEach(q => {
        if (!oppMeta[q.opportunityId]) {
          oppMeta[q.opportunityId] = {
            source: 'quest',
            questId: q.id,
            questStatus: q.status,
            progressPercentage: q.progressPercentage || 0,
          };
        }
      });

    // Saved opportunities
    (db.savedOpportunities || [])
      .filter(s => s.userId === userId && s.status !== 'removed')
      .forEach(s => {
        if (!oppMeta[s.opportunityId]) {
          oppMeta[s.opportunityId] = { source: 'saved', savedId: s.id };
        }
      });

    // Liked swipes
    (db.swipeEvents || [])
      .filter(s => s.userId === userId && s.action === 'like')
      .forEach(s => {
        if (!oppMeta[s.opportunityId]) {
          oppMeta[s.opportunityId] = { source: 'liked' };
        }
      });

    const deadlines = [];

    for (const [oppId, meta] of Object.entries(oppMeta)) {
      const opp = (db.opportunities || []).find(o => o.id === oppId);
      if (!opp || !opp.deadline) continue;

      const deadlineDate = new Date(opp.deadline);
      const daysLeft = Math.ceil((deadlineDate - now) / 86400000);

      let urgency;
      if (daysLeft <= 0)  urgency = 'expired';
      else if (daysLeft <= 3)  urgency = 'critical';
      else if (daysLeft <= 7)  urgency = 'high';
      else if (daysLeft <= 14) urgency = 'medium';
      else                     urgency = 'low';

      deadlines.push({
        opportunityId: oppId,
        programName: opp.programName || opp.title || '—',
        organizationName: opp.organizationName || opp.organization || '',
        category: opp.category || (Array.isArray(opp.opportunity_types) ? opp.opportunity_types[0] : opp.opportunity_types) || 'scholarship',
        deadline: opp.deadline,
        daysLeft,
        urgency,
        source: meta,
        tags: (opp.tags || opp.focus_areas || []).slice(0, 2),
        websiteUrl: opp.websiteUrl || opp.url || opp.official_url || opp.monitored_url || null,
      });
    }

    deadlines.sort((a, b) => a.daysLeft - b.daysLeft);

    res.json({ deadlines });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
