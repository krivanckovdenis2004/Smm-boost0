import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const shownStatuses = {};
const lastStatusChecks = {};
const unsubscribeById = {};
let refreshTimer = null;

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}

function isLoggedIn(user) {
  return Boolean(user && user.userId && user.sessionToken);
}

function shouldCheckJapStatus(order) {
  const status = order.status || '';
  if (!order.japOrderId) return false;
  if (status.includes('🟢')) return false;
  if (status.includes('🔴')) return false;
  if (status.includes('🟠')) return false;
  return true;
}

async function syncJapStatus(orderId) {
  const now = Date.now();
  if (lastStatusChecks[orderId] && now - lastStatusChecks[orderId] < 30000) return;
  lastStatusChecks[orderId] = now;
  try { await fetch(`/api/check-status?orderDocId=${encodeURIComponent(orderId)}`); } catch (e) { console.error('Status check error:', e); }
}

function saveOrderFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order');
  if (!orderId) return null;
  const myOrders = JSON.parse(localStorage.getItem('myOrders') || '[]');
  if (!myOrders.includes(orderId)) {
    myOrders.unshift(orderId);
    localStorage.setItem('myOrders', JSON.stringify(myOrders));
  }
  return orderId;
}

function getStatusClass(status) {
  if (!status) return 'processStatus';
  if (status.includes('🟢')) return 'doneStatus';
  if (status.includes('🔴')) return 'cancelStatus';
  if (status.includes('🟠')) return 'partialStatus';
  if (status.includes('🕓')) return 'waitStatus';
  return 'processStatus';
}

function getLinkTitle(link) {
  if (!link) return 'Ссылка';
  const url = link.toLowerCase();
  if (url.includes('t.me') || url.includes('telegram.me')) return 'Telegram';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('vk.com') || url.includes('vk.ru')) return 'VK';
  if (url.includes('instagram.com')) return 'Instagram';
  return 'Ссылка';
}

function money(value) {
  return Number(value || 0).toFixed(2).replace('.00', '') + '₽';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function renderOrder(orderId, order) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  const status = order.status || '🟡 В обработке';
  if (shownStatuses[orderId] && shownStatuses[orderId] !== status) showToast(status);
  shownStatuses[orderId] = status;
  if (shouldCheckJapStatus(order)) syncJapStatus(orderId);

  const statusClass = getStatusClass(status);
  const publicOrderId = order.publicOrderId || orderId.slice(0, 8).toUpperCase();
  const service = escapeHtml(order.service || 'Заказ');
  const link = escapeHtml(order.link || '#');
  const linkTitle = escapeHtml(getLinkTitle(order.link || ''));

  const cardHTML = `
    <div class="order-card compact-order-card" id="${orderId}">
      <div class="order-card-top">
        <span class="order-id">${escapeHtml(publicOrderId)}</span>
        <span class="statusBadge ${statusClass}">${escapeHtml(status)}</span>
      </div>
      <div class="compact-order-main">
        <h2>${service}</h2>
        <div class="order-quick-meta">
          <span>× ${Number(order.amount || 0)}</span>
          <span>${money(order.price)}</span>
          <span>${escapeHtml(order.paymentMethod || 'Баланс')}</span>
        </div>
      </div>
      <a href="${link}" target="_blank" rel="noopener" class="order-link">Открыть ${linkTitle}</a>
    </div>`;

  const existingCard = document.getElementById(orderId);
  if (existingCard) existingCard.outerHTML = cardHTML;
  else ordersList.insertAdjacentHTML('beforeend', cardHTML);
}

function renderEmpty(message) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  ordersList.innerHTML = `<p class="emptyOrders">${escapeHtml(message)}</p>`;
}

function renderOrders(orders) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  ordersList.innerHTML = '';
  if (!orders.length) {
    renderEmpty('У вас пока нет заказов');
    return;
  }
  orders.forEach(order => renderOrder(order.id, order));
}

function subscribeSingleOrder(orderId) {
  if (!orderId || unsubscribeById[orderId]) return;
  unsubscribeById[orderId] = onSnapshot(doc(db, 'orders', orderId), (orderSnap) => {
    if (!orderSnap.exists()) return;
    renderOrder(orderId, { id: orderSnap.id, ...orderSnap.data() });
  }, (err) => console.error('Order subscribe error:', err));
}

async function loadOrdersOnce() {
  const user = getUser();
  if (!isLoggedIn(user)) {
    const urlOrderId = saveOrderFromUrl();
    if (urlOrderId) {
      document.getElementById('ordersList').innerHTML = '';
      subscribeSingleOrder(urlOrderId);
      return;
    }
    renderEmpty('Войдите в аккаунт, чтобы видеть свои заказы с любого устройства.');
    return;
  }

  try {
    const res = await fetch('/api/list-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.userId, sessionToken: user.sessionToken })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('sb_user');
      window.SBUserState?.refresh?.();
      renderEmpty(data.error || 'Сессия устарела. Войдите заново.');
      return;
    }
    if (!res.ok || !data.ok) throw new Error(data.error || 'Не удалось загрузить заказы');
    renderOrders(Array.isArray(data.orders) ? data.orders : []);
  } catch (e) {
    console.error(e);
    renderEmpty(e.message || 'Не удалось загрузить заказы. Обновите страницу.');
  }
}

function initOrdersPage() {
  const urlOrderId = saveOrderFromUrl();
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    showToast('✅ Оплата прошла. Заказ создан.');
    window.history.replaceState({}, document.title, 'orders.html');
  }

  loadOrdersOnce();
  if (urlOrderId) subscribeSingleOrder(urlOrderId);
  refreshTimer = setInterval(loadOrdersOnce, 20000);
}

initOrdersPage();

function showToast(status) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  let toastClass = 'process';
  if (status.includes('✅') || status.includes('🟢')) toastClass = 'done';
  else if (status.includes('🟠')) toastClass = 'partial';
  else if (status.includes('🔴')) toastClass = 'cancel';
  toast.className = `toast ${toastClass}`;
  toast.innerText = status;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

window.addEventListener('beforeunload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
  Object.values(unsubscribeById).forEach(fn => { try { fn(); } catch {} });
});
