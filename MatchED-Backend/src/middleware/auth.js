// Authentication and authorization.
//
// Every request may carry "Authorization: Bearer <jwt>". The token proves who
// the user is; the server never trusts a userId sent in the body or URL on its own.
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES, ADMIN_EMAILS } = require('../config');
const { readDatabase } = require('../database/db');

function makeToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function isAdminUser(user) {
  return Boolean(user && user.email && user.emailVerified !== false && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}

// Reads the token if present and attaches req.user (the full DB user). Never rejects.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const db = readDatabase();
      const user = (db.users || []).find(u => u.id === payload.sub);
      if (user) req.user = user;
    } catch { /* invalid or expired token: treat as anonymous */ }
  }
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'auth_required' });
    req.isAdmin = isAdminUser(req.user);
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: 'Acesso restrito à equipe MatchED.', code: 'forbidden' });
    next();
  });
}

// For routes that receive a userId (URL param, query or body): the userId must be
// the logged-in user's own id (admins may act on anyone). Missing userId defaults
// to the logged-in user.
function requireSelf(req, res, next) {
  requireAuth(req, res, () => {
    const claimed = req.params.userId || (req.query && req.query.userId) || (req.body && req.body.userId);
    if (claimed && claimed !== req.user.id && !req.isAdmin) {
      return res.status(403).json({ error: 'Você só pode acessar os seus próprios dados.', code: 'forbidden' });
    }
    req.targetUserId = claimed || req.user.id;
    next();
  });
}

// Ownership check for records that carry a userId (quests, results, saved items).
function ownsRecord(req, record) {
  return Boolean(record && (record.userId === req.user.id || req.isAdmin));
}

module.exports = { makeToken, optionalAuth, requireAuth, requireAdmin, requireSelf, ownsRecord, isAdminUser };
