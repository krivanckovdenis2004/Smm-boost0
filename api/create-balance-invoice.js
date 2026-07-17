// Объединённый эндпоинт создания платежа для пополнения баланса.
// Поддерживает два провайдера:
//   - CryptoBot  (путь /api/create-balance-invoice)
//   - ЮKassa     (путь /api/create-balance-yookassa — через rewrite в vercel.json)
// Совместимость с существующим фронтендом сохранена: он вызывает оба URL как раньше.

import { db } from './_lib/shared.js';
import { resolveAuthedUser } from './_lib/shared.js';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function detectProvider(req) {
  const url = String(req.url || '');
  if (req.query && req.query.provider) return String(req.query.provider);
  if (req.body && req.body.provider) return String(req.body.provider);
  if (url.includes('yookassa')) return 'yookassa';
  return 'cryptobot';
}

async function readJsonResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { error: text || 'Провайдер вернул некорректный ответ' }; }
}

function providerError(data, fallback) {
  return data?.description || data?.message || data?.error_description || data?.error?.message || data?.error || fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount < 100) return json(res, 400, { error: 'Минимальное пополнение 100₽' });

    const authed = await resolveAuthedUser(db, req);
    if (!authed.ok) return json(res, authed.status || 401, { error: authed.error });
    const { user, userId } = authed;
    const loginRaw = String(req.body?.login || req.body?.username || '').trim();
    const userLogin = loginRaw || user.username || user.displayName || user.email || 'user';

    const provider = detectProvider(req);
    const requestId = String(req.body?.requestId || '').trim().slice(0, 80);

    if (provider === 'yookassa') {
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        return json(res, 500, { error: 'YooKassa credentials are not configured' });
      }
      const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
      const { createHash, randomUUID } = await import('crypto');
      const idempotenceKey = requestId
        ? createHash('sha256').update(`topup:yookassa:${userId}:${requestId}:${amount.toFixed(2)}`).digest('hex')
        : randomUUID();

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
      const data = await readJsonResponse(response);
      if (!response.ok) {
        return json(res, response.status, { ...data, error: providerError(data, 'YooKassa отклонила создание платежа') });
      }
      if (!data?.confirmation?.confirmation_url) {
        return json(res, 502, { error: 'YooKassa не вернула ссылку оплаты', providerResponse: data });
      }
      return json(res, 200, data);
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
    const data = await readJsonResponse(response);
    if (!response.ok || data?.ok === false) {
      return json(res, response.ok ? 502 : response.status, { ...data, error: providerError(data, 'CryptoBot отклонил создание счёта') });
    }
    const payUrl = data?.result?.pay_url || data?.result?.bot_invoice_url || data?.result?.mini_app_invoice_url;
    if (!payUrl) {
      return json(res, 502, { error: 'CryptoBot не вернул ссылку оплаты', providerResponse: data });
    }
    data.result.pay_url = payUrl;
    return json(res, 200, data);
  } catch (e) {
    console.error('[CREATE-BALANCE-INVOICE] FAIL:', e?.code, e?.message, e?.stack);
    return json(res, 500, { error: e.message });
  }
}
