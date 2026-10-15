const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { readDatabase, writeDatabase } = require('../database/db');
const { makeToken, requireAuth, isAdminUser } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const mailer = require('../lib/mailer');
const { latestProfile } = require('../lib/profile');
const cfg = require('../config');

const router = express.Router();

function safeUser(user) {
  const {
    passwordHash, password, passwordResetCode, passwordResetExpiresAt, passwordResetAttempts,
    emailVerificationCode, emailVerificationExpiresAt, ...rest
  } = user;
  return { ...rest, isAdmin: isAdminUser(user) };
}

function normEmail(e) { return String(e || '').toLowerCase().trim(); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function newUser({ email, name, ref }) {
  return {
    id: uuidv4(), email, name: String(name || email.split('@')[0]).trim().slice(0, 80),
    emailVerified: false, country: 'BR', userPath: null, planType: 'explorer',
    xpTotal: 0, level: 1, currentStreak: 0, reminderEmails: true,
    partnerCode: ref ? String(ref).toUpperCase().slice(0, 20) : null,
    createdAt: new Date().toISOString(),
  };
}

// Verification is required only when we can actually send the e-mail.
const verificationRequired = () => !cfg.SKIP_EMAIL_VERIFICATION && cfg.SMTP_CONFIGURED;

async function sendVerificationEmail(email, code) {
  const url = `${cfg.API_URL}/api/auth/verify-email?code=${code}&email=${encodeURIComponent(email)}`;
  return mailer.send({
    to: email,
    subject: 'MatchED — Confirme seu e-mail',
    html: mailer.layout('Confirme seu e-mail', `
      <p style="color:#cbd5e1;font-size:15px;margin:0 0 22px;">Clique no botão para ativar sua conta. O link vale por 24 horas.</p>
      ${mailer.button(url, 'Confirmar e-mail')}`),
  });
}

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'auth' });

// GET /api/auth/config — public config for the website
router.get('/config', (req, res) => {
  res.json({ googleClientId: cfg.GOOGLE_CLIENT_ID || null, emailEnabled: cfg.SMTP_CONFIGURED });
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, password, ref } = req.body || {};
    const email = normEmail(req.body && req.body.email);
    if (!name || !email || !password) return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });

    const db = readDatabase();
    const existing = db.users.find(u => normEmail(u.email) === email);
    if (existing) {
      // An account created with Google has no password. Setting one here would let
      // anyone take over that account, so we send people to Google or password reset.
      const msg = existing.passwordHash
        ? 'Este e-mail já tem conta. Entre ou use "Esqueci minha senha".'
        : 'Este e-mail já tem conta (criada com Google). Entre com o Google ou use "Esqueci minha senha".';
      return res.status(409).json({ error: msg });
    }

    const user = newUser({ email, name, ref });
    user.passwordHash = await bcrypt.hash(String(password), 10);
    if (verificationRequired()) {
      user.emailVerificationCode = crypto.randomBytes(24).toString('hex');
      user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    } else {
      user.emailVerified = true;
    }
    db.users.push(user);
    writeDatabase(db);

    if (verificationRequired()) {
      try { await sendVerificationEmail(user.email, user.emailVerificationCode); }
      catch (e) { console.error('Verification e-mail failed:', e.message); }
      return res.json({ needsVerification: true, email: user.email });
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Erro interno. Tente de novo.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = normEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || '');
    if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
    const db = readDatabase();
    const user = db.users.find(u => normEmail(u.email) === email);
    const hash = user && (user.passwordHash || user.password); // older seed data used "password"
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (!hash) return res.status(401).json({ error: 'no_password' });
    if (!(await bcrypt.compare(password, hash))) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (!user.emailVerified && verificationRequired()) {
      return res.status(403).json({ error: 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada.', code: 'email_not_verified' });
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Erro interno. Tente de novo.' });
  }
});

