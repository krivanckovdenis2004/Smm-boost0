// header.js — единственный контроллер шапки. Управляет отображением кнопки
// «Зарегистрироваться» vs пользовательского меню. Использует authReady как
// единственный источник истины, чтобы полностью исключить мерцание.

import { auth, authReady, subscribeAuth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const MOUNT_SELECTOR = "[data-auth-slot]"; // <div data-auth-slot></div> в шапке

const SKELETON_HTML = `
  <div class="auth-slot-skeleton" aria-busy="true" aria-label="Загрузка">
    <span class="skeleton-pill"></span>
  </div>`;

const GUEST_HTML = `
  <a href="/auth.html" class="btn btn-primary auth-register-btn" data-auth-register>
    Зарегистрироваться
  </a>`;

function userHtml(user) {
  const name = user.displayName || (user.email ? user.email.split("@")[0] : "Профиль");
  const email = user.email || "";
  const initial = (name[0] || "U").toUpperCase();
  const avatar = user.photoURL
    ? `<img src="${user.photoURL}" alt="" class="user-avatar-img" referrerpolicy="no-referrer" />`
    : `<span class="user-avatar-initial">${initial}</span>`;

  return `
  <div class="user-menu" data-user-menu>
    <button type="button" class="user-menu-trigger" data-user-menu-trigger aria-haspopup="menu" aria-expanded="false">
      <span class="user-avatar">${avatar}</span>
      <span class="user-menu-name">${escapeHtml(name)}</span>
      <svg class="user-menu-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="user-menu-dropdown" data-user-menu-dropdown role="menu" hidden>
      <div class="user-menu-header">
        <div class="user-menu-name-lg">${escapeHtml(name)}</div>
        ${email ? `<div class="user-menu-email">${escapeHtml(email)}</div>` : ""}
      </div>
      <a href="/account.html" class="user-menu-item" role="menuitem">Личный кабинет</a>
      <a href="/orders.html" class="user-menu-item" role="menuitem">Мои заказы</a>
      <a href="/balance.html" class="user-menu-item" role="menuitem">Пополнить баланс</a>
      <a href="/settings.html" class="user-menu-item" role="menuitem">Настройки</a>
      <button type="button" class="user-menu-item user-menu-item-danger" data-signout role="menuitem">Выйти</button>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function render(slot, user) {
  slot.innerHTML = user ? userHtml(user) : GUEST_HTML;
  if (user) wireMenu(slot);
}

function wireMenu(slot) {
  const trigger = slot.querySelector("[data-user-menu-trigger]");
  const dropdown = slot.querySelector("[data-user-menu-dropdown]");
  const signoutBtn = slot.querySelector("[data-signout]");
  if (!trigger || !dropdown) return;

  const close = () => {
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    dropdown.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };
  const toggle = () => (dropdown.hidden ? open() : close());

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  document.addEventListener("click", (e) => {
    if (!slot.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  signoutBtn?.addEventListener("click", async () => {
    signoutBtn.disabled = true;
    signoutBtn.textContent = "Выход...";
    try {
      await Promise.race([
        signOut(auth),
        new Promise((_, r) => setTimeout(() => r(new Error("signout-timeout")), 5000)),
      ]);
    } catch (err) {
      console.warn("[auth] signOut error", err);
    }
    // onAuthStateChanged сам перерисует слот в GUEST_HTML.
    // На всякий случай гарантируем немедленное обновление UI:
    render(slot, null);
    close();
  });
}

async function mount() {
  const slots = document.querySelectorAll(MOUNT_SELECTOR);
  if (!slots.length) return;

  // 1. Мгновенно показываем skeleton — никогда не мигаем кнопкой регистрации.
  slots.forEach((s) => {
    s.innerHTML = SKELETON_HTML;
  });

  // 2. Ждём первичное определение состояния (с внутренним таймаутом 6с).
  const initialUser = await authReady;
  slots.forEach((s) => render(s, initialUser));

  // 3. Подписываемся на дальнейшие изменения — единственная подписка в шапке.
  subscribeAuth((user) => {
    slots.forEach((s) => render(s, user));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
