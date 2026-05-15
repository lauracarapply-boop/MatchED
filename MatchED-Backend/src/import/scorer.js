// Scoring functions for opportunities and sources

function calculateQualityScore(opp) {
  let score = 0;

  // Data completeness (50 pts)
  if (opp.name || opp.title) score += 10;
  if (opp.monitored_url || opp.official_url) score += 10;
  if (opp.focus_areas && opp.focus_areas.length > 0) score += 8;
  if (opp.education_levels && opp.education_levels.length > 0) score += 8;
  if (opp.opportunity_types && opp.opportunity_types.length > 0) score += 7;
  if (opp.notes || opp.short_description) score += 7;

  // Trust & reliability (30 pts)
  const tierScores = { priority: 30, approved: 22, observation: 12, blocked: 0 };
  score += tierScores[opp.trust_tier] || 10;

  // Source quality (20 pts)
  if (opp.base_url) score += 5;
  if (opp.reliability_score) score += Math.round((opp.reliability_score / 100) * 15);

  return Math.min(100, Math.round(score));
}

function calculateReliabilityScore(source) {
  // Start from existing score if provided, else calculate from source_type
  if (source.reliability_score && source.reliability_score > 0) {
    return source.reliability_score;
  }

  const baseScores = {
    official: 87, aggregator: 75, newsletter: 70, social_media: 55, user_submission: 55,
  };
  const base = baseScores[source.source_type] || 60;

  let score = base;
  if (source.trust_tier === 'priority') score = Math.max(score, 88);
  if (source.trust_tier === 'blocked') score = Math.min(score, 30);

  return Math.min(100, Math.max(0, Math.round(score)));
}

module.exports = { calculateQualityScore, calculateReliabilityScore };
