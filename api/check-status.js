import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost-905d5.firebaseapp.com",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {

  try {

    const snapshot = await getDocs(collection(db, "orders"));

    for (const orderDoc of snapshot.docs) {

      const order = orderDoc.data();

      if (!order.japOrderId) continue;

      const response = await fetch("https://justanotherpanel.com/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          key: "0219ab7f08e341275316fbd82e43df29",
          action: "status",
          order: order.japOrderId
        })
      });

      const data = await response.json();

      let newStatus = "Pending";

      if (data.status === "Completed") {
        newStatus = "✅ Выполнен";
      }

      if (data.status === "Processing") {
        newStatus = "🟡 В обработке";
      }

      if (data.status === "Canceled") {
        newStatus = "❌ Отменен";
      }

      await updateDoc(doc(db, "orders", orderDoc.id), {
        status: newStatus
      });

    }

    res.status(200).json({
      success: true
    });

  } catch (e) {

    res.status(500).json({
      error: e.message
    });

  }

}
