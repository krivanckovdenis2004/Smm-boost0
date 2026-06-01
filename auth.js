const TELEGRAM_BOT_URL = 'https://t.me/Smmboost_reg_bot';

function setMessage(text, ok = false) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + (ok ? 'ok' : 'error');
}

function saveUser(user) {
  localStorage.setItem('sb_user', JSON.stringify({
    ...user,
    registeredAt: user.registeredAt || new Date().toISOString()
  }));
  window.SBUserState?.refresh?.();
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function encodeStartPayload() {
  const state = randomState();
  localStorage.setItem('sb_tg_state', state);
  return encodeURIComponent(`site_${state}`);
}

function readPayloadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('auth_payload');
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    try { return JSON.parse(atob(encoded)); } catch { return null; }
  }
}

function cleanupUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function handleAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('auth_error');
  if (error) {
    setMessage(error);
    cleanupUrl();
    return;
  }

  const payload = readPayloadFromUrl();
  if (payload?.ok && payload.user?.userId && payload.user?.sessionToken) {
    saveUser(payload.user);
    setMessage('Вы успешно вошли. Начислен приветственный бонус 70₽.', true);
    cleanupUrl();
    setTimeout(() => { window.location.href = 'wallet.html'; }, 900);
  }
}

function openTelegramBot() {
  const start = encodeStartPayload();
  window.location.href = `${TELEGRAM_BOT_URL}?start=${start}`;
}

async function startVkAuth() {
  const button = document.getElementById('vkRegisterBtn');
  const oldText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Открываем VK...';
  }

  try {
    const res = await fetch('/api/auth-social-register?provider=vk-start', { method: 'GET' });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'VK-вход пока не настроен');
    window.location.href = data.url;
  } catch (e) {
    setMessage(e.message || 'Не удалось открыть VK-вход');
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
}

handleAuthReturn();

const existing = getUser();
if (existing?.userId && existing?.sessionToken) {
  setMessage(`Вы уже вошли как ${existing.displayName || existing.socialLogin || existing.email || 'пользователь'}.`, true);
}

document.getElementById('telegramRegisterBtn')?.addEventListener('click', openTelegramBot);
document.getElementById('vkRegisterBtn')?.addEventListener('click', startVkAuth);
