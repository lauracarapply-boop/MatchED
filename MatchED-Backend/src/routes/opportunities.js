const express = require('express');
const { readDatabase, writeDatabase } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Normalize any string for comparison (lowercase, spaces)
function norm(s) {
  return (s || '').toLowerCase().replace(/[-_]/g, ' ').trim();
}

// User interest → relevant topic keywords (works with any tag format)
const INTEREST_TOPICS = {
  'leadership':            ['leadership', 'civic', 'social impact', 'community', 'government', 'politics', 'public policy'],
  'research':              ['research', 'lab', 'science', 'stem', 'academic', 'investigation', 'study'],
  'technology':            ['technology', 'tech', 'coding', 'software', 'programming', 'computer', 'engineering', 'stem', 'ai', 'robotics', 'data'],
  'business':              ['business', 'marketing', 'entrepreneurship', 'finance', 'economics', 'commerce', 'management', 'startup'],
  'science':               ['science', 'stem', 'biology', 'chemistry', 'physics', 'math', 'research', 'biomedical', 'space', 'astronomy'],
  'arts':                  ['arts', 'art', 'music', 'design', 'creative', 'visual', 'humanities', 'writing', 'literature', 'film', 'theater', 'dance'],
  'policy':                ['policy', 'government', 'civic', 'law', 'political', 'international relations', 'diplomacy', 'public'],
  'engineering':           ['engineering', 'stem', 'tech', 'robotics', 'computer', 'mechanical', 'electrical', 'software', 'aerospace'],
  'medicine':              ['medicine', 'health', 'medical', 'biomedical', 'biology', 'research', 'nursing', 'pharmacy', 'clinical'],
  'law':                   ['law', 'policy', 'civic', 'human rights', 'legal', 'justice'],
  'environment':           ['environment', 'climate', 'sustainability', 'ecology', 'conservation', 'green', 'energy'],
  'social impact':         ['social impact', 'community', 'development', 'humanitarian', 'diversity', 'inclusion', 'nonprofit', 'volunteer'],
  'social-impact':         ['social impact', 'community', 'development', 'humanitarian', 'diversity', 'inclusion', 'nonprofit', 'volunteer'],
  'entrepreneurship':      ['entrepreneurship', 'business', 'startup', 'innovation', 'venture', 'tech'],
  'mathematics':           ['mathematics', 'math', 'stem', 'competition', 'olympiad', 'statistics', 'calculus'],
  'international':         ['international', 'global', 'exchange', 'cultural', 'diplomacy', 'abroad', 'foreign'],
  'international-relations': ['international', 'global', 'policy', 'diplomacy', 'relations', 'geopolitics'],
  'software-engineering':  ['software', 'engineering', 'coding', 'programming', 'tech', 'computer', 'development'],
  'ai':                    ['ai', 'machine learning', 'data science', 'artificial intelligence', 'tech', 'stem', 'computer'],
  'journalism':            ['journalism', 'writing', 'media', 'communication', 'press', 'arts', 'reporting'],
  'design':                ['design', 'arts', 'creative', 'visual', 'ux', 'graphics', 'architecture'],
  'psychology':            ['psychology', 'social science', 'neuroscience', 'behavior', 'mental health'],
  'economics':             ['economics', 'finance', 'business', 'social science', 'policy'],
  'history':               ['history', 'humanities', 'social science', 'cultural', 'archaeology'],
  'literature':            ['literature', 'writing', 'humanities', 'arts', 'language', 'linguistics'],
  'communication':         ['communication', 'journalism', 'writing', 'media', 'arts', 'public speaking'],
  'finance':               ['finance', 'economics', 'business', 'banking', 'investment', 'accounting'],
  'sports':                ['sports', 'athletics', 'physical', 'fitness', 'health'],
  'humanitarian':          ['humanitarian', 'social impact', 'development', 'community', 'relief', 'refugee'],
};

