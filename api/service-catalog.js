// Автоматически сформированный серверный каталог услуг.
// Цена считается только на сервере, чтобы нельзя было подменить сумму из браузера.

export const SERVICE_CATALOG = [
  {
    "id": "8841",
    "name": "Рост аудитории",
    "price": 150.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "6074",
    "name": "Премиум аудитория",
    "price": 2190.0,
    "mode": "per1000",
    "min": 50,
    "max": 1000000
  },
  {
    "id": "10130",
    "name": "Вовлеченность",
    "price": 49.0,
    "mode": "per1000",
    "min": 50,
    "max": 1000000
  },
  {
    "id": "6454",
    "name": "Просмотры",
    "price": 7.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "10175",
    "name": "Репосты",
    "price": 70.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "3383",
    "name": "Комментарии",
    "price": 20.0,
    "mode": "per1",
    "min": 5,
    "max": 1000000
  },
  {
    "id": "10020",
    "name": "Просмотры TikTok",
    "price": 9.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "8101",
    "name": "Лайки TikTok",
    "price": 5.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "10174",
    "name": "Премиум лайки TikTok",
    "price": 15.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "10137",
    "name": "Подписчики TikTok",
    "price": 244.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "10239",
    "name": "Премиум подписчики TikTok",
    "price": 569.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "8040",
    "name": "Просмотры YouTube",
    "price": 59.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "6682",
    "name": "Премиум просмотры YouTube",
    "price": 119.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "3519",
    "name": "Подписчики YouTube",
    "price": 1390.0,
    "mode": "per1000",
    "min": 5,
    "max": 1000000
  },
  {
    "id": "8236",
    "name": "Премиум подписчики YouTube",
    "price": 1990.0,
    "mode": "per1000",
    "min": 50,
    "max": 1000000
  },
  {
    "id": "8668",
    "name": "Лайки YouTube",
    "price": 109.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "8694",
    "name": "Премиум лайки YouTube",
    "price": 299.0,
    "mode": "per1000",
    "min": 20,
    "max": 1000000
  },
  {
    "id": "10300",
    "name": "VK видео просмотры",
    "price": 9.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "3769",
    "name": "VK просмотры поста",
    "price": 3.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "8486",
    "name": "VK лайки",
    "price": 49.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "4186",
    "name": "VK друзья",
    "price": 209.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "4184",
    "name": "VK подписчики в группу",
    "price": 199.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "3761",
    "name": "VK репосты",
    "price": 1290.0,
    "mode": "per1000",
    "min": 5,
    "max": 1000000
  },
  {
    "id": "1165",
    "name": "Telegram Premium Bot Start",
    "price": 657.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "8862",
    "name": "Telegram участники RU",
    "price": 1032.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "10298",
    "name": "Telegram премиум участники",
    "price": 1107.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "8485",
    "name": "Telegram реакции и просмотры",
    "price": 186.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "7411",
    "name": "Telegram комментарии RU",
    "price": 282.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "8811",
    "name": "Telegram просмотры",
    "price": 2.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  }
];

export function getServiceById(serviceId) {
  return SERVICE_CATALOG.find(item => String(item.id) === String(serviceId));
}

export function calcServicePrice(service, quantity) {
  const qty = Number(quantity || 0);
  if (!service || !Number.isFinite(qty)) return 0;
  if (service.mode === 'per1') return qty * Number(service.price || 0);
  return (qty / 1000) * Number(service.price || 0);
}

export function validateOrderPayload(payload = {}) {
  const service = getServiceById(payload.serviceId);
  if (!service) {
    return { ok: false, error: 'Unknown service' };
  }

  const quantity = Math.floor(Number(payload.quantity || 0));
  if (!Number.isFinite(quantity) || quantity < service.min || quantity > service.max) {
    return { ok: false, error: `Invalid quantity. Min: ${service.min}, max: ${service.max}` };
  }

  const link = String(payload.link || '').trim();
  if (!/^https?:\/\//i.test(link)) {
    return { ok: false, error: 'Invalid link' };
  }

  const priceRub = Number(calcServicePrice(service, quantity).toFixed(2));
  if (priceRub <= 0) {
    return { ok: false, error: 'Invalid price' };
  }

  return { ok: true, service, quantity, link, priceRub };
}
