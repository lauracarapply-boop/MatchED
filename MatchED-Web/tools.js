/* ════════════════════════════════════════════════════════════════════
   MatchED — website tools (loaded before the main script in index.html)

   Public pages (no login): Home, "Isso vale pra mim?", Explorar, Impacto,
   Glossário. Plus: opportunity detail sheet with eligibility flags, calendar,
   sharing and problem reports; Brazilian onboarding; admin tabs for reports,
   partner schools and impact.

   Functions here use globals defined later by the main script (T, req, api,
   state, router, toast, lang). They are only called after everything loads.
   ════════════════════════════════════════════════════════════════════ */

/* ── Safe HTML ─────────────────────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tidyText(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

/* ── Strings for the new features (pt + en; other languages fall back to en) ── */
const NS = {
  pt: {
    nav: { explore: 'Explorar', check: 'Isso vale pra mim?', impact: 'Impacto', glossary: 'Glossário', login: 'Entrar', signup: 'Criar conta', results: 'Resultados' },
    home: {
      kicker: 'Gratuito para estudantes',
      title: 'Bolsas, programas e competições que <span>valem pra você</span>.',
      sub: 'Responda 7 perguntas rápidas e veja só as oportunidades para as quais você pode se candidatar — com prazo, requisitos em português e um plano passo a passo.',
      ctaCheck: 'Isso vale pra mim? →', ctaExplore: 'Explorar todas',
      noSignup: 'Sem cadastro para testar.',
      statsTitle: 'O que já existe no MatchED',
      statOpps: 'oportunidades verificadas', statFunded: 'com bolsa ou gratuitas', statSources: 'fontes acompanhadas', statChecks: 'consultas “isso vale pra mim?”',
      howTitle: 'Como funciona',
      how1t: 'Conte quem você é', how1: 'Ano escolar, estado, tipo de escola e interesses. Leva 1 minuto.',
      how2t: 'Veja o que vale pra você', how2: 'Escondemos o que exige cidadania americana e mostramos o que é financiado, gratuito ou feito para brasileiros.',
      how3t: 'Siga um plano até enviar', how3: 'Cada candidatura vira um checklist com datas e lembretes antes do prazo.',
      schoolsTitle: 'Para escolas e grêmios',
      schools: 'Quer levar o MatchED para sua escola? Criamos um link e um QR Code só da sua escola, e você acompanha quantos alunos usaram — sem dados pessoais.',
      schoolsCta: 'Falar com a equipe',
      honest: 'Os números desta página vêm direto do banco de dados e são atualizados automaticamente.',
      disclaimer: 'O MatchED não tem vínculo com as oportunidades divulgadas. Confira sempre o site oficial.',
      partnerBanner: (n) => `Você chegou pelo convite de <strong>${n}</strong>. Bem-vindo(a)!`,
    },
    check: {
      title: 'Isso vale pra mim?', sub: 'Responda e veja as oportunidades que combinam com você. Nada fica salvo.',
      step: (i, n) => `Pergunta ${i} de ${n}`, next: 'Continuar', back: 'Voltar', see: 'Ver minhas oportunidades',
      q1: 'Em que etapa você está?', q2: 'Que tipo de escola?', q3: 'Em que estado você mora?', q4: 'Em que ano você nasceu?',
      q5: 'Como está seu inglês?', q6: 'O que você mais quer?', q7: 'Quais assuntos te interessam?', pickAny: 'Escolha quantos quiser.',
      needsFunding: 'Só consigo participar se for gratuito ou com bolsa',
      results: (n) => n === 0 ? 'Ainda não achamos nada aberto para esse perfil.' : `Encontramos ${n} oportunidade${n === 1 ? '' : 's'} para você`,
      resultsSub: 'Ordenadas pelo quanto combinam com você. Toque para ver requisitos e prazo.',
      saveCta: 'Criar conta grátis para salvar e receber lembretes', again: 'Refazer', exploreAll: 'Ver todas no Explorar',
      countFunded: 'financiadas ou gratuitas', countBrazil: 'feitas para brasileiros', countSoon: 'fecham em 30 dias',
    },
    explore: {
      title: 'Explorar oportunidades', sub: 'Todas as oportunidades verificadas. Filtre pelo que importa pra você.',
      search: 'Buscar por nome, área, organização…', level: 'Etapa', levelAll: 'Todas', levelHS: 'Ensino médio', levelCol: 'Faculdade',
      funded: '💰 Com bolsa/gratuita', noFee: 'Sem taxa', brazil: '🇧🇷 Para brasileiros', publicSchool: '🏫 Escola pública', open: 'Prazo aberto', usOnly: 'Mostrar também as só para residentes dos EUA',
      sort: 'Ordenar', sortDeadline: 'Prazo mais próximo', sortMatch: 'Mais combina comigo', sortRecent: 'Mais recentes',
      count: (n) => `${n} oportunidade${n === 1 ? '' : 's'}`, more: 'Carregar mais', none: 'Nada encontrado com esses filtros.',
      hiddenUS: (n) => `${n} oportunidade${n === 1 ? '' : 's'} só para residentes dos EUA escondida${n === 1 ? '' : 's'}.`,
    },
    cats: { all: 'Todas', scholarship: 'Bolsas', 'summer-program': 'Programas de verão', competition: 'Competições', fellowship: 'Fellowships', internship: 'Estágios', exchange: 'Intercâmbio', 'research-program': 'Pesquisa', grant: 'Financiamento', job: 'Empregos', conference: 'Conferências' },
    catOne: { scholarship: 'Bolsa', 'summer-program': 'Programa de verão', competition: 'Competição', fellowship: 'Fellowship', internship: 'Estágio', exchange: 'Intercâmbio', 'research-program': 'Pesquisa', grant: 'Financiamento', job: 'Emprego', conference: 'Conferência', workshop: 'Workshop', award: 'Prêmio', 'online-course': 'Curso online', volunteer: 'Voluntariado', 'career-program': 'Carreira', accelerator: 'Aceleradora', mentorship: 'Mentoria' },
    flags: {
      funded: '💰 Bolsa ou gratuita', hasFee: '💳 Tem taxa', brazilFocused: '🇧🇷 Para brasileiros', publicSchoolFriendly: '🏫 Escola pública/baixa renda',
      requiresUSCitizenship: '⛔ Só para cidadãos/residentes dos EUA', requiresUSWorkAuth: '⛔ Exige autorização de trabalho nos EUA', checkNationality: '❓ Confira se aceita estrangeiros',
      englishRequired: '🇬🇧 Pede prova de inglês', age: (a, b) => `🎂 ${a} a ${b} anos`,
    },
    reasons: { eligible: '✅ Você parece elegível', interests: '✨ Seus interesses', goals: '🎯 Seus objetivos', funded: '💰 Financiada', 'public-school': '🏫 Boa para escola pública', brazil: '🇧🇷 Para brasileiros', urgent: '⏰ Prazo próximo', liked: '❤️ Parecida com o que você curtiu' },
    warnings: { level: 'Não é para a sua etapa escolar', 'us-citizenship': 'Exige cidadania/residência nos EUA', 'us-work': 'Exige autorização de trabalho nos EUA', age: 'Fora da faixa de idade', fee: 'Tem taxa de inscrição ou custo', english: 'Pede inglês avançado', closed: 'Prazo deste ciclo já passou — fique de olho no próximo', 'check-nationality': 'Confirme no site se aceita estudantes do Brasil' },
    detail: {
      deadline: 'Prazo', lastDeadline: 'Último prazo conhecido', noDeadline: 'Sem data fixa — confira no site', where: 'Onde', funding: 'Custo/bolsa', eligibility: 'Quem pode',
      about: 'Sobre', why: 'Por que aparece pra você', attention: 'Atenção', terms: 'Termos que podem confundir',
      official: '🔗 Site oficial', calendar: '📅 Adicionar à agenda', gcal: 'Google Agenda', ics: 'Arquivo de agenda (.ics)', share: '💬 Mandar no WhatsApp', report: '⚑ Reportar problema',
      like: '♥ Curtir', save: '🔖 Salvar', plan: '📋 Montar meu plano', loginToSave: 'Crie uma conta grátis para salvar e montar seu plano.',
      reportTitle: 'O que está errado?', reportSent: 'Obrigado! Vamos verificar.', reportReasons: { broken_link: 'Link quebrado', wrong_deadline: 'Prazo errado', not_for_brazilians: 'Não aceita brasileiros', requires_payment: 'É pago/tem taxa', wrong_info: 'Informação errada', other: 'Outro' },
      reportNote: 'Detalhes (opcional)', send: 'Enviar', cancel: 'Cancelar', shareText: (n, u) => `Olha essa oportunidade: ${n} — ${u}`,
    },
    impact: {
      title: 'Impacto do MatchED', sub: 'O que medimos e por quê. Atualizado automaticamente.',
      opps: 'Oportunidades verificadas no ar', funded: 'Financiadas ou gratuitas', sources: 'Fontes acompanhadas pelo robô', students: 'Estudantes cadastrados',
      started: 'Candidaturas iniciadas', submitted: 'Candidaturas enviadas', accepted: 'Aprovações registradas', brl: 'Valor em bolsas registrado',
      publicShare: 'De escola pública', checks: 'Consultas “isso vale pra mim?”', notYet: 'ainda sem dados suficientes',
      method: 'Como medimos', methodText: 'Candidaturas e aprovações são registradas pelos próprios estudantes no app (abas Quests e Resultados). O percentual de escola pública só aparece quando há pelo menos 20 perfis com essa informação, para proteger a privacidade. Não publicamos dados individuais.',
    },
    glossary: { title: 'Glossário', sub: 'Termos que aparecem em editais de bolsas e programas, explicados em português.', search: 'Buscar termo…' },
    onboarding: {
      title: 'Conte um pouco sobre você', sub: 'Isso define quais oportunidades você vê. Dá para mudar depois.',
      grade: 'Ano escolar', school: 'Nome da escola (opcional)', schoolType: 'Tipo de escola', state: 'Estado', birthYear: 'Ano de nascimento', english: 'Seu nível de inglês',
      goals: 'O que você quer?', interests: 'Interesses', needsFunding: 'Só consigo participar se for gratuito ou com bolsa', save: 'Ver minhas oportunidades 🚀', skip: 'Pular por agora', saved: 'Perfil salvo!',
      uni: 'Universidade', major: 'Curso', grad: 'Ano de formatura',
    },
    grades: { ef8: '8º ano (fundamental)', ef9: '9º ano (fundamental)', em1: '1º ano do ensino médio', em2: '2º ano do ensino médio', em3: '3º ano do ensino médio', tecnico: 'Ensino técnico/integrado', concluido: 'Já terminei o ensino médio' },
    schoolTypes: { publica_estadual: 'Pública estadual', publica_municipal: 'Pública municipal', publica_federal: 'Federal (IF, CEFET, Colégio Militar…)', particular_bolsista: 'Particular com bolsa', particular: 'Particular' },
    english: { none: 'Não falo', basic: 'Básico', intermediate: 'Intermediário', advanced: 'Avançado/fluente' },
    goals: { 'get-scholarship': 'Ganhar uma bolsa', 'study-abroad': 'Estudar fora', 'summer-program': 'Programa de verão', 'win-competition': 'Competições/olimpíadas', 'do-research': 'Fazer pesquisa', 'get-internship': 'Estágio/primeiro emprego' },
    interests: { leadership: 'Liderança', research: 'Pesquisa', technology: 'Tecnologia', business: 'Negócios', science: 'Ciências', arts: 'Artes', policy: 'Políticas públicas', engineering: 'Engenharia', medicine: 'Saúde/Medicina', law: 'Direito', environment: 'Meio ambiente', 'social-impact': 'Impacto social', entrepreneurship: 'Empreendedorismo', mathematics: 'Matemática', international: 'Relações internacionais' },
    deadlines: { exportAll: '📅 Baixar todos para a agenda', gcal: 'Google Agenda', didApply: 'Você enviou?', yes: 'Enviei', no: 'Não enviei', recorded: 'Registrado, obrigado!', emailOn: 'Lembretes por e-mail: ligados', emailOff: 'Lembretes por e-mail: desligados' },
    quests: { due: (d) => `até ${d}`, overdue: 'atrasada', undo: 'Desmarcar', results: '📊 Ver meus resultados' },
    profile: { matching: '🎯 Editar perfil de matching', reminders: 'Lembretes de prazo por e-mail', results: '📊 Meus resultados' },
    admin: { reports: 'Reportes', partners: 'Escolas parceiras', impact: 'Impacto', noReports: 'Nenhum reporte aberto.', resolve: 'Resolvido', dismiss: 'Ignorar', open: 'Abrir oportunidade',
      newPartner: 'Nova escola/organização', name: 'Nome', city: 'Cidade', type: 'Tipo', create: 'Criar link', link: 'Link de convite', qr: 'QR Code', copy: 'Copiar link', copied: 'Copiado!',
      signups: 'cadastros', checks: 'consultas', started: 'candidaturas', funnel: 'Funil', types: { escola: 'Escola', gremio: 'Grêmio', organizacao: 'Organização' } },
    tasks: {
      'Check Eligibility': 'Conferir elegibilidade', 'Gather Documents': 'Separar documentos', 'Get Recommendations': 'Pedir carta de recomendação', 'Write Essay': 'Escrever a redação/essay',
      'Review Application': 'Revisar tudo', 'Submit Application': 'Enviar candidatura', 'Track Results': 'Registrar resultado', 'Check Costs & Aid': 'Ver custos e pedir bolsa/isenção',
      'English Test': 'Prova de inglês', 'Read Rules': 'Ler o regulamento', 'Register': 'Fazer a inscrição', 'Prepare': 'Preparar', 'Update Resume': 'Atualizar currículo',
      'Write Cover Letter': 'Carta de apresentação', 'Interview Prep': 'Preparar entrevista',
    },
  },
  en: {
    nav: { explore: 'Explore', check: 'Is this for me?', impact: 'Impact', glossary: 'Glossary', login: 'Log in', signup: 'Sign up', results: 'Results' },
    home: {
      kicker: 'Free for students', title: 'Scholarships, programs and competitions <span>that fit you</span>.',
      sub: 'Answer 7 quick questions and see only the opportunities you can apply to — with deadline, requirements explained and a step-by-step plan.',
      ctaCheck: 'Is this for me? →', ctaExplore: 'Explore all', noSignup: 'No sign-up needed to try.',
      statsTitle: 'What MatchED has today', statOpps: 'verified opportunities', statFunded: 'funded or free', statSources: 'sources monitored', statChecks: '“is this for me?” checks',
      howTitle: 'How it works', how1t: 'Tell us who you are', how1: 'School year, state, school type and interests. Takes a minute.',
      how2t: 'See what fits', how2: 'We hide what requires US citizenship and highlight what is funded, free or made for Brazilians.',
      how3t: 'Follow a plan until you apply', how3: 'Each application becomes a dated checklist with reminders before the deadline.',
      schoolsTitle: 'For schools and student unions', schools: 'Bring MatchED to your school: we create a link and QR code just for your school and you see how many students used it — no personal data.',
      schoolsCta: 'Talk to the team', honest: 'The numbers on this page come straight from the database.',
      disclaimer: 'MatchED is not affiliated with the opportunities listed. Always check the official website.', partnerBanner: (n) => `You were invited by <strong>${n}</strong>. Welcome!`,
    },
    check: {
      title: 'Is this for me?', sub: 'Answer and see the opportunities that fit you. Nothing is saved.', step: (i, n) => `Question ${i} of ${n}`, next: 'Continue', back: 'Back', see: 'See my opportunities',
      q1: 'Where are you in school?', q2: 'What kind of school?', q3: 'Which state do you live in?', q4: 'What year were you born?', q5: 'How is your English?', q6: 'What do you want most?', q7: 'Which topics interest you?', pickAny: 'Pick as many as you like.',
      needsFunding: 'I can only take part if it is free or funded',
      results: (n) => n === 0 ? 'Nothing open for this profile yet.' : `We found ${n} opportunit${n === 1 ? 'y' : 'ies'} for you`, resultsSub: 'Sorted by fit. Tap to see requirements and deadline.',
      saveCta: 'Create a free account to save and get reminders', again: 'Start over', exploreAll: 'See all in Explore', countFunded: 'funded or free', countBrazil: 'made for Brazilians', countSoon: 'close within 30 days',
    },
    explore: {
      title: 'Explore opportunities', sub: 'Every verified opportunity. Filter by what matters to you.', search: 'Search by name, field, organization…', level: 'Level', levelAll: 'All', levelHS: 'High school', levelCol: 'College',
      funded: '💰 Funded/free', noFee: 'No fee', brazil: '🇧🇷 For Brazilians', publicSchool: '🏫 Public school', open: 'Open deadline', usOnly: 'Also show US-residents-only',
      sort: 'Sort', sortDeadline: 'Closest deadline', sortMatch: 'Best match', sortRecent: 'Most recent', count: (n) => `${n} opportunit${n === 1 ? 'y' : 'ies'}`, more: 'Load more', none: 'Nothing matches these filters.',
      hiddenUS: (n) => `${n} US-residents-only opportunit${n === 1 ? 'y' : 'ies'} hidden.`,
    },
    cats: { all: 'All', scholarship: 'Scholarships', 'summer-program': 'Summer programs', competition: 'Competitions', fellowship: 'Fellowships', internship: 'Internships', exchange: 'Exchange', 'research-program': 'Research', grant: 'Grants', job: 'Jobs', conference: 'Conferences' },
    catOne: { scholarship: 'Scholarship', 'summer-program': 'Summer program', competition: 'Competition', fellowship: 'Fellowship', internship: 'Internship', exchange: 'Exchange', 'research-program': 'Research', grant: 'Grant', job: 'Job', conference: 'Conference', workshop: 'Workshop', award: 'Award', 'online-course': 'Online course', volunteer: 'Volunteering', 'career-program': 'Career', accelerator: 'Accelerator', mentorship: 'Mentorship' },
    flags: { funded: '💰 Funded or free', hasFee: '💳 Has a fee', brazilFocused: '🇧🇷 For Brazilians', publicSchoolFriendly: '🏫 Public school/low income', requiresUSCitizenship: '⛔ US citizens/residents only', requiresUSWorkAuth: '⛔ Needs US work authorization', checkNationality: '❓ Check if international students can apply', englishRequired: '🇬🇧 English test required', age: (a, b) => `🎂 Ages ${a}–${b}` },
    reasons: { eligible: '✅ You seem eligible', interests: '✨ Your interests', goals: '🎯 Your goals', funded: '💰 Funded', 'public-school': '🏫 Good for public school', brazil: '🇧🇷 For Brazilians', urgent: '⏰ Deadline soon', liked: '❤️ Like ones you liked' },
    warnings: { level: 'Not for your school level', 'us-citizenship': 'Requires US citizenship/residency', 'us-work': 'Requires US work authorization', age: 'Outside the age range', fee: 'Has an application fee or cost', english: 'Requires advanced English', closed: 'This cycle closed — watch for the next one', 'check-nationality': 'Check on the website whether students from Brazil can apply' },
    detail: { deadline: 'Deadline', lastDeadline: 'Last known deadline', noDeadline: 'No fixed date — check the website', where: 'Where', funding: 'Cost/funding', eligibility: 'Who can apply', about: 'About', why: 'Why you see this', attention: 'Heads up', terms: 'Terms that may confuse',
      official: '🔗 Official website', calendar: '📅 Add to calendar', gcal: 'Google Calendar', ics: 'Calendar file (.ics)', share: '💬 Send on WhatsApp', report: '⚑ Report a problem', like: '♥ Like', save: '🔖 Save', plan: '📋 Build my plan', loginToSave: 'Create a free account to save and build your plan.',
      reportTitle: 'What is wrong?', reportSent: 'Thanks! We will check.', reportReasons: { broken_link: 'Broken link', wrong_deadline: 'Wrong deadline', not_for_brazilians: 'Not open to Brazilians', requires_payment: 'Paid/has fee', wrong_info: 'Wrong information', other: 'Other' }, reportNote: 'Details (optional)', send: 'Send', cancel: 'Cancel', shareText: (n, u) => `Check this opportunity: ${n} — ${u}` },
    impact: { title: 'MatchED impact', sub: 'What we measure and why. Updated automatically.', opps: 'Verified opportunities live', funded: 'Funded or free', sources: 'Sources monitored by the bot', students: 'Registered students', started: 'Applications started', submitted: 'Applications submitted', accepted: 'Acceptances recorded', brl: 'Scholarship value recorded', publicShare: 'From public schools', checks: '“Is this for me?” checks', notYet: 'not enough data yet', method: 'How we measure', methodText: 'Applications and acceptances are recorded by students themselves in the app (Quests and Results). The public-school share is shown only once at least 20 profiles include it, to protect privacy. We never publish individual data.' },
    glossary: { title: 'Glossary', sub: 'Terms used in scholarship and program calls, explained.', search: 'Search a term…' },
    onboarding: { title: 'Tell us about you', sub: 'This decides which opportunities you see. You can change it later.', grade: 'School year', school: 'School name (optional)', schoolType: 'School type', state: 'State', birthYear: 'Year of birth', english: 'Your English level', goals: 'What do you want?', interests: 'Interests', needsFunding: 'I can only take part if it is free or funded', save: 'See my opportunities 🚀', skip: 'Skip for now', saved: 'Profile saved!', uni: 'University', major: 'Major', grad: 'Graduation year' },
    grades: { ef8: '8th grade', ef9: '9th grade', em1: 'High school year 1', em2: 'High school year 2', em3: 'High school year 3', tecnico: 'Technical/integrated school', concluido: 'Finished high school' },
    schoolTypes: { publica_estadual: 'Public (state)', publica_municipal: 'Public (city)', publica_federal: 'Federal (IF, CEFET…)', particular_bolsista: 'Private with scholarship', particular: 'Private' },
    english: { none: 'None', basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced/fluent' },
    goals: { 'get-scholarship': 'Win a scholarship', 'study-abroad': 'Study abroad', 'summer-program': 'Summer program', 'win-competition': 'Competitions/olympiads', 'do-research': 'Do research', 'get-internship': 'Internship/first job' },
    interests: { leadership: 'Leadership', research: 'Research', technology: 'Technology', business: 'Business', science: 'Science', arts: 'Arts', policy: 'Public policy', engineering: 'Engineering', medicine: 'Health/Medicine', law: 'Law', environment: 'Environment', 'social-impact': 'Social impact', entrepreneurship: 'Entrepreneurship', mathematics: 'Mathematics', international: 'International relations' },
    deadlines: { exportAll: '📅 Download all to calendar', gcal: 'Google Calendar', didApply: 'Did you apply?', yes: 'I applied', no: "I didn't", recorded: 'Recorded, thanks!', emailOn: 'E-mail reminders: on', emailOff: 'E-mail reminders: off' },
    quests: { due: (d) => `by ${d}`, overdue: 'overdue', undo: 'Undo', results: '📊 See my results' },
    profile: { matching: '🎯 Edit matching profile', reminders: 'Deadline reminders by e-mail', results: '📊 My results' },
    admin: { reports: 'Reports', partners: 'Partner schools', impact: 'Impact', noReports: 'No open reports.', resolve: 'Resolved', dismiss: 'Dismiss', open: 'Open opportunity', newPartner: 'New school/organization', name: 'Name', city: 'City', type: 'Type', create: 'Create link', link: 'Invite link', qr: 'QR code', copy: 'Copy link', copied: 'Copied!', signups: 'sign-ups', checks: 'checks', started: 'applications', funnel: 'Funnel', types: { escola: 'School', gremio: 'Student union', organizacao: 'Organization' } },
    tasks: {},
  },
};
const BR_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const INTEREST_KEYS = ['leadership', 'research', 'technology', 'business', 'science', 'arts', 'policy', 'engineering', 'medicine', 'law', 'environment', 'social-impact', 'entrepreneurship', 'mathematics', 'international'];

function N() { return NS[(typeof lang !== 'undefined' && lang.current) || 'pt'] || NS.en; }
function catName(c) { return (N().catOne || {})[c] || (NS.en.catOne[c]) || c || ''; }
function locale() { return (lang.current === 'en' ? 'en-US' : lang.current === 'es' ? 'es' : lang.current === 'fr' ? 'fr' : 'pt-BR'); }
function fmtDate(d, opts) { try { return new Date(d).toLocaleDateString(locale(), opts || { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch { return ''; } }

/* ── Calendar & sharing ────────────────────────────────────────────── */
function icsDate(d) { return new Date(d).toISOString().slice(0, 10).replace(/-/g, ''); }
function buildIcs(items) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MatchED//Prazos//PT', 'CALSCALE:GREGORIAN'];
  items.filter(i => i.deadline).forEach(i => {
    const day = icsDate(i.deadline);
    const next = icsDate(new Date(new Date(i.deadline).getTime() + 86400000));
    const clean = s => String(s || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, ' ');
    lines.push('BEGIN:VEVENT', `UID:${i.id || i.opportunityId}@matched`, `DTSTAMP:${icsDate(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${clean('Prazo: ' + (i.programName || ''))}`,
      `DESCRIPTION:${clean((i.websiteUrl || '') + ' — via MatchED')}`,
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Prazo em 7 dias', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', 'DESCRIPTION:Prazo em 2 dias', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadIcs(items, name) {
  const blob = new Blob([buildIcs(items)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (name || 'matched-prazos') + '.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function gcalLink(o) {
  const day = icsDate(o.deadline);
  const next = icsDate(new Date(new Date(o.deadline).getTime() + 86400000));
  const p = new URLSearchParams({ action: 'TEMPLATE', text: 'Prazo: ' + (o.programName || ''), dates: `${day}/${next}`, details: (safeUrl(o.websiteUrl) || '') + ' — via MatchED' });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function oppShareUrl(o) { return `${location.origin}/#/o/${encodeURIComponent(o.id)}`; }
function whatsappLink(o) { return 'https://wa.me/?text=' + encodeURIComponent(N().detail.shareText(o.programName, oppShareUrl(o))); }

/* ── Glossary ──────────────────────────────────────────────────────── */
const GLOSSARY = [
  ['Essay / Personal statement', 'Redação pessoal. Um texto contando quem você é, sua história e por que quer a oportunidade. Não é redação do ENEM: é em primeira pessoa e pode (e deve) ser pessoal.', /essays?|personal statement|redaç/i],
  ['Recommendation letter (LOR)', 'Carta de recomendação: um professor ou orientador escreve sobre você. Peça com pelo menos 3 semanas de antecedência e mande um resumo do que você fez.', /recommendation|\bLOR\b|carta de recomenda/i],
  ['Transcript', 'Histórico escolar: suas notas oficiais. Peça na secretaria da escola; às vezes precisa de tradução para o inglês.', /transcript|histórico/i],
  ['GPA', 'Média das notas no sistema americano (0 a 4). Para notas de 0 a 10, uma conversão aproximada é dividir por 2,5 — mas confira se o programa aceita notas brasileiras.', /\bGPA\b/],
  ['Fee waiver', 'Isenção da taxa de inscrição. Muitos programas dão para quem não pode pagar — geralmente basta pedir por e-mail explicando sua situação.', /fee waiver|isenção/i],
  ['Need-based', 'Bolsa baseada na necessidade financeira da família (não só em notas).', /need[- ]based/i],
  ['Merit-based', 'Bolsa baseada em mérito: notas, prêmios, conquistas.', /merit/i],
  ['Full ride / Fully funded', 'Bolsa integral: cobre estudos e, em geral, moradia, alimentação e às vezes passagem. Confira o que está incluso.', /full ride|fully funded|bolsa integral/i],
  ['Stipend', 'Ajuda de custo em dinheiro paga durante o programa ou estágio.', /stipend/i],
  ['TOEFL / IELTS / Duolingo English Test', 'Provas que comprovam seu inglês. O Duolingo English Test costuma ser o mais barato e é feito online.', /toefl|ielts|duolingo/i],
  ['Rolling admissions', 'Inscrições analisadas por ordem de chegada até as vagas acabarem: quanto antes você enviar, melhor.', /rolling/i],
  ['Early / Regular deadline', 'Prazo antecipado e prazo normal. Enviar no antecipado pode aumentar as chances ou garantir bolsa.', /early (deadline|action|decision)|regular deadline/i],
  ['Eligibility', 'Elegibilidade: quem pode se candidatar (idade, ano escolar, nacionalidade, notas).', /eligib/i],
  ['U.S. citizen / Permanent resident', 'Cidadão americano ou residente permanente (green card). Se o edital exige isso, estudantes brasileiros não podem participar.', /citizen|permanent resident|green card/i],
  ['International student', 'Estudante estrangeiro — é o seu caso se você mora no Brasil.', /international student/i],
  ['Pre-college / Summer program', 'Programa de verão (julho–agosto nos EUA/Europa) para alunos do ensino médio, em universidades. Muitos são pagos; procure os gratuitos ou com bolsa.', /pre[- ]college|summer program|summer school/i],
  ['Fellowship', 'Programa com bolsa para desenvolver um projeto, pesquisa ou liderança, geralmente com mentoria.', /fellowship/i],
  ['Résumé / CV', 'Currículo: uma página com estudos, atividades, prêmios e habilidades.', /r[ée]sum[ée]|\bCV\b|currículo/i],
  ['Extracurricular activities', 'Atividades fora da sala de aula: projetos, voluntariado, olimpíadas, esportes, trabalho. Contam muito em processos seletivos.', /extracurricular/i],
  ['Portfolio', 'Conjunto de trabalhos que mostram o que você faz (artes, design, programação, escrita).', /portfolio|portfólio/i],
  ['Interview', 'Entrevista (geralmente online). Treine contar sua história em 2 minutos.', /interview|entrevista/i],
  ['Deadline (EST/PST)', 'Prazo. Atenção ao fuso: EST é 1–2 horas atrás de Brasília e PST 4–5 horas atrás.', /\b(EST|PST|ET|PT)\b/],
];
function glossaryTermsIn(text) {
  return GLOSSARY.filter(g => g[2].test(String(text || ''))).slice(0, 6);
}

/* ── Public header/footer (for visitors not logged in) ─────────────── */
function publicShell(active, inner) {
  const n = N().nav;
  const logged = typeof state !== 'undefined' && state.isLoggedIn();
  const link = (page, label) => `<a href="#/${page}" class="pub-link ${active === page ? 'active' : ''}">${label}</a>`;
  return `
  <div class="pub-page">
    <header class="pub-header">
      <a href="#/home" class="pub-logo">Match<span>ED</span></a>
      <nav class="pub-nav">${link('check', n.check)}${link('explore', n.explore)}${link('impact', n.impact)}${link('glossary', n.glossary)}</nav>
      <div class="pub-actions">
        ${logged ? `<a href="#/discover" class="pub-btn">${T().nav.discover} →</a>`
          : `<a href="#/login" class="pub-link">${n.login}</a><a href="#/signup" class="pub-btn">${n.signup}</a>`}
      </div>
    </header>
    <main class="pub-main">${inner}</main>
    <footer class="pub-footer">
      <div>${esc(N().home.disclaimer)}</div>
      <div class="pub-lang">${['pt', 'en', 'es', 'fr'].map(l => `<button data-setlang="${l}" class="${lang.current === l ? 'active' : ''}">${l.toUpperCase()}</button>`).join('')}</div>
    </footer>
  </div>`;
}
function bindPublicShell(el, rerender) {
  el.querySelectorAll('[data-setlang]').forEach(b => b.onclick = () => { lang.set(b.dataset.setlang); rerender(); });
}

/* ── Partner referral (?ref=CODE) ──────────────────────────────────── */
function currentRef() { try { return localStorage.getItem('matched_ref') || ''; } catch { return ''; } }
async function partnerBannerHtml() {
  const ref = currentRef();
  if (!ref) return '';
  try {
    const p = await req('/public/partners/' + encodeURIComponent(ref));
    if (!p || !p.name) return '';
    return `<div class="partner-banner">🏫 ${N().home.partnerBanner(esc(p.name))}</div>`;
  } catch { return ''; }
}

/* ── Opportunity card (list style, used by Explorar and the check) ── */
function flagChips(o, max) {
  const f = o.flags || {}; const L = N().flags; const out = [];
  if (f.requiresUSWorkAuth) out.push(['bad', L.requiresUSWorkAuth]);
  else if (f.requiresUSCitizenship) out.push(['bad', L.requiresUSCitizenship]);
  if (f.brazilFocused) out.push(['good', L.brazilFocused]);
  if (f.funded) out.push(['good', L.funded]);
  if (f.publicSchoolFriendly) out.push(['good', L.publicSchoolFriendly]);
  if (f.hasFee) out.push(['warn', L.hasFee]);
  if (f.checkNationality) out.push(['warn', L.checkNationality]);
  if (f.englishRequired) out.push(['info', L.englishRequired]);
  if (f.ageRange) out.push(['info', L.age(f.ageRange[0], f.ageRange[1])]);
  return out.slice(0, max || 9).map(([k, t]) => `<span class="flag flag-${k}">${esc(t)}</span>`).join('');
}
function deadlineLine(o, full) {
  const D = N().detail;
  if (o.deadline) {
    const days = Math.round((new Date(String(o.deadline).slice(0, 10) + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000);
    if (days < 0) return `<span class="dl-closed">${esc(D.lastDeadline)}: ${fmtDate(o.deadline)}</span>`;
    const soon = days <= 14 ? ' dl-soon' : '';
    return `<span class="dl-open${soon}">⏰ ${fmtDate(o.deadline)}${days <= 30 ? ` · ${typeof formatDL === 'function' ? esc(formatDL(o.deadline)) : days + 'd'}` : ''}</span>`;
  }
  if (o.last_known_deadline) return `<span class="dl-closed">${esc(D.lastDeadline)}: ${fmtDate(o.last_known_deadline)}</span>`;
  if (o.deadline_text) { const t = tidyText(o.deadline_text); return `<span class="dl-text" title="${esc(t)}">⏰ ${esc(full ? t : (t.length > 60 ? t.slice(0, 57) + '…' : t))}</span>`; }
  return `<span class="dl-text">${esc(D.noDeadline)}</span>`;
}
function oppListCard(o) {
  const score = (o.computedScore != null) ? `<span class="lc-score">${o.computedScore}%</span>` : '';
  return `
    <article class="lc" data-oid="${esc(o.id)}" tabindex="0" role="button">
      <div class="lc-top"><span class="lc-cat">${esc(catName(o.category))}</span>${score}</div>
      <h3 class="lc-title">${esc(o.programName)}</h3>
      ${o.organizationName ? `<div class="lc-org">${esc(o.organizationName)}</div>` : ''}
      <p class="lc-desc">${esc(String(o.description || '').slice(0, 170))}${String(o.description || '').length > 170 ? '…' : ''}</p>
      <div class="lc-flags">${flagChips(o, 3)}</div>
      <div class="lc-foot">${deadlineLine(o)}</div>
    </article>`;
}
function bindListCards(container, list) {
  container.querySelectorAll('.lc').forEach(card => {
    const open = () => { const o = list.find(x => x.id === card.dataset.oid); if (o) showOppModal(o); };
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === 'Enter') open(); };
  });
}

/* ── Opportunity detail sheet ──────────────────────────────────────── */
// opts.onAction(action) lets Discover swipe the right card; otherwise we act directly.
function showOppModal(raw, opts = {}) {
  document.querySelectorAll('.opp-modal').forEach(m => m.remove());
  const o = raw;
  const D = N().detail;
  const url = safeUrl(o.websiteUrl);
  const desc = (lang.current === 'pt' && o.description_pt) ? o.description_pt : o.description;
  const elig = (lang.current === 'pt' && o.eligibility_pt) ? o.eligibility_pt : o.eligibility;
  const reasons = (o.matchReasons || []).filter(r => N().reasons[r]).map(r => `<span class="flag flag-good">${esc(N().reasons[r])}</span>`).join('');
  const warns = (o.warnings || []).filter(w => N().warnings[w]).map(w => `<li>${esc(N().warnings[w])}</li>`).join('');
  const terms = glossaryTermsIn([desc, elig, o.programName, (o.requirements || []).join(' ')].join(' '));
  const logged = state.isLoggedIn();
  const reqs = (o.requirements || []).filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('');

  const modal = document.createElement('div');
  modal.className = 'opp-modal';
  modal.setAttribute('role', 'dialog');
  modal.innerHTML = `
    <div class="opp-modal-backdrop"></div>
    <div class="opp-modal-sheet">
      <div class="opp-modal-header" style="background:linear-gradient(135deg,#0B1F4D,#1e3a8a)">
        <button class="opp-modal-close" aria-label="Fechar">✕</button>
        <div class="card-category" style="margin-bottom:8px;">${esc(catName(o.category))}</div>
        <h2 style="color:#fff;font-size:21px;font-weight:800;margin-bottom:4px;line-height:1.3;">${esc(o.programName)}</h2>
        <div style="color:rgba(255,255,255,0.8);font-size:14px;">${esc(o.organizationName || '')}</div>
        ${o.computedScore != null ? `<div class="card-match md-match">${o.computedScore}% match</div>` : ''}
      </div>
      <div class="opp-modal-body">
        <div class="lc-flags" style="margin-bottom:14px;">${flagChips(o)}</div>
        ${warns ? `<div class="md-warn"><strong>${esc(D.attention)}</strong><ul>${warns}</ul></div>` : ''}
        <div class="md-grid">
          <div><div class="md-k">${esc(D.deadline)}</div><div class="md-v">${deadlineLine(o, true)}</div></div>
          ${o.location ? `<div><div class="md-k">${esc(D.where)}</div><div class="md-v">${esc(o.location)}</div></div>` : ''}
          ${o.fundingAmount ? `<div><div class="md-k">${esc(D.funding)}</div><div class="md-v">${esc(o.fundingAmount)}</div></div>` : ''}
        </div>
        ${desc ? `<div class="modal-section"><h4>${esc(D.about)}</h4><p class="md-p">${esc(desc)}</p></div>` : ''}
        ${elig ? `<div class="modal-section"><h4>${esc(D.eligibility)}</h4><p class="md-p">${esc(elig)}</p></div>` : ''}
        ${reqs ? `<div class="modal-section"><h4>${esc(T().modal.requirements)}</h4><ul class="md-ul">${reqs}</ul></div>` : ''}
        ${reasons ? `<div class="modal-section"><h4>${esc(D.why)}</h4><div class="lc-flags">${reasons}</div></div>` : ''}
        ${terms.length ? `<div class="modal-section"><h4>${esc(D.terms)}</h4>${terms.map(t => `<details class="md-term"><summary>${esc(t[0])}</summary><p>${esc(t[1])}</p></details>`).join('')}</div>` : ''}
        <div class="md-actions">
          ${logged ? `
            <button class="btn btn-primary" data-act="plan">${esc(D.plan)}</button>
            <div class="md-row"><button class="btn btn-secondary" data-act="like">${esc(D.like)}</button><button class="btn btn-secondary" data-act="save">${esc(D.save)}</button></div>`
            : `<p class="md-hint">${esc(D.loginToSave)}</p><a class="btn btn-primary" href="#/signup" data-close>${esc(N().nav.signup)}</a>`}
          ${url ? `<a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(D.official)}</a>` : ''}
          <div class="md-row">
            ${o.deadline ? `<button class="btn btn-ghost btn-sm" data-act="ics">📅 .ics</button><a class="btn btn-ghost btn-sm" href="${esc(gcalLink(o))}" target="_blank" rel="noopener">📅 ${esc(D.gcal)}</a>` : ''}
            <a class="btn btn-ghost btn-sm" href="${esc(whatsappLink(o))}" target="_blank" rel="noopener">${esc(D.share)}</a>
          </div>
          <button class="md-report" data-act="report">${esc(D.report)}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.querySelector('.opp-modal-sheet').classList.add('open'));
  const close = () => { modal.querySelector('.opp-modal-sheet').classList.remove('open'); setTimeout(() => modal.remove(), 250); };
  modal.querySelector('.opp-modal-close').onclick = close;
  modal.querySelector('.opp-modal-backdrop').onclick = close;
  modal.querySelectorAll('[data-close]').forEach(a => a.addEventListener('click', close));
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  modal.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async () => {
      const act = b.dataset.act;
      if (act === 'ics') return downloadIcs([o], 'prazo-' + (o.programName || '').slice(0, 30).replace(/\W+/g, '-'));
      if (act === 'report') return openReportForm(o);
      if (opts.onAction) { close(); return opts.onAction(act); }
      try {
        if (act === 'like') { await api.swipe(state.user.id, o.id, 'like', o.computedScore); toast(T().toasts.savedOk, 'success'); }
        if (act === 'save') { await api.save(state.user.id, o.id); toast(T().toasts.savedLater, 'success'); }
        if (act === 'plan') { await createQuest(o); close(); router.go('quests'); return; }
        close();
      } catch (e) { toast(e.message, 'error'); }
    };
  });
}

function openReportForm(o) {
  const D = N().detail;
  const m = document.createElement('div');
  m.className = 'mini-modal';
  m.innerHTML = `<div class="mini-card">
    <h3>${esc(D.reportTitle)}</h3>
    <div class="rep-reasons">${Object.entries(D.reportReasons).map(([k, v], i) => `<label><input type="radio" name="rr" value="${k}" ${i === 0 ? 'checked' : ''}/> ${esc(v)}</label>`).join('')}</div>
    <textarea id="rep-note" rows="3" maxlength="500" placeholder="${esc(D.reportNote)}"></textarea>
    <div class="md-row"><button class="btn btn-ghost" id="rep-cancel">${esc(D.cancel)}</button><button class="btn btn-primary" id="rep-send">${esc(D.send)}</button></div>
  </div>`;
  document.body.appendChild(m);
  m.querySelector('#rep-cancel').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  m.querySelector('#rep-send').onclick = async () => {
    const reason = (m.querySelector('input[name=rr]:checked') || {}).value;
    try {
      await req('/opportunities/' + encodeURIComponent(o.id) + '/report', { method: 'POST', body: JSON.stringify({ reason, note: m.querySelector('#rep-note').value }) });
      toast(D.reportSent, 'success');
    } catch (e) { toast(e.message, 'error'); }
    m.remove();
  };
}

/* ── PAGE: Home (public landing) ───────────────────────────────────── */
async function pageHome(el, rt) {
  const H = N().home;
  const render = (stats, banner) => {
    const num = (v) => (v == null ? '—' : Number(v).toLocaleString(locale()));
    el.innerHTML = publicShell('home', `
      ${banner || ''}
      <section class="hero">
        <div class="hero-kicker">${esc(H.kicker)}</div>
        <h1 class="hero-title">${H.title}</h1>
        <p class="hero-sub">${esc(H.sub)}</p>
        <div class="hero-ctas">
          <a href="#/check" class="btn btn-primary hero-btn">${esc(H.ctaCheck)}</a>
          <a href="#/explore" class="btn btn-ghost hero-btn">${esc(H.ctaExplore)}</a>
        </div>
        <div class="hero-note">${esc(H.noSignup)}</div>
      </section>
      <section class="home-section">
        <h2>${esc(H.statsTitle)}</h2>
        <div class="stat-grid">
          <div class="stat-box"><b>${num(stats && stats.opportunitiesVerified)}</b><span>${esc(H.statOpps)}</span></div>
          <div class="stat-box"><b>${num(stats && stats.opportunitiesFunded)}</b><span>${esc(H.statFunded)}</span></div>
          <div class="stat-box"><b>${num(stats && stats.sourcesMonitored)}</b><span>${esc(H.statSources)}</span></div>
          ${stats && stats.eligibilityChecks >= 50 ? `<div class="stat-box"><b>${num(stats.eligibilityChecks)}</b><span>${esc(H.statChecks)}</span></div>` : `<div class="stat-box"><b>R$ 0</b><span>${esc(lang.current === 'pt' ? 'custo para estudantes' : 'cost for students')}</span></div>`}
        </div>
        <p class="muted small">${esc(H.honest)}</p>
      </section>
      <section class="home-section">
        <h2>${esc(H.howTitle)}</h2>
        <div class="how-grid">
          <div class="how"><div class="how-n">1</div><h3>${esc(H.how1t)}</h3><p>${esc(H.how1)}</p></div>
          <div class="how"><div class="how-n">2</div><h3>${esc(H.how2t)}</h3><p>${esc(H.how2)}</p></div>
          <div class="how"><div class="how-n">3</div><h3>${esc(H.how3t)}</h3><p>${esc(H.how3)}</p></div>
        </div>
      </section>
      <section class="home-section schools">
        <h2>${esc(H.schoolsTitle)}</h2>
        <p>${esc(H.schools)}</p>
        <a class="btn btn-secondary" href="mailto:lauracar.apply@gmail.com?subject=MatchED%20na%20minha%20escola">${esc(H.schoolsCta)}</a>
      </section>`);
    bindPublicShell(el, () => pageHome(el, rt));
  };
  render(null, '');
  const [stats, banner] = await Promise.all([req('/public/stats').catch(() => null), partnerBannerHtml()]);
  if (router.current === 'home') render(stats, banner);
}

/* ── PAGE: Isso vale pra mim? (anonymous eligibility check) ────────── */
async function pageCheck(el, rt) {
  const C = N().check; const O = N();
  const a = { userPath: 'high-school', gradeLevel: '', schoolType: '', state: '', birthYear: '', englishLevel: '', goals: [], interests: [], needsFunding: false };
  const thisYear = new Date().getFullYear();
  const years = []; for (let y = thisYear - 12; y >= thisYear - 25; y--) years.push(y);
  const steps = [
    { q: C.q1, key: 'gradeLevel', type: 'one', options: Object.entries(O.grades).concat([['college', lang.current === 'en' ? 'I am in college' : 'Estou na faculdade']]) },
    { q: C.q2, key: 'schoolType', type: 'one', options: Object.entries(O.schoolTypes) },
    { q: C.q3, key: 'state', type: 'select', options: BR_STATES.map(s => [s, s]) },
    { q: C.q4, key: 'birthYear', type: 'select', options: years.map(y => [String(y), String(y)]) },
    { q: C.q5, key: 'englishLevel', type: 'one', options: Object.entries(O.english) },
    { q: C.q6, key: 'goals', type: 'many', options: Object.entries(O.goals), extra: true },
    { q: C.q7, key: 'interests', type: 'many', options: INTEREST_KEYS.map(k => [k, O.interests[k]]) },
  ];
  let i = 0;
  const banner = await partnerBannerHtml();

  function renderStep() {
    const s = steps[i];
    const val = a[s.key];
    let body = '';
    if (s.type === 'one') body = `<div class="opt-grid">${s.options.map(([k, l]) => `<button class="opt ${val === k ? 'sel' : ''}" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    if (s.type === 'select') body = `<select class="ob2-select big-select" id="ck-sel"><option value="">—</option>${s.options.map(([k, l]) => `<option value="${esc(k)}" ${val === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    if (s.type === 'many') body = `<p class="muted small">${esc(C.pickAny)}</p><div class="opt-grid">${s.options.map(([k, l]) => `<button class="opt ${val.includes(k) ? 'sel' : ''}" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>
      ${s.extra ? `<label class="check-line"><input type="checkbox" id="ck-fund" ${a.needsFunding ? 'checked' : ''}/> ${esc(C.needsFunding)}</label>` : ''}`;
    el.innerHTML = publicShell('check', `${banner}
      <section class="check-wrap">
        <div class="check-progress"><div style="width:${Math.round(((i + 1) / steps.length) * 100)}%"></div></div>
        <div class="muted small">${esc(C.step(i + 1, steps.length))}</div>
        <h1 class="check-q">${esc(s.q)}</h1>
        ${body}
        <div class="check-nav">
          ${i > 0 ? `<button class="btn btn-ghost" id="ck-back">${esc(C.back)}</button>` : '<span></span>'}
          <button class="btn btn-primary" id="ck-next">${esc(i === steps.length - 1 ? C.see : C.next)}</button>
        </div>
      </section>`);
    bindPublicShell(el, renderStep);
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (s.type === 'one') {
        a[s.key] = v;
        if (s.key === 'gradeLevel') { a.userPath = v === 'college' ? 'college' : 'high-school'; }
        i = Math.min(i + 1, steps.length - 1); renderStep();
      } else {
        const list = a[s.key]; const at = list.indexOf(v);
        if (at >= 0) list.splice(at, 1); else list.push(v);
        b.classList.toggle('sel');
      }
    });
    const sel = el.querySelector('#ck-sel'); if (sel) sel.onchange = () => { a[s.key] = sel.value; };
    const fund = el.querySelector('#ck-fund'); if (fund) fund.onchange = () => { a.needsFunding = fund.checked; };
    const back = el.querySelector('#ck-back'); if (back) back.onclick = () => { i--; renderStep(); };
    el.querySelector('#ck-next').onclick = () => { if (i < steps.length - 1) { i++; renderStep(); } else showResults(); };
  }

  async function showResults() {
    el.innerHTML = publicShell('check', `<div class="spinner"></div>`);
    try {
      const body = { ...a, gradeLevel: a.gradeLevel === 'college' ? '' : a.gradeLevel, ref: currentRef(), limit: 24 };
      const data = await req('/opportunities/check', { method: 'POST', body: JSON.stringify(body) });
      try { sessionStorage.setItem('matched_check_profile', JSON.stringify(a)); } catch {}
      const list = data.opportunities || [];
      el.innerHTML = publicShell('check', `${banner}
        <section class="check-results">
          <h1>${esc(C.results(data.counts.eligible))}</h1>
          <div class="count-row">
            <span>💰 <b>${data.counts.funded}</b> ${esc(C.countFunded)}</span>
            <span>🇧🇷 <b>${data.counts.brazil}</b> ${esc(C.countBrazil)}</span>
            <span>⏰ <b>${data.counts.closingSoon}</b> ${esc(C.countSoon)}</span>
          </div>
          <p class="muted">${esc(C.resultsSub)}</p>
          ${state.isLoggedIn() ? '' : `<a href="#/signup" class="btn btn-primary save-cta">${esc(C.saveCta)}</a>`}
          <div class="lc-grid" id="ck-list">${list.map(oppListCard).join('')}</div>
          <div class="check-nav"><button class="btn btn-ghost" id="ck-again">${esc(C.again)}</button><a href="#/explore" class="btn btn-secondary">${esc(C.exploreAll)}</a></div>
        </section>`);
      bindPublicShell(el, showResults);
      bindListCards(el.querySelector('#ck-list'), list);
      el.querySelector('#ck-again').onclick = () => { i = 0; renderStep(); };
    } catch (e) {
      toast(e.message, 'error'); renderStep();
    }
  }
  renderStep();
}

/* ── PAGE: Explorar (public list with filters) ─────────────────────── */
async function pageExplore(el, rt) {
  const E = N().explore; const logged = state.isLoggedIn();
  const f = { q: '', category: 'all', level: '', funded: false, noFee: false, brazil: false, publicSchool: false, open: true, includeUSOnly: false, sort: logged ? 'match' : 'deadline' };
  let list = []; let total = 0; let offset = 0; let hiddenUS = 0;
  const cats = ['all', 'scholarship', 'summer-program', 'competition', 'fellowship', 'exchange', 'research-program', 'internship'];

  const inner = `
    <section class="ex-wrap">
      <div class="page-header" style="padding-left:0;"><h1>${esc(E.title)}</h1><p>${esc(E.sub)}</p></div>
      <input id="ex-q" type="search" class="ex-search" placeholder="${esc(E.search)}" />
      <div class="filter-bar" style="padding:10px 0;">${cats.map(c => `<button class="chip ${c === 'all' ? 'active' : ''}" data-cat="${c}">${esc(N().cats[c] || c)}</button>`).join('')}</div>
      <div class="ex-toggles">
        <select id="ex-level" class="ex-select"><option value="">${esc(E.level)}: ${esc(E.levelAll)}</option><option value="high-school">${esc(E.levelHS)}</option><option value="college">${esc(E.levelCol)}</option></select>
        <label><input type="checkbox" data-f="funded"/> ${esc(E.funded)}</label>
        <label><input type="checkbox" data-f="noFee"/> ${esc(E.noFee)}</label>
        <label><input type="checkbox" data-f="brazil"/> ${esc(E.brazil)}</label>
        <label><input type="checkbox" data-f="publicSchool"/> ${esc(E.publicSchool)}</label>
        <label><input type="checkbox" data-f="open" checked/> ${esc(E.open)}</label>
        <select id="ex-sort" class="ex-select">
          <option value="deadline">${esc(E.sort)}: ${esc(E.sortDeadline)}</option>
          ${logged ? `<option value="match">${esc(E.sort)}: ${esc(E.sortMatch)}</option>` : ''}
          <option value="recent">${esc(E.sort)}: ${esc(E.sortRecent)}</option>
        </select>
      </div>
      <div class="ex-meta"><span id="ex-count"></span><label class="small muted"><input type="checkbox" data-f="includeUSOnly"/> ${esc(E.usOnly)}</label></div>
      <div class="lc-grid" id="ex-list"><div class="spinner"></div></div>
      <div style="text-align:center;margin:18px 0 40px;"><button class="btn btn-secondary" id="ex-more" style="display:none;max-width:260px;">${esc(E.more)}</button></div>
    </section>`;
  if (logged) {
    el.innerHTML = `<div class="ex-in-app">${inner}</div>`;
  } else {
    el.innerHTML = publicShell('explore', inner);
    bindPublicShell(el, () => pageExplore(el, rt));
  }
  el.querySelector('#ex-sort').value = f.sort;

  function params(extra) {
    const p = new URLSearchParams({ limit: 24, offset, sort: f.sort });
    if (f.q) p.set('q', f.q);
    if (f.category !== 'all') p.set('category', f.category);
    if (f.level) p.set('level', f.level);
    ['funded', 'noFee', 'brazil', 'publicSchool', 'open', 'includeUSOnly'].forEach(k => { if (f[k]) p.set(k, '1'); });
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }
  async function load(reset) {
    if (reset) { offset = 0; list = []; el.querySelector('#ex-list').innerHTML = '<div class="spinner"></div>'; }
    try {
      const data = await req('/opportunities?' + params());
      total = data.total; list = list.concat(data.opportunities); offset += data.opportunities.length;
      if (reset && !f.includeUSOnly) {
        const all = await req('/opportunities?' + params({ includeUSOnly: '1', limit: 1, offset: 0 })).catch(() => null);
        hiddenUS = all ? Math.max(0, all.total - total) : 0;
      }
      render();
    } catch (e) { el.querySelector('#ex-list').innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`; }
  }
  function render() {
    el.querySelector('#ex-count').innerHTML = `<b>${esc(E.count(total))}</b>${hiddenUS && !f.includeUSOnly ? ` · <span class="muted">${esc(E.hiddenUS(hiddenUS))}</span>` : ''}`;
    const box = el.querySelector('#ex-list');
    box.innerHTML = list.length ? list.map(oppListCard).join('') : `<div class="empty-state"><div class="empty-icon">🔍</div><h3>${esc(E.none)}</h3></div>`;
    bindListCards(box, list);
    el.querySelector('#ex-more').style.display = list.length < total ? 'inline-flex' : 'none';
  }
  let timer;
  el.querySelector('#ex-q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); load(true); }, 300); };
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
    el.querySelectorAll('[data-cat]').forEach(x => x.classList.remove('active')); b.classList.add('active');
    f.category = b.dataset.cat; load(true);
  });
  el.querySelectorAll('input[data-f]').forEach(c => c.onchange = () => { f[c.dataset.f] = c.checked; load(true); });
  el.querySelector('#ex-level').onchange = (e) => { f.level = e.target.value; load(true); };
  el.querySelector('#ex-sort').onchange = (e) => { f.sort = e.target.value; load(true); };
  el.querySelector('#ex-more').onclick = () => load(false);
  load(true);
}

/* ── PAGE: Opportunity deep link (#/o/<id>) ────────────────────────── */
async function pageOpportunity(el, rt, id) {
  await (state.isLoggedIn() ? pageExplore(el, rt) : pageExplore(el, rt));
  try { const o = await req('/opportunities/' + encodeURIComponent(id)); showOppModal(o); }
  catch { toast(lang.current === 'en' ? 'Opportunity not found' : 'Oportunidade não encontrada', 'error'); }
}

/* ── PAGE: Impacto (public) ────────────────────────────────────────── */
async function pageImpact(el, rt) {
  const I = N().impact;
  el.innerHTML = publicShell('impact', '<div class="spinner"></div>');
  const s = await req('/public/stats').catch(() => ({}));
  const num = (v) => (v == null ? `<small>${esc(I.notYet)}</small>` : Number(v).toLocaleString(locale()));
  const box = (v, label) => `<div class="stat-box"><b>${v}</b><span>${esc(label)}</span></div>`;
  el.innerHTML = publicShell('impact', `
    <section class="home-section">
      <h1 class="pub-h1">${esc(I.title)}</h1><p class="muted">${esc(I.sub)}</p>
      <div class="stat-grid">
        ${box(num(s.opportunitiesVerified), I.opps)}${box(num(s.opportunitiesFunded), I.funded)}${box(num(s.sourcesMonitored), I.sources)}${box(num(s.eligibilityChecks), I.checks)}
        ${box(num(s.students), I.students)}${box(s.publicSchoolShare == null ? num(null) : s.publicSchoolShare + '%', I.publicShare)}
        ${box(num(s.applicationsStarted), I.started)}${box(num(s.applicationsSubmitted), I.submitted)}${box(num(s.acceptances), I.accepted)}
        ${box(s.scholarshipBRL ? 'R$ ' + Number(s.scholarshipBRL).toLocaleString('pt-BR') : num(s.scholarshipBRL), I.brl)}
      </div>
      <h2 style="margin-top:28px;">${esc(I.method)}</h2><p class="muted">${esc(I.methodText)}</p>
    </section>`);
  bindPublicShell(el, () => pageImpact(el, rt));
}

/* ── PAGE: Glossário (public) ──────────────────────────────────────── */
function pageGlossary(el, rt) {
  const G = N().glossary;
  const render = (q) => GLOSSARY.filter(g => !q || (g[0] + ' ' + g[1]).toLowerCase().includes(q)).map(g => `<details class="md-term"><summary>${esc(g[0])}</summary><p>${esc(g[1])}</p></details>`).join('');
  el.innerHTML = publicShell('glossary', `
    <section class="ex-wrap"><h1 class="pub-h1">${esc(G.title)}</h1><p class="muted">${esc(G.sub)}</p>
      <input id="gl-q" class="ex-search" type="search" placeholder="${esc(G.search)}"/>
      <div id="gl-list" style="margin-top:14px;">${render('')}</div></section>`);
  bindPublicShell(el, () => pageGlossary(el, rt));
  el.querySelector('#gl-q').oninput = (e) => { el.querySelector('#gl-list').innerHTML = render(e.target.value.toLowerCase().trim()); };
}

/* ── Brazilian onboarding / matching profile ───────────────────────── */
async function pageProfileSetupBR(el, rt, path, { edit = false } = {}) {
  const O = N(); const B = O.onboarding; const isHS = path !== 'college';
  let p = {};
  if (edit) { try { p = (await api.getProfile(state.user.id)).profile || {}; } catch {} }
  else { try { p = JSON.parse(sessionStorage.getItem('matched_check_profile') || '{}'); } catch {} }
  const thisYear = new Date().getFullYear();
  const years = []; for (let y = thisYear - 12; y >= thisYear - 30; y--) years.push(y);
  const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${esc(k)}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const interests = (p.interests || p.careerInterests || []);
  el.innerHTML = `
    <div class="ob2-page">
      <div class="dark-blur-tl"></div><div class="dark-blur-br"></div>
      <div class="ob2-title">${esc(B.title)}</div>
      <p class="ob2-sub">${esc(B.sub)}</p>
      <form id="pbr" class="ob2-form">
        ${isHS ? `
          <div class="form-group"><label>${esc(B.grade)}</label><select id="pb-grade" class="ob2-select" required><option value="">—</option>${opt(O.grades, p.gradeLevel)}</select></div>
          <div class="form-group"><label>${esc(B.schoolType)}</label><select id="pb-stype" class="ob2-select" required><option value="">—</option>${opt(O.schoolTypes, p.schoolType)}</select></div>
          <div class="form-group"><label>${esc(B.school)}</label><input id="pb-school" type="text" maxlength="120" value="${esc(p.school || '')}"/></div>`
        : `
          <div class="form-group"><label>${esc(B.uni)}</label><input id="pb-uni" type="text" maxlength="120" value="${esc(p.university || '')}"/></div>
          <div class="form-group"><label>${esc(B.major)}</label><input id="pb-major" type="text" maxlength="120" value="${esc(p.major || '')}"/></div>
          <div class="form-group"><label>${esc(B.schoolType)}</label><select id="pb-stype" class="ob2-select"><option value="">—</option>${opt({ publica_federal: lang.current === 'en' ? 'Public university' : 'Universidade pública', particular_bolsista: O.schoolTypes.particular_bolsista, particular: O.schoolTypes.particular }, p.schoolType)}</select></div>`}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group"><label>${esc(B.state)}</label><select id="pb-state" class="ob2-select"><option value="">—</option>${BR_STATES.map(s => `<option ${p.state === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>${esc(B.birthYear)}</label><select id="pb-birth" class="ob2-select"><option value="">—</option>${years.map(y => `<option ${String(p.birthYear) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label>${esc(B.english)}</label><select id="pb-eng" class="ob2-select"><option value="">—</option>${opt(O.english, p.englishLevel)}</select></div>
        <div class="form-group"><label>${esc(B.goals)}</label><div class="interest-grid">${Object.entries(O.goals).map(([k, l]) => `<div class="interest-chip ${(p.goals || []).includes(k) ? 'active' : ''}" data-goal="${k}">${esc(l)}</div>`).join('')}</div></div>
        <label class="check-line"><input type="checkbox" id="pb-fund" ${p.needsFunding ? 'checked' : ''}/> ${esc(B.needsFunding)}</label>
        <div class="form-group"><label>${esc(B.interests)}</label><div class="interest-grid">${INTEREST_KEYS.map(k => `<div class="interest-chip ${interests.includes(k) ? 'active' : ''}" data-int="${k}">${esc(O.interests[k])}</div>`).join('')}</div></div>
        <button type="submit" class="btn btn-primary" id="pb-save">${esc(B.save)}</button>
        ${edit ? '' : `<button type="button" class="btn btn-ghost" id="pb-skip">${esc(B.skip)}</button>`}
      </form>
    </div>`;
  el.querySelectorAll('.interest-chip').forEach(c => c.onclick = () => c.classList.toggle('active'));
  const skip = el.querySelector('#pb-skip'); if (skip) skip.onclick = () => rt.go('discover');
  el.querySelector('#pbr').onsubmit = async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#pb-save'); btn.disabled = true; btn.textContent = '…';
    const val = (id) => { const x = el.querySelector(id); return x ? x.value : undefined; };
    const data = {
      state: val('#pb-state'), birthYear: val('#pb-birth'), englishLevel: val('#pb-eng'), schoolType: val('#pb-stype'),
      needsFunding: el.querySelector('#pb-fund').checked,
      goals: [...el.querySelectorAll('[data-goal].active')].map(x => x.dataset.goal),
      interests: [...el.querySelectorAll('[data-int].active')].map(x => x.dataset.int),
    };
    if (isHS) Object.assign(data, { gradeLevel: val('#pb-grade'), school: val('#pb-school') });
    else Object.assign(data, { university: val('#pb-uni'), major: val('#pb-major') });
    try {
      await api.updateProfile(state.user.id, data);
      toast(B.saved, 'success');
      rt.go(edit ? 'profile' : 'discover');
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = B.save; }
  };
}

/* ── Admin: extra tabs ─────────────────────────────────────────────── */
async function renderAdminReports(c) {
  const A = N().admin;
  c.innerHTML = '<div class="spinner"></div>';
  const { reports } = await req('/admin/reports?status=open');
  if (!reports.length) { c.innerHTML = `<div class="adm-empty">${esc(A.noReports)}</div>`; return; }
  c.innerHTML = reports.map(r => `
    <div class="adm-card">
      <div class="adm-title">${esc(r.opportunityName || r.opportunityId)}</div>
      <div class="adm-sub">${esc((N().detail.reportReasons || {})[r.reason] || r.reason)} · ${fmtDate(r.createdAt)}</div>
      ${r.note ? `<p class="adm-note">${esc(r.note)}</p>` : ''}
      <div class="md-row" style="justify-content:flex-start;">
        <a class="btn btn-ghost btn-sm" href="#/o/${encodeURIComponent(r.opportunityId)}" target="_blank">${esc(A.open)}</a>
        <button class="btn btn-primary btn-sm" data-rid="${esc(r.id)}" data-st="resolved">${esc(A.resolve)}</button>
        <button class="btn btn-ghost btn-sm" data-rid="${esc(r.id)}" data-st="dismissed">${esc(A.dismiss)}</button>
      </div>
    </div>`).join('');
  c.querySelectorAll('[data-rid]').forEach(b => b.onclick = async () => {
    await req('/admin/reports/' + b.dataset.rid, { method: 'PUT', body: JSON.stringify({ status: b.dataset.st }) });
    renderAdminReports(c);
  });
}

// QR codes are drawn locally (vendor/qrcode-generator.js, MIT) so they work offline and on school networks
function loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/qrcode-generator.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
function qrSvg(text, cell = 6) {
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
// A one-page poster the school can print and stick on the wall
function printPoster(partnerName, url) {
  const w = window.open('', '_blank'); if (!w) return;
  const pt = (typeof lang === 'undefined' || lang.current === 'pt');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>MatchED</title>
  <style>body{font-family:Inter,Arial,sans-serif;text-align:center;padding:40px;color:#0B1F4D}h1{font-size:44px;margin:0 0 8px}h1 span{color:#65a30d}
  p{font-size:20px;max-width:560px;margin:8px auto}.qr{width:340px;margin:28px auto}.qr svg{width:100%;height:auto}.url{font-size:14px;color:#475569;word-break:break-all}
  .who{margin-top:24px;font-size:16px;color:#334155}@media print{button{display:none}}</style></head><body>
  <h1>Match<span>ED</span></h1>
  <p><b>${pt ? 'Bolsas, programas e competições que valem pra você — de graça.' : 'Scholarships, programs and competitions that fit you — free.'}</b></p>
  <p>${pt ? 'Aponte a câmera do celular, responda 7 perguntas e veja para quais oportunidades você pode se inscrever.' : 'Point your phone camera, answer 7 questions and see what you can apply to.'}</p>
  <div class="qr">${qrSvg(url, 10)}</div><div class="url">${esc(url)}</div>
  <div class="who">${esc(partnerName)}</div>
  <button onclick="print()" style="margin-top:24px;padding:10px 20px;font-size:16px">${pt ? 'Imprimir' : 'Print'}</button>
  </body></html>`);
  w.document.close();
}

async function renderAdminPartners(c) {
  const A = N().admin;
  c.innerHTML = '<div class="spinner"></div>';
  const { partners } = await req('/admin/partners');
  const link = (code) => `${location.origin}/?ref=${encodeURIComponent(code)}#/check`;
  c.innerHTML = `
    <form class="adm-card" id="pt-form">
      <div class="adm-title">${esc(A.newPartner)}</div>
      <div class="pt-grid">
        <input name="name" placeholder="${esc(A.name)}" required maxlength="120"/>
        <input name="city" placeholder="${esc(A.city)}" maxlength="80"/>
        <select name="state"><option value="">UF</option>${BR_STATES.map(s => `<option>${s}</option>`).join('')}</select>
        <select name="type">${Object.entries(A.types).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;">${esc(A.create)}</button>
    </form>
    ${partners.map(p => `
      <div class="adm-card">
        <div class="adm-title">${esc(p.name)} <span class="adm-code">${esc(p.code)}</span></div>
        <div class="adm-sub">${esc(A.types[p.type] || p.type)} · ${esc(p.city || '')} ${esc(p.state || '')}</div>
        <div class="pt-stats"><b>${p.stats.students}</b> ${esc(A.signups)} · <b>${p.checks}</b> ${esc(A.checks)} · <b>${p.stats.applicationsStarted}</b> ${esc(A.started)}</div>
        <div class="pt-link"><input readonly value="${esc(link(p.code))}"/><button class="btn btn-ghost btn-sm" data-copy="${esc(link(p.code))}">${esc(A.copy)}</button><button class="btn btn-ghost btn-sm" data-qr="${esc(p.code)}">${esc(A.qr)}</button></div>
        <div class="pt-qr" id="qr-${esc(p.code)}"></div>
      </div>`).join('')}`;
  c.querySelector('#pt-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try { await req('/admin/partners', { method: 'POST', body: JSON.stringify(fd) }); renderAdminPartners(c); }
    catch (err) { toast(err.message, 'error'); }
  };
  c.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast(A.copied, 'success'); } catch {} });
  c.querySelectorAll('[data-qr]').forEach(b => b.onclick = async () => {
    const box = c.querySelector('#qr-' + CSS.escape(b.dataset.qr));
    try {
      await loadQrLib();
      const url = link(b.dataset.qr);
      const svg = qrSvg(url);
      const name = b.closest('.adm-card').querySelector('.adm-title').firstChild.textContent.trim();
      box.innerHTML = `<div class="pt-qr-img">${svg}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <a class="btn btn-ghost btn-sm" download="matched-qr-${esc(b.dataset.qr)}.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">⬇️ ${lang.current === 'pt' ? 'Baixar QR' : 'Download QR'}</a>
          <button class="btn btn-ghost btn-sm" data-poster>🖨️ ${lang.current === 'pt' ? 'Cartaz para imprimir' : 'Printable poster'}</button>
        </div>`;
      box.querySelector('[data-poster]').onclick = () => printPoster(name, url);
    } catch { box.textContent = link(b.dataset.qr); }
  });
}

async function renderAdminImpact(c) {
  const A = N().admin; const I = N().impact;
  c.innerHTML = '<div class="spinner"></div>';
  const d = await req('/admin/impact');
  const s = d.impact; const f = d.funnel;
  const steps = [['Consultas', f.eligibilityChecks], ['Cadastros', f.signups], ['Perfil feito', f.onboarded], ['Salvou/curtiu', f.savedOrLiked], ['Começou plano', f.startedQuest], ['Enviou', f.submitted]];
  const max = Math.max(1, ...steps.map(x => x[1]));
  c.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><b>${s.opportunitiesVerified}</b><span>${esc(I.opps)}</span></div>
      <div class="stat-box"><b>${s.students}</b><span>${esc(I.students)}</span></div>
      <div class="stat-box"><b>${s.publicSchoolShare == null ? '—' : s.publicSchoolShare + '%'}</b><span>${esc(I.publicShare)} (${s.profilesWithSchoolType})</span></div>
      <div class="stat-box"><b>${s.applicationsStarted}</b><span>${esc(I.started)}</span></div>
      <div class="stat-box"><b>${s.applicationsSubmitted}</b><span>${esc(I.submitted)}</span></div>
      <div class="stat-box"><b>${s.acceptances}</b><span>${esc(I.accepted)}</span></div>
      <div class="stat-box"><b>R$ ${Number(s.scholarshipBRL || 0).toLocaleString('pt-BR')}</b><span>${esc(I.brl)}</span></div>
      <div class="stat-box"><b>${d.openReports}</b><span>${esc(A.reports)}</span></div>
    </div>
    <div class="adm-card"><div class="adm-title">${esc(A.funnel)}</div>
      ${steps.map(([l, v]) => `<div class="fn-row"><span>${esc(l)}</span><div class="fn-bar"><div style="width:${Math.round(v / max * 100)}%"></div></div><b>${v}</b></div>`).join('')}
    </div>
    <div class="adm-card"><div class="adm-title">UF</div><div class="small muted">${Object.entries(s.states || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ') || '—'}</div></div>`;
}
