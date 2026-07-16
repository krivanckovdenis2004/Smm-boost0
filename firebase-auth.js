// firebase-auth.js — legacy compatibility wrapper.
// ВАЖНО: здесь больше нет initializeApp(), Firestore-записей и отдельного SDK.
// Все старые импорты перенаправлены в центральный AuthManager из firebase.js.

export {
  auth,
  authReady,
  firebaseApp,
  firebaseConfig,
  subscribeAuth,
  waitForAuthState,
  getStoredUser,
  clearAuthStorage,
  deterministicUserId,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithGoogleProvider,
  handleGoogleRedirectResult,
  applyEmailVerificationCode,
  verifyResetCode,
  confirmPasswordResetCode,
  signOutEverywhere,
  humanAuthError,
} from './firebase.js?v=20260716-auth-v6';

import {
  auth,
  firebaseApp,
  subscribeAuth,
  getStoredUser,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithGoogleProvider,
  handleGoogleRedirectResult,
  applyEmailVerificationCode,
  verifyResetCode,
  confirmPasswordResetCode,
  signOutEverywhere,
  humanAuthError,
} from './firebase.js?v=20260716-auth-v6';

export function loadFirebase() {
  return Promise.resolve({ app: firebaseApp, auth });
}

export function persistSession(user, extra = {}) {
  const payload = {
    userId: extra.userId || user?.userId || user?.uid || '',
    firebaseUid: user?.firebaseUid || user?.uid || '',
    authType: extra.authType || user?.authType || 'email',
    username: user?.username || user?.email || user?.displayName || user?.uid || '',
    displayName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Пользователь'),
    email: user?.email || '',
    photoURL: user?.photoURL || '',
    emailVerified: !!user?.emailVerified,
    sessionToken: user?.sessionToken || (user?.uid ? 'firebase:' + user.uid : ''),
    loggedAt: new Date().toISOString(),
    registeredAt: extra.registeredAt || user?.registeredAt || new Date().toISOString(),
  };
  try { localStorage.setItem('sb_user', JSON.stringify(payload)); } catch (_) {}
  window.SBUserState?.refresh?.();
  return payload;
}

export function clearSession() {
  try { localStorage.removeItem('sb_user'); } catch (_) {}
  window.SBUserState?.refresh?.();
}

export function resendCooldownLeft(email) {
  const keys = [`sb_cooldown_verify_${String(email || '').trim().toLowerCase()}`, `sb_cooldown_reset_${String(email || '').trim().toLowerCase()}`];
  try {
    const left = keys.map((key) => {
      const ts = Number(localStorage.getItem(key) || 0);
      return Math.ceil((60_000 - (Date.now() - ts)) / 1000);
    }).filter((v) => v > 0);
    return left.length ? Math.max(...left) : 0;
  } catch (_) { return 0; }
}

export const resendVerification = resendVerificationEmail;
export const sendResetEmail = sendPasswordReset;
export const signInWithGoogle = signInWithGoogleProvider;
export const checkGoogleRedirectResult = handleGoogleRedirectResult;
export const applyVerification = applyEmailVerificationCode;
export const confirmReset = confirmPasswordResetCode;
export const signOutAll = signOutEverywhere;
export const humanError = humanAuthError;

export function fbCurrentUser() {
  return getStoredUser();
}

export function fbOnAuth(callback) {
  return subscribeAuth((state) => callback((state && state.user) || getStoredUser() || null));
}

export function fbSignOut() {
  return signOutEverywhere();
}
