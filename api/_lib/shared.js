import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Shared Firebase initialization — uses env vars, no hardcoded secrets
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
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
