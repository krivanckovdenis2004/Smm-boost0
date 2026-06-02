import { initializeApp, getApps } from "firebase/app";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost-905d5.firebaseapp.com",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54",
  measurementId: "G-E6SRLXZW5V"
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateProgress(quantity, remains, fallback) {
  const total = Number(quantity || 0);
  const left = Number(remains);

  if (total > 0 && Number.isFinite(left)) {
    return clamp(Math.round(((total - left) / total) * 100), 5, 100);
  }

  return fallback;
}

function mapJapStatus(japStatus, quantity, remains) {
  const raw = String(japStatus || '').toLowerCase();

  if (raw.includes('complete')) {
    return {
      status: '🟢 Выполнено',
      progress: 100
    };
  }

  if (raw.includes('partial')) {
    return {
      status: '🟠 Частично выполнено',
      progress: calculateProgress(quantity, remains, 80)
    };
  }

  if (raw.includes('cancel')) {
    return {
      status: '🔴 Отменено',
      progress: 100
    };
  }

  if (raw.includes('pending')) {
    return {
      status: '🕓 Ожидает запуска',
      progress: 15
    };
  }

  if (raw.includes('process') || raw.includes('progress')) {
    return {
      status: '🟡 В обработке',
      progress: calculateProgress(quantity, remains, 60)
    };
  }

  return {
    status: '🟡 В обработке',
    progress: calculateProgress(quantity, remains, 50)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const orderDocId =
      req.method === 'GET'
        ? req.query.orderDocId
        : req.body.orderDocId;

    if (!orderDocId) {
      return res.status(400).json({
        error: 'orderDocId is required'
      });
    }

    const orderRef = doc(db, 'orders', String(orderDocId));
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const order = orderSnap.data();

    if (!order.japOrderId) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'No JAP order id yet'
      });
    }

    const japResponse = await fetch(
      'https://justanotherpanel.com/api/v2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY || '0561e44b45942392a866871516ab7036',
          action: 'status',
          order: String(order.japOrderId)
        })
      }
    );

    const japData = await japResponse.json();

    if (japData.error) {
      return res.status(200).json({
        success: false,
        error: japData.error,
        japData
      });
    }

    const mapped = mapJapStatus(
      japData.status,
      order.amount,
      japData.remains
    );

    await updateDoc(orderRef, {
      status: mapped.status,
      progress: mapped.progress,
      japStatus: String(japData.status || ''),
      remains: Number(japData.remains || 0),
      startCount: String(japData.start_count || ''),
      checkedAt: serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      status: mapped.status,
      progress: mapped.progress,
      japData
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: e.message
    });
  }
}
