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

const existing = getUser();
if (existing?.email) {
  setMessage(`Вы уже вошли как ${existing.email}. Можно перейти в баланс.`, true);
}

document.getElementById('sendCodeBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const btn = document.getElementById('sendCodeBtn');
  if (!email) return setMessage('Введите email');

  btn.disabled = true;
  btn.textContent = 'Отправляем код...';

  try {
    const res = await fetch('/api/auth-send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка отправки кода');

    document.getElementById('codeStep').style.display = 'block';
    setMessage('Код отправлен на email. Проверьте почту.', true);
  } catch (e) {
    setMessage(e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Получить код';
});

document.getElementById('verifyCodeBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const code = document.getElementById('authCode').value.trim();
  const btn = document.getElementById('verifyCodeBtn');
  if (!email || !code) return setMessage('Введите email и код');

  btn.disabled = true;
  btn.textContent = 'Проверяем...';

  try {
    const res = await fetch('/api/auth-verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка подтверждения');

    saveUser(data.user);
    setMessage(`Готово! Бонусный баланс: ${Number(data.user.bonusBalance || 0).toFixed(2)}₽`, true);

    setTimeout(() => {
      window.location.href = 'wallet.html';
    }, 900);
  } catch (e) {
    setMessage(e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Подтвердить';
});
