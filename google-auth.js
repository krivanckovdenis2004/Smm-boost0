// google-auth.js — legacy wrapper без отдельной инициализации Firebase.
// Вся реальная логика Google Auth живёт в центральном firebase.js/AuthManager.

import {
  signInWithGoogleProvider,
  handleGoogleRedirectResult,
  humanAuthError,
} from "./firebase.js?v=20260716-auth-v6";

function setMsg(text, ok = false) {
  const el = document.getElementById("authMessage") || document.querySelector("[data-auth-error]");
  if (!el) {
    if (!ok) alert(text);
    return;
  }
  el.textContent = text;
  el.hidden = false;
  el.className = ok ? "auth-message ok" : "auth-message error";
}

function logAuthError(label, error) {
  console.groupCollapsed(`[SMM-Boost Google Auth Legacy] ${label}`);
  console.error(error);
  console.error(error?.code || "NO_ERROR_CODE");
  console.error(error?.message || "NO_ERROR_MESSAGE");
  console.error(error?.stack || "NO_ERROR_STACK");
  if (error?.customData) console.error("customData:", error.customData);
  console.groupEnd();
}

async function signInWithGoogle() {
  setMsg("Открываем Google...", true);
  try {
    const result = await signInWithGoogleProvider();
    if (result?.redirect) return;
    setMsg("Вход через Google выполнен.", true);
    setTimeout(() => { window.location.href = "/wallet.html"; }, 650);
  } catch (err) {
    logAuthError("signInWithGoogle failed", err);
    if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
      setMsg("Окно Google было закрыто.");
      return;
    }
    setMsg(humanAuthError(err));
  }
}

handleGoogleRedirectResult().then((result) => {
  if (result?.user) {
    setMsg("Вход через Google выполнен.", true);
    setTimeout(() => { window.location.href = "/wallet.html"; }, 650);
  }
}).catch((err) => {
  if (err?.code !== "auth/no-auth-event") logAuthError("handleGoogleRedirectResult failed", err);
});

window.SBGoogleAuth = { signInWithGoogle };
