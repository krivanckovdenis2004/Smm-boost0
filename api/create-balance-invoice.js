
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
    if (!Number.isFinite(amount) || amount < 100) return json(res, 400, { error: 'Минимальное пополнение 100₽' });

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
        description: `Пополнение баланса SMM-BOOST — ${amount.toFixed(2)}₽`.slice(0, 128),
        payload: JSON.stringify({
          type: 'balance_topup',
          userId,
          email,
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
