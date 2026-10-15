// XP, levels and daily streak — one implementation for every route.
const LEVEL_THRESHOLDS = [0, 300, 700, 1300, 2100, 3100, 4300, 5800, 7600, 9800, 12500];

function computeLevel(xpTotal) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1; else break;
  }
  return level;
}

function awardXP(db, userId, amount) {
  const user = db.users.find(u => u.id === userId);
  if (!user || !amount) return { xpGained: 0, xpTotal: user ? user.xpTotal || 0 : 0, level: user ? user.level || 1 : 1, levelUp: false };
  const prev = user.xpTotal || 0;
  const prevLevel = computeLevel(prev);
  user.xpTotal = prev + amount;
  user.level = computeLevel(user.xpTotal);
  return { xpGained: amount, xpTotal: user.xpTotal, level: user.level, levelUp: user.level > prevLevel };
}

function touchStreak(user, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (user.lastActiveDate === today) return false;
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  user.currentStreak = user.lastActiveDate === yesterday ? (user.currentStreak || 0) + 1 : 1;
  user.lastActiveDate = today;
  return true;
}

module.exports = { LEVEL_THRESHOLDS, computeLevel, awardXP, touchStreak };
