import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc
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

function setupCalculator(
  inputId,
  totalId,
  pricePer1000,
  serviceName
) {

  const input = document.getElementById(inputId);

  const total = document.getElementById(totalId);

  const button =
    input.parentElement.querySelector('button');

  input.addEventListener('input', () => {

    const amount =
      parseFloat(input.value) || 0;

    const price =
      (amount / 1000) * pricePer1000;

    total.innerText =
      price.toFixed(2) + '₽';

  });

  button.addEventListener('click', () => {

    const amount =
      parseFloat(input.value) || 0;

    const price =
      (amount / 1000) * pricePer1000;

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
  'Подписчики'
);

setupCalculator(
  'likesAmount',
  'likesTotal',
  20,
  'Лайки'
);

setupCalculator(
  'viewsAmount',
  'viewsTotal',
  7,
  'Просмотры'
);

setupCalculator(
  'repostsAmount',
  'repostsTotal',
  70,
  'Репосты'
);

setupCalculator(
  'commentsAmount',
  'commentsTotal',
  4452,
  'Комментарии'
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

    const link =
      document.getElementById('instagramLink')
      .value;

    if (!link) {

      alert('Введите ссылку');

      return;

    }

    try {

      await addDoc(collection(db, 'orders'), {

        service: currentService,

        amount: currentAmount,

        price: currentPrice,

        link: link,

        status: '🟡 В обработке',

        createdAt: new Date()

      });

      alert('Заказ успешно создан 🔥');

      fetch("https://api.telegram.org/bot8539363038:AAGm30GEC8_k9YYlFfEFx5mI3iKeiMPAYSU/sendMessage", {

  method: "POST",

  headers: {
    "Content-Type": "application/json"
  },

  body: JSON.stringify({

    chat_id: "8676446654",

    text:
`🔥 Новый заказ

📦 Услуга: ${currentService}

🔢 Количество: ${currentAmount}

💰 Сумма: ${currentPrice.toFixed(2)}₽

🔗 Ссылка:
${link}

🟡 Статус:
В обработке`

  })

});

      document.getElementById('orderModal')
        .style.display = 'none';

      document.getElementById('instagramLink')
        .value = '';

    } catch (e) {

      console.log(e);

      alert('Ошибка создания заказа');

    }

});
