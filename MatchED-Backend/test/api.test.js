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
