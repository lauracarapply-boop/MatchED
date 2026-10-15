// Central configuration. Read once at startup.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

// JWT secret: required in production. In development a random secret is generated
// once and kept in data/.jwt-secret so logins survive restarts.
function loadJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set (at least 32 characters) when NODE_ENV=production.');
  }
  const dataDir = path.dirname(process.env.DB_PATH || path.join(__dirname, '../data/db.json'));
  const file = path.join(dataDir, '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    fs.mkdirSync(dataDir, { recursive: true });
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

module.exports = {
  isProduction,
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: loadJwtSecret(),
  JWT_EXPIRES: '30d',
  ADMIN_EMAILS,
  // Public URL of the website (used in e-mails and redirects)
  FRONTEND_URL: (process.env.FRONTEND_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/$/, ''),
  // Public URL of this API (used for Google OAuth redirect). Defaults to FRONTEND_URL
  // because in the default setup the backend also serves the website.
  API_URL: (process.env.API_URL || process.env.FRONTEND_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/$/, ''),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION === 'true',
  SMTP_CONFIGURED: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  REMINDERS_ENABLED: process.env.REMINDERS_ENABLED !== 'false',
};
