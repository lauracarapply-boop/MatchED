import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/admin';
import { OpportunityStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);

    // Get all metrics in parallel for better performance
    const [
      totalUsers,
      totalPublishedOpportunities,
      totalPendingReview,
      totalAICaptured,
      totalUserSubmitted,
      totalApplicationsStarted,
      totalApplicationsCompleted,
      totalQuestsStarted,
      totalQuestsCompleted,
      totalMatches,
      matchScoreStats,
      expiringSoon,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Total published opportunities
      prisma.opportunity.count({
        where: { status: OpportunityStatus.PUBLISHED },
      }),

      // Total pending review
      prisma.opportunity.count({
        where: {
          status: {
            in: [
              OpportunityStatus.NEEDS_REVIEW,
              OpportunityStatus.USER_SUBMITTED_PENDING,
              OpportunityStatus.AI_CAPTURED_PENDING,
            ],
          },
        },
      }),

      // Total AI captured
      prisma.opportunity.count({
        where: { submission_source: 'AI' },
      }),

      // Total user submitted
      prisma.opportunity.count({
        where: { submission_source: 'USER' },
      }),

      // Total applications started
      prisma.opportunityApplication.count({
        where: {
          status: {
            in: ['STARTED', 'APPLIED', 'COMPLETED'],
          },
        },
      }),

      // Total applications completed
      prisma.opportunityApplication.count({
        where: {
          status: {
            in: ['APPLIED', 'COMPLETED'],
          },
        },
      }),

      // Total quests started
      prisma.userQuest.count({
        where: {
          status: {
            in: ['STARTED', 'COMPLETED'],
          },
        },
      }),

      // Total quests completed
      prisma.userQuest.count({
        where: { status: 'COMPLETED' },
      }),

      // Total matches
      prisma.matchEvent.count(),

      // Match score statistics
      prisma.matchEvent.aggregate({
        _avg: { match_score: true },
      }),

      // Opportunities expiring soon (within 7 days)
      prisma.opportunity.count({
        where: {
          status: {
            in: [OpportunityStatus.APPROVED, OpportunityStatus.PUBLISHED],
          },
          application_deadline: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        },
      }),
    ]);

    const metrics = {
      totalUsers,
      totalPublishedOpportunities,
      totalPendingReview,
      totalAICaptured,
      totalUserSubmitted,
      totalApplicationsStarted,
      totalApplicationsCompleted,
      totalQuestsStarted,
      totalQuestsCompleted,
      totalMatches,
      averageMatchScore: matchScoreStats._avg.match_score || 0,
      expiringSoon,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);

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