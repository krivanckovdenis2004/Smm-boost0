// firebase.js — единый AuthManager для SMM-Boost.
// В проекте должен быть только один onAuthStateChanged: здесь.

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  applyActionCode,
  signInWithCredential,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost.pro",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54",
  measurementId: "G-E6SRLXZW5V",
};

const API_SYNC_URL = "/api/auth-social-register";
const RESEND_COOLDOWN_MS = 60_000;
const AUTH_STORAGE_KEYS = ["sb_user", "sb_ref_pending", "sb_auth_last_error"];
const AUTH_DEBUG_PREFIX = "[SMM-Boost Auth]";
const GOOGLE_CLIENT_ID = "554912523069-2dd4cs90rk2p5c6so2cmg9kpqc9pfi8h.apps.googleusercontent.com";
const GOOGLE_GIS_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_POPUP_TIMEOUT_MS = 45_000;

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
try { auth.languageCode = "ru"; } catch (_) {}

function logAuthError(label, error) {
  console.groupCollapsed(`${AUTH_DEBUG_PREFIX} ${label}`);
  console.error(error);
  console.error(error?.code || "NO_ERROR_CODE");
  console.error(error?.message || "NO_ERROR_MESSAGE");
  console.error(error?.stack || "NO_ERROR_STACK");
  if (error?.customData) console.error("customData:", error.customData);
  console.groupEnd();
}

function logAuthInfo(label, data = {}) {
  try {
    console.info(`${AUTH_DEBUG_PREFIX} ${label}`, {
      apps: getApps().length,
      appName: firebaseApp?.name || "[DEFAULT]",
      authDomain: auth?.config?.authDomain,
      currentUser: auth?.currentUser?.uid || null,
      ...data,
    });
  } catch (_) {}
}

const persistenceReady = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    logAuthError("browserLocalPersistence failed, falling back to memory", err);
    try { await setPersistence(auth, inMemoryPersistence); } catch (fallbackErr) { logAuthError("inMemoryPersistence failed", fallbackErr); }
  }
})();

let started = false;
let initialResolved = false;
let resolveInitial;
let authSequence = 0;
let syncPromise = null;
const listeners = new Set();

let state = {
  ready: false,
  loading: true,
  firebaseUser: null,
  user: null,
  source: "unknown",
  error: null,
};

export const authReady = new Promise((resolve) => { resolveInitial = resolve; });

function cloneState() {
  return { ...state };
}

function notify() {
  const snapshot = cloneState();
  listeners.forEach((cb) => {
    try { cb(snapshot); } catch (err) { setTimeout(() => { throw err; }, 0); }
  });
}

function finishInitial() {
  if (initialResolved) return;
  initialResolved = true;
  resolveInitial(cloneState());
}

function safeJson(value) {
  try { return JSON.parse(value || "null"); } catch (_) { return null; }
}

export function getStoredUser() {
  if (typeof localStorage === "undefined") return null;
  const user = safeJson(localStorage.getItem("sb_user"));
  if (!user || !user.userId || !user.sessionToken) return null;
  return user;
}

function persistUser(user) {
  if (!user || typeof localStorage === "undefined") return null;
  const payload = {
    ...user,
    loggedAt: new Date().toISOString(),
  };
  localStorage.setItem("sb_user", JSON.stringify(payload));
  return payload;
}

function removeFirebaseStorageKeys() {
  if (typeof localStorage !== "undefined") {
    for (const key of Object.keys(localStorage)) {
      if (
        AUTH_STORAGE_KEYS.includes(key) ||
        key.startsWith("firebase:authUser:") ||
        key.startsWith("firebase:host:") ||
        key.startsWith("firebaseLocalStorage") ||
        /^sb_(auth|firebase|session|token)/i.test(key)
      ) {
        try { localStorage.removeItem(key); } catch (_) {}
      }
    }
  }
  if (typeof sessionStorage !== "undefined") {
    try { sessionStorage.clear(); } catch (_) {}
  }
}

export function clearAuthStorage() {
  removeFirebaseStorageKeys();
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deterministicUserId(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "";
  return (await sha256Hex("email:" + normalized)).slice(0, 32);
}

function currentRef() {
  try {
    const params = new URLSearchParams(location.search);
    const ref = (params.get("ref") || sessionStorage.getItem("sb_ref") || "").trim().toLowerCase();
    return /^[0-9a-f]{32}$/.test(ref) ? ref : "";
  } catch (_) { return ""; }
}

function enforceCanonicalHost() {
  if (typeof location !== "undefined" && location.hostname === "www.smm-boost.pro") {
    location.replace("https://smm-boost.pro" + location.pathname + location.search + location.hash);
  }
}

function isAllowedAuthHost() {
  if (typeof location === "undefined") return true;
  return location.hostname === "smm-boost.pro" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function rejectAfter(ms, code, message) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const err = new Error(message);
      err.code = code;
      reject(err);
    }, ms);
  });
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (window.__sbGoogleGisPromise) return window.__sbGoogleGisPromise;
  window.__sbGoogleGisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить Google Identity Services")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Не удалось загрузить Google Identity Services"));
    document.head.appendChild(script);
  });
  return window.__sbGoogleGisPromise;
}

