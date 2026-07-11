import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost-905d5.firebaseapp.com",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54",
  measurementId: "G-E6SRLXZW5V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(function trackTopupReturn(){
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') === '1' && !sessionStorage.getItem('sb_goal_balance_topup_sent')) {
      sessionStorage.setItem('sb_goal_balance_topup_sent', '1');
      window.sbGoal?.('balance_topup');
    }
  } catch (e) {}
})();


function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function isLoggedIn(user) {
  return Boolean(user && user.userId && user.sessionToken);
}

function clearBrokenSession(user) {
  if (user && user.userId && !user.sessionToken) {
    localStorage.removeItem('sb_user');
    return true;
  }
  return false;
}

function setBalances(balance = 0, bonus = 0) {
  document.getElementById('mainBalance').textContent = Number(balance || 0).toFixed(2) + '₽';
  document.getElementById('bonusBalance').textContent = Number(bonus || 0).toFixed(2) + '₽';
}

const user = getUser();
const hadBrokenSession = clearBrokenSession(user);

if (!isLoggedIn(user)) {
  setBalances(0, 0);
  document.getElementById('walletUser').innerHTML = (hadBrokenSession ? 'Сессия устарела. ' : 'Вы не вошли. ') + '<a href="auth.html">Войти / зарегистрироваться</a>';
  const yBtn = document.getElementById('topupYookassa');
  const cBtn = document.getElementById('topupCrypto');
  if (yBtn) yBtn.textContent = 'Войти для пополнения';
  if (cBtn) cBtn.textContent = 'Войти для пополнения CryptoBot';
} else {
  document.getElementById('walletUser').textContent = user.displayName || user.username || user.login || 'Пользователь';
  onSnapshot(doc(db, 'users', user.userId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    setBalances(data.balance, data.bonusBalance);
    localStorage.setItem('sb_user', JSON.stringify({
      ...user,
      displayName: data.displayName || user.displayName,
      socialLogin: data.socialLogin || user.socialLogin,
      socialPlatform: data.socialPlatform || user.socialPlatform,
      balance: Number(data.balance || 0),
      bonusBalance: Number(data.bonusBalance || 0)
    }));
  });
}

// Глобальный (в рамках модуля) флаг: одно нажатие — один запрос на создание платежа.
// Защищает от гонки: submit + click, двойной click, повторный вызов из другого места и т.п.
let topupInFlight = false;

async function createTopup(type) {
  if (topupInFlight) {
    console.warn('[TOPUP] ignored: already in flight');
    return;
  }

  const user = getUser();
  if (!isLoggedIn(user)) {
    alert('Сначала войдите в аккаунт');
    window.location.href = 'auth.html';
    return;
  }

  const amount = Number(document.getElementById('topupAmount').value || 0);
  if (!Number.isFinite(amount) || amount < 100) {
    alert('Минимальное пополнение 100₽');
    return;
  }

  const yBtn = document.getElementById('topupYookassa');
  const cBtn = document.getElementById('topupCrypto');
  const button = type === 'crypto' ? cBtn : yBtn;
  const old = button.textContent;

  topupInFlight = true;
  if (yBtn) yBtn.disabled = true;
  if (cBtn) cBtn.disabled = true;
  button.textContent = 'Создание оплаты...';

  const requestId = Math.random().toString(36).slice(2, 10);
  console.log('[TOPUP] create start', { type, amount, requestId });

  try {
    const res = await fetch(type === 'crypto' ? '/api/create-balance-invoice' : '/api/create-balance-yookassa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, userId: user.userId, sessionToken: user.sessionToken, login: user.username || user.displayName || user.email || '' })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sb_user');
        window.SBUserState?.refresh?.();
      }
      throw new Error(data.error || data.description || 'Ошибка создания оплаты');
    }

    console.log('[TOPUP] created', { type, requestId, paymentId: data.id || data.result?.invoice_id || null });

    if (type === 'crypto' && data.ok && data.result?.pay_url) {
      window.location.href = data.result.pay_url;
      return;
    }

    if (type === 'yookassa' && data.confirmation?.confirmation_url) {
      window.location.href = data.confirmation.confirmation_url;
      return;
    }

    throw new Error(data.error || data.description || 'Не найдена ссылка оплаты');
  } catch (e) {
    alert(e.message || 'Ошибка создания оплаты');
  } finally {
    topupInFlight = false;
    if (yBtn) yBtn.disabled = false;
    if (cBtn) cBtn.disabled = false;
    button.textContent = old;
  }
}

// Навешиваем ровно один обработчик через { once: false } без дублей.
// Если по какой-то причине скрипт исполнится повторно, повторное навешивание
// на тот же элемент даст двойной вызов — защищаемся флагом на элементе.
(function bindTopupHandlersOnce(){
  const yBtn = document.getElementById('topupYookassa');
  const cBtn = document.getElementById('topupCrypto');
  if (yBtn && !yBtn.dataset.sbBound) {
    yBtn.dataset.sbBound = '1';
    yBtn.addEventListener('click', (e) => { e.preventDefault(); createTopup('yookassa'); });
  }
  if (cBtn && !cBtn.dataset.sbBound) {
    cBtn.dataset.sbBound = '1';
    cBtn.addEventListener('click', (e) => { e.preventDefault(); createTopup('crypto'); });
  }
})();


async function claimSocialBonus(platform) {
  const user = getUser();

  if (!user?.userId || !user?.sessionToken) {
    alert('Сначала войдите в аккаунт');
    window.location.href = 'auth.html';
    return;
  }

  const links = {
    telegram: 'https://t.me/smmboost_pro',
    vk: 'https://vk.ru/smmboost_pro'
  };

  if (links[platform]) {
    window.open(links[platform], '_blank');
  }

  const button = platform === 'telegram'
    ? document.getElementById('claimTelegramBonus')
    : document.getElementById('claimVkBonus');

  const oldText = button?.innerHTML || '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span>Проверяем...</span>';
  }

  try {
    const res = await fetch('/api/social-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        sessionToken: user.sessionToken,
        platform
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sb_user');
        window.SBUserState?.refresh?.();
      }
      throw new Error(data.error || 'Ошибка начисления бонуса');
    }

    alert(data.message || 'Бонус начислен');
    window.sbGoal?.('social_bonus');
  } catch (e) {
    alert(e.message || 'Ошибка начисления бонуса');
  }

  if (button) {
    button.disabled = false;
    button.innerHTML = oldText;
  }
}

document.getElementById('claimTelegramBonus')?.addEventListener('click', () => claimSocialBonus('telegram'));
document.getElementById('claimVkBonus')?.addEventListener('click', () => claimSocialBonus('vk'));
