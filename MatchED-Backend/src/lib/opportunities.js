// Helpers shared by the opportunity routes.
const { detectFlags } = require('./eligibility');

const flagCache = new Map();

function flagsFor(opp) {
  const key = `${opp.id}|${opp.updated_at || opp.updatedAt || opp.createdAt || ''}`;
  if (!flagCache.has(key)) flagCache.set(key, detectFlags(opp));
  return flagCache.get(key);
}

function firstUrl(opp) {
  const u = opp.websiteUrl || opp.url || opp.official_url || opp.monitored_url || '';
  return /^https?:\/\//i.test(u) ? u : '';
}

// The shape the website renders. Old records use programName/organizationName,
// imported ones use title/organization; both are normalized here.
function publicOpp(opp, { full = false } = {}) {
  const description = opp.description || opp.notes || '';
  return {
    id: opp.id,
    programName: opp.programName || opp.title || '—',
    organizationName: opp.organizationName || opp.organization || '',
    category: opp.category || (Array.isArray(opp.opportunity_types) ? opp.opportunity_types[0] : opp.opportunity_types) || 'scholarship',
    description: full ? description : description.slice(0, 600),
    description_pt: opp.description_pt || null,
    tags: (opp.tags && opp.tags.length ? opp.tags : opp.focus_areas) || [],
    deadline: opp.deadline || null,
    deadline_text: opp.deadline_text || null,
    last_known_deadline: opp.last_known_deadline || null,
    eligibility: opp.eligibility || '',
    eligibility_pt: opp.eligibility_pt || null,
    requirements: Array.isArray(opp.requirements) ? opp.requirements : (opp.requirements ? [String(opp.requirements)] : []),
    location: opp.location || null,
    modality: opp.modality || null,
    duration: opp.duration || null,
    fundingType: opp.fundingType || null,
    fundingAmount: opp.fundingAmount || null,
    competitionLevel: opp.competitionLevel || null,
    audience: opp.audience || 'both',
    education_levels: opp.education_levels || [],
    opportunity_types: opp.opportunity_types || [],
    websiteUrl: firstUrl(opp),
    trust_tier: opp.trust_tier || null,
    flags: flagsFor(opp),
    updatedAt: opp.updated_at || opp.updatedAt || opp.createdAt || null,
  };
}

function isLive(opp) {
  return opp && opp.active !== false && opp.status !== 'archived';
}

module.exports = { publicOpp, flagsFor, isLive, firstUrl };
