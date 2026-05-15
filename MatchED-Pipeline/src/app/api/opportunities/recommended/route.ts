import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { calculateOpportunityFit } from '@/lib/matching/matching';
import { EducationLevel, FundingType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse user profile from query parameters
    const education_level = searchParams.get('education_level') as EducationLevel | null;
    const age = searchParams.get('age') ? parseInt(searchParams.get('age')!) : null;
    const countries_of_interest = searchParams.get('countries_of_interest')?.split(',') || [];
    const fields_of_interest = searchParams.get('fields_of_interest')?.split(',') || [];
    const opportunity_types = searchParams.get('opportunity_types')?.split(',') || [];
    const funding_preferences = searchParams.get('funding_preferences')?.split(',') as FundingType[] | null;
    const deadline_window = searchParams.get('deadline_window') ? parseInt(searchParams.get('deadline_window')!) : 30;
    const remote_preference = searchParams.get('remote_preference') === 'true';
    const language_preferences = searchParams.get('language_preferences')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '10');

    const userProfile = {
      education_level: education_level || undefined,
      age: age || undefined,
      countries_of_interest,
      fields_of_interest,
      opportunity_types,
      funding_preferences: funding_preferences || undefined,
      deadline_window,
      remote_preference,
      language_preferences,
    };

    // Get published opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        status: 'PUBLISHED',
        application_deadline: {
          gte: new Date(), // Only future deadlines
        },
      },
      take: 100, // Limit for performance, then sort by fit
    });

    // Calculate fit scores
    const opportunitiesWithFit = opportunities.map(opportunity => {
      const fit = calculateOpportunityFit(userProfile, opportunity);
      return {
        ...opportunity,
        fit_score: fit.fit_score,
        fit_reasons: fit.reasons,
        fit_warnings: fit.warnings,
        fit_missing_data: fit.missing_data,
      };
    });

    // Sort by fit score descending
    opportunitiesWithFit.sort((a, b) => b.fit_score - a.fit_score);

    // Take top results
    const topOpportunities = opportunitiesWithFit.slice(0, limit);

    return NextResponse.json({
      opportunities: topOpportunities,
      total: topOpportunities.length,
    });
  } catch (error) {
    console.error('Error fetching recommended opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}