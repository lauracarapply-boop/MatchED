#!/usr/bin/env node
// Create (or reset the password of) an admin account in the local database.
//   npm run create-admin -- you@email.com "a-strong-password"
// The e-mail must also be listed in ADMIN_EMAILS in .env.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) {
    console.error('Usage: npm run create-admin -- you@email.com "password with 12+ characters"');
    process.exit(1);
  }
  const { readDatabase, writeDatabase, initializeDatabase } = require('../src/database/db');
  initializeDatabase();
  const db = readDatabase();
  const e = email.toLowerCase().trim();
  let user = db.users.find(u => u.email.toLowerCase() === e);
  if (!user) {
    user = { id: uuidv4(), email: e, name: 'Admin', userPath: null, planType: 'explorer', xpTotal: 0, level: 1, currentStreak: 0, createdAt: new Date().toISOString() };
    db.users.push(user);
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  delete user.password;
  user.emailVerified = true;
  writeDatabase(db);
  const admins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim());
  console.log(`✅ Account ready: ${e}`);
  if (!admins.includes(e)) console.log(`⚠️  Add it to ADMIN_EMAILS in MatchED-Backend/.env, then restart the server: ADMIN_EMAILS=${e}`);
})().catch(err => { console.error(err); process.exit(1); });
