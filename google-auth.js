// Google Sign-In через Firebase Authentication.
// Динамическая загрузка Firebase SDK по клику — чтобы отказ CDN/сети/блокировщика
// не ломал привязку обработчика (её делает inline-скрипт в auth.html).

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost-905d5.firebaseapp.com',
  projectId: 'smm-boost-905d5',
  storageBucket: 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: '554912523069',
  appId: '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: 'G-E6SRLXZW5V'
};

const SDK_VERSION = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let _sdkPromise = null;
function loadSDK() {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return { appMod, authMod, fsMod, app, auth, db, provider };
  })();
  return _sdkPromise;
}

function setMsg(text, ok = false) {
  const el = document.getElementById('authMessage');
  if (!el) { if (!ok) alert(text); return; }
  el.textContent = text;
  el.className = 'auth-message ' + (ok ? 'ok' : 'error');
}

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

async function upsertUserDoc(sdk, user) {
  const { fsMod, db } = sdk;
  const ref = fsMod.doc(db, 'users', user.uid);
  const snap = await fsMod.getDoc(ref);
  if (snap.exists()) return false;
  await fsMod.setDoc(ref, {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    authType: 'google',
    createdAt: fsMod.serverTimestamp()
  });
  return true;
}

async function handleFirebaseUser(sdk, user, { silent = false } = {}) {
  try {
    let created = false;
    try { created = await upsertUserDoc(sdk, user); }
    catch (e) { console.warn('[google-auth] upsert warn', e); }
    persistUser(user);
    if (!silent) {
      setMsg(created
        ? `Регистрация через Google выполнена. Добро пожаловать, ${user.displayName || user.email}!`
        : `Вход выполнен. Добро пожаловать, ${user.displayName || user.email}!`, true);
      window.sbGoal?.(created ? 'registration' : 'login', { provider: 'google', email: user.email });
      setTimeout(() => { window.location.href = 'wallet.html'; }, 800);
    }
  } catch (e) {
    console.error('[google-auth] handle failed', e);
    if (!silent) setMsg('Ошибка сохранения профиля: ' + (e.message || 'unknown'));
  }
}

async function signInWithGoogle() {
  setMsg('Загружаем Google Sign-In...', true);
  let sdk;
  try {
    sdk = await loadSDK();
  } catch (e) {
    console.error('[google-auth] SDK load failed', e);
    setMsg('Не удалось загрузить Firebase SDK (сеть/блокировщик). ' + (e.message || ''));
    return;
  }
  const { authMod, auth, provider } = sdk;
  setMsg('Открываем окно Google...', true);
  try {
    const result = await authMod.signInWithPopup(auth, provider);
    if (result?.user) await handleFirebaseUser(sdk, result.user);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      try { await authMod.signInWithRedirect(auth, provider); return; }
      catch (e2) { setMsg('Не удалось открыть Google: ' + (e2.message || e2.code)); return; }
    }
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
      setMsg('Окно Google было закрыто.');
      return;
    }
    if (e?.code === 'auth/unauthorized-domain') {
      setMsg('Домен не разрешён в Firebase Console → Authentication → Settings → Authorized domains. Добавьте текущий домен.');
      return;
    }
    console.error('[google-auth] signIn error', e);
    setMsg('Ошибка входа Google: ' + (e.message || e.code || 'unknown'));
  }
}

// Обработать возможный возврат после redirect (только если Firebase уже был загружен).
async function checkRedirectResult() {
  try {
    const sdk = await loadSDK();
    const { authMod, auth } = sdk;
    const result = await authMod.getRedirectResult(auth);
    if (result?.user) await handleFirebaseUser(sdk, result.user);
  } catch (e) {
    if (e && e.code !== 'auth/no-auth-event') console.warn('[google-auth] redirect', e);
  }
}

// Проверяем redirect только на странице auth.html.
if (/auth\.html?$/i.test(location.pathname) || document.getElementById('authMessage')) {
  checkRedirectResult();
}

window.SBGoogleAuth = { signInWithGoogle };
