import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, formatDeadline, getCategoryIcon, getCategoryLabel } from '../utils.js';

export async function renderSaved() {
  return `
    <div style="min-height:100dvh; padding-bottom:80px;">
      <div class="page-header">
        <h1>Saved 🔖</h1>
        <p>Opportunities you've bookmarked</p>
      </div>
      <div class="saved-list" id="saved-list">
        <div class="spinner"></div>
      </div>
    </div>
  `;
}

export async function bindSaved(router) {
  await loadSaved(router);
}

async function loadSaved(router) {
  const listEl = document.getElementById('saved-list');
  if (!listEl) return;

  try {
    const [savedData, oppsData] = await Promise.all([
      api.saved.list(state.user.id),
      api.opportunities.list(100),
    ]);

    const saved = (savedData.savedOpportunities || []).filter(s => s.status !== 'removed');
    const oppsMap = {};
    (oppsData.opportunities || []).forEach(o => { oppsMap[o.id] = o; });

    if (saved.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔖</div>
          <h3>No saved opportunities</h3>
          <p>Swipe right or tap 🔖 in Discover to save opportunities for later.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    saved.forEach(item => {
      const opp = oppsMap[item.opportunityId];
      if (!opp) return;

      const card = document.createElement('div');
      card.className = 'saved-card';
      card.dataset.savedId = item.id;

      card.innerHTML = `
        <div class="card-icon">${getCategoryIcon(opp.category)}</div>
        <div class="card-content">
          <h4>${opp.programName}</h4>
          <div class="org">${opp.organizationName} · ${getCategoryLabel(opp.category)}</div>
          ${opp.deadline ? `<div class="meta-item" style="font-size:12px;color:#E65100;"><span>⏰</span> ${formatDeadline(opp.deadline)}</div>` : ''}
          <div class="card-actions" style="margin-top:10px;">
            <button class="btn btn-primary btn-sm start-quest-btn" data-opp-id="${opp.id}">📋 Start Quest</button>
            <button class="btn btn-ghost btn-sm remove-saved-btn" data-saved-id="${item.id}">Remove</button>
          </div>
        </div>
      `;

      listEl.appendChild(card);
    });

    listEl.querySelectorAll('.start-quest-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oppId = btn.dataset.oppId;
        btn.disabled = true;
        btn.textContent = 'Starting...';
        try {
          await api.quests.create(state.user.id, oppId);
          showToast('Quest started! 🚀', 'success');
          router.go('quests');
        } catch (err) {
          showToast(err.message || 'Error', 'error');
          btn.disabled = false;
          btn.textContent = '📋 Start Quest';
        }
      });
    });

    listEl.querySelectorAll('.remove-saved-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const savedId = btn.dataset.savedId;
        try {
          await api.saved.remove(savedId);
          const card = listEl.querySelector(`[data-saved-id="${savedId}"]`);
          if (card) card.remove();
          showToast('Removed', 'info');
          if (listEl.children.length === 0) loadSaved(router);
        } catch (_) {
          showToast('Error removing', 'error');
        }
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading saved items</h3><p>${err.message}</p></div>`;
  }
}
