export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { amount, description } = req.body;

    const response = await fetch(
      "https://pay.crypt.bot/api/createInvoice",
      {
        method: "POST",
        headers: {
          "Crypto-Pay-API-Token": process.env.CRYPTOBOT_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
  asset: "USDT",
  amount: String(((amount || 100) / 60).toFixed(2)),
  description: description || "Оплата заказа SMM-Boost",
  payload: JSON.stringify({
    service: body.service,
    link: body.link,
    quantity: body.quantity,
    priceRub: amount
  }),
  paid_btn_name: "openBot",
  paid_btn_url: "https://smm-boost.pro/orders.html"
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
