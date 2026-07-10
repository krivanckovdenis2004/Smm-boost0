import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  limit
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

function safeHref(url) {
  const u = String(url || "");
  if (/^https?:\/\//i.test(u)) return u;
  return "#";
}

async function checkAdminAccess() {
  const sbUser = localStorage.getItem("sb_user");
  if (!sbUser) return false;
  let user;
  try { user = JSON.parse(sbUser); } catch { return false; }
  if (!user.userId || !user.sessionToken) return false;
  try {
    const res = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.userId, sessionToken: user.sessionToken })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true && data.admin === true;
  } catch { return false; }
}

const adminLogin = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const adminLoginMsg = document.getElementById("adminLoginMsg");
const ordersContainer = document.getElementById("ordersContainer");
const filterButtons = document.querySelectorAll(".filterBtn");
let currentFilter = "all";
let allOrders = [];

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".activeFilter")?.classList.remove("activeFilter");
    btn.classList.add("activeFilter");
    currentFilter = btn.dataset.filter;
    renderOrders();
  });
});

function getStatusClass(status = "") {
  if (status.includes("🟢")) return "doneStatus";
  if (status.includes("🔴")) return "cancelStatus";
  if (status.includes("🟠")) return "partialStatus";
  if (status.includes("🕓")) return "waitStatus";
  return "processStatus";
}

function shouldShow(status = "") {
  const s = status.toLowerCase();
  if (currentFilter === "all") return true;
  if (currentFilter === "process") return s.includes("🟡") || s.includes("🕓") || s.includes("pending") || s.includes("process") || s.includes("обработ") || s.includes("ожидает");
  if (currentFilter === "done") return s.includes("🟢") || s.includes("completed") || s.includes("done") || s.includes("выполн");
  if (currentFilter === "cancel") return s.includes("🔴") || s.includes("cancel") || s.includes("отмен");
  return true;
}

function formatDate(value) {
  try {
    if (!value || !value.toDate) return "—";
    return value.toDate().toLocaleString("ru-RU");
  } catch { return "—"; }
}

function renderOrders() {
  ordersContainer.innerHTML = "";
  const filtered = allOrders.filter(({ order }) => shouldShow(order.status || ""));
  if (filtered.length === 0) { ordersContainer.innerHTML = '<p class="emptyOrders">Заказов пока нет</p>'; return; }

  filtered.forEach(({ id, order }) => {
    const status = order.status || "🕓 Ожидает оплаты";
    const statusClass = getStatusClass(status);
    const publicOrderId = order.publicOrderId || id.slice(0, 8).toUpperCase();
    const card = document.createElement("div");
    card.className = "card admin-order-card compact-order-card";
    card.innerHTML = `
      <div class="order-card-top">
        <span class="order-id">ID: ${escapeHtml(publicOrderId)}</span>
        <span class="statusBadge ${statusClass}">${escapeHtml(status)}</span>
      </div>
      <h2>${escapeHtml(order.service || "Заказ")}</h2>
      <div class="order-meta">
        <p><b>Количество:</b> ${escapeHtml(order.amount || 0)}</p>
        <p><b>Сумма:</b> ${escapeHtml(order.price || 0)}₽</p>
        <p><b>Оплата:</b> ${escapeHtml(order.paymentMethod || "—")}</p>
        <p><b>JAP ID:</b> ${escapeHtml(order.japOrderId || "—")}</p>
        <p><b>Создан:</b> ${escapeHtml(formatDate(order.createdAt))}</p>
      </div>
      <a href="${safeHref(order.link)}" target="_blank" rel="noopener noreferrer" class="order-link">Открыть ссылку</a>
      <div class="progressBar small-progress">
        <div class="progressFill" style="width:${Number(order.progress || 0)}%"></div>
      </div>
      <div class="admin-order-actions">
        <button class="syncBtn">🔄 Обновить JAP</button>
        <button class="doneBtn">🟢 Выполнен</button>
        <button class="cancelBtn">🔴 Отменен</button>
      </div>
    `;

    card.querySelector(".syncBtn").addEventListener("click", async () => {
      const sbUser = JSON.parse(localStorage.getItem("sb_user") || "{}");
      await fetch(`/api/check-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderDocId: id, userId: sbUser.userId, sessionToken: sbUser.sessionToken })
      });
    });

    card.querySelector(".doneBtn").addEventListener("click", async () => {
      if (!confirm("Отметить заказ как выполненный?")) return;
      await updateDoc(doc(db, "orders", id), { status: "🟢 Выполнено", progress: 100 });
    });

    card.querySelector(".cancelBtn").addEventListener("click", async () => {
      if (!confirm("Отменить заказ?")) return;
      await updateDoc(doc(db, "orders", id), { status: "🔴 Отменено", progress: 100 });
    });

    ordersContainer.appendChild(card);
  });
}

checkAdminAccess().then((isAdmin) => {
  if (!isAdmin) {
    if (adminLoginMsg) {
      adminLoginMsg.style.display = "block";
      adminLoginMsg.className = "auth-message error";
      adminLoginMsg.textContent = "Доступ запрещён. Войдите как администратор.";
    }
    return;
  }
  if (adminLogin) adminLogin.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
  onSnapshot(q, (snapshot) => {
    allOrders = [];
    snapshot.forEach((docItem) => { allOrders.push({ id: docItem.id, order: docItem.data() }); });
    renderOrders();
  });
});
