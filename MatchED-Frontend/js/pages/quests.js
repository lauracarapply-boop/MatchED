import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../utils.js';

export async function renderQuests() {
  return `
    <div style="min-height:100dvh; padding-bottom:80px;">
      <div class="page-header">
        <h1>Application Quests 📋</h1>
        <p>Track your applications step by step</p>
      </div>
      <div class="quests-list" id="quests-list">
        <div class="spinner"></div>
      </div>
    </div>
  `;
}

export async function bindQuests() {
  await loadQuests();
}

async function loadQuests() {
  const listEl = document.getElementById('quests-list');
  if (!listEl) return;

  try {
    const [questsData, oppsData] = await Promise.all([
      api.quests.list(state.user.id),
      api.opportunities.list(100),
    ]);

    const quests = questsData.quests || [];
    const oppsMap = {};
    (oppsData.opportunities || []).forEach(o => { oppsMap[o.id] = o; });

    if (quests.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No active quests</h3>
          <p>Start an application quest from Discover or Saved to track your progress.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    quests.forEach(quest => {
      const opp = oppsMap[quest.opportunityId];
      const card = buildQuestCard(quest, opp);
      listEl.appendChild(card);
    });

    bindTaskCheckboxes();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading quests</h3><p>${err.message}</p></div>`;
  }
}

function buildQuestCard(quest, opp) {
  const div = document.createElement('div');
  div.className = 'quest-card';
  div.dataset.questId = quest.id;

  const completedCount = (quest.tasks || []).filter(t => t.isCompleted).length;
  const totalTasks = (quest.tasks || []).length;
  const progress = quest.progressPercentage || 0;
  const readiness = quest.readinessScore || 0;

  const tasksHtml = (quest.tasks || [])
    .map(task => `
      <div class="task-item ${task.isCompleted ? 'completed' : ''}" data-quest-id="${quest.id}" data-task-id="${task.id}">
        <div class="task-check">${task.isCompleted ? '✓' : ''}</div>
        <span class="task-title">${task.title}</span>
        <span class="task-xp">+${task.xpReward} XP</span>
      </div>
    `).join('');

  div.innerHTML = `
    <div class="quest-card-header">
      <h4>${opp ? opp.programName : 'Unknown Opportunity'}</h4>
      <div class="quest-org">${opp ? opp.organizationName : ''}</div>
      <div class="quest-progress-bar">
        <div class="quest-progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="quest-progress-label">
        <span>${completedCount}/${totalTasks} tasks</span>
        <span>Readiness: ${readiness}%</span>
      </div>
    </div>
    <div class="quest-tasks">
      <h5>Tasks</h5>
      ${tasksHtml}
    </div>
  `;

  return div;
}

function bindTaskCheckboxes() {
  document.querySelectorAll('.task-item:not(.completed)').forEach(item => {
    item.addEventListener('click', async () => {
      const questId = item.dataset.questId;
      const taskId = item.dataset.taskId;

      item.style.opacity = '0.5';

      try {
        const updatedQuest = await api.quests.completeTask(questId, taskId);

        const xpEl = item.querySelector('.task-xp');
        const xp = xpEl ? parseInt(xpEl.textContent) : 0;

        item.classList.add('completed');
        item.querySelector('.task-check').textContent = '✓';
        item.style.opacity = '';
        item.style.cursor = 'default';

        const questCard = item.closest('.quest-card');
        if (questCard) {
          const fill = questCard.querySelector('.quest-progress-fill');
          const label = questCard.querySelectorAll('.quest-progress-label span');
          if (fill) fill.style.width = `${updatedQuest.progressPercentage}%`;
          if (label[0]) {
            const completed = updatedQuest.tasks.filter(t => t.isCompleted).length;
            label[0].textContent = `${completed}/${updatedQuest.tasks.length} tasks`;
          }
          if (label[1]) label[1].textContent = `Readiness: ${updatedQuest.readinessScore}%`;
        }

        showToast(`+${xp} XP earned! 🎉`, 'success');

        state.updateUser({ xpTotal: (state.user.xpTotal || 0) + xp });
      } catch (err) {
        item.style.opacity = '';
        showToast(err.message || 'Error', 'error');
      }
    });
  });
}
