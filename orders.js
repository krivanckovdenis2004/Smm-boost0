import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const shownStatuses = {};
const lastStatusChecks = {};
const unsubscribeById = {};
let userOrdersUnsubscribe = null;

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
  const myOrders = JSON.parse(localStorage.getItem('myOrders')) || [];
  if (!myOrders.includes(orderId)) {
    myOrders.unshift(orderId);
    localStorage.setItem('myOrders', JSON.stringify(myOrders));
  }
  return orderId;
}

function getProgress(order) {
  const status = order.status || '';
  if (typeof order.progress === 'number') return Math.min(100, Math.max(0, order.progress));
  if (!status) return 10;
  if (status.includes('🕓')) return 15;
  if (status.includes('🟡')) return 60;
  if (status.includes('🟠')) return 80;
  if (status.includes('🟢')) return 100;
  if (status.includes('🔴')) return 100;
  return 50;
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
  if (!link) return 'Открыть ссылку';
  const url = link.toLowerCase();
  if (url.includes('t.me') || url.includes('telegram.me')) return 'Открыть Telegram';
  if (url.includes('tiktok.com')) return 'Открыть TikTok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Открыть YouTube';
  if (url.includes('vk.com') || url.includes('vk.ru')) return 'Открыть VK';
  if (url.includes('instagram.com')) return 'Открыть Instagram';
  return 'Открыть ссылку';
}

function renderOrder(orderId, order) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  const status = order.status || '🕓 Ожидает оплаты';
  if (shownStatuses[orderId] && shownStatuses[orderId] !== status) showToast(status);
  shownStatuses[orderId] = status;
  if (shouldCheckJapStatus(order)) syncJapStatus(orderId);

  const statusClass = getStatusClass(status);
  const progress = getProgress(order);
  const publicOrderId = order.publicOrderId || orderId.slice(0, 8).toUpperCase();
  const cardHTML = `
    <div class="order-card compact-order-card" id="${orderId}">
      <div class="order-card-top">
        <span class="order-id">ID: ${publicOrderId}</span>
        <span class="statusBadge ${statusClass}">${status}</span>
      </div>
      <h2>${order.service || 'Заказ'}</h2>
      <div class="order-meta">
        <p><b>Количество:</b> ${order.amount || 0}</p>
        <p><b>Сумма:</b> ${order.price || 0}₽</p>
        <p><b>Оплата:</b> ${order.paymentMethod || '—'}</p>
        ${order.japStatus ? `<p><b>JAP:</b> ${order.japStatus}</p>` : ''}
      </div>
      <a href="${order.link || '#'}" target="_blank" class="order-link">${getLinkTitle(order.link || '')}</a>
      <div class="progressBar small-progress"><div class="progressFill" style="width:${progress}%"></div></div>
    </div>`;

  const existingCard = document.getElementById(orderId);
  if (existingCard) existingCard.outerHTML = cardHTML;
  else ordersList.insertAdjacentHTML('beforeend', cardHTML);
}

function renderEmpty(message) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  ordersList.innerHTML = `<p class="emptyOrders">${message}</p>`;
}

function subscribeSingleOrder(orderId) {
  if (!orderId || unsubscribeById[orderId]) return;
  unsubscribeById[orderId] = onSnapshot(doc(db, 'orders', orderId), (orderSnap) => {
    if (!orderSnap.exists()) return;
    renderOrder(orderId, orderSnap.data());
  });
}

function loadOrders() {
  const urlOrderId = saveOrderFromUrl();
  const params = new URLSearchParams(window.location.search);
  const user = getUser();

  if (params.get('paid') === '1') {
    showToast('✅ Оплата прошла. Заказ создан.');
    window.history.replaceState({}, document.title, 'orders.html');
  }

  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  ordersList.innerHTML = '';

  if (isLoggedIn(user)) {
    const q = query(collection(db, 'orders'), where('userId', '==', user.userId));
    userOrdersUnsubscribe = onSnapshot(q, (snapshot) => {
      ordersList.innerHTML = '';
      if (snapshot.empty) {
        renderEmpty('У вас пока нет заказов');
        return;
      }
      const docs = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
      docs.sort((a, b) => {
        const ta = a.data.createdAt?.seconds || 0;
        const tb = b.data.createdAt?.seconds || 0;
        return tb - ta;
      });
      docs.forEach(item => renderOrder(item.id, item.data));
    });
    return;
  }

  if (urlOrderId) {
    subscribeSingleOrder(urlOrderId);
    return;
  }

  renderEmpty('Войдите в аккаунт, чтобы видеть свои заказы с любого устройства.');
}

loadOrders();

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
