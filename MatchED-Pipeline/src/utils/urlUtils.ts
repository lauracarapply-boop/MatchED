/**
 * Resolves a URL (possibly relative) against a base URL and returns the normalized absolute URL.
 */
export function normalizeUrl(url: string, baseUrl: string): string {
  try {
    const resolved = new URL(url, baseUrl);
    // Remove trailing slashes except root
    let href = resolved.href;
    if (href !== resolved.origin + '/' && href.endsWith('/')) {
      href = href.slice(0, -1);
    }
    // Remove hash fragments
    resolved.hash = '';
    return resolved.href;
  } catch {
    return url;
  }
}

const OPPORTUNITY_KEYWORDS = [
  'scholarship',
  'scholarships',
  'fellowship',
  'fellowships',
  'internship',
  'internships',
  'opportunity',
  'opportunities',
  'grant',
  'grants',
  'job',
  'jobs',
  'competition',
  'competitions',
  'conference',
  'program',
  'programmes',
  'programs',
  'exchange',
  'summer',
  'research',
  'leadership',
  'volunteering',
  'volunteer',
  'workshop',
  'course',
  'training',
  'immigration',
  'visa',
  'award',
  'awards',
  'postdoc',
  'phd',
  'masters',
  'undergraduate',
];

/**
 * Returns true if the URL path contains keywords suggesting it's an opportunity listing.
 */
export function isLikelyOpportunityUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathLower = parsed.pathname.toLowerCase();

    return OPPORTUNITY_KEYWORDS.some((kw) => pathLower.includes(kw));
  } catch {
    return false;
  }
}

/**
 * Removes duplicate URLs from an array, normalizing them first.
 */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      // Normalize: remove trailing slash, remove hash
      parsed.hash = '';
      let normalized = parsed.href;
      if (normalized.endsWith('/') && normalized !== parsed.origin + '/') {
        normalized = normalized.slice(0, -1);
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(url);
      }
    } catch {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
  }

  return result;
}

/**
 * Extracts the domain (hostname) from a URL.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
