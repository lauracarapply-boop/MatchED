import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';
import { OpportunityStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { reason } = body;

    const updatedOpportunity = await prisma.opportunity.update({
      where: { id: params.id },
      data: {
        status: OpportunityStatus.REJECTED,
        reviewed_at: new Date(),
        rejection_reason: reason || null,
      },
    });

    return NextResponse.json({
      message: 'Oportunidade rejeitada com sucesso',
      opportunity: updatedOpportunity,
    });
  } catch (error) {
    console.error('Error rejecting opportunity:', error);

    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
