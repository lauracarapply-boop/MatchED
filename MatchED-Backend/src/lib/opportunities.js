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

// The deadline column sometimes holds reviewer notes or stray numbers
// ("Validate legitimacy…", "500-5000"). Students should never see those.
function cleanDeadlineText(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || /^(n\/?a|-|—|tbd|\?)$/i.test(t)) return null;
  if (/^[\d.,\s–-]+$/.test(t)) return null; // only numbers: not a date
  if (/\b(validate|verify|monitor|fetch|blocked|legacy|relevance|publication|URL|homepage|not a student|branding|affiliation|points to)\b/i.test(t)) return null;
  return sentenceCaps(t);
}

const MONTHS = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

// Most programs repeat every year on about the same date. When we only know
// "15 de março" or last year's date, estimate the next one (clearly labelled
// as an estimate on the site, never used for reminder e-mails).
function estimateDeadline(opp, now = new Date()) {
  if (opp.deadline) return null;
  let day = null, month = null;
  const t = String(opp.deadline_text || '').toLowerCase().trim();
  let m = t.match(/^(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+\d{4})?(?:[,\s].*)?$/) || t.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,?\s+\d{4})?$/);
  if (m) {
    if (/^\d/.test(m[1])) { day = +m[1]; month = MONTHS[m[2]]; } else { month = MONTHS[m[1]]; day = +m[2]; }
  } else if (opp.last_known_deadline) {
    const d = new Date(opp.last_known_deadline);
    if (!isNaN(d)) { day = d.getUTCDate(); month = d.getUTCMonth() + 1; }
  }
  if (!day || !month || day > 31) return null;
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  for (let y = today.getUTCFullYear(); y <= today.getUTCFullYear() + 1; y++) {
    const c = new Date(Date.UTC(y, month - 1, day));
    if (c >= today) return c.toISOString().slice(0, 10);
  }
  return null;
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
    deadline_text: cleanDeadlineText(opp.deadline_text),
    deadline_estimate: estimateDeadline(opp),
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

module.exports = { tidyCaps, sentenceCaps, cleanDeadlineText, estimateDeadline, publicOpp, flagsFor, isLive, firstUrl };
