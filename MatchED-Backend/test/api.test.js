// API tests. Run with: npm test
// Uses a throwaway database in the OS temp folder, never your real data.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'matched-test-'));
process.env.DB_PATH = path.join(tmp, 'db.json');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(64);
process.env.ADMIN_EMAILS = 'admin@test.dev';
process.env.SMTP_HOST = '';
process.env.REMINDERS_ENABLED = 'false';

let base, server;

async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data };
}

async function signup(email) {
  const r = await call('POST', '/api/auth/register', { body: { name: 'Teste', email, password: 'senha-forte-123' } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.data));
  return r.data;
}

before(async () => {
  const { writeDatabase, emptyDatabase } = require('../src/database/db');
  const db = emptyDatabase();
  const now = Date.now();
  db.opportunities.push(
    { id: 'opp-br', programName: 'Olimpíada Brasileira de Teste', category: 'competition', description: 'Para estudantes de escola pública do Brasil. Inscrição gratuita.', education_levels: ['high_school'], deadline: new Date(now + 10 * 864e5).toISOString(), websiteUrl: 'https://example.org/olimpiada', tags: ['mathematics'] },
    { id: 'opp-us', programName: 'Local US Scholarship', category: 'scholarship', description: 'Must be a U.S. citizen.', education_levels: ['high_school'], websiteUrl: 'https://example.org/us' },
    { id: 'opp-xss', programName: '<img src=x onerror=alert(1)>', category: 'scholarship', description: 'x', websiteUrl: 'javascript:alert(1)', education_levels: ['high_school'] },
  );
  writeDatabase(db);
  const app = require('../src/server');
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server && server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('health and public explorer work without login', async () => {
  assert.strictEqual((await call('GET', '/api/health')).status, 200);
  const r = await call('GET', '/api/opportunities');
  assert.strictEqual(r.status, 200);
  const ids = r.data.opportunities.map(o => o.id);
  assert.ok(ids.includes('opp-br'));
  assert.ok(!ids.includes('opp-us'), 'US-citizen-only opportunities are hidden by default');
  const all = await call('GET', '/api/opportunities?includeUSOnly=1');
  assert.ok(all.data.opportunities.some(o => o.id === 'opp-us'));
});

test('unsafe links are never sent to the website', async () => {
  const r = await call('GET', '/api/opportunities/opp-xss');
  assert.strictEqual(r.data.websiteUrl, '');
});

test('eligibility check returns Brazilian opportunity and logs an anonymous event', async () => {
  const r = await call('POST', '/api/opportunities/check', { body: { userPath: 'high-school', gradeLevel: 'em2', schoolType: 'publica_estadual', state: 'MG', interests: ['mathematics'] } });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.opportunities.some(o => o.id === 'opp-br'));
  assert.ok(!r.data.opportunities.some(o => o.id === 'opp-us'));
  const { readDatabase } = require('../src/database/db');
  assert.ok(readDatabase().checkEvents.length >= 1);
});

test('register, login and short passwords', async () => {
  const weak = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'weak@test.dev', password: '123' } });
  assert.strictEqual(weak.status, 400);
  const s = await signup('ana@test.dev');
  assert.ok(s.token);
  const dup = await call('POST', '/api/auth/register', { body: { name: 'B', email: 'ANA@test.dev', password: 'outra-senha-123' } });
  assert.strictEqual(dup.status, 409);
  const login = await call('POST', '/api/auth/login', { body: { email: 'ana@test.dev', password: 'senha-forte-123' } });
  assert.strictEqual(login.status, 200);
  const bad = await call('POST', '/api/auth/login', { body: { email: 'ana@test.dev', password: 'errada-123' } });
  assert.strictEqual(bad.status, 401);
});

test('a Google account cannot be taken over by registering its e-mail', async () => {
  const { readDatabase, writeDatabase } = require('../src/database/db');
  const db = readDatabase();
  db.users.push({ id: 'google-user', email: 'victim@test.dev', name: 'Victim', googleId: 'g1', emailVerified: true });
  writeDatabase(db);
  const r = await call('POST', '/api/auth/register', { body: { name: 'Attacker', email: 'victim@test.dev', password: 'attacker-pass-1' } });
  assert.strictEqual(r.status, 409);
  assert.ok(!readDatabase().users.find(u => u.id === 'google-user').passwordHash);
});

