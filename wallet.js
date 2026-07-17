import { firebaseApp, auth, syncFirebaseUser, waitForAuthState } from "./firebase.js?v=20260717-topup-v12";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(firebaseApp);

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTopupAuth() {
  let state = null;
  try {
    state = await Promise.race([waitForAuthState(), wait(7000).then(() => null)]);
  } catch (e) {
    console.warn('[TOPUP] waitForAuthState failed', e?.message);
  }

  let user = state?.user || getUser();
  let idToken = '';

  if (auth?.currentUser) {
    try {
      idToken = await auth.currentUser.getIdToken(true);
    } catch (e) {
      console.warn('[TOPUP] getIdToken failed', e?.message);
    }

    try {
      const synced = await syncFirebaseUser(auth.currentUser, { forceToken: false });
      if (synced?.userId && synced?.sessionToken) user = synced;
    } catch (e) {
      console.warn('[TOPUP] syncFirebaseUser failed', e?.message);
    }
  }

  return { user, idToken };
}

async function readResponseJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { error: text || 'Сервер вернул некорректный ответ' }; }
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

  const { user, idToken } = await resolveTopupAuth();
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
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({
        amount,
        provider: type === 'crypto' ? 'cryptobot' : 'yookassa',
        requestId,
        idToken,
        userId: user.userId,
        sessionToken: user.sessionToken,
        login: user.username || user.displayName || user.email || ''
      })
    });

    const data = await readResponseJson(res);
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sb_user');
        window.SBUserState?.refresh?.();
      }
      console.error('[TOPUP] create failed', { type, requestId, status: res.status, data });
      throw new Error(data.error || data.description || data.message || `Ошибка создания оплаты (${res.status})`);
    }

    console.log('[TOPUP] created', { type, requestId, paymentId: data.id || data.result?.invoice_id || null });

    const cryptoPayUrl = data.result?.pay_url || data.result?.bot_invoice_url || data.result?.mini_app_invoice_url;
    if (type === 'crypto' && data.ok && cryptoPayUrl) {
      window.location.href = cryptoPayUrl;
      return;
    }

    if (type === 'yookassa' && data.confirmation?.confirmation_url) {
      window.location.href = data.confirmation.confirmation_url;
      return;
    }

    console.error('[TOPUP] payment link missing', { type, requestId, data });
    throw new Error(data.error || data.description || 'Провайдер не вернул ссылку оплаты. Попробуйте ещё раз или выберите другой способ.');
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

// Бонусы за подписку удалены — бесплатные услуги теперь на /free.html

