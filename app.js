import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
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

let currentService = "";
let currentServiceId = "";
let currentAmount = 0;
let currentPrice = 0;

function generateOrderId() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SB-${part}`;
}

function saveMyOrder(orderDocId) {
  const myOrders = JSON.parse(localStorage.getItem("myOrders")) || [];
  if (!myOrders.includes(orderDocId)) {
    myOrders.unshift(orderDocId);
    localStorage.setItem("myOrders", JSON.stringify(myOrders));
  }
}


function getSbUser() {
  try {
    return JSON.parse(localStorage.getItem("sb_user") || "null");
  } catch {
    return null;
  }
}

function isSbLoggedIn(user) {
  return Boolean(user && user.userId && user.sessionToken);
}

function requireSbUser() {
  const user = getSbUser();
  if (user && user.userId && !user.sessionToken) {
    localStorage.removeItem('sb_user');
    window.SBUserState?.refresh?.();
    return null;
  }
  return isSbLoggedIn(user) ? user : null;
}

function showAuthRequiredModal() {
  const modal = document.getElementById("orderModal");
  const authBox = document.getElementById("authRequiredBox");
  const orderBox = document.getElementById("orderFormBox");
  if (authBox) authBox.style.display = "block";
  if (orderBox) orderBox.style.display = "none";
  if (modal) modal.style.display = "flex";
}

function showOrderFormModal() {
  const modal = document.getElementById("orderModal");
  const authBox = document.getElementById("authRequiredBox");
  const orderBox = document.getElementById("orderFormBox");
  if (authBox) authBox.style.display = "none";
  if (orderBox) orderBox.style.display = "block";
  if (modal) modal.style.display = "flex";
}

function calculateCardPrice(card, amount) {
  const price = Number(card.dataset.price || 0);
  const mode = card.dataset.priceMode || "per1000";

  if (mode === "per1") {
    return amount * price;
  }

  if (mode === "per3") {
    return (amount / 3) * price;
  }

  return (amount / 1000) * price;
}

function updateCardTotal(card) {
  const input = card.querySelector(".service-amount");
  const total = card.querySelector(".service-total");
  const error = card.querySelector(".input-error");
  const min = Number(card.dataset.min || 1);
  const max = Number(card.dataset.max || 1000000);
  const amount = Number(input.value || 0);
  const price = calculateCardPrice(card, amount);

  total.innerText = price.toFixed(2) + "₽";

  const mode = card.dataset.priceMode || "per1000";
  if (amount > 0 && (amount < min || amount > max || (mode === "per3" && amount % 3 !== 0))) {
    error.style.display = "block";
  } else {
    error.style.display = "none";
  }
}

function openOrderModal(card) {
  const user = requireSbUser();
  if (!user) {
    showAuthRequiredModal();
    return;
  }

  const input = card.querySelector(".service-amount");
  const amount = Number(input.value || 0);
  const min = Number(card.dataset.min || 1);
  const max = Number(card.dataset.max || 1000000);

  const mode = card.dataset.priceMode || "per1000";

  if (amount < min) {
    alert(`Минимальный заказ: ${min}`);
    return;
  }

  if (amount > max) {
    alert(`Максимальный заказ: ${max}`);
    return;
  }

  if (mode === "per3" && amount % 3 !== 0) {
    alert("Для этой услуги количество должно быть кратно 3");
    return;
  }

  currentService = card.dataset.serviceName;
  currentServiceId = card.dataset.serviceId;
  currentAmount = amount;
  currentPrice = calculateCardPrice(card, amount);

  document.getElementById("serviceName").innerText = "Услуга: " + currentService;
  document.getElementById("serviceAmount").innerText = "Количество: " + currentAmount;
  document.getElementById("servicePrice").innerText = "Сумма: " + currentPrice.toFixed(2) + "₽";
  showOrderFormModal();
}

function showPlatform(platform) {
  document.querySelectorAll(".platform-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.platform === platform);
  });

  document.querySelectorAll(".service-card").forEach(card => {
    card.classList.toggle("active-service", card.dataset.platform === platform);
  });
}

document.querySelectorAll(".platform-btn").forEach(btn => {
  btn.addEventListener("click", () => showPlatform(btn.dataset.platform));
});

document.querySelectorAll(".service-card").forEach(card => {
  const input = card.querySelector(".service-amount");
  const button = card.querySelector(".order-btn");

  input.addEventListener("input", () => updateCardTotal(card));
  button.addEventListener("click", () => openOrderModal(card));
});

showPlatform("Instagram");



function normalizeSocialLink(raw) {
  let link = String(raw || '').trim();
  if (!link) return '';
  if (!/^https?:\/\//i.test(link)) {
    if (/^(www\.|instagram\.com|tiktok\.com|vk\.com|vk\.ru|t\.me|telegram\.me|telegram\.dog|youtube\.com|youtu\.be)/i.test(link)) {
      link = 'https://' + link.replace(/^\/\/+/, '');
    }
  }
  return link;
}

function linkMatchesSelectedService(link) {
  const name = String(currentService || '').toLowerCase();
  const id = String(currentServiceId || '');
  const value = String(link || '').toLowerCase();
  if (name.includes('telegram') || ['1165','8862','10298','8485','7411','8811'].includes(id)) return /(t\.me|telegram\.me|telegram\.dog)/i.test(value);
  if (name.includes('vk') || name.includes('вк') || ['3752','1543','3757','7737','3761','4186'].includes(id)) return /(vk\.com|vk\.ru)/i.test(value);
  if (name.includes('tiktok') || ['10238','10136','10019','8526','2260','10122','8101','10022','1978'].includes(id)) return /tiktok\.com/i.test(value);
  if (name.includes('youtube') || /youtube|youtu/.test(name)) return /(youtube\.com|youtu\.be)/i.test(value);
  return /instagram\.com/i.test(value);
}

async function createBalanceOrder() {
  const user = requireSbUser();
  if (!user) {
    showAuthRequiredModal();
    return;
  }

  const linkInput = document.getElementById("instagramLink");
  const link = normalizeSocialLink(linkInput?.value || '');
  if (linkInput) linkInput.value = link;

  if (!link || !/^https?:\/\//i.test(link)) {
    alert("Введите полную ссылку на профиль, пост или видео");
    return;
  }

  if (!linkMatchesSelectedService(link)) {
    alert("Ссылка не подходит для выбранной услуги. Выберите правильную платформу или вставьте нужную ссылку.");
    return;
  }

  if (!currentServiceId) {
    alert("Выберите услугу заново");
    return;
  }

  const button = document.getElementById("balancePayButton");
  const originalText = button.innerText;
  button.disabled = true;
  button.innerText = "Создание заказа...";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("/api/balance-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        userId: user.userId,
        login: user.username || user.displayName || user.email || '',
        sessionToken: user.sessionToken,
        service: currentService,
        serviceId: String(({ '8777':'10238', '10136':'10238', '8526':'10019', '2260':'10019', '10022':'10122', '8101':'10122', '1543':'3752' }[String(currentServiceId)] || currentServiceId)),
        quantity: currentAmount,
        link
      })
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem('sb_user');
      window.SBUserState?.refresh?.();
      showAuthRequiredModal();
      throw new Error(data.error || "Сначала войдите в аккаунт");
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.error || ("Ошибка заказа с баланса. ID услуги: " + String(currentServiceId || "—")));
    }

    saveMyOrder(data.orderDocId);
    window.sbGoal?.('order_created', { order_id: data.publicOrderId || data.orderDocId, value: Number(currentPrice || 0) });
    alert("Заказ создан и отправлен в работу");
    window.location.href = "orders.html?order=" + encodeURIComponent(data.orderDocId);
    return;
  } catch (e) {
    const message = e.name === 'AbortError' ? 'Сервер долго не отвечает. Попробуйте ещё раз через минуту.' : (e.message || 'Ошибка заказа');
    alert(message);
  } finally {
    button.disabled = false;
    button.innerText = originalText;
  }
}

// Прямая оплата услуги отключена. Заказы создаются только после входа и только с баланса.

const balancePayButton = document.getElementById("balancePayButton");
if (balancePayButton) {
  balancePayButton.addEventListener("click", () => createBalanceOrder());
}

const liveContainer = document.getElementById("live-orders");

if (liveContainer) {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  let lastOrderId = null;
  let initialized = false;

  onSnapshot(q, (snapshot) => {
    if (!initialized) {
      initialized = true;
      return;
    }

    snapshot.forEach((docItem) => {
      if (docItem.id === lastOrderId) return;

      lastOrderId = docItem.id;
      const order = docItem.data();

      if (order.status && order.status.includes("Ожидает оплаты")) {
        return;
      }

      const div = document.createElement("div");
      div.className = "live-order";
      div.innerHTML = `🔥 Новый заказ<br><br>${order.service} × ${order.amount}`;

      liveContainer.appendChild(div);

      const allOrders = liveContainer.querySelectorAll(".live-order");
      if (allOrders.length > 2) {
        allOrders[0].remove();
      }

      setTimeout(() => {
        div.remove();
      }, 6000);
    });
  });
}

const closeModalBtn = document.getElementById("closeModal");

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    document.getElementById("orderModal").style.display = "none";
  });
}
