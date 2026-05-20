import { initializeApp } from "firebase/app";

import {
  getFirestore,
  doc,
  updateDoc,
  setDoc,
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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const event = req.body;

    if (
      event.event !== "payment.succeeded" ||
      !event.object ||
      event.object.status !== "succeeded"
    ) {
      return res.status(200).json({
        success: true
      });
    }

    const payment = event.object;
    const orderData = payment.metadata || {};

    const japService = orderData.serviceId;

    if (!japService) {
      throw new Error("Unknown service");
    }

    const japResponse = await fetch(
      "https://justanotherpanel.com/api/v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY,
          action: "add",
          service: String(japService),
          link: orderData.link,
          quantity: String(orderData.quantity)
        })
      }
    );

    const japData = await japResponse.json();

    const japOrderId =
      japData.order ||
      japData.id ||
      japData.orderId ||
      "";

    const orderDocId = orderData.orderDocId;

    const orderPayload = {
      publicOrderId: String(orderData.publicOrderId || ""),
      service: String(orderData.service || ""),
      serviceId: String(orderData.serviceId || ""),
      amount: Number(orderData.quantity || 0),
      price: Number(orderData.priceRub || 0),
      link: String(orderData.link || ""),
      status: "🟡 В обработке",
      paymentMethod: "ЮKassa",
      paymentId: String(payment.id || ""),
      japOrderId: String(japOrderId),
      paidAt: serverTimestamp()
    };

    if (orderDocId) {
      try {
        await updateDoc(doc(db, "orders", orderDocId), orderPayload);
      } catch (e) {
        await setDoc(doc(db, "orders", orderDocId), {
          ...orderPayload,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    }

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text:
`🔥 Новый оплаченный заказ через ЮKassa

ID: ${orderData.publicOrderId || orderDocId || "—"}
Услуга: ${orderData.service}
Количество: ${orderData.quantity}
Сумма: ${orderData.priceRub}₽
Ссылка: ${orderData.link}

JAP ID:
${japOrderId || "Ошибка"}`
        })
      }
    );

    return res.status(200).json({
      success: true
    });

  } catch (e) {

    console.error(e);

    return res.status(500).json({
      error: e.message
    });

  }

}