// Goal → opportunity characteristics that match
const GOAL_CATEGORIES = {
  'get-scholarship':       ['scholarship', 'fellowship', 'full scholarship', 'funded', 'bolsa'],
  'attend-top-university': ['summer program', 'summer school', 'prestigious', 'ivy', 'mit', 'stanford', 'yale', 'harvard', 'oxford', 'cambridge'],
  'get-internship':        ['internship', 'job', 'work', 'professional'],
  'do-research':           ['research', 'lab', 'research program', 'investigation'],
  'go-abroad':             ['exchange', 'international', 'abroad', 'study abroad', 'foreign'],
  'build-skills':          ['workshop', 'course', 'online course', 'mentorship', 'training', 'bootcamp'],
  'give-back':             ['volunteering', 'community', 'social impact', 'humanitarian', 'nonprofit'],
  'get-job':               ['internship', 'job', 'career', 'professional', 'work'],
  'network':               ['conference', 'summit', 'networking', 'mentorship', 'leadership'],
  'win-competition':       ['competition', 'olympiad', 'challenge', 'contest', 'award', 'prize'],
};

// Extract minimum GPA from eligibility text
function extractGpaReq(eligibility) {
  if (!eligibility) return null;
  const m = eligibility.match(/GPA\s+(?:of\s+)?(\d+\.?\d*)\+?/i)
         || eligibility.match(/(\d+\.?\d*)\s*\+?\s*GPA/i)
         || eligibility.match(/minimum\s+GPA[:\s]+(\d+\.?\d*)/i);
  return m ? parseFloat(m[1]) : null;
}

// Check if opp is eligible for user's education level
function checkEduEligibility(opp, userPath) {
  const levels = opp.education_levels || [];
  const userLevel = userPath === 'high-school' ? 'high school' : 'undergraduate';
  if (levels.length === 0) {
    // Fall back to audience field
    return !opp.audience || opp.audience === userPath || opp.audience === 'both';
  }
  return levels.some(l => norm(l).includes(userLevel.split(' ')[0]) || norm(l) === 'both');
}

// Count how many user interests align with opp topics
function countInterestHits(userInterests, oppTopics) {
  let hits = 0;
  for (const interest of userInterests) {
    const related = INTEREST_TOPICS[norm(interest)] || [norm(interest)];
    const matched = related.some(rt => oppTopics.some(ot => ot.includes(rt) || rt.includes(ot)));
    if (matched) hits++;
  }
  return hits;
}

// Count how many user goals align with opp
function countGoalHits(userGoals, oppTopics, oppCategory, oppFundingType) {
  let hits = 0;
  const oppCatNorm = norm(oppCategory);
  const oppFundNorm = norm(oppFundingType);
  for (const goal of (userGoals || [])) {
    const related = GOAL_CATEGORIES[goal] || [];
    const matched = related.some(r =>
      oppCatNorm.includes(r) || oppFundNorm.includes(r) ||
      oppTopics.some(t => t.includes(r) || r.includes(t))
    );
    if (matched) hits++;
  }
  return hits;
}

