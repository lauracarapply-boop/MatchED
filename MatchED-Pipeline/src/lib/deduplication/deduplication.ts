import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';

interface OpportunityData {
  title: string;
  organization_name?: string | null;
  application_deadline?: Date | null;
  country?: string | null;
  opportunity_type: string;
  source_url: string;
  original_url?: string | null;
  application_url?: string | null;
}

interface DeduplicationResult {
  isDuplicate: boolean;
  existingId?: string;
  similarity: number;
  reason?: string;
}

/**
 * Calculates similarity between two strings using Jaccard similarity on words.
 */
function calculateStringSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Checks if an opportunity is a duplicate of existing ones.
 */
export async function checkForDuplicates(data: OpportunityData): Promise<DeduplicationResult> {
  // First, check for exact matches
  const exactMatches = await prisma.opportunity.findMany({
    where: {
      OR: [
        { source_url: data.source_url },
        ...(data.original_url ? [{ original_url: data.original_url }] : []),
        ...(data.application_url ? [{ application_url: data.application_url }] : []),
      ],
    },
    select: { id: true },
  });

  if (exactMatches.length > 0) {
    return {
      isDuplicate: true,
      existingId: exactMatches[0].id,
      similarity: 1.0,
      reason: 'Exact URL match',
    };
  }

  // Check for similar opportunities
  const candidates = await prisma.opportunity.findMany({
    where: {
      OR: [
        {
          title: {
            contains: data.title.split(' ').slice(0, 3).join(' '), // First 3 words
            mode: 'insensitive',
          },
        },
        ...(data.organization_name ? [{
          organization_name: {
            contains: data.organization_name,
            mode: 'insensitive',
          },
        }] : []),
      ],
      application_deadline: data.application_deadline ? {
        gte: new Date(data.application_deadline.getTime() - 7 * 24 * 60 * 60 * 1000), // Within 1 week
        lte: new Date(data.application_deadline.getTime() + 7 * 24 * 60 * 60 * 1000),
      } : undefined,
    },
    select: {
      id: true,
      title: true,
      organization_name: true,
      country: true,
      opportunity_type: true,
    },
  });

  for (const candidate of candidates) {
    let similarity = 0;

    // Title similarity
    const titleSim = calculateStringSimilarity(data.title, candidate.title);
    similarity += titleSim * 0.4;

    // Organization similarity
    if (data.organization_name && candidate.organization_name) {
      const orgSim = calculateStringSimilarity(data.organization_name, candidate.organization_name);
      similarity += orgSim * 0.3;
    } else if (!data.organization_name && !candidate.organization_name) {
      similarity += 0.3; // Both null
    }

    // Country match
    if (data.country && candidate.country && data.country === candidate.country) {
      similarity += 0.2;
    }

    // Type match
    if (data.opportunity_type === candidate.opportunity_type) {
      similarity += 0.1;
    }

    if (similarity >= 0.88) {
      return {
        isDuplicate: true,
        existingId: candidate.id,
        similarity,
        reason: `High similarity (${(similarity * 100).toFixed(1)}%)`,
      };
    }
  }

  return {
    isDuplicate: false,
    similarity: 0,
  };
}

/**
 * Updates an existing opportunity if it's a newer version.
 */
export async function updateIfNewer(existingId: string, newData: Prisma.OpportunityUpdateInput): Promise<void> {
  // For now, just update the last_seen_at
  await prisma.opportunity.update({
    where: { id: existingId },
    data: {
      last_seen_at: new Date(),
      ...newData, // Update with new data
    },
  });
}