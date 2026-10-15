// Duplicate detection for opportunities and sources
//
// base_url is deliberately NOT used for matching: it is the organisation's
// homepage, and many distinct opportunities share one (every DAAD scholarship
// has base_url daad.de). Matching on it merged unrelated programs.

function normalizeUrlForCompare(url) {
  if (!url) return '';
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').trim();
}

function normalizeTitleForCompare(title) {
  if (!title) return '';
  return String(title)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function urlsOverlap(a, b) {
  const na = normalizeUrlForCompare(a);
  const nb = normalizeUrlForCompare(b);
  return Boolean(na && nb && na === nb);
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

function oppUrl(o) {
  return o.monitored_url || o.official_url || o.url || '';
}

// Same page + broadly similar name → same opportunity.
// Same page + different name (e.g. several labs listed on one apply page) →
// kept separate but flagged as a possible duplicate for review.
function detectDuplicateOpportunity(candidate, existingList) {
  const cTitle = candidate.name || candidate.title;
  const cUrl = oppUrl(candidate);
  let possible = null;

  for (const existing of existingList) {
    const eTitle = existing.name || existing.title;
    const sim = titleSimilarity(cTitle, eTitle);
    const sameUrl = cUrl && urlsOverlap(cUrl, oppUrl(existing));

    if (sameUrl && sim >= 0.5) return { isDuplicate: true, matchType: 'url', similarity: sim, existingId: existing.id };
    if (sim >= 0.95) return { isDuplicate: true, matchType: 'title', similarity: sim, existingId: existing.id };
    if (!possible && (sameUrl || sim >= 0.85)) {
      possible = { isDuplicate: false, isPossibleDuplicate: true, matchType: sameUrl ? 'url' : 'title', similarity: sim, existingId: existing.id };
    }
  }
  return possible || { isDuplicate: false };
}

function detectDuplicateSource(candidate, existingList) {
  for (const existing of existingList) {
    if (candidate.monitored_url && urlsOverlap(candidate.monitored_url, existing.monitored_url)) {
      return { isDuplicate: true, matchType: 'url', existingId: existing.id };
    }
    if (titleSimilarity(candidate.name, existing.name) >= 0.95) {
      return { isDuplicate: true, matchType: 'name', existingId: existing.id };
    }
  }
  return { isDuplicate: false };
}

module.exports = { detectDuplicateOpportunity, detectDuplicateSource, titleSimilarity, normalizeUrlForCompare };
