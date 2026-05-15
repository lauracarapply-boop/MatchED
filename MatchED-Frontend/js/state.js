export const state = {
  user: null,
  token: null,

  load() {
    const token = localStorage.getItem('matched_token');
    const user = localStorage.getItem('matched_user');
    if (token && user) {
      this.token = token;
      this.user = JSON.parse(user);
    }
  },

  save(user, token) {
    this.user = user;
    this.token = token;
    localStorage.setItem('matched_token', token);
    localStorage.setItem('matched_user', JSON.stringify(user));
  },

  updateUser(updates) {
    this.user = { ...this.user, ...updates };
    localStorage.setItem('matched_user', JSON.stringify(this.user));
  },

  clear() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('matched_token');
    localStorage.removeItem('matched_user');
  },

  isLoggedIn() {
    return !!this.token && !!this.user;
  },
};
