import crypto from 'crypto';
import { handleCors, rateLimit } from './_lib/shared.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!rateLimit(`vpn:${clientIp}`, 5)) return res.status(429).json({ error: 'Слишком много запросов. Подождите минуту.' });

    const telegram = String(req.body?.telegram || '').trim();
    if (!telegram) return res.status(400).json({ error: 'Telegram required' });

    const tgClean = telegram.replace(/^@/, '');
    if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(tgClean) && !/^https?:\/\/t\.me\//i.test(telegram)) {
      return res.status(400).json({ error: 'Некорректный Telegram username' });
    }

    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) return res.status(500).json({ error: 'YooKassa credentials are not configured' });

    const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
    const idempotenceKey = 'vpn-' + crypto.randomUUID().slice(0, 12);

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json', 'Idempotence-Key': idempotenceKey },
      body: JSON.stringify({
        amount: { value: '129.00', currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: (process.env.SITE_URL || 'https://smm-boost.pro') + '/success.html' },
        description: 'VPN 1 month',
        metadata: { type: 'vpn_order', telegram: tgClean }
      })
    });

    const data = await response.json();
    return res.status(response.ok ? 200 : 500).json(data.confirmation ? { confirmation_url: data.confirmation.confirmation_url } : data);
  } catch (e) {
    console.error('VPN order error:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
