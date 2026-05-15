import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';
import { OpportunityStatus, OpportunityType, FundingType, SubmissionSource } from '@prisma/client';
import slugify from 'slugify';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as OpportunityStatus;
    }

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          submittedBy: { select: { email: true } },
        },
      }),
      prisma.opportunity.count({ where }),
    ]);

    return NextResponse.json({ opportunities, total, page, limit });
  } catch (error) {
    console.error('Error listing opportunities:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const {
      title,
      organization_name,
      opportunity_type,
      funding_type,
      description_short,
      description_long,
      source_url,
      application_url,
      application_deadline,
      country,
      city,
      is_remote,
      is_online,
      education_levels,
      fields_of_interest,
      benefits,
      tags,
    } = body;

    if (!title || !source_url) {
      return NextResponse.json({ error: 'title and source_url are required' }, { status: 400 });
    }

    const baseSlug = slugify(title, { lower: true, strict: true });
    const existing = await prisma.opportunity.findFirst({ where: { slug: { startsWith: baseSlug } }, orderBy: { created_at: 'desc' } });
    const slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

    const opportunity = await prisma.opportunity.create({
      data: {
        title,
        slug,
        organization_name: organization_name || '',
        source_name: 'Admin',
        source_url,
        application_url: application_url || null,
        description_short: description_short || null,
        description_long: description_long || null,
        opportunity_type: (opportunity_type as OpportunityType) || OpportunityType.OTHER,
        funding_type: (funding_type as FundingType) || FundingType.UNKNOWN,
        country: country || null,
        city: city || null,
        is_remote: is_remote ?? false,
        is_online: is_online ?? false,
        education_levels: education_levels || [],
        fields_of_interest: fields_of_interest || [],
        benefits: benefits || [],
        tags: tags || [],
        status: OpportunityStatus.PUBLISHED,
        submission_source: SubmissionSource.ADMIN,
        extracted_at: new Date(),
        published_at: new Date(),
        application_deadline: application_deadline ? new Date(application_deadline) : null,
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
