const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'matched-secret-key-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.supabaseUser = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
