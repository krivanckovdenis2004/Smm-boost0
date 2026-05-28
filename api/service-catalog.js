// Серверный каталог услуг. Цена считается только на сервере, чтобы нельзя было подменить сумму из браузера.

export const SERVICE_CATALOG = [
  {
    "id": "10242",
    "name": "Instagram подписчики",
    "price": 50.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "10237",
    "name": "Instagram лайки",
    "price": 7.0,
    "mode": "per1000",
    "min": 50,
    "max": 1000000
  },
  {
    "id": "5994",
    "name": "Instagram просмотры",
    "price": 1.0,
    "mode": "per1000",
    "min": 100,
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
    "id": "8777",
    "name": "TikTok подписчики",
    "price": 112.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "10019",
    "name": "TikTok просмотры",
    "price": 2.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "10022",
    "name": "TikTok лайки",
    "price": 3.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "1978",
    "name": "TikTok комментарии",
    "price": 70.0,
    "mode": "per3",
    "min": 3,
    "max": 1000000
  },
  {
    "id": "1543",
    "name": "VK подписчики",
    "price": 40.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "3757",
    "name": "VK лайки",
    "price": 52.0,
    "mode": "per1000",
    "min": 10,
    "max": 1000000
  },
  {
    "id": "7737",
    "name": "VK просмотры",
    "price": 1.0,
    "mode": "per1000",
    "min": 100,
    "max": 1000000
  },
  {
    "id": "3761",
    "name": "VK репосты",
    "price": 1000.0,
    "mode": "per1000",
    "min": 5,
    "max": 1000000
  },
  {
    "id": "4186",
    "name": "VK друзья",
    "price": 152.0,
    "mode": "per1000",
    "min": 100,
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
  if (service.mode === 'per3') return (qty / 3) * Number(service.price || 0);
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

  if (service.mode === 'per3' && quantity % 3 !== 0) {
    return { ok: false, error: 'Для этой услуги количество должно быть кратно 3' };
  }

  const link = String(payload.link || '').trim();
  if (!/^https?:\/\//i.test(link)) {
    return { ok: false, error: 'Invalid link' };
  }

  const serviceName = String(service.name || '').toLowerCase();
  const serviceId = String(service.id || '');
  const linkLower = link.toLowerCase();

  function linkFail(example) {
    return {
      ok: false,
      error: `Ссылка не подходит для выбранной услуги. Нужна ссылка формата: ${example}`
    };
  }

  if (serviceName.includes('telegram') || ['1165','8862','10298','8485','7411','8811'].includes(serviceId)) {
    if (!/(t\.me|telegram\.me|telegram\.dog)/i.test(linkLower)) {
      return linkFail('https://t.me/username или https://t.me/channel/123');
    }
  } else if (serviceName.includes('vk') || serviceName.includes('вк') || ['1543','3757','7737','3761','4186'].includes(serviceId)) {
    if (!/(vk\.com|vk\.ru)/i.test(linkLower)) {
      return linkFail('https://vk.com/... или https://vk.ru/...');
    }
  } else if (serviceName.includes('tiktok') || ['8777','10019','10022','1978'].includes(serviceId)) {
    if (!/tiktok\.com/i.test(linkLower)) {
      return linkFail('https://www.tiktok.com/@username/...');
    }
  } else {
    if (!/instagram\.com/i.test(linkLower)) {
      return linkFail('https://www.instagram.com/...');
    }
  }

  const priceRub = Number(calcServicePrice(service, quantity).toFixed(2));
  if (priceRub <= 0) {
    return { ok: false, error: 'Invalid price' };
  }

  return { ok: true, service, quantity, link, priceRub };
}
