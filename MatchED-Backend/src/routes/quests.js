const express = require('express');
const { readDatabase, writeDatabase, updateInCollection } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const LEVEL_THRESHOLDS = [0, 300, 700, 1300, 2100, 3100, 4300, 5800, 7600, 9800, 12500];

function computeLevel(xpTotal) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

function awardXP(db, userId, amount) {
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return { xpGained: 0, xpTotal: 0, level: 1, levelUp: false };
  const user = db.users[idx];
  const prevXp = user.xpTotal || 0;
  const newXp = prevXp + amount;
  const prevLevel = computeLevel(prevXp);
  const newLevel = computeLevel(newXp);
  db.users[idx] = { ...user, xpTotal: newXp, level: newLevel };
  return { xpGained: amount, xpTotal: newXp, level: newLevel, levelUp: newLevel > prevLevel };
}

router.post('/', (req, res) => {
  try {
    const { userId, opportunityId } = req.body;
    const db = readDatabase();

    const opportunity = db.opportunities.find(o => o.id === opportunityId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const tasks = generateTasks(opportunity.audience);
    
    const quest = {
      id: uuidv4(),
      userId,
      opportunityId,
      startDate: new Date().toISOString(),
      status: 'in-progress',
      progressPercentage: 0,
      readinessScore: 10,
      tasks
    };

    db.applicationQuests.push(quest);
    const xpResult = awardXP(db, userId, 20);
    writeDatabase(db);

    res.json({ ...quest, ...xpResult });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateTasks(audience) {
  if (audience === 'high-school') {
    return [
      { id: uuidv4(), order: 1, title: 'Check Eligibility', description: 'Review requirements', isCompleted: false, xpReward: 50 },
      { id: uuidv4(), order: 2, title: 'Write Essay 1', description: 'Complete first essay prompt', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 3, title: 'Write Essay 2', description: 'Complete second essay prompt', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 4, title: 'Get Recommendations', description: 'Collect teacher recommendations', isCompleted: false, xpReward: 75 },
      { id: uuidv4(), order: 5, title: 'Prepare Transcript', description: 'Get official transcript', isCompleted: false, xpReward: 50 },
      { id: uuidv4(), order: 6, title: 'Review Application', description: 'Proofread all materials', isCompleted: false, xpReward: 75 },
      { id: uuidv4(), order: 7, title: 'Submit Application', description: 'Submit the application', isCompleted: false, xpReward: 150 },
      { id: uuidv4(), order: 8, title: 'Register for Interview', description: 'Schedule interview if required', isCompleted: false, xpReward: 75 },
      { id: uuidv4(), order: 9, title: 'Attend Interview', description: 'Complete the interview', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 10, title: 'Track Results', description: 'Record outcome', isCompleted: false, xpReward: 75 }
    ];
  } else {
    return [
      { id: uuidv4(), order: 1, title: 'Check Eligibility', description: 'Review requirements', isCompleted: false, xpReward: 50 },
      { id: uuidv4(), order: 2, title: 'Update Resume', description: 'Tailor your resume', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 3, title: 'Write Cover Letter', description: 'Create cover letter', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 4, title: 'Get Transcript', description: 'Collect official transcript', isCompleted: false, xpReward: 50 },
      { id: uuidv4(), order: 5, title: 'Verify Work Authorization', description: 'Confirm eligibility to work', isCompleted: false, xpReward: 75 },
      { id: uuidv4(), order: 6, title: 'Submit Application', description: 'Send completed application', isCompleted: false, xpReward: 150 },
      { id: uuidv4(), order: 7, title: 'Interview Prep', description: 'Prepare for potential interview', isCompleted: false, xpReward: 100 },
      { id: uuidv4(), order: 8, title: 'Track Results', description: 'Record outcome', isCompleted: false, xpReward: 75 }
    ];
  }
}

router.get('/', (req, res) => {
  try {
    const { userId } = req.query;
    const db = readDatabase();
    
    const quests = db.applicationQuests.filter(q => q.userId === userId);
    res.json({ quests });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:questId/status', (req, res) => {
  try {
    const { questId } = req.params;
    const { status, result } = req.body; // status: submitted|accepted|rejected|withdrawn
    const db = readDatabase();

    const quest = db.applicationQuests.find(q => q.id === questId);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });

    quest.status = status;
    if (result) quest.result = result;
    quest.updatedAt = new Date().toISOString();

    let xpResult = { xpGained: 0, xpTotal: 0, level: 1, levelUp: false };
    if (status === 'submitted') {
      xpResult = awardXP(db, quest.userId, 70);
    } else if (status === 'accepted') {
      xpResult = awardXP(db, quest.userId, 50);
    }

    writeDatabase(db);
    res.json({ ...quest, ...xpResult });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:questId/tasks/:taskId', (req, res) => {
  try {
    const { questId, taskId } = req.params;
    const db = readDatabase();

    const quest = db.applicationQuests.find(q => q.id === questId);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const task = quest.tasks.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    task.isCompleted = true;

    const completedTasks = quest.tasks.filter(t => t.isCompleted).length;
    quest.progressPercentage = Math.round((completedTasks / quest.tasks.length) * 100);
    quest.readinessScore = Math.min(100, 10 + (completedTasks * 10));

    writeDatabase(db);

    res.json(quest);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
