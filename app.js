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

let currentService = '';
let currentAmount = 0;
let currentPrice = 0;

function generateOrderId() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SB-${part}`;
}

function saveMyOrder(orderDocId) {
  const myOrders = JSON.parse(localStorage.getItem('myOrders')) || [];
  if (!myOrders.includes(orderDocId)) {
    myOrders.unshift(orderDocId);
    localStorage.setItem('myOrders', JSON.stringify(myOrders));
  }
}

const commentButtons = document.querySelectorAll('.comment-option');

commentButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    commentButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const value = parseInt(btn.dataset.value);
    const total = (value / 5) * 99;

    document.getElementById('commentsAmount').value = value;
    document.getElementById('commentsTotal').innerText = total.toFixed(2) + '₽';

    currentService = 'Комментарии';
    currentAmount = value;
    currentPrice = total;
  });
});

if (commentButtons.length > 0) {
  commentButtons[0].click();
}

function setupCalculator(inputId, totalId, pricePer1000, serviceName, minAmount) {
  const input = document.getElementById(inputId);
  const total = document.getElementById(totalId);
  const button = input.parentElement.querySelector('.order-btn');

  input.addEventListener('input', () => {
    const amount = parseFloat(input.value) || 0;
    const error = document.getElementById(inputId.replace('Amount', 'Error'));

    if (amount < minAmount) {
      error.style.display = 'block';
    } else {
      error.style.display = 'none';
    }

    let price = 0;

    if (serviceName === 'Комментарии') {
      price = Math.ceil(amount / 5) * 99;
    } else {
      price = (amount / 1000) * pricePer1000;
    }

    total.innerText = price.toFixed(2) + '₽';
  });

  button.addEventListener('click', () => {
    const amount = parseFloat(input.value) || 0;

    if (amount < minAmount) {
      alert(`Минимальный заказ: ${minAmount}`);
      return;
    }

    let price = 0;

    if (serviceName === 'Комментарии') {
      price = Math.ceil(amount / 5) * 99;
    } else {
      price = (amount / 1000) * pricePer1000;
    }

    currentService = serviceName;
    currentAmount = amount;
    currentPrice = price;

    document.getElementById('serviceName').innerText = 'Услуга: ' + serviceName;
    document.getElementById('serviceAmount').innerText = 'Количество: ' + amount;
    document.getElementById('servicePrice').innerText = 'Сумма: ' + price.toFixed(2) + '₽';
    document.getElementById('orderModal').style.display = 'flex';
  });
}

setupCalculator('followersAmount', 'followersTotal', 150, 'Подписчики', 100);
setupCalculator('likesAmount', 'likesTotal', 20, 'Лайки', 50);
setupCalculator('viewsAmount', 'viewsTotal', 7, 'Просмотры', 100);
setupCalculator('repostsAmount', 'repostsTotal', 70, 'Репосты', 10);
setupCalculator('commentsAmount', 'commentsTotal', 99, 'Комментарии', 5);

async function createPayment(type) {
  const link = document.getElementById('instagramLink').value.trim();
  const socialRegex = /instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vk\.com/i;

  if (!socialRegex.test(link)) {
    alert('Введите корректную ссылку на соцсеть');
    return;
  }

  const button = type === 'crypto'
    ? document.getElementById('cryptoPayButton')
    : document.getElementById('yookassaPayButton');

  const originalText = button.innerText;

  button.disabled = true;
  button.innerText = 'Создание оплаты...';

  try {
    const publicOrderId = generateOrderId();

    const docRef = await addDoc(collection(db, 'orders'), {
      publicOrderId,
      service: currentService,
      amount: Number(currentAmount),
      price: Number(currentPrice),
      link,
      status: '🕓 Ожидает оплаты',
      paymentMethod: type === 'crypto' ? 'CryptoBot' : 'ЮKassa',
      japOrderId: '',
      createdAt: serverTimestamp()
    });

    saveMyOrder(docRef.id);

    const response = await fetch(
      type === 'crypto' ? '/api/create-invoice' : '/api/create-yookassa',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: currentPrice,
          description: `${currentService} — ${currentAmount}`,
          service: currentService,
          quantity: currentAmount,
          link,
          orderDocId: docRef.id,
          publicOrderId
        })
      }
    );

    const data = await response.json();
    console.log(data);

    if (type === 'crypto') {
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

    alert(data.description || data.error || 'Ошибка создания оплаты');
  } catch (e) {
    console.error(e);
    alert('Ошибка создания оплаты');
  }

  button.disabled = false;
  button.innerText = originalText;
}

const cryptoPayButton = document.getElementById('cryptoPayButton');
const yookassaPayButton = document.getElementById('yookassaPayButton');

if (cryptoPayButton) {
  cryptoPayButton.addEventListener('click', () => createPayment('crypto'));
}

if (yookassaPayButton) {
  yookassaPayButton.addEventListener('click', () => createPayment('yookassa'));
}

const liveContainer = document.getElementById('live-orders');

if (liveContainer) {
  const q = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
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

      if (order.status && order.status.includes('Ожидает оплаты')) {
        return;
      }

      const div = document.createElement('div');
      div.className = 'live-order';
      div.innerHTML = `🔥 Новый заказ<br><br>${order.service} × ${order.amount}`;

      liveContainer.appendChild(div);

      const allOrders = liveContainer.querySelectorAll('.live-order');
      if (allOrders.length > 2) {
        allOrders[0].remove();
      }

      setTimeout(() => {
        div.remove();
      }, 6000);
    });
  });
}

const closeModalBtn = document.getElementById('closeModal');

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('orderModal').style.display = 'none';
  });
}