test('students cannot read or change other students\' data', async () => {
  const a = await signup('a@test.dev');
  const b = await signup('b@test.dev');
  assert.strictEqual((await call('GET', `/api/users/${b.user.id}`, { token: a.token })).status, 403);
  assert.strictEqual((await call('GET', `/api/quests?userId=${b.user.id}`, { token: a.token })).status, 403);
  assert.strictEqual((await call('GET', `/api/deadlines/${b.user.id}`, { token: a.token })).status, 403);
  assert.strictEqual((await call('GET', `/api/users/${b.user.id}`)).status, 401);
  const q = await call('POST', '/api/quests', { token: b.token, body: { userId: b.user.id, opportunityId: 'opp-br' } });
  assert.strictEqual(q.status, 200);
  const steal = await call('PUT', `/api/quests/${q.data.id}/status`, { token: a.token, body: { status: 'accepted' } });
  assert.strictEqual(steal.status, 404);
});

test('admin routes require an admin account', async () => {
  const s = await signup('notadmin@test.dev');
  assert.strictEqual((await call('GET', '/api/admin/opportunities')).status, 401);
  assert.strictEqual((await call('GET', '/api/admin/opportunities', { token: s.token })).status, 403);
  assert.strictEqual((await call('GET', '/api/sources', { token: s.token })).status, 403);
  assert.strictEqual((await call('POST', '/api/capture/run', { token: s.token })).status, 403);
  assert.strictEqual((await call('POST', '/api/import/sheets', { token: s.token })).status, 403);
  const admin = await signup('admin@test.dev');
  assert.strictEqual((await call('GET', '/api/admin/opportunities', { token: admin.token })).status, 200);
  const check = await call('GET', '/api/admin/check', { token: admin.token });
  assert.strictEqual(check.data.isAdmin, true);
});

test('quests: one per opportunity, XP not farmable, tasks dated before deadline', async () => {
  const s = await signup('quest@test.dev');
  const q1 = await call('POST', '/api/quests', { token: s.token, body: { opportunityId: 'opp-br' } });
  const q2 = await call('POST', '/api/quests', { token: s.token, body: { opportunityId: 'opp-br' } });
  assert.strictEqual(q1.data.id, q2.data.id);
  assert.strictEqual(q2.data.xpGained, 0);
  assert.ok(q1.data.tasks.some(t => t.dueDate), 'competition tasks are back-planned from the deadline');
  const sub1 = await call('PUT', `/api/quests/${q1.data.id}/status`, { token: s.token, body: { status: 'submitted' } });
  await call('PUT', `/api/quests/${q1.data.id}/status`, { token: s.token, body: { status: 'in-progress' } });
  const sub2 = await call('PUT', `/api/quests/${q1.data.id}/status`, { token: s.token, body: { status: 'submitted' } });
  assert.ok(sub1.data.xpGained > 0);
  assert.strictEqual(sub2.data.xpGained, 0);
  const t = q1.data.tasks[0];
  const undo = await call('PUT', `/api/quests/${q1.data.id}/tasks/${t.id}`, { token: s.token, body: { isCompleted: false } });
  assert.strictEqual(undo.status, 200);
});

