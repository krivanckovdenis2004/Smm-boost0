import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost-905d5.firebaseapp.com',
  projectId: 'smm-boost-905d5',
  storageBucket: 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: '554912523069',
  appId: '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: 'G-E6SRLXZW5V'
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

function siteUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'smm-boost.pro';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return process.env.PUBLIC_SITE_URL || `${proto}://${host}`;
}

function safeText(value = '', max = 80) {
  return String(value || '').trim().slice(0, max);
}

function uidFromKey(key) {
  return crypto.createHash('sha256').update(String(key).toLowerCase()).digest('hex').slice(0, 32);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function authReturnUrl(req, payload) {
  return `${siteUrl(req)}/auth.html?auth_payload=${encodeURIComponent(encodePayload(payload))}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function publicUser(user) {
  return {
    userId: user.userId,
    socialPlatform: user.socialPlatform || user.authType || 'password',
    externalId: user.externalId || user.username || user.userId,
    socialLogin: user.socialLogin || user.username || user.displayName,
    username: user.username || user.socialLogin,
    displayName: user.displayName || user.username || user.socialLogin || 'Пользователь',
    email: user.email || `${user.userId}@smmboost.local`,
    balance: Number(user.balance || 0),
    bonusBalance: Number(user.bonusBalance || 0),
    registrationBonus: Number(user.registrationBonus || 0),
    sessionToken: user.sessionToken
  };
}

async function upsertTelegramUser({ telegramId, username, displayName }) {
  const userId = uidFromKey(`telegram:${telegramId}`);
  const sessionToken = newToken();
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  let user;
  if (!userSnap.exists()) {
    user = {
      userId,
      authType: 'telegram',
      socialPlatform: 'telegram',
      externalId: String(telegramId),
      socialLogin: username || String(telegramId),
      displayName: displayName || `Telegram: ${username || telegramId}`,
      email: `telegram_${userId}@smmboost.local`,
      balance: 0,
      bonusBalance: 70,
      registrationBonus: 70,
      sessionToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, user);
  } else {
    const old = userSnap.data();
    user = {
      ...old,
      userId,
      authType: old.authType || 'telegram',
      socialPlatform: old.socialPlatform || 'telegram',
      externalId: old.externalId || String(telegramId),
      socialLogin: old.socialLogin || username || String(telegramId),
      displayName: old.displayName || displayName || `Telegram: ${username || telegramId}`,
      email: old.email || `telegram_${userId}@smmboost.local`,
      balance: Number(old.balance || 0),
      bonusBalance: Number(old.bonusBalance || 0),
      registrationBonus: Number(old.registrationBonus || 0),
      sessionToken,
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, user, { merge: true });
  }

  return publicUser(user);
}

async function registerPasswordUser(req, res) {
  const usernameRaw = safeText(req.body?.username, 32);
  const password = String(req.body?.password || '');
  const passwordConfirm = String(req.body?.passwordConfirm || '');
  const username = usernameRaw.replace(/\s+/g, '');
  const usernameLower = username.toLowerCase();

  if (!/^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Логин должен быть от 3 до 32 символов: буквы, цифры, _, . или -' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
  if (password !== passwordConfirm) return res.status(400).json({ error: 'Пароли не совпадают' });

  const userId = uidFromKey(`password:${usernameLower}`);
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return res.status(409).json({ error: 'Такой логин уже зарегистрирован' });

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
    bonusBalance: 70,
    registrationBonus: 70,
    passwordSalt: salt,
    passwordHash: hash,
    sessionToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(userRef, user);
  return res.status(200).json({ ok: true, user: publicUser(user) });
}

async function registerFromTelegramBot(req, res) {
  const secret = process.env.TELEGRAM_BOT_REG_SECRET;
  const providedSecret = req.headers['x-bot-secret'] || req.body?.secret;
  if (!secret || providedSecret !== secret) {
    return res.status(403).json({ error: 'Регистрация Telegram разрешена только через @Smmboost_reg_bot' });
  }

  const telegramId = safeText(req.body?.telegramId || req.body?.id, 80);
  if (!telegramId) return res.status(400).json({ error: 'telegramId обязателен' });

  const username = safeText(req.body?.username || req.body?.telegramUsername || telegramId, 80).replace(/^@/, '');
  const firstName = safeText(req.body?.firstName || req.body?.first_name, 40);
  const lastName = safeText(req.body?.lastName || req.body?.last_name, 40);
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || (username ? `@${username}` : `Telegram ID ${telegramId}`);

  const user = await upsertTelegramUser({
    telegramId,
    username: username ? `@${username}` : String(telegramId),
    displayName
  });

  return res.status(200).json({
    ok: true,
    user,
    magicLink: authReturnUrl(req, { ok: true, user })
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(400).json({ error: 'VK-вход удалён. Доступна регистрация по логину/паролю или через Telegram-бота.' });
    }

    if (req.method === 'POST') {
      const platform = safeText(req.body?.platform, 40).toLowerCase();
      if (platform === 'telegram') return registerFromTelegramBot(req, res);
      if (platform === 'password') return registerPasswordUser(req, res);
      return res.status(403).json({ error: 'Доступна регистрация по логину/паролю или через Telegram-бота.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
