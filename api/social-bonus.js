import { db, handleCors, verifySession, rateLimit } from './_lib/shared.js';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

function getPlatformData(platform) {
  const value = String(platform || '').toLowerCase();
  if (value === 'telegram') return { key: 'telegramBonusClaimed', name: 'Telegram', amount: 2.5 };
  if (value === 'vk') return { key: 'vkBonusClaimed', name: 'VK', amount: 2.5 };
  return null;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();
    const platformData = getPlatformData(req.body?.platform);

    if (!userId || !sessionToken) return res.status(401).json({ error: 'Сначала войдите в аккаунт' });
    if (!platformData) return res.status(400).json({ error: 'Неизвестная соцсеть' });
    if (!rateLimit(`bonus:${userId}`, 5)) return res.status(429).json({ error: 'Слишком много запросов. Подождите минуту.' });

    const userRef = doc(db, 'users', userId);
    let result = null;
    let authError = false;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) { authError = true; return; }
      const user = userSnap.data();
      if (String(user.sessionToken || '') !== sessionToken) { authError = true; return; }

      if (user[platformData.key]) {
        result = { already: true, bonusBalance: Number(user.bonusBalance || 0), message: `Бонус за ${platformData.name} уже был начислен` };
        return;
      }

      const oldBonus = Number(user.bonusBalance || 0);
      const newBonus = Number((oldBonus + platformData.amount).toFixed(2));
      transaction.set(userRef, { bonusBalance: newBonus, [platformData.key]: true, [`${platformData.key}At`]: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      result = { already: false, bonusBalance: newBonus, amount: platformData.amount, message: `Начислено ${platformData.amount}₽ за ${platformData.name}` };
    });

    if (authError) return res.status(401).json({ error: 'Сессия устарела. Войдите заново.' });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