test('profile keeps only known fields and canonical interests', async () => {
  const s = await signup('profile@test.dev');
  await call('PUT', `/api/users/${s.user.id}/path`, { token: s.token, body: { userPath: 'high-school' } });
  const r = await call('PUT', `/api/users/${s.user.id}/profile`, { token: s.token, body: { gradeLevel: 'em1', interests: ['liderança', 'technology', 'hack'], isAdmin: true, userId: 'other', schoolType: 'publica_federal' } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.data.profile.interests, ['leadership', 'technology']);
  assert.strictEqual(r.data.profile.isAdmin, undefined);
  assert.strictEqual(r.data.profile.userId, s.user.id);
});

test('password reset works with the code and locks after 5 wrong tries', async () => {
  await signup('reset@test.dev');
  const f = await call('POST', '/api/auth/forgot-password', { body: { email: 'reset@test.dev' } });
  assert.ok(f.data.dev_code, 'dev code shown when e-mail is off');
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/reset-password', { body: { email: 'reset@test.dev', code: 'WRONGCODE1', password: 'nova-senha-123' } });
  const locked = await call('POST', '/api/auth/reset-password', { body: { email: 'reset@test.dev', code: f.data.dev_code, password: 'nova-senha-123' } });
  assert.strictEqual(locked.status, 400);
  const f2 = await call('POST', '/api/auth/forgot-password', { body: { email: 'reset@test.dev' } });
  const ok = await call('POST', '/api/auth/reset-password', { body: { email: 'reset@test.dev', code: f2.data.dev_code, password: 'nova-senha-123' } });
  assert.strictEqual(ok.status, 200);
});

test('reports and public stats', async () => {
  const r = await call('POST', '/api/opportunities/opp-br/report', { body: { reason: 'broken_link', note: 'link quebrado' } });
  assert.strictEqual(r.status, 200);
  const stats = await call('GET', '/api/public/stats');
  assert.strictEqual(stats.status, 200);
  assert.ok(stats.data.opportunitiesVerified >= 1);
  assert.strictEqual(stats.data.publicSchoolShare, null, 'hidden while there is too little data');
});

test('admin can upload a spreadsheet; non-admins and non-xlsx files are refused', async () => {
  const ExcelJS = require('exceljs');
  const student = await signup('upload-student@test.dev');
  const login = await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'senha-forte-123' } });
  const adminToken = login.data.token;
  const post = (token, body) => fetch(base + '/api/import/xlsx', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + token }, body });
  assert.strictEqual((await post(student.token, Buffer.from('PK' + 'x'.repeat(200)))).status, 403);
  assert.strictEqual((await post(adminToken, Buffer.from('not a spreadsheet '.repeat(20)))).status, 400);
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Competições');
  ws.addRow(['Programa', 'Link', 'Descrição']);
  ws.addRow(['Olimpíada de Upload', 'https://example.org/upload', 'Competição gratuita para estudantes de escola pública']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const r = await post(adminToken, buf);
  assert.strictEqual(r.status, 200, await r.clone().text());
});

test('deadline text: reviewer notes hidden, yearly dates estimated', () => {
  const { cleanDeadlineText, estimateDeadline, tidyCaps } = require('../src/lib/opportunities');
  assert.strictEqual(cleanDeadlineText('Validate legitimacy, application cycle, and student relevance before publication.'), null);
  assert.strictEqual(cleanDeadlineText('500-5000'), null);
  assert.strictEqual(cleanDeadlineText('INSCRIÇÕES GERALMENTE DE DEZEMBRO ATÉ MARÇO'), 'Inscrições geralmente de dezembro até março');
  const now = new Date('2026-10-15T00:00:00Z');
  assert.strictEqual(estimateDeadline({ deadline_text: '7 de janeiro' }, now), '2027-01-07');
  assert.strictEqual(estimateDeadline({ deadline_text: '1 de Novembro' }, now), '2026-11-01');
  assert.strictEqual(estimateDeadline({ last_known_deadline: '2023-08-05' }, now), '2027-08-05');
  assert.strictEqual(estimateDeadline({ deadline: '2027-01-01', deadline_text: '7 de janeiro' }, now), null);
  assert.strictEqual(estimateDeadline({ deadline_text: 'Rolling admissions' }, now), null);
  assert.strictEqual(tidyCaps('NASA SEES HIGH SCHOOL INTERNSHIP'), 'NASA SEES High School Internship');
});

test('website scripts have no syntax errors', () => {
  const web = path.join(__dirname, '..', '..', 'MatchED-Web');
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const code of inline) assert.doesNotThrow(() => new Function(code), 'inline script in index.html');
  for (const f of ['tools.js', 'sw.js']) assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(web, f), 'utf8')), f);
});

