const { readDatabase, writeDatabase, dbPath } = require('../database/db');
const fs = require('fs');
const path = require('path');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seedDatabase() {
  console.log('\n📊 Seeding MatchED database...\n');

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Cleared existing database');
  }

  const db = {
    users: [], highSchoolProfiles: [], collegeProfiles: [],
    opportunities: [], savedOpportunities: [], swipeEvents: [],
    applicationQuests: [], questTasks: [], deadlines: [],
    badges: [], userBadges: [], notifications: [],
    xpTransactions: [], resultTracking: [], subscriptionPlans: []
  };

  // ── Users ──────────────────────────────────────────────
  const user1Id = uuidv4();
  const user2Id = uuidv4();

  db.users.push({
    id: user1Id, email: 'laura@example.com',
    password: await bcryptjs.hash('password123', 10),
    name: 'Laura Oliveira', userPath: 'high-school', planType: 'explorer',
    xpTotal: 1250, level: 4, currentStreak: 5,
    createdAt: new Date(Date.now() - 30 * 864e5).toISOString()
  });

  db.users.push({
    id: user2Id, email: 'alex@example.com',
    password: await bcryptjs.hash('password123', 10),
    name: 'Alex Chen', userPath: 'college', planType: 'applicant',
    xpTotal: 3400, level: 7, currentStreak: 12,
    createdAt: new Date(Date.now() - 60 * 864e5).toISOString()
  });

  // ── High School Profiles ────────────────────────────────
  db.highSchoolProfiles.push({
    id: uuidv4(), userId: user1Id,
    grade: '11', school: 'Lincoln High School',
    interests: ['leadership', 'international-relations', 'science'],
    goals: ['attend-top-university', 'get-scholarship'],
    gpa: '3.9', createdAt: new Date().toISOString()
  });

  // ── College Profiles ────────────────────────────────────
  db.collegeProfiles.push({
    id: uuidv4(), userId: user2Id,
    university: 'UC Berkeley', major: 'Computer Science',
    careerInterests: ['software-engineering', 'ai', 'entrepreneurship'],
    graduationYear: '2026', gpa: '3.7', createdAt: new Date().toISOString()
  });

  // ── Opportunities ───────────────────────────────────────
  const opps = [
    // HIGH SCHOOL
    {
      programName: 'Yale Young Global Scholars',
      organizationName: 'Yale University',
      description: 'Intensive two-week academic program where high school students engage with Yale faculty and explore global issues in politics, science, and entrepreneurship.',
      description_pt: 'Programa acadêmico intensivo de duas semanas onde estudantes do ensino médio se conectam com professores de Yale e exploram questões globais de política, ciência e empreendedorismo.',
      category: 'summer-program', audience: 'high-school',
      location: 'New Haven, CT', modality: 'in-person',
      deadline: new Date(Date.now() + 10 * 864e5).toISOString(),
      eligibility: 'Rising juniors and seniors with a GPA of 3.5+',
      eligibility_pt: 'Alunos do penúltimo e último ano do EM com média 3.5+',
      requirements: ['Transcript', 'Two essays', 'Teacher recommendation'],
      requirements_pt: ['Histórico escolar', 'Dois ensaios', 'Carta de recomendação de professor'],
      tags: ['Leadership', 'International', 'Ivy League', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Full ($6,400 value)', fundingAmount_pt: 'Integral (valor de $6.400)',
      competitionLevel: 'high', matchScore: 87, matchType: 'leadership-focused',
      websiteUrl: 'https://globalscholars.yale.edu/'
    },
    {
      programName: 'Lumiere Education Research Fellowship',
      organizationName: 'Lumiere Education',
      description: 'A mentorship-driven research fellowship pairing high schoolers with PhD mentors for a 12-week independent research project and college application support.',
      description_pt: 'Fellowship de pesquisa com mentoria que conecta estudantes do EM com mentores doutores para um projeto de pesquisa independente de 12 semanas e apoio à candidatura universitária.',
      category: 'fellowship', audience: 'high-school',
      location: 'Remote / Multiple Cities', modality: 'hybrid',
      deadline: new Date(Date.now() + 20 * 864e5).toISOString(),
      eligibility: 'High school juniors and seniors, any GPA',
      eligibility_pt: 'Estudantes do penúltimo e último ano do EM, qualquer média',
      requirements: ['Short essay', 'Letter of intent'],
      requirements_pt: ['Ensaio curto', 'Carta de intenção'],
      tags: ['Research', 'Mentorship', 'College Prep', 'STEM'],
      fundingType: 'partial-scholarship', fundingAmount: 'Partial aid available', fundingAmount_pt: 'Auxílio parcial disponível',
      competitionLevel: 'medium', matchScore: 82, matchType: 'interest-based',
      websiteUrl: 'https://www.lumiere-education.com/'
    },
    {
      programName: 'RSI — Research Science Institute',
      organizationName: 'Center for Excellence in Education',
      description: 'The most prestigious free summer STEM program in the US. Students conduct original research at MIT under the mentorship of scientists and professors.',
      description_pt: 'O programa de verão STEM mais prestigioso e gratuito dos EUA. Estudantes realizam pesquisas originais no MIT sob mentoria de cientistas e professores.',
      category: 'summer-program', audience: 'high-school',
      location: 'Cambridge, MA (MIT)', modality: 'in-person',
      deadline: new Date(Date.now() + 35 * 864e5).toISOString(),
      eligibility: 'Rising seniors with exceptional academic achievement',
      eligibility_pt: 'Alunos do último ano do EM com desempenho acadêmico excepcional',
      requirements: ['Transcript', 'SAT/ACT scores', 'Three recommendations', 'Essays'],
      requirements_pt: ['Histórico escolar', 'Notas do SAT/ACT', 'Três cartas de recomendação', 'Ensaios'],
      tags: ['STEM', 'Research', 'MIT', 'Prestigious', 'Free'],
      fundingType: 'full-scholarship', fundingAmount: 'Fully funded (all expenses)', fundingAmount_pt: 'Totalmente financiado (todas as despesas)',
      competitionLevel: 'very-high', matchScore: 91, matchType: 'academic-based',
      websiteUrl: 'https://www.cee.org/rsi'
    },
    {
      programName: 'Congressional App Challenge',
      organizationName: 'US Congress',
      description: 'Congressional competition for high school students to design and build apps that solve real problems in their communities. Winners exhibit in Washington D.C.',
      description_pt: 'Competição do Congresso Americano para estudantes do EM criarem aplicativos que resolvam problemas reais em suas comunidades. Os vencedores apresentam em Washington D.C.',
      category: 'fellowship', audience: 'high-school',
      location: 'Washington, D.C. (finals)', modality: 'hybrid',
      deadline: new Date(Date.now() + 45 * 864e5).toISOString(),
      eligibility: 'All US high school students',
      eligibility_pt: 'Todos os estudantes do ensino médio dos EUA',
      requirements: ['App submission', 'Demo video'],
      requirements_pt: ['Envio do aplicativo', 'Vídeo demonstrativo'],
      tags: ['Tech', 'Coding', 'Civic', 'Competition', 'Free'],
      fundingType: 'paid', fundingAmount: 'Awards + DC trip', fundingAmount_pt: 'Prêmios + viagem para Washington D.C.',
      competitionLevel: 'medium', matchScore: 78, matchType: 'skill-based',
      websiteUrl: 'https://www.congressionalappchallenge.us/'
    },
    {
      programName: 'Jack Kent Cooke Young Scholars',
      organizationName: 'Jack Kent Cooke Foundation',
      description: 'Multi-year scholarship and mentorship program supporting high-achieving students with financial need through high school and into college.',
      description_pt: 'Programa plurianual de bolsas e mentoria para estudantes de alto desempenho com necessidade financeira, do ensino médio até a faculdade.',
      category: 'scholarship', audience: 'high-school',
      location: 'Remote / National', modality: 'hybrid',
      deadline: new Date(Date.now() + 55 * 864e5).toISOString(),
      eligibility: 'Students in grades 7–8 with demonstrated financial need and high achievement',
      eligibility_pt: 'Alunos do 7º ao 8º ano com necessidade financeira comprovada e alto desempenho',
      requirements: ['Transcript', 'Recommendation letters', 'Essays', 'Parent financials'],
      requirements_pt: ['Histórico escolar', 'Cartas de recomendação', 'Ensaios', 'Documentos financeiros dos pais'],
      tags: ['Scholarship', 'Financial Aid', 'Multi-year', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Up to $40,000/year through college', fundingAmount_pt: 'Até $40.000/ano durante a faculdade',
      competitionLevel: 'very-high', matchScore: 74, matchType: 'academic-based',
      websiteUrl: 'https://www.jkcf.org/our-scholarships/young-scholars-program/'
    },
    {
      programName: 'Girls Who Code Summer Immersion',
      organizationName: 'Girls Who Code',
      description: 'Free 2-week intensive coding program for high school girls. Learn software engineering skills, get mentored by tech industry professionals, build a portfolio project.',
      description_pt: 'Programa intensivo e gratuito de programação de 2 semanas para meninas do EM. Aprenda engenharia de software, tenha mentoras do setor de tecnologia e construa um projeto para o portfólio.',
      category: 'summer-program', audience: 'high-school',
      location: 'Multiple US Cities + Virtual', modality: 'hybrid',
      deadline: new Date(Date.now() + 25 * 864e5).toISOString(),
      eligibility: 'Girls and non-binary students in grades 10–12',
      eligibility_pt: 'Meninas e estudantes não-binários nos últimos três anos do ensino médio',
      requirements: ['Short application', 'No prior coding experience required'],
      requirements_pt: ['Inscrição simplificada', 'Não é necessária experiência prévia com programação'],
      tags: ['Coding', 'Women in Tech', 'Free', 'Beginner Friendly'],
      fundingType: 'full-scholarship', fundingAmount: 'Fully free', fundingAmount_pt: 'Completamente gratuito',
      competitionLevel: 'low', matchScore: 70, matchType: 'interest-based',
      websiteUrl: 'https://girlswhocode.com/programs/summer-immersion-program'
    },
    {
      programName: 'Questbridge National College Match',
      organizationName: 'QuestBridge',
      description: 'Links the nation\'s brightest students from low-income backgrounds with opportunities at top colleges. Match Scholarship covers full 4-year tuition + room and board.',
      description_pt: 'Liga os estudantes mais talentosos de baixa renda às melhores universidades do país. A bolsa Match cobre 4 anos completos de mensalidade, moradia e alimentação.',
      category: 'scholarship', audience: 'high-school',
      location: 'National (Match to 49 top colleges)', modality: 'in-person',
      deadline: new Date(Date.now() + 40 * 864e5).toISOString(),
      eligibility: 'High-achieving seniors with household income under ~$65,000',
      eligibility_pt: 'Estudantes do último ano com alto desempenho e renda familiar abaixo de ~$65.000',
      requirements: ['Essays', 'Transcript', 'Recommendations', 'Financial docs'],
      requirements_pt: ['Ensaios', 'Histórico escolar', 'Recomendações', 'Documentos financeiros'],
      tags: ['Scholarship', 'Full Ride', 'Low Income', 'Top Colleges', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Full 4-year scholarship', fundingAmount_pt: 'Bolsa integral de 4 anos',
      competitionLevel: 'very-high', matchScore: 80, matchType: 'academic-based',
      websiteUrl: 'https://www.questbridge.org/'
    },
    {
      programName: 'Telluride Association Summer Seminar',
      organizationName: 'Telluride Association',
      description: 'Intense 6-week residential academic program for high schoolers. Free. Small seminars led by professors on humanities and social science topics.',
      description_pt: 'Programa acadêmico residencial intensivo de 6 semanas para estudantes do EM. Gratuito. Seminários pequenos conduzidos por professores sobre humanidades e ciências sociais.',
      category: 'summer-program', audience: 'high-school',
      location: 'Cornell, Michigan & Other Campuses', modality: 'in-person',
      deadline: new Date(Date.now() + 15 * 864e5).toISOString(),
      eligibility: 'Rising juniors and seniors who love reading and discussion',
      eligibility_pt: 'Alunos do penúltimo e último ano do EM que gostam de leitura e debate',
      requirements: ['Two essays', 'Graded writing sample', 'Transcript'],
      requirements_pt: ['Dois ensaios', 'Amostra de escrita avaliada', 'Histórico escolar'],
      tags: ['Humanities', 'Free', 'Residential', 'Intellectual', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Fully funded', fundingAmount_pt: 'Totalmente financiado',
      competitionLevel: 'very-high', matchScore: 76, matchType: 'academic-based',
      websiteUrl: 'https://www.tellurideassociation.org/programs/high-school/'
    },

    // COLLEGE
    {
      programName: 'Google Summer of Code',
      organizationName: 'Google',
      description: 'Global program connecting university students with open source organizations for a 12-week paid coding project. Receive mentorship from experienced developers.',
      description_pt: 'Programa global que conecta estudantes universitários a organizações de código aberto para um projeto de programação remunerado de 12 semanas, com mentoria de desenvolvedores experientes.',
      category: 'internship', audience: 'college',
      location: 'Remote (Worldwide)', modality: 'hybrid',
      deadline: new Date(Date.now() + 30 * 864e5).toISOString(),
      eligibility: 'Students 18+ enrolled in a university program',
      eligibility_pt: 'Estudantes com 18+ anos matriculados em curso universitário',
      requirements: ['Proposal', 'GitHub profile', 'Code sample'],
      requirements_pt: ['Proposta de projeto', 'Perfil no GitHub', 'Amostra de código'],
      tags: ['Open Source', 'Coding', 'Remote', 'Paid', 'Google'],
      fundingType: 'paid', fundingAmount: '$3,000–$6,600 depending on country', fundingAmount_pt: '$3.000–$6.600 conforme o país',
      competitionLevel: 'high', matchScore: 91, matchType: 'skill-based',
      websiteUrl: 'https://summerofcode.withgoogle.com/'
    },
    {
      programName: 'World Bank Internship Program',
      organizationName: 'World Bank',
      description: 'Work with teams tackling global poverty, climate change, and development finance in Washington D.C. Rotational assignments across departments.',
      description_pt: 'Trabalhe com equipes que enfrentam pobreza global, mudanças climáticas e finanças de desenvolvimento em Washington D.C. Rotação entre departamentos.',
      category: 'internship', audience: 'college',
      location: 'Washington, DC', modality: 'in-person',
      deadline: new Date(Date.now() + 45 * 864e5).toISOString(),
      eligibility: 'College juniors, seniors, and graduate students',
      eligibility_pt: 'Universitários dos últimos anos e pós-graduandos',
      requirements: ['Resume', 'Transcript', 'Cover letter'],
      requirements_pt: ['Currículo', 'Histórico escolar', 'Carta de apresentação'],
      tags: ['Development', 'Policy', 'Paid', 'International'],
      fundingType: 'paid', fundingAmount: '$2,500/month', fundingAmount_pt: '$2.500/mês',
      competitionLevel: 'high', matchScore: 76, matchType: 'interest-based',
      websiteUrl: 'https://www.worldbank.org/en/about/careers/programs-and-internships'
    },
    {
      programName: 'Rhodes Scholarship',
      organizationName: 'Rhodes Trust',
      description: 'The world\'s oldest and most celebrated international scholarship. Full funding for graduate study at the University of Oxford in any field.',
      description_pt: 'A bolsa internacional mais antiga e celebrada do mundo. Financiamento total para pós-graduação na Universidade de Oxford em qualquer área.',
      category: 'scholarship', audience: 'college',
      location: 'Oxford, UK', modality: 'in-person',
      deadline: new Date(Date.now() + 60 * 864e5).toISOString(),
      eligibility: 'US citizens, under 25, completed or completing undergraduate degree',
      eligibility_pt: 'Cidadãos americanos, com menos de 25 anos, cursando ou concluindo a graduação',
      requirements: ['Academics', 'Leadership record', 'Essays', 'Interviews'],
      requirements_pt: ['Desempenho acadêmico', 'Histórico de liderança', 'Ensaios', 'Entrevistas'],
      tags: ['Oxford', 'Scholarship', 'Full Ride', 'International', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Full tuition + £17,310/year stipend', fundingAmount_pt: 'Mensalidade integral + £17.310/ano de bolsa',
      competitionLevel: 'very-high', matchScore: 68, matchType: 'academic-based',
      websiteUrl: 'https://www.rhodeshouse.ox.ac.uk/'
    },
    {
      programName: 'NSF REU — Research for Undergrads',
      organizationName: 'National Science Foundation',
      description: 'Paid summer research experiences at universities across the US. Join a lab, work on cutting-edge research in STEM fields, present your findings at a symposium.',
      description_pt: 'Experiências pagas de pesquisa de verão em universidades dos EUA. Ingresse em um laboratório, trabalhe em pesquisas de ponta em áreas STEM e apresente suas descobertas em um simpósio.',
      category: 'fellowship', audience: 'college',
      location: '700+ sites nationwide', modality: 'in-person',
      deadline: new Date(Date.now() + 20 * 864e5).toISOString(),
      eligibility: 'Undergrad students (US citizens/PR), any STEM major',
      eligibility_pt: 'Estudantes de graduação (cidadãos americanos/residentes permanentes), qualquer especialização STEM',
      requirements: ['Research statement', 'Transcript', 'Two recommendations'],
      requirements_pt: ['Declaração de pesquisa', 'Histórico escolar', 'Duas cartas de recomendação'],
      tags: ['Research', 'STEM', 'Paid', 'Lab Work', 'Government'],
      fundingType: 'paid', fundingAmount: '$600/week + housing', fundingAmount_pt: '$600/semana + moradia',
      competitionLevel: 'medium', matchScore: 88, matchType: 'skill-based',
      websiteUrl: 'https://www.nsf.gov/crssprgm/reu/'
    },
    {
      programName: 'Fulbright U.S. Student Program',
      organizationName: 'U.S. Department of State',
      description: 'Study, research, or teach English abroad in 140+ countries. One of the most prestigious US government fellowships for graduating seniors and grad students.',
      description_pt: 'Estude, pesquise ou ensine inglês no exterior em mais de 140 países. Uma das bolsas do governo americano mais prestigiosas para formandos e pós-graduandos.',
      category: 'fellowship', audience: 'college',
      location: '140+ countries worldwide', modality: 'in-person',
      deadline: new Date(Date.now() + 50 * 864e5).toISOString(),
      eligibility: 'Graduating seniors and graduate students (US citizens)',
      eligibility_pt: 'Formandos e pós-graduandos (cidadãos americanos)',
      requirements: ['Project proposal', 'Language proficiency', 'Transcript', 'Recommendations'],
      requirements_pt: ['Proposta de projeto', 'Proficiência em idiomas', 'Histórico escolar', 'Cartas de recomendação'],
      tags: ['International', 'Scholarship', 'Research', 'Cultural Exchange', 'Prestigious'],
      fundingType: 'full-scholarship', fundingAmount: 'Full living stipend + travel grant', fundingAmount_pt: 'Bolsa de manutenção integral + auxílio de viagem',
      competitionLevel: 'very-high', matchScore: 73, matchType: 'interest-based',
      websiteUrl: 'https://us.fulbrightonline.org/'
    },
    {
      programName: 'HubSpot Marketing Internship',
      organizationName: 'HubSpot',
      description: 'Paid summer internship on HubSpot\'s marketing team. Work on real campaigns, content strategy, SEO, and growth projects with mentorship from senior marketers.',
      description_pt: 'Estágio de verão remunerado na equipe de marketing da HubSpot. Trabalhe em campanhas reais, estratégia de conteúdo, SEO e projetos de crescimento com mentoria de gerentes sênior.',
      category: 'internship', audience: 'college',
      location: 'Cambridge, MA (Hybrid)', modality: 'hybrid',
      deadline: new Date(Date.now() + 35 * 864e5).toISOString(),
      eligibility: 'Rising juniors and seniors studying Marketing, Comms, or related',
      eligibility_pt: 'Universitários dos últimos anos estudando Marketing, Comunicação ou áreas afins',
      requirements: ['Resume', 'Cover letter', 'Portfolio or writing samples'],
      requirements_pt: ['Currículo', 'Carta de apresentação', 'Portfólio ou amostras de escrita'],
      tags: ['Marketing', 'Tech', 'Paid', 'Hybrid', 'Growth'],
      fundingType: 'paid', fundingAmount: '$25/hour', fundingAmount_pt: '$25/hora',
      competitionLevel: 'medium', matchScore: 79, matchType: 'skill-based',
      websiteUrl: 'https://www.hubspot.com/careers/jobs'
    },
    {
      programName: 'Knight-Hennessy Scholars',
      organizationName: 'Stanford University',
      description: 'Full graduate funding at Stanford for purpose-driven leaders. One of the largest fully-endowed fellowships in the world. Includes a leadership development program.',
      description_pt: 'Financiamento completo da pós-graduação em Stanford para líderes com propósito. Uma das bolsas com maior dotação do mundo. Inclui programa de desenvolvimento de liderança.',
      category: 'scholarship', audience: 'college',
      location: 'Stanford, CA', modality: 'in-person',
      deadline: new Date(Date.now() + 65 * 864e5).toISOString(),
      eligibility: 'Graduating seniors applying to Stanford graduate programs',
      eligibility_pt: 'Formandos se candidatando a programas de pós-graduação em Stanford',
      requirements: ['Stanford graduate application', 'Short video', 'Essays', 'Recommendations'],
      requirements_pt: ['Candidatura de pós-graduação em Stanford', 'Vídeo curto', 'Ensaios', 'Cartas de recomendação'],
      tags: ['Stanford', 'Full Ride', 'Leadership', 'Prestigious', 'Graduate'],
      fundingType: 'full-scholarship', fundingAmount: 'Full tuition + $80k/year', fundingAmount_pt: 'Mensalidade integral + $80k/ano',
      competitionLevel: 'very-high', matchScore: 65, matchType: 'leadership-focused',
      websiteUrl: 'https://knight-hennessy.stanford.edu/'
    },
    {
      programName: 'NASA Internship Program',
      organizationName: 'NASA',
      description: 'Work on space exploration, aeronautics, and earth science research alongside NASA scientists and engineers at facilities across the US.',
      description_pt: 'Trabalhe em exploração espacial, aeronáutica e pesquisa em ciências da Terra ao lado de cientistas e engenheiros da NASA em instalações por todo os EUA.',
      category: 'internship', audience: 'college',
      location: 'Multiple NASA Centers (CA, TX, FL, VA...)', modality: 'in-person',
      deadline: new Date(Date.now() + 28 * 864e5).toISOString(),
      eligibility: 'US citizens, GPA 3.0+, STEM majors preferred',
      eligibility_pt: 'Cidadãos americanos, média 3.0+, preferencialmente formações STEM',
      requirements: ['Resume', 'Transcript', 'Reference letter'],
      requirements_pt: ['Currículo', 'Histórico escolar', 'Carta de referência'],
      tags: ['Space', 'STEM', 'Government', 'Paid', 'Engineering'],
      fundingType: 'paid', fundingAmount: '$18–$22/hour', fundingAmount_pt: '$18–$22/hora',
      competitionLevel: 'high', matchScore: 84, matchType: 'skill-based',
      websiteUrl: 'https://intern.nasa.gov/'
    },
    {
      programName: 'MLT MBA Prep Fellowship',
      organizationName: 'Management Leadership for Tomorrow',
      description: 'Year-long career accelerator for underrepresented college students pursuing business careers. Coaching, mentorship, and access to 70+ Fortune 500 partners.',
      description_pt: 'Acelerador de carreira de um ano para estudantes universitários sub-representados que buscam carreiras em negócios. Coaching, mentoria e acesso a 70+ parceiros da Fortune 500.',
      category: 'fellowship', audience: 'college',
      location: 'Remote + Annual Summit', modality: 'hybrid',
      deadline: new Date(Date.now() + 42 * 864e5).toISOString(),
      eligibility: 'College sophomores and juniors from underrepresented backgrounds',
      eligibility_pt: 'Universitários do 2º e 3º ano de grupos sub-representados',
      requirements: ['Resume', 'Essays', 'Transcript'],
      requirements_pt: ['Currículo', 'Ensaios', 'Histórico escolar'],
      tags: ['Business', 'Diversity', 'Mentorship', 'Career', 'Free'],
      fundingType: 'full-scholarship', fundingAmount: 'Free + career services', fundingAmount_pt: 'Gratuito + serviços de carreira',
      competitionLevel: 'medium', matchScore: 71, matchType: 'leadership-focused',
      websiteUrl: 'https://www.mlt.org/career-programs/mlt-mba-prep/'
    },
  ];

  opps.forEach(o => db.opportunities.push({ id: uuidv4(), ...o }));

  // ── Badges ─────────────────────────────────────────────
  const badges = [
    { name: 'First Match', description: 'Found your first opportunity match!', icon: '🎯', rarity: 'common', xpReward: 10 },
    { name: 'Scholarship Hunter', description: 'Saved 5 scholarship opportunities', icon: '💰', rarity: 'uncommon', xpReward: 50 },
    { name: 'Application Starter', description: 'Started your first application quest', icon: '✍️', rarity: 'uncommon', xpReward: 50 },
    { name: 'Global Explorer', description: 'Saved opportunities in 5 different countries', icon: '🌍', rarity: 'rare', xpReward: 100 },
    { name: 'Deadline Slayer', description: 'Completed an application with 1 day left', icon: '⚡', rarity: 'rare', xpReward: 150 },
    { name: 'Scholarship Winner', description: 'Received a scholarship — you made it!', icon: '🏆', rarity: 'legendary', xpReward: 500 },
    { name: 'Swipe Master', description: 'Swiped on 50 opportunities', icon: '🃏', rarity: 'uncommon', xpReward: 75 },
    { name: 'Quest Finisher', description: 'Completed all tasks in an application quest', icon: '🏁', rarity: 'rare', xpReward: 200 },
    { name: 'On a Roll', description: 'Maintained a 7-day streak', icon: '🔥', rarity: 'uncommon', xpReward: 100 },
  ];

  const badgeIds = {};
  badges.forEach(b => {
    const id = uuidv4();
    badgeIds[b.name] = id;
    db.badges.push({ id, ...b });
  });

  // ── User Badges (Laura) ─────────────────────────────────
  [
    { name: 'First Match', locked: false, progress: 100, date: 20 },
    { name: 'Application Starter', locked: false, progress: 100, date: 10 },
    { name: 'Scholarship Hunter', locked: true, progress: 20 },
    { name: 'Swipe Master', locked: true, progress: 60 },
  ].forEach(({ name, locked, progress, date }) => {
    db.userBadges.push({
      id: uuidv4(), userId: user1Id, badgeId: badgeIds[name],
      isLocked: locked, progress,
      unlockedDate: locked ? null : new Date(Date.now() - date * 864e5).toISOString()
    });
  });

  // ── User Badges (Alex) ──────────────────────────────────
  [
    { name: 'First Match', locked: false, progress: 100, date: 50 },
    { name: 'Scholarship Hunter', locked: false, progress: 100, date: 40 },
    { name: 'Application Starter', locked: false, progress: 100, date: 35 },
    { name: 'Deadline Slayer', locked: false, progress: 100, date: 5 },
    { name: 'Swipe Master', locked: false, progress: 100, date: 15 },
    { name: 'On a Roll', locked: true, progress: 85 },
  ].forEach(({ name, locked, progress, date }) => {
    db.userBadges.push({
      id: uuidv4(), userId: user2Id, badgeId: badgeIds[name],
      isLocked: locked, progress,
      unlockedDate: locked ? null : new Date(Date.now() - date * 864e5).toISOString()
    });
  });

  // ── Subscription Plans ──────────────────────────────────
  db.subscriptionPlans.push({
    id: uuidv4(), userId: user1Id, planType: 'explorer',
    swipesPerMonth: 30, savedOpportunities: 5, activeQuests: 1,
    features: ['Interest Match', 'Basic alerts'],
    createdAt: new Date(Date.now() - 30 * 864e5).toISOString()
  });

  db.subscriptionPlans.push({
    id: uuidv4(), userId: user2Id, planType: 'applicant',
    swipesPerMonth: 99999, savedOpportunities: 99999, activeQuests: 99999,
    features: ['Personalized Match', 'Full checklists', 'Priority support'],
    createdAt: new Date(Date.now() - 60 * 864e5).toISOString()
  });

  fs.writeFileSync(
    path.join(__dirname, '../../data/db.json'),
    JSON.stringify(db, null, 2)
  );

  console.log('✅ Database seeded successfully!\n');
  console.log('📊 Data Summary:');
  console.log(`  • Users: ${db.users.length}`);
  console.log(`  • Opportunities: ${db.opportunities.length}`);
  console.log(`  • Badges: ${db.badges.length}`);
  console.log(`  • Subscription Plans: ${db.subscriptionPlans.length}\n`);
  console.log('👥 Test Accounts:');
  console.log('  Laura (High School): laura@example.com / password123');
  console.log('  Alex (College): alex@example.com / password123\n');
}

seedDatabase().catch(console.error);
