// Normalization layer for data imported from Google Sheets

const FOCUS_AREA_MAP = {
  'stem': 'STEM', 'ciência': 'STEM', 'ciencias': 'STEM', 'science': 'STEM',
  'computer_science': 'computer_science', 'computação': 'computer_science', 'computer science': 'computer_science', 'cs': 'computer_science',
  'engineering': 'engineering', 'engenharia': 'engineering',
  'mathematics': 'mathematics', 'math': 'mathematics', 'matemática': 'mathematics',
  'medicine': 'medicine', 'medicina': 'medicine', 'health': 'medicine', 'saúde': 'medicine',
  'research': 'research', 'pesquisa': 'research',
  'business': 'business', 'negócios': 'business', 'negocios': 'business',
  'entrepreneurship': 'entrepreneurship', 'empreendedorismo': 'entrepreneurship', 'innovation': 'entrepreneurship', 'inovação': 'entrepreneurship',
  'politics': 'politics', 'política': 'politics', 'political': 'politics',
  'public_policy': 'public_policy', 'public policy': 'public_policy', 'policy': 'public_policy', 'políticas': 'public_policy',
  'law': 'law', 'direito': 'law', 'legal': 'law',
  'humanities': 'humanities', 'humanidades': 'humanities',
  'social_sciences': 'social_sciences', 'social sciences': 'social_sciences', 'social': 'social_sciences', 'ciências sociais': 'social_sciences',
  'arts': 'arts', 'artes': 'arts', 'art': 'arts',
  'design': 'design',
  'writing': 'writing', 'escrita': 'writing', 'redação': 'writing',
  'journalism': 'journalism', 'jornalismo': 'journalism', 'media': 'journalism', 'communications': 'journalism',
  'environment': 'environment', 'meio ambiente': 'environment', 'environmental': 'environment',
  'climate': 'climate', 'clima': 'climate', 'sustainability': 'climate', 'sustentabilidade': 'climate',
  'leadership': 'leadership', 'liderança': 'leadership',
  'civic_engagement': 'civic_engagement', 'civic': 'civic_engagement', 'cívico': 'civic_engagement',
  'international_relations': 'international_relations', 'international relations': 'international_relations', 'international': 'international_relations',
  'technology': 'technology', 'tecnologia': 'technology', 'tech': 'technology',
  'AI': 'AI', 'artificial intelligence': 'AI', 'inteligência artificial': 'AI',
  'data_science': 'data_science', 'data science': 'data_science', 'data': 'data_science',
  'finance': 'business', 'economics': 'business', 'economia': 'business',
  'trading': 'business', 'strategy': 'business',
  'film': 'arts', 'theater': 'arts', 'performance': 'arts', 'music': 'arts',
  'global_affairs': 'international_relations', 'global affairs': 'international_relations',
  'administration': 'public_policy',
  'career': 'leadership', 'career_program': 'leadership',
};

const EDUCATION_MAP = {
  'middle_school': 'middle_school', 'middle school': 'middle_school', 'ensino fundamental': 'middle_school',
  'high_school': 'high_school', 'high school': 'high_school', 'ensino médio': 'high_school', 'ensino medio': 'high_school',
  'undergraduate': 'undergraduate', 'faculdade': 'undergraduate', 'graduação': 'undergraduate', 'college': 'undergraduate',
  'graduate': 'graduate', 'pós-graduação': 'graduate', 'masters': 'graduate', 'phd': 'graduate', 'postdoc': 'graduate',
  'gap_year': 'gap_year', 'gap year': 'gap_year',
  'young_professional': 'young_professional', 'young professional': 'young_professional', 'professional': 'young_professional', 'early_career': 'young_professional',
  'any': 'any', 'all': 'any', 'todos': 'any',
};

