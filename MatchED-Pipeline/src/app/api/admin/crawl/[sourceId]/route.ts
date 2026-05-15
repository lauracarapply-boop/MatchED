import { NextRequest, NextResponse } from 'next/server';
import { crawlSource } from '@/jobs/crawlSources';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  try {
    await requireAdmin(request);

    const result = await crawlSource(params.sourceId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error crawling source:', error);
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
