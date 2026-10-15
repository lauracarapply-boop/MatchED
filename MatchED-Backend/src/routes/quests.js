const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDatabase, writeDatabase } = require('../database/db');
const { requireSelf, requireAuth, ownsRecord } = require('../middleware/auth');
const { awardXP } = require('../lib/xp');

const router = express.Router();

// Application plan templates by kind of opportunity. `daysBefore` is how many
// days before the deadline each step should be done (used to back-plan dates).
const TEMPLATES = {
  scholarship: [
    ['check_eligibility', 'Check Eligibility', 'Leia o edital inteiro e confirme que você se encaixa (idade, ano escolar, nacionalidade).', 28],
    ['gather_documents', 'Gather Documents', 'Separe histórico escolar, documento de identidade e comprovantes pedidos.', 24],
    ['ask_recommendation', 'Get Recommendations', 'Peça a carta de recomendação com pelo menos 3 semanas de antecedência.', 21],
    ['write_essay', 'Write Essay', 'Escreva a redação/essay. Comece por um rascunho sem se preocupar com a perfeição.', 14],
    ['review', 'Review Application', 'Peça para alguém de confiança ler tudo antes de enviar.', 5],
    ['submit', 'Submit Application', 'Envie e guarde o comprovante (print ou e-mail de confirmação).', 2],
    ['record_result', 'Track Results', 'Quando sair o resultado, registre aqui — isso ajuda outros estudantes.', null],
  ],
  'summer-program': [
    ['check_eligibility', 'Check Eligibility', 'Confira idade, ano escolar e se o programa aceita estudantes de fora do país.', 35],
    ['check_costs', 'Check Costs & Aid', 'Veja quanto custa e se há bolsa ou isenção da taxa de inscrição (fee waiver). Peça se precisar.', 30],
    ['english_test', 'English Test', 'Se pedirem prova de inglês (TOEFL, IELTS, Duolingo), agende já.', 28],
    ['write_essay', 'Write Essay', 'Escreva as respostas/essays do formulário.', 14],
    ['ask_recommendation', 'Get Recommendations', 'Peça a recomendação a um professor com antecedência.', 21],
    ['submit', 'Submit Application', 'Envie e guarde o comprovante.', 2],
    ['record_result', 'Track Results', 'Registre o resultado quando sair.', null],
  ],
  competition: [
    ['read_rules', 'Read Rules', 'Leia o regulamento: datas, formato, quem pode participar.', 21],
    ['register', 'Register', 'Faça a inscrição (e monte a equipe, se for em grupo).', 14],
    ['prepare', 'Prepare', 'Monte um plano de estudo ou de projeto até a data da prova/entrega.', 7],
    ['submit', 'Submit Application', 'Entregue/participe e guarde o comprovante.', 0],
    ['record_result', 'Track Results', 'Registre o resultado quando sair.', null],
  ],
  career: [
    ['check_eligibility', 'Check Eligibility', 'Confira requisitos (ano do curso, visto/autorização de trabalho, idioma).', 21],
    ['resume', 'Update Resume', 'Adapte seu currículo para esta vaga.', 14],
    ['cover_letter', 'Write Cover Letter', 'Escreva a carta de apresentação.', 10],
    ['submit', 'Submit Application', 'Envie e guarde o comprovante.', 3],
    ['interview', 'Interview Prep', 'Prepare-se para uma possível entrevista.', null],
    ['record_result', 'Track Results', 'Registre o resultado quando sair.', null],
  ],
  default: [
    ['check_eligibility', 'Check Eligibility', 'Leia as regras e confirme que você pode participar.', 21],
    ['prepare', 'Prepare', 'Separe o que for pedido (documentos, textos, cartas).', 10],
    ['submit', 'Submit Application', 'Envie e guarde o comprovante.', 2],
    ['record_result', 'Track Results', 'Registre o resultado quando sair.', null],
  ],
};

function templateFor(category) {
  if (['scholarship', 'grant', 'fellowship', 'exchange'].includes(category)) return TEMPLATES.scholarship;
  if (['summer-program', 'research-program', 'conference', 'workshop', 'online-course'].includes(category)) return TEMPLATES['summer-program'];
  if (['competition', 'award', 'accelerator'].includes(category)) return TEMPLATES.competition;
  if (['internship', 'job', 'career-program'].includes(category)) return TEMPLATES.career;
  return TEMPLATES.default;
}

