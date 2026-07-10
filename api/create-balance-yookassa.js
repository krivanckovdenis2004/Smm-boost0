import crypto from 'crypto';
import { db, handleCors, verifySession, rateLimit } from './_lib/shared.js';

function json(res, status, payload) { return res.status(status).json(payload); }

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const amount = Number(req.body?.amount || 0);
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();
    const login = String(req.body?.login || req.body?.username || '').trim();

    if (!userId || !sessionToken) return json(res, 401, { error: 'Сначала войдите в аккаунт' });
    if (!Number.isFinite(amount) || amount < 100) return json(res, 400, { error: 'Минимальное пополнение 100₽' });
    if (amount > 50000) return json(res, 400, { error: 'Максимальное пополнение 50000₽' });
    if (!rateLimit(`topup:${userId}`, 5)) return json(res, 429, { error: 'Слишком много запросов. Подождите минуту.' });

    const session = await verifySession(db, userId, sessionToken);
    if (!session.ok) return json(res, session.status, { error: session.error });

    const user = session.user;
    const userLogin = login || user.username || user.displayName || 'user';

    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) return json(res, 500, { error: 'YooKassa credentials are not configured' });

    const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
    const idempotenceKey = 'topup-' + userId + '-' + amount.toFixed(2) + '-' + crypto.randomUUID().slice(0, 8);

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json', 'Idempotence-Key': idempotenceKey },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: (process.env.SITE_URL || 'https://smm-boost.pro') + '/wallet.html?topup=1' },
        description: `Пополнение баланса SMM-BOOST — ${userLogin} — ${amount.toFixed(2)}₽`.slice(0, 128),
        metadata: { type: 'balance_topup', userId, login: userLogin, amountRub: String(amount.toFixed(2)) }
      })
    });

    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: 'Server error' });
  }
}
