import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc
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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');
const orderInfo = document.getElementById('orderInfo');

async function loadOrder() {
  if (!orderId) { orderInfo.textContent = 'ID заказа не найден'; return; }
  if (!/^[a-zA-Z0-9_-]{15,}$/.test(orderId)) { orderInfo.textContent = 'Некорректный ID заказа'; return; }

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      const order = orderSnap.data();
      const status = order.status || '';
      let statusClass = 'processStatus';
      if (status.includes('🟢')) statusClass = 'doneStatus';
      else if (status.includes('🔴')) statusClass = 'cancelStatus';
      else if (status.includes('🟠')) statusClass = 'partialStatus';
      else if (status.includes('🕓')) statusClass = 'waitStatus';

      orderInfo.innerHTML = `
        <p><b>Услуга:</b> ${escapeHtml(order.service || '—')}</p>
        <p><b>Количество:</b> ${escapeHtml(order.amount || 0)}</p>
        <p><b>Сумма:</b> ${escapeHtml(order.price || 0)}₽</p>
        <p><b>Статус:</b> <span class="statusBadge ${statusClass}">${escapeHtml(status || '—')}</span></p>
      `;
    } else { orderInfo.textContent = 'Заказ не найден'; }
  } catch (e) {
    console.error('Track error:', e);
    orderInfo.textContent = 'Ошибка загрузки заказа. Попробуйте позже.';
  }
}

loadOrder();
