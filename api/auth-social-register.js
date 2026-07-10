import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// --- Firebase Admin init ---------------------------------------------------
// Требуется env-переменная FIREBASE_SERVICE_ACCOUNT — JSON сервис-аккаунта
// проекта smm-boost-905d5 (Firebase Console → Project settings →
// Service accounts → Generate new private key). Записывается в Vercel как
// секрет одной строкой JSON.
function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not configured');
  try {
    return JSON.parse(raw);
  } catch {
    // Иногда в переменные окружения JSON вставляют с \n внутри private_key —
    // делаем толерантный парсинг.
    return JSON.parse(raw.replace(/\\n/g, '\n'));
  }
}

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore(adminApp);

// --- helpers ---------------------------------------------------------------
function safeText(value = '', max = 80) {
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
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

function publicUser(user) {
  return {
    userId: user.userId,
    authType: 'password',
    username: user.username,
    displayName: user.displayName || user.username || 'Пользователь',
    email: user.email || `${user.userId}@smmboost.local`,
    balance: Number(user.balance || 0),
    bonusBalance: Number(user.bonusBalance || 0),
    registrationBonus: Number(user.registrationBonus || 0),
    sessionToken: user.sessionToken
  };
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,32}$/.test(username);
}

// --- handlers --------------------------------------------------------------
async function registerPasswordUser(req, res) {
  const usernameRaw = safeText(req.body?.username, 32);
  const password = String(req.body?.password || '');
  const passwordConfirm = String(req.body?.passwordConfirm || '');
  const username = usernameRaw.replace(/\s+/g, '');
  const usernameLower = username.toLowerCase();

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Логин должен быть от 3 до 32 символов: буквы, цифры, _, . или -' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
  if (password !== passwordConfirm) return res.status(400).json({ error: 'Пароли не совпадают' });

  const userId = uidFromKey(`password:${usernameLower}`);
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (userSnap.exists) return res.status(409).json({ error: 'Такой логин уже зарегистрирован. Нажмите «Войти».' });

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
    bonusBalance: 5,
    registrationBonus: 5,
    passwordSalt: salt,
    passwordHash: hash,
    sessionToken,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp()
  };
  await userRef.set(user);
  return res.status(200).json({ ok: true, user: publicUser(user) });
}

async function loginPasswordUser(req, res) {
  const usernameRaw = safeText(req.body?.username, 32);
  const password = String(req.body?.password || '');
  const username = usernameRaw.replace(/\s+/g, '');
  const usernameLower = username.toLowerCase();

  if (!validateUsername(username) || password.length < 1) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  const userId = uidFromKey(`password:${usernameLower}`);
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return res.status(404).json({ error: 'Пользователь не найден. Зарегистрируйтесь.' });

  const savedUser = { userId, ...userSnap.data() };
  if (!verifyPassword(password, savedUser.passwordSalt, savedUser.passwordHash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const sessionToken = newToken();
  await userRef.update({
    sessionToken,
    lastLoginAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return res.status(200).json({ ok: true, user: publicUser({ ...savedUser, sessionToken }) });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const action = safeText(req.body?.action || req.body?.platform, 40).toLowerCase();
    if (action === 'password' || action === 'register') return registerPasswordUser(req, res);
    if (action === 'login') return loginPasswordUser(req, res);

    return res.status(400).json({ error: 'Неверное действие. Доступны register и login.' });
  } catch (e) {
    console.error('[auth-social-register]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
