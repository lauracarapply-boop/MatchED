import { OpportunitySourceAdapter, PageContent, CandidateLink } from '@/lib/scraping/adapter';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export class UnjobsAsiaAdapter implements OpportunitySourceAdapter {
  sourceName = 'Unjobs Asia';
  baseUrl = 'https://unjobs.asia';

  getSeedUrls(): string[] {
    return [
      'https://unjobs.asia/',
      'https://unjobs.asia/jobs',
      'https://unjobs.asia/fellowships',
      'https://unjobs.asia/internships',
      'https://unjobs.asia/scholarships',
    ];
  }

  async discoverOpportunityLinks(): Promise<string[]> {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const allLinks: string[] = [];

    try {
      for (const seedUrl of this.getSeedUrls()) {
        await page.goto(seedUrl, { waitUntil: 'networkidle' });

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Extract links that look like opportunity pages
        const links = await page.evaluate(() => {
          const opportunityLinks: string[] = [];
          const anchors = document.querySelectorAll('a[href]');

          anchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href && (
              href.includes('/job/') ||
              href.includes('/fellowship/') ||
              href.includes('/internship/') ||
              href.includes('/scholarship/') ||
              href.includes('/opportunity/')
            )) {
              const fullUrl = href.startsWith('http') ? href : `https://unjobs.asia${href}`;
              if (!opportunityLinks.includes(fullUrl)) {
                opportunityLinks.push(fullUrl);
              }
            }
          });

          return opportunityLinks;
        });

        allLinks.push(...links);

        // Also try to find pagination and follow it
        const nextPageLinks = await page.evaluate(() => {
          const nextLinks: string[] = [];
          const pagination = document.querySelectorAll('a[href*="page="], a[href*="?p="]');
          pagination.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
              const fullUrl = href.startsWith('http') ? href : `https://unjobs.asia${href}`;
              nextLinks.push(fullUrl);
            }
          });
          return nextLinks.slice(0, 3); // Limit to first few pages
        });

        for (const nextUrl of nextPageLinks) {
          if (!allLinks.includes(nextUrl)) {
            await page.goto(nextUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);

            const pageLinks = await page.evaluate(() => {
              const links: string[] = [];
              const anchors = document.querySelectorAll('a[href]');
              anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && (
                  href.includes('/job/') ||
                  href.includes('/fellowship/') ||
                  href.includes('/internship/') ||
                  href.includes('/scholarship/') ||
                  href.includes('/opportunity/')
                )) {
                  const fullUrl = href.startsWith('http') ? href : `https://unjobs.asia${href}`;
                  links.push(fullUrl);
                }
              });
              return links;
            });

            allLinks.push(...pageLinks);
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering links from ${this.sourceName}:`, error);
    } finally {
      await browser.close();
    }

    // Remove duplicates
    return [...new Set(allLinks)];
  }

  async extractPageContent(url: string): Promise<PageContent> {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(script => script.remove());

        const title = document.title || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const canonicalUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';

        // Extract main content
        const mainContent = document.querySelector('main, .content, .post-content, article, .entry-content');
        const text = mainContent ? mainContent.textContent?.trim() || document.body.textContent?.trim() || '' : document.body.textContent?.trim() || '';

        // Extract breadcrumbs
        const breadcrumbs: string[] = [];
        const breadcrumbElements = document.querySelectorAll('.breadcrumb, .breadcrumbs, [class*="breadcrumb"] a');
        breadcrumbElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) breadcrumbs.push(text);
        });

        // Extract relevant links
        const links: string[] = [];
        const anchors = document.querySelectorAll('a[href]');
        anchors.forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (href && (href.includes('apply') || href.includes('application') || href.includes('register'))) {
            const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;
            links.push(fullUrl);
          }
        });

        return {
          title,
          text,
          html: document.body.innerHTML,
          metaDescription,
          canonicalUrl,
          breadcrumbs,
          links,
        };
      });

      return content;
    } catch (error) {
      console.error(`Error extracting content from ${url}:`, error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async parseListPage(html: string): Promise<CandidateLink[]> {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // Look for opportunity listings
    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const title = $link.text().trim();

      if (href && title && (
        href.includes('/job/') ||
        href.includes('/fellowship/') ||
        href.includes('/internship/') ||
        href.includes('/scholarship/') ||
        href.includes('/opportunity/')
      )) {
        const fullUrl = href.startsWith('http') ? href : `https://unjobs.asia${href}`;
        candidates.push({
          url: fullUrl,
          title,
          context: $link.closest('div, li, article').text().trim(),
        });
      }
    });

    return candidates;
  }
}