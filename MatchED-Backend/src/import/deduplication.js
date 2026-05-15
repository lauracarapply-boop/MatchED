// Duplicate detection for opportunities and sources

function normalizeUrlForCompare(url) {
  if (!url) return '';
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').trim();
}

function normalizeTitleForCompare(title) {
  if (!title) return '';
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function urlsOverlap(a, b) {
  const na = normalizeUrlForCompare(a);
  const nb = normalizeUrlForCompare(b);
  return na && nb && na === nb;
}

function titleSimilarity(a, b) {
  const ta = normalizeTitleForCompare(a);
  const tb = normalizeTitleForCompare(b);
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;

  // Jaccard similarity on words
  const wa = new Set(ta.split(' '));
  const wb = new Set(tb.split(' '));
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

function detectDuplicateOpportunity(candidate, existingList) {
  for (const existing of existingList) {
    // Exact URL match
    if (
      (candidate.monitored_url && urlsOverlap(candidate.monitored_url, existing.monitored_url)) ||
      (candidate.base_url && urlsOverlap(candidate.base_url, existing.base_url)) ||
      (candidate.official_url && urlsOverlap(candidate.official_url, existing.official_url))
    ) {
      return { isDuplicate: true, matchType: 'url', existingId: existing.id };
    }

    // Title + org similarity
    const titleSim = titleSimilarity(candidate.name || candidate.title, existing.name || existing.title);
    if (titleSim >= 0.85) {
      return { isDuplicate: titleSim >= 0.95, isPossibleDuplicate: titleSim >= 0.85, matchType: 'title', similarity: titleSim, existingId: existing.id };
    }
  }
  return { isDuplicate: false };
}

function detectDuplicateSource(candidate, existingList) {
  for (const existing of existingList) {
    if (
      (candidate.base_url && urlsOverlap(candidate.base_url, existing.base_url)) ||
      (candidate.monitored_url && urlsOverlap(candidate.monitored_url, existing.monitored_url))
    ) {
      return { isDuplicate: true, matchType: 'url', existingId: existing.id };
    }

    const sim = titleSimilarity(candidate.name, existing.name);
    if (sim >= 0.9) {
      return { isDuplicate: true, matchType: 'name', existingId: existing.id };
    }
  }
  return { isDuplicate: false };
}

module.exports = { detectDuplicateOpportunity, detectDuplicateSource };
