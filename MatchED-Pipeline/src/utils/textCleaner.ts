import * as cheerio from 'cheerio';

/**
 * Strips HTML tags, removes script/style content, and collapses whitespace.
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style elements entirely
  $('script, style, noscript, iframe, svg').remove();

  // Get text content
  let text = $.root().text();

  // Collapse whitespace
  text = text
    .replace(/\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Truncates text to a maximum number of characters, adding ellipsis if needed.
 */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // Try to cut at a word boundary
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

/**
 * Extracts the meta description from an HTML string.
 */
export function extractMetaDescription(html: string): string | null {
  const $ = cheerio.load(html);

  // Try standard meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc && metaDesc.trim()) return metaDesc.trim();

  // Try Open Graph description
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc && ogDesc.trim()) return ogDesc.trim();

  // Try Twitter description
  const twitterDesc = $('meta[name="twitter:description"]').attr('content');
  if (twitterDesc && twitterDesc.trim()) return twitterDesc.trim();

  return null;
}

/**
 * Extracts the canonical URL from an HTML string, resolving relative URLs against baseUrl.
 */
export function extractCanonicalUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  const canonical = $('link[rel="canonical"]').attr('href');
  if (canonical && canonical.trim()) {
    try {
      return new URL(canonical.trim(), baseUrl).href;
    } catch {
      return null;
    }
  }

  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl && ogUrl.trim()) {
    try {
      return new URL(ogUrl.trim(), baseUrl).href;
    } catch {
      return null;
    }
  }

  return null;
}
