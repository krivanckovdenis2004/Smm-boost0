export default async function handler(req,res){
if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
const telegram=String(req.body?.telegram||'').trim();
if(!telegram) return res.status(400).json({error:'Telegram required'});
const auth=Buffer.from(process.env.YOOKASSA_SHOP_ID+':'+process.env.YOOKASSA_SECRET_KEY).toString('base64');
const { randomUUID } = await import('crypto');
const response=await fetch('https://api.yookassa.ru/v3/payments',{
method:'POST',
headers:{Authorization:'Basic '+auth,'Content-Type':'application/json','Idempotence-Key':randomUUID()},
body:JSON.stringify({
amount:{value:'129.00',currency:'RUB'},
capture:true,
confirmation:{type:'redirect',return_url:'https://smm-boost.pro/success.html'},
description:'VPN 1 month',
metadata:{type:'vpn_order',telegram}
})
});
const data=await response.json();
return res.status(response.ok?200:500).json(data.confirmation?{confirmation_url:data.confirmation.confirmation_url}:data);
}