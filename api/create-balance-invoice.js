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

    if (!process.env.CRYPTOBOT_TOKEN) return json(res, 500, { error: 'CryptoBot token is not configured' });

    const usdRubRate = Number(process.env.USD_RUB_RATE || process.env.RUB_RATE || 100);
    const markupPercent = Number(process.env.CRYPTOBOT_MARKUP_PERCENT || 12);
    const cryptoAmount = Number(((amount * (1 + markupPercent / 100)) / usdRubRate).toFixed(2));

    const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: { 'Crypto-Pay-API-Token': process.env.CRYPTOBOT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: 'USDT', amount: String(cryptoAmount),
        description: `Пополнение баланса SMM-BOOST — ${userLogin} — ${amount.toFixed(2)}₽`.slice(0, 128),
        payload: JSON.stringify({ type: 'balance_topup', userId, login: userLogin, amountRub: String(amount.toFixed(2)) })
      })
    });

    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: 'Server error' });
  }
}
