import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { validateOrderPayload } from './service-catalog.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8',
  authDomain: 'smm-boost.pro',
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

async function verifyYooKassaPayment(paymentId) {
  if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
    throw new Error('YooKassa credentials are not configured');
  }

  const auth = Buffer.from(
    process.env.YOOKASSA_SHOP_ID + ':' + process.env.YOOKASSA_SECRET_KEY
  ).toString('base64');

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: 'Basic ' + auth }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.description || data.error || 'Cannot verify YooKassa payment');
  }

  if (data.status !== 'succeeded' || data.paid !== true) {
    throw new Error('YooKassa payment is not succeeded/paid');
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    if (event.event !== 'payment.succeeded' || !event.object || event.object.status !== 'succeeded') {
      return res.status(200).json({ success: true, skipped: true });
    }

    const eventPayment = event.object;
    const verifiedPayment = await verifyYooKassaPayment(eventPayment.id);
    const orderData = verifiedPayment.metadata || eventPayment.metadata || {};

    
    if (String(orderData.type || '') === 'vpn_order') {
      await sendTelegram(`🛡 Новый заказ VPN\n\nTelegram: ${orderData.telegram || '-'}\nСумма: 129₽\nPayment ID: ${verifiedPayment.id}`);
      return res.status(200).json({ success: true, vpn: true });
    }

if (String(orderData.type || '') === 'balance_topup') {
      const userId = String(orderData.userId || '');
      const login = String(orderData.login || orderData.email || '');
      const amountRub = Number(orderData.amountRub || verifiedPayment.amount?.value || 0);
      const paidAmount = Number(verifiedPayment.amount?.value || 0);

      if (!userId || !login || !Number.isFinite(amountRub) || amountRub < 1) {
        throw new Error('Invalid balance topup metadata');
      }

      if (paidAmount + 0.001 < amountRub) {
        throw new Error(`Paid amount is too low. Paid: ${paidAmount}, required: ${amountRub}`);
      }

      const userRef = doc(db, 'users', userId);
      const topupRef = doc(db, 'topups', String(verifiedPayment.id));

      console.log('[YK-WEBHOOK] STEP 0: start topup transaction', { userId, paymentId: verifiedPayment.id, amountRub });

      // Быстрая идемпотентность до транзакции: если документ уже существует —
      // платёж уже начислен, никаких изменений баланса и Telegram.
      try {
        const preSnap = await getDoc(topupRef);
        if (preSnap.exists()) {
          console.log('[YK-WEBHOOK] PRE-CHECK: topup already exists, skipping', verifiedPayment.id);
          return res.status(200).json({ success: true, topup: true, duplicate: true });
        }
      } catch (preErr) {
        console.warn('[YK-WEBHOOK] PRE-CHECK failed (continue to tx):', preErr && preErr.message);
      }

      // Идемпотентность: один payment.id — одно начисление.
      // Внутри транзакции проверяем ЛЮБОЕ существование topups/{paymentId},
      // а не только status=='paid', и создаём документ атомарно (без merge),
      // чтобы повторная доставка webhook гарантированно упала на конфликте.
      let currentStep = 'init';
      let alreadyProcessed = false;
      try {
        alreadyProcessed = await runTransaction(db, async (tx) => {
          currentStep = 'STEP 1: tx.get(topups/' + verifiedPayment.id + ')';
          console.log('[YK-WEBHOOK]', currentStep);
          const topupSnap = await tx.get(topupRef);
          if (topupSnap.exists()) {
            console.log('[YK-WEBHOOK] STEP 1a: topup already exists, skipping');
            return true;
          }

          currentStep = 'STEP 2: tx.get(users/' + userId + ')';
          console.log('[YK-WEBHOOK]', currentStep);
          const userSnap = await tx.get(userRef);
          const oldBalance = userSnap.exists() ? Number(userSnap.data().balance || 0) : 0;
          console.log('[YK-WEBHOOK] STEP 2a: user exists=', userSnap.exists(), ' oldBalance=', oldBalance);

          currentStep = 'STEP 3: tx.set(topups/' + verifiedPayment.id + ') create (atomic marker)';
          console.log('[YK-WEBHOOK]', currentStep);
          // Создаём маркер БЕЗ merge — при гонке второй transaction увидит
          // существующий документ на retry и вернёт alreadyProcessed=true.
          tx.set(topupRef, {
            userId,
            login,
            amount: amountRub,
            paymentMethod: 'ЮKassa',
            paymentId: String(verifiedPayment.id || ''),
            status: 'paid',
            createdAt: serverTimestamp()
          });

          currentStep = 'STEP 4: tx.set(users/' + userId + ') balance update';
          console.log('[YK-WEBHOOK]', currentStep);
          tx.set(userRef, {
            userId,
            login,
            balance: Number((oldBalance + amountRub).toFixed(2)),
            updatedAt: serverTimestamp()
          }, { merge: true });

          currentStep = 'STEP 5: transaction commit';
          console.log('[YK-WEBHOOK]', currentStep);
          return false;
        });
        console.log('[YK-WEBHOOK] STEP 6: transaction OK, alreadyProcessed=', alreadyProcessed);
      } catch (txErr) {
        console.error('[YK-WEBHOOK] FAIL at', currentStep, '->', txErr && txErr.code, txErr && txErr.message);
        throw new Error('Firestore failed at ' + currentStep + ': ' + (txErr && txErr.message ? txErr.message : String(txErr)));
      }

      if (alreadyProcessed) {
        return res.status(200).json({ success: true, topup: true, duplicate: true });
      }

      // Реферальный бонус: 10% пополнения зачисляем пригласившему.
      try {
        const userSnap2 = await getDoc(userRef);
        const referredBy = userSnap2.exists() ? String(userSnap2.data().referredBy || '') : '';
        if (/^[0-9a-f]{32}$/.test(referredBy)) {
          const refRef = doc(db, 'users', referredBy);
          const refSnap = await getDoc(refRef);
          if (refSnap.exists()) {
            const commission = Number((amountRub * 0.1).toFixed(2));
            const prevBonus = Number(refSnap.data().bonusBalance || 0);
            const prevEarned = Number(refSnap.data().referralEarned || 0);
            await setDoc(refRef, {
              bonusBalance: Number((prevBonus + commission).toFixed(2)),
              referralEarned: Number((prevEarned + commission).toFixed(2)),
              updatedAt: serverTimestamp()
            }, { merge: true });
            await sendTelegram(`🎉 Реферальный бонус ${commission}₽ начислен пользователю ${refSnap.data().username || referredBy} за пополнение ${login}`);
          }
        }
      } catch (refErr) {
        console.warn('[YK-WEBHOOK] referral bonus failed', refErr?.message);
      }

      await sendTelegram(`💰 Пополнение баланса через ЮKassa\n\nЛогин: ${login}\nСумма: ${amountRub}₽\nPayment ID: ${verifiedPayment.id}`);
      return res.status(200).json({ success: true, topup: true });
    }

    const validated = await validateOrderPayload(orderData);
    if (!validated.ok) {
      throw new Error(validated.error);
    }

    const { service, quantity, link, priceRub } = validated;
    const paidAmount = Number(verifiedPayment.amount?.value || 0);
    if (paidAmount + 0.001 < priceRub) {
      throw new Error(`Paid amount is too low. Paid: ${paidAmount}, required: ${priceRub}`);
    }

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
      try {
        await updateDoc(doc(db, 'orders', orderDocId), orderPayload);
      } catch (e) {
        await setDoc(doc(db, 'orders', orderDocId), { ...orderPayload, createdAt: serverTimestamp() }, { merge: true });
      }
    }

    await sendTelegram(`🔥 Новый оплаченный заказ через ЮKassa\n\nID: ${orderData.publicOrderId || orderDocId || '—'}\nУслуга: ${service.name}\nКоличество: ${quantity}\nСумма: ${priceRub}₽\nСсылка: ${link}\n\nJAP ID:\n${japOrderId || 'Ошибка'}\n\nОтвет JAP:\n${JSON.stringify(japData)}`);

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка YooKassa webhook:\n${e.message}`); } catch {}
    return res.status(500).json({ error: e.message });
  }
}