function generateTasks(opp, now = new Date()) {
  const deadline = opp.deadline ? new Date(opp.deadline) : null;
  const future = deadline && deadline > now;
  return templateFor(opp.category).map(([key, title, description, daysBefore], i) => {
    let dueDate = null;
    if (future && daysBefore !== null) {
      const d = new Date(deadline.getTime() - daysBefore * 86400000);
      dueDate = (d < now ? now : d).toISOString().slice(0, 10);
    }
    return { id: uuidv4(), order: i + 1, key, title, description, dueDate, isCompleted: false, xpReward: 25 };
  });
}

function progress(quest) {
  const done = quest.tasks.filter(t => t.isCompleted).length;
  quest.progressPercentage = quest.tasks.length ? Math.round((done / quest.tasks.length) * 100) : 0;
  quest.readinessScore = Math.min(100, 10 + done * 10);
}

// POST /api/quests — start an application plan (one per opportunity per student)
router.post('/', requireSelf, (req, res) => {
  const db = readDatabase();
  const opportunity = db.opportunities.find(o => o.id === (req.body && req.body.opportunityId));
  if (!opportunity) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  const userId = req.targetUserId;
  const existing = db.applicationQuests.find(q => q.userId === userId && q.opportunityId === opportunity.id && q.status !== 'withdrawn');
  if (existing) return res.json({ ...existing, alreadyExists: true, xpGained: 0 });

  const quest = {
    id: uuidv4(), userId, opportunityId: opportunity.id, startDate: new Date().toISOString(),
    status: 'in-progress', progressPercentage: 0, readinessScore: 10, tasks: generateTasks(opportunity),
  };
  db.applicationQuests.push(quest);
  const xp = awardXP(db, userId, 20);
  writeDatabase(db);
  res.json({ ...quest, ...xp });
});

router.get('/', requireSelf, (req, res) => {
  const db = readDatabase();
  res.json({ quests: db.applicationQuests.filter(q => q.userId === req.targetUserId) });
});

const STATUS_XP = { submitted: 70, accepted: 50 };
const STATUSES = ['in-progress', 'submitted', 'accepted', 'rejected', 'withdrawn'];

router.put('/:questId/status', requireAuth, (req, res) => {
  const db = readDatabase();
  const quest = db.applicationQuests.find(q => q.id === req.params.questId);
  if (!ownsRecord(req, quest)) return res.status(404).json({ error: 'Quest não encontrada' });
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const previous = quest.status;
  quest.status = status;
  quest.updatedAt = new Date().toISOString();
  if (status === 'submitted') quest.submittedAt = quest.submittedAt || quest.updatedAt;
  // XP only the first time a quest reaches a status, so it can't be farmed.
  quest.rewarded = quest.rewarded || {};
  let xp = { xpGained: 0 };
  if (STATUS_XP[status] && previous !== status && !quest.rewarded[status]) {
    quest.rewarded[status] = true;
    xp = awardXP(db, quest.userId, STATUS_XP[status]);
  }
  writeDatabase(db);
  res.json({ ...quest, ...xp });
});

// PUT /api/quests/:questId/tasks/:taskId — toggle a step (body.isCompleted, default true)
router.put('/:questId/tasks/:taskId', requireAuth, (req, res) => {
  const db = readDatabase();
  const quest = db.applicationQuests.find(q => q.id === req.params.questId);
  if (!ownsRecord(req, quest)) return res.status(404).json({ error: 'Quest não encontrada' });
  const task = quest.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
  const done = req.body && req.body.isCompleted === false ? false : true;
  let xp = { xpGained: 0 };
  if (done && !task.isCompleted && !task.rewarded) { task.rewarded = true; xp = awardXP(db, quest.userId, task.xpReward || 25); }
  task.isCompleted = done;
  task.completedAt = done ? new Date().toISOString() : null;
  progress(quest);
  writeDatabase(db);
  res.json({ ...quest, ...xp });
});

module.exports = router;
module.exports.generateTasks = generateTasks;
