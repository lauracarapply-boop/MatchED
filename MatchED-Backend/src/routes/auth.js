const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { readDatabase, writeDatabase } = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'matched-secret-key-2026';
const JWT_EXPIRES = '30d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

function makeToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(user) {
  const { passwordHash, password, passwordResetCode, passwordResetExpiresAt, emailVerificationCode, ...rest } = user;
  return rest;
}

async function sendVerificationEmail(email, code) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s/g, '') },
  });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendUrl}/api/auth/verify-email?code=${code}&email=${encodeURIComponent(email)}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'MatchED <noreply@matched.app>',
    to: email,
    subject: 'MatchED — Confirme seu email / Confirm your email',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0B1A3E;border-radius:16px;color:#fff;">
        <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;">Match<span style="color:#A3E635;">ED</span></h1>
        <p style="color:#94a3b8;margin:0 0 24px;font-size:14px;">Your opportunity matching platform</p>
        <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;">Confirme seu email</h2>
        <p style="color:#cbd5e1;font-size:15px;margin:0 0 24px;">Clique no botão abaixo para ativar sua conta MatchED. O link expira em 24 horas.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#A3E635;color:#0B1A3E;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;">Confirmar email</a>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:28px 0;"/>
        <p style="color:#64748b;font-size:13px;">If you didn't create a MatchED account, ignore this email.</p>
      </div>
    `,
  });
}

// GET /api/auth/config — expose public config to frontend
router.get('/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = readDatabase();
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    // If account exists with a password already set, block re-registration
    if (existing && existing.passwordHash) {
      return res.status(409).json({ error: 'Email already registered. Try logging in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = uuidv4();

    // If account exists from old Supabase system (no password), just set the password
    if (existing) {
      const idx = db.users.indexOf(existing);
      db.users[idx].passwordHash = passwordHash;
      if (name && !db.users[idx].name) db.users[idx].name = name.trim();
      // Send verification email if not yet verified
      if (!db.users[idx].emailVerified) {
        db.users[idx].emailVerificationCode = verificationCode;
        db.users[idx].emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        writeDatabase(db);
        try { await sendVerificationEmail(db.users[idx].email, verificationCode); } catch {}
        return res.json({ needsVerification: true, email: db.users[idx].email });
      }
      writeDatabase(db);
      const token = makeToken(db.users[idx]);
      return res.json({ token, user: safeUser(db.users[idx]) });
    }

    const userId = uuidv4();
    const user = {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      country: null,
      userPath: null,
      planType: 'explorer',
      xpTotal: 0,
      level: 1,
      currentStreak: 0,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    db.subscriptionPlans = db.subscriptionPlans || [];
    db.subscriptionPlans.push({
      id: uuidv4(),
      userId,
      planType: 'explorer',
      swipesPerMonth: 30,
      savedOpportunities: 5,
      activeQuests: 1,
      createdAt: new Date().toISOString(),
    });
    writeDatabase(db);

    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      const idx = db.users.findIndex(u => u.id === userId);
      db.users[idx].emailVerified = true;
      writeDatabase(db);
      const token = makeToken(user);
      return res.json({ token, user: safeUser({ ...user, emailVerified: true }) });
    }

    let emailSent = true;
    try { await sendVerificationEmail(user.email, verificationCode); } catch (mailErr) {
      console.error('Verification email failed:', mailErr.message);
      emailSent = false;
    }

    // In dev, return token directly if email failed so testing isn't blocked
    if (!emailSent && process.env.NODE_ENV !== 'production') {
      const idx = db.users.findIndex(u => u.id === userId);
      db.users[idx].emailVerified = true;
      writeDatabase(db);
      const token = makeToken(user);
      return res.json({ token, user: safeUser({ ...user, emailVerified: true }) });
    }

    res.json({ needsVerification: true, email: user.email });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = readDatabase();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.passwordHash) return res.status(401).json({ error: 'no_password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/verify-email?code=xxx&email=xxx
router.get('/verify-email', async (req, res) => {
  const { code, email } = req.query;
  const origin = `http://localhost:${process.env.PORT || 3000}`;
  try {
    if (!code || !email) throw new Error('Invalid link');
    const db = readDatabase();
    const idx = db.users.findIndex(u => u.email.toLowerCase() === decodeURIComponent(email).toLowerCase().trim());
    if (idx === -1) throw new Error('User not found');

    const user = db.users[idx];
    if (user.emailVerificationCode !== code) throw new Error('Invalid or expired link');
    if (user.emailVerificationExpiresAt && new Date() > new Date(user.emailVerificationExpiresAt)) {
      throw new Error('Link expired. Request a new one from the login page.');
    }

    db.users[idx].emailVerified = true;
    db.users[idx].emailVerificationCode = null;
    db.users[idx].emailVerificationExpiresAt = null;
    writeDatabase(db);

    const token = makeToken(db.users[idx]);
    res.redirect(`${origin}/#oauth?token=${token}`);
  } catch (e) {
    res.redirect(`${origin}/#oauth?error=${encodeURIComponent(e.message)}`);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const db = readDatabase();
    const idx = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (idx === -1) return res.json({ ok: true }); // don't reveal existence
    if (db.users[idx].emailVerified) return res.json({ ok: true, alreadyVerified: true });

    const code = uuidv4();
    db.users[idx].emailVerificationCode = code;
    db.users[idx].emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    writeDatabase(db);

    try { await sendVerificationEmail(db.users[idx].email, code); } catch (mailErr) {
      console.error('Resend verification email failed:', mailErr.message);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const db = readDatabase();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    // Always respond OK to avoid email enumeration
    if (!user) return res.json({ ok: true });

    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const idx = db.users.indexOf(user);
    db.users[idx].passwordResetCode = code;
    db.users[idx].passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    writeDatabase(db);

    // Send email via nodemailer if configured
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s/g, '') },
      });
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#reset-password?code=${code}&email=${encodeURIComponent(email)}`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'MatchED <noreply@matched.app>',
        to: email,
        subject: 'MatchED — Redefinição de senha',
        html: `<p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Código: <strong>${code}</strong></p>`,
      });
    } catch (mailErr) {
      console.error('Email send failed:', mailErr.message);
      // Return code in response only in development so we can test
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ ok: true, dev_code: code });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return res.status(400).json({ error: 'email, code and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = readDatabase();
    const idx = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (idx === -1) return res.status(400).json({ error: 'Invalid or expired code' });

    const user = db.users[idx];
    if (user.passwordResetCode !== code.toUpperCase()) return res.status(400).json({ error: 'Invalid or expired code' });
    if (new Date() > new Date(user.passwordResetExpiresAt)) return res.status(400).json({ error: 'Code expired. Request a new one.' });

    db.users[idx].passwordHash = await bcrypt.hash(password, 10);
    db.users[idx].passwordResetCode = null;
    db.users[idx].passwordResetExpiresAt = null;
    writeDatabase(db);

    const token = makeToken(db.users[idx]);
    res.json({ ok: true, token, user: safeUser(db.users[idx]) });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/google — redirect to Google OAuth consent screen
router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env' });
  const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

// GET /api/auth/google/callback — exchange code for user info and create session
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const origin = `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Failed to get Google token');

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
    });
    const googleUser = await userRes.json();
    if (!googleUser.email) throw new Error('Failed to get Google user info');

    // Find or create user
    const db = readDatabase();
    let user = db.users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase());
    if (!user) {
      const userId = uuidv4();
      user = {
        id: userId,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name || googleUser.email.split('@')[0],
        googleId: googleUser.id,
        avatar: googleUser.picture || null,
        country: null,
        userPath: null,
        planType: 'explorer',
        xpTotal: 0, level: 1, currentStreak: 0,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.subscriptionPlans = db.subscriptionPlans || [];
      db.subscriptionPlans.push({ id: uuidv4(), userId, planType: 'explorer', swipesPerMonth: 30, savedOpportunities: 5, activeQuests: 1, createdAt: new Date().toISOString() });
      writeDatabase(db);
    } else if (!user.googleId) {
      const idx = db.users.indexOf(user);
      db.users[idx].googleId = googleUser.id;
      if (!db.users[idx].avatar && googleUser.picture) db.users[idx].avatar = googleUser.picture;
      user = db.users[idx];
      writeDatabase(db);
    }

    const token = makeToken(user);
    // Redirect back to frontend with token in URL fragment
    res.redirect(`${origin}/#oauth?token=${token}`);
  } catch (e) {
    console.error('Google OAuth error:', e);
    res.redirect(`${origin}/#oauth?error=${encodeURIComponent(e.message)}`);
  }
});

