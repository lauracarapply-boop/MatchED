// E-mail sending. If SMTP is not configured, mail is logged instead of sent,
// and callers can tell (send() resolves to false).
const { SMTP_CONFIGURED } = require('../config');

let transporter = null;
function getTransporter() {
  if (!SMTP_CONFIGURED) return null;
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s/g, '') },
    });
  }
  return transporter;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout(title, bodyHtml) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#0B1A3E;border-radius:16px;color:#fff;">
    <div style="font-size:26px;font-weight:800;margin:0 0 18px;">Match<span style="color:#A3E635;">ED</span></div>
    <h2 style="font-size:19px;font-weight:700;margin:0 0 12px;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:24px 0;"/>
    <p style="color:#94a3b8;font-size:12px;margin:0;">Você recebe este e-mail porque tem uma conta no MatchED.</p>
  </div>`;
}

function button(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#A3E635;color:#0B1A3E;font-weight:700;font-size:15px;padding:13px 24px;border-radius:12px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

async function send({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail not sent — SMTP not configured] to=${to} subject="${subject}"`);
    return false;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || `MatchED <${process.env.SMTP_USER}>`, to, subject, html });
  return true;
}

module.exports = { send, layout, button, escapeHtml };
