// auth.js — страница авторизации без FOUC и без вечного loader.
// Интерфейс рисуется только после первичной проверки Firebase Auth.

import {
  auth,
  waitForAuthState,
  subscribeAuth,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithGoogleProvider,
  handleGoogleRedirectResult,
  applyEmailVerificationCode,
  signOutEverywhere,
  humanAuthError,
} from "./firebase.js?v=20260716-auth-v6";

const REDIRECT_AFTER_LOGIN = new URLSearchParams(location.search).get("next") || "/wallet.html";
const AUTH_INIT_TIMEOUT_MS = 12_000;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  splash: $("[data-auth-splash]"),
  app: $("[data-auth-app]"),
  tabs: $$("[data-tab]"),
  panels: $$("[data-panel]"),
  error: $("[data-auth-error]"),
  toastRoot: $("[data-toast-root]"),
  signinForm: $("#form-signin"),
  signupForm: $("#form-signup"),
  resetForm: $("#form-reset"),
  resendBtn: $("[data-resend]"),
  logoutBtns: $$("[data-logout]"),
  verifyEmail: $("[data-verify-email]"),
  resetSentEmail: $("[data-reset-sent-email]"),
  accountName: $("[data-account-name]"),
  accountEmail: $("[data-account-email]"),
  accountBalance: $("[data-account-balance]"),
  accountAvatar: $("[data-account-avatar]"),
};

let unsubscribeAuth = null;
let initialized = false;

captureReferral();

function captureReferral() {
  try {
    const ref = (new URLSearchParams(location.search).get("ref") || "").trim().toLowerCase();
    if (/^[0-9a-f]{32}$/.test(ref)) sessionStorage.setItem("sb_ref", ref);
  } catch (_) {}
}

function setSplash(show) {
  if (els.splash) els.splash.hidden = !show;
  if (els.app) els.app.hidden = show;
}

function showError(message = "") {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.hidden = !message;
}

function logAuthError(label, error) {
  console.groupCollapsed(`[SMM-Boost Auth Page] ${label}`);
  console.error(error);
  console.error(error?.code || "NO_ERROR_CODE");
  console.error(error?.message || "NO_ERROR_MESSAGE");
  console.error(error?.stack || "NO_ERROR_STACK");
  if (error?.customData) console.error("customData:", error.customData);
  console.groupEnd();
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error(`${label} не ответил за ${Math.round(timeoutMs / 1000)}с`);
        err.code = "auth/init-timeout";
        reject(err);
      }, timeoutMs);
    }),
  ]);
}

function toast(message, type = "info") {
  if (!els.toastRoot || !message) return;
  const node = document.createElement("div");
  node.className = `auth-toast auth-toast-${type}`;
  node.textContent = message;
  els.toastRoot.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-visible"));
  setTimeout(() => {
    node.classList.remove("is-visible");
    setTimeout(() => node.remove(), 220);
  }, 3600);
}

function setBusy(formOrButton, busy, label = "Подождите...") {
  const btn = formOrButton?.matches?.("button") ? formOrButton : formOrButton?.querySelector?.("button[type='submit'],button[data-action]");
  if (!btn) return;
  if (busy) {
    btn.dataset.prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
  } else {
    btn.disabled = false;
    if (btn.dataset.prevText) btn.textContent = btn.dataset.prevText;
    delete btn.dataset.prevText;
  }
}

function activatePanel(name) {
  showError("");
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  els.panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "₽";
}

