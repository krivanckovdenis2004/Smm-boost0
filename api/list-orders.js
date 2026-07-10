import { db, handleCors, verifySession } from './_lib/shared.js';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

function json(res, status, payload) { return res.status(status).json(payload); }

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();

    const session = await verifySession(db, userId, sessionToken);
    if (!session.ok) return json(res, session.status, { error: session.error });

    const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(ordersQuery);

    const orders = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id, publicOrderId: data.publicOrderId || '', service: data.service || '',
        serviceId: data.serviceId || '', amount: Number(data.amount || 0), price: Number(data.price || 0),
        spentBonus: Number(data.spentBonus || 0), spentBalance: Number(data.spentBalance || 0),
        link: data.link || '', status: data.status || '🟡 В обработке',
        paymentMethod: data.paymentMethod || 'Баланс', japOrderId: data.japOrderId || '',
        japStatus: data.japStatus || '',
        createdAtMs: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0
      };
    });

    return json(res, 200, { ok: true, orders });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Server error' });
  }
}
