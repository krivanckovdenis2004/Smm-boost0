import { db, handleCors, sendTelegram, getJapKey } from './_lib/shared.js';
import { doc, updateDoc, setDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import { validateOrderPayload } from './service-catalog.js';

async function verifyYooKassaPayment(paymentId) {
  if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) throw new Error('YooKassa credentials are not configured');
  const auth = Buffer.from(process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY).toString('base64');
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: 'Basic ' + auth }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.description || data.error || 'Cannot verify YooKassa payment');
  if (data.status !== 'succeeded' || data.paid !== true) throw new Error('YooKassa payment is not succeeded/paid');
  return data;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;
    if (event.event !== 'payment.succeeded' || !event.object || event.object.status !== 'succeeded') return res.status(200).json({ success: true, skipped: true });

    const eventPayment = event.object;
    const verifiedPayment = await verifyYooKassaPayment(eventPayment.id);
    const orderData = verifiedPayment.metadata || {};

    // Replay protection
    const topupRef = doc(db, 'topups', String(verifiedPayment.id));
    const existingTopup = await getDoc(topupRef);
    if (existingTopup.exists()) return res.status(200).json({ success: true, alreadyProcessed: true });

    if (String(orderData.type || '') === 'vpn_order') {
      await setDoc(topupRef, { type: 'vpn_order', telegram: String(orderData.telegram || ''), amount: Number(verifiedPayment.amount?.value || 129), paymentMethod: 'ЮKassa', paymentId: String(verifiedPayment.id || ''), status: 'paid', createdAt: serverTimestamp() }, { merge: true });
      await sendTelegram(`🛡 Новый заказ VPN\n\nTelegram: ${orderData.telegram || '-'}\nСумма: ${verifiedPayment.amount?.value || 129}₽\nPayment ID: ${verifiedPayment.id}`);
      return res.status(200).json({ success: true, vpn: true });
    }

    if (String(orderData.type || '') === 'balance_topup') {
      const userId = String(orderData.userId || '');
      const login = String(orderData.login || orderData.email || '');
      const amountRub = Number(verifiedPayment.amount?.value || 0);
      const paidAmount = Number(verifiedPayment.amount?.value || 0);

      if (!userId || !login || !Number.isFinite(amountRub) || amountRub < 1) throw new Error('Invalid balance topup metadata');
      if (paidAmount + 0.001 < amountRub) throw new Error(`Paid amount mismatch. Paid: ${paidAmount}, required: ${amountRub}`);

      const userRef = doc(db, 'users', userId);
      await setDoc(topupRef, { userId, login, amount: amountRub, paymentMethod: 'ЮKassa', paymentId: String(verifiedPayment.id || ''), status: 'paid', createdAt: serverTimestamp() });
      await updateDoc(userRef, { balance: increment(amountRub), updatedAt: serverTimestamp() });

      await sendTelegram(`💰 Пополнение баланса через ЮKassa\n\nЛогин: ${login}\nСумма: ${amountRub}₽\nPayment ID: ${verifiedPayment.id}`);
      return res.status(200).json({ success: true, topup: true });
    }

    const validated = await validateOrderPayload(orderData);
    if (!validated.ok) throw new Error(validated.error);

    const { service, quantity, link, priceRub } = validated;
    const paidAmount = Number(verifiedPayment.amount?.value || 0);
    if (paidAmount + 0.001 < priceRub) throw new Error(`Paid amount too low. Paid: ${paidAmount}, required: ${priceRub}`);

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
      paymentMethod: 'ЮKassa',
      paymentId: String(verifiedPayment.id || ''),
      japOrderId: String(japOrderId),
      japError: String(japErrorText || ''),
      paidAt: serverTimestamp()
    };

    if (orderDocId) {
      try { await updateDoc(doc(db, 'orders', orderDocId), orderPayload); }
      catch (e) { await setDoc(doc(db, 'orders', orderDocId), { ...orderPayload, createdAt: serverTimestamp() }, { merge: true }); }
    }

    await setDoc(topupRef, { type: 'order', paymentId: String(verifiedPayment.id || ''), status: 'paid', createdAt: serverTimestamp() }, { merge: true });

    await sendTelegram(`🔥 Новый оплаченный заказ через ЮKassa\n\nID: ${orderData.publicOrderId || orderDocId || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId || 'Ошибка'}\n\nОтвет JAP:\n${JSON.stringify(japData)}`);
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка YooKassa webhook:\n${e.message}`); } catch {}
    return res.status(500).json({ error: 'Server error' });
  }
}
