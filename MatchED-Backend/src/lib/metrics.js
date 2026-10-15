// Impact metrics — the numbers MatchED reports to LALA, partners and the public page.
const { isLive } = require('./opportunities');
const { flagsFor } = require('./opportunities');
const { latestProfile } = require('./profile');

const PUBLIC_SCHOOL = ['publica_estadual', 'publica_municipal', 'publica_federal', 'particular_bolsista'];

function impactStats(db, { userFilter } = {}) {
  const users = db.users.filter(u => !userFilter || userFilter(u));
  const ids = new Set(users.map(u => u.id));
  const profiles = users.map(u => latestProfile(db, u)).filter(Boolean);
  const withSchool = profiles.filter(p => p.schoolType);
  const publicSchool = withSchool.filter(p => PUBLIC_SCHOOL.includes(p.schoolType));
  const quests = db.applicationQuests.filter(q => ids.has(q.userId) && q.status !== 'withdrawn');
  const results = db.resultTracking.filter(r => ids.has(r.userId));
  const accepted = results.filter(r => r.status === 'accepted');
  const submitted = new Set([
    ...quests.filter(q => ['submitted', 'accepted', 'rejected'].includes(q.status)).map(q => q.userId + q.opportunityId),
    ...results.filter(r => ['applied', 'waiting', 'accepted', 'rejected'].includes(r.status)).map(r => r.userId + r.opportunityId),
  ]);
  const live = db.opportunities.filter(isLive);
  const states = {};
  profiles.forEach(p => { if (p.state) states[p.state] = (states[p.state] || 0) + 1; });

  return {
    opportunitiesVerified: live.length,
    opportunitiesFunded: live.filter(o => flagsFor(o).funded).length,
    sourcesMonitored: (db.sources || []).filter(s => s.active !== false).length,
    students: users.length,
    activeStudents30d: users.filter(u => u.lastActiveDate && (Date.now() - new Date(u.lastActiveDate)) < 30 * 86400000).length,
    publicSchoolShare: withSchool.length ? Math.round((publicSchool.length / withSchool.length) * 100) : null,
    profilesWithSchoolType: withSchool.length,
    applicationsStarted: quests.length,
    applicationsSubmitted: submitted.size,
    acceptances: accepted.length,
    scholarshipBRL: accepted.reduce((s, r) => s + (Number(r.scholarshipAmountBRL) || 0), 0),
    eligibilityChecks: (db.checkEvents || []).length,
    states,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { impactStats, PUBLIC_SCHOOL };
