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

function hashCode(email, code) {
  return crypto.createHash('sha256').update(email + ':' + code + ':' + (process.env.AUTH_CODE_SECRET || 'smm-boost-secret')).digest('hex');
}

async function sendEmail(email, code) {
  const subject = 'Код входа SMM-BOOST';
  const html = `
    <div style="font-family:Arial,sans-serif;background:#080716;color:#fff;padding:24px;border-radius:18px">
      <h2>SMM-BOOST</h2>
      <p>Ваш код подтверждения:</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#15122b;padding:16px;border-radius:14px;text-align:center">${code}</div>
      <p style="color:#aaa">Код действует 10 минут.</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.');
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html
    })
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.message || data.error || 'Cannot send email');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const email = normEmail(req.body?.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await setDoc(doc(db, 'authCodes', email), {
      email,
      codeHash: hashCode(email, code),
      expiresAt,
      attempts: 0,
      createdAt: serverTimestamp()
    }, { merge: true });

    await sendEmail(email, code);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
