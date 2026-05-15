import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const sources = await prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { crawlRuns: true, rawOpportunities: true } },
      },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error listing sources:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
