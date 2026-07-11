import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost-905d5.firebaseapp.com",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SERVICES = [
  { key: 'likes',      title: 'Лайки',      icon: '❤️', quantity: 50,  desc: 'Быстрые лайки на пост' },
  { key: 'followers',  title: 'Подписчики', icon: '👥', quantity: 20,  desc: 'Живые подписчики' },
  { key: 'views',      title: 'Просмотры',  icon: '👁',  quantity: 500, desc: 'Просмотры для видео/поста' },
  { key: 'reactions',  title: 'Реакции',    icon: '🔥', quantity: 50,  desc: 'Реакции для Telegram/VK' },
  { key: 'favorites',  title: 'Избранное',  icon: '⭐', quantity: 30,  desc: 'Добавления в избранное' },
  { key: 'shares',     title: 'Репосты',    icon: '🔁', quantity: 20,  desc: 'Репосты для охвата' }
];

const TG_CLICKED_KEY = 'sb_free_tg_clicked';

const els = {
  guest: document.getElementById('freeGuest'),
  stepTg: document.getElementById('freeStepTg'),
  tgOpen: document.getElementById('tgOpenBtn'),
  tgConfirm: document.getElementById('tgConfirmBtn'),
  tgHint: document.getElementById('tgHint'),
  hero: document.getElementById('freeHero'),
  timer: document.getElementById('freeTimer'),
  timerValue: document.getElementById('freeTimerValue'),
  servicesCard: document.getElementById('freeServicesCard'),
  grid: document.getElementById('freeServicesGrid'),
  formCard: document.getElementById('freeFormCard'),
  formTitle: document.getElementById('freeFormTitle'),
  formService: document.getElementById('freeFormService'),
  social: document.getElementById('freeSocial'),
  link: document.getElementById('freeLink'),
  user: document.getElementById('freeUser'),
  cancel: document.getElementById('freeCancelBtn'),
  submit: document.getElementById('freeSubmitBtn'),
  status: document.getElementById('freeStatus'),
  historyCard: document.getElementById('freeHistoryCard'),
  historyList: document.getElementById('freeHistoryList')
};

function getUser() {
  try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { return null; }
}
function isLoggedIn(u) { return Boolean(u && u.userId && u.sessionToken); }

let selectedService = null;
let nextAvailableAt = 0;
let timerHandle = null;

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }

function renderServices(disabled) {
  els.grid.innerHTML = '';
  SERVICES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'free-service-btn' + (disabled ? ' is-locked' : '');
    btn.disabled = disabled;
    btn.innerHTML = `
      <div class="free-service-icon">${s.icon}</div>
      <b>${s.title}</b>
      <span class="free-service-qty">+${s.quantity}</span>
      <span class="free-service-desc">${s.desc}</span>
    `;
    btn.addEventListener('click', () => openForm(s));
    els.grid.appendChild(btn);
  });
}

function openForm(service) {
  selectedService = service;
  els.formTitle.textContent = `${service.icon} ${service.title} × ${service.quantity}`;
  els.formService.textContent = `${service.title} × ${service.quantity}`;
  els.status.textContent = '';
  show(els.formCard);
  els.formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeForm() {
  selectedService = null;
  hide(els.formCard);
}

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tickTimer() {
  const left = nextAvailableAt - Date.now();
  if (left <= 0) {
    clearInterval(timerHandle);
    timerHandle = null;
    hide(els.timer);
    renderServices(false);
    return;
  }
  els.timerValue.textContent = fmt(left);
}

function startCooldown(untilMs) {
  nextAvailableAt = untilMs;
  show(els.timer);
  renderServices(true);
  closeForm();
  tickTimer();
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(tickTimer, 1000);
}

function renderHistory(history) {
  if (!history || !history.length) { hide(els.historyCard); return; }
  els.historyList.innerHTML = history.map(h => {
    const d = new Date(h.at || 0);
    const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `<div class="free-history-item">
      <div class="free-history-title">${h.title || '—'} × ${h.quantity || ''}</div>
      <div class="free-history-meta">${h.social || ''} · ${date} ${time}</div>
    </div>`;
  }).join('');
  show(els.historyCard);
}

async function loadStatus(user) {
  try {
    const q = new URLSearchParams({ userId: user.userId, sessionToken: user.sessionToken });
    const r = await fetch('/api/free-service?' + q.toString());
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) {
        localStorage.removeItem('sb_user');
        location.reload();
      }
      throw new Error(d.error || 'Ошибка загрузки');
    }
    if (d.remainingMs > 0) {
      startCooldown(d.nextAvailableAt);
    } else {
      hide(els.timer);
      renderServices(false);
    }
    renderHistory(d.history || []);
  } catch (e) {
    console.warn('[free] status', e);
    renderServices(false);
  }
}

