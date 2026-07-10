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

// Распаковка настоящей причины auth/internal-error.
// Firebase заворачивает ответ identitytoolkit в customData/_tokenResponse/serverResponse.
function unwrapFirebaseError(e) {
  const parts = [];
  if (e?.code) parts.push(e.code);
  if (e?.message) parts.push(e.message);
  const cd = e?.customData;
  if (cd) {
    try {
      const sr = cd._tokenResponse || cd.serverResponse || cd;
      if (sr) {
        const inner = sr?.error?.message || sr?.error_description || sr?.error || null;
        if (inner) parts.push('server: ' + (typeof inner === 'string' ? inner : JSON.stringify(inner)));
        else parts.push('customData: ' + JSON.stringify(cd).slice(0, 400));
      }
    } catch (_) {}
  }
  return parts.join(' | ') || 'unknown';
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
  // Диагностика: одна ли копия Firebase, что за authDomain, apiKey (маска).
  try {
    console.info('[google-auth] apps=', sdk.appMod.getApps().length,
      'authDomain=', auth?.config?.authDomain,
      'apiKey=', (auth?.config?.apiKey || '').slice(0, 8) + '…',
      'currentUser=', auth?.currentUser?.uid || null);
  } catch (_) {}
  setMsg('Открываем окно Google...', true);
  try {
    const result = await authMod.signInWithPopup(auth, provider);
    if (result?.user) await handleFirebaseUser(sdk, result.user);
  } catch (e) {
    console.error('[google-auth] signIn error', e, 'customData=', e?.customData, 'stack=', e?.stack);
    const code = e?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      try { await authMod.signInWithRedirect(auth, provider); return; }
      catch (e2) { setMsg('Не удалось открыть Google (redirect): ' + unwrapFirebaseError(e2)); return; }
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      setMsg('Окно Google было закрыто.');
      return;
    }
    if (code === 'auth/unauthorized-domain') {
      setMsg('Домен не разрешён: Firebase Console → Authentication → Settings → Authorized domains. Добавьте smm-boost.pro и *.vercel.app.');
      return;
    }
    if (code === 'auth/operation-not-allowed') {
      setMsg('Google-провайдер выключен в Firebase Console → Authentication → Sign-in method → Google. Включите его.');
      return;
    }
    if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
      setMsg('Неверный API-ключ Firebase. Проверьте apiKey в google-auth.js и Restrictions ключа в Google Cloud Console.');
      return;
    }
    if (code === 'auth/internal-error') {
      // Настоящая причина спрятана в customData/serverResponse. Пробуем redirect —
      // popup-канал через iframe firebaseapp.com иногда режется третьесторонними куками.
      const detail = unwrapFirebaseError(e);
      setMsg('Firebase internal-error: ' + detail + ' — пробую через redirect...');
      try {
        await authMod.signInWithRedirect(auth, provider);
        return;
      } catch (e2) {
        console.error('[google-auth] redirect fallback failed', e2);
        setMsg('Firebase internal-error. Полная причина: ' + detail
          + '. Частые причины: (1) в Google Cloud Console API-ключ ограничен HTTP-referrer\'ами без текущего домена; '
          + '(2) в Firebase Console выключен Google-провайдер; '
          + '(3) не включён Identity Toolkit API; '
          + '(4) OAuth 2.0 Client не имеет redirect URI https://smm-boost-905d5.firebaseapp.com/__/auth/handler.');
        return;
      }
    }
    setMsg('Ошибка входа Google: ' + unwrapFirebaseError(e));
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
