import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';

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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const COOLDOWN_MS = 30 * 60 * 1000; // 30 минут

const FREE_SERVICES = {
  likes:      { key: 'likes',      title: 'Лайки',       icon: '❤️', quantity: 50 },
  followers:  { key: 'followers',  title: 'Подписчики',  icon: '👥', quantity: 20 },
  views:      { key: 'views',      title: 'Просмотры',   icon: '👁',  quantity: 500 },
  reactions:  { key: 'reactions',  title: 'Реакции',     icon: '🔥', quantity: 50 },
  favorites:  { key: 'favorites',  title: 'Избранное',   icon: '⭐', quantity: 30 },
  shares:     { key: 'shares',     title: 'Репосты',     icon: '🔁', quantity: 20 }
};

const SOCIAL_RULES = {
  TikTok: /tiktok\.com|vm\.tiktok\.com/i,
  Telegram: /t\.me|telegram\.me/i,
  YouTube: /youtube\.com|youtu\.be/i,
  VK: /vk\.com|vk\.ru/i,
  Instagram: /instagram\.com/i
};

function clean(v) { return String(v || '').replace(/[<>]/g, '').slice(0, 500); }

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Проверка статуса пользователя (следующее доступное время и история)
    try {
      const userId = String(req.query?.userId || '').trim();
      const sessionToken = String(req.query?.sessionToken || '').trim();
      if (!userId || !sessionToken) return res.status(401).json({ error: 'Требуется вход' });

      const { getDoc } = await import('firebase/firestore');
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (!userSnap.exists()) return res.status(401).json({ error: 'Аккаунт не найден' });
      if (String(userSnap.data().sessionToken || '') !== sessionToken) {
        return res.status(401).json({ error: 'Сессия устарела' });
      }

      const claimsSnap = await getDoc(doc(db, 'free_claims', userId));
      const data = claimsSnap.exists() ? claimsSnap.data() : {};
      const lastAt = data.lastClaimAt?.toMillis ? data.lastClaimAt.toMillis() : 0;
      const nextAvailableAt = lastAt ? lastAt + COOLDOWN_MS : 0;
      const now = Date.now();
      const history = Array.isArray(data.history) ? data.history.slice(-20).reverse() : [];

      return res.status(200).json({
        ok: true,
        nextAvailableAt,
        remainingMs: Math.max(0, nextAvailableAt - now),
        history: history.map(h => ({
          title: h.title,
          quantity: h.quantity,
          social: h.social,
          at: h.at?.toMillis ? h.at.toMillis() : (h.at || 0)
        }))
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();
    const serviceKey = String(req.body?.serviceKey || '').trim();
    const social = String(req.body?.social || '').trim();
    const link = String(req.body?.link || '').trim();
    const telegramUser = String(req.body?.telegramUser || '').trim();

    if (!userId || !sessionToken) return res.status(401).json({ error: 'Сначала войдите в аккаунт' });

    const service = FREE_SERVICES[serviceKey];
    if (!service) return res.status(400).json({ error: 'Неизвестная услуга' });
    if (!SOCIAL_RULES[social]) return res.status(400).json({ error: 'Выберите соцсеть' });
    if (!SOCIAL_RULES[social].test(link)) return res.status(400).json({ error: 'Некорректная ссылка для выбранной соцсети' });
    if (!telegramUser || telegramUser.length < 2) return res.status(400).json({ error: 'Укажите ваш Telegram/VK username' });

    const userRef = doc(db, 'users', userId);
    const claimsRef = doc(db, 'free_claims', userId);
    const now = Date.now();

    let claimResult = null;

    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('Аккаунт не найден');
      const user = userSnap.data();
      if (String(user.sessionToken || '') !== sessionToken) {
        throw new Error('Сессия устарела. Войдите заново.');
      }

      const telegramConfirmed = Boolean(user.telegramSubscribed);

      const claimsSnap = await tx.get(claimsRef);
      const claimsData = claimsSnap.exists() ? claimsSnap.data() : {};
      const lastAt = claimsData.lastClaimAt?.toMillis ? claimsData.lastClaimAt.toMillis() : 0;
      const nextAt = lastAt ? lastAt + COOLDOWN_MS : 0;

      if (nextAt > now) {
        throw Object.assign(new Error('Подождите до следующей бесплатной услуги'), {
          code: 'COOLDOWN',
          nextAvailableAt: nextAt
        });
      }

      const historyEntry = {
        key: service.key,
        title: service.title,
        quantity: service.quantity,
        social,
        link: clean(link),
        at: Timestamp.fromMillis(now)
      };
      const history = Array.isArray(claimsData.history) ? claimsData.history.slice(-19) : [];
      history.push(historyEntry);

      tx.set(claimsRef, {
        userId,
        lastClaimAt: serverTimestamp(),
        totalClaims: Number(claimsData.totalClaims || 0) + 1,
        history,
        updatedAt: serverTimestamp()
      }, { merge: true });

      claimResult = {
        service,
        social,
        link,
        telegramUser,
        telegramConfirmed,
        nextAvailableAt: now + COOLDOWN_MS
      };
    });

    // Отправляем заявку админу в Telegram (аналог free-gift.js — безопасно, без авто-JAP)
    const msg = `🎁 Бесплатная услуга (авторизованный пользователь)\n\nUserId: ${userId}\nКонтакт: ${clean(claimResult.telegramUser)}\nУслуга: ${claimResult.service.icon} ${claimResult.service.title} × ${claimResult.service.quantity}\nСоцсеть: ${clean(claimResult.social)}\nСсылка: ${clean(claimResult.link)}\nСтатус: заявка принята, обработать вручную.`;
    await sendTelegram(msg);

    return res.status(200).json({
      ok: true,
      service: claimResult.service,
      nextAvailableAt: claimResult.nextAvailableAt,
      message: 'Заявка принята! Услуга будет выполнена в течение нескольких минут.'
    });
  } catch (e) {
    if (e.code === 'COOLDOWN') {
      return res.status(429).json({ error: e.message, nextAvailableAt: e.nextAvailableAt });
    }
    console.error('[free-service]', e);
    return res.status(500).json({ error: e.message || 'Ошибка запроса' });
  }
}
