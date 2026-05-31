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

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function setBalances(balance = 0, bonus = 0) {
  document.getElementById('mainBalance').textContent = Number(balance || 0).toFixed(2) + '₽';
  document.getElementById('bonusBalance').textContent = Number(bonus || 0).toFixed(2) + '₽';
}

const user = getUser();

if (!user?.userId) {
  document.getElementById('walletUser').innerHTML = 'Вы не вошли. <a href="auth.html">Войти / зарегистрироваться</a>';
} else {
  document.getElementById('walletUser').textContent = user.email;
  onSnapshot(doc(db, 'users', user.userId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    setBalances(data.balance, data.bonusBalance);
    localStorage.setItem('sb_user', JSON.stringify({
      ...user,
      balance: Number(data.balance || 0),
      bonusBalance: Number(data.bonusBalance || 0)
    }));
  });
}

async function createTopup(type) {
  const user = getUser();
  if (!user?.userId) {
    window.location.href = 'auth.html';
    return;
  }

  const amount = Number(document.getElementById('topupAmount').value || 0);
  if (!Number.isFinite(amount) || amount < 50) {
    alert('Минимальное пополнение 50₽');
    return;
  }

  const button = type === 'crypto' ? document.getElementById('topupCrypto') : document.getElementById('topupYookassa');
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'Создание оплаты...';

  try {
    const res = await fetch(type === 'crypto' ? '/api/create-balance-invoice' : '/api/create-balance-yookassa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, userId: user.userId, email: user.email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.description || 'Ошибка создания оплаты');

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
    alert(e.message);
  }

  button.disabled = false;
  button.textContent = old;
}

document.getElementById('topupYookassa')?.addEventListener('click', () => createTopup('yookassa'));
document.getElementById('topupCrypto')?.addEventListener('click', () => createTopup('crypto'));


async function claimSocialBonus(platform) {
  const user = getUser();

  if (!user?.userId || !user?.sessionToken) {
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

  const oldText = button.innerHTML;
  button.disabled = true;

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

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Ошибка начисления бонуса');
    }

    alert(data.message || 'Бонус начислен');
  } catch (e) {
    alert(e.message);
  }

  button.disabled = false;
  button.innerHTML = oldText;
}

document.getElementById('claimTelegramBonus')?.addEventListener('click', () => claimSocialBonus('telegram'));
document.getElementById('claimVkBonus')?.addEventListener('click', () => claimSocialBonus('vk'));
