import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { OpportunityStatus, OpportunityType, FundingType, EducationLevel } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const type = searchParams.get('type') as OpportunityType | null;
    const funding_type = searchParams.get('funding_type') as FundingType | null;
    const education_level = searchParams.get('education_level') as EducationLevel | null;
    const country = searchParams.get('country');
    const region = searchParams.get('region');
    const field = searchParams.get('field');
    const deadline_before = searchParams.get('deadline_before');
    const deadline_after = searchParams.get('deadline_after');
    const remote = searchParams.get('remote') === 'true';
    const search = searchParams.get('search');
    const status = (searchParams.get('status') as OpportunityStatus) || OpportunityStatus.PUBLISHED;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: any = {
      status,
    };

    if (type) where.opportunity_type = type;
    if (funding_type) where.funding_type = funding_type;
    if (education_level) where.education_levels = { has: education_level };
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (region) where.region = { contains: region, mode: 'insensitive' };
    if (field) where.fields_of_interest = { hasSome: [field] };
    if (remote) where.OR = [{ is_remote: true }, { is_online: true }];
    if (deadline_before) where.application_deadline = { lte: new Date(deadline_before) };
    if (deadline_after) where.application_deadline = { gte: new Date(deadline_after) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { organization_name: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    // Get total count
    const total = await prisma.opportunity.count({ where });

    // Get opportunities
    const opportunities = await prisma.opportunity.findMany({
      where,
      orderBy: { published_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        description_short: true,
        opportunity_type: true,
        source_name: true,
        source_url: true,
        original_url: true,
        application_url: true,
        organization_name: true,
        host_institution: true,
        country: true,
        region: true,
        city: true,
        is_remote: true,
        is_online: true,
        eligible_countries: true,
        eligible_regions: true,
        education_levels: true,
        target_audience: true,
        fields_of_interest: true,
        funding_type: true,
        funding_amount: true,
        currency: true,
        costs_covered: true,
        application_deadline: true,
        start_date: true,
        end_date: true,
        duration: true,
        language_requirements: true,
        age_min: true,
        age_max: true,
        gender_eligibility: true,
        citizenship_requirements: true,
        academic_requirements: true,
        documents_required: true,
        selection_criteria: true,
        benefits: true,
        tags: true,
        difficulty_level: true,
        competitiveness_level: true,
        confidence_score: true,
        status: true,
        published_at: true,
        extracted_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      opportunities,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}