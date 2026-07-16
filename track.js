import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

  getFirestore,

  doc,

  getDoc

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",

  authDomain: "smm-boost.pro",

  projectId: "smm-boost-905d5",

  storageBucket: "smm-boost-905d5.firebasestorage.app",

  messagingSenderId: "554912523069",

  appId: "1:554912523069:web:26d405b696b9d45e5edb54",

  measurementId: "G-E6SRLXZW5V"

};

const app =
initializeApp(firebaseConfig);

const db =
getFirestore(app);

const params =
new URLSearchParams(window.location.search);

const orderId =
params.get('id');

const orderInfo =
document.getElementById('orderInfo');

async function loadOrder() {

  if (!orderId) {

    orderInfo.innerHTML =
      'ID заказа не найден';

    return;

  }

  const orderRef =
    doc(db, "orders", orderId);

  const orderSnap =
    await getDoc(orderRef);

  if (orderSnap.exists()) {

    const order =
      orderSnap.data();
let statusClass = '';

if (order.status.includes('🟢')) {

  statusClass = 'doneStatus';

}

else if (order.status.includes('🔴')) {

  statusClass = 'cancelStatus';

}

else {

  statusClass = 'processStatus';

}

    orderInfo.innerHTML = `

      <p>
      <b>Услуга:</b>
      ${order.service}
      </p>

      <p>
      <b>Количество:</b>
      ${order.amount}
      </p>

      <p>
      <b>Сумма:</b>
      ${order.price}₽
      </p>

      <p>
      <b>Статус:</b>

<span class="statusBadge ${statusClass}">

${order.status}

</span>
      </p>

    `;

  } else {

    orderInfo.innerHTML =
      'Заказ не найден';

  }

}

loadOrder();