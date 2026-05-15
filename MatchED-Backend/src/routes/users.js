const express = require('express');
const { getCollection, readDatabase, writeDatabase, updateInCollection } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      userPath: user.userPath,
      planType: user.planType,
      xpTotal: user.xpTotal,
      level: user.level,
      currentStreak: user.currentStreak
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;
    const updated = updateInCollection('users', userId, { name });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ id: updated.id, name: updated.name, email: updated.email });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:userId/profile', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = user.userPath === 'high-school'
      ? db.highSchoolProfiles.slice().reverse().find(p => p.userId === userId)
      : db.collegeProfiles.slice().reverse().find(p => p.userId === userId);
    res.json({ profile: profile || null });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:userId/profile', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updates = req.body;
    if (user.userPath === 'high-school') {
      const idx = db.highSchoolProfiles.map(p => p.userId).lastIndexOf(userId);
      if (idx >= 0) Object.assign(db.highSchoolProfiles[idx], updates, { updatedAt: new Date().toISOString() });
      else db.highSchoolProfiles.push({ id: require('uuid').v4(), userId, ...updates, createdAt: new Date().toISOString() });
    } else {
      const idx = db.collegeProfiles.map(p => p.userId).lastIndexOf(userId);
      if (idx >= 0) Object.assign(db.collegeProfiles[idx], updates, { updatedAt: new Date().toISOString() });
      else db.collegeProfiles.push({ id: require('uuid').v4(), userId, ...updates, createdAt: new Date().toISOString() });
    }
    writeDatabase(db);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:userId/activity — called on app open, updates daily streak
router.post('/:userId/activity', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const user = db.users[idx];
    const today = new Date().toISOString().slice(0, 10);
    const last = user.lastActiveDate || null;

    let { currentStreak = 0 } = user;
    let streakChanged = false;

    if (last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (last === yesterday) { currentStreak += 1; streakChanged = true; }
      else { currentStreak = 1; streakChanged = true; }
      db.users[idx] = { ...user, currentStreak, lastActiveDate: today };
      writeDatabase(db);
    }

    res.json({ currentStreak, streakChanged, xpTotal: user.xpTotal || 0, level: user.level || 1 });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:userId/path', (req, res) => {
  try {
    const { userId } = req.params;
    const { userPath } = req.body;
    
    const updated = updateInCollection('users', userId, { userPath });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:userId/badges', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDatabase();
    
    const userBadges = db.userBadges.filter(ub => ub.userId === userId);
    const badges = db.badges;

    const result = userBadges.map(ub => {
      const badge = badges.find(b => b.id === ub.badgeId);
      return {
        ...badge,
        unlockedDate: ub.unlockedDate,
        isLocked: ub.isLocked,
        progress: ub.progress
      };
    });

    res.json({ badges: result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/profiles/high-school', (req, res) => {
  try {
    const { userId, age, grade, interests, goals, school } = req.body;
    const db = readDatabase();

    const profile = {
      id: uuidv4(),
      userId,
      age,
      grade,
      interests,
      goals,
      school,
      createdAt: new Date().toISOString()
    };

    db.highSchoolProfiles.push(profile);
    writeDatabase(db);

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/profiles/college', (req, res) => {
  try {
    const { userId, university, major, careerInterests, graduationYear } = req.body;
    const db = readDatabase();

    const profile = {
      id: uuidv4(),
      userId,
      university,
      major,
      careerInterests,
      graduationYear,
      createdAt: new Date().toISOString()
    };

    db.collegeProfiles.push(profile);
    writeDatabase(db);

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
