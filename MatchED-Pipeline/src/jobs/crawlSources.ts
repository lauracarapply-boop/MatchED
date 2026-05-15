import { prisma } from '@/lib/db/client';
import { UnjobsAsiaAdapter } from '@/sources/unjobsAsia';
import { extractOpportunityData } from '@/lib/ai/extraction';
import { normalizeOpportunity } from '@/lib/normalization/normalizer';
import { checkForDuplicates } from '@/lib/deduplication/deduplication';
import { calculateConfidenceScore, shouldAutoApprove } from '@/lib/scoring/scoring';
import { CrawlStatus } from '@prisma/client';
import pLimit from 'p-limit';

const CRAWL_RATE_LIMIT_MS = parseInt(process.env.CRAWL_RATE_LIMIT_MS || '1000');
const MAX_CONCURRENT_PAGES = 3;

interface CrawlResult {
  sourceId: string;
  pagesVisited: number;
  opportunitiesFound: number;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  opportunitiesSkipped: number;
  errors: number;
  log: string[];
}

export async function crawlSource(sourceId: string): Promise<CrawlResult> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
  });

  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }

  if (!source.is_active) {
    throw new Error(`Source ${source.name} is not active`);
  }

  console.log(`\n🕷️ Starting crawl for ${source.name} (${source.base_url})`);

  // Create crawl run
  const crawlRun = await prisma.crawlRun.create({
    data: {
      source_id: sourceId,
      status: CrawlStatus.RUNNING,
    },
  });

  const result: CrawlResult = {
    sourceId,
    pagesVisited: 0,
    opportunitiesFound: 0,
    opportunitiesCreated: 0,
    opportunitiesUpdated: 0,
    opportunitiesSkipped: 0,
    errors: 0,
    log: [],
  };

  try {
    // Get the appropriate adapter
    const adapter = getAdapterForSource(source.name);

    // Discover opportunity links
    result.log.push('Discovering opportunity links...');
    const opportunityUrls = await adapter.discoverOpportunityLinks();
    result.opportunitiesFound = opportunityUrls.length;
    result.log.push(`Found ${opportunityUrls.length} potential opportunities`);

    // Limit concurrent processing
    const limit = pLimit(MAX_CONCURRENT_PAGES);

    const processPromises = opportunityUrls.map((url) =>
      limit(async () => {
        try {
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, CRAWL_RATE_LIMIT_MS));

          result.pagesVisited++;

          // Extract page content
          const pageContent = await adapter.extractPageContent(url);

          // Extract opportunity data with AI
          const extraction = await extractOpportunityData(pageContent.text, url);

          // Calculate confidence score
          const confidenceScore = calculateConfidenceScore(extraction);

          // Save raw opportunity
          await prisma.rawOpportunity.create({
            data: {
              source_id: sourceId,
              crawl_run_id: crawlRun.id,
              source_url: url,
              raw_title: pageContent.title,
              raw_text: pageContent.text,
              raw_html: pageContent.html,
              extracted_json: extraction,
              extraction_confidence: confidenceScore,
              status: 'processed',
            },
          });

          // Normalize the data
          const normalizedData = normalizeOpportunity(extraction, url, source.name);

          // Check for duplicates
          const duplicateCheck = await checkForDuplicates({
            title: normalizedData.title,
            organization_name: normalizedData.organization_name,
            application_deadline: normalizedData.application_deadline,
            country: normalizedData.country,
            opportunity_type: normalizedData.opportunity_type,
            source_url: url,
            original_url: normalizedData.original_url,
            application_url: normalizedData.application_url,
          });

          if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
            // Update existing opportunity
            await prisma.opportunity.update({
              where: { id: duplicateCheck.existingId },
              data: {
                ...normalizedData,
                last_seen_at: new Date(),
                confidence_score: confidenceScore,
              },
            });
            result.opportunitiesUpdated++;
            result.log.push(`Updated duplicate: ${normalizedData.title}`);
          } else {
            // Create new opportunity
            const status = shouldAutoApprove(confidenceScore) ? 'APPROVED' : 'NEEDS_REVIEW';

            await prisma.opportunity.create({
              data: {
                ...normalizedData,
                status: status as any,
                confidence_score: confidenceScore,
              },
            });
            result.opportunitiesCreated++;
            result.log.push(`Created new opportunity: ${normalizedData.title} (${status})`);
          }
        } catch (error) {
          result.errors++;
          const errorMsg = `Error processing ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.log.push(errorMsg);
          console.error(errorMsg);
        }
      })
    );

    await Promise.all(processPromises);

    // Update crawl run as successful
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: CrawlStatus.SUCCESS,
        finished_at: new Date(),
        pages_visited: result.pagesVisited,
        opportunities_found: result.opportunitiesFound,
        opportunities_created: result.opportunitiesCreated,
        opportunities_updated: result.opportunitiesUpdated,
        opportunities_skipped: result.opportunitiesSkipped,
        errors_count: result.errors,
        log: result.log.join('\n'),
      },
    });

    // Update source last crawled
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        last_crawled_at: new Date(),
        last_successful_crawl_at: new Date(),
      },
    });

    console.log(`✅ Crawl completed for ${source.name}`);
    console.log(`📊 Results: ${result.opportunitiesCreated} created, ${result.opportunitiesUpdated} updated, ${result.errors} errors`);

  } catch (error) {
    const errorMsg = `Crawl failed for ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.log.push(errorMsg);
    console.error(errorMsg);

    // Update crawl run as failed
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: CrawlStatus.FAILED,
        finished_at: new Date(),
        errors_count: result.errors + 1,
        log: result.log.join('\n'),
      },
    });

    // Update source with error
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        last_crawled_at: new Date(),
        last_error: errorMsg,
      },
    });

    throw error;
  }

  return result;
}

function getAdapterForSource(sourceName: string) {
  // For now, only UnjobsAsia is implemented
  switch (sourceName) {
    case 'Unjobs Asia':
      return new UnjobsAsiaAdapter();
    default:
      throw new Error(`No adapter found for source: ${sourceName}`);
  }
}

export async function crawlAllActiveSources(): Promise<CrawlResult[]> {
  const activeSources = await prisma.source.findMany({
    where: { is_active: true },
  });

  const results: CrawlResult[] = [];

  for (const source of activeSources) {
    try {
      const result = await crawlSource(source.id);
      results.push(result);
    } catch (error) {
      console.error(`Failed to crawl source ${source.name}:`, error);
    }
  }

  return results;
}