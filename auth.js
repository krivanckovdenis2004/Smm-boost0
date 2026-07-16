// auth.js — контроллер страницы /auth.html. Гарантирует, что форма
// появляется мгновенно, без вечной загрузки, и корректно редиректит
// уже авторизованного пользователя.

import { auth, authReady } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const REDIRECT_AFTER_LOGIN = "/account.html";
const RESEND_COOLDOWN_MS = 60_000;
const INIT_HARD_TIMEOUT_MS = 6000;

const $ = (sel, root = document) => root.querySelector(sel);
const els = {
  skeleton: $("[data-auth-skeleton]"),
  card: $("[data-auth-card]"),
  error: $("[data-auth-error]"),
  toast: $("[data-toast-root]"),
  tabs: document.querySelectorAll("[data-tab]"),
  panels: document.querySelectorAll("[data-panel]"),
  signinForm: $("#form-signin"),
  signupForm: $("#form-signup"),
  resetForm: $("#form-reset"),
  googleBtn: $("[data-google]"),
  verifyPanel: $("[data-panel='verify']"),
  verifyEmail: $("[data-verify-email]"),
  resendBtn: $("[data-resend]"),
  resendTimer: $("[data-resend-timer]"),
  resetSent: $("[data-panel='reset-sent']"),
  resetSentEmail: $("[data-reset-sent-email]"),
};

// ─────────── UI helpers ───────────
function showSkeleton(show) {
  if (!els.skeleton || !els.card) return;
  els.skeleton.hidden = !show;
  els.card.hidden = show;
}
function showError(msg) {
  if (!els.error) return alert(msg);
  els.error.textContent = msg;
  els.error.hidden = !msg;
}
function toast(msg, type = "info") {
  if (!els.toast) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  els.toast.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-in"));
  setTimeout(() => {
    el.classList.remove("toast-in");
    setTimeout(() => el.remove(), 300);
  }, 4000);
}
function activateTab(name) {
  els.tabs.forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", String(active));
  });
  els.panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
}
function humanError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "Некорректный email.",
    "auth/user-disabled": "Аккаунт отключён.",
    "auth/user-not-found": "Пользователь не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/email-already-in-use": "Такой email уже зарегистрирован. Войдите.",
    "auth/weak-password": "Пароль слишком простой (минимум 6 символов).",
    "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
    "auth/network-request-failed": "Проблема с сетью. Проверьте соединение.",
    "auth/popup-blocked": "Всплывающее окно заблокировано браузером.",
    "auth/popup-closed-by-user": "Окно входа было закрыто.",
    "auth/cancelled-popup-request": "Отменено.",
  };
  return map[code] || err?.message || "Что-то пошло не так. Повторите попытку.";
}

// ─────────── Verify / resend ───────────
let resendTimerId = null;
function startResendCooldown() {
  const btn = els.resendBtn;
  const timerEl = els.resendTimer;
  if (!btn) return;
  const until = Date.now() + RESEND_COOLDOWN_MS;
  btn.disabled = true;
  const tick = () => {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (timerEl) timerEl.textContent = left ? ` (${left}с)` : "";
    if (left <= 0) {
      btn.disabled = false;
      clearInterval(resendTimerId);
    }
  };
  clearInterval(resendTimerId);
  tick();
  resendTimerId = setInterval(tick, 1000);
}

async function showVerifyPanel(email) {
  activateTab("verify");
  if (els.verifyEmail) els.verifyEmail.textContent = email || auth.currentUser?.email || "";
  startResendCooldown();
}

// ─────────── Handlers ───────────
async function handleSignup(e) {
  e.preventDefault();
  showError("");
  const email = e.target.email.value.trim();
  const password = e.target.password.value;
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.dataset.label = btn.textContent;
  btn.textContent = "Создаём аккаунт...";
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(user, { url: window.location.origin + "/auth.html?verified=1" });
    } catch (err) {
      console.warn("[auth] verification send failed", err);
    }
    toast("Аккаунт создан. Проверьте почту.", "success");
    await showVerifyPanel(email);
  } catch (err) {
    showError(humanError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
}

async function handleSignin(e) {
  e.preventDefault();
  showError("");
  const email = e.target.email.value.trim();
  const password = e.target.password.value;
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.dataset.label = btn.textContent;
  btn.textContent = "Входим...";
  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast("Вход выполнен", "success");
    setTimeout(() => (window.location.href = REDIRECT_AFTER_LOGIN), 300);
  } catch (err) {
    showError(humanError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
}

async function handleReset(e) {
  e.preventDefault();
  showError("");
  const email = e.target.email.value.trim();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.dataset.label = btn.textContent;
  btn.textContent = "Отправляем...";
  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/reset-password.html",
    });
    activateTab("reset-sent");
    if (els.resetSentEmail) els.resetSentEmail.textContent = email;
  } catch (err) {
    showError(humanError(err));
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
}

async function handleResend() {
  if (!auth.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser, {
      url: window.location.origin + "/auth.html?verified=1",
    });
    toast("Письмо отправлено повторно", "success");
    startResendCooldown();
  } catch (err) {
    toast(humanError(err), "error");
  }
}

async function handleGoogle() {
  showError("");
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    toast("Вход через Google выполнен", "success");
    setTimeout(() => (window.location.href = REDIRECT_AFTER_LOGIN), 300);
  } catch (err) {
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/operation-not-supported-in-this-environment") {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (err2) {
        showError(humanError(err2));
        return;
      }
    }
    if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
      showError(humanError(err));
    }
  }
}

// ─────────── Init ───────────
async function init() {
  // Обработать редирект-результат Google, если возвращались с /__/auth/handler
  try {
    await getRedirectResult(auth);
  } catch (err) {
    console.warn("[auth] redirect result", err);
  }

  // Ждём определение состояния — с жёстким таймаутом.
  const user = await Promise.race([
    authReady,
    new Promise((res) => setTimeout(() => res(null), INIT_HARD_TIMEOUT_MS)),
  ]);

  // Если уже авторизован — редиректим, не показываем форму регистрации.
  if (user) {
    window.location.replace(REDIRECT_AFTER_LOGIN);
    return;
  }

  // Показываем форму.
  showSkeleton(false);

  // Определяем начальную вкладку по query.
  const params = new URLSearchParams(location.search);
  if (params.get("verified") === "1") {
    toast("Email подтверждён. Войдите в аккаунт.", "success");
    activateTab("signin");
  } else if (params.get("tab") === "signup") {
    activateTab("signup");
  } else {
    activateTab(document.querySelector(".auth-tab.is-active")?.dataset.tab || "signin");
  }

  // Навешиваем обработчики.
  els.tabs.forEach((t) =>
    t.addEventListener("click", () => activateTab(t.dataset.tab)),
  );
  els.signinForm?.addEventListener("submit", handleSignin);
  els.signupForm?.addEventListener("submit", handleSignup);
  els.resetForm?.addEventListener("submit", handleReset);
  els.resendBtn?.addEventListener("click", handleResend);
  els.googleBtn?.addEventListener("click", handleGoogle);
}

// Гарантия, что даже при исключении в init() пользователь увидит форму.
init().catch((err) => {
  console.error("[auth] init failed", err);
  showSkeleton(false);
  showError("Не удалось инициализировать авторизацию. Обновите страницу.");
});

// Финальный предохранитель: если что-то пошло не по плану — снять skeleton.
setTimeout(() => {
  if (els.skeleton && !els.skeleton.hidden) {
    console.warn("[auth] hard fallback: revealing form");
    showSkeleton(false);
  }
}, INIT_HARD_TIMEOUT_MS + 500);
