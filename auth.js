function setMessage(text, ok = false) {
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.className = 'auth-message ' + (ok ? 'ok' : 'error');
}

function saveUser(user) {
  localStorage.setItem('sb_user', JSON.stringify(user));
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function normalizeLogin(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/^@+/, '@');
}

const existing = getUser();
if (existing?.userId) {
  setMessage(`Вы уже вошли как ${existing.displayName || existing.socialLogin || existing.email || 'пользователь'}. Можно перейти в баланс.`, true);
}

async function registerSocial(platform) {
  const loginInput = document.getElementById('socialLogin');
  const socialLogin = normalizeLogin(loginInput?.value);
  const button = platform === 'telegram'
    ? document.getElementById('telegramRegisterBtn')
    : document.getElementById('vkRegisterBtn');

  if (!socialLogin) return setMessage('Введите ваш Telegram или VK username');

  const links = {
    telegram: 'https://t.me/Smmboost_reg_bot',
    vk: 'https://vk.ru/smmboost_pro'
  };

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Регистрируем...';

  try {
    const res = await fetch('/api/auth-social-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, socialLogin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');

    saveUser(data.user);

    if (links[platform]) window.open(links[platform], '_blank');

    setMessage(`Готово! Начислен бонус за регистрацию: 70₽. Бонусный баланс: ${Number(data.user.bonusBalance || 0).toFixed(2)}₽`, true);

    setTimeout(() => {
      window.location.href = 'wallet.html';
    }, 900);
  } catch (e) {
    setMessage(e.message);
  }

  button.disabled = false;
  button.textContent = oldText;
}

document.getElementById('telegramRegisterBtn')?.addEventListener('click', () => registerSocial('telegram'));
document.getElementById('vkRegisterBtn')?.addEventListener('click', () => registerSocial('vk'));
