export interface PageContent {
  title: string;
  text: string;
  html?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  breadcrumbs?: string[];
  links?: string[];
}

export interface CandidateLink {
  url: string;
  title?: string;
  context?: string;
}

export interface OpportunitySourceAdapter {
  sourceName: string;
  baseUrl: string;
  getSeedUrls(): string[];
  discoverOpportunityLinks(): Promise<string[]>;
  extractPageContent(url: string): Promise<PageContent>;
  parseListPage?(html: string): Promise<CandidateLink[]>;
}