export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      amount,
      description
    } = req.body;

    const auth = Buffer.from(
      `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`
    ).toString("base64");

    const response = await fetch(
      "https://api.yookassa.ru/v3/payments",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
          "Idempotence-Key":
          crypto.randomUUID()
        },
        body: JSON.stringify({

          amount: {
            value: Number(amount).toFixed(2),
            currency: "RUB"
          },

          capture: true,

          confirmation: {
            type: "redirect",
            return_url:
            "https://smm-boost.pro/orders.html"
          },

          description

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