// GET /api/auth/verify-email?code=&email= — link from the e-mail
router.get('/verify-email', (req, res) => {
  const back = (frag) => res.redirect(`${cfg.FRONTEND_URL}/#oauth?${frag}`);
  try {
    const email = normEmail(req.query.email);
    const db = readDatabase();
    const idx = db.users.findIndex(u => normEmail(u.email) === email);
    const user = db.users[idx];
    if (!user || !user.emailVerificationCode || user.emailVerificationCode !== String(req.query.code || '')) {
      return back('error=' + encodeURIComponent('Link inválido ou já usado.'));
    }
    if (user.emailVerificationExpiresAt && new Date() > new Date(user.emailVerificationExpiresAt)) {
      return back('error=' + encodeURIComponent('Link expirado. Peça um novo na tela de login.'));
    }
    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpiresAt = null;
    writeDatabase(db);
    back('token=' + makeToken(user));
  } catch (e) {
    back('error=' + encodeURIComponent('Não foi possível confirmar o e-mail.'));
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, async (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const db = readDatabase();
  const user = db.users.find(u => normEmail(u.email) === email);
  if (!user || user.emailVerified) return res.json({ ok: true }); // don't reveal whether the account exists
  user.emailVerificationCode = crypto.randomBytes(24).toString('hex');
  user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
  writeDatabase(db);
  try { await sendVerificationEmail(user.email, user.emailVerificationCode); } catch (e) { console.error(e.message); }
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  const email = normEmail(req.body && req.body.email);
  if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });
  const db = readDatabase();
  const user = db.users.find(u => normEmail(u.email) === email);
  if (!user) return res.json({ ok: true }); // same answer either way

  const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 characters
  user.passwordResetCode = code;
  user.passwordResetExpiresAt = new Date(Date.now() + 3600_000).toISOString();
  user.passwordResetAttempts = 0;
  writeDatabase(db);

  const link = `${cfg.FRONTEND_URL}/?code=${code}&email=${encodeURIComponent(user.email)}`;
  let sent = false;
  try {
    sent = await mailer.send({
      to: user.email,
      subject: 'MatchED — Redefinir senha',
      html: mailer.layout('Redefinir sua senha', `
        <p style="color:#cbd5e1;font-size:15px;margin:0 0 18px;">Use o botão (válido por 1 hora) ou digite o código <strong style="color:#A3E635;">${code}</strong>.</p>
        ${mailer.button(link, 'Criar nova senha')}`),
    });
  } catch (e) { console.error('Reset e-mail failed:', e.message); }
  // Only for local development without e-mail: show the code on screen.
  if (!sent && !cfg.isProduction) return res.json({ ok: true, dev_code: code });
  res.json({ ok: true });
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  const password = String((req.body && req.body.password) || '');
  if (!email || !code || !password) return res.status(400).json({ error: 'Informe e-mail, código e nova senha.' });
  if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
  const db = readDatabase();
  const user = db.users.find(u => normEmail(u.email) === email);
  const invalid = () => res.status(400).json({ error: 'Código inválido ou expirado.' });
  if (!user || !user.passwordResetCode) return invalid();
  if (new Date() > new Date(user.passwordResetExpiresAt)) return invalid();
  user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
  const ok = user.passwordResetCode.length === code.length &&
    crypto.timingSafeEqual(Buffer.from(user.passwordResetCode), Buffer.from(code));
  if (!ok || user.passwordResetAttempts > 5) {
    if (user.passwordResetAttempts > 5) user.passwordResetCode = null;
    writeDatabase(db);
    return invalid();
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  delete user.password;
  user.passwordResetCode = null;
  user.passwordResetExpiresAt = null;
  user.passwordResetAttempts = 0;
  user.emailVerified = true; // they proved access to the inbox
  writeDatabase(db);
  res.json({ ok: true, token: makeToken(user), user: safeUser(user) });
});

function findOrCreateGoogleUser(db, { email, name, googleId, picture, ref }) {
  let user = db.users.find(u => normEmail(u.email) === normEmail(email));
  if (!user) {
    user = newUser({ email: normEmail(email), name, ref });
    user.emailVerified = true;
    db.users.push(user);
  }
  if (!user.googleId) user.googleId = googleId;
  if (!user.avatar && picture) user.avatar = picture;
  user.emailVerified = true;
  writeDatabase(db);
  return user;
}

// GET /api/auth/google — server-side OAuth flow (fallback to the Google button)
router.get('/google', (req, res) => {
  if (!cfg.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Login com Google não configurado.' });
  const params = new URLSearchParams({
    client_id: cfg.GOOGLE_CLIENT_ID,
    redirect_uri: `${cfg.API_URL}/api/auth/google/callback`,
    response_type: 'code', scope: 'openid email profile', prompt: 'select_account',
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

router.get('/google/callback', async (req, res) => {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code || ''), client_id: cfg.GOOGLE_CLIENT_ID, client_secret: cfg.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${cfg.API_URL}/api/auth/google/callback`, grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.id_token) throw new Error('Falha no login com Google');
    const ticket = await new OAuth2Client(cfg.GOOGLE_CLIENT_ID).verifyIdToken({ idToken: tokens.id_token, audience: cfg.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p.email || p.email_verified === false) throw new Error('E-mail do Google não verificado');
    const db = readDatabase();
    const user = findOrCreateGoogleUser(db, { email: p.email, name: p.name, googleId: p.sub, picture: p.picture });
    res.redirect(`${cfg.FRONTEND_URL}/#oauth?token=${makeToken(user)}`);
  } catch (e) {
    console.error('Google OAuth error:', e.message);
    res.redirect(`${cfg.FRONTEND_URL}/#oauth?error=${encodeURIComponent('Não foi possível entrar com o Google.')}`);
  }
});

// POST /api/auth/google-token — Google button in the browser sends its ID token
router.post('/google-token', authLimiter, async (req, res) => {
  try {
    if (!cfg.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Login com Google não configurado.' });
    const ticket = await new OAuth2Client(cfg.GOOGLE_CLIENT_ID)
      .verifyIdToken({ idToken: String((req.body && req.body.credential) || ''), audience: cfg.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.email || p.email_verified === false) return res.status(400).json({ error: 'Conta Google inválida.' });
    const db = readDatabase();
    const user = findOrCreateGoogleUser(db, { email: p.email, name: p.name, googleId: p.sub, picture: p.picture, ref: req.body.ref });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error('Google token error:', e.message);
    res.status(401).json({ error: 'Não foi possível entrar com o Google.' });
  }
});

// GET /api/auth/me and POST /api/auth/sync — who am I (from the token)
function me(req, res) {
  const db = readDatabase();
  res.json({ user: safeUser(req.user), profile: latestProfile(db, req.user) });
}
router.get('/me', requireAuth, me);
router.post('/sync', requireAuth, me);

module.exports = router;
module.exports.safeUser = safeUser;
