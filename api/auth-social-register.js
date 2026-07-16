// /api/auth-social-register.js
// Серверная регистрация/вход Google (и legacy email/password) с ЕДИНЫМ userId.
// - Верифицирует Google ID Token через tokeninfo.
// - userId = sha256('email:' + emailLower).slice(0,32) — совпадает с клиентом.
// - При создании нового документа инкрементирует referralsCount у пригласившего
//   (та же логика, что и в старом /api/auth-register).

import { createHash } from 'crypto';

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'smm-boost-905d5';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

function deterministicUserId(email){
  return createHash('sha256').update('email:' + String(email || '').trim().toLowerCase()).digest('hex').slice(0, 32);
}

async function verifyGoogleIdToken(idToken){
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!r.ok) throw new Error('Google token verification failed');
  const data = await r.json();
  if (!data.email || data.email_verified === 'false') throw new Error('Email not verified by Google');
  return { email: data.email, name: data.name || '', picture: data.picture || '', sub: data.sub };
}

// --- Firestore REST (без SDK, работает в Vercel Edge/Node) ---
function toFsValue(v){
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFsValue(x)])) } };
  return { stringValue: String(v) };
}
function fromFsValue(v){
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFsValue(x)]));
  return null;
}
async function fsGet(path){
  const r = await fetch(`${FS_BASE}/${path}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore get ' + r.status);
  const j = await r.json();
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromFsValue(v)]));
}
async function fsCreate(path, data){
  const r = await fetch(`${FS_BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)])) })
  });
  if (!r.ok) throw new Error('firestore create ' + r.status + ' ' + await r.text());
}
async function fsUpdate(path, data){
  // updateMask.fieldPaths, чтобы не перезаписать баланс/рефералы.
  const keys = Object.keys(data);
  const qs = keys.map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(`${FS_BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)])) })
  });
  if (!r.ok) throw new Error('firestore update ' + r.status + ' ' + await r.text());
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { idToken, referredBy = '' } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const g = await verifyGoogleIdToken(idToken);
    const email = g.email.toLowerCase();
    const userId = deterministicUserId(email);
    const now = new Date();

    const existing = await fsGet('users/' + userId);

    if (!existing){
      await fsCreate('users/' + userId, {
        userId,
        firebaseUid: g.sub,
        email,
        usernameLower: email,
        displayName: g.name || email.split('@')[0],
        photoURL: g.picture,
        emailVerified: true,
        authType: 'google',
        authProviders: ['google.com'],
        referralCode: userId,
        referredBy: referredBy || '',
        balance: 0,
        bonusBalance: 0,
        registrationBonus: 0,
        referralsCount: 0,
        referralEarned: 0,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      });
      // Реферальный инкремент — как в legacy.
      if (referredBy && referredBy !== userId){
        const inv = await fsGet('users/' + referredBy);
        if (inv){
          await fsUpdate('users/' + referredBy, {
            referralsCount: (inv.referralsCount || 0) + 1,
            updatedAt: now
          });
        }
      }
      return res.status(200).json({ ok: true, created: true, userId, email, displayName: g.name });
    }

    // Обновляем только служебные поля.
    await fsUpdate('users/' + userId, {
      email,
      displayName: g.name || existing.displayName || email.split('@')[0],
      photoURL: g.picture || existing.photoURL || '',
      emailVerified: true,
      lastLoginAt: now,
      updatedAt: now
    });
    return res.status(200).json({ ok: true, created: false, userId, email, displayName: existing.displayName });
  } catch (e){
    console.error('[auth-social-register]', e);
    return res.status(400).json({ error: e.message || 'error' });
  }
}
