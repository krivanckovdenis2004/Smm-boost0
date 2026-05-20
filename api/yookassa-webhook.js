export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const event = req.body;

    if (
      event.event !== "payment.succeeded" ||
      event.object.status !== "succeeded"
    ) {
      return res.status(200).json({
        success: true
      });
    }

    const payment = event.object;
    const orderData = payment.metadata || {};

    const serviceMap = {
      "Подписчики": 8841,
      "Рост аудитории": 8841,
      "Лайки": 10130,
      "Вовлеченность": 10130,
      "Просмотры": 6454,
      "Репосты": 10175,
      "Комментарии": 3383,
      "Активность в комментариях": 3383
    };

    const japService =
      serviceMap[orderData.service];

    if (!japService) {
      throw new Error("Unknown service");
    }

    const japResponse = await fetch(
      "https://justanotherpanel.com/api/v2",
      {
        method: "POST",
        headers: {
          "Content-Type":
          "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY,
          action: "add",
          service: String(japService),
          link: orderData.link,
          quantity: String(orderData.quantity)
        })
      }
    );

    const japData = await japResponse.json();

    const japOrderId =
      japData.order ||
      japData.id ||
      japData.orderId ||
      "";

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text:
`🔥 Новый оплаченный заказ через ЮKassa

Услуга: ${orderData.service}
Количество: ${orderData.quantity}
Сумма: ${orderData.priceRub}₽
Ссылка: ${orderData.link}

JAP ID:
${japOrderId || "Ошибка"}`
        })
      }
    );

    return res.status(200).json({
      success: true
    });

  } catch (e) {

    console.error(e);

    return res.status(500).json({
      error: e.message
    });

  }

}