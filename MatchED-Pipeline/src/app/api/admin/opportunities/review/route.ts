import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';
import { OpportunityStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where clause based on filter
    const where: any = {
      status: {
        in: [
          OpportunityStatus.NEEDS_REVIEW,
          OpportunityStatus.USER_SUBMITTED_PENDING,
          OpportunityStatus.AI_CAPTURED_PENDING,
        ],
      },
    };

    if (status && status !== 'all') {
      where.status = status as OpportunityStatus;
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        submittedBy: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('Error fetching opportunities for review:', error);

    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}