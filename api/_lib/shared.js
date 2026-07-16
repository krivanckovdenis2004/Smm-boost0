import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import crypto from 'crypto';

// Shared Firebase initialization — uses env vars, no hardcoded secrets
// Публичный Firebase-config: env-переменные приоритетнее, но с проверенным дефолтом,
// чтобы серверные API не падали, если переменные не заданы в Vercel.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'smm-boost.pro',
  projectId: process.env.FIREBASE_PROJECT_ID || 'smm-boost-905d5',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '554912523069',
  appId: process.env.FIREBASE_APP_ID || '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-E6SRLXZW5V'
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export { firebaseApp, db };

// CORS headers for all API responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.SITE_URL || 'https://smm-boost.pro',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

// Handle CORS preflight
export function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    return true;
  }
  res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  return false;
}

// Verify user session token against Firestore
// Returns { ok, user, userRef } or { ok: false, error, status }
export async function verifySession(db, userId, sessionToken) {
  if (!userId || !sessionToken) {
    return { ok: false, error: 'Сначала войдите в аккаунт', status: 401 };
  }

  const userRef = doc(db, 'users', String(userId).trim());
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return { ok: false, error: 'Аккаунт не найден', status: 401 };
  }

  const user = userSnap.data();
  if (String(user.sessionToken || '') !== String(sessionToken).trim()) {
    return { ok: false, error: 'Сессия устарела. Войдите заново.', status: 401 };
  }

  return { ok: true, user, userRef };
}

// ---------------------------------------------------------------------------
// Firebase ID Token auth resolver — стабильный userId = sha256('email:'+email)
// Позволяет API идентифицировать уже авторизованного (Email/Google) юзера
// даже если локальный sessionToken устарел или отсутствует.
// ---------------------------------------------------------------------------

function uidFromEmail(email) {
  return crypto.createHash('sha256').update('email:' + String(email).toLowerCase()).digest('hex').slice(0, 32);
}

// Кэш сертификатов Google securetoken (обновляем по TTL из Cache-Control).
let __fbCerts = { keys: null, exp: 0 };
async function loadSecureTokenCerts() {
  const now = Date.now();
  if (__fbCerts.keys && __fbCerts.exp > now) return __fbCerts.keys;
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!res.ok) throw new Error('securetoken certs unavailable: ' + res.status);
  const keys = await res.json();
  const cc = String(res.headers.get('cache-control') || '');
  const m = cc.match(/max-age=(\d+)/i);
  __fbCerts = { keys, exp: now + (m ? Number(m[1]) * 1000 : 3600 * 1000) };
  return keys;
}

function b64urlToBuf(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

// Верификация Firebase ID Token: RS256, ключи securetoken@system.gserviceaccount.com.
// Не требует API-key, не требует firebase-admin — работает на любом Vercel-функции.
async function verifyFirebaseIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token || token.split('.').length !== 3) return null;
  const projectId = process.env.FIREBASE_PROJECT_ID || 'smm-boost-905d5';
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const header = JSON.parse(b64urlToBuf(headerB64).toString('utf8'));
    const payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
    if (header.alg !== 'RS256' || !header.kid) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now - 30) return null;
    if (payload.iat && payload.iat > now + 60) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub) return null;

    const certs = await loadSecureTokenCerts();
    const pem = certs[header.kid];
    if (!pem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const ok = verifier.verify(pem, b64urlToBuf(sigB64));
    if (!ok) return null;

    const providerId = payload.firebase?.sign_in_provider || 'password';
    return {
      uid: payload.sub,
      email: String(payload.email || '').toLowerCase(),
      emailVerified: !!payload.email_verified,
      displayName: payload.name || '',
      photoURL: payload.picture || '',
      providerIds: [providerId]
    };
  } catch (err) {
    console.warn('[shared:verifyFirebaseIdToken]', err?.message);
    return null;
  }
}

async function ensureFirebaseUserDoc(db, fb) {
  const userId = uidFromEmail(fb.email || fb.uid);
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const sessionToken = `firebase:${fb.uid}`;
  const providerId = fb.providerIds.includes('google.com') ? 'google.com' : 'password';
  const authType = providerId === 'google.com' ? 'google' : 'email';

  if (!snap.exists()) {
    const created = {
      userId,
      firebaseUid: fb.uid,
      authType,
      authProviders: [providerId],
      username: fb.email || userId,
      usernameLower: (fb.email || '').toLowerCase(),
      displayName: fb.displayName || (fb.email ? fb.email.split('@')[0] : 'Пользователь'),
      email: fb.email || '',
      photoURL: fb.photoURL || '',
      emailVerified: fb.emailVerified,
      pendingEmailVerification: !fb.emailVerified,
      sessionToken,
      referralCode: userId,
      referredBy: '',
      balance: 0,
      bonusBalance: 0,
      registrationBonus: 0,
      referralsCount: 0,
      referralEarned: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
    await setDoc(userRef, created);
    return { userId, userRef, user: created };
  }

  const existing = snap.data();
  // Обновляем sessionToken/firebaseUid только при необходимости, ничего денежного не трогаем.
  if (existing.sessionToken !== sessionToken || existing.firebaseUid !== fb.uid) {
    try {
      await setDoc(userRef, {
        userId,
        firebaseUid: fb.uid,
        authType: existing.authType && existing.authType !== 'password' ? existing.authType : authType,
        authProviders: Array.from(new Set([...(Array.isArray(existing.authProviders) ? existing.authProviders : []), providerId])),
        username: existing.username || fb.email || userId,
        usernameLower: (existing.usernameLower || fb.email || '').toLowerCase(),
        displayName: existing.displayName || fb.displayName || (fb.email ? fb.email.split('@')[0] : 'Пользователь'),
        email: existing.email || fb.email || '',
        photoURL: existing.photoURL || fb.photoURL || '',
        emailVerified: existing.emailVerified || fb.emailVerified,
        pendingEmailVerification: !(existing.emailVerified || fb.emailVerified),
        sessionToken,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn('[shared:ensureFirebaseUserDoc] token refresh failed', err?.message);
    }
  }
  return { userId, userRef, user: { ...existing, sessionToken, firebaseUid: fb.uid } };
}

/**
 * Универсальная идентификация пользователя для API.
 * Приоритет: Firebase ID Token (idToken) → legacy sessionToken.
 * Возвращает { ok, user, userRef, userId, source } либо { ok: false, error, status }.
 */
export async function resolveAuthedUser(db, req) {
  const body = req.body || {};
  const idToken = String(body.idToken || '').trim();
  if (idToken) {
    const fb = await verifyFirebaseIdToken(idToken);
    if (fb) {
      const ensured = await ensureFirebaseUserDoc(db, fb);
      return { ok: true, user: ensured.user, userRef: ensured.userRef, userId: ensured.userId, source: 'firebase' };
    }
    // idToken невалидный — не падаем сразу, пробуем legacy как fallback.
  }

  const userId = String(body.userId || '').trim();
  const sessionToken = String(body.sessionToken || '').trim();
  const legacy = await verifySession(db, userId, sessionToken);
  if (!legacy.ok) return legacy;
  return { ok: true, user: legacy.user, userRef: legacy.userRef, userId, source: 'legacy' };
}

// Send Telegram notification (uses env vars only)
export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('Telegram send error:', e.message);
  }
}

// Get JAP API key from env (no hardcoded fallback)
export function getJapKey() {
  return process.env.JAP_API_KEY || '';
}

// Simple in-memory rate limiter (per Vercel instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;

export function rateLimit(key, maxRequests = 10) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { timestamp: now, count: 1 });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}
