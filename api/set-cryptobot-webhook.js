export default async function handler(req, res) {

  const response = await fetch(
    "https://pay.crypt.bot/api/setWebhook",
    {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": process.env.CRYPTOBOT_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        webhook_url:
        "https://smm-boost.pro/api/cryptobot-webhook"
      })
    }
  );

  const data = await response.json();

  return res.status(200).json(data);

}
