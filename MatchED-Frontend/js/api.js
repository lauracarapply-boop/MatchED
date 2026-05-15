const BASE_URL = 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('matched_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: {
    login: (email, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    signup: (name, email, password) =>
      request('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    forgotPassword: (email) =>
      request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (email, code, password) =>
      request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, password }) }),
  },

  users: {
    get: (userId) => request(`/users/${userId}`),
    setPath: (userId, userPath) =>
      request(`/users/${userId}/path`, { method: 'PUT', body: JSON.stringify({ userPath }) }),
    badges: (userId) => request(`/users/${userId}/badges`),
  },

  opportunities: {
    list: (limit = 20) => request(`/opportunities?limit=${limit}`),
    search: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/opportunities/search?${q}`);
    },
    get: (id) => request(`/opportunities/${id}`),
  },

  swipes: {
    record: (userId, opportunityId, action, matchScore) =>
      request('/swipes', { method: 'POST', body: JSON.stringify({ userId, opportunityId, action, matchScore }) }),
    list: (userId) => request(`/swipes?userId=${userId}`),
  },

  saved: {
    list: (userId) => request(`/saved-opportunities?userId=${userId}`),
    save: (userId, opportunityId) =>
      request('/saved-opportunities', { method: 'POST', body: JSON.stringify({ userId, opportunityId, saveType: 'manual' }) }),
    remove: (id) => request(`/saved-opportunities/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'removed' }) }),
  },

  quests: {
    list: (userId) => request(`/quests?userId=${userId}`),
    create: (userId, opportunityId) =>
      request('/quests', { method: 'POST', body: JSON.stringify({ userId, opportunityId }) }),
    completeTask: (questId, taskId) =>
      request(`/quests/${questId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ isCompleted: true }) }),
  },
};
