import { Prisma, OpportunityType, FundingType, EducationLevel, OpportunityStatus, DifficultyLevel, CompetitivenessLevel } from '@prisma/client';
import slugify from 'slugify';
import { ExtractionResult } from '@/schemas/extraction';
import { parseDate } from './dateParser';
import { normalizeCountry } from './countryNormalizer';

function toOpportunityType(raw: string): OpportunityType {
  const map: Record<string, OpportunityType> = {
    scholarship: OpportunityType.SCHOLARSHIP,
    fellowship: OpportunityType.FELLOWSHIP,
    internship: OpportunityType.INTERNSHIP,
    job: OpportunityType.JOB,
    volunteering: OpportunityType.VOLUNTEERING,
    volunteer: OpportunityType.VOLUNTEERING,
    grant: OpportunityType.GRANT,
    competition: OpportunityType.COMPETITION,
    conference: OpportunityType.CONFERENCE,
    exchange_program: OpportunityType.EXCHANGE_PROGRAM,
    exchange: OpportunityType.EXCHANGE_PROGRAM,
    summer_program: OpportunityType.SUMMER_PROGRAM,
    summer: OpportunityType.SUMMER_PROGRAM,
    online_course: OpportunityType.ONLINE_COURSE,
    course: OpportunityType.ONLINE_COURSE,
    workshop: OpportunityType.WORKSHOP,
    research: OpportunityType.RESEARCH,
    leadership_program: OpportunityType.LEADERSHIP_PROGRAM,
    leadership: OpportunityType.LEADERSHIP_PROGRAM,
    immigration: OpportunityType.IMMIGRATION,
  };
  return map[raw.toLowerCase().replace(/\s+/g, '_')] ?? OpportunityType.OTHER;
}

function toFundingType(raw: string): FundingType {
  const map: Record<string, FundingType> = {
    fully_funded: FundingType.FULLY_FUNDED,
    'fully funded': FundingType.FULLY_FUNDED,
    fully: FundingType.FULLY_FUNDED,
    partially_funded: FundingType.PARTIALLY_FUNDED,
    'partially funded': FundingType.PARTIALLY_FUNDED,
    partial: FundingType.PARTIALLY_FUNDED,
    paid: FundingType.PAID,
    unpaid: FundingType.UNPAID,
    stipend: FundingType.STIPEND,
    tuition_only: FundingType.TUITION_ONLY,
    'tuition only': FundingType.TUITION_ONLY,
    travel_only: FundingType.TRAVEL_ONLY,
    'travel only': FundingType.TRAVEL_ONLY,
    self_funded: FundingType.SELF_FUNDED,
    'self funded': FundingType.SELF_FUNDED,
    self: FundingType.SELF_FUNDED,
    unknown: FundingType.UNKNOWN,
  };
  return map[raw.toLowerCase().replace(/\s+/g, '_')] ?? FundingType.UNKNOWN;
}

function toEducationLevel(raw: string): EducationLevel | null {
  const map: Record<string, EducationLevel> = {
    high_school: EducationLevel.HIGH_SCHOOL,
    'high school': EducationLevel.HIGH_SCHOOL,
    highschool: EducationLevel.HIGH_SCHOOL,
    secondary: EducationLevel.HIGH_SCHOOL,
    gap_year: EducationLevel.GAP_YEAR,
    'gap year': EducationLevel.GAP_YEAR,
    undergraduate: EducationLevel.UNDERGRADUATE,
    bachelor: EducationLevel.UNDERGRADUATE,
    bachelors: EducationLevel.UNDERGRADUATE,
    "bachelor's": EducationLevel.UNDERGRADUATE,
    undergraduate_student: EducationLevel.UNDERGRADUATE,
    masters: EducationLevel.MASTERS,
    master: EducationLevel.MASTERS,
    "master's": EducationLevel.MASTERS,
    msc: EducationLevel.MASTERS,
    ma: EducationLevel.MASTERS,
    mba: EducationLevel.MASTERS,
    phd: EducationLevel.PHD,
    doctorate: EducationLevel.PHD,
    doctoral: EducationLevel.PHD,
    postdoc: EducationLevel.POSTDOC,
    'post-doctoral': EducationLevel.POSTDOC,
    'post-doc': EducationLevel.POSTDOC,
    early_career: EducationLevel.EARLY_CAREER,
    'early career': EducationLevel.EARLY_CAREER,
    professional: EducationLevel.PROFESSIONAL,
    any: EducationLevel.ANY,
    all: EducationLevel.ANY,
    open: EducationLevel.ANY,
  };
  return map[raw.toLowerCase().trim()] ?? null;
}

