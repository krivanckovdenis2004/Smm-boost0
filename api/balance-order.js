import crypto from 'crypto';
import { db, handleCors, verifySession, sendTelegram, getJapKey, rateLimit } from './_lib/shared.js';
import { validateOrderPayload } from './service-catalog.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, collection, addDoc } from 'firebase/firestore';

function generatePublicOrderId() {
  return 'SB-' + crypto.randomUUID().slice(0, 8).toUpperCase();
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();

    if (!rateLimit(`order:${userId}`, 10)) return res.status(429).json({ error: 'Слишком много заказов. Подождите минуту.' });

    const session = await verifySession(db, userId, sessionToken);
    if (!session.ok) return res.status(session.status).json({ error: session.error });

    const japKey = getJapKey();
    if (!japKey) return res.status(500).json({ error: 'JAP_API_KEY не настроен в Vercel' });

    const user = session.user;
    const validated = await validateOrderPayload(req.body || {});
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const { service, quantity, link, priceRub } = validated;
    const totalBalance = Number(user.balance || 0) + Number(user.bonusBalance || 0);
    if (totalBalance + 0.001 < priceRub) return res.status(400).json({ error: `Недостаточно средств. Нужно ${priceRub.toFixed(2)}₽` });

    const publicOrderId = generatePublicOrderId();
    let spentBonus = 0;
    let spentBalance = 0;

    try {
      await runTransaction(db, async (transaction) => {
        const freshSnap = await transaction.get(session.userRef);
        if (!freshSnap.exists()) throw new Error('Аккаунт не найден');
        const fresh = freshSnap.data();
        if (String(fresh.sessionToken || '') !== sessionToken) throw new Error('Сессия устарела');
        let bonus = Number(fresh.bonusBalance || 0);
        let balance = Number(fresh.balance || 0);
        if (bonus + balance + 0.001 < priceRub) throw new Error('Недостаточно средств');
        spentBonus = Math.min(bonus, priceRub);
        spentBalance = priceRub - spentBonus;
        transaction.set(session.userRef, { bonusBalance: Number((bonus - spentBonus).toFixed(2)), balance: Number((balance - spentBalance).toFixed(2)), updatedAt: serverTimestamp() }, { merge: true });
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const japController = new AbortController();
    const japTimeout = setTimeout(() => japController.abort(), 25000);
    let japData = {};

    try {
      const japResponse = await fetch('https://justanotherpanel.com/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: japController.signal,
        body: new URLSearchParams({ key: japKey, action: 'add', service: String(service.id), link, quantity: String(quantity) })
      });
      const japText = await japResponse.text();
      try { japData = JSON.parse(japText); }
      catch { japData = { error: japText || 'Некорректный ответ JAP' }; }
    } finally { clearTimeout(japTimeout); }

    const japOrderId = japData.order || japData.id || japData.orderId || '';
    const japErrorText = japData.error || japData.message || japData.description || '';

    if (!japOrderId) {
      try {
        await runTransaction(db, async (transaction) => {
          const freshSnap = await transaction.get(session.userRef);
          if (!freshSnap.exists()) return;
          const fresh = freshSnap.data();
          transaction.set(session.userRef, { bonusBalance: Number((Number(fresh.bonusBalance || 0) + spentBonus).toFixed(2)), balance: Number((Number(fresh.balance || 0) + spentBalance).toFixed(2)), updatedAt: serverTimestamp() }, { merge: true });
        });
      } catch (refundErr) { console.error('Refund error:', refundErr.message); }

      await addDoc(collection(db, 'orders'), {
        userId, userLogin: String(user.username || user.displayName || user.email || ''),
        publicOrderId, service: String(service.name || ''), serviceId: String(service.id || ''),
        amount: Number(quantity || 0), price: Number(priceRub || 0), link: String(link || ''),
        status: '🔴 Ошибка JAP' + (japErrorText ? ': ' + String(japErrorText).slice(0, 80) : ''),
        paymentMethod: 'Баланс', japOrderId: '', japError: String(japErrorText || ''), createdAt: serverTimestamp()
      });
      return res.status(400).json({ error: 'Ошибка JAP: ' + (japErrorText || 'order not created') });
    }

    const orderDoc = await addDoc(collection(db, 'orders'), {
      userId, userLogin: String(user.username || user.displayName || user.email || ''),
      publicOrderId, service: String(service.name || ''), serviceId: String(service.id || ''),
      amount: Number(quantity || 0), price: Number(priceRub || 0),
      spentBonus: Number(spentBonus.toFixed(2)), spentBalance: Number(spentBalance.toFixed(2)),
      link: String(link || ''), status: '🟡 В обработке', paymentMethod: 'Баланс',
      japOrderId: String(japOrderId), paidAt: serverTimestamp(), createdAt: serverTimestamp()
    });

    await sendTelegram(`🔥 Новый заказ с баланса\n\nID: ${publicOrderId}\nЛогин: ${user.username || user.displayName || user.email || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nБонусами: ${spentBonus.toFixed(2)}₽\nБалансом: ${spentBalance.toFixed(2)}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId}`);
    return res.status(200).json({ ok: true, orderDocId: orderDoc.id, publicOrderId, japOrderId });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка заказа с баланса:\n${e.message}`); } catch {}
    return res.status(500).json({ error: e.name === 'AbortError' ? 'JAP долго не отвечает. Попробуйте позже.' : 'Server error' });
  }
}
