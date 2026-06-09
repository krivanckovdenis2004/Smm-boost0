import crypto from 'crypto';
import { validateOrderPayload } from './service-catalog.js';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost-905d5.firebaseapp.com',
  projectId: 'smm-boost-905d5',
  storageBucket: 'smm-boost-905d5.firebasestorage.app',
  messagingSenderId: '554912523069',
  appId: '1:554912523069:web:26d405b696b9d45e5edb54',
  measurementId: 'G-E6SRLXZW5V'
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);


const JAP_API_KEY = process.env.JAP_API_KEY || '';

async function sendTelegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text })
  });
}

function generatePublicOrderId() {
  return 'SB-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();

    if (!userId || !sessionToken) return res.status(401).json({ error: 'Сначала войдите в аккаунт' });
    if (!JAP_API_KEY) return res.status(500).json({ error: 'JAP_API_KEY не настроен в Vercel' });

    const validated = await validateOrderPayload(req.body || {});
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const { service, quantity, link, priceRub } = validated;

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return res.status(401).json({ error: 'Аккаунт не найден' });

    const user = userSnap.data();
    if (String(user.sessionToken || '') !== sessionToken) {
      return res.status(401).json({ error: 'Сессия устарела. Войдите заново.' });
    }

    const totalBalance = Number(user.balance || 0) + Number(user.bonusBalance || 0);
    if (totalBalance + 0.001 < priceRub) {
      return res.status(400).json({ error: `Недостаточно средств. Нужно ${priceRub.toFixed(2)}₽` });
    }

    const publicOrderId = generatePublicOrderId();

    // Сначала создаем заказ в JAP. Деньги списываем только после успешного ответа JAP.
    const japController = new AbortController();
    const japTimeout = setTimeout(() => japController.abort(), 25000);
    let japData = {};

    try {
      const japResponse = await fetch('https://justanotherpanel.com/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: japController.signal,
        body: new URLSearchParams({
          key: JAP_API_KEY,
          action: 'add',
          service: String(service.id),
          link,
          quantity: String(quantity)
        })
      });

      const japText = await japResponse.text();
      try { japData = JSON.parse(japText); }
      catch { japData = { error: japText || 'Некорректный ответ JAP' }; }
    } finally {
      clearTimeout(japTimeout);
    }
    const japOrderId = japData.order || japData.id || japData.orderId || '';
    const japErrorText = japData.error || japData.message || japData.description || '';

    if (!japOrderId) {
      await addDoc(collection(db, 'orders'), {
        userId,
        userLogin: String(user.username || user.displayName || user.email || ''),
        publicOrderId,
        service: String(service.name || ''),
        serviceId: String(service.id || ''),
        amount: Number(quantity || 0),
        price: Number(priceRub || 0),
        link: String(link || ''),
        status: '🔴 Ошибка JAP' + (japErrorText ? ': ' + String(japErrorText).slice(0, 80) : ''),
        paymentMethod: 'Баланс',
        japOrderId: '',
        japError: String(japErrorText || ''),
        createdAt: serverTimestamp()
      });
      return res.status(400).json({ error: 'Ошибка JAP: ' + (japErrorText || 'order not created') });
    }

    let spentBonus = 0;
    let spentBalance = 0;

    await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(userRef);
      if (!freshSnap.exists()) throw new Error('Аккаунт не найден');

      const fresh = freshSnap.data();
      if (String(fresh.sessionToken || '') !== sessionToken) throw new Error('Сессия устарела');

      let bonus = Number(fresh.bonusBalance || 0);
      let balance = Number(fresh.balance || 0);

      if (bonus + balance + 0.001 < priceRub) throw new Error('Недостаточно средств');

      spentBonus = Math.min(bonus, priceRub);
      spentBalance = priceRub - spentBonus;

      transaction.set(userRef, {
        bonusBalance: Number((bonus - spentBonus).toFixed(2)),
        balance: Number((balance - spentBalance).toFixed(2)),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    const orderDoc = await addDoc(collection(db, 'orders'), {
      userId,
      userLogin: String(user.username || user.displayName || user.email || ''),
      publicOrderId,
      service: String(service.name || ''),
      serviceId: String(service.id || ''),
      amount: Number(quantity || 0),
      price: Number(priceRub || 0),
      spentBonus: Number(spentBonus.toFixed(2)),
      spentBalance: Number(spentBalance.toFixed(2)),
      link: String(link || ''),
      status: '🟡 В обработке',
      paymentMethod: 'Баланс',
      japOrderId: String(japOrderId),
      paidAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    await sendTelegram(`🔥 Новый заказ с баланса\n\nID: ${publicOrderId}\nЛогин: ${user.username || user.displayName || user.email || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nБонусами: ${spentBonus.toFixed(2)}₽\nБалансом: ${spentBalance.toFixed(2)}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId}`);

    return res.status(200).json({ ok: true, orderDocId: orderDoc.id, publicOrderId, japOrderId });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка заказа с баланса:\n${e.message}`); } catch {}
    return res.status(500).json({ error: e.name === 'AbortError' ? 'JAP долго не отвечает. Попробуйте позже.' : e.message });
  }
}
