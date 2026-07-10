// Google Sign-In через Firebase Authentication.
// Клиентский модуль: авторизация, upsert документа users/{uid} и сохранение
// сессии в localStorage (совместимо с существующим user-state.js).

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost-905d5.firebaseapp.com',
  projectId: 'smm-boost-905d5',
  storageBucket: 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: '554912523069',
  appId: '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: 'G-E6SRLXZW5V'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function persistUser(user) {
  const payload = {
    userId: user.uid,
    authType: 'google',
    username: user.email || user.displayName || user.uid,
    displayName: user.displayName || 'Пользователь Google',
    email: user.email || '',
    photoURL: user.photoURL || '',
    sessionToken: 'firebase:' + user.uid,
    loggedAt: new Date().toISOString(),
    registeredAt: new Date().toISOString()
  };
  localStorage.setItem('sb_user', JSON.stringify(payload));
  window.SBUserState?.refresh?.();
  return payload;
}

async function upsertUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    authType: 'google',
    createdAt: serverTimestamp()
  });
  return true;
}

function setMsg(text, ok = false) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + (ok ? 'ok' : 'error');
}

async function handleFirebaseUser(user, { silent = false } = {}) {
  try {
    const created = await upsertUserDoc(user);
    persistUser(user);
    if (!silent) {
      setMsg(created
        ? `Регистрация через Google выполнена. Добро пожаловать, ${user.displayName || user.email}!`
        : `Вход выполнен. Добро пожаловать, ${user.displayName || user.email}!`, true);
      window.sbGoal?.(created ? 'registration' : 'login', { provider: 'google', email: user.email });
      setTimeout(() => { window.location.href = 'wallet.html'; }, 800);
    }
  } catch (e) {
    console.error('[google-auth] upsert failed', e);
    if (!silent) setMsg('Ошибка сохранения профиля: ' + (e.message || 'unknown'));
  }
}

async function signInWithGoogle() {
  setMsg('Открываем окно Google...', true);
  try {
    const result = await signInWithPopup(auth, provider);
    if (result?.user) await handleFirebaseUser(result.user);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (e2) {
        setMsg('Не удалось открыть Google: ' + (e2.message || e2.code));
        return;
      }
    }
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
      setMsg('Окно Google было закрыто.');
      return;
    }
    console.error('[google-auth]', e);
    setMsg('Ошибка входа Google: ' + (e.message || e.code || 'unknown'));
  }
}

// Обработка возврата после redirect-режима
getRedirectResult(auth).then((result) => {
  if (result?.user) handleFirebaseUser(result.user);
}).catch((e) => {
  if (e && e.code !== 'auth/no-auth-event') console.warn('[google-auth] redirect', e);
});

// Слушаем изменения авторизации, чтобы синхронизировать localStorage.
onAuthStateChanged(auth, (user) => {
  if (user) {
    try {
      const saved = JSON.parse(localStorage.getItem('sb_user') || 'null');
      if (!saved || saved.userId !== user.uid) handleFirebaseUser(user, { silent: true });
    } catch { /* noop */ }
  }
});

function bindButtons() {
  document.querySelectorAll('[data-google-signin]').forEach((btn) => {
    if (btn.dataset.gsbBound === '1') return;
    btn.dataset.gsbBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      signInWithGoogle();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindButtons);
} else {
  bindButtons();
}

window.SBGoogleAuth = { signInWithGoogle };
