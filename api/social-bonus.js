import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

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

function getPlatformData(platform) {
  const value = String(platform || '').toLowerCase();

  if (value === 'telegram') {
    return { key: 'telegramBonusClaimed', name: 'Telegram', amount: 2.5 };
  }

  if (value === 'vk') {
    return { key: 'vkBonusClaimed', name: 'VK', amount: 2.5 };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();
    const platformData = getPlatformData(req.body?.platform);

    if (!userId || !sessionToken) {
      return res.status(401).json({ error: 'Сначала войдите в аккаунт' });
    }

    if (!platformData) {
      return res.status(400).json({ error: 'Неизвестная соцсеть' });
    }

    const userRef = doc(db, 'users', userId);
    let result = null;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) {
        throw new Error('Аккаунт не найден');
      }

      const user = userSnap.data();

      if (String(user.sessionToken || '') !== sessionToken) {
        throw new Error('Сессия устарела. Войдите заново.');
      }

      if (user[platformData.key]) {
        result = {
          already: true,
          bonusBalance: Number(user.bonusBalance || 0),
          message: `Бонус за ${platformData.name} уже был начислен`
        };
        return;
      }

      const oldBonus = Number(user.bonusBalance || 0);
      const newBonus = Number((oldBonus + platformData.amount).toFixed(2));

      transaction.set(userRef, {
        bonusBalance: newBonus,
        [platformData.key]: true,
        [`${platformData.key}At`]: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      result = {
        already: false,
        bonusBalance: newBonus,
        amount: platformData.amount,
        message: `Начислено ${platformData.amount}₽ за ${platformData.name}`
      };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