const OPP_TYPE_MAP = {
  'scholarship': 'scholarship', 'bolsa': 'scholarship', 'bolsa de estudo': 'scholarship',
  'summer_program': 'summer_program', 'summer program': 'summer_program', 'programa de verão': 'summer_program',
  'competition': 'competition', 'competição': 'competition', 'concurso': 'competition',
  'internship': 'internship', 'estágio': 'internship', 'estagio': 'internship',
  'fellowship': 'fellowship',
  'exchange': 'exchange', 'intercâmbio': 'exchange', 'intercambio': 'exchange', 'study_abroad': 'exchange',
  'conference': 'conference', 'conferência': 'conference',
  'research_program': 'research_program', 'research program': 'research_program', 'research': 'research_program',
  'mentorship': 'mentorship', 'mentoria': 'mentorship',
  'volunteer': 'volunteer', 'voluntário': 'volunteer',
  'grant': 'grant',
  'career_program': 'career_program', 'career program': 'career_program',
  'accelerator': 'accelerator', 'aceleradora': 'accelerator',
  'award': 'award', 'prêmio': 'award', 'premio': 'award',
  'workshop': 'workshop',
  'online_course': 'online_course', 'online course': 'online_course', 'curso online': 'online_course',
  'exam': 'career_program',
};

function normalizeList(raw, map) {
  if (!raw) return [];
  return raw.split(/[,;\/]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .map(s => map[s] || map[s.replace(/_/g, ' ')] || s)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function normalizeFocusAreas(raw) {
  return normalizeList(raw, FOCUS_AREA_MAP);
}

function normalizeEducationLevels(raw) {
  return normalizeList(raw, EDUCATION_MAP);
}

function normalizeOpportunityTypes(raw) {
  return normalizeList(raw, OPP_TYPE_MAP);
}

function normalizeBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toUpperCase() === 'TRUE' || val === '1' || val === 'yes';
  return Boolean(val);
}

function normalizeNumber(val, fallback = null) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function normalizeSourceScope(raw) {
  if (!raw) return null;
  const map = {
    'recurring_source': 'recurring_source',
    'category_source': 'category_source',
    'newsletter_source': 'newsletter_source',
    'specific_opportunity': 'specific_opportunity',
    'needs_review': 'needs_review',
  };
  return map[raw.trim().toLowerCase()] || 'needs_review';
}

function normalizeReviewStatus(raw) {
  if (!raw) return null;
  const map = {
    'ready': 'ready',
    'needs_review': 'needs_review',
    'needs_url_validation': 'needs_url_validation',
    'duplicate': 'duplicate',
    'inactive_or_legacy': 'inactive_or_legacy',
    'blocked': 'blocked',
  };
  return map[raw.trim().toLowerCase()] || null;
}

function normalizeTrustTier(raw) {
  if (!raw) return 'observation';
  const map = { 'priority': 'priority', 'approved': 'approved', 'observation': 'observation', 'blocked': 'blocked' };
  return map[raw.trim().toLowerCase()] || 'observation';
}

function normalizeCheckFrequency(raw) {
  if (!raw) return 'weekly';
  const map = {
    'daily': 'daily', 'every_3_days': 'every_3_days', 'weekly': 'weekly',
    'monthly': 'monthly', 'manual': 'manual', 'never': 'never',
  };
  return map[raw.trim().toLowerCase()] || 'weekly';
}

function normalizeRow(row) {
  return {
    name: (row.name || '').trim(),
    base_url: (row.base_url || '').trim(),
    monitored_url: (row.monitored_url || '').trim(),
    source_type: (row.source_type || 'official').trim().toLowerCase(),
    focus_areas: normalizeFocusAreas(row.focus_areas),
    education_levels: normalizeEducationLevels(row.education_levels),
    opportunity_types: normalizeOpportunityTypes(row.opportunity_types),
    trust_tier: normalizeTrustTier(row.trust_tier),
    reliability_score: normalizeNumber(row.reliability_score, 70),
    check_frequency: normalizeCheckFrequency(row.check_frequency),
    extraction_method: (row.extraction_method || 'html').trim().toLowerCase(),
    active: normalizeBoolean(row.active !== undefined ? row.active : true),
    source_scope: normalizeSourceScope(row.source_scope),
    review_status: normalizeReviewStatus(row.review_status),
    notes: (row.notes || '').trim(),
  };
}

module.exports = {
  normalizeRow,
  normalizeFocusAreas,
  normalizeEducationLevels,
  normalizeOpportunityTypes,
  normalizeBoolean,
  normalizeNumber,
};
