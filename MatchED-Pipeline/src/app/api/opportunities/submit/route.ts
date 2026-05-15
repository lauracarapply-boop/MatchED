import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { OpportunityStatus, SubmissionSource, OpportunityType, FundingType, EducationLevel } from '@prisma/client';
import slugify from 'slugify';

const submitOpportunitySchema = {
  title: 'string',
  opportunity_type: 'string',
  organization_name: 'string',
  source_url: 'string',
  application_url: 'string?',
  application_deadline: 'string?',
  short_description: 'string',
  country: 'string?',
  is_remote: 'boolean?',
  is_online: 'boolean?',
  funding_type: 'string',
  education_levels: 'array',
  fields_of_interest: 'array',
  long_description: 'string?',
  benefits: 'array?',
  costs_covered: 'array?',
  eligible_countries: 'array?',
  eligible_regions: 'array?',
  city: 'string?',
  region: 'string?',
  start_date: 'string?',
  end_date: 'string?',
  duration: 'string?',
  language_requirements: 'array?',
  age_min: 'number?',
  age_max: 'number?',
  documents_required: 'array?',
  selection_criteria: 'array?',
  tags: 'array?',
  notes_from_submitter: 'string?',
};

function validateSubmission(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required');
  }
  if (!data.opportunity_type || typeof data.opportunity_type !== 'string') {
    errors.push('Opportunity type is required');
  }
  if (!data.organization_name || typeof data.organization_name !== 'string') {
    errors.push('Organization name is required');
  }
  if (!data.source_url || typeof data.source_url !== 'string') {
    errors.push('Source URL is required');
  }
  if (!data.short_description || typeof data.short_description !== 'string') {
    errors.push('Short description is required');
  }
  if (!data.funding_type || typeof data.funding_type !== 'string') {
    errors.push('Funding type is required');
  }
  if (!Array.isArray(data.education_levels) || data.education_levels.length === 0) {
    errors.push('At least one education level is required');
  }
  if (!Array.isArray(data.fields_of_interest) || data.fields_of_interest.length === 0) {
    errors.push('At least one field of interest is required');
  }

  return { isValid: errors.length === 0, errors };
}

function mapOpportunityType(type: string): OpportunityType {
  const typeMap: Record<string, OpportunityType> = {
    scholarship: OpportunityType.SCHOLARSHIP,
    fellowship: OpportunityType.FELLOWSHIP,
    internship: OpportunityType.INTERNSHIP,
    job: OpportunityType.JOB,
    volunteering: OpportunityType.VOLUNTEERING,
    grant: OpportunityType.GRANT,
    competition: OpportunityType.COMPETITION,
    conference: OpportunityType.CONFERENCE,
    exchange_program: OpportunityType.EXCHANGE_PROGRAM,
    summer_program: OpportunityType.SUMMER_PROGRAM,
    online_course: OpportunityType.ONLINE_COURSE,
    workshop: OpportunityType.WORKSHOP,
    research: OpportunityType.RESEARCH,
    leadership_program: OpportunityType.LEADERSHIP_PROGRAM,
    immigration: OpportunityType.IMMIGRATION,
  };
  return typeMap[type.toLowerCase()] || OpportunityType.OTHER;
}

function mapFundingType(type: string): FundingType {
  const typeMap: Record<string, FundingType> = {
    fully_funded: FundingType.FULLY_FUNDED,
    partially_funded: FundingType.PARTIALLY_FUNDED,
    paid: FundingType.PAID,
    unpaid: FundingType.UNPAID,
    stipend: FundingType.STIPEND,
    tuition_only: FundingType.TUITION_ONLY,
    travel_only: FundingType.TRAVEL_ONLY,
    self_funded: FundingType.SELF_FUNDED,
  };
  return typeMap[type.toLowerCase()] || FundingType.UNKNOWN;
}

function mapEducationLevels(levels: string[]): EducationLevel[] {
  const levelMap: Record<string, EducationLevel> = {
    high_school: EducationLevel.HIGH_SCHOOL,
    gap_year: EducationLevel.GAP_YEAR,
    undergraduate: EducationLevel.UNDERGRADUATE,
    masters: EducationLevel.MASTERS,
    phd: EducationLevel.PHD,
    postdoc: EducationLevel.POSTDOC,
    early_career: EducationLevel.EARLY_CAREER,
    professional: EducationLevel.PROFESSIONAL,
    any: EducationLevel.ANY,
  };

  return levels
    .map(level => levelMap[level.toLowerCase()])
    .filter(Boolean) as EducationLevel[];
}

export async function POST(request: NextRequest) {
  try {
    // For MVP, we'll assume authentication is handled elsewhere
    // In production, this should validate the user session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For MVP, we'll extract user info from a header
    // In production, this should come from the session
    const userEmail = request.headers.get('x-user-email');
    const userId = request.headers.get('x-user-id');

    if (!userEmail || !userId) {
      return NextResponse.json(
        { error: 'User information required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = validateSubmission(body);

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create the opportunity
    const opportunityData = {
      title: body.title.trim(),
      slug: slugify(body.title, { lower: true, strict: true }),
      summary: body.short_description,
      description_short: body.short_description,
      description_long: body.long_description || null,
      opportunity_type: mapOpportunityType(body.opportunity_type),
      source_name: 'User Submission',
      source_url: body.source_url,
      original_url: body.source_url,
      application_url: body.application_url || null,
      organization_name: body.organization_name,
      country: body.country || null,
      region: body.region || null,
      city: body.city || null,
      is_remote: body.is_remote || false,
      is_online: body.is_online || false,
      eligible_countries: body.eligible_countries || [],
      eligible_regions: body.eligible_regions || [],
      education_levels: mapEducationLevels(body.education_levels),
      fields_of_interest: body.fields_of_interest,
      funding_type: mapFundingType(body.funding_type),
      costs_covered: body.costs_covered || [],
      application_deadline: body.application_deadline ? new Date(body.application_deadline) : null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      duration: body.duration || null,
      language_requirements: body.language_requirements || [],
      age_min: body.age_min || null,
      age_max: body.age_max || null,
      documents_required: body.documents_required || [],
      selection_criteria: body.selection_criteria || [],
      benefits: body.benefits || [],
      tags: body.tags || [],
      status: OpportunityStatus.USER_SUBMITTED_PENDING,
      submission_source: SubmissionSource.USER,
      submitted_by_user_id: userId,
      submitted_by_email: userEmail,
      submitted_at: new Date(),
      extracted_at: new Date(),
    };

    const opportunity = await prisma.opportunity.create({
      data: opportunityData,
    });

    return NextResponse.json({
      success: true,
      message: 'Sua oportunidade foi enviada para revisão. A equipe do MatchED irá analisar antes de publicar.',
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        status: opportunity.status,
      },
    });
  } catch (error) {
    console.error('Error submitting opportunity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}