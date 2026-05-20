import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
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

const ordersContainer = document.getElementById('ordersContainer');
const filterButtons = document.querySelectorAll('.filterBtn');

let currentFilter = 'all';
let unsubscribeOrders = null;

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector('.activeFilter')?.classList.remove('activeFilter');
    btn.classList.add('activeFilter');
    currentFilter = btn.dataset.filter;
    loadOrders();
  });
});

function getStatusClass(status = '') {
  if (status.includes('🟢')) return 'doneStatus';
  if (status.includes('🔴')) return 'cancelStatus';
  if (status.includes('🟠')) return 'partialStatus';
  if (status.includes('🕓')) return 'waitStatus';
  return 'processStatus';
}

function shouldShow(status = '') {
  if (currentFilter === 'all') return true;

  const s = status.toLowerCase();

  if (currentFilter === 'process') {
    return (
      s.includes('🟡') ||
      s.includes('🕓') ||
      s.includes('pending') ||
      s.includes('process') ||
      s.includes('обработ') ||
      s.includes('ожида')
    );
  }

  if (currentFilter === 'done') {
    return (
      s.includes('🟢') ||
      s.includes('completed') ||
      s.includes('done') ||
      s.includes('выполн')
    );
  }

  if (currentFilter === 'cancel') {
    return (
      s.includes('🔴') ||
      s.includes('cancel') ||
      s.includes('отмен')
    );
  }

  return true;
}

function getProgress(order) {
  if (typeof order.progress === 'number') {
    return Math.min(100, Math.max(0, order.progress));
  }

  const status = order.status || '';
  if (status.includes('🟢')) return 100;
  if (status.includes('🔴')) return 100;
  if (status.includes('🟠')) return 80;
  if (status.includes('🟡')) return 60;
  if (status.includes('🕓')) return 15;
  return 50;
}

function getSafe(value, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  return value;
}

async function setOrderStatus(orderId, status, progress) {
  await updateDoc(doc(db, 'orders', orderId), {
    status,
    progress
  });
}

async function checkJap(orderId) {
  try {
    await fetch(`/api/check-status?orderDocId=${encodeURIComponent(orderId)}`);
  } catch (e) {
    console.error(e);
    alert('Не удалось проверить JAP статус');
  }
}

function renderOrder(docItem) {
  const order = docItem.data();
  const status = order.status || '🕓 Ожидает оплаты';

  if (!shouldShow(status)) return;

  const statusClass = getStatusClass(status);
  const publicOrderId = order.publicOrderId || docItem.id.slice(0, 8).toUpperCase();
  const progress = getProgress(order);

  const card = document.createElement('div');
  card.className = 'card compact-order-card admin-order-card';

  card.innerHTML = `
    <div class="order-card-top">
      <span class="order-id">ID: ${publicOrderId}</span>
      <span class="statusBadge ${statusClass}">${status}</span>
    </div>

    <h2>${getSafe(order.service, 'Заказ')}</h2>

    <div class="order-meta">
      <p><b>Количество:</b> ${getSafe(order.amount, 0)}</p>
      <p><b>Сумма:</b> ${getSafe(order.price, 0)}₽</p>
      <p><b>Оплата:</b> ${getSafe(order.paymentMethod)}</p>
      <p><b>JAP ID:</b> ${getSafe(order.japOrderId)}</p>
      ${order.japStatus ? `<p><b>JAP статус:</b> ${order.japStatus}</p>` : ''}
    </div>

    <a href="${order.link || '#'}" target="_blank" class="order-link">
      Открыть ссылку
    </a>

    <div class="progressBar small-progress">
      <div class="progressFill" style="width:${progress}%"></div>
    </div>

    <div class="admin-order-actions">
      <button class="admin-action-btn process-btn">🟡 В обработке</button>
      <button class="admin-action-btn done-btn">🟢 Выполнен</button>
      <button class="admin-action-btn partial-btn">🟠 Частично</button>
      <button class="admin-action-btn cancel-btn">🔴 Отменён</button>
      <button class="admin-action-btn sync-btn">🔄 JAP</button>
    </div>
  `;

  card.querySelector('.process-btn').addEventListener('click', () => {
    setOrderStatus(docItem.id, '🟡 В обработке', 60);
  });

  card.querySelector('.done-btn').addEventListener('click', () => {
    setOrderStatus(docItem.id, '🟢 Выполнено', 100);
  });

  card.querySelector('.partial-btn').addEventListener('click', () => {
    setOrderStatus(docItem.id, '🟠 Частично выполнено', 80);
  });

  card.querySelector('.cancel-btn').addEventListener('click', () => {
    setOrderStatus(docItem.id, '🔴 Отменено', 100);
  });

  card.querySelector('.sync-btn').addEventListener('click', () => {
    checkJap(docItem.id);
  });

  ordersContainer.appendChild(card);
}

function loadOrders() {
  if (!ordersContainer) return;

  if (unsubscribeOrders) {
    unsubscribeOrders();
  }

  const q = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc')
  );

  unsubscribeOrders = onSnapshot(q, (snapshot) => {
    ordersContainer.innerHTML = '';

    if (snapshot.empty) {
      ordersContainer.innerHTML = '<p class="emptyOrders">Заказов пока нет</p>';
      return;
    }

    snapshot.forEach(renderOrder);

    if (!ordersContainer.innerHTML.trim()) {
      ordersContainer.innerHTML = '<p class="emptyOrders">Нет заказов по выбранному фильтру</p>';
    }
  });
}

loadOrders();