function toDifficultyLevel(raw: string): DifficultyLevel {
  const map: Record<string, DifficultyLevel> = {
    beginner: DifficultyLevel.BEGINNER,
    easy: DifficultyLevel.BEGINNER,
    intermediate: DifficultyLevel.INTERMEDIATE,
    medium: DifficultyLevel.INTERMEDIATE,
    advanced: DifficultyLevel.ADVANCED,
    hard: DifficultyLevel.ADVANCED,
    difficult: DifficultyLevel.ADVANCED,
    unknown: DifficultyLevel.UNKNOWN,
  };
  return map[raw.toLowerCase()] ?? DifficultyLevel.UNKNOWN;
}

function toCompetitivenessLevel(raw: string): CompetitivenessLevel {
  const map: Record<string, CompetitivenessLevel> = {
    low: CompetitivenessLevel.LOW,
    medium: CompetitivenessLevel.MEDIUM,
    high: CompetitivenessLevel.HIGH,
    extreme: CompetitivenessLevel.EXTREME,
    very_high: CompetitivenessLevel.EXTREME,
    'very high': CompetitivenessLevel.EXTREME,
    unknown: CompetitivenessLevel.UNKNOWN,
  };
  return map[raw.toLowerCase()] ?? CompetitivenessLevel.UNKNOWN;
}

function generateSlug(title: string, orgName: string | null): string {
  const base = orgName ? `${title} ${orgName}` : title;
  return slugify(base, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Normalizes an ExtractionResult into a Prisma OpportunityCreateInput.
 */
export function normalizeOpportunity(
  raw: ExtractionResult,
  sourceUrl: string,
  sourceName: string
): Prisma.OpportunityCreateInput {
  const country = normalizeCountry(raw.country);
  const applicationDeadline = parseDate(raw.application_deadline);
  const startDate = parseDate(raw.start_date);
  const endDate = parseDate(raw.end_date);

  const educationLevels: EducationLevel[] = [];
  for (const level of raw.education_levels ?? []) {
    const mapped = toEducationLevel(level);
    if (mapped && !educationLevels.includes(mapped)) {
      educationLevels.push(mapped);
    }
  }

  const confidenceScore = Math.min(1, Math.max(0, raw.confidence_score ?? 0));
  const status: OpportunityStatus =
    confidenceScore >= 0.85 ? OpportunityStatus.APPROVED : OpportunityStatus.NEEDS_REVIEW;

  const slug = generateSlug(raw.title, raw.organization_name);

  return {
    title: raw.title,
    slug,
    summary: raw.summary || null,
    description_short: raw.summary || null,
    description_long: null,
    opportunity_type: toOpportunityType(raw.opportunity_type),
    source_name: sourceName,
    source_url: sourceUrl,
    original_url: sourceUrl,
    application_url: raw.application_url || null,
    organization_name: raw.organization_name || null,
    host_institution: raw.host_institution || null,
    country,
    region: raw.region || null,
    city: raw.city || null,
    is_remote: raw.is_remote ?? null,
    is_online: raw.is_online ?? null,
    eligible_countries: raw.eligible_countries ?? [],
    eligible_regions: raw.eligible_regions ?? [],
    education_levels: educationLevels,
    target_audience: raw.target_audience ?? [],
    fields_of_interest: raw.fields_of_interest ?? [],
    funding_type: toFundingType(raw.funding_type),
    funding_amount: raw.funding_amount || null,
    currency: raw.currency || null,
    costs_covered: raw.costs_covered ?? [],
    application_deadline: applicationDeadline,
    start_date: startDate,
    end_date: endDate,
    duration: raw.duration || null,
    language_requirements: raw.language_requirements ?? [],
    age_min: raw.age_min ?? null,
    age_max: raw.age_max ?? null,
    gender_eligibility: raw.gender_eligibility || null,
    citizenship_requirements: raw.citizenship_requirements ?? [],
    academic_requirements: raw.academic_requirements ?? [],
    documents_required: raw.documents_required ?? [],
    selection_criteria: raw.selection_criteria ?? [],
    benefits: raw.benefits ?? [],
    tags: raw.tags ?? [],
    difficulty_level: toDifficultyLevel(raw.difficulty_level),
    competitiveness_level: toCompetitivenessLevel(raw.competitiveness_level),
    confidence_score: confidenceScore,
    status,
    extracted_at: new Date(),
    last_seen_at: new Date(),
  };
}
