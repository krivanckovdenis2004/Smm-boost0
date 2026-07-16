import { firebaseApp } from "./firebase.js?v=20260716-auth-v6";

import {

  getFirestore,

  doc,

  getDoc

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db =
getFirestore(firebaseApp);

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