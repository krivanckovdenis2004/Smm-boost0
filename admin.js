import { firebaseApp } from "./firebase.js?v=20260716-auth-v9";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(firebaseApp);

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

  if (currentFilter === "process") {
    return s.includes("🟡") || s.includes("🕓") || s.includes("pending") || s.includes("process") || s.includes("обработ") || s.includes("ожидает");
  }

  if (currentFilter === "done") {
    return s.includes("🟢") || s.includes("completed") || s.includes("done") || s.includes("выполн");
  }

  if (currentFilter === "cancel") {
    return s.includes("🔴") || s.includes("cancel") || s.includes("отмен");
  }

  return true;
}

function formatDate(value) {
  try {
    if (!value || !value.toDate) return "—";
    return value.toDate().toLocaleString("ru-RU");
  } catch {
    return "—";
  }
}

function renderOrders() {
  ordersContainer.innerHTML = "";

  const filtered = allOrders.filter(({ order }) => shouldShow(order.status || ""));

  if (filtered.length === 0) {
    ordersContainer.innerHTML = '<p class="emptyOrders">Заказов пока нет</p>';
    return;
  }

  filtered.forEach(({ id, order }) => {
    const status = order.status || "🕓 Ожидает оплаты";
    const statusClass = getStatusClass(status);
    const publicOrderId = order.publicOrderId || id.slice(0, 8).toUpperCase();

    const card = document.createElement("div");
    card.className = "card admin-order-card compact-order-card";

    card.innerHTML = `
      <div class="order-card-top">
        <span class="order-id">ID: ${publicOrderId}</span>
        <span class="statusBadge ${statusClass}">${status}</span>
      </div>

      <h2>${order.service || "Заказ"}</h2>

      <div class="order-meta">
        <p><b>Количество:</b> ${order.amount || 0}</p>
        <p><b>Сумма:</b> ${order.price || 0}₽</p>
        <p><b>Оплата:</b> ${order.paymentMethod || "—"}</p>
        <p><b>JAP ID:</b> ${order.japOrderId || "—"}</p>
        <p><b>Создан:</b> ${formatDate(order.createdAt)}</p>
      </div>

      <a href="${order.link || "#"}" target="_blank" class="order-link">
        Открыть ссылку
      </a>

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
      await fetch(`/api/check-status?orderDocId=${encodeURIComponent(id)}`);
    });

    card.querySelector(".doneBtn").addEventListener("click", async () => {
      await updateDoc(doc(db, "orders", id), {
        status: "🟢 Выполнено",
        progress: 100
      });
    });

    card.querySelector(".cancelBtn").addEventListener("click", async () => {
      await updateDoc(doc(db, "orders", id), {
        status: "🔴 Отменено",
        progress: 100
      });
    });

    ordersContainer.appendChild(card);
  });
}

const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  allOrders = [];
  snapshot.forEach((docItem) => {
    allOrders.push({
      id: docItem.id,
      order: docItem.data()
    });
  });
  renderOrders();
});
