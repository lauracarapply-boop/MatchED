const cfg = require('./config');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initializeDatabase } = require('./database/db');
const { requireAdmin } = require('./middleware/auth');
const { startReminderJob } = require('./jobs/reminders');

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Railway/Netlify proxies

// ── CORS: the website's own origin plus any extra origins in CORS_ORIGINS ──
const allowed = new Set([
  cfg.FRONTEND_URL,
  `http://localhost:${cfg.PORT}`, 'http://localhost:5501', 'http://127.0.0.1:5501',
  ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
]);
app.use(cors({
  origin: (origin, cb) => (!origin || allowed.has(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
}));

// ── Basic security headers ──
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use(express.json({ limit: '200kb' }));

initializeDatabase();

// ── API ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/users', require('./routes/users'));
app.use('/api/saved-opportunities', require('./routes/savedOpportunities'));
app.use('/api/quests', require('./routes/quests'));
app.use('/api/deadlines', require('./routes/deadlines'));
app.use('/api/swipes', require('./routes/swipes'));
app.use('/api/results', require('./routes/resultTracking'));
app.use('/api/admin', require('./routes/admin'));
// Admin-only tools (data pipeline)
app.use('/api/sources', requireAdmin, require('./routes/sources'));
app.use('/api/captured-opportunities', requireAdmin, require('./routes/capturedOpportunities'));
app.use('/api/import', requireAdmin, require('./routes/importRoutes'));
app.use('/api/capture', requireAdmin, require('./routes/captureRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ── Website (MatchED-Web) ──
const webPath = path.join(__dirname, '../../MatchED-Web');
app.use(express.static(webPath, {
  setHeaders: (res, file) => {
    if (file.endsWith('config.js') || file.endsWith('sw.js') || file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
  },
}));
app.get('*', (req, res) => {
  const index = path.join(webPath, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Website not found');
});

// ── Errors ──
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ error: 'Origem não permitida' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

if (require.main === module) {
  app.listen(cfg.PORT, () => {
    console.log(`\n🚀 MatchED running at http://localhost:${cfg.PORT}`);
    console.log(`   Admin e-mails: ${cfg.ADMIN_EMAILS.join(', ') || '(none — set ADMIN_EMAILS in .env)'}`);
    console.log(`   E-mail: ${cfg.SMTP_CONFIGURED ? 'on' : 'off (codes are shown on screen in development)'}\n`);
    startReminderJob();
  });
}

module.exports = app;
