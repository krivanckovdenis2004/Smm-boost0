export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const update = req.body;

    if (update.update_type !== "invoice_paid") {
      return res.status(200).json({
        success: true
      });
    }

    const invoice = update.payload;

    const orderData = JSON.parse(
      invoice.payload || "{}"
    );

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

    const firebaseKey =
      process.env.FIREBASE_API_KEY ||
      "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8";

    await fetch(
      `https://firestore.googleapis.com/v1/projects/smm-boost-905d5/databases/(default)/documents/orders?key=${firebaseKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            service: {
              stringValue: orderData.service
            },
            amount: {
              integerValue: String(orderData.quantity)
            },
            price: {
              doubleValue: Number(orderData.priceRub || 0)
            },
            link: {
              stringValue: orderData.link
            },
            status: {
              stringValue: "🟡 В обработке"
            },
            japOrderId: {
              stringValue: String(japOrderId)
            },
            invoiceId: {
              stringValue: String(invoice.invoice_id)
            },
            createdAt: {
              timestampValue: new Date().toISOString()
            }
          }
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
