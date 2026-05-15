export function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  });
}

export function formatDeadline(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diff < 0) return 'Expired';
  if (diff === 0) return 'Today!';
  if (diff === 1) return 'Tomorrow!';
  if (diff <= 7) return `${diff} days left`;
  if (diff <= 30) return `${Math.ceil(diff / 7)} weeks left`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getCategoryIcon(category) {
  const map = {
    'summer-program': '☀️',
    'fellowship': '🎓',
    'internship': '💼',
    'scholarship': '💰',
  };
  return map[category] || '📋';
}

export function getCategoryLabel(category) {
  const map = {
    'summer-program': 'Summer Program',
    'fellowship': 'Fellowship',
    'internship': 'Internship',
    'scholarship': 'Scholarship',
  };
  return map[category] || category;
}

export function xpForLevel(level) {
  return level * 500;
}

export function getLevelProgress(xpTotal) {
  const level = Math.floor(xpTotal / 500) + 1;
  const xpInLevel = xpTotal % 500;
  const xpNeeded = 500;
  return { level, xpInLevel, xpNeeded, percent: Math.round((xpInLevel / xpNeeded) * 100) };
}

export function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
