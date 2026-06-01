import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

function cleanLogin(value = '') {
  return String(value).trim().replace(/^https?:\/\//i, '').slice(0, 80);
}

function normalizePlatform(platform = '') {
  const value = String(platform).trim().toLowerCase();
  return ['telegram', 'vk'].includes(value) ? value : '';
}

function uidFromSocial(platform, socialLogin) {
  return crypto.createHash('sha256').update(`${platform}:${socialLogin.toLowerCase()}`).digest('hex').slice(0, 32);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const platform = normalizePlatform(req.body?.platform);
    const socialLogin = cleanLogin(req.body?.socialLogin);

    if (!platform) return res.status(400).json({ error: 'Выберите Telegram или VK' });
    if (!socialLogin) return res.status(400).json({ error: 'Введите любой Telegram/VK username или ID' });

    const userId = uidFromSocial(platform, socialLogin);
    const sessionToken = newToken();
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    let user;
    if (!userSnap.exists()) {
      user = {
        userId,
        socialPlatform: platform,
        socialLogin,
        displayName: `${platform === 'telegram' ? 'Telegram' : 'VK'}: ${socialLogin}`,
        email: `${platform}_${userId}@smmboost.local`,
        balance: 0,
        bonusBalance: 70,
        registrationBonus: 70,
        sessionToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, user);
    } else {
      const old = userSnap.data();
      user = {
        userId,
        socialPlatform: old.socialPlatform || platform,
        socialLogin: old.socialLogin || socialLogin,
        displayName: old.displayName || `${platform === 'telegram' ? 'Telegram' : 'VK'}: ${socialLogin}`,
        email: old.email || `${platform}_${userId}@smmboost.local`,
        balance: Number(old.balance || 0),
        bonusBalance: Number(old.bonusBalance || 0),
        registrationBonus: Number(old.registrationBonus || 0),
        telegramBonusClaimed: Boolean(old.telegramBonusClaimed),
        vkBonusClaimed: Boolean(old.vkBonusClaimed),
        sessionToken,
        updatedAt: serverTimestamp()
      };
      await setDoc(userRef, user, { merge: true });
    }

    return res.status(200).json({
      ok: true,
      user: {
        userId,
        socialPlatform: user.socialPlatform,
        socialLogin: user.socialLogin,
        displayName: user.displayName,
        email: user.email,
        balance: Number(user.balance || 0),
        bonusBalance: Number(user.bonusBalance || 0),
        sessionToken
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
