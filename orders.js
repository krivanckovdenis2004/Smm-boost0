import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const shownStatuses = {};

import {

  getFirestore,

  doc,

  onSnapshot

}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",

  authDomain: "smm-boost-905d5.firebaseapp.com",

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

async function loadOrders() {

  const ordersList =
  document.getElementById('ordersList');

  const myOrders = JSON.parse(

    localStorage.getItem('myOrders')

  ) || [];

  ordersList.innerHTML = '';

  if (myOrders.length === 0) {

    ordersList.innerHTML = `

      <p class="emptyOrders">

        У вас пока нет заказов

      </p>

    `;

    return;

  }

  for (const orderId of myOrders) {

    const orderRef =
    doc(db, "orders", orderId);

    onSnapshot(orderRef, (orderSnap) => {

      if (orderSnap.exists()) {

        const order =
        orderSnap.data();

        if (

          shownStatuses[orderId] !==
          order.status

        ) {

          shownStatuses[orderId] =
          order.status;

          showToast(order.status);

        }

        let statusClass = '';

        let progress = 60;

        if (order.status.includes('🟢')) {

          statusClass = 'doneStatus';

          progress = 100;

        }

        else if (order.status.includes('🔴')) {

          statusClass = 'cancelStatus';

          progress = 100;

        }

        else {

          statusClass = 'processStatus';

          progress = 60;

        }

        const existingCard =
        document.getElementById(orderId);

        const cardHTML = `

          <div class="order-card"
          id="${orderId}">

            <h2>${order.service}</h2>

            <p>
            Количество:
            ${order.amount}
            </p>

            <p>
            Сумма:
            ${order.price}₽
            </p>

            <p>
            Ссылка:
            </p>

            <a href="${order.link}"
            target="_blank">

            ${order.link}

            </a>

            <div style="margin-top:20px">

              <span class="statusBadge ${statusClass}">

              ${order.status}

              </span>

              <div class="progressBar">

                <div
                class="progressFill"

                style="width:${progress}%">

                </div>

              </div>

            </div>

          </div>

        `;

        if (existingCard) {

          existingCard.outerHTML =
          cardHTML;

        }

        else {

          ordersList.innerHTML +=
          cardHTML;

        }

      }

    });

  }

}

loadOrders();

function showToast(status) {

  const toast =
  document.createElement('div');

  let toastClass = 'process';

  if (status.includes('🟢')) {

    toastClass = 'done';

  }

  else if (status.includes('🔴')) {

    toastClass = 'cancel';

  }

  toast.className =
  `toast ${toastClass}`;

  toast.innerText =
  status;

  document
    .getElementById('toastContainer')
    .appendChild(toast);

  setTimeout(() => {

    toast.remove();

  }, 4000);

}