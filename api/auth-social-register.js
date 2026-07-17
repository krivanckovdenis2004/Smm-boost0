import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { verifyFirebaseIdToken as verifySharedFirebaseIdToken } from './_lib/shared.js';
import { AdminFieldValue, getFirebaseAdminDb } from './_lib/firebase-admin.js';

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

function safeText(value = '', max = 120) {
  return String(value || '').trim().slice(0, max);
}

function uidFromKey(key) {
  return crypto.createHash('sha256').update(String(key).toLowerCase()).digest('hex').slice(0, 32);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const { hash } = hashPassword(password, salt);
  try { return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex')); }
  catch { return false; }
}

function publicUser(user) {
  const firebaseUid = user.firebaseUid || '';
  return {
    userId: user.userId,
    firebaseUid,
    authType: user.authType || (firebaseUid ? 'firebase' : 'password'),
    username: user.username || user.usernameLower || user.email || '',
    displayName: user.displayName || user.username || user.email || 'Пользователь',
    email: user.email || (user.userId ? `${user.userId}@smmboost.local` : ''),
    photoURL: user.photoURL || '',
    emailVerified: Boolean(user.emailVerified),
    balance: Number(user.balance || 0),
    bonusBalance: Number(user.bonusBalance || 0),
    registrationBonus: Number(user.registrationBonus || 0),
    referralCode: user.referralCode || user.userId,
    referredBy: user.referredBy || '',
    referralsCount: Number(user.referralsCount || 0),
    referralEarned: Number(user.referralEarned || 0),
    sessionToken: user.sessionToken || (firebaseUid ? `firebase:${firebaseUid}` : '')
  };
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,32}$/.test(username);
}

function tagAuthError(error, step) {
  if (error && typeof error === 'object' && !error.authStep) error.authStep = step;
  return error;
}

function logAuthError(error) {
  console.error('[auth-social-register]', {
    step: error?.authStep || 'handler',
    code: error?.code,
    name: error?.name,
    message: error?.message,
    stack: error?.stack
  });
}

async function readUserDoc(userRef, step) {
  try { return await getDoc(userRef); }
  catch (error) { throw tagAuthError(error, step); }
}

async function resolveReferrer(refRaw, selfUserId) {
  const ref = safeText(refRaw, 64).toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(ref) || ref === selfUserId) return '';
  try {
    const snap = await getDoc(doc(db, 'users', ref));
    return snap.exists() ? ref : '';
  } catch (e) {
    console.warn('[auth] referrer lookup failed', e?.message);
    return '';
  }
}

