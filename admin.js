import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

  getFirestore,

  collection,

  getDocs,

  doc,

  updateDoc

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",

  authDomain: "smm-boost-905d5.firebaseapp.com",

  projectId: "smm-boost-905d5",

  storageBucket: "smm-boost-905d5.firebasestorage.app",

  messagingSenderId: "554912523069",

  appId: "1:554912523069:web:26d405b696b9d45e5edb54",

  measurementId: "G-E6SRLXZW5V"

};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const ordersContainer =
document.getElementById('ordersContainer');

async function loadOrders() {

  ordersContainer.innerHTML = '';

  const querySnapshot =
    await getDocs(collection(db, "orders"));

  querySnapshot.forEach((docItem) => {

    const order = docItem.data();

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

    const card =
      document.createElement('div');

    card.className = 'card';

    card.innerHTML = `

      <h2>${order.service}</h2>

      <p><b>Количество:</b>
      ${order.amount}</p>

      <p><b>Сумма:</b>
      ${order.price}₽</p>

      <p><b>Ссылка:</b></p>

      <a href="${order.link}"
      target="_blank">

      ${order.link}

      </a>

      <p>

<b>Статус:</b>

<span class="statusBadge ${statusClass}">

${order.status}

</span>

</p>

      <div style="margin-top:20px">

        <button class="doneBtn">
        🟢 Выполнен
        </button>

        <button class="cancelBtn">
        🔴 Отменен
        </button>

      </div>

    `;

    const doneBtn =
      card.querySelector('.doneBtn');

    const cancelBtn =
      card.querySelector('.cancelBtn');

    doneBtn.addEventListener(
      'click',
      async () => {

        await updateDoc(

          doc(db, "orders", docItem.id),

          {
            status: "🟢 Выполнен"
          }

        );

        loadOrders();

      }

    );

    cancelBtn.addEventListener(
      'click',
      async () => {

        await updateDoc(

          doc(db, "orders", docItem.id),

          {
            status: "🔴 Отменен"
          }

        );

        loadOrders();

      }

    );

    ordersContainer.appendChild(card);

  });

}

loadOrders();

setInterval(() => {

  loadOrders();

}, 5000);