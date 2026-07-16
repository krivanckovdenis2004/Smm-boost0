// firebase-auth.js
// Единый модуль Firebase Authentication для SMM-Boost.
// Поддерживает: email/password + верификация, Google Sign-In,
// восстановление пароля, throttle повторной отправки писем (60с),
// детерминированный userId (sha256(email)[0..32]) для СЛИЯНИЯ
// Email- и Google-аккаунтов в один документ Firestore, а также совместимости
// с legacy-структурой /users/{hex32}.

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
export function loadFirebase() {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    try { auth.languageCode = 'ru'; } catch (_) {}
    const db = fsMod.getFirestore(app);
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return { appMod, authMod, fsMod, app, auth, db, provider };
  })();
  return _sdkPromise;
}

// -------- Детерминированный userId (32 hex) из email --------
async function sha256Hex(str){
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function deterministicUserId(email){
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) throw new Error('email required');
  return (await sha256Hex('email:' + norm)).slice(0, 32);
}

// -------- Firestore user upsert (СЛИТЫЙ документ email+google) --------
async function upsertUserDoc(sdk, user, extra = {}) {
  const { fsMod, db } = sdk;
  const email = (user.email || extra.email || '').toLowerCase();
  const legacyId = email ? await deterministicUserId(email) : user.uid;
  const ref = fsMod.doc(db, 'users', legacyId);
  const snap = await fsMod.getDoc(ref);
  const providerId = user.providerData?.[0]?.providerId || '';
  const authType = extra.authType || (providerId === 'google.com' ? 'google' : 'email');

  // Служебные поля — не трогаем баланс/рефералы существующего документа.
  const patch = {
    userId: legacyId,
    firebaseUid: user.uid,
    displayName: user.displayName || extra.displayName || (email ? email.split('@')[0] : 'Пользователь'),
    email,
    usernameLower: email,
    photoURL: user.photoURL || '',
    emailVerified: !!user.emailVerified,
    authProviders: fsMod.arrayUnion(providerId || 'password'),
    updatedAt: fsMod.serverTimestamp(),
    lastLoginAt: fsMod.serverTimestamp()
  };

  if (!snap.exists()) {
    // Первый вход этого email — создаём документ с базовыми полями,
    // совместимыми с legacy-логикой (balance, referralsCount и т.д.).
    await fsMod.setDoc(ref, {
      ...patch,
      authType,
      referralCode: legacyId,
      referredBy: extra.referredBy || '',
      balance: 0,
      bonusBalance: 0,
      registrationBonus: 0,
      referralsCount: 0,
      referralEarned: 0,
      createdAt: fsMod.serverTimestamp()
    });
    // Инкремент счётчика приглашённых у пригласившего (та же логика,
    // что и в legacy /api/auth-social-register).
    if (extra.referredBy && extra.referredBy !== legacyId) {
      try {
        const invRef = fsMod.doc(db, 'users', extra.referredBy);
        const invSnap = await fsMod.getDoc(invRef);
        if (invSnap.exists()) {
          await fsMod.updateDoc(invRef, {
            referralsCount: fsMod.increment(1),
            updatedAt: fsMod.serverTimestamp()
          });
        }
      } catch (e) { console.warn('[fb-auth] referral inc failed', e); }
    }
    return { created: true, userId: legacyId };
  }
  await fsMod.setDoc(ref, patch, { merge: true });
  return { created: false, userId: legacyId };
}

// -------- Сессия в localStorage (совместимость с SBUserState) --------
export function persistSession(user, extra = {}) {
  const payload = {
    userId: extra.userId || user.uid,
    firebaseUid: user.uid,
    authType: extra.authType || 'email',
    username: user.email || user.displayName || user.uid,
    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Пользователь'),
    email: user.email || '',
    photoURL: user.photoURL || '',
    emailVerified: !!user.emailVerified,
    sessionToken: 'firebase:' + user.uid,
    loggedAt: new Date().toISOString(),
    registeredAt: extra.registeredAt || new Date().toISOString()
  };
  localStorage.setItem('sb_user', JSON.stringify(payload));
  window.SBUserState?.refresh?.();
  return payload;
}
export function clearSession() {
  localStorage.removeItem('sb_user');
  window.SBUserState?.refresh?.();
}

