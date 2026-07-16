import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, runTransaction, serverTimestamp, Timestamp, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost.pro',
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
const JAP_API_KEY = process.env.JAP_API_KEY || '';
const JAP_API_URL = 'https://justanotherpanel.com/api/v2';

const COOLDOWN_MS = 30 * 60 * 1000; // 30 минут

const FREE_SERVICES = {
  likes:      { key: 'likes',      title: 'Лайки',       icon: '❤️', quantity: 50,  category: 'likes' },
  followers:  { key: 'followers',  title: 'Подписчики',  icon: '👥', quantity: 20,  category: 'followers' },
  views:      { key: 'views',      title: 'Просмотры',   icon: '👁',  quantity: 500, category: 'views' },
  reactions:  { key: 'reactions',  title: 'Реакции',     icon: '🔥', quantity: 50,  category: 'reactions' },
  favorites:  { key: 'favorites',  title: 'Избранное',   icon: '⭐', quantity: 30,  category: 'saves' },
  shares:     { key: 'shares',     title: 'Репосты',     icon: '🔁', quantity: 20,  category: 'shares' }
};

const SOCIAL_RULES = {
  TikTok: /tiktok\.com|vm\.tiktok\.com/i,
  Telegram: /t\.me|telegram\.me/i,
  YouTube: /youtube\.com|youtu\.be/i,
  VK: /vk\.com|vk\.ru/i,
  Instagram: /instagram\.com/i
};

const CATEGORY_PATTERNS = {
  likes:     /\blike|лайк/i,
  followers: /follow|subscrib|member|подписч|участник/i,
  views:     /view|просмотр|impression|reach|охват/i,
  reactions: /react|реакц/i,
  saves:     /save|favou?rite|сохран|избран|bookmark/i,
  shares:    /share|repost|forward|репост|пересыл/i
};

const PLATFORM_PATTERNS = {
  TikTok:    /tiktok|тик\s?ток/i,
  Telegram:  /telegram|телеграм/i,
  YouTube:   /youtube|ютуб/i,
  VK:        /\bvk\b|вконтакте|вк\s/i,
  Instagram: /instagram|инстаграм/i
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

let cachedJapServices = null;
let cachedJapAt = 0;
const JAP_CACHE_TTL = 10 * 60 * 1000;

async function fetchJapServices() {
  if (cachedJapServices && Date.now() - cachedJapAt < JAP_CACHE_TTL) return cachedJapServices;
  if (!JAP_API_KEY) return [];
  try {
    const r = await fetch(JAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: JAP_API_KEY, action: 'services' })
    });
    const data = await r.json();
    if (Array.isArray(data)) {
      cachedJapServices = data;
      cachedJapAt = Date.now();
      return data;
    }
  } catch (e) {
    console.error('[free-service] fetchJapServices', e);
  }
  return cachedJapServices || [];
}

// Найти самую дешёвую услугу JAP под (соцсеть, категория, количество)
async function findCheapestJapService(social, category, quantity) {
  const services = await fetchJapServices();
  const platformRe = PLATFORM_PATTERNS[social];
  const categoryRe = CATEGORY_PATTERNS[category];
  if (!platformRe || !categoryRe) return null;

  const candidates = services.filter(s => {
    const name = String(s.name || '');
    const cat = String(s.category || '');
    const text = `${cat} ${name}`;
    if (!platformRe.test(text)) return false;
    if (!categoryRe.test(text)) return false;
    const min = Number(s.min || 0);
    const max = Number(s.max || 0);
    if (min > quantity) return false;
    if (max && max < quantity) return false;
    const rate = Number(s.rate || 0);
    if (!(rate > 0)) return false;
    const type = String(s.type || '').toLowerCase();
    if (type && type !== 'default') return false;
    // избегаем услуг с явно плохими метками
    if (/drip|drip-feed|subscriptions|custom|refill/i.test(name) && !/likes|followers|views|reactions|shares/i.test(name)) {
      // не отбрасываем полностью, но понизим приоритет — фильтр не жёсткий
    }
    return true;
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => Number(a.rate) - Number(b.rate));
  return candidates[0];
}

async function submitJapOrder(serviceId, link, quantity) {
  if (!JAP_API_KEY) return { error: 'JAP_API_KEY not set' };
  try {
    const r = await fetch(JAP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: JAP_API_KEY,
        action: 'add',
        service: String(serviceId),
        link: String(link),
        quantity: String(quantity)
      })
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { error: text }; }
  } catch (e) {
    return { error: e.message };
  }
}

function generatePublicOrderId() {
  return 'F' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
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

    // Автоматически отправляем заказ в JAP: подбираем самую дешёвую подходящую услугу
    const svc = claimResult.service;
    const jap = await findCheapestJapService(claimResult.social, svc.category, svc.quantity);

    let japOrderId = '';
    let japError = '';
    let japServiceId = '';
    let japRate = 0;

    if (jap) {
      japServiceId = String(jap.service);
      japRate = Number(jap.rate || 0);
      const resp = await submitJapOrder(jap.service, claimResult.link, svc.quantity);
      japOrderId = resp.order || resp.id || resp.orderId || '';
      japError = resp.error || resp.message || '';
    } else {
      japError = 'Подходящая услуга JAP не найдена';
    }

    // Создаём запись в orders, чтобы админ и пользователь видели статус
    try {
      const publicOrderId = generatePublicOrderId();
      await addDoc(collection(db, 'orders'), {
        userId,
        userLogin: String(claimResult.telegramUser || ''),
        publicOrderId,
        service: `${svc.icon} ${svc.title} × ${svc.quantity} (бесплатно)`,
        serviceId: japServiceId,
        platform: claimResult.social,
        link: clean(claimResult.link),
        amount: svc.quantity,
        quantity: svc.quantity,
        price: 0,
        isFree: true,
        japOrderId: String(japOrderId || ''),
        japError: String(japError || ''),
        status: japOrderId ? '🟡 В обработке' : '🕓 Ожидает запуска',
        progress: japOrderId ? 15 : 5,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('[free-service] addDoc order', e);
    }

    const msg = `🎁 Бесплатная услуга\n\nUserId: ${userId}\nКонтакт: ${clean(claimResult.telegramUser)}\nУслуга: ${svc.icon} ${svc.title} × ${svc.quantity}\nСоцсеть: ${clean(claimResult.social)}\nСсылка: ${clean(claimResult.link)}\nJAP service: ${japServiceId || '—'}\nJAP order: ${japOrderId || '—'}\n${japError ? 'JAP error: ' + japError : ''}`;
    await sendTelegram(msg);

    return res.status(200).json({
      ok: true,
      service: claimResult.service,
      nextAvailableAt: claimResult.nextAvailableAt,
      japOrderId: japOrderId || null,
      message: japOrderId
        ? 'Заказ отправлен! Услуга появится в течение нескольких минут.'
        : 'Заявка принята. Услуга будет выполнена вручную в ближайшее время.'
    });
  } catch (e) {
    if (e.code === 'COOLDOWN') {
      return res.status(429).json({ error: e.message, nextAvailableAt: e.nextAvailableAt });
    }
    console.error('[free-service]', e);
    return res.status(500).json({ error: e.message || 'Ошибка запроса' });
  }
}
