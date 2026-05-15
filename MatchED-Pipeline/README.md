# MatchED Opportunity Intelligence Pipeline

A comprehensive system for discovering, extracting, and managing educational and professional opportunities using AI and web scraping.

## Features

- **Multi-source crawling**: Automated discovery of opportunities from various websites
- **AI-powered extraction**: Uses OpenAI/Anthropic to extract structured data from unstructured web content
- **Data normalization**: Standardizes countries, dates, opportunity types, and funding types
- **Deduplication**: Prevents duplicate opportunities using similarity matching
- **Quality scoring**: Confidence scores based on data completeness
- **Admin panel**: Web interface for reviewing and approving opportunities
- **REST API**: Public API for accessing published opportunities
- **Matching engine**: Recommends opportunities based on user profiles

## Tech Stack

- **Frontend/Admin**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Scraping**: Playwright for dynamic content, Cheerio for static HTML
- **AI**: OpenAI GPT-4 or Anthropic Claude for data extraction
- **Deployment**: Ready for Vercel, Railway, or similar platforms

## Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key or Anthropic API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd matched-pipeline
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (create `.env.local`):
```env
DATABASE_URL="postgresql://username:password@localhost:5432/matched_db"
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
LLM_PROVIDER="openai" # or "anthropic"
CRAWL_RATE_LIMIT_MS="1000"
ADMIN_SECRET="your-admin-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. Set up the database:
```bash
npx prisma db push
```

5. Seed the sources:
```bash
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

## Usage

### Admin Panel

Visit `http://localhost:3000/admin/opportunities` to review and approve opportunities.

### API Endpoints

#### Public API

- `GET /api/opportunities` - List published opportunities with filtering
- `GET /api/opportunities/[slug]` - Get specific opportunity
- `GET /api/opportunities/recommended` - Get personalized recommendations

#### Admin API

- `POST /api/admin/crawl/[sourceId]` - Trigger crawl for a source
- `PATCH /api/admin/opportunities/[id]` - Approve/publish/reject opportunities

### Running Crawls

#### Manual crawl:
```bash
npm run crawl
```

#### Via API:
```bash
curl -X POST http://localhost:3000/api/admin/crawl/[source-id] \
  -H "Authorization: Bearer your-admin-secret"
```

## Supported Sources

Currently implemented:
- UNJobs Asia (https://unjobs.asia)
- Immigration International (https://immigrationintl.com)
- Scholarship International (https://scholarshipintl.com)
- Wazifa Group (https://wazifagroup.com)
- Leaders of Today (https://www.leadersoftoday.com/opportunities)
- Opportunities for Youth (https://opportunitiesforyouth.org)

## Adding New Sources

1. Create a new adapter in `src/sources/` implementing `OpportunitySourceAdapter`
2. Add the source to the seed script
3. Update the `getAdapterForSource` function in `crawlSources.ts`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI extraction | Yes* |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI extraction | Yes* |
| `LLM_PROVIDER` | "openai" or "anthropic" | Yes |
| `CRAWL_RATE_LIMIT_MS` | Delay between page requests | No (default: 1000) |
| `ADMIN_SECRET` | Secret for admin API access | No |
| `NEXT_PUBLIC_APP_URL` | Base URL for the application | No |

*Either OpenAI or Anthropic key is required

## Database Schema

The system uses the following main entities:
- **Opportunity**: Core opportunity data
- **Source**: Websites to crawl
- **CrawlRun**: Crawl execution logs
- **RawOpportunity**: Raw extracted data before processing

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
npm start
```

### Database Migrations
```bash
npx prisma db push
```

### Prisma Studio
```bash
npm run db:studio
```

## Deployment

The application is ready for deployment on platforms like Vercel or Railway:

1. Set environment variables in your deployment platform
2. Deploy the application
3. Run database migrations and seeding
4. Set up cron jobs for automated crawling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC