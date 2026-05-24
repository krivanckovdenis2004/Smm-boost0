const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8539363038:AAGm30GEC8_k9YYlFfEFx5mI3iKeiMPAYSU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8676446654';

const SERVICE_MAP = {
  followers: {
    TikTok: { service: 10137, label: 'TikTok подписчики HQ' },
    Telegram: { service: 8862, label: 'Telegram участники RU' },
    VK: { service: 4184, label: 'VK подписчики в группу' },
    YouTube: { service: 3519, label: 'YouTube подписчики' },
    Instagram: { service: 8841, label: 'Instagram рост аудитории' }
  },
  views: {
    TikTok: { service: 10020, label: 'TikTok просмотры' },
    Telegram: { service: 8811, label: 'Telegram просмотры' },
    VK: { service: 3769, label: 'VK просмотры поста' },
    YouTube: { service: 8040, label: 'YouTube просмотры' },
    Instagram: { service: 6454, label: 'Instagram просмотры' }
  },
  likes: {
    TikTok: { service: 8101, label: 'TikTok лайки' },
    Telegram: { service: 8485, label: 'Telegram реакции + просмотры' },
    VK: { service: 8486, label: 'VK лайки' },
    YouTube: { service: 8668, label: 'YouTube лайки' },
    Instagram: { service: 10130, label: 'Instagram вовлеченность' }
  }
};

function clean(value) {
  return String(value || '').replace(/[<>]/g, '').slice(0, 1000);
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
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { source, giftKey, giftTitle, giftId, quantity, deviceId, social, link, telegramUser } = req.body || {};

    if (!giftKey || !giftId || !quantity || !social || !link || !telegramUser) {
      return res.status(400).json({ error: 'Не хватает данных для подарка' });
    }

    if (!isValidLink(social, link)) {
      return res.status(400).json({ error: 'Некорректная ссылка для выбранной соцсети' });
    }

    const serviceConfig = SERVICE_MAP[giftKey]?.[social] || null;

    // ВАЖНО: бесплатные подарки НЕ создают заказ в JAP автоматически.
    // Это защита баланса: endpoint публичный, его могут дергать боты.
    // Заявка приходит в Telegram, а JAP создается вручную после проверки подписки.
    const message = `🎁 Бесплатный подарок пользователю\n\nИсточник: ${clean(source)}\nID подарка: ${clean(giftId)}\nDevice ID: ${clean(deviceId)}\nПодарок: ${clean(giftTitle)}\nКоличество: ${clean(quantity)}\nСоцсеть: ${clean(social)}\nКонтакт: ${clean(telegramUser)}\nСсылка: ${clean(link)}\n\nРекомендуемая JAP услуга: ${serviceConfig ? `${serviceConfig.service} — ${serviceConfig.label}` : 'нет авто-позиции'}\nСтатус: 🛡 авто-заказ отключен ради защиты баланса. Проверь подписку и создай вручную.`;

    await sendTelegram(message);

    return res.status(200).json({
      success: true,
      autoCreated: false,
      japOrder: null,
      protected: true,
      message: 'Заявка отправлена администратору. После проверки подписки подарок будет выдан.'
    });
  } catch (e) {
    console.error(e);
    try { await sendTelegram(`❌ Ошибка бесплатного подарка:\n${e.message}`); } catch {}
    return res.status(500).json({ error: e.message });
  }
}
