export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      amount,
      description,
      service,
      link,
      quantity,
      orderDocId,
      publicOrderId,
      serviceId
    } = req.body;

    const auth = Buffer.from(
      process.env.YOOKASSA_SHOP_ID + ":" + process.env.YOOKASSA_SECRET_KEY
    ).toString("base64");

    const idempotenceKey =
      Date.now().toString() + Math.random().toString(36).slice(2);

    const returnUrl = orderDocId
      ? `https://smm-boost.pro/orders.html?paid=1&order=${encodeURIComponent(orderDocId)}`
      : "https://smm-boost.pro/orders.html?paid=1";

    const response = await fetch(
      "https://api.yookassa.ru/v3/payments",
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + auth,
          "Content-Type": "application/json",
          "Idempotence-Key": idempotenceKey
        },
        body: JSON.stringify({
          amount: {
            value: Number(amount || 1).toFixed(2),
            currency: "RUB"
          },
          capture: true,
          confirmation: {
            type: "redirect",
            return_url: returnUrl
          },
          description: description || "Оплата заказа SMM-Boost",
          metadata: {
            service: String(service || ""),
            serviceId: String(serviceId || ""),
            link: String(link || ""),
            quantity: String(quantity || ""),
            priceRub: String(amount || ""),
            orderDocId: String(orderDocId || ""),
            publicOrderId: String(publicOrderId || "")
          }
        })
      }
    );

    const data = await response.json();

    return res.status(200).json(data);

  } catch (e) {

    return res.status(500).json({
      error: e.message
    });

  }

}