// POST /api/auth/google-token — verify a Google ID token from the browser and return our JWT
router.post('/google-token', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });
    if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID to .env' });

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const db = readDatabase();
    let user = db.users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());
    if (!user) {
      const userId = uuidv4();
      user = {
        id: userId,
        email: payload.email.toLowerCase(),
        name: payload.name || payload.email.split('@')[0],
        googleId: payload.sub,
        avatar: payload.picture || null,
        country: null,
        userPath: null,
        planType: 'explorer',
        xpTotal: 0, level: 1, currentStreak: 0,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.subscriptionPlans = db.subscriptionPlans || [];
      db.subscriptionPlans.push({ id: uuidv4(), userId, planType: 'explorer', swipesPerMonth: 30, savedOpportunities: 5, activeQuests: 1, createdAt: new Date().toISOString() });
      writeDatabase(db);
    } else if (!user.googleId) {
      const idx = db.users.indexOf(user);
      db.users[idx].googleId = payload.sub;
      if (!db.users[idx].avatar && payload.picture) db.users[idx].avatar = payload.picture;
      user = db.users[idx];
      writeDatabase(db);
    }

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    console.error('Google token verify error:', e.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// POST /api/auth/sync (legacy — now just returns user from JWT)
router.post('/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDatabase();
    const user = db.users.find(u => u.id === payload.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: safeUser(user) });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