function renderAccount(user) {
  if (!user) return;
  const name = user.displayName || user.username || user.email || "Пользователь";
  const email = user.email || "";
  if (els.accountName) els.accountName.textContent = name;
  if (els.accountEmail) els.accountEmail.textContent = email;
  if (els.accountBalance) els.accountBalance.textContent = formatMoney(Number(user.balance || 0) + Number(user.bonusBalance || 0));
  if (els.accountAvatar) {
    els.accountAvatar.innerHTML = user.photoURL
      ? `<img src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
      : `<span>${escapeHtml((name[0] || "U").toUpperCase())}</span>`;
  }
  activatePanel("account");
}

function renderVerify(email) {
  if (els.verifyEmail) els.verifyEmail.textContent = email || auth.currentUser?.email || "вашу почту";
  activatePanel("verify");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function handleUrlActionCodes() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  if (!mode || !oobCode) return false;

  if (mode === "resetPassword") {
    location.replace("/reset-password.html" + location.search);
    return true;
  }

  if (mode === "verifyEmail") {
    try {
      await applyEmailVerificationCode(oobCode);
      history.replaceState({}, "", "/auth.html?verified=1");
      toast("Email подтверждён. Теперь можно войти.", "success");
      activatePanel("signin");
    } catch (err) {
      logAuthError("loginWithEmail failed", err);
      showError(humanAuthError(err));
      activatePanel("signin");
    }
    return true;
  }

  return false;
}

function bindHandlers() {
  if (initialized) return;
  initialized = true;

  els.tabs.forEach((tab) => tab.addEventListener("click", () => activatePanel(tab.dataset.tab)));

  els.signinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showError("Введите email и пароль.");
    setBusy(form, true, "Входим...");
    try {
      const result = await loginWithEmail({ email, password });
      if (result.needsVerification) {
        renderVerify(email);
        toast("Подтвердите email, чтобы продолжить.", "warning");
        return;
      }
      toast("Вход выполнен.", "success");
      setTimeout(() => { location.href = REDIRECT_AFTER_LOGIN; }, 450);
    } catch (err) {
      logAuthError("registerWithEmail failed", err);
      showError(humanAuthError(err));
    } finally {
      setBusy(form, false);
    }
  });

  els.signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");
    const form = event.currentTarget;
    const displayName = form.displayName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || password.length < 6) return showError("Введите email и пароль минимум из 6 символов.");
    setBusy(form, true, "Создаём аккаунт...");
    try {
      await registerWithEmail({ email, password, displayName });
      renderVerify(email);
      toast("Аккаунт создан. Проверьте почту.", "success");
    } catch (err) {
      logAuthError("sendPasswordReset failed", err);
      showError(humanAuthError(err));
    } finally {
      setBusy(form, false);
    }
  });

  els.resetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");
    const form = event.currentTarget;
    const email = form.email.value.trim();
    if (!email) return showError("Введите email для восстановления.");
    setBusy(form, true, "Отправляем...");
    try {
      await sendPasswordReset(email);
      if (els.resetSentEmail) els.resetSentEmail.textContent = email;
      activatePanel("reset-sent");
      toast("Письмо для восстановления отправлено.", "success");
    } catch (err) {
      showError(humanAuthError(err));
    } finally {
      setBusy(form, false);
    }
  });

  $$('[data-google]').forEach((button) => {
    button.addEventListener("click", async () => {
      showError("");
      setBusy(button, true, "Открываем Google...");
      try {
        const result = await signInWithGoogleProvider();
        if (result?.redirect) return;
        toast("Вход через Google выполнен.", "success");
        setTimeout(() => { location.href = REDIRECT_AFTER_LOGIN; }, 450);
      } catch (err) {
        logAuthError("signInWithGoogleProvider failed", err);
        if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
          showError(humanAuthError(err));
        }
      } finally {
        setBusy(button, false);
      }
    });
  });

  els.resendBtn?.addEventListener("click", async () => {
    setBusy(els.resendBtn, true, "Отправляем...");
    try {
      await resendVerificationEmail();
      toast("Письмо отправлено повторно.", "success");
    } catch (err) {
      logAuthError("resendVerificationEmail failed", err);
      toast(humanAuthError(err), "error");
    } finally {
      setBusy(els.resendBtn, false);
    }
  });

  els.logoutBtns.forEach((button) => button.addEventListener("click", async () => {
    setBusy(button, true, "Выходим...");
    await signOutEverywhere();
    toast("Вы вышли из аккаунта.", "success");
    activatePanel("signin");
    setBusy(button, false);
  }));

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-switch-panel]");
    if (target) activatePanel(target.dataset.switchPanel);
  });
}

async function init() {
  if (location.hostname === "www.smm-boost.pro") {
    location.replace("https://smm-boost.pro" + location.pathname + location.search + location.hash);
    return;
  }
  setSplash(true);
  bindHandlers();

  try { await handleGoogleRedirectResult(); } catch (err) {
    if (err?.code !== "auth/no-auth-event") {
      logAuthError("handleGoogleRedirectResult failed", err);
      showError(humanAuthError(err));
    }
  }

  const handledAction = await handleUrlActionCodes();
  const snapshot = await withTimeout(waitForAuthState(), AUTH_INIT_TIMEOUT_MS, "Firebase Auth init").catch((err) => {
    logAuthError("waitForAuthState failed", err);
    return { ready: true, loading: false, firebaseUser: null, user: null, source: "guest", error: err };
  });
  setSplash(false);

  if (snapshot.user && snapshot.firebaseUser && !snapshot.firebaseUser.emailVerified && !handledAction) {
    renderVerify(snapshot.user.email);
  } else if (snapshot.user && !handledAction) {
    renderAccount(snapshot.user);
  } else if (!handledAction) {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "1") {
      toast("Email подтверждён. Войдите в аккаунт.", "success");
      activatePanel("signin");
    } else if (params.get("tab") === "signup") {
      activatePanel("signup");
    } else if (params.get("tab") === "reset") {
      activatePanel("reset");
    } else {
      activatePanel("signin");
    }
  }

  unsubscribeAuth = subscribeAuth((nextState) => {
    if (!nextState.ready || nextState.loading) return;
    if (nextState.user && nextState.firebaseUser && !nextState.firebaseUser.emailVerified) renderVerify(nextState.user.email);
    else if (nextState.user) renderAccount(nextState.user);
  });
}

window.addEventListener("pagehide", () => { try { unsubscribeAuth?.(); } catch (_) {} });

init().catch((err) => {
  logAuthError("init failed", err);
  setSplash(false);
  showError("Не удалось запустить авторизацию. Обновите страницу или проверьте соединение.");
  activatePanel("signin");
});