// -------- Троттлинг повторной отправки писем (60с на email) --------
const RESEND_KEY = 'sb_resend_ts';
export function resendCooldownLeft(email){
  try {
    const map = JSON.parse(localStorage.getItem(RESEND_KEY) || '{}');
    const ts = map[(email || '').toLowerCase()] || 0;
    const diff = 60 - Math.floor((Date.now() - ts) / 1000);
    return diff > 0 ? diff : 0;
  } catch(_) { return 0; }
}
function markResend(email){
  try {
    const map = JSON.parse(localStorage.getItem(RESEND_KEY) || '{}');
    map[(email || '').toLowerCase()] = Date.now();
    localStorage.setItem(RESEND_KEY, JSON.stringify(map));
  } catch(_) {}
}

// -------- Action code settings --------
function actionCodeSettings() {
  return { url: window.location.origin + '/auth.html', handleCodeInApp: false };
}

// -------- Проверка дубликатов Email в Firestore --------
async function emailAlreadyRegistered(sdk, email){
  try {
    const legacyId = await deterministicUserId(email);
    const snap = await sdk.fsMod.getDoc(sdk.fsMod.doc(sdk.db, 'users', legacyId));
    return snap.exists();
  } catch(_) { return false; }
}

// -------- Публичные операции --------
export async function registerWithEmail({ email, password, displayName, referredBy }) {
  const sdk = await loadFirebase();
  const { authMod, auth } = sdk;
  if (await emailAlreadyRegistered(sdk, email)) {
    const err = new Error('Этот email уже зарегистрирован. Войдите или восстановите пароль.');
    err.code = 'auth/email-already-in-use';
    throw err;
  }
  const left = resendCooldownLeft(email);
  if (left > 0) throw new Error(`Повторная отправка через ${left} с.`);

  const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    try { await authMod.updateProfile(cred.user, { displayName }); } catch (_) {}
  }
  await upsertUserDoc(sdk, cred.user, { authType: 'email', displayName, referredBy, email });
  try {
    await authMod.sendEmailVerification(cred.user, actionCodeSettings());
    markResend(email);
  } catch (e) { console.warn('[fb-auth] sendEmailVerification failed', e); }
  try { await authMod.signOut(auth); } catch (_) {}
  return { user: cred.user, needsVerification: true };
}

export async function loginWithEmail({ email, password }) {
  const sdk = await loadFirebase();
  const { authMod, auth } = sdk;
  const cred = await authMod.signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  try { await user.reload(); } catch (_) {}
  if (!user.emailVerified) return { user, needsVerification: true };
  const res = await upsertUserDoc(sdk, user, { authType: 'email' });
  persistSession(user, { authType: 'email', userId: res.userId });
  return { user, needsVerification: false, userId: res.userId };
}

export async function resendVerification() {
  const sdk = await loadFirebase();
  const { authMod, auth } = sdk;
  if (!auth.currentUser) throw new Error('Сессия истекла. Войдите ещё раз.');
  const email = auth.currentUser.email || '';
  const left = resendCooldownLeft(email);
  if (left > 0) throw new Error(`Повторная отправка через ${left} с.`);
  await authMod.sendEmailVerification(auth.currentUser, actionCodeSettings());
  markResend(email);
}

export async function sendResetEmail(email) {
  const sdk = await loadFirebase();
  const { authMod, auth } = sdk;
  const left = resendCooldownLeft('reset:' + email);
  if (left > 0) throw new Error(`Повторная отправка через ${left} с.`);
  await authMod.sendPasswordResetEmail(auth, email, actionCodeSettings());
  markResend('reset:' + email);
}

