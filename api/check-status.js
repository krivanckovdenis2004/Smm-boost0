import { initializeApp } from "firebase/app";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";

const firebaseConfig = {

  apiKey: process.env.FIREBASE_API_KEY,

  authDomain:
  process.env.FIREBASE_AUTH_DOMAIN,

  projectId:
  process.env.FIREBASE_PROJECT_ID,

  storageBucket:
  process.env.FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
  process.env.FIREBASE_MESSAGING_SENDER_ID,

  appId:
  process.env.FIREBASE_APP_ID

};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export default async function handler(req, res) {

  try {

    const snapshot = await getDocs(
      collection(db, "orders")
    );

    for (const orderDoc of snapshot.docs) {

      const order = orderDoc.data();

      if (!order.japOrderId) continue;

      if (
        order.status?.includes("🟢") ||
        order.status?.includes("🔴")
      ) {
        continue;
      }

      const response = await fetch(
        "https://justanotherpanel.com/api/v2",
        {
          method: "POST",
          headers: {
            "Content-Type":
            "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            key: process.env.JAP_API_KEY,
            action: "status",
            order: String(order.japOrderId)
          })
        }
      );

      const data = await response.json();

      console.log(data);

      let newStatus = "🟡 В обработке";

      if (data.status) {

        const status =
        data.status.toLowerCase();

        if (
          status.includes("completed")
        ) {

          newStatus = "🟢 Выполнен";

        }

        else if (
          status.includes("partial")
        ) {

          newStatus = "🟠 Частично";

        }

        else if (
          status.includes("canceled")
        ) {

          newStatus = "🔴 Отменен";

        }

      }

      await updateDoc(
        doc(db, "orders", orderDoc.id),
        {
          status: newStatus
        }
      );

    }

    return res.status(200).json({
      success: true
    });

  }

  catch (e) {

    console.error(e);

    return res.status(500).json({
      error: e.message
    });

  }

}