import { state } from './state.js';
import { renderLogin, bindLogin, renderSignup, bindSignup, renderForgotPassword, bindForgotPassword, renderResetPassword, bindResetPassword, renderPasswordResetConfirmation, bindPasswordResetConfirmation, renderOnboarding, bindOnboarding } from './pages/auth.js';
import { renderDiscover, bindDiscover } from './pages/discover.js';
import { renderSaved, bindSaved } from './pages/saved.js';
import { renderQuests, bindQuests } from './pages/quests.js';
import { renderProfile, bindProfile } from './pages/profile.js';

const PAGES_WITH_NAV = ['discover', 'saved', 'quests', 'profile'];

const router = {
  current: null,

  async go(page) {
    this.current = page;
    const container = document.getElementById('page-container');
    const nav = document.getElementById('bottom-nav');

    container.innerHTML = '';

    if (PAGES_WITH_NAV.includes(page)) {
      nav.classList.remove('hidden');
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
      });
    } else {
      nav.classList.add('hidden');
    }

    let html = '';
    switch (page) {
      case 'login':                   html = renderLogin(this); break;
      case 'signup':                  html = renderSignup(this); break;
      case 'forgot-password':         html = renderForgotPassword(this); break;
      case 'reset-password':          html = renderResetPassword(this); break;
      case 'password-reset-confirmation': html = renderPasswordResetConfirmation(this); break;
      case 'onboarding':              html = renderOnboarding(this); break;
      case 'discover':                html = await renderDiscover(this); break;
      case 'saved':                   html = await renderSaved(this); break;
      case 'quests':                  html = await renderQuests(this); break;
      case 'profile':                 html = renderProfile(this); break;
      default:                        html = renderLogin(this);
    }

    if (typeof html === 'string') {
      container.innerHTML = html;
    } else {
      container.appendChild(html);
    }

    switch (page) {
      case 'login':                    bindLogin(this); break;
      case 'signup':                   bindSignup(this); break;
      case 'forgot-password':          bindForgotPassword(this); break;
      case 'reset-password':           bindResetPassword(this); break;
      case 'password-reset-confirmation': bindPasswordResetConfirmation(this); break;
      case 'onboarding':               bindOnboarding(this); break;
      case 'discover':                 await bindDiscover(this); break;
      case 'saved':                    await bindSaved(this); break;
      case 'quests':                   await bindQuests(this); break;
      case 'profile':                  await bindProfile(this); break;
    }
  },
};

function init() {
  state.load();

  document.getElementById('bottom-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn && btn.dataset.page) {
      router.go(btn.dataset.page);
    }
  });

  if (!state.isLoggedIn()) {
    router.go('login');
  } else if (!state.user.userPath) {
    router.go('onboarding');
  } else {
    router.go('discover');
  }
}

init();
