import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, formatDeadline, getCategoryIcon, getCategoryLabel } from '../utils.js';

let opportunities = [];
let currentIndex = 0;
let swipedIds = new Set();
let activeFilter = 'all';

export async function renderDiscover(router) {
  const firstName = state.user.name.split(' ')[0];
  const streak = state.user.currentStreak || 0;

  return `
    <div class="discover-page">
      <div class="discover-header">
        <div>
          <div class="greeting">Hey, ${firstName} 👋</div>
          <h1>Discover</h1>
        </div>
        <div class="streak-badge">🔥 ${streak} day${streak !== 1 ? 's' : ''}</div>
      </div>

      <div class="filter-bar">
        <button class="chip active" data-filter="all">All</button>
        <button class="chip" data-filter="scholarship">Scholarships</button>
        <button class="chip" data-filter="internship">Internships</button>
        <button class="chip" data-filter="fellowship">Fellowships</button>
        <button class="chip" data-filter="summer-program">Summer Programs</button>
      </div>

      <div class="card-stack" id="card-stack">
        <div class="spinner"></div>
      </div>

      <div class="swipe-actions">
        <button class="action-btn pass" id="btn-pass" title="Pass">✕</button>
        <button class="action-btn save" id="btn-save" title="Save for later">🔖</button>
        <button class="action-btn quest" id="btn-quest" title="Start application">📋</button>
        <button class="action-btn like" id="btn-like" title="Like">♥</button>
      </div>
    </div>
  `;
}

export async function bindDiscover(router) {
  await loadOpportunities();

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      currentIndex = 0;
      renderCards();
    });
  });

  document.getElementById('btn-pass').addEventListener('click', () => swipeCard('pass'));
  document.getElementById('btn-like').addEventListener('click', () => swipeCard('like'));
  document.getElementById('btn-save').addEventListener('click', () => saveCurrentCard());
  document.getElementById('btn-quest').addEventListener('click', () => startQuestForCurrent(router));
}

async function loadOpportunities() {
  try {
    const data = await api.opportunities.list(50);
    const swipedData = await api.swipes.list(state.user.id);
    swipedIds = new Set(swipedData.swipes.map(s => s.opportunityId));

    opportunities = (data.opportunities || []).filter(o => !swipedIds.has(o.id));

    const userPath = state.user.userPath;
    if (userPath) {
      opportunities.sort((a, b) => {
        const aMatch = a.audience === userPath ? 1 : 0;
        const bMatch = b.audience === userPath ? 1 : 0;
        return bMatch - aMatch || b.matchScore - a.matchScore;
      });
    }

    renderCards();
  } catch (err) {
    document.getElementById('card-stack').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Could not load opportunities</h3>
        <p>Make sure the backend server is running on port 3000.</p>
      </div>`;
  }
}

function getFilteredOpportunities() {
  if (activeFilter === 'all') return opportunities;
  return opportunities.filter(o => o.category === activeFilter);
}

function renderCards() {
  const stack = document.getElementById('card-stack');
  if (!stack) return;

  const filtered = getFilteredOpportunities();
  const remaining = filtered.slice(currentIndex);

  if (remaining.length === 0) {
    stack.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <h3>You've seen them all!</h3>
        <p>Check back later for new opportunities, or explore other categories.</p>
      </div>`;
    return;
  }

  stack.innerHTML = '';

  remaining.slice(0, 3).reverse().forEach((opp, i) => {
    const cardClass = i === 2 ? 'card-1' : i === 1 ? 'card-2' : 'card-3';
    const card = buildCard(opp, cardClass);
    stack.appendChild(card);
  });

  setupDragSwipe(stack);
}

function buildCard(opp, posClass) {
  const div = document.createElement('div');
  div.className = `opportunity-card ${posClass}`;
  div.dataset.id = opp.id;
  div.dataset.matchScore = opp.matchScore;

  const daysLeft = opp.deadline ? formatDeadline(opp.deadline) : 'Open';
  const tags = (opp.tags || []).slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join('');
  const categoryColor = getCategoryColor(opp.category);

  div.innerHTML = `
    <div class="swipe-indicator swipe-like">LIKE</div>
    <div class="swipe-indicator swipe-pass">PASS</div>
    <div class="card-header" style="background: ${categoryColor}">
      <div class="card-category">${getCategoryIcon(opp.category)} ${getCategoryLabel(opp.category)}</div>
      <h2>${opp.programName}</h2>
      <div class="org-name">${opp.organizationName}</div>
      <div class="card-match">${opp.matchScore}% Match</div>
    </div>
    <div class="card-body">
      <div class="card-tags">${tags}</div>
      <p class="card-description">${opp.description}</p>
      <div class="card-meta">
        <div class="meta-item"><span class="meta-icon">📍</span>${opp.location}</div>
        <div class="meta-item"><span class="meta-icon">${opp.modality === 'in-person' ? '🏢' : '💻'}</span>${opp.modality}</div>
        <div class="meta-item"><span class="meta-icon">💰</span>${opp.fundingType?.replace('-', ' ') || 'See details'}</div>
        <div class="meta-item"><span class="meta-icon">🏆</span>${opp.competitionLevel || 'Unknown'}</div>
      </div>
      ${opp.deadline ? `<div class="card-deadline">⏰ Deadline: ${daysLeft}</div>` : ''}
    </div>
  `;

  return div;
}

