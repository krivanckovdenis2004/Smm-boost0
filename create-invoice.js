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
quantity
} = req.body;

const response = await fetch(
"https://pay.crypt.bot/api/createInvoice",
{
method: "POST",
headers: {
"Crypto-Pay-API-Token":
process.env.CRYPTOBOT_TOKEN,
"Content-Type":
"application/json"
},
body: JSON.stringify({
asset: "USDT",

amount: String(
(((amount || 100) * 1.12) / 70)
.toFixed(2)
),

description:
description ||
"Оплата заказа SMM-Boost",

payload: JSON.stringify({
service: service,
link: link,
quantity: quantity,
priceRub: amount
})

})
}
);

const data =
await response.json();

return res.status(200).json(data);

} catch (e) {

return res.status(500).json({
error: e.message
});

}

}