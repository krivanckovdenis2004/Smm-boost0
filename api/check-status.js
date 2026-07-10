import { db, handleCors, verifySession, getJapKey } from './_lib/shared.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function calculateProgress(quantity, remains, fallback) {
  const total = Number(quantity || 0);
  const left = Number(remains);
  if (total > 0 && Number.isFinite(left)) return clamp(Math.round(((total - left) / total) * 100), 5, 100);
  return fallback;
}

function mapJapStatus(japStatus, quantity, remains) {
  const raw = String(japStatus || '').toLowerCase();
  if (raw.includes('complete')) return { status: '🟢 Выполнено', progress: 100 };
  if (raw.includes('partial')) return { status: '🟠 Частично выполнено', progress: calculateProgress(quantity, remains, 80) };
  if (raw.includes('cancel')) return { status: '🔴 Отменено', progress: 100 };
  if (raw.includes('pending')) return { status: '🕓 Ожидает запуска', progress: 15 };
  if (raw.includes('process') || raw.includes('progress')) return { status: '🟡 В обработке', progress: calculateProgress(quantity, remains, 60) };
  return { status: '🟡 В обработке', progress: calculateProgress(quantity, remains, 50) };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const orderDocId = req.method === 'GET' ? req.query.orderDocId : req.body.orderDocId;
    if (!orderDocId) return res.status(400).json({ error: 'orderDocId is required' });

    const userId = String(req.query.userId || req.body?.userId || '').trim();
    const sessionToken = String(req.query.sessionToken || req.body?.sessionToken || '').trim();
    const session = await verifySession(db, userId, sessionToken);
    if (!session.ok) return res.status(session.status).json({ error: session.error });

    const orderRef = doc(db, 'orders', String(orderDocId));
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return res.status(404).json({ error: 'Order not found' });

    const order = orderSnap.data();
    if (String(order.userId || '') !== String(userId).trim()) return res.status(403).json({ error: 'Access denied' });

    if (!order.japOrderId) return res.status(200).json({ success: true, skipped: true, reason: 'No JAP order id yet' });

    const japKey = getJapKey();
    if (!japKey) return res.status(500).json({ error: 'JAP_API_KEY not configured' });

    const japResponse = await fetch('https://justanotherpanel.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: japKey, action: 'status', order: String(order.japOrderId) })
    });

    const japData = await japResponse.json();
    if (japData.error) return res.status(200).json({ success: false, error: japData.error, japData });

    const mapped = mapJapStatus(japData.status, order.amount, japData.remains);
    await updateDoc(orderRef, {
      status: mapped.status, progress: mapped.progress,
      japStatus: String(japData.status || ''), remains: Number(japData.remains || 0),
      startCount: String(japData.start_count || ''), checkedAt: serverTimestamp()
    });

    return res.status(200).json({ success: true, status: mapped.status, progress: mapped.progress, japData });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
