import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
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

let allServices = [];
let currentService = null;

function qs(id) { return document.getElementById(id); }

function getSbUser() {
  try { return JSON.parse(localStorage.getItem("sb_user") || "null"); }
  catch { return null; }
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

function setupMenu() {
  const btn = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opened = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

function saveMyOrder(orderDocId) {
  const myOrders = JSON.parse(localStorage.getItem("myOrders") || "[]");
  if (orderDocId && !myOrders.includes(orderDocId)) {
    myOrders.unshift(orderDocId);
    localStorage.setItem("myOrders", JSON.stringify(myOrders));
  }
}

function normalizeSocialLink(raw) {
  let link = String(raw || '').trim();
  if (!link) return '';
  if (!/^https?:\/\//i.test(link)) {
    if (/^(www\.|instagram\.com|tiktok\.com|vk\.com|vk\.ru|t\.me|telegram\.me|telegram\.dog|youtube\.com|youtu\.be|facebook\.com|x\.com|twitter\.com|twitch\.tv|discord\.gg|open\.spotify\.com)/i.test(link)) {
      link = 'https://' + link.replace(/^\/\/+/, '');
    }
  }
  return link;
}

function rub(value) {
  const n = Number(value || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₽';
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function estimateByCategory(service) {
  const cat = String(service?.category || '').toLowerCase();
  const name = String(service?.originalName || service?.name || '').toLowerCase();
  if (/instant|мгновен/.test(name)) return '~10–30 мин';
  if (/просмотр|view/.test(cat)) return '~1–6 ч';
  if (/лайк|like|реакц/.test(cat)) return '~1–3 ч';
  if (/коммент|comment/.test(cat)) return '~6–24 ч';
  if (/подписчик|друз|участник|follower|member|friend/.test(cat)) return '~12–48 ч';
  if (/репост|share|сохран|save/.test(cat)) return '~2–8 ч';
  if (/сторис|story/.test(cat)) return '~1–4 ч';
  if (/эфир|live|stream/.test(cat)) return '~5–30 мин';
  return '~6–24 ч';
}

function formatAverageTime(value, service) {
  const fallback = estimateByCategory(service);
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (/not enough data|no data|n\/?a/i.test(raw)) return fallback;
  const num = Number(String(raw).replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const mins = Math.round(num);
  if (mins < 60) return `~${mins} мин`;
  const hours = mins / 60;
  if (hours < 24) {
    const h = Math.round(hours * 10) / 10;
    return `~${h} ч`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `~${days} дн`;
}


function setOptions(select, values, placeholder) {
  if (!select) return;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function getSelectedService() {
  const id = qs('quickService')?.value || '';
  return allServices.find(s => String(s.id) === String(id)) || null;
}

function updateQuickSummary() {
  const service = getSelectedService();
  currentService = service;
  const qty = Number(qs('quickQuantity')?.value || 0);
  const price = service && qty > 0 ? (qty / 1000) * Number(service.price || 0) : 0;

  if (qs('quickMinMax')) {
    qs('quickMinMax').textContent = service
      ? `Лимит: ${service.min} – ${service.max.toLocaleString('ru-RU')}`
      : 'Выберите услугу';
  }
  if (qs('quickPricePer1000')) {
    qs('quickPricePer1000').textContent = service ? `${rub(service.price)} / 1000` : '—';
  }
  if (qs('quickOrderPrice')) qs('quickOrderPrice').textContent = rub(price);
  if (qs('quickDescription')) {
    qs('quickDescription').innerHTML = service ? `
      <div>🆔 ID услуги: <b>${service.id}</b></div>
      <div>🌐 Соцсеть: <b>${service.platform}</b></div>
      <div>📌 Категория: <b>${service.category}</b></div>
      <div>💸 Цена: <b>${rub(service.price)} / 1000</b></div>
      <div>📦 Лимит заказа: <b>${service.min} – ${service.max.toLocaleString('ru-RU')}</b></div>
      <div>⏱ Примерное время выполнения: <b>${formatAverageTime(service.averageTime, service)}</b></div>
      ${service.refill ? '<div>♻️ Есть отметка гарантии/refill</div>' : ''}
    ` : 'Выберите соцсеть, категорию и услугу, чтобы увидеть описание.';
  }
}

function refreshCategories() {
  const social = qs('quickSocial')?.value || '';
  const list = allServices.filter(s => !social || s.platform === social);
  const categories = unique(list.map(s => s.category)).sort((a, b) => a.localeCompare(b, 'ru'));
  setOptions(qs('quickCategory'), categories, 'Выберите категорию');
  setOptions(qs('quickService'), [], 'Сначала выберите категорию');
  updateQuickSummary();
}

function refreshServices() {
  const social = qs('quickSocial')?.value || '';
  const category = qs('quickCategory')?.value || '';
  const list = allServices
    .filter(s => (!social || s.platform === social) && (!category || s.category === category))
    .sort((a, b) => Number(a.price) - Number(b.price));

  const select = qs('quickService');
  if (!select) return;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = list.length ? 'Выберите услугу' : 'Услуг не найдено';
  select.appendChild(first);

  list.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.id} — ${service.name} — ${rub(service.price)} / 1000`;
    select.appendChild(option);
  });
  updateQuickSummary();
}

async function loadJapServices() {
  const form = qs('quickOrderForm');
  if (!form) return;

  const status = qs('quickServicesStatus');
  if (status) status.textContent = 'Загрузка услуг JAP...';

  try {
    const response = await fetch('/api/service-catalog?ts=' + Date.now(), { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !Array.isArray(data.services)) {
      throw new Error(data.error || 'Не удалось загрузить услуги');
    }
    allServices = data.services;
    const platforms = unique(allServices.map(s => s.platform)).sort((a, b) => a.localeCompare(b, 'ru'));
    setOptions(qs('quickSocial'), platforms, 'Выберите соцсеть');
    if (status) status.textContent = `Загружено услуг: ${data.count}`;
  } catch (e) {
    if (status) status.textContent = 'Ошибка загрузки услуг: ' + e.message;
  }
}

async function submitQuickOrder(event) {
  event.preventDefault();

  const user = requireSbUser();
  if (!user) {
    alert('Сначала зарегистрируйтесь или войдите в аккаунт');
    window.location.href = 'auth.html';
    return;
  }

  const service = getSelectedService();
  if (!service) return alert('Выберите услугу');

  const quantity = Math.floor(Number(qs('quickQuantity')?.value || 0));
  if (!Number.isFinite(quantity) || quantity < service.min || quantity > service.max) {
    return alert(`Количество должно быть от ${service.min} до ${service.max}`);
  }

  const linkInput = qs('quickLink');
  const link = normalizeSocialLink(linkInput?.value || '');
  if (linkInput) linkInput.value = link;
  if (!/^https?:\/\//i.test(link)) return alert('Введите полную ссылку');

  const btn = qs('quickSubmitBtn');
  const original = btn?.textContent || 'Отправить';
  if (btn) { btn.disabled = true; btn.textContent = 'Создание заказа...'; }

  try {
    const response = await fetch('/api/balance-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        login: user.username || user.displayName || user.email || '',
        sessionToken: user.sessionToken,
        service: service.name,
        serviceId: String(service.id),
        quantity,
        link,
        requestId: (crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2)))
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('sb_user');
      window.SBUserState?.refresh?.();
      throw new Error(data.error || 'Сначала войдите в аккаунт');
    }
    if (!response.ok || !data.ok) throw new Error(data.error || 'Ошибка создания заказа');

    saveMyOrder(data.orderDocId);
    window.sbGoal?.('order_created', { order_id: data.publicOrderId || data.orderDocId, value: Number(qs('quickOrderPrice')?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || 0) });
    alert('Заказ создан и отправлен в работу');
    window.location.href = 'orders.html?order=' + encodeURIComponent(data.orderDocId || '');
  } catch (e) {
    alert(e.message || 'Ошибка заказа');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}

function setupQuickOrder() {
  const form = qs('quickOrderForm');
  if (!form) return;
  qs('quickSocial')?.addEventListener('change', refreshCategories);
  qs('quickCategory')?.addEventListener('change', refreshServices);
  qs('quickService')?.addEventListener('change', updateQuickSummary);
  qs('quickQuantity')?.addEventListener('input', updateQuickSummary);
  form.addEventListener('submit', submitQuickOrder);
  loadJapServices();
}

function setupLiveOrders() {
  const liveContainer = qs('live-orders');
  if (!liveContainer) return;

  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
  let lastOrderId = null;
  let initialized = false;

  onSnapshot(q, (snapshot) => {
    if (!initialized) { initialized = true; return; }
    snapshot.forEach((docItem) => {
      if (docItem.id === lastOrderId) return;
      lastOrderId = docItem.id;
      const order = docItem.data();
      if (order.status && order.status.includes('Ожидает оплаты')) return;
      const div = document.createElement('div');
      div.className = 'live-order';
      div.innerHTML = `🔥 Новый заказ<br><br>${order.service} × ${order.amount}`;
      liveContainer.appendChild(div);
      const all = liveContainer.querySelectorAll('.live-order');
      if (all.length > 2) all[0].remove();
      setTimeout(() => div.remove(), 6000);
    });
  });
}

setupMenu();
setupQuickOrder();
setupLiveOrders();
