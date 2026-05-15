import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';
import { OpportunityStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { action, ...updates } = body;

    let statusUpdate: Partial<{ status: OpportunityStatus; published_at: Date | null }> = {};

    if (action) {
      switch (action) {
        case 'approve':
          statusUpdate = { status: OpportunityStatus.APPROVED };
          break;
        case 'publish':
          statusUpdate = { status: OpportunityStatus.PUBLISHED, published_at: new Date() };
          break;
        case 'reject':
          statusUpdate = { status: OpportunityStatus.REJECTED };
          break;
        case 'mark_duplicate':
          statusUpdate = { status: OpportunityStatus.DUPLICATE };
          break;
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }

    const opportunity = await prisma.opportunity.update({
      where: { id: params.id },
      data: { ...statusUpdate, ...updates },
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error('Error updating opportunity:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    await prisma.opportunity.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