async function requestGoogleAccessToken() {
  const google = await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        prompt: "select_account",
        callback: (response) => {
          if (response?.access_token) finish(resolve, response.access_token);
          else {
            const err = new Error(response?.error_description || response?.error || "Google не вернул access_token");
            err.code = response?.error || "auth/google-token-missing";
            finish(reject, err);
          }
        },
        error_callback: (response) => {
          const err = new Error(response?.message || response?.type || "Google popup не завершился");
          err.code = response?.type === "popup_closed" ? "auth/popup-closed-by-user" : "auth/google-popup-error";
          finish(reject, err);
        },
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      finish(reject, err);
    }
  });
}

function setState(next, { silent = false } = {}) {
  state = { ...state, ...next };
  if (!silent) notify();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fallbackProfile(firebaseUser, userId = "") {
  const email = firebaseUser?.email || "";
  return {
    userId: userId || firebaseUser?.uid || "",
    firebaseUid: firebaseUser?.uid || "",
    authType: firebaseUser?.providerData?.some((p) => p.providerId === "google.com") ? "google" : "email",
    username: email || firebaseUser?.displayName || firebaseUser?.uid || "",
    displayName: firebaseUser?.displayName || (email ? email.split("@")[0] : "Пользователь"),
    email,
    photoURL: firebaseUser?.photoURL || "",
    emailVerified: !!firebaseUser?.emailVerified,
    sessionToken: firebaseUser?.uid ? "firebase:" + firebaseUser.uid : "",
    balance: 0,
    bonusBalance: 0,
    referralsCount: 0,
    referralEarned: 0,
  };
}

export async function syncFirebaseUser(firebaseUser = auth.currentUser, { forceToken = false, ref = currentRef() } = {}) {
  if (!firebaseUser) return null;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const idToken = await firebaseUser.getIdToken(forceToken);
    const response = await fetchWithTimeout(API_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "firebase", idToken, ref }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.user) {
      throw new Error(data.error || "Не удалось синхронизировать профиль");
    }
    const saved = persistUser(data.user);
    setState({ ready: true, loading: false, firebaseUser, user: saved, source: "firebase", error: null });
    return saved;
  })();

  try {
    return await syncPromise;
  } catch (err) {
    const userId = await deterministicUserId(firebaseUser.email || "");
    const fallback = persistUser(fallbackProfile(firebaseUser, userId));
    try { localStorage.setItem("sb_auth_last_error", String(err?.message || err)); } catch (_) {}
    setState({ ready: true, loading: false, firebaseUser, user: fallback, source: "firebase-fallback", error: err });
    return fallback;
  } finally {
    syncPromise = null;
  }
}

async function handleFirebaseState(firebaseUser) {
  const seq = ++authSequence;
  if (firebaseUser) {
    setState({ loading: true, firebaseUser, source: "firebase", error: null }, { silent: !state.ready });
    try { await firebaseUser.reload(); } catch (_) {}
    if (seq !== authSequence) return;
    await syncFirebaseUser(firebaseUser, { forceToken: false });
    if (seq !== authSequence) return;
  } else {
    const legacyUser = getStoredUser();
    if (seq !== authSequence) return;
    setState({ ready: true, loading: false, firebaseUser: null, user: legacyUser, source: legacyUser ? "legacy" : "guest", error: null });
  }
  finishInitial();
}

export function startAuthManager() {
  if (started) return authReady;
  started = true;
  persistenceReady.finally(() => {
    logAuthInfo("startAuthManager:onAuthStateChanged subscribe");
    onAuthStateChanged(
      auth,
      (firebaseUser) => { handleFirebaseState(firebaseUser || null).catch((err) => {
        logAuthError("handleFirebaseState failed", err);
        const legacyUser = getStoredUser();
        setState({ ready: true, loading: false, firebaseUser: firebaseUser || null, user: legacyUser, source: legacyUser ? "legacy" : "guest", error: err });
        finishInitial();
      }); },
      (err) => {
        logAuthError("onAuthStateChanged error", err);
        const legacyUser = getStoredUser();
        setState({ ready: true, loading: false, firebaseUser: null, user: legacyUser, source: legacyUser ? "legacy" : "guest", error: err });
        finishInitial();
      },
    );
  });
  return authReady;
}

export function waitForAuthState() {
  startAuthManager();
  return authReady;
}

export function subscribeAuth(cb) {
  listeners.add(cb);
  startAuthManager();
  cb(cloneState());
  return () => listeners.delete(cb);
}

export function getAuthSnapshot() {
  startAuthManager();
  return cloneState();
}

function actionCodeSettings(path = "/auth.html") {
  return { url: window.location.origin + path, handleCodeInApp: false };
}

function cooldownKey(kind, email) {
  return `sb_cooldown_${kind}_${String(email || "").trim().toLowerCase()}`;
}

export function cooldownLeft(kind, email) {
  try {
    const last = Number(localStorage.getItem(cooldownKey(kind, email)) || 0);
    const left = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
    return left > 0 ? left : 0;
  } catch (_) { return 0; }
}