function getCategoryColor(cat) {
  const map = {
    'summer-program': 'linear-gradient(135deg, #FF9A3C, #FF6B6B)',
    'fellowship': 'linear-gradient(135deg, #6C63FF, #8B5CF6)',
    'internship': 'linear-gradient(135deg, #00D4AA, #00B894)',
    'scholarship': 'linear-gradient(135deg, #F093FB, #6C63FF)',
  };
  return map[cat] || 'linear-gradient(135deg, #6C63FF, #8B5CF6)';
}

function setupDragSwipe(stack) {
  const topCard = stack.querySelector('.card-1');
  if (!topCard) return;

  let startX = 0, startY = 0, currentX = 0, isDragging = false;

  function onStart(e) {
    if (!topCard.contains(e.target)) return;
    isDragging = true;
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    topCard.classList.add('dragging');
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
    const currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
    const rotation = currentX * 0.08;

    topCard.style.transform = `translateX(${currentX}px) translateY(${currentY * 0.1}px) rotate(${rotation}deg)`;

    const likeEl = topCard.querySelector('.swipe-like');
    const passEl = topCard.querySelector('.swipe-pass');
    const threshold = 60;

    if (currentX > threshold) {
      likeEl.style.opacity = Math.min(1, (currentX - threshold) / 60);
      passEl.style.opacity = 0;
    } else if (currentX < -threshold) {
      passEl.style.opacity = Math.min(1, (-currentX - threshold) / 60);
      likeEl.style.opacity = 0;
    } else {
      likeEl.style.opacity = 0;
      passEl.style.opacity = 0;
    }
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    topCard.classList.remove('dragging');

    const SWIPE_THRESHOLD = 100;

    if (currentX > SWIPE_THRESHOLD) {
      swipeCard('like');
    } else if (currentX < -SWIPE_THRESHOLD) {
      swipeCard('pass');
    } else {
      topCard.style.transform = '';
      topCard.querySelector('.swipe-like').style.opacity = 0;
      topCard.querySelector('.swipe-pass').style.opacity = 0;
    }
    currentX = 0;
  }

  topCard.addEventListener('mousedown', onStart);
  topCard.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

async function swipeCard(action) {
  const stack = document.getElementById('card-stack');
  if (!stack) return;

  const filtered = getFilteredOpportunities();
  const opp = filtered[currentIndex];
  if (!opp) return;

  const topCard = stack.querySelector('.card-1');
  if (!topCard) return;

  topCard.classList.add(action === 'like' ? 'swiped-right' : 'swiped-left');

  try {
    await api.swipes.record(state.user.id, opp.id, action, opp.matchScore);
    swipedIds.add(opp.id);
  } catch (_) {}

  if (action === 'like') {
    showMatchOverlay(opp);
    return;
  }

  setTimeout(() => {
    currentIndex++;
    renderCards();
  }, 400);
}

function showMatchOverlay(opp) {
  const overlay = document.createElement('div');
  overlay.className = 'match-overlay';
  overlay.innerHTML = `
    <div class="match-emoji">🎯</div>
    <h2>It's a Match!</h2>
    <p>${opp.programName} looks perfect for you</p>
    <div class="match-actions">
      <button class="btn btn-primary" id="match-quest">📋 Start Application Quest</button>
      <button class="btn btn-secondary" id="match-save">🔖 Save for Later</button>
      <button class="btn btn-ghost" id="match-continue">Keep Swiping →</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#match-quest').addEventListener('click', async () => {
    overlay.remove();
    await createQuest(opp);
  });

  overlay.querySelector('#match-save').addEventListener('click', async () => {
    overlay.remove();
    try {
      await api.saved.save(state.user.id, opp.id);
      showToast('Saved! ✅', 'success');
    } catch (_) {
      showToast('Could not save', 'error');
    }
    currentIndex++;
    renderCards();
  });

  overlay.querySelector('#match-continue').addEventListener('click', () => {
    overlay.remove();
    currentIndex++;
    renderCards();
  });
}

async function saveCurrentCard() {
  const filtered = getFilteredOpportunities();
  const opp = filtered[currentIndex];
  if (!opp) return;

  try {
    await api.saved.save(state.user.id, opp.id);
    showToast('Saved for later 🔖', 'success');
    swipeCard('pass');
  } catch (_) {
    showToast('Could not save', 'error');
  }
}

async function startQuestForCurrent(router) {
  const filtered = getFilteredOpportunities();
  const opp = filtered[currentIndex];
  if (!opp) return;

  await createQuest(opp);
}

async function createQuest(opp) {
  try {
    await api.quests.create(state.user.id, opp.id);
    showToast('Quest started! 🚀', 'success');
    currentIndex++;
    renderCards();
  } catch (err) {
    showToast(err.message || 'Could not start quest', 'error');
  }
}
