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

function redirect(res, url) {
  res.writeHead(302, { Location: url });
  res.end();
}

function safeText(value = '', max = 80) {
  return String(value || '').trim().slice(0, max);
}

function uidFromSocial(platform, id) {
  return crypto.createHash('sha256').update(`${platform}:${String(id).toLowerCase()}`).digest('hex').slice(0, 32);
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

function authErrorUrl(req, message) {
  return `${siteUrl(req)}/auth.html?auth_error=${encodeURIComponent(message)}`;
}

async function upsertSocialUser({ platform, externalId, username, displayName }) {
  const userId = uidFromSocial(platform, externalId);
  const sessionToken = newToken();
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  let user;
  if (!userSnap.exists()) {
    user = {
      userId,
      socialPlatform: platform,
      externalId: String(externalId),
      socialLogin: username || String(externalId),
      displayName: displayName || `${platform === 'telegram' ? 'Telegram' : 'VK'}: ${username || externalId}`,
      email: `${platform}_${userId}@smmboost.local`,
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
      userId,
      socialPlatform: old.socialPlatform || platform,
      externalId: old.externalId || String(externalId),
      socialLogin: old.socialLogin || username || String(externalId),
      displayName: old.displayName || displayName || `${platform === 'telegram' ? 'Telegram' : 'VK'}: ${username || externalId}`,
      email: old.email || `${platform}_${userId}@smmboost.local`,
      balance: Number(old.balance || 0),
      bonusBalance: Number(old.bonusBalance || 0),
      registrationBonus: Number(old.registrationBonus || 0),
      telegramBonusClaimed: Boolean(old.telegramBonusClaimed),
      vkBonusClaimed: Boolean(old.vkBonusClaimed),
      sessionToken,
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, user, { merge: true });
  }

  return {
    userId,
    socialPlatform: user.socialPlatform,
    externalId: user.externalId,
    socialLogin: user.socialLogin,
    displayName: user.displayName,
    email: user.email,
    balance: Number(user.balance || 0),
    bonusBalance: Number(user.bonusBalance || 0),
    sessionToken
  };
}

async function startVk(req, res) {
  const clientId = process.env.VK_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'VK-вход не настроен: добавьте VK_CLIENT_ID в Vercel Environment Variables' });

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${siteUrl(req)}/api/auth-social-register?provider=vk-callback`;
  const url = new URL('https://oauth.vk.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('display', 'mobile');
  url.searchParams.set('scope', 'email');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('v', '5.199');

  return res.status(200).json({ ok: true, url: url.toString() });
}

async function finishVk(req, res) {
  try {
    const code = safeText(req.query?.code, 500);
    if (!code) return redirect(res, authErrorUrl(req, 'VK не вернул код авторизации'));

    const clientId = process.env.VK_CLIENT_ID;
    const clientSecret = process.env.VK_CLIENT_SECRET;
    if (!clientId || !clientSecret) return redirect(res, authErrorUrl(req, 'VK-вход не настроен на сервере'));

    const redirectUri = `${siteUrl(req)}/api/auth-social-register?provider=vk-callback`;
    const tokenUrl = new URL('https://oauth.vk.com/access_token');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.user_id) {
      return redirect(res, authErrorUrl(req, tokenData.error_description || 'VK не подтвердил вход'));
    }

    let displayName = `VK ID ${tokenData.user_id}`;
    try {
      const userUrl = new URL('https://api.vk.com/method/users.get');
      userUrl.searchParams.set('user_ids', String(tokenData.user_id));
      userUrl.searchParams.set('access_token', tokenData.access_token);
      userUrl.searchParams.set('v', '5.199');
      const userRes = await fetch(userUrl.toString());
      const userData = await userRes.json();
      const vkUser = userData?.response?.[0];
      if (vkUser) displayName = [vkUser.first_name, vkUser.last_name].filter(Boolean).join(' ') || displayName;
    } catch {}

    const user = await upsertSocialUser({
      platform: 'vk',
      externalId: tokenData.user_id,
      username: `id${tokenData.user_id}`,
      displayName
    });

    return redirect(res, authReturnUrl(req, { ok: true, user }));
  } catch (e) {
    console.error(e);
    return redirect(res, authErrorUrl(req, 'Ошибка VK-входа'));
  }
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

  const user = await upsertSocialUser({
    platform: 'telegram',
    externalId: telegramId,
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
      const provider = safeText(req.query?.provider, 40);
      if (provider === 'vk-start') return startVk(req, res);
      if (provider === 'vk-callback') return finishVk(req, res);
      return res.status(400).json({ error: 'Неизвестный способ входа' });
    }

    if (req.method === 'POST') {
      const platform = safeText(req.body?.platform, 40).toLowerCase();
      if (platform === 'telegram') return registerFromTelegramBot(req, res);
      return res.status(403).json({ error: 'Ручная регистрация отключена. Telegram — только через бота, VK — только через разрешение VK.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
