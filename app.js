function setupCalculator(inputId, totalId, pricePer1000, serviceName) {

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