test('curated Brazilian opportunities: import is repeatable, archives duplicates, shows up for public-school students', async () => {
  const { readDatabase, writeDatabase } = require('../src/database/db');
  const { importCurated, loadCurated } = require('../src/import/curated');
  const total = loadCurated().opportunities.length;
  const db = readDatabase();
  db.opportunities.push({ id: 'sheet-locke', programName: 'John Locke Essay Competition', websiteUrl: 'https://www.johnlockeinstitute.com/essay-competition', category: 'competition', status: 'published', active: true });
  const first = importCurated(db);
  assert.strictEqual(first.added, total);
  assert.strictEqual(db.opportunities.find(o => o.id === 'sheet-locke').active, false, 'spreadsheet copy archived');
  db.opportunities.find(o => o.id === 'br-ismart').status = 'archived';
  db.opportunities.find(o => o.id === 'br-ismart').active = false;
  const again = importCurated(db);
  assert.strictEqual(again.added, 0);
  assert.strictEqual(again.updated, total);
  assert.strictEqual(db.opportunities.filter(o => o.id === 'br-obmep').length, 1);
  assert.strictEqual(db.opportunities.find(o => o.id === 'br-ismart').active, false, 'admin archive decision kept');
  writeDatabase(db);

  for (const o of loadCurated().opportunities) assert.match(o.websiteUrl, /^https?:\/\//, o.id + ' has an official link');

  const br = await call('GET', '/api/opportunities?brazil=1&limit=200');
  const ids = br.data.opportunities.map(o => o.id);
  assert.ok(ids.includes('br-obmep') && ids.includes('br-jovens-embaixadores'));
  const uwc = br.data.opportunities.find(o => o.id === 'br-uwc');
  assert.strictEqual(uwc.flags.requiresUSCitizenship, false, 'RNE wording must not read as US-only');

  const check = await call('POST', '/api/opportunities/check', { body: { userPath: 'high-school', gradeLevel: 'em2', schoolType: 'publica_estadual', state: 'MG', birthYear: new Date().getFullYear() - 16, interests: ['mathematics'] } });
  const found = check.data.opportunities.map(o => o.id);
  assert.ok(found.includes('br-obmep'), 'OBMEP is shown to a public-school student');
});

test('a student can export and permanently delete their own data, and nobody else can', async () => {
  const me = await signup('lgpd@test.dev');
  const other = await signup('lgpd-other@test.dev');
  await call('POST', '/api/quests', { token: me.token, body: { opportunityId: 'opp-br' } });
  await call('POST', '/api/opportunities/opp-br/report', { token: me.token, body: { reason: 'wrong_info' } });
  const exp = await call('GET', `/api/users/${me.user.id}/export`, { token: me.token });
  assert.strictEqual(exp.status, 200);
  assert.strictEqual(exp.data.account.email, 'lgpd@test.dev');
  assert.ok(exp.data.applicationQuests.length >= 1);
  assert.ok(!JSON.stringify(exp.data).includes('passwordHash'));
  assert.strictEqual((await call('GET', `/api/users/${me.user.id}/export`, { token: other.token })).status, 403);
  assert.strictEqual((await call('DELETE', `/api/users/${me.user.id}`, { token: other.token, body: { confirm: 'EXCLUIR' } })).status, 403);
  assert.strictEqual((await call('DELETE', `/api/users/${me.user.id}`, { token: me.token, body: {} })).status, 400);
  const del = await call('DELETE', `/api/users/${me.user.id}`, { token: me.token, body: { confirm: 'EXCLUIR' } });
  assert.strictEqual(del.status, 200);
  const { readDatabase } = require('../src/database/db');
  const db = readDatabase();
  assert.ok(!db.users.some(u => u.id === me.user.id));
  assert.ok(!db.applicationQuests.some(q => q.userId === me.user.id));
  assert.ok(!db.opportunityReports.some(r => r.userId === me.user.id));
  assert.strictEqual((await call('GET', `/api/users/${me.user.id}`, { token: me.token })).status, 401, 'old login stops working');
});

test('data-quality queue: admins see what needs fixing and can fix it, flags included', async () => {
  const { readDatabase, writeDatabase } = require('../src/database/db');
  const db = readDatabase();
  db.opportunities.push({ id: 'q-empty', programName: 'Programa Sem Descrição', category: 'summer-program', education_levels: ['high_school'], websiteUrl: 'https://example.org/q', status: 'published', active: true,
    sheet_extra: { origin_or_modality: 'free highschool programs' } });
  writeDatabase(db);
  const student = await signup('quality-student@test.dev');
  assert.strictEqual((await call('GET', '/api/admin/quality', { token: student.token })).status, 403);
  const admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'senha-forte-123' } })).data.token;
  const q = await call('GET', '/api/admin/quality?issue=no_description', { token: admin });
  assert.strictEqual(q.status, 200);
  assert.ok(q.data.opportunities.some(o => o.id === 'q-empty'));
  assert.ok(q.data.counts.nationality >= 1);
  const fix = await call('PUT', '/api/admin/opportunities/q-empty', { token: admin, body: {
    description: 'Programa de verão gratuito para estudantes do ensino médio, aberto a estudantes de qualquer país.',
    deadline: '2027-02-01', deadline_text: 'Inscrições até 1º de fevereiro', flags: { checkNationality: false, openInternational: true, hacked: true } } });
  assert.strictEqual(fix.status, 200);
  assert.strictEqual(fix.data.flags.checkNationality, false);
  assert.strictEqual(fix.data.flags.openInternational, true);
  assert.strictEqual(fix.data.deadline, '2027-02-01');
  assert.strictEqual(readDatabase().opportunities.find(o => o.id === 'q-empty').flags.hacked, undefined, 'unknown flag keys dropped');
  const after = await call('GET', '/api/admin/quality?issue=no_description', { token: admin });
  assert.ok(!after.data.opportunities.some(o => o.id === 'q-empty'));
  const bad = await call('PUT', '/api/admin/opportunities/q-empty', { token: admin, body: { deadline: 'amanhã' } });
  assert.strictEqual(bad.data.deadline, '2027-02-01', 'invalid date ignored');
});

