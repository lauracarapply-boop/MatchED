import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../utils.js';

export function renderLogin(router) {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="logo-text">MatchED</div>
        <div class="logo-sub">Find your perfect opportunity</div>
      </div>
      <form class="auth-form" id="login-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="you@email.com" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required />
        </div>
        <div class="text-right mb-4">
          <button type="button" class="link-button" id="forgot-password-link">Esqueci minha senha</button>
        </div>
        <div id="login-error" class="error-msg hidden"></div>
        <button type="submit" class="btn btn-primary" id="login-btn">Sign In</button>
        <button type="button" class="btn btn-ghost" id="demo-btn">Try Demo (High School)</button>
        <button type="button" class="btn btn-ghost" id="demo-col-btn">Try Demo (College)</button>
      </form>
      <div class="auth-footer">
        Don't have an account? <a id="go-signup">Sign up</a>
      </div>
    </div>
  `;
}

export function bindLogin(router) {
  document.getElementById('go-signup').addEventListener('click', () => router.go('signup'));
  document.getElementById('forgot-password-link').addEventListener('click', () => router.go('forgot-password'));

  document.getElementById('demo-btn').addEventListener('click', () => {
    document.getElementById('login-email').value = 'laura@example.com';
    document.getElementById('login-password').value = 'password123';
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  });

  document.getElementById('demo-col-btn').addEventListener('click', () => {
    document.getElementById('login-email').value = 'alex@example.com';
    document.getElementById('login-password').value = 'password123';
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.classList.add('hidden');

    try {
      const data = await api.auth.login(email, password);
      state.save(data.user, data.token);

      if (!data.user.userPath) {
        router.go('onboarding');
      } else {
        router.go('discover');
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

export function renderSignup(router) {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="logo-text">MatchED</div>
        <div class="logo-sub">Create your account</div>
      </div>
      <form class="auth-form" id="signup-form">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="signup-name" placeholder="Your name" autocomplete="name" required />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="signup-email" placeholder="you@email.com" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="signup-password" placeholder="Min. 6 characters" autocomplete="new-password" required minlength="6" />
        </div>
        <div id="signup-error" class="error-msg hidden"></div>
        <button type="submit" class="btn btn-primary" id="signup-btn">Create Account</button>
      </form>
      <div class="auth-footer">
        Already have an account? <a id="go-login">Sign in</a>
      </div>
    </div>
  `;
}

export function bindSignup(router) {
  document.getElementById('go-login').addEventListener('click', () => router.go('login'));

  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');
    const errEl = document.getElementById('signup-error');

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errEl.classList.add('hidden');

    try {
      const data = await api.auth.signup(name, email, password);
      state.save(data.user, data.token);
      router.go('onboarding');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

export function renderForgotPassword(router) {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="logo-text">MatchED</div>
        <div class="logo-sub">Recuperar acesso</div>
      </div>
      <form class="auth-form" id="forgot-password-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="forgot-email" placeholder="you@email.com" autocomplete="email" required />
        </div>
        <div id="forgot-error" class="error-msg hidden"></div>
        <div id="forgot-success" class="success-msg hidden"></div>
        <button type="submit" class="btn btn-primary" id="forgot-btn">Enviar código</button>
      </form>
      <div class="auth-footer">
        Lembrou a senha? <a id="go-login-from-forgot">Sign in</a>
      </div>
    </div>
  `;
}

export function bindForgotPassword(router) {
  document.getElementById('go-login-from-forgot').addEventListener('click', () => router.go('login'));

  document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-btn');
    const errEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    try {
      const data = await api.auth.forgotPassword(email);
      successEl.textContent = data.message || 'Código enviado. Verifique seu email.';
      successEl.classList.remove('hidden');
      btn.textContent = 'Reenviar código';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

export function renderResetPassword(router) {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="logo-text">MatchED</div>
        <div class="logo-sub">Redefinir senha</div>
      </div>
      <form class="auth-form" id="reset-password-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="reset-email" placeholder="you@email.com" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label>Código de recuperação</label>
          <input type="text" id="reset-code" placeholder="000000" required />
        </div>
        <div class="form-group">
          <label>Nova senha</label>
          <input type="password" id="reset-password" placeholder="••••••••" autocomplete="new-password" required minlength="6" />
        </div>
        <div class="form-group">
          <label>Confirmar nova senha</label>
          <input type="password" id="reset-password-confirm" placeholder="••••••••" autocomplete="new-password" required minlength="6" />
        </div>
        <div id="reset-error" class="error-msg hidden"></div>
        <div id="reset-success" class="success-msg hidden"></div>
        <button type="submit" class="btn btn-primary" id="reset-btn">Redefinir senha</button>
      </form>
      <div class="auth-footer">
        Voltar ao login? <a id="go-login-from-reset">Sign in</a>
      </div>
    </div>
  `;
}

export function bindResetPassword(router) {
  document.getElementById('go-login-from-reset').addEventListener('click', () => router.go('login'));

  document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const code = document.getElementById('reset-code').value.trim();
    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-password-confirm').value;
    const btn = document.getElementById('reset-btn');
    const errEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');

    btn.disabled = true;
    btn.textContent = 'Atualizando...';
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (password !== confirm) {
      errEl.textContent = 'As senhas não coincidem.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Redefinir senha';
      return;
    }

    try {
      const data = await api.auth.resetPassword(email, code, password);
      successEl.textContent = data.message || 'Senha redefinida com sucesso.';
      successEl.classList.remove('hidden');
      setTimeout(() => router.go('password-reset-confirmation'), 500);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Redefinir senha';
    }
  });
}

export function renderPasswordResetConfirmation(router) {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="logo-text">MatchED</div>
        <div class="logo-sub">Senha redefinida</div>
      </div>
      <div class="auth-card">
        <p class="success-msg">Sua senha foi alterada com sucesso.</p>
        <p>Agora você pode entrar com sua nova senha.</p>
        <button class="btn btn-primary" id="go-login-from-confirm">Voltar ao login</button>
      </div>
    </div>
  `;
}

export function bindPasswordResetConfirmation(router) {
  document.getElementById('go-login-from-confirm').addEventListener('click', () => router.go('login'));
}

export function renderOnboarding(router) {
  return `
    <div class="onboarding-page">
      <h1>What's your path? 🎯</h1>
      <p>We'll personalize your experience and show you the most relevant opportunities.</p>
      <div class="path-cards">
        <div class="path-card hs" data-path="high-school">
          <div class="path-icon">🏫</div>
          <div class="path-info">
            <h3>High School</h3>
            <p>Summer programs, pre-college fellowships, scholarships for grades 9–12</p>
          </div>
        </div>
        <div class="path-card col" data-path="college">
          <div class="path-icon">🎓</div>
          <div class="path-info">
            <h3>College / University</h3>
            <p>Internships, graduate fellowships, post-grad scholarships</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindOnboarding(router) {
  document.querySelectorAll('.path-card').forEach(card => {
    card.addEventListener('click', async () => {
      document.querySelectorAll('.path-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const path = card.dataset.path;

      try {
        const updated = await api.users.setPath(state.user.id, path);
        state.updateUser({ userPath: path });
        showToast('Path set! Let\'s find your opportunities 🚀', 'success');
        setTimeout(() => router.go('discover'), 800);
      } catch (err) {
        showToast('Could not save path. Try again.', 'error');
      }
    });
  });
}
