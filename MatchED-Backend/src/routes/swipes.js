const express = require('express');
const { readDatabase, writeDatabase } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// XP awarded per action
const XP_VALUES = { like: 5, pass: 1, save: 3 };

// Level thresholds — total XP needed to reach each level
const LEVEL_THRESHOLDS = [0, 300, 700, 1300, 2100, 3100, 4300, 5800, 7600, 9800, 12500];

function computeLevel(xpTotal) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const inLevelStart = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 1000;
  const inLevel = xpTotal - inLevelStart;
  const needed = nextThreshold - inLevelStart;
  return { level, inLevel, needed, pct: Math.round((inLevel / needed) * 100) };
}

function updateStreak(user) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const last = user.lastActiveDate || null;

  if (last === today) {
    return { currentStreak: user.currentStreak || 0, lastActiveDate: today, streakChanged: false };
  }

  if (last) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === yesterday) {
      // Consecutive day — increment streak
      return { currentStreak: (user.currentStreak || 0) + 1, lastActiveDate: today, streakChanged: true };
    }
    // Missed a day — reset streak to 1
    return { currentStreak: 1, lastActiveDate: today, streakChanged: true };
  }

  // First activity ever
  return { currentStreak: 1, lastActiveDate: today, streakChanged: true };
}

router.post('/', (req, res) => {
  try {
    const { userId, opportunityId, action, matchScore } = req.body;
    const db = readDatabase();

    const swipe = {
      id: uuidv4(),
      userId,
      opportunityId,
      action,
      matchScore,
      matchType: 'interest-based',
      timestamp: new Date().toISOString()
    };

    db.swipeEvents.push(swipe);

    // Award XP and update streak
    const userIdx = db.users.findIndex(u => u.id === userId);
    let xpGained = 0;
    let levelUp = false;
    let newLevel = null;

    if (userIdx !== -1) {
      const user = db.users[userIdx];
      xpGained = XP_VALUES[action] || 0;
      const prevXp = user.xpTotal || 0;
      const newXp = prevXp + xpGained;

      const { level: prevLevel } = computeLevel(prevXp);
      const { level: updatedLevel } = computeLevel(newXp);

      const streakUpdate = updateStreak(user);

      db.users[userIdx] = {
        ...user,
        xpTotal: newXp,
        level: updatedLevel,
        currentStreak: streakUpdate.currentStreak,
        lastActiveDate: streakUpdate.lastActiveDate,
      };

      levelUp = updatedLevel > prevLevel;
      newLevel = updatedLevel;
    }

    writeDatabase(db);

    res.json({
      ...swipe,
      xpGained,
      xpTotal: db.users[userIdx]?.xpTotal || 0,
      level: newLevel,
      levelUp,
      currentStreak: db.users[userIdx]?.currentStreak || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    const db = readDatabase();
    const swipes = db.swipeEvents.filter(s => s.userId === userId);
    res.json({ swipes });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