test('partner school dashboard: secret link only, small groups hidden', async () => {
  const admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'senha-forte-123' } })).data.token;
  const p = (await call('POST', '/api/admin/partners', { token: admin, body: { name: 'Escola Estadual Painel', city: 'BH', state: 'MG' } })).data;
  assert.ok(p.viewToken && p.viewToken.length >= 32);
  for (let i = 0; i < 2; i++) {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Aluno', email: `painel${i}@test.dev`, password: 'senha-forte-123', ref: p.code } });
    assert.strictEqual(r.status, 200);
  }
  await call('POST', '/api/opportunities/check', { body: { userPath: 'high-school', gradeLevel: 'em1', ref: p.code } });
  assert.strictEqual((await call('GET', `/api/public/partners/${p.code}/dashboard`)).status, 404);
  assert.strictEqual((await call('GET', `/api/public/partners/${p.code}/dashboard?t=wrong`)).status, 404);
  const d = await call('GET', `/api/public/partners/${p.code}/dashboard?t=${p.viewToken}`);
  assert.strictEqual(d.status, 200);
  assert.strictEqual(d.data.totals.students, 2);
  assert.ok(d.data.totals.checks >= 1);
  assert.strictEqual(d.data.byGrade, null, 'no breakdown under 5 students');
  assert.ok(!JSON.stringify(d.data).includes('@test.dev'), 'no e-mails leak');
  const rot = await call('POST', `/api/admin/partners/${p.id}/rotate`, { token: admin });
  assert.strictEqual((await call('GET', `/api/public/partners/${p.code}/dashboard?t=${p.viewToken}`)).status, 404, 'old link stops working');
  assert.strictEqual((await call('GET', `/api/public/partners/${p.code}/dashboard?t=${rot.data.viewToken}`)).status, 200);
});

// ── Banco de Oportunidades (aba "Mestre") ──
const BANCO_HEAD = ['ID', '⭐', 'Programa', 'Instituição / organização', 'Resumo', 'Tipo', 'Tags / áreas (majors p/ universidades)', 'Níveis',
  'Antes do EM', 'EM ano 1', 'EM ano 2', 'EM ano 3', 'Senior EM', 'Gap year', 'Freshman', 'Sophomore', 'Junior', 'Senior grad', 'Mestrado',
  'Prazo (próximo)', 'Dias até o prazo', 'Costuma abrir', 'Costuma fechar', 'Status', 'Link', 'Fonte(s)', 'País', 'Valor (moeda original)',
  'Valor máximo (US$)', 'Como o valor foi calculado', 'Observações / elegibilidade'];
