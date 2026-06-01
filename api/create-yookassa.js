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

    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
      return json(res, 500, { error: 'YooKassa credentials are not configured' });
    }

    const auth = Buffer.from(
      process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY
    ).toString('base64');

    const idempotenceKey =
      'smm-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2);

    const returnUrl = orderDocId
      ? `https://smm-boost.pro/orders.html?paid=1&order=${encodeURIComponent(orderDocId)}`
      : 'https://smm-boost.pro/orders.html?paid=1';

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify({
        amount: {
          value: priceRub.toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: returnUrl
        },
        description: `${service.name} — ${quantity}`.slice(0, 128),
        metadata: {
          service: String(service.name),
          serviceId: String(service.id),
          link: String(link),
          quantity: String(quantity),
          priceRub: String(priceRub),
          orderDocId: String(orderDocId || ''),
          publicOrderId: String(publicOrderId || '')
        }
      })
    });

    const data = await response.json();
    return json(res, response.ok ? 200 : response.status, data);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
