import crypto from 'crypto';
import { db, handleCors, sendTelegram, getJapKey } from './_lib/shared.js';
import { doc, updateDoc, setDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import { validateOrderPayload } from './service-catalog.js';

function verifyCryptoBotSignature(req) {
  const token = process.env.CRYPTOBOT_TOKEN;
  if (!token) return false;
  const signature = req.headers['crypto-webhook-signature'] || req.headers['crypto-pay-webhook-signature'];
  if (!signature) return false;
  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', token).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  } catch {
    return false;
  }
}

async function verifyCryptoBotInvoice(invoiceId) {
  if (!process.env.CRYPTOBOT_TOKEN) throw new Error('CryptoBot token is not configured');
  const response = await fetch('https://pay.crypt.bot/api/getInvoices', {
    method: 'POST',
    headers: { 'Crypto-Pay-API-Token': process.env.CRYPTOBOT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_ids: String(invoiceId) })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.description || data.error || 'Cannot verify CryptoBot invoice');
  const invoice = Array.isArray(data.result?.items) ? data.result.items[0] : null;
  if (!invoice || invoice.status !== 'paid') throw new Error('CryptoBot invoice is not paid');
  return invoice;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!verifyCryptoBotSignature(req)) return res.status(401).json({ error: 'Invalid webhook signature' });

    const update = req.body;
    if (update.update_type !== 'invoice_paid' || !update.payload) return res.status(200).json({ success: true, skipped: true });

    const eventInvoice = update.payload;
    const verifiedInvoice = await verifyCryptoBotInvoice(eventInvoice.invoice_id);
    const invoiceId = String(verifiedInvoice.invoice_id || eventInvoice.invoice_id);
    const orderData = JSON.parse(verifiedInvoice.payload || eventInvoice.payload || '{}');

    // Replay protection
    const topupRef = doc(db, 'topups', invoiceId);
    const existingTopup = await getDoc(topupRef);
    if (existingTopup.exists()) return res.status(200).json({ success: true, alreadyProcessed: true });

    if (String(orderData.type || '') === 'balance_topup') {
      const userId = String(orderData.userId || '');
      const login = String(orderData.login || orderData.email || '');
      const paidAmountUsd = Number(verifiedInvoice.amount || 0);
      const usdRubRate = Number(process.env.USD_RUB_RATE || process.env.RUB_RATE || 100);
      const amountRub = Number((paidAmountUsd * usdRubRate).toFixed(2));

      if (!userId || !login || !Number.isFinite(amountRub) || amountRub < 1) throw new Error('Invalid balance topup payload');

      const userRef = doc(db, 'users', userId);
      await setDoc(topupRef, { userId, login, amount: amountRub, paymentMethod: 'CryptoBot', invoiceId, status: 'paid', createdAt: serverTimestamp() });
      await updateDoc(userRef, { balance: increment(amountRub), updatedAt: serverTimestamp() });

      await sendTelegram(`💰 Пополнение баланса через CryptoBot\n\nЛогин: ${login}\nСумма: ${amountRub}₽\nInvoice ID: ${invoiceId}`);
      return res.status(200).json({ success: true, topup: true });
    }

    const validated = await validateOrderPayload(orderData);
    if (!validated.ok) throw new Error(validated.error);

    const { service, quantity, link, priceRub } = validated;
    const paidAmountUsd = Number(verifiedInvoice.amount || 0);
    const usdRubRate = Number(process.env.USD_RUB_RATE || process.env.RUB_RATE || 100);
    const paidAmountRub = Number((paidAmountUsd * usdRubRate).toFixed(2));
    if (paidAmountRub + 0.01 < priceRub) throw new Error(`Paid amount too low. Paid: ${paidAmountRub}₽, required: ${priceRub}₽`);

    const japKey = getJapKey();
    if (!japKey) throw new Error('JAP_API_KEY not configured');

    const japResponse = await fetch('https://justanotherpanel.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: japKey, action: 'add', service: String(service.id), link, quantity: String(quantity) })
    });

    const japData = await japResponse.json();
    const japOrderId = japData.order || japData.id || japData.orderId || '';
    const japErrorText = japData.error || japData.message || japData.description || '';
    const orderDocId = orderData.orderDocId;

    const orderPayload = {
      publicOrderId: String(orderData.publicOrderId || ''),
      service: String(service.name || ''),
      serviceId: String(service.id || ''),
      amount: Number(quantity || 0),
      price: Number(priceRub || 0),
      link: String(link || ''),
      status: japOrderId ? '🟡 В обработке' : ('🔴 Ошибка JAP' + (japErrorText ? ': ' + String(japErrorText).slice(0, 80) : '')),
      paymentMethod: 'CryptoBot',
      invoiceId,
      japOrderId: String(japOrderId),
      japError: String(japErrorText || ''),
      paidAt: serverTimestamp()
    };

    if (orderDocId) {
      try { await updateDoc(doc(db, 'orders', orderDocId), orderPayload); }
      catch (e) { await setDoc(doc(db, 'orders', orderDocId), { ...orderPayload, createdAt: serverTimestamp() }, { merge: true }); }
    }

    await sendTelegram(`🔥 Новый оплаченный заказ через CryptoBot\n\nID: ${orderData.publicOrderId || orderDocId || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId || 'Ошибка'}\n\nОтвет JAP:\n${JSON.stringify(japData)}`);
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка CryptoBot webhook:\n${e.message}`); } catch {}
    return res.status(500).json({ error: 'Server error' });
  }
}
