import { validateOrderPayload } from './service-catalog.js';
import { db, resolveAuthedUser } from './_lib/shared.js';
import { AdminFieldValue, getFirebaseAdminDb } from './_lib/firebase-admin.js';

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
    const requestId = String(req.body?.requestId || '').trim().slice(0, 80);
    if (!JAP_API_KEY) return res.status(500).json({ error: 'JAP_API_KEY не настроен в Vercel' });

    const adminDb = getFirebaseAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'Firebase Admin SDK не настроен (FIREBASE_SERVICE_ACCOUNT)' });
    const adminTs = () => AdminFieldValue.serverTimestamp();

    const authed = await resolveAuthedUser(db, req);
    if (!authed.ok) return res.status(authed.status || 401).json({ error: authed.error });
    const { userId, user, source } = authed;
    const userRef = adminDb.collection('users').doc(userId);

    // Идемпотентность: если клиент прислал requestId, кладём маркер в Firestore.
    // Повторный вызов с тем же requestId вернёт уже созданный заказ.
    if (requestId) {
      const reqRef = adminDb.collection('order_requests').doc(`${userId}_${requestId}`);
      const reqSnap = await reqRef.get();
      if (reqSnap.exists) {
        const cached = reqSnap.data();
        if (cached.status === 'done') {
          return res.status(200).json({ ok: true, cached: true, orderDocId: cached.orderDocId, publicOrderId: cached.publicOrderId, japOrderId: cached.japOrderId });
        }
        if (cached.status === 'processing') {
          return res.status(429).json({ error: 'Заказ уже обрабатывается, подождите пару секунд.' });
        }
      }
      await reqRef.set({ userId, status: 'processing', createdAt: adminTs() }, { merge: true });
    }

    const validated = await validateOrderPayload(req.body || {});
    if (!validated.ok) return res.status(400).json({ error: validated.error });

    const { service, quantity, link, priceRub } = validated;

    const totalBalance = Number(user.balance || 0) + Number(user.bonusBalance || 0);
    if (totalBalance + 0.001 < priceRub) {
      return res.status(400).json({ error: `Недостаточно средств. Нужно ${priceRub.toFixed(2)}₽` });
    }

    const publicOrderId = generatePublicOrderId();

    // Сначала создаем заказ в JAP. Деньги списываем только после успешного ответа JAP.
    const japController = new AbortController();
    const japTimeout = setTimeout(() => japController.abort(), 8000);
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
      await adminDb.collection('orders').add({
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
        createdAt: adminTs()
      });
      return res.status(400).json({ error: 'Ошибка JAP: ' + (japErrorText || 'order not created') });
    }

    let spentBonus = 0;
    let spentBalance = 0;

    await adminDb.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(userRef);
      if (!freshSnap.exists) throw new Error('Аккаунт не найден');

      const fresh = freshSnap.data();
      // Для firebase-source сессия уже подтверждена через ID Token; для legacy — сверяем токен.
      if (source === 'legacy' && String(fresh.sessionToken || '') !== String(req.body?.sessionToken || '').trim()) {
        throw new Error('Сессия устарела');
      }

      let bonus = Number(fresh.bonusBalance || 0);
      let balance = Number(fresh.balance || 0);

      if (bonus + balance + 0.001 < priceRub) throw new Error('Недостаточно средств');

      spentBonus = Math.min(bonus, priceRub);
      spentBalance = priceRub - spentBonus;

      transaction.set(userRef, {
        bonusBalance: Number((bonus - spentBonus).toFixed(2)),
        balance: Number((balance - spentBalance).toFixed(2)),
        updatedAt: adminTs()
      }, { merge: true });
    });

    const orderDoc = await adminDb.collection('orders').add({
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
      paidAt: adminTs(),
      createdAt: adminTs()
    });

    await sendTelegram(`🔥 Новый заказ с баланса\n\nID: ${publicOrderId}\nЛогин: ${user.username || user.displayName || user.email || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nБонусами: ${spentBonus.toFixed(2)}₽\nБалансом: ${spentBalance.toFixed(2)}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId}`);

    if (requestId) {
      try {
        await adminDb.collection('order_requests').doc(`${userId}_${requestId}`).set({
          userId,
          status: 'done',
          orderDocId: orderDoc.id,
          publicOrderId,
          japOrderId: String(japOrderId),
          completedAt: adminTs()
        }, { merge: true });
      } catch (e) { /* не критично */ }
    }

    return res.status(200).json({ ok: true, orderDocId: orderDoc.id, publicOrderId, japOrderId });
  } catch (e) {
    console.error('[BALANCE-ORDER] FAIL:', e && e.code, e && e.message, e && e.stack);
    try { await sendTelegram(`❌ Ошибка заказа с баланса:\n${e.message}`); } catch {}
    return res.status(500).json({ error: (e.name === 'AbortError' || /aborted/i.test(e.message || '')) ? 'Сервис долго не отвечает. Попробуйте ещё раз.' : e.message });
  }
}
