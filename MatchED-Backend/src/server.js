const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./database/db');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const opportunitiesRoutes = require('./routes/opportunities');
const savedOpportunitiesRoutes = require('./routes/savedOpportunities');
const questsRoutes = require('./routes/quests');
const deadlinesRoutes = require('./routes/deadlines');
const swipesRoutes = require('./routes/swipes');
const adminRoutes = require('./routes/admin');
const sourcesRoutes = require('./routes/sources');
const capturedOpportunitiesRoutes = require('./routes/capturedOpportunities');
const importRoutes = require('./routes/importRoutes');
const captureRoutes = require('./routes/captureRoutes');
const resultTrackingRoutes = require('./routes/resultTracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app'))) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Serve frontend
const frontendPath = path.join(__dirname, '../../MatchED-Frontend');
app.use(express.static(frontendPath));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/saved-opportunities', savedOpportunitiesRoutes);
app.use('/api/quests', questsRoutes);
app.use('/api/deadlines', deadlinesRoutes);
app.use('/api/swipes', swipesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/captured-opportunities', capturedOpportunitiesRoutes);
app.use('/api/import', importRoutes);
app.use('/api/capture', captureRoutes);
app.use('/api/results', resultTrackingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 MatchED Backend Server running on http://localhost:' + PORT);
  console.log('📚 API available at http://localhost:' + PORT + '/api');
  console.log('🔗 Health check: http://localhost:' + PORT + '/api/health\n');
});
