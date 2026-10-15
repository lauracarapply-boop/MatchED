// Matching and eligibility engine.
//
// Two jobs:
// 1) Read an opportunity's text and flag what matters for a Brazilian student
//    (requires US citizenship? funded? has a fee? needs English? age range?).
// 2) Score an opportunity for a student profile and explain why, in reason codes
//    the website translates ("Combina com seus interesses", "Exige cidadania americana"...).

// Canonical interest keys. The website stores these keys (never translated labels).
const INTERESTS = [
  'leadership', 'research', 'technology', 'business', 'science', 'arts', 'policy', 'engineering',
  'medicine', 'law', 'environment', 'social-impact', 'entrepreneurship', 'mathematics', 'international',
];

// Older accounts stored translated labels (e.g. "liderança"). Map them back.
const LEGACY_INTEREST_LABELS = {
  'liderança': 'leadership', 'liderazgo': 'leadership',
  'pesquisa': 'research', 'investigación': 'research', 'recherche': 'research',
  'tecnologia': 'technology', 'tecnología': 'technology', 'technologie': 'technology',
  'negócios': 'business', 'negocios': 'business',
  'ciências': 'science', 'ciencias': 'science', 'sciences': 'science',
  'artes': 'arts',
  'políticas-públicas': 'policy', 'politiques-publiques': 'policy',
  'engenharia': 'engineering', 'ingeniería': 'engineering', 'ingénierie': 'engineering',
  'medicina': 'medicine', 'médecine': 'medicine',
  'direito': 'law', 'derecho': 'law', 'droit': 'law',
  'meio-ambiente': 'environment', 'medio-ambiente': 'environment', 'environnement': 'environment',
  'impacto-social': 'social-impact', 'impact-social': 'social-impact',
  'empreendedorismo': 'entrepreneurship', 'emprendimiento': 'entrepreneurship', 'entrepreneuriat': 'entrepreneurship',
  'matemática': 'mathematics', 'matemáticas': 'mathematics', 'mathématiques': 'mathematics',
  'internacional': 'international',
};

