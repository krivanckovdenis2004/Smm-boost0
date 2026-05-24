import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { validateOrderPayload } from './service-catalog.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost-905d5.firebaseapp.com',
  projectId: 'smm-boost-905d5',
  storageBucket: 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: '554912523069',
  appId: '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: 'G-E6SRLXZW5V'
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const JAP_API_KEY = process.env.JAP_API_KEY || '0561e44b45942392a866871516ab7036';

async function sendTelegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text })
  });
}

async function verifyCryptoBotInvoice(invoiceId) {
  if (!process.env.CRYPTOBOT_TOKEN) {
    throw new Error('CryptoBot token is not configured');
  }

  const response = await fetch('https://pay.crypt.bot/api/getInvoices', {
    method: 'POST',
    headers: {
      'Crypto-Pay-API-Token': process.env.CRYPTOBOT_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ invoice_ids: String(invoiceId) })
  });

  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || data.error || 'Cannot verify CryptoBot invoice');
  }

  const invoice = Array.isArray(data.result?.items) ? data.result.items[0] : null;
  if (!invoice || invoice.status !== 'paid') {
    throw new Error('CryptoBot invoice is not paid');
  }

  return invoice;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    if (update.update_type !== 'invoice_paid' || !update.payload) {
      return res.status(200).json({ success: true, skipped: true });
    }

    const eventInvoice = update.payload;
    const verifiedInvoice = await verifyCryptoBotInvoice(eventInvoice.invoice_id);
    const orderData = JSON.parse(verifiedInvoice.payload || eventInvoice.payload || '{}');

    const validated = validateOrderPayload(orderData);
    if (!validated.ok) {
      throw new Error(validated.error);
    }

    const { service, quantity, link, priceRub } = validated;

    const japResponse = await fetch('https://justanotherpanel.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: JAP_API_KEY,
        action: 'add',
        service: String(service.id),
        link,
        quantity: String(quantity)
      })
    });

    const japData = await japResponse.json();
    const japOrderId = japData.order || japData.id || japData.orderId || '';
    const orderDocId = orderData.orderDocId;

    const orderPayload = {
      publicOrderId: String(orderData.publicOrderId || ''),
      service: String(service.name || ''),
      serviceId: String(service.id || ''),
      amount: Number(quantity || 0),
      price: Number(priceRub || 0),
      link: String(link || ''),
      status: japOrderId ? '🟡 В обработке' : '🔴 Ошибка JAP',
      paymentMethod: 'CryptoBot',
      invoiceId: String(verifiedInvoice.invoice_id || ''),
      japOrderId: String(japOrderId),
      paidAt: serverTimestamp()
    };

    if (orderDocId) {
      try {
        await updateDoc(doc(db, 'orders', orderDocId), orderPayload);
      } catch (e) {
        await setDoc(doc(db, 'orders', orderDocId), { ...orderPayload, createdAt: serverTimestamp() }, { merge: true });
      }
    }

    await sendTelegram(`🔥 Новый оплаченный заказ через CryptoBot\n\nID: ${orderData.publicOrderId || orderDocId || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId || 'Ошибка'}\n\nОтвет JAP:\n${JSON.stringify(japData)}`);

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка CryptoBot webhook:\n${e.message}`); } catch {}
    return res.status(500).json({ error: e.message });
  }
}
