import crypto from 'crypto';
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


function normEmail(email='') {
  return String(email).trim().toLowerCase();
}

function uidFromEmail(email) {
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
}

function hashCode(email, code) {
  return crypto.createHash('sha256').update(email + ':' + code + ':' + (process.env.AUTH_CODE_SECRET || 'smm-boost-secret')).digest('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const email = normEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    if (!email || !code) return res.status(400).json({ error: 'Введите email и код' });

    const codeRef = doc(db, 'authCodes', email);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) return res.status(400).json({ error: 'Код не найден. Запросите новый код.' });

    const codeData = codeSnap.data();
    if (Date.now() > Number(codeData.expiresAt || 0)) {
      return res.status(400).json({ error: 'Код устарел. Запросите новый код.' });
    }

    if (Number(codeData.attempts || 0) >= 5) {
      return res.status(429).json({ error: 'Слишком много попыток. Запросите новый код.' });
    }

    const ok = codeData.codeHash === hashCode(email, code);
    if (!ok) {
      await updateDoc(codeRef, { attempts: Number(codeData.attempts || 0) + 1 });
      return res.status(400).json({ error: 'Неверный код' });
    }

    const userId = uidFromEmail(email);
    const token = newToken();
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let user;

    if (!userSnap.exists()) {
      user = {
        userId,
        email,
        balance: 0,
        bonusBalance: 70,
        registrationBonus: 70,
        sessionToken: token,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, user);
    } else {
      const old = userSnap.data();
      user = {
        userId,
        email,
        balance: Number(old.balance || 0),
        bonusBalance: Number(old.bonusBalance || 0),
        registrationBonus: Number(old.registrationBonus || 0),
        sessionToken: token,
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, user, { merge: true });
    }

    await setDoc(codeRef, { usedAt: serverTimestamp(), codeHash: '' }, { merge: true });

    return res.status(200).json({
      ok: true,
      user: {
        userId,
        email,
        balance: Number(user.balance || 0),
        bonusBalance: Number(user.bonusBalance || 0),
        sessionToken: token
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
