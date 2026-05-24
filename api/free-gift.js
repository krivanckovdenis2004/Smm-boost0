const JAP_API_URL = 'https://justanotherpanel.com/api/v2';
const FALLBACK_JAP_KEY = '0219ab7f08e341275316fbd82e43df29';
const FALLBACK_TG_BOT = '8539363038:AAGm30GEC8_k9YYlFfEFx5mI3iKeiMPAYSU';
const FALLBACK_TG_CHAT = '8676446654';

const SERVICE_MAP = {
  followers: {
    TikTok: { service: 10137, quantity: 100, label: 'TikTok подписчики HQ' },
    Telegram: { service: 8862, quantity: 100, label: 'Telegram участники RU' },
    VK: { service: 278, quantity: 100, label: 'VK подписчики' },
    YouTube: { service: 3519, quantity: 100, label: 'YouTube подписчики' }
  },
  views: {
    TikTok: { service: 1004, quantity: 10000, label: 'TikTok просмотры' },
    Telegram: { service: 8811, quantity: 10000, label: 'Telegram просмотры поста' },
    VK: { service: 10300, quantity: 10000, label: 'VK просмотры видео' },
    YouTube: { service: 6298, quantity: 10000, label: 'YouTube просмотры' },
    Instagram: { service: 5994, quantity: 10000, label: 'Instagram просмотры' }
  },
  likes: {
    TikTok: { service: 10022, quantity: 1000, label: 'TikTok лайки' },
    Telegram: { service: 8485, quantity: 1000, label: 'Telegram реакции' },
    VK: { service: 8486, quantity: 1000, label: 'VK лайки' },
    YouTube: { service: 8668, quantity: 1000, label: 'YouTube лайки' }
  }
};

function escapeText(value) {
  return String(value || '').replace(/[<>]/g, '');
}

function isValidLink(social, link) {
  const value = String(link || '');
  const rules = {
    TikTok: /tiktok\.com|vm\.tiktok\.com/i,
    Telegram: /t\.me|telegram\.me/i,
    YouTube: /youtube\.com|youtu\.be/i,
    VK: /vk\.com|vk\.ru/i,
    Instagram: /instagram\.com/i
  };
  return rules[social] ? rules[social].test(value) : /^https?:\/\//i.test(value);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || FALLBACK_TG_BOT;
  const chatId = process.env.TELEGRAM_CHAT_ID || FALLBACK_TG_CHAT;

  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function createJapOrder(serviceConfig, link) {
  const key = process.env.JAP_API_KEY || FALLBACK_JAP_KEY;

  const response = await fetch(JAP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      key,
      action: 'add',
      service: String(serviceConfig.service),
      link: String(link),
      quantity: String(serviceConfig.quantity)
    })
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { giftKey, giftTitle, giftId, deviceId, social, link, telegramUser } = req.body || {};

    if (!giftKey || !giftId || !social || !link || !telegramUser) {
      return res.status(400).json({ error: 'Не хватает данных для подарка' });
    }

    if (!isValidLink(social, link)) {
      return res.status(400).json({ error: 'Некорректная ссылка для выбранной соцсети' });
    }

    const serviceConfig = SERVICE_MAP[giftKey]?.[social];
    let japData = null;
    let japOrder = null;
    let autoCreated = false;

    if (serviceConfig) {
      japData = await createJapOrder(serviceConfig, link);
      japOrder = japData.order || null;
      autoCreated = Boolean(japOrder);
    }

    const message = `🎁 Бесплатный подарок пользователю\n\nID подарка: ${escapeText(giftId)}\nDevice ID: ${escapeText(deviceId)}\nПодарок: ${escapeText(giftTitle)}\nСоцсеть: ${escapeText(social)}\nTelegram: ${escapeText(telegramUser)}\nСсылка: ${escapeText(link)}\n\nJAP услуга: ${serviceConfig ? `${serviceConfig.service} — ${serviceConfig.label}` : 'нет авто-позиции'}\nКоличество: ${serviceConfig ? serviceConfig.quantity : 'ручная проверка'}\nJAP ID: ${japOrder || 'не создан'}\nСтатус: ${autoCreated ? '✅ создан автоматически' : '⚠️ нужна ручная проверка'}\n\nОтвет JAP:\n${JSON.stringify(japData || {}, null, 2)}`;

    await sendTelegram(message);

    return res.status(200).json({
      success: true,
      autoCreated,
      japOrder,
      japData
    });
  } catch (e) {
    console.error(e);
    try {
      await sendTelegram(`❌ Ошибка бесплатного подарка:\n${e.message}`);
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
