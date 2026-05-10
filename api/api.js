export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }


  const {
    service,
    quantity,
    link
  } = req.body;

console.log(service, quantity, link);

  try {

    // Отправка в JAP
    const japResponse = await fetch(
      'https://justanotherpanel.com/api/v2',
      {
        method: 'POST',
        headers: {
          'Content-Type':
          'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
key:'0219ab7f08e341275316fbd82e43df29',
          action: 'add',
          service: '8841',
          link: link,
          quantity: String(quantity)
        })
      }
    );

    const japText = await japResponse.text();

console.log(japText);

let japData;

try {
  japData = JSON.parse(japText);
} catch {
  return res.status(500).json({
    error: japText
  });
}

    // Telegram уведомление
    await fetch(
      `https://api.telegram.org/bot8539363038:AAGm30GEC8_k9YYlFfEFx5mI3iKeiMPAYSU/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: '8676446654',
          text:
`🔥 Новый заказ

Услуга: ${service}
Количество: ${quantity}
Ссылка: ${link}

JAP ID:
${japData.order || 'Ошибка'}`
        })
      }
    );

    return res.status(200).json({
      success: true,
      jap: japData
    });

  } catch (e) {

    return res.status(500).json({
      error: e.message
    });

  }

}
//.    // update