async function incrementReferrer(referredBy) {
  if (!referredBy) return;
  try {
    await updateDoc(doc(db, 'users', referredBy), {
      referralsCount: increment(1),
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('[auth] increment referralsCount failed', e?.message);
  }
}

async function verifyFirebaseIdToken(idToken) {
  const token = safeText(idToken, 6000);
  if (!token) throw new Error('idToken required');
  const fb = await verifySharedFirebaseIdToken(token);
  if (!fb?.uid) throw new Error('Firebase token verification failed');
  return fb;
}

async function syncFirebaseAuthUser(req, res) {
  const fb = await verifyFirebaseIdToken(req.body?.idToken);
  if (!fb.uid || !fb.email) return res.status(400).json({ error: 'Firebase user email required' });

  const userId = uidFromKey(`email:${fb.email}`);
  const authType = fb.providerIds.includes('google.com') ? 'google' : 'email';
  const sessionToken = `firebase:${fb.uid}`;
  const adminDb = getFirebaseAdminDb();

  if (adminDb) {
    const userRefAdmin = adminDb.collection('users').doc(userId);
    const userSnapAdmin = await userRefAdmin.get();
    const existing = userSnapAdmin.exists ? { userId, ...userSnapAdmin.data() } : null;
    let referredBy = existing?.referredBy || '';

    if (!referredBy) {
      const ref = safeText(req.body?.ref || req.body?.referredBy || '', 64).toLowerCase();
      if (/^[0-9a-f]{32}$/.test(ref) && ref !== userId) {
        const refSnap = await adminDb.collection('users').doc(ref).get();
        referredBy = refSnap.exists ? ref : '';
      }
    }

    const now = AdminFieldValue.serverTimestamp();
    const patch = {
      userId,
      firebaseUid: fb.uid,
      authType: existing?.authType && existing.authType !== 'password' ? existing.authType : authType,
      authProviders: Array.from(new Set([...(Array.isArray(existing?.authProviders) ? existing.authProviders : []), ...fb.providerIds, authType === 'email' ? 'password' : 'google.com'])),
      username: existing?.username || fb.email,
      usernameLower: fb.email,
      displayName: fb.displayName || existing?.displayName || fb.email.split('@')[0],
      email: fb.email,
      photoURL: fb.photoURL || existing?.photoURL || '',
      emailVerified: fb.emailVerified,
      pendingEmailVerification: !fb.emailVerified,
      sessionToken,
      updatedAt: now,
      lastLoginAt: now
    };

    if (!existing) {
      const created = {
        ...patch,
        referralCode: userId,
        referredBy,
        balance: 0,
        bonusBalance: 0,
        registrationBonus: 0,
        referralsCount: 0,
        referralEarned: 0,
        createdAt: now
      };
      await userRefAdmin.set(created);
      if (referredBy) {
        try {
          await adminDb.collection('users').doc(referredBy).set({
            referralsCount: AdminFieldValue.increment(1),
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[auth] admin increment referralsCount failed', e?.message);
        }
      }
      return res.status(200).json({ ok: true, created: true, user: publicUser(created) });
    }

    await userRefAdmin.set(patch, { merge: true });
    return res.status(200).json({ ok: true, created: false, user: publicUser({ ...existing, ...patch }) });
  }

  const userRef = doc(db, 'users', userId);
  const userSnap = await readUserDoc(userRef, 'firebase:getDoc users/{userId}');
  const existing = userSnap.exists() ? { userId, ...userSnap.data() } : null;
  const referredBy = existing?.referredBy || await resolveReferrer(req.body?.ref || req.body?.referredBy || '', userId);

  const patch = {
    userId,
    firebaseUid: fb.uid,
    authType: existing?.authType && existing.authType !== 'password' ? existing.authType : authType,
    authProviders: Array.from(new Set([...(Array.isArray(existing?.authProviders) ? existing.authProviders : []), ...fb.providerIds, authType === 'email' ? 'password' : 'google.com'])),
    username: existing?.username || fb.email,
    usernameLower: fb.email,
    displayName: fb.displayName || existing?.displayName || fb.email.split('@')[0],
    email: fb.email,
    photoURL: fb.photoURL || existing?.photoURL || '',
    emailVerified: fb.emailVerified,
    pendingEmailVerification: !fb.emailVerified,
    sessionToken,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  };

  if (!existing) {
    const created = {
      ...patch,
      referralCode: userId,
      referredBy,
      balance: 0,
      bonusBalance: 0,
      registrationBonus: 0,
      referralsCount: 0,
      referralEarned: 0,
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, created);
    await incrementReferrer(referredBy);
    return res.status(200).json({ ok: true, created: true, user: publicUser(created) });
  }

  await setDoc(userRef, patch, { merge: true });
  return res.status(200).json({ ok: true, created: false, user: publicUser({ ...existing, ...patch }) });
}

async function registerPasswordUser(req, res) {
  const usernameRaw = safeText(req.body?.username, 32);
  const password = String(req.body?.password || '');
  const passwordConfirm = String(req.body?.passwordConfirm || '');
  const username = usernameRaw.replace(/\s+/g, '');
  const usernameLower = username.toLowerCase();

  if (!validateUsername(username)) return res.status(400).json({ error: 'Логин должен быть от 3 до 32 символов: буквы, цифры, _, . или -' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
  if (password !== passwordConfirm) return res.status(400).json({ error: 'Пароли не совпадают' });

  const userId = uidFromKey(`password:${usernameLower}`);
  const userRef = doc(db, 'users', userId);
  const userSnap = await readUserDoc(userRef, 'register:getDoc users/{userId}');
  if (userSnap.exists()) return res.status(409).json({ error: 'Такой логин уже зарегистрирован. Нажмите «Войти».' });

  const referredBy = await resolveReferrer(req.body?.ref, userId);
  const { salt, hash } = hashPassword(password);
  const sessionToken = newToken();
  const user = {
    userId,
    authType: 'password',
    username,
    usernameLower,
    displayName: username,
    email: `login_${userId}@smmboost.local`,
    balance: 0,
    bonusBalance: 0,
    registrationBonus: 0,
    referralCode: userId,
    referredBy,
    referralsCount: 0,
    referralEarned: 0,
    passwordSalt: salt,
    passwordHash: hash,
    sessionToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  };
  await setDoc(userRef, user);
  await incrementReferrer(referredBy);
  return res.status(200).json({ ok: true, user: publicUser(user) });
}

async function loginPasswordUser(req, res) {
  const usernameRaw = safeText(req.body?.username, 32);
  const password = String(req.body?.password || '');
  const username = usernameRaw.replace(/\s+/g, '');
  const usernameLower = username.toLowerCase();

  if (!validateUsername(username) || password.length < 1) return res.status(400).json({ error: 'Введите логин и пароль' });

  const userId = uidFromKey(`password:${usernameLower}`);
  const userRef = doc(db, 'users', userId);
  const userSnap = await readUserDoc(userRef, 'login:getDoc users/{userId}');
  if (!userSnap.exists()) return res.status(404).json({ error: 'Пользователь не найден. Зарегистрируйтесь.' });

  const savedUser = { userId, ...userSnap.data() };
  if (!verifyPassword(password, savedUser.passwordSalt, savedUser.passwordHash)) return res.status(401).json({ error: 'Неверный логин или пароль' });

  const sessionToken = newToken();
  await updateDoc(userRef, { sessionToken, lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return res.status(200).json({ ok: true, user: publicUser({ ...savedUser, sessionToken }) });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const action = safeText(req.body?.action || req.body?.platform || '', 40).toLowerCase();
    if (action === 'firebase' || action === 'firebase-auth' || action === 'sync-firebase') return await syncFirebaseAuthUser(req, res);
    if (action === 'password' || action === 'register') return await registerPasswordUser(req, res);
    if (action === 'login') return await loginPasswordUser(req, res);
    return res.status(400).json({ error: 'Неверное действие. Доступны firebase, register и login.' });
  } catch (e) {
    logAuthError(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
