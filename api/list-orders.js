import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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

function json(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const userId = String(req.body?.userId || '').trim();
    const sessionToken = String(req.body?.sessionToken || '').trim();

    if (!userId || !sessionToken) return json(res, 401, { error: 'Сначала войдите в аккаунт' });

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return json(res, 401, { error: 'Аккаунт не найден' });

    const user = userSnap.data();
    if (String(user.sessionToken || '') !== sessionToken) {
      return json(res, 401, { error: 'Сессия устарела. Войдите заново.' });
    }

    const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId));
    const snap = await getDocs(ordersQuery);
    const orders = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        publicOrderId: data.publicOrderId || '',
        service: data.service || '',
        serviceId: data.serviceId || '',
        amount: Number(data.amount || 0),
        price: Number(data.price || 0),
        spentBonus: Number(data.spentBonus || 0),
        spentBalance: Number(data.spentBalance || 0),
        link: data.link || '',
        status: data.status || '🟡 В обработке',
        paymentMethod: data.paymentMethod || 'Баланс',
        japOrderId: data.japOrderId || '',
        japStatus: data.japStatus || '',
        createdAtMs: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0
      };
    }).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    return json(res, 200, { ok: true, orders });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Server error' });
  }
}
