import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sources = [
  {
    name: 'UNJobs Asia',
    base_url: 'https://unjobs.asia',
    crawl_frequency: 'daily',
    notes: 'UN and international organization jobs, scholarships and fellowships in Asia.',
  },
  {
    name: 'Immigration International',
    base_url: 'https://immigrationintl.com',
    crawl_frequency: 'daily',
    notes: 'International immigration opportunities, scholarships and fellowships.',
  },
  {
    name: 'Scholarship International',
    base_url: 'https://scholarshipintl.com',
    crawl_frequency: 'daily',
    notes: 'Global scholarship and fellowship listings.',
  },
  {
    name: 'Wazifa Group',
    base_url: 'https://wazifagroup.com',
    crawl_frequency: 'daily',
    notes: 'Jobs, scholarships, fellowships and internships listings.',
  },
  {
    name: 'Leaders of Today',
    base_url: 'https://www.leadersoftoday.com',
    crawl_frequency: 'daily',
    notes: 'Leadership programs, scholarships and fellowships for youth.',
  },
  {
    name: 'Opportunities for Youth',
    base_url: 'https://opportunitiesforyouth.org',
    crawl_frequency: 'daily',
    notes: 'Scholarships, fellowships, internships and grants for youth.',
  },
];

async function main() {
  console.log('Seeding sources...');

  for (const source of sources) {
    const result = await prisma.source.upsert({
      where: { name: source.name },
      update: {
        base_url: source.base_url,
        crawl_frequency: source.crawl_frequency,
        notes: source.notes,
      },
      create: {
        name: source.name,
        base_url: source.base_url,
        crawl_frequency: source.crawl_frequency,
        notes: source.notes,
        is_active: true,
        robots_allowed: true,
      },
    });
    console.log(`Upserted source: ${result.name} (id: ${result.id})`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