const LV = ['P', 'E1', 'E2', 'E3', 'S', 'G', 'F', 'So', 'J', 'Sr', 'M'];
function bancoRow({ name, tipo = 'Bolsa', levels = [], deadline = '', link = '', notes = '', resumo = 'Resumo de teste com detalhes suficientes.', valor = '', usd = '' }) {
  return ['OP1', '', name, 'Org Teste', resumo, tipo, 'Ciência Política; Economia', '', ...LV.map(l => levels.includes(l) ? 'Sim' : ''),
    deadline, '', 'set', 'nov', '', link, 'Instagram @teste', 'Global', valor, usd, '', notes];
}
async function bancoXlsx(rows) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Leia-me').addRow(['Banco de Oportunidades']);
  const ws = wb.addWorksheet('Mestre');
  ws.addRow(BANCO_HEAD);
  rows.forEach(r => ws.addRow(bancoRow(r)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('Banco de Oportunidades: upload is recognised, routed safely and re-import updates instead of duplicating', async () => {
  const { readDatabase } = require('../src/database/db');
  const admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'senha-forte-123' } })).data.token;
  const post = (body) => fetch(base + '/api/import/xlsx', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: 'Bearer ' + admin }, body });
  const rows = [
    { name: 'Bolsa Banco Ensino Médio', levels: ['E1', 'E2'], deadline: new Date(Date.UTC(2099, 0, 15)), link: 'https://example.org/banco-em', valor: 'Bolsa integral', usd: 40000 },
    { name: 'Mestrado Banco Só Pós', tipo: 'Bolsa (mestrado)', levels: ['M'], link: 'https://example.org/banco-ms' },
    { name: 'Estágio Banco Só EUA', tipo: 'Estágio', levels: ['F', 'So'], link: 'https://example.org/banco-us', notes: 'Só para cidadãos dos EUA' },
    { name: 'Programa Banco Sem Link', tipo: 'Programa de verão', levels: ['E2'], link: 'https://www.google.com/search?q=programa' },
    { name: 'Curso Banco Pago', tipo: 'Curso', levels: ['E2'], link: 'https://example.org/banco-pago', notes: 'Cuidado — comercial' },
    { name: 'Newsletter Banco', tipo: 'Recurso', levels: ['F'], link: 'https://example.org/newsletter' },
    { name: 'Olimpíada Banco Post', tipo: 'Olimpíada', levels: ['E1'], link: 'https://www.instagram.com/p/ABC123/' },
  ];
  const r = await post(await bancoXlsx(rows));
  assert.strictEqual(r.status, 200, await r.clone().text());
  const log = await r.json();
  assert.strictEqual(log.import_source, 'banco-xlsx');
  assert.deepStrictEqual(log.by_destination, { opportunities: 4, captured_opportunities: 2, sources: 1 });

  let db = readDatabase();
  const em = db.opportunities.find(o => o.programName === 'Bolsa Banco Ensino Médio');
  assert.deepStrictEqual(em.grade_levels, ['E1', 'E2']);
  assert.deepStrictEqual(em.education_levels, ['high_school']);
  assert.strictEqual(em.deadline, '2099-01-15');
  assert.strictEqual(em.fundingType, 'full-scholarship');
  assert.strictEqual(em.funding_usd_max, 40000);
  assert.strictEqual(em.category, 'scholarship');
  assert.strictEqual(db.opportunities.find(o => o.programName === 'Estágio Banco Só EUA').flags.requiresUSCitizenship, true);
  assert.ok(db.capturedOpportunities.some(o => o.title === 'Programa Banco Sem Link' && o.status === 'needs_url_validation'), 'no official link → review');
  assert.ok(db.capturedOpportunities.some(o => o.title === 'Curso Banco Pago' && o.status === 'needs_review'), '"Cuidado" never goes live');
  assert.ok(db.sources.some(s => s.name === 'Newsletter Banco'));
  assert.strictEqual(db.opportunities.find(o => o.programName === 'Olimpíada Banco Post').needs_official_link, true);

  // An admin fixes one record by hand; the next import must not undo it.
  const post1 = db.opportunities.find(o => o.programName === 'Olimpíada Banco Post');
  const q = await call('GET', '/api/admin/quality?issue=social_link', { token: admin });
  assert.ok(q.data.opportunities.some(o => o.id === post1.id), 'social-post links are in the quality queue');
  await call('PUT', '/api/admin/opportunities/' + post1.id, { token: admin, body: { websiteUrl: 'https://example.org/olimpiada-oficial', description: 'Descrição revisada pela equipe.' } });

  // Re-import with a changed summary: updates, never duplicates.
  rows[0].resumo = 'Resumo atualizado na planilha.';
  rows[6].resumo = 'Resumo da planilha que não deve apagar a revisão.';
  const again = await (await post(await bancoXlsx(rows))).json();
  assert.deepStrictEqual(again.by_destination, { opportunities: 0, captured_opportunities: 0, sources: 0 });
  db = readDatabase();
  assert.strictEqual(db.opportunities.filter(o => o.programName === 'Bolsa Banco Ensino Médio').length, 1);
  assert.strictEqual(db.opportunities.find(o => o.programName === 'Bolsa Banco Ensino Médio').description, 'Resumo atualizado na planilha.');
  const fixed = db.opportunities.find(o => o.id === post1.id);
  assert.strictEqual(fixed.description, 'Descrição revisada pela equipe.', 'admin edits win over the spreadsheet');
  assert.strictEqual(fixed.needs_official_link, false);
  assert.strictEqual(fixed.websiteUrl, 'https://example.org/olimpiada-oficial');

  // Matching uses the Banco's school years.
  const check = await call('POST', '/api/opportunities/check', { body: { userPath: 'high-school', gradeLevel: 'em1', limit: 30 } });
  const names = check.data.opportunities.map(o => o.programName);
  assert.ok(names.includes('Bolsa Banco Ensino Médio'));
  assert.ok(!names.includes('Mestrado Banco Só Pós'), 'master’s-only hidden from high school');
  assert.ok(!names.includes('Estágio Banco Só EUA'));
});

