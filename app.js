import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

getFirestore,

collection,

addDoc,

getDocs,

query,

orderBy,

limit,

onSnapshot

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

let currentService = '';
let currentAmount = 0;
let currentPrice = 0;
const commentButtons =
document.querySelectorAll(
'.comment-option'
);

commentButtons.forEach(btn => {

btn.addEventListener('click', () => {

commentButtons.forEach(b => {

b.classList.remove('active');

});

btn.classList.add('active');

const value =
parseInt(btn.dataset.value);

const total =
(value / 5) * 99;

document.getElementById(
'commentsAmount'
).value = value;

document.getElementById(
'commentsTotal'
).innerText =
total.toFixed(2) + '₽';

currentService = 'Комментарии';

currentAmount = value;

currentPrice = total;

});

});

if(commentButtons.length > 0){

commentButtons[0].click();

}

function setupCalculator(
  inputId,
  totalId,
  pricePer1000,
  serviceName,
  minAmount
) {

  const input =
    document.getElementById(inputId);

  const total =
    document.getElementById(totalId);

  const button =
input.parentElement.querySelector('.order-btn');

  input.addEventListener('input', () => {

    const amount =
      parseFloat(input.value) || 0;

    const error =
      document.getElementById(
        inputId.replace('Amount', 'Error')
      );

    if(amount < minAmount){

      error.style.display = 'block';

    } else {

      error.style.display = 'none';

    }

    let price = 0;

    if (serviceName === "Комментарии") {

      price = Math.ceil(amount / 5) * 99;

    } else {

      price =
      (amount / 1000) * pricePer1000;

    }

    total.innerText =
      price.toFixed(2) + '₽';

  });

  button.addEventListener('click', () => {

    const amount =
      parseFloat(input.value) || 0;

    if(amount < minAmount){

      alert(
      `Минимальный заказ: ${minAmount}`
      );

      return;

    }

    let price = 0;

    if (serviceName === "Комментарии") {

      price = Math.ceil(amount / 5) * 99;

    } else {

      price =
      (amount / 1000) * pricePer1000;

    }

    currentService = serviceName;
    currentAmount = amount;
    currentPrice = price;

    document.getElementById('serviceName')
      .innerText =
      'Услуга: ' + serviceName;

    document.getElementById('serviceAmount')
      .innerText =
      'Количество: ' + amount;

    document.getElementById('servicePrice')
      .innerText =
      'Сумма: ' + price.toFixed(2) + '₽';

    document.getElementById('orderModal')
      .style.display = 'flex';

  });

}

setupCalculator(
  'followersAmount',
  'followersTotal',
  150,
  'Подписчики',
  100
);

setupCalculator(
  'likesAmount',
  'likesTotal',
  20,
  'Лайки',
  50
);

setupCalculator(
  'viewsAmount',
  'viewsTotal',
  7,
  'Просмотры',
  100
);

setupCalculator(
  'repostsAmount',
  'repostsTotal',
  70,
  'Репосты',
  10
);

setupCalculator(
  'commentsAmount',
  'commentsTotal',
  99,
  'Комментарии',
  5
);

document
  .getElementById('closeModal')
  .addEventListener('click', () => {

    document.getElementById('orderModal')
      .style.display = 'none';

});

document
  .getElementById('payButton')
  .addEventListener('click', async () => {
const payBtn =
document.getElementById('payButton');

payBtn.disabled = true;

payBtn.innerText =
"Создание заказа...";
    const link =
      document.getElementById('instagramLink')
      .value;
const orderButton =
document.getElementById('payButton');

const instagramRegex =
/instagram\.com/;

if (!instagramRegex.test(link)) {

    alert('Введите корректную ссылку Instagram');

    payBtn.disabled = false;
    payBtn.innerText = "Оплатить";

    return;
}

    try {
let myOrders = JSON.parse(

  localStorage.getItem('myOrders')

) || [];

localStorage.setItem(

  'myOrders',

  JSON.stringify(myOrders)

);
    const response = await fetch(
"https://eon8e8gh7h0nvjz.m.pipedream.net",
{
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    service:
currentService === "Подписчики"
? 8841

: currentService === "Лайки"
? 10130

: currentService === "Просмотры"
? 6454

: currentService === "Репосты"
? 10175

: currentService === "Комментарии"
? 3383

: null,

    link: link,
    quantity: currentAmount
  })
});

await addDoc(collection(db, 'orders'), {

  service: currentService,
  amount: currentAmount,
  price: currentPrice,
  link: link,
  status: '🟡 В обработке',
  createdAt: Date.now()

});

alert("Заказ отправлен!");
const orderData = {
  id: Date.now(),
  service: currentService,
  quantity: currentAmount,
  link: link,
  status: "В обработке",
  created: new Date().toLocaleString()
};

let orders =
JSON.parse(localStorage.getItem("orders")) || [];

orders.unshift(orderData);

localStorage.setItem(
  "orders",
  JSON.stringify(orders)
);
document.getElementById('orderModal')
  .style.display = 'none';

payBtn.disabled = false;

payBtn.innerText =
"Оплатить";
      alert("Заказ успешно создан 🔥");

orderButton.disabled = false;
orderButton.innerText = 'Оплатить';
      window.location.href =
'orders.html';

      document.getElementById('orderModal')
        .style.display = 'none';

      document.getElementById('instagramLink')
        .value = '';

    } catch (e) {

      console.log(e);
orderButton.disabled = false;
orderButton.innerText = 'Оплатить';
payBtn.disabled = false;

payBtn.innerText =
"Оплатить";

      alert('Ошибка создания заказа');

    }

});
async function loadOrders() {

  const ordersList =
  document.getElementById('ordersList');

  const snapshot =
  await getDocs(collection(db, "orders"));

  ordersList.innerHTML = '';

  snapshot.forEach((docItem) => {

    const order =
    docItem.data();

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

    ordersList.innerHTML += `

      <div class="order-card">

        <h3>${order.service}</h3>

        <p>
        Количество:
        ${order.amount}
        </p>

        <p>
        Сумма:
        ${order.price}₽
        </p>

        <span class="statusBadge ${statusClass}">

        ${order.status}

        </span>

      </div>

    `;

  });

}

const liveContainer =
document.getElementById(
'live-orders'
);

if (liveContainer) {

const q = query(

collection(db, "orders"),

orderBy("createdAt", "desc"),

limit(1)

);

let lastOrderId = null;

let initialized = false;

onSnapshot(q, (snapshot) => {

if(!initialized){

initialized = true;

return;

}

snapshot.forEach((docItem) => {

if (
docItem.id === lastOrderId
) return;

lastOrderId = docItem.id;

const order =
docItem.data();

const div =
document.createElement("div");

div.className =
"live-order";

div.innerHTML = `

🔥 Новый заказ

<br><br>

${order.service}

× ${order.amount}

`;

liveContainer.appendChild(div);

const allOrders =
liveContainer.querySelectorAll('.live-order');

if(allOrders.length > 2){

allOrders[0].remove();

}

setTimeout(() => {

div.remove();

}, 6000);

});

});

}