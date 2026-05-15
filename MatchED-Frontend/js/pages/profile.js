import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, getLevelProgress } from '../utils.js';

export async function renderProfile() {
  return `
    <div class="profile-page">
      <div id="profile-content">
        <div class="spinner" style="margin-top:80px;"></div>
      </div>
    </div>
  `;
}

export async function bindProfile(router) {
  await loadProfile(router);
}

async function loadProfile(router) {
  const el = document.getElementById('profile-content');
  if (!el) return;

  try {
    const [userData, badgesData] = await Promise.all([
      api.users.get(state.user.id),
      api.users.badges(state.user.id),
    ]);

    const user = userData;
    state.updateUser(user);
    const { level, xpInLevel, xpNeeded, percent } = getLevelProgress(user.xpTotal || 0);
    const badges = badgesData.badges || [];
    const streak = user.currentStreak || 0;
    const firstName = user.name.split(' ')[0];

    const badgesHtml = badges.length > 0
      ? badges.map(b => `
        <div class="badge-item ${b.isLocked ? 'locked' : ''} rarity-${b.rarity}">
          <span class="badge-emoji">${b.icon || '🏅'}</span>
          <div class="badge-name">${b.name}</div>
          <div class="badge-rarity">${b.rarity}</div>
          ${b.isLocked ? `<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">${b.progress || 0}%</div>` : ''}
        </div>
      `).join('')
      : '<p style="color:var(--text-3);font-size:13px;">Complete tasks to earn badges!</p>';

    const pathLabel = user.userPath === 'high-school' ? '🏫 High School' : user.userPath === 'college' ? '🎓 College' : '👤 No path set';
    const planName = user.planType || 'explorer';

    el.innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar">${firstName[0].toUpperCase()}</div>
        <div class="profile-name">${user.name}</div>
        <div class="profile-email">${user.email}</div>
        <div class="profile-badge-pill">${pathLabel}</div>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-value">Lv.${level}</div>
          <div class="stat-label">Level</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${user.xpTotal || 0}</div>
          <div class="stat-label">Total XP</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">🔥${streak}</div>
          <div class="stat-label">Day Streak</div>
        </div>
      </div>

      <div class="xp-section">
        <div class="xp-header">
          <h3>Level ${level} → ${level + 1}</h3>
          <span>${xpInLevel} / ${xpNeeded} XP</span>
        </div>
        <div class="xp-bar">
          <div class="xp-fill" style="width: ${percent}%"></div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h3>Badges</h3>
          <span>${badges.filter(b => !b.isLocked).length} unlocked</span>
        </div>
        <div class="badges-grid">${badgesHtml}</div>
      </div>

      <div class="plan-card">
        <h3>Your Plan</h3>
        <div class="plan-name">${planName} plan</div>
        <div class="plan-desc">${planName === 'explorer' ? 'Upgrade to Applicant to unlock unlimited swipes and full checklists.' : 'You have full access to all MatchED features.'}</div>
        ${planName === 'explorer' ? '<button class="plan-btn">⚡ Upgrade to Applicant</button>' : '<button class="plan-btn" style="background:#00D4AA;">✓ Applicant Plan Active</button>'}
      </div>

      <div style="padding: 0 20px 24px; display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-ghost" id="change-path-btn">Change Path</button>
        <button class="btn btn-ghost" id="logout-btn" style="color:var(--danger);border-color:var(--danger);">Sign Out</button>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', () => {
      state.clear();
      router.go('login');
    });

    document.getElementById('change-path-btn').addEventListener('click', () => {
      router.go('onboarding');
    });

  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading profile</h3><p>${err.message}</p></div>`;
  }
}
