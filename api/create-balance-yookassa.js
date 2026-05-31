
function json(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const amount = Number(req.body?.amount || 0);
    const userId = String(req.body?.userId || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!userId || !email) return json(res, 401, { error: 'Сначала войдите в аккаунт' });
    if (!Number.isFinite(amount) || amount < 50) return json(res, 400, { error: 'Минимальное пополнение 50₽' });

    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
      return json(res, 500, { error: 'YooKassa credentials are not configured' });
    }

    const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
    const idempotenceKey = 'topup-' + userId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);

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
        description: `Пополнение баланса SMM-BOOST — ${amount.toFixed(2)}₽`.slice(0, 128),
        metadata: {
          type: 'balance_topup',
          userId,
          email,
          amountRub: String(amount.toFixed(2))
        }
      })
    });

    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