async function submitClaim(user) {
  if (!selectedService) return;
  const social = els.social.value;
  const link = els.link.value.trim();
  const username = els.user.value.trim();
  if (!link) { els.status.textContent = '❌ Укажите ссылку'; return; }
  if (!username) { els.status.textContent = '❌ Укажите username'; return; }

  els.submit.disabled = true;
  els.status.textContent = 'Отправляем заявку...';

  try {
    const r = await fetch('/api/free-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        sessionToken: user.sessionToken,
        serviceKey: selectedService.key,
        social, link, telegramUser: username
      })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 429 && d.nextAvailableAt) {
        startCooldown(d.nextAvailableAt);
        els.status.textContent = '⏳ ' + (d.error || 'Подождите');
        return;
      }
      throw new Error(d.error || 'Ошибка');
    }
    els.status.textContent = '✅ ' + (d.message || 'Заявка принята');
    window.sbGoal?.('free_service', { service: selectedService.key });
    if (d.nextAvailableAt) startCooldown(d.nextAvailableAt);
    // Обновляем историю
    loadStatus(user);
  } catch (e) {
    els.status.textContent = '❌ ' + e.message;
  } finally {
    els.submit.disabled = false;
  }
}

function initTgStep(user) {
  hide(els.hero); hide(els.servicesCard); hide(els.historyCard);
  show(els.stepTg);

  if (localStorage.getItem(TG_CLICKED_KEY)) {
    els.tgConfirm.disabled = false;
  }

  els.tgOpen.addEventListener('click', () => {
    localStorage.setItem(TG_CLICKED_KEY, '1');
    setTimeout(() => { els.tgConfirm.disabled = false; els.tgHint.textContent = 'Готово — подтвердите подписку.'; }, 800);
  });

  els.tgConfirm.addEventListener('click', async () => {
    if (els.tgConfirm.disabled) return;
    els.tgConfirm.disabled = true;
    els.tgConfirm.textContent = 'Проверяем...';
    try {
      await updateDoc(doc(db, 'users', user.userId), { telegramSubscribed: true });
      const stored = getUser() || {};
      localStorage.setItem('sb_user', JSON.stringify({ ...stored, telegramSubscribed: true }));
      showMainScreen({ ...user, telegramSubscribed: true });
    } catch (e) {
      // Даже если не удалось записать (rules), всё равно пускаем: сервер проверит session.
      showMainScreen(user);
    }
  });
}

function showMainScreen(user) {
  hide(els.guest); hide(els.stepTg);
  show(els.hero); show(els.servicesCard);
  els.cancel.addEventListener('click', closeForm);
  els.submit.addEventListener('click', () => submitClaim(user));
  els.user.value = user.username || user.displayName || '';
  loadStatus(user);
}

function boot() {
  const user = getUser();
  if (!isLoggedIn(user)) {
    show(els.guest);
    return;
  }
  if (!user.telegramSubscribed && !localStorage.getItem(TG_CLICKED_KEY + '_done_' + user.userId)) {
    // Показываем шаг подписки только если пользователь ранее не подтверждал в этой сессии на этом устройстве
    initTgStep(user);
    // помечаем, чтобы после успешного подтверждения не показывать снова
    els.tgConfirm.addEventListener('click', () => {
      localStorage.setItem(TG_CLICKED_KEY + '_done_' + user.userId, '1');
    });
    return;
  }
  showMainScreen(user);
}

boot();
