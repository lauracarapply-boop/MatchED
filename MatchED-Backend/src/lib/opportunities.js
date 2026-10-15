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


// Source lists often SHOUT ("NASA SEES INTERNSHIP"). Turn all-caps text into
// readable title case, keeping short acronyms (NASA, MIT, USA) as they are.
const ACRONYMS = new Set(['NASA','STEM','SEES','IEEE','UNESCO','OBMEP','OBM','OBF','OBQ','OBI','MOSTEC','YYGS','TASP','USAID','NYU','UCLA','UPENN','STEAM','SAT','ACT','TOEFL','IELTS','AP','IB','EUA','USA','UK','EU','UN','ONU','NSF','NIH','MIT','RSI','SSP','HSMC','SIMR','COSMOS','HHMI','AI','IA','CS','HS','LGBTQ','LGBTQ+','BR']);
const SMALL = new Set(['a','an','and','at','by','for','in','of','on','or','the','to','de','da','do','das','dos','e','em','para']);
function tidyCaps(text) {
  const s = String(text || '').trim();
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 6 || letters !== letters.toUpperCase()) return s;
  return s.split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w)) return w;
    const bare = w.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (ACRONYMS.has(bare) || (bare.length >= 2 && bare.length <= 3 && !SMALL.has(bare.toLowerCase()) && !/[AEIOU]{2}/.test(bare) && !/^(THE|AND|FOR|ALL|NEW|ONE|TWO|BY|AT|ON|IN|OF|TO|OR|IS|IT|AN|AS|BE|NO|UP|YOU|ARE|CAN|OUR|GET|PER|DUE|END|NOT|USE|OUT|WHO|HOW|WAY)$/.test(bare))) return w; // acronym
    const lower = w.toLowerCase();
    if (i > 0 && SMALL.has(bare.toLowerCase())) return lower;
    return lower.split('-').map(part => part.replace(/[a-zà-ÿ]/, c => c.toUpperCase())).join('-');
  }).join('');
}

// Long all-caps text (eligibility, cost, deadline notes) reads better as sentences.
function sentenceCaps(text) {
  const s = String(text || '').trim();
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length;
  if (letters.length < 6 || upper / letters.length < 0.7) return s;
  return s.toLowerCase()
    .replace(/(^|[.!?]\s+|\n\s*)([a-zà-ÿ])/g, (m, a, c) => a + c.toUpperCase())
    .replace(/[a-zà-ÿ]+/gi, w => ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w);
}

function cutAtWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).replace(/[\s,;:.-]+$/, '') + '…';
}

// The shape the website renders. Old records use programName/organizationName,
// imported ones use title/organization; both are normalized here.
function publicOpp(opp, { full = false } = {}) {
  const description = opp.description || opp.notes || '';
  return {
    id: opp.id,
    programName: tidyCaps(opp.programName || opp.title) || '—',
    organizationName: tidyCaps(opp.organizationName || opp.organization || ''),
    category: opp.category || (Array.isArray(opp.opportunity_types) ? opp.opportunity_types[0] : opp.opportunity_types) || 'scholarship',
    description: full ? description : cutAtWord(description, 900),
    description_pt: opp.description_pt || null,
    tags: (opp.tags && opp.tags.length ? opp.tags : opp.focus_areas) || [],
    deadline: opp.deadline || null,
    deadline_text: opp.deadline_text ? sentenceCaps(opp.deadline_text) : null,
    last_known_deadline: opp.last_known_deadline || null,
    eligibility: sentenceCaps(opp.eligibility || ''),
    eligibility_pt: opp.eligibility_pt || null,
    requirements: (Array.isArray(opp.requirements) ? opp.requirements : (opp.requirements ? [String(opp.requirements)] : [])).map(sentenceCaps),
    location: opp.location ? sentenceCaps(opp.location) : null,
    modality: opp.modality || null,
    duration: opp.duration ? sentenceCaps(opp.duration) : null,
    fundingType: opp.fundingType ? sentenceCaps(opp.fundingType) : null,
    fundingAmount: opp.fundingAmount ? sentenceCaps(opp.fundingAmount) : null,
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

module.exports = { tidyCaps, sentenceCaps, publicOpp, flagsFor, isLive, firstUrl };
