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
  const amount = Number(input.value || 0);
  const price = calculateCardPrice(card, amount);

  total.innerText = price.toFixed(2) + "₽";

  const mode = card.dataset.priceMode || "per1000";
  if (amount > 0 && (amount < min || (mode === "per3" && amount % 3 !== 0))) {
    error.style.display = "block";
  } else {
    error.style.display = "none";
  }
}

function openOrderModal(card) {
  const input = card.querySelector(".service-amount");
  const amount = Number(input.value || 0);
  const min = Number(card.dataset.min || 1);

  const mode = card.dataset.priceMode || "per1000";

  if (amount < min) {
    alert(`Минимальный заказ: ${min}`);
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
  document.getElementById("orderModal").style.display = "flex";
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

async function createPayment(type) {
  const link = document.getElementById("instagramLink").value.trim();
  const socialRegex = /instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vk\.com|vk\.ru|t\.me|telegram\.me/i;

  if (!socialRegex.test(link)) {
    alert("Введите корректную ссылку на соцсеть");
    return;
  }

  if (!currentServiceId) {
    alert("Выберите услугу заново");
    return;
  }

  const button = type === "crypto"
    ? document.getElementById("cryptoPayButton")
    : document.getElementById("yookassaPayButton");

  const originalText = button.innerText;
  button.disabled = true;
  button.innerText = "Создание оплаты...";

  try {
    const publicOrderId = generateOrderId();

    const docRef = await addDoc(collection(db, "orders"), {
      publicOrderId,
      service: currentService,
      serviceId: String(currentServiceId),
      amount: Number(currentAmount),
      price: Number(currentPrice.toFixed(2)),
      link,
      status: "🕓 Ожидает оплаты",
      paymentMethod: type === "crypto" ? "CryptoBot" : "ЮKassa",
      japOrderId: "",
      createdAt: serverTimestamp()
    });

    saveMyOrder(docRef.id);

    const response = await fetch(
      type === "crypto" ? "/api/create-invoice" : "/api/create-yookassa",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(currentPrice.toFixed(2)),
          description: `${currentService} — ${currentAmount}`,
          service: currentService,
          serviceId: String(currentServiceId),
          quantity: currentAmount,
          link,
          orderDocId: docRef.id,
          publicOrderId
        })
      }
    );

    const data = await response.json();
    console.log(data);

    if (type === "crypto") {
      if (data.ok && data.result && data.result.pay_url) {
        window.location.href = data.result.pay_url;
        return;
      }
    } else {
      if (data.confirmation && data.confirmation.confirmation_url) {
        window.location.href = data.confirmation.confirmation_url;
        return;
      }
    }

    alert(data.description || data.error || "Ошибка создания оплаты");
  } catch (e) {
    console.error(e);
    alert("Ошибка создания оплаты");
  }

  button.disabled = false;
  button.innerText = originalText;
}

const cryptoPayButton = document.getElementById("cryptoPayButton");
const yookassaPayButton = document.getElementById("yookassaPayButton");

if (cryptoPayButton) {
  cryptoPayButton.addEventListener("click", () => createPayment("crypto"));
}

if (yookassaPayButton) {
  yookassaPayButton.addEventListener("click", () => createPayment("yookassa"));
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
