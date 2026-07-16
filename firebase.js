// firebase.js — единый источник инициализации Firebase App + Auth.
// Используется всеми клиентскими модулями (auth.js, header.js, user-menu.js).

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ⚠️ ЗАМЕНИТЕ конфиг на свой (тот же, что использовался ранее в проекте).
export const firebaseConfig = {
  apiKey: "AIzaSyD-REPLACE-ME",
  authDomain: "smm-boost.firebaseapp.com",
  projectId: "smm-boost",
  storageBucket: "smm-boost.appspot.com",
  messagingSenderId: "0000000000",
  appId: "1:0000000000:web:xxxxxxxxxxxx",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Persistence: local в обычном режиме, in-memory если localStorage недоступен
// (Safari Private, некоторые встроенные WebView). Это гарантирует, что init
// не зависнет и не бросит необрабатываемую ошибку.
let persistenceReady;
try {
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() =>
    setPersistence(auth, inMemoryPersistence),
  );
} catch (_) {
  persistenceReady = Promise.resolve();
}

/**
 * authReady — Promise, который резолвится ПЕРВЫМ вызовом onAuthStateChanged.
 * Единственный источник истины для «загружено ли состояние авторизации».
 * Имеет жёсткий таймаут 6с — чтобы UI никогда не зависал в Skeleton.
 */
export const authReady = new Promise((resolve) => {
  let done = false;
  const finish = (user) => {
    if (done) return;
    done = true;
    resolve(user || null);
  };

  persistenceReady.finally(() => {
    try {
      const unsub = onAuthStateChanged(
        auth,
        (user) => {
          finish(user);
          // Не отписываемся — держим подписку живой для последующих обновлений.
          void unsub;
        },
        (err) => {
          console.warn("[auth] onAuthStateChanged error", err);
          finish(null);
        },
      );
    } catch (err) {
      console.warn("[auth] init failed", err);
      finish(null);
    }
  });

  // Жёсткий предохранитель от вечной загрузки.
  setTimeout(() => finish(auth.currentUser || null), 6000);
});

/**
 * subscribeAuth — единая подписка на изменения пользователя.
 * Используйте её ВЕЗДЕ, не создавайте свои onAuthStateChanged.
 */
export function subscribeAuth(cb) {
  // Сразу отдать текущее значение, если оно уже известно.
  authReady.then((u) => cb(u));
  return onAuthStateChanged(auth, (u) => cb(u || null));
}