export async function signOutAll() {
  try { const sdk = await loadFirebase(); await sdk.authMod.signOut(sdk.auth); } catch (_) {}
  clearSession();
}

export async function signInWithGoogle({ referredBy } = {}) {
  const sdk = await loadFirebase();
  const { authMod, auth, provider } = sdk;
  try {
    const result = await authMod.signInWithPopup(auth, provider);
    if (!result?.user) throw new Error('Пустой ответ Google');
    const res = await upsertUserDoc(sdk, result.user, { authType: 'google', referredBy });
    persistSession(result.user, { authType: 'google', userId: res.userId });
    return { user: result.user, created: res.created, userId: res.userId };
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      if (referredBy) sessionStorage.setItem('sb_ref_pending', referredBy);
      await authMod.signInWithRedirect(auth, provider);
      return { redirect: true };
    }
    throw e;
  }
}

export async function checkGoogleRedirectResult() {
  const sdk = await loadFirebase();
  const { authMod, auth } = sdk;
  const result = await authMod.getRedirectResult(auth);
  if (result?.user) {
    const referredBy = sessionStorage.getItem('sb_ref_pending') || '';
    sessionStorage.removeItem('sb_ref_pending');
    const res = await upsertUserDoc(sdk, result.user, { authType: 'google', referredBy });
    persistSession(result.user, { authType: 'google', userId: res.userId });
    return { user: result.user, userId: res.userId };
  }
  return null;
}

// -------- Action-коды (verify email / reset password) --------
export async function applyVerification(oobCode) {
  const sdk = await loadFirebase();
  await sdk.authMod.applyActionCode(sdk.auth, oobCode);
  if (sdk.auth.currentUser) {
    try { await sdk.auth.currentUser.reload(); } catch (_) {}
    if (sdk.auth.currentUser.emailVerified) {
      const res = await upsertUserDoc(sdk, sdk.auth.currentUser, { authType: 'email' });
      persistSession(sdk.auth.currentUser, { authType: 'email', userId: res.userId });
      return { autoSignedIn: true };
    }
  }
  return { autoSignedIn: false };
}
export async function verifyResetCode(oobCode) {
  const sdk = await loadFirebase();
  return sdk.authMod.verifyPasswordResetCode(sdk.auth, oobCode);
}
export async function confirmReset(oobCode, newPassword) {
  const sdk = await loadFirebase();
  await sdk.authMod.confirmPasswordReset(sdk.auth, oobCode, newPassword);
}

// -------- Ошибки Firebase → человеко-читаемые сообщения --------
const ERR = {
  'auth/invalid-email': 'Некорректный email.',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован. Войдите или восстановите пароль.',
  'auth/weak-password': 'Пароль слишком слабый. Минимум 6 символов.',
  'auth/user-not-found': 'Пользователь с таким email не найден.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
  'auth/network-request-failed': 'Проблема с сетью. Проверьте соединение.',
  'auth/popup-blocked': 'Всплывающее окно заблокировано браузером.',
  'auth/popup-closed-by-user': 'Окно Google закрыто.',
  'auth/cancelled-popup-request': 'Окно Google закрыто.',
  'auth/unauthorized-domain': 'Домен не разрешён в Firebase.',
  'auth/operation-not-allowed': 'Способ входа выключен в настройках.',
  'auth/expired-action-code': 'Ссылка истекла. Запросите новую.',
  'auth/invalid-action-code': 'Ссылка недействительна или уже использована.',
  'auth/account-exists-with-different-credential': 'Аккаунт уже привязан к другому способу входа.'
};
export function humanError(err){
  if (!err) return 'Неизвестная ошибка';
  const code = err.code || '';
  return ERR[code] || err.message || 'Ошибка. Попробуйте ещё раз.';
}
