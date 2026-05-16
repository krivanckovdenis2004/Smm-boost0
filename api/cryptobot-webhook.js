import { initializeApp } from "firebase/app";

import {
  getFirestore,
  collection,
  addDoc,
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

    const update = req.body;

    if (update.update_type !== "invoice_paid") {
      return res.status(200).json({
        success: true
      });
    }

    const invoice = update.payload;

    const orderData = JSON.parse(
      invoice.payload || "{}"
    );

    const serviceMap = {
      "Подписчики": 8841,
      "Рост аудитории": 8841,
      "Лайки": 10130,
      "Вовлеченность": 10130,
      "Просмотры": 6454,
      "Репосты": 10175,
      "Комментарии": 3383,
      "Активность в комментариях": 3383
    };

    const japService =
      serviceMap[orderData.service];

    if (!japService) {
      throw new Error("Unknown service");
    }

    const japResponse = await fetch(
      "https://justanotherpanel.com/api/v2",
      {
        method: "POST",
        headers: {
          "Content-Type":
          "application/x-www-form-urlencoded"
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

    await addDoc(
      collection(db, "orders"),
      {
        service: orderData.service,
        amount: Number(orderData.quantity),
        price: Number(orderData.priceRub || 0),
        link: orderData.link,
        status: "🟡 В обработке",
        japOrderId: String(japOrderId),
        invoiceId: String(invoice.invoice_id),
        createdAt: serverTimestamp()
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
