function setMessage(text, ok = false) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + (ok ? 'ok' : 'error');
}

function saveUser(user) {
  localStorage.setItem('sb_user', JSON.stringify({
    ...user,
    loggedAt: new Date().toISOString(),
    registeredAt: user.registeredAt || new Date().toISOString()
  }));
  window.SBUserState?.refresh?.();
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,32}$/.test(username);
}

function toggleBusy(form, busy, busyText) {
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return () => {};
  const oldText = submit.textContent;
  submit.disabled = busy;
  if (busy) submit.textContent = busyText;
  return () => {
    submit.disabled = false;
    submit.textContent = oldText;
  };
}

async function submitAuth(payload) {
  const res = await fetch('/api/auth-social-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.user) throw new Error(data.error || 'Ошибка авторизации');
  saveUser(data.user);
  return data.user;
}

async function registerWithLoginPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const passwordConfirm = form.passwordConfirm.value;

  if (!validateUsername(username)) {
    setMessage('Логин должен быть от 3 до 32 символов: буквы, цифры, _, . или -');
    return;
  }
  if (password.length < 6) {
    setMessage('Пароль должен быть минимум 6 символов');
    return;
  }
  if (password !== passwordConfirm) {
    setMessage('Пароли не совпадают');
    return;
  }

  const restore = toggleBusy(form, true, 'Регистрируем...');
  try {
    await submitAuth({ action: 'register', username, password, passwordConfirm });
    window.sbGoal?.('registration', { login: username });
    setMessage('Вы успешно зарегистрированы. Начислен приветственный бонус 70₽.', true);
    setTimeout(() => { window.location.href = 'wallet.html'; }, 900);
  } catch (e) {
    setMessage(e.message || 'Ошибка регистрации');
  } finally {
    restore();
  }
}

async function loginWithPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;

  if (!validateUsername(username) || !password) {
    setMessage('Введите логин и пароль');
    return;
  }

  const restore = toggleBusy(form, true, 'Входим...');
  try {
    const user = await submitAuth({ action: 'login', username, password });
    window.sbGoal?.('login', { login: user.username || username });
    setMessage(`Вы успешно вошли как ${user.displayName || user.username}.`, true);
    setTimeout(() => { window.location.href = 'wallet.html'; }, 700);
  } catch (e) {
    setMessage(e.message || 'Ошибка входа');
  } finally {
    restore();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.authTab === tabName);
  });
  document.querySelectorAll('[data-auth-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.authPanel !== tabName);
  });
  setMessage('', false);
  const el = document.getElementById('authMessage');
  if (el) el.className = 'auth-message';
}

const existing = getUser();
if (existing?.userId && existing?.sessionToken) {
  setMessage(`Вы уже вошли как ${existing.displayName || existing.username || 'пользователь'}.`, true);
}

document.querySelectorAll('[data-auth-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.authTab));
});
document.getElementById('registerForm')?.addEventListener('submit', registerWithLoginPassword);
document.getElementById('loginForm')?.addEventListener('submit', loginWithPassword);