function markCooldown(kind, email) {
  try { localStorage.setItem(cooldownKey(kind, email), String(Date.now())); } catch (_) {}
}

export async function registerWithEmail({ email, password, displayName = "" }) {
  await persistenceReady;
  const left = cooldownLeft("verify", email);
  if (left > 0) throw new Error(`Повторная отправка письма будет доступна через ${left}с.`);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    try { await updateProfile(cred.user, { displayName: displayName.trim() }); } catch (_) {}
  }
  await syncFirebaseUser(cred.user, { forceToken: true });
  await sendEmailVerification(cred.user, actionCodeSettings("/auth.html?verified=1"));
  markCooldown("verify", email);
  return { user: cred.user, needsVerification: !cred.user.emailVerified };
}

export async function loginWithEmail({ email, password }) {
  await persistenceReady;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  try { await cred.user.reload(); } catch (_) {}
  await syncFirebaseUser(cred.user, { forceToken: true });
  return { user: cred.user, needsVerification: !cred.user.emailVerified };
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error("Сессия истекла. Войдите ещё раз.");
  const email = auth.currentUser.email || "";
  const left = cooldownLeft("verify", email);
  if (left > 0) throw new Error(`Повторная отправка письма будет доступна через ${left}с.`);
  await sendEmailVerification(auth.currentUser, actionCodeSettings("/auth.html?verified=1"));
  markCooldown("verify", email);
}

export async function sendPasswordReset(email) {
  const left = cooldownLeft("reset", email);
  if (left > 0) throw new Error(`Повторная отправка письма будет доступна через ${left}с.`);
  await sendPasswordResetEmail(auth, email, actionCodeSettings("/reset-password.html"));
  markCooldown("reset", email);
}

export async function signInWithGoogleProvider() {
  enforceCanonicalHost();
  if (!isAllowedAuthHost()) {
    const err = new Error("Google-вход доступен только на smm-boost.pro без www.");
    err.code = "auth/unauthorized-domain";
    throw err;
  }
  await persistenceReady;
  logAuthInfo("signInWithGoogleProvider before GIS token popup");
  try {
    const accessToken = await Promise.race([
      requestGoogleAccessToken(),
      rejectAfter(GOOGLE_POPUP_TIMEOUT_MS, "auth/popup-timeout", "Google не вернул ответ за 45 секунд."),
    ]);
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const result = await signInWithCredential(auth, credential);
    if (result?.user) await syncFirebaseUser(result.user, { forceToken: true });
    return result;
  } catch (err) {
    logAuthError("Google Identity Services sign-in failed", err);
    throw err;
  }
}

export async function handleGoogleRedirectResult() {
  logAuthInfo("Google redirect result skipped: Vercel-only auth uses GIS token popup");
  return null;
}

export async function applyEmailVerificationCode(oobCode) {
  await applyActionCode(auth, oobCode);
  if (auth.currentUser) {
    try { await auth.currentUser.reload(); } catch (_) {}
    await syncFirebaseUser(auth.currentUser, { forceToken: true });
  }
}

export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function confirmPasswordResetCode(oobCode, password) {
  return confirmPasswordReset(auth, oobCode, password);
}

export async function signOutEverywhere() {
  try { await signOut(auth); } catch (_) {}
  clearAuthStorage();
  setState({ ready: true, loading: false, firebaseUser: null, user: null, source: "guest", error: null });
  finishInitial();
  notify();
}

export function humanAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "Некорректный email.",
    "auth/user-disabled": "Аккаунт отключён.",
    "auth/user-not-found": "Пользователь не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/email-already-in-use": "Такой email уже зарегистрирован. Войдите или восстановите пароль.",
    "auth/weak-password": "Пароль слишком простой: минимум 6 символов.",
    "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
    "auth/network-request-failed": "Проблема с сетью. Проверьте соединение.",
    "auth/popup-blocked": "Всплывающее окно Google заблокировано браузером.",
    "auth/popup-timeout": "Google не вернул ответ. Разрешите всплывающие окна и попробуйте ещё раз.",
    "auth/popup-closed-by-user": "Окно Google было закрыто.",
    "auth/cancelled-popup-request": "Окно Google было закрыто.",
    "auth/google-popup-error": "Окно Google не завершило вход. Попробуйте ещё раз.",
    "auth/google-token-missing": "Google не вернул токен входа. Попробуйте ещё раз.",
    "auth/account-exists-with-different-credential": "Аккаунт с этим email уже существует. Войдите по email и затем используйте Google.",
    "auth/unauthorized-domain": "Текущий домен не добавлен в Firebase Authorized domains.",
    "auth/operation-not-allowed": "Этот способ входа выключен в Firebase Console.",
    "auth/internal-error": "Google-вход не завершился. Обновите страницу и попробуйте ещё раз; подробности в Console как [SMM-Boost Auth].",
    "auth/expired-action-code": "Ссылка устарела. Запросите новое письмо.",
    "auth/invalid-action-code": "Ссылка недействительна или уже использована.",
  };
  return map[code] || err?.message || "Не удалось выполнить действие. Повторите попытку.";
}

startAuthManager();