function computeMatch(opp, userPath, userInterests, likedCategories, userProfile) {
  let score = 0;
  const reasons = [];

  // Build normalized topic set from all opp text fields
  const rawTopics = [
    ...(opp.tags || []),
    ...(opp.focus_areas || []),
    opp.category || '',
    opp.opportunity_types ? (Array.isArray(opp.opportunity_types) ? opp.opportunity_types.join(' ') : opp.opportunity_types) : '',
    opp.programName || opp.title || '',
    opp.organizationName || opp.organization || '',
  ];
  const oppTopics = [...new Set(rawTopics.map(norm).filter(Boolean))];

  // 1. EDUCATION ELIGIBILITY (20 pts, or cap at 15 if wrong level)
  const eligible = checkEduEligibility(opp, userPath);
  if (eligible) {
    score += 20;
    reasons.push('eligible');
  } else {
    // Opp targets different path — still show but heavily deprioritize
    return { computedScore: Math.max(5, Math.floor(Math.random() * 12) + 5), matchReasons: ['low-match'] };
  }

  // 2. INTEREST ALIGNMENT (up to 40 pts)
  const interestHits = countInterestHits(userInterests, oppTopics);
  if (interestHits >= 3)      { score += 40; reasons.push('interests'); }
  else if (interestHits === 2) { score += 30; reasons.push('interests'); }
  else if (interestHits === 1) { score += 16; reasons.push('interests'); }
  // 0 hits → no interest bonus

  // 3. GOAL ALIGNMENT (up to 20 pts)
  const profile = userProfile || {};
  const userGoals = profile.goals || profile.careerInterests || [];
  const goalHits = countGoalHits(userGoals, oppTopics, opp.category, opp.fundingType);
  if (goalHits >= 2)      { score += 20; reasons.push('goals'); }
  else if (goalHits === 1) { score += 12; reasons.push('goals'); }

  // 4. GPA / ACADEMIC FIT (up to 10 pts)
  const userGpa = parseFloat(profile.gpa) || 0;
  const reqGpa = extractGpaReq(opp.eligibility);
  if (reqGpa) {
    if (userGpa >= reqGpa) { score += 10; reasons.push('gpa-fit'); }
    else if (userGpa > 0)  { score -= 8; } // below requirement
  } else {
    score += 5; // no GPA barrier — open access
  }

  // 5. BEHAVIORAL SIGNALS — liked similar category before (10 pts)
  if (likedCategories.has(opp.category)) {
    score += 10;
    reasons.push('liked');
  }

  // 6. DEADLINE URGENCY (reason flag only)
  if (opp.deadline) {
    const daysLeft = Math.ceil((new Date(opp.deadline) - new Date()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 14) reasons.push('urgent');
  }

  return {
    computedScore: Math.min(99, Math.max(8, score)),
    matchReasons: reasons,
  };
}

// POST /api/opportunities/submit — any logged-in user submits an opportunity for review
router.post('/submit', (req, res) => {
  try {
    const { userId, ...oppData } = req.body;
    const db = readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!db.pendingOpportunities) db.pendingOpportunities = [];

    const pending = {
      id: uuidv4(),
      ...oppData,
      submittedBy: userId,
      submittedByName: user.name,
      submittedByEmail: user.email,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    db.pendingOpportunities.push(pending);
    writeDatabase(db);
    res.json({ success: true, pending });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Must be before /:id
router.get('/match/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();

    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = user.userPath === 'high-school'
      ? db.highSchoolProfiles.slice().reverse().find(p => p.userId === userId)
      : db.collegeProfiles.slice().reverse().find(p => p.userId === userId);

    const userInterests = profile
      ? (profile.interests || profile.careerInterests || [])
      : [];

    const swipeLikes = (db.swipeEvents || []).filter(s => s.userId === userId && s.action === 'like');
    const likedCategories = new Set(
      swipeLikes.map(s => (db.opportunities.find(o => o.id === s.opportunityId) || {}).category).filter(Boolean)
    );

    const opportunities = db.opportunities.map(opp => {
      const { computedScore, matchReasons } = computeMatch(opp, user.userPath, userInterests, likedCategories, profile);
      return { ...opp, computedScore, matchReasons };
    });

    opportunities.sort((a, b) => b.computedScore - a.computedScore);

    res.json({ opportunities });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', (req, res) => {
  try {
    const { category, audience, type } = req.query;
    const db = readDatabase();
    let filtered = db.opportunities;

    if (category) filtered = filtered.filter(o => o.category === category);
    if (audience) filtered = filtered.filter(o => o.audience === audience);
    if (type) filtered = filtered.filter(o => o.opportunityType === type);

    res.json({ opportunities: filtered });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const db = readDatabase();
    const opportunities = db.opportunities.slice(0, parseInt(limit));
    res.json({ opportunities });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDatabase();
    const opportunity = db.opportunities.find(o => o.id === id);

    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
