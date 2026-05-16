import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const amount = body.amount || 100;
    const description = body.description || "Оплата заказа";

    const response = await fetch("https://pay.crypt.bot/api/createInvoice", {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": process.env.CRYPTOBOT_TOKEN!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset: "USDT",
        amount: amount.toString(),
        description,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json(data, { status: 400 });
    }

    return NextResponse.json({
      pay_url: data.result.pay_url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Ошибка создания инвойса" },
      { status: 500 }
    );
  }
}
