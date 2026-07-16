// Реферальный кабинет — читает пользователя из localStorage и подписывается
// на его документ в Firestore, чтобы показывать актуальные счётчики.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost.pro",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54",
  measurementId: "G-E6SRLXZW5V"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function isLoggedIn(u) {
  return Boolean(u && u.userId && u.sessionToken);
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₽';
}

function buildRefLink(userId) {
  const origin = window.location.origin.replace(/\/$/, '');
  return origin + '/auth.html?ref=' + encodeURIComponent(userId);
}

function render(user) {
  const notLogged = document.getElementById('refNotLogged');
  const cabinet = document.getElementById('refCabinet');

  if (!isLoggedIn(user)) {
    notLogged?.classList.remove('hidden');
    cabinet?.classList.add('hidden');
    return;
  }

  notLogged?.classList.add('hidden');
  cabinet?.classList.remove('hidden');

  const linkInput = document.getElementById('refLinkInput');
  if (linkInput) linkInput.value = buildRefLink(user.userId);

  // Начальные значения из localStorage; далее обновляются onSnapshot.
  document.getElementById('refCount').textContent = String(user.referralsCount || 0);
  document.getElementById('refEarned').textContent = fmtMoney(user.referralEarned || 0);

  onSnapshot(doc(db, 'users', user.userId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    document.getElementById('refCount').textContent = String(data.referralsCount || 0);
    document.getElementById('refEarned').textContent = fmtMoney(data.referralEarned || 0);
    // Обновим локальные копии.
    try {
      const merged = { ...user, referralsCount: Number(data.referralsCount || 0), referralEarned: Number(data.referralEarned || 0) };
      localStorage.setItem('sb_user', JSON.stringify(merged));
    } catch (e) {}
  });
}

function bindCopy() {
  const btn = document.getElementById('refCopyBtn');
  const input = document.getElementById('refLinkInput');
  const msg = document.getElementById('refCopyMsg');
  if (!btn || !input) return;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    msg?.classList.remove('hidden');
    setTimeout(() => msg?.classList.add('hidden'), 2000);
  });
}

render(getUser());
bindCopy();
