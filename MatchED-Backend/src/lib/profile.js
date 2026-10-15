// Student profile: what matching needs to know about a user.
const { canonicalInterest } = require('./eligibility');

const GRADE_LEVELS = ['ef8', 'ef9', 'em1', 'em2', 'em3', 'tecnico', 'concluido'];
const SCHOOL_TYPES = ['publica_estadual', 'publica_municipal', 'publica_federal', 'particular_bolsista', 'particular'];
const ENGLISH_LEVELS = ['none', 'basic', 'intermediate', 'advanced'];
const GOALS = ['get-scholarship', 'study-abroad', 'summer-program', 'win-competition', 'do-research', 'get-internship'];
const BR_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Old onboarding stored grade as 1..4 (US-style). Map to Brazilian levels.
const LEGACY_GRADES = { 1: 'ef9', 2: 'em1', 3: 'em2', 4: 'em3' };

function latestProfile(db, user) {
  if (!user) return null;
  const list = user.userPath === 'college' ? db.collegeProfiles : db.highSchoolProfiles;
  for (let i = (list || []).length - 1; i >= 0; i--) if (list[i].userId === user.id) return list[i];
  return null;
}

function pick(value, allowed) { return allowed.includes(value) ? value : null; }

// Keep only known fields with valid values, so a client cannot write arbitrary data.
function sanitizeProfileInput(body = {}) {
  const out = {};
  if ('grade' in body || 'gradeLevel' in body) {
    const g = body.gradeLevel || body.grade;
    out.gradeLevel = pick(g, GRADE_LEVELS) || LEGACY_GRADES[g] || null;
  }
  if ('school' in body) out.school = String(body.school || '').slice(0, 120);
  if ('schoolType' in body) out.schoolType = pick(body.schoolType, SCHOOL_TYPES);
  if ('state' in body) out.state = pick(String(body.state || '').toUpperCase(), BR_STATES);
  if ('city' in body) out.city = String(body.city || '').slice(0, 80);
  if ('englishLevel' in body) out.englishLevel = pick(body.englishLevel, ENGLISH_LEVELS);
  if ('needsFunding' in body) out.needsFunding = Boolean(body.needsFunding);
  if ('birthYear' in body) {
    const y = Number(body.birthYear);
    out.birthYear = y >= 1980 && y <= new Date().getFullYear() - 8 ? y : null;
  }
  if ('gpa' in body) out.gpa = String(body.gpa || '').slice(0, 20);
  if ('interests' in body || 'careerInterests' in body) {
    const list = Array.isArray(body.interests) ? body.interests : (Array.isArray(body.careerInterests) ? body.careerInterests : []);
    out.interests = [...new Set(list.map(canonicalInterest).filter(Boolean))];
  }
  if ('goals' in body) out.goals = (Array.isArray(body.goals) ? body.goals : []).filter(g => GOALS.includes(g));
  if ('university' in body) out.university = String(body.university || '').slice(0, 120);
  if ('major' in body) out.major = String(body.major || '').slice(0, 120);
  if ('graduationYear' in body) out.graduationYear = String(body.graduationYear || '').slice(0, 6);
  return out;
}

// Everything matching needs, in one object.
function matchingProfile(db, user) {
  const p = latestProfile(db, user) || {};
  return {
    userPath: user && user.userPath,
    ...p,
    interests: (p.interests || p.careerInterests || []).map(canonicalInterest).filter(Boolean),
    gradeLevel: p.gradeLevel || LEGACY_GRADES[p.grade] || null,
  };
}

module.exports = { latestProfile, sanitizeProfileInput, matchingProfile, GRADE_LEVELS, SCHOOL_TYPES, ENGLISH_LEVELS, GOALS, BR_STATES };
