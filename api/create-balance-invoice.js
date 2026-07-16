// Объединённый эндпоинт создания платежа для пополнения баланса.
// Поддерживает два провайдера:
//   - CryptoBot  (путь /api/create-balance-invoice)
//   - ЮKassa     (путь /api/create-balance-yookassa — через rewrite в vercel.json)
// Совместимость с существующим фронтендом сохранена: он вызывает оба URL как раньше.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function detectProvider(req) {
  const url = String(req.url || '');
  if (req.body && req.body.provider) return String(req.body.provider);
  if (url.includes('yookassa')) return 'yookassa';
  return 'cryptobot';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const amount = Number(req.body?.amount || 0);
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();
    const login = String(req.body?.login || req.body?.username || '').trim();

    if (!userId || !sessionToken) return json(res, 401, { error: 'Сначала войдите в аккаунт' });
    if (!Number.isFinite(amount) || amount < 100) return json(res, 400, { error: 'Минимальное пополнение 100₽' });

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return json(res, 401, { error: 'Аккаунт не найден. Войдите заново.' });
    const user = userSnap.data();
    if (String(user.sessionToken || '') !== sessionToken) return json(res, 401, { error: 'Сессия устарела. Войдите заново.' });
    const userLogin = login || user.username || user.displayName || 'user';

    const provider = detectProvider(req);

    if (provider === 'yookassa') {
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return json(res, 500, { error: 'YooKassa credentials are not configured' });
      }
      const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
      const { randomUUID } = await import('crypto');
      const idempotenceKey = randomUUID();

      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey
        },
        body: JSON.stringify({
          amount: { value: amount.toFixed(2), currency: 'RUB' },
          capture: true,
          confirmation: {
            type: 'redirect',
            return_url: 'https://smm-boost.pro/wallet.html?topup=1'
          },
          description: `Пополнение баланса SMM-BOOST — ${userLogin} — ${amount.toFixed(2)}₽`.slice(0, 128),
          metadata: {
            type: 'balance_topup',
            userId,
            login: userLogin,
            amountRub: String(amount.toFixed(2))
          }
        })
      });
      const data = await response.json();
      return json(res, response.ok ? 200 : response.status, data);
    }

    // CryptoBot по умолчанию
    if (!process.env.CRYPTOBOT_TOKEN) {
      return json(res, 500, { error: 'CryptoBot token is not configured' });
    }
    const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': process.env.CRYPTOBOT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset: 'USDT',
        amount: String(((amount * 1.12) / 70).toFixed(2)),
        description: `Пополнение баланса SMM-BOOST — ${userLogin} — ${amount.toFixed(2)}₽`.slice(0, 128),
        payload: JSON.stringify({
          type: 'balance_topup',
          userId,
          login: userLogin,
          amountRub: String(amount.toFixed(2))
        })
      })
    });
    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
