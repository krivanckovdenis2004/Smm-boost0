import { validateOrderPayload } from './service-catalog.js';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const validated = validateOrderPayload(req.body || {});
    if (!validated.ok) {
      return json(res, 400, { error: validated.error });
    }

    const { service, quantity, link, priceRub } = validated;
    const { orderDocId, publicOrderId } = req.body || {};

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
        amount: String(((priceRub * 1.12) / 70).toFixed(2)),
        description: `${service.name} — ${quantity}`.slice(0, 128),
        payload: JSON.stringify({
          service: String(service.name),
          serviceId: String(service.id),
          link: String(link),
          quantity: String(quantity),
          priceRub: String(priceRub),
          orderDocId: String(orderDocId || ''),
          publicOrderId: String(publicOrderId || '')
        })
      })
    });

    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
