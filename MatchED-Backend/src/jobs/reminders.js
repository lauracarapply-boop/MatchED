// Deadline reminder e-mails.
//
// Once a day, every student who follows an opportunity (quest, saved or liked)
// gets one e-mail listing what closes in 7 days and in 2 days. Each
// (student, opportunity, window) is sent once. Studies of text/e-mail nudges for
// low-income students (e.g. Castleman & Page) found cheap, personalized reminders
// raise follow-through — this is the website's version of that.
const { readDatabase, writeDatabase } = require('../database/db');
const { deadlinesFor } = require('../routes/deadlines');
const mailer = require('../lib/mailer');
const { FRONTEND_URL, SMTP_CONFIGURED, REMINDERS_ENABLED } = require('../config');

const WINDOWS = [7, 2];

function fmt(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' });
}

async function runReminders(now = new Date()) {
  const db = readDatabase();
  const sentKeys = new Set(db.reminderLog.map(r => r.key));
  let emails = 0;
  for (const user of db.users) {
    if (user.reminderEmails === false || !user.email || user.emailVerified === false) continue;
    const due = deadlinesFor(db, user.id, now)
      .filter(d => WINDOWS.includes(d.daysLeft) && !['applied', 'waiting', 'accepted', 'rejected', 'did_not_apply'].includes(d.resultStatus))
      .filter(d => !sentKeys.has(`${user.id}|${d.opportunityId}|${d.daysLeft}`));
    if (!due.length) continue;
    const items = due.map(d => `<li style="margin-bottom:10px;"><strong>${mailer.escapeHtml(d.programName)}</strong><br/>
      <span style="color:#fbbf24;">Prazo: ${fmt(d.deadline)} (${d.daysLeft === 2 ? 'faltam 2 dias' : 'falta 1 semana'})</span></li>`).join('');
    try {
      const sent = await mailer.send({
        to: user.email,
        subject: due.length === 1 ? `⏰ ${due[0].programName}: prazo chegando` : `⏰ ${due.length} prazos chegando no MatchED`,
        html: mailer.layout('Seus prazos estão chegando', `
          <ul style="color:#e2e8f0;font-size:15px;padding-left:18px;margin:0 0 20px;">${items}</ul>
          ${mailer.button(`${FRONTEND_URL}/#/deadlines`, 'Ver meus prazos')}
          <p style="color:#94a3b8;font-size:12px;margin:18px 0 0;">Não quer mais lembretes? Desative em Perfil → Lembretes por e-mail.</p>`),
      });
      if (sent) {
        due.forEach(d => db.reminderLog.push({ key: `${user.id}|${d.opportunityId}|${d.daysLeft}`, at: now.toISOString() }));
        emails++;
      }
    } catch (e) { console.error('Reminder e-mail failed for', user.email, e.message); }
  }
  if (db.reminderLog.length > 50000) db.reminderLog.splice(0, db.reminderLog.length - 50000);
  writeDatabase(db);
  return emails;
}

function startReminderJob() {
  if (!REMINDERS_ENABLED || !SMTP_CONFIGURED) {
    console.log('ℹ️  Deadline reminder e-mails off (configure SMTP_* in .env to turn on).');
    return;
  }
  const tick = () => runReminders().then(n => n && console.log(`📬 Sent ${n} reminder e-mail(s)`)).catch(e => console.error('Reminder job:', e.message));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 6 * 3600_000).unref(); // every 6 hours; each reminder is only sent once
}

module.exports = { runReminders, startReminderJob };
