import { ExtractionResult } from '@/schemas/extraction';

/**
 * Calculates a confidence score for an extracted opportunity.
 * Higher scores indicate more complete and reliable data.
 */
export function calculateConfidenceScore(extraction: ExtractionResult): number {
  let score = 0;
  let totalWeight = 0;

  // Title presence (required)
  if (extraction.title && extraction.title.trim().length > 0) {
    score += 1;
  }
  totalWeight += 1;

  // Summary presence (required)
  if (extraction.summary && extraction.summary.trim().length > 0) {
    score += 1;
  }
  totalWeight += 1;

  // Organization name (important)
  if (extraction.organization_name) {
    score += 0.8;
  }
  totalWeight += 0.8;

  // Application URL (very important)
  if (extraction.application_url) {
    score += 1;
  }
  totalWeight += 1;

  // Application deadline (important)
  if (extraction.application_deadline) {
    score += 0.7;
  }
  totalWeight += 0.7;

  // Country/location (somewhat important)
  if (extraction.country || extraction.city || extraction.region) {
    score += 0.5;
  }
  totalWeight += 0.5;

  // Funding information (important)
  if (extraction.funding_type && extraction.funding_type !== 'unknown') {
    score += 0.6;
  }
  totalWeight += 0.6;

  // Education levels (important for targeting)
  if (extraction.education_levels && extraction.education_levels.length > 0) {
    score += 0.5;
  }
  totalWeight += 0.5;

  // Eligible countries (important)
  if (extraction.eligible_countries && extraction.eligible_countries.length > 0) {
    score += 0.4;
  }
  totalWeight += 0.4;

  // Fields of interest (helpful)
  if (extraction.fields_of_interest && extraction.fields_of_interest.length > 0) {
    score += 0.3;
  }
  totalWeight += 0.3;

  // Documents required (helpful)
  if (extraction.documents_required && extraction.documents_required.length > 0) {
    score += 0.2;
  }
  totalWeight += 0.2;

  // Benefits (helpful)
  if (extraction.benefits && extraction.benefits.length > 0) {
    score += 0.2;
  }
  totalWeight += 0.2;

  // Tags (helpful)
  if (extraction.tags && extraction.tags.length > 0) {
    score += 0.1;
  }
  totalWeight += 0.1;

  // Penalize for missing important fields
  const missingImportant = extraction.missing_important_fields || [];
  if (missingImportant.includes('title') || missingImportant.includes('summary')) {
    score *= 0.5; // Major penalty
  }

  if (missingImportant.includes('application_url')) {
    score *= 0.8; // Moderate penalty
  }

  // Ensure score is between 0 and 1
  const finalScore = totalWeight > 0 ? Math.min(1, Math.max(0, score / totalWeight)) : 0;

  return finalScore;
}

/**
 * Determines if an opportunity should be auto-approved based on confidence score.
 */
export function shouldAutoApprove(confidenceScore: number): boolean {
  return confidenceScore >= 0.85;
}

/**
 * Determines if an opportunity needs review based on confidence score.
 */
export function needsReview(confidenceScore: number): boolean {
  return confidenceScore < 0.7;
}