function canonicalInterest(v) {
  const key = String(v || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (INTERESTS.includes(key)) return key;
  return LEGACY_INTEREST_LABELS[key] || null;
}

// Words to look for in an opportunity's topics for each interest.
const INTEREST_TOPICS = {
  leadership: ['leadership', 'liderança', 'civic', 'community', 'government', 'youth leader', 'changemaker'],
  research: ['research', 'pesquisa', 'lab', 'laboratory', 'science', 'academic', 'iniciação científica'],
  technology: ['technology', 'tech', 'coding', 'software', 'programming', 'computer', 'ai', 'data', 'robotics', 'tecnologia', 'programação', 'computer_science', 'data_science'],
  business: ['business', 'finance', 'economics', 'marketing', 'management', 'negócios', 'consulting', 'trading', 'strategy'],
  science: ['science', 'stem', 'biology', 'chemistry', 'physics', 'astronomy', 'space', 'ciência', 'ciências', 'olimpíada', 'olympiad'],
  arts: ['arts', 'art', 'music', 'design', 'film', 'theater', 'writing', 'literature', 'creative', 'artes', 'redação'],
  policy: ['policy', 'public_policy', 'politics', 'government', 'diplomacy', 'civic', 'international_relations', 'políticas'],
  engineering: ['engineering', 'engenharia', 'robotics', 'mechanical', 'electrical', 'aerospace', 'stem'],
  medicine: ['medicine', 'health', 'medical', 'biomedical', 'clinical', 'saúde', 'medicina', 'neuroscience'],
  law: ['law', 'legal', 'justice', 'human rights', 'direito', 'moot'],
  environment: ['environment', 'climate', 'sustainability', 'ecology', 'conservation', 'energy', 'clima', 'meio ambiente', 'sustentabilidade'],
  'social-impact': ['social impact', 'social_sciences', 'community', 'humanitarian', 'nonprofit', 'volunteer', 'impacto social', 'development'],
  entrepreneurship: ['entrepreneurship', 'startup', 'innovation', 'venture', 'empreendedorismo', 'pitch', 'accelerator'],
  mathematics: ['mathematics', 'math', 'matemática', 'statistics', 'olympiad', 'olimpíada'],
  international: ['international', 'global', 'exchange', 'abroad', 'intercâmbio', 'international_relations', 'model un', 'mun'],
};

const GOAL_TOPICS = {
  'get-scholarship': ['scholarship', 'bolsa', 'fellowship', 'funded', 'grant'],
  'study-abroad': ['exchange', 'abroad', 'international', 'intercâmbio', 'summer-program', 'summer_program', 'university'],
  'summer-program': ['summer-program', 'summer_program', 'summer school', 'programa de verão'],
  'win-competition': ['competition', 'olympiad', 'olimpíada', 'challenge', 'contest', 'award', 'prize'],
  'do-research': ['research', 'research_program', 'lab', 'pesquisa'],
  'get-internship': ['internship', 'estágio', 'job', 'career'],
};

function norm(s) { return String(s || '').toLowerCase(); }

function oppText(opp) {
  const extra = opp.sheet_extra ? Object.values(opp.sheet_extra).join(' ') : '';
  return [opp.title, opp.programName, opp.description, opp.eligibility, opp.notes, opp.requirements,
    opp.fundingAmount, opp.deadline_text, opp.location, extra].filter(Boolean).join(' \n ');
}

const RX = {
  usCitizen: /\b(u\.?s\.?|united states|american)\s+(citizen|citizens|citizenship|national|nationals)\b|\bpermanent residents?\b|\bgreen card\b|\bdaca\b|cidad[aã]os? (norte-)?american|\bmust be (a )?u\.?s\.?\b/i,
  international: /international students|all nationalities|any nationality|open to (students|applicants) (from )?(all|any|around the world|worldwide)|worldwide|students from (all|any) countr|global applicants|non-u\.?s\.? citizens|estudantes (internacionais|de todo o mundo)/i,
  brazil: /\bbrasil\b|\bbrazil(ian)?\b|brasileir|\benem\b|escola p[uú]blica|rede p[uú]blica|\bsisu\b|\bprouni\b|\bobmep\b/i,
  publicSchool: /escola p[uú]blica|rede p[uú]blica|low[- ]income|baixa renda|first[- ]generation|primeira gera[cç][aã]o|need[- ]based|vulnerabilidade|bolsistas?|underrepresented|under-resourced|carente/i,
  funded: /fully funded|full(y)? (ride|scholarship|tuition)|bolsa integral|totalmente financiad|all expenses|stipend|financial aid|aux[ií]lio|ajuda financeira|\bfree\b|gratuit|sem custo|no cost|funded\/paid: true|full ride: sim/i,
  fee: /application fee: yes|taxa de inscri[cç][aã]o|registration fee|program fee|participation fee|tuition (is|of)|custo do programa|program cost/i,
  usWorkAuth: /authori[sz]ed to work in the (u\.?s|united states)|work authori[sz]ation|requires? (visa )?sponsorship|e-verify/i,
  noFee: /application fee: no|sem taxa|no (application )?fee|inscri[cç][aã]o gratuita/i,
  english: /toefl|ielts|duolingo english|english proficiency|profici[eê]ncia em ingl[eê]s|fluent in english|fluência em inglês/i,
  ageRange: /(?:aged?|idade|ages|entre)\s*(\d{2})\s*(?:-|–|to|a|e|até)\s*(\d{2})(?:\s*(?:anos|years))?|(\d{2})\s*(?:-|–|a)\s*(\d{2})\s*anos/i,
  portuguese: /\b(para|estudantes|inscri[cç][oõ]es|bolsa|você|são|não|ensino)\b/i,
};

// Which curated list a record came from (kept by the importer in sheet_extra).
function originOf(opp) {
  const e = opp.sheet_extra || {};
  return [e.origin_or_modality, e.apply_link, e.category_key].filter(Boolean).join(' ');
}

function detectFlags(opp) {
  const text = oppText(opp);
  const origin = originOf(opp);
  const flags = {};
  const international = RX.international.test(text);
  // US job/internship lists and US scholarship spreadsheets are, in practice,
  // only for people who can work/study in the US as residents.
  const usList = /Internship & Job List|internship_entry_level_job/i.test(origin);
  const usScholarshipList = /FREE Scholarship Spreadsheet/i.test(origin);
  flags.requiresUSWorkAuth = !international && (usList || RX.usWorkAuth.test(text));
  flags.requiresUSCitizenship = !international && (RX.usCitizen.test(text) || usScholarshipList || flags.requiresUSWorkAuth);
  flags.checkNationality = !international && !flags.requiresUSCitizenship && /free highschool programs/i.test(origin);
  flags.openInternational = international;
  flags.brazilFocused = RX.brazil.test(text);
  flags.publicSchoolFriendly = RX.publicSchool.test(text);
  flags.funded = RX.funded.test(text) || ['full-scholarship', 'partial-scholarship', 'free', 'paid'].includes(opp.fundingType);
  flags.hasFee = RX.fee.test(text) && !RX.noFee.test(text);
  flags.englishRequired = RX.english.test(text);
  flags.portugueseContent = RX.portuguese.test([opp.description, opp.eligibility].join(' '));
  const m = text.match(RX.ageRange);
  if (m) {
    const a = Number(m[1] || m[3]); const b = Number(m[2] || m[4]);
    if (a >= 8 && b <= 40 && a < b) flags.ageRange = [a, b];
  }
  // Curated records (seed-data/brazil-opportunities.json) carry flags a person
  // checked against the official page; those win over the text guesses.
  if (opp.flags && typeof opp.flags === 'object') Object.assign(flags, opp.flags);
  return flags;
}

function deadlineInfo(opp, now = new Date()) {
  if (!opp.deadline) return { status: 'open', daysLeft: null };
  const days = Math.ceil((new Date(opp.deadline) - now) / 86400000);
  if (Number.isNaN(days)) return { status: 'open', daysLeft: null };
  if (days < 0) return { status: 'closed', daysLeft: days };
  return { status: 'upcoming', daysLeft: days };
}

function levelsFor(profile) {
  if (!profile) return [];
  if (profile.userPath === 'college') return ['undergraduate', 'graduate', 'gap_year', 'young_professional'];
  const g = profile.gradeLevel || '';
  if (g === 'ef8' || g === 'ef9') return ['middle_school', 'high_school'];
  if (g === 'concluido') return ['high_school', 'gap_year', 'undergraduate'];
  return ['high_school'];
}

function educationFits(opp, profile) {
  const levels = (opp.education_levels || []).map(norm);
  if (!levels.length) {
    if (!opp.audience || opp.audience === 'both' || !profile.userPath) return true;
    return opp.audience === profile.userPath;
  }
  const mine = levelsFor(profile);
  return levels.some(l => mine.includes(l) || l === 'any');
}

function topicsOf(opp) {
  return [...(opp.tags || []), ...(opp.focus_areas || []), ...(opp.opportunity_types || []), opp.category, opp.title, opp.programName]
    .filter(Boolean).map(t => norm(t).replace(/_/g, ' '));
}

function currentAge(profile, now = new Date()) {
  const y = Number(profile && profile.birthYear);
  return y > 1950 ? now.getFullYear() - y : null;
}

/**
 * Score an opportunity for a student.
 * Returns { computedScore, matchReasons[], warnings[], eligible, flags, deadline }.
 */
function computeMatch(opp, profile = {}, ctx = {}) {
  const flags = opp.flags || detectFlags(opp);
  const reasons = [];
  const warnings = [];
  const dl = deadlineInfo(opp);
  let eligible = true;

  if (!educationFits(opp, profile)) { eligible = false; warnings.push('level'); }
  if (flags.requiresUSCitizenship) { eligible = false; warnings.push(flags.requiresUSWorkAuth ? 'us-work' : 'us-citizenship'); }
  if (flags.checkNationality) warnings.push('check-nationality');
  const age = currentAge(profile);
  if (age && flags.ageRange && (age < flags.ageRange[0] || age > flags.ageRange[1])) { eligible = false; warnings.push('age'); }

  let score = eligible ? 30 : 5;
  if (eligible) reasons.push('eligible');

  const topics = topicsOf(opp);
  const interests = (profile.interests || []).map(canonicalInterest).filter(Boolean);
  let interestHits = 0;
  for (const i of interests) {
    const words = INTEREST_TOPICS[i] || [i];
    if (words.some(w => topics.some(t => t.includes(w)))) interestHits++;
  }
  if (interestHits) { score += Math.min(30, 12 + interestHits * 8); reasons.push('interests'); }

  const goals = profile.goals || [];
  let goalHits = 0;
  for (const g of goals) {
    const words = GOAL_TOPICS[g] || [];
    if (words.some(w => topics.some(t => t.includes(w)))) goalHits++;
  }
  if (goalHits) { score += Math.min(12, goalHits * 6); reasons.push('goals'); }

  if (flags.funded) { score += profile.needsFunding ? 10 : 4; reasons.push('funded'); }
  if (flags.hasFee) { warnings.push('fee'); if (profile.needsFunding) score -= 10; }

  const publicSchool = ['publica_estadual', 'publica_municipal', 'publica_federal', 'particular_bolsista'].includes(profile.schoolType);
  if (flags.publicSchoolFriendly && publicSchool) { score += 8; reasons.push('public-school'); }
  if (flags.brazilFocused) { score += 5; reasons.push('brazil'); }
  if (flags.englishRequired && ['none', 'basic'].includes(profile.englishLevel)) { score -= 8; warnings.push('english'); }

  if (opp.trust_tier === 'priority') score += 3;
  if (dl.status === 'upcoming' && dl.daysLeft <= 21) reasons.push('urgent');
  if (dl.status === 'closed') { warnings.push('closed'); score -= 15; }

  if (ctx.likedCategories && ctx.likedCategories.has(opp.category)) { score += 6; reasons.push('liked'); }

  const max = eligible ? 99 : 30;
  return {
    computedScore: Math.max(3, Math.min(max, Math.round(score))),
    matchReasons: reasons,
    warnings,
    eligible,
    flags,
    deadlineStatus: dl.status,
    daysLeft: dl.daysLeft,
  };
}

module.exports = { INTERESTS, canonicalInterest, detectFlags, computeMatch, deadlineInfo, educationFits };
