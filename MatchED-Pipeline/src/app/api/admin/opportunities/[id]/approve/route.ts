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

    const updatedOpportunity = await prisma.opportunity.update({
      where: { id: params.id },
      data: {
        status: OpportunityStatus.APPROVED,
        reviewed_at: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Oportunidade aprovada com sucesso',
      opportunity: updatedOpportunity,
    });
  } catch (error) {
    console.error('Error approving opportunity:', error);

    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