test('Banco Google Sheet: status endpoint, refuses when not configured, parses the CSV export', async () => {
  const admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'senha-forte-123' } })).data.token;
  const s = await call('GET', '/api/import/banco', { token: admin });
  assert.strictEqual(s.status, 200);
  assert.strictEqual(s.data.configured, false);
  assert.strictEqual((await call('POST', '/api/import/banco', { token: admin })).status, 400);
  const student = await signup('banco-student@test.dev');
  assert.strictEqual((await call('GET', '/api/import/banco', { token: student.token })).status, 403);

  const { csvToObjects, parseBancoRows, parseBancoDate, bancoCsvUrl } = require('../src/import/bancoImporter');
  const csv = [BANCO_HEAD, bancoRow({ name: 'Bolsa, com vírgula "e aspas"', levels: ['S', 'G'], deadline: '15/01/2027', link: 'https://example.org/x', usd: 'US$ 12,000' })]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const [row] = parseBancoRows(csvToObjects(csv));
  assert.strictEqual(row.name, 'Bolsa, com vírgula "e aspas"');
  assert.strictEqual(row.deadline, '2027-01-15');
  assert.deepStrictEqual(row.grade_levels, ['S', 'G']);
  assert.strictEqual(row.funding_usd_max, 12000);
  assert.strictEqual(parseBancoDate(46318), '2026-10-23', 'Excel serial dates');
  assert.ok(bancoCsvUrl('abc').includes('sheet=Mestre'));
});

test('curated programs replace spreadsheet copies with a longer name, but not other programs', () => {
  const { importCurated } = require('../src/import/curated');
  const db = { opportunities: [
    { id: 'a', programName: 'Programa Jovens Embaixadores', websiteUrl: 'https://x.org/a' },
    { id: 'b', programName: 'OBMEP – Olimpíada Brasileira de Matemática das Escolas Públicas', websiteUrl: 'https://x.org/b' },
    { id: 'c', programName: 'Jovens Embaixadores Max Thabiso Edkins', websiteUrl: 'https://x.org/c' },
  ] };
  importCurated(db);
  const byId = id => db.opportunities.find(o => o.id === id);
  assert.strictEqual(byId('a').status, 'archived');
  assert.strictEqual(byId('b').status, 'archived');
  assert.notStrictEqual(byId('c').status, 'archived', 'a different program with a similar name stays');
});

test('Banco: the curator’s personal notes never reach students', () => {
  const { publicNotes } = require('../src/import/bancoImporter');
  assert.strictEqual(publicNotes('PRIORIDADE MÁXIMA — prazo 12/nov'), 'prazo 12/nov');
  assert.strictEqual(publicNotes('13–18 | PRIORIDADE — ciclo anual'), '13–18 | ciclo anual');
  assert.strictEqual(publicNotes('PRIORIDADE — MatchED se qualifica'), '');
  assert.strictEqual(publicNotes('PRIORIDADE (Gov+DCS) — proponha uma sessão sobre desinformação'), '');
  assert.strictEqual(publicNotes('Só cidadãos dos EUA'), 'Só cidadãos dos EUA');
});
