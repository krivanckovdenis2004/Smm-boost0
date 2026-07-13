// Динамический каталог услуг JAP для SMM-Boost.
// Берет все услуги через JAP API, переводит названия/категории на русский и добавляет наценку.

const JAP_API_URL = 'https://justanotherpanel.com/api/v2';
const DEFAULT_USD_RUB_RATE = 100;
const MARKUP_PERCENT = 10;

// Ручной резерв, если JAP временно недоступен. Нужен, чтобы сайт не падал.
export const SERVICE_CATALOG = [
  { id: '10122', name: 'TikTok лайки', platform: 'TikTok', category: 'Лайки', price: 11, mode: 'per1000', min: 50, max: 500000 },
  { id: '10019', name: 'TikTok просмотры', platform: 'TikTok', category: 'Просмотры', price: 5, mode: 'per1000', min: 100, max: 1000000 },
  { id: '10238', name: 'TikTok подписчики', platform: 'TikTok', category: 'Подписчики', price: 320, mode: 'per1000', min: 100, max: 10000 },
  { id: '4186', name: 'VK друзья', platform: 'VK', category: 'Друзья', price: 159, mode: 'per1000', min: 100, max: 1000000 },
  { id: '3752', name: 'VK подписчики в группу', platform: 'VK', category: 'Подписчики', price: 129, mode: 'per1000', min: 100, max: 1000000 }
];

let cachedServices = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

function getUsdRubRate() {
  const value = Number(process.env.USD_RUB_RATE || process.env.RUB_RATE || DEFAULT_USD_RUB_RATE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_RUB_RATE;
}

function cleanText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferPlatform(text) {
  const s = String(text || '').toLowerCase();
  if (/tiktok|tik tok|тик\s?ток/i.test(s)) return 'TikTok';
  if (/instagram|инстаграм|insta/i.test(s)) return 'Instagram';
  if (/youtube|youtu\.be|ютуб/i.test(s)) return 'YouTube';
  if (/telegram|телеграм|t\.me/i.test(s)) return 'Telegram';
  if (/vk|vkontakte|вконтакте|вк/i.test(s)) return 'VK';
  if (/facebook/i.test(s)) return 'Facebook';
  if (/twitter|x \(|x\)/i.test(s)) return 'X / Twitter';
  if (/spotify/i.test(s)) return 'Spotify';
  if (/discord/i.test(s)) return 'Discord';
  if (/twitch/i.test(s)) return 'Twitch';
  if (/linkedin/i.test(s)) return 'LinkedIn';
  if (/website|traffic|сайт|трафик/i.test(s)) return 'Сайт';
  return 'Другое';
}

function inferCategory(text) {
  const s = String(text || '').toLowerCase();
  if (/followers|subscriber|subscribers|подписчик|подписчики|участники|members|member/i.test(s)) return 'Подписчики';
  if (/likes|like|лайк|лайки/i.test(s)) return 'Лайки';
  if (/views|view|просмотр|просмотры|охват|impression|reach/i.test(s)) return 'Просмотры';
  if (/comment|comments|комментар/i.test(s)) return 'Комментарии';
  if (/repost|share|shares|репост/i.test(s)) return 'Репосты';
  if (/friend|friends|друзья/i.test(s)) return 'Друзья';
  if (/reaction|reactions|реакци/i.test(s)) return 'Реакции';
  if (/save|saves|сохран/i.test(s)) return 'Сохранения';
  if (/story|stories|сторис/i.test(s)) return 'Stories';
  if (/live|stream/i.test(s)) return 'Прямой эфир';
  return 'Другое';
}

function translateName(name, platform, category) {
  let s = cleanText(name);

  // Убираем лишний англоязычный шум, но оставляем важные пометки HQ/Refill/Max/Speed.
  s = s
    .replace(/Tik\s?Tok/ig, 'TikTok')
    .replace(/Instagram/ig, 'Instagram')
    .replace(/YouTube/ig, 'YouTube')
    .replace(/Telegram/ig, 'Telegram')
    .replace(/VKontakte|Vkontakte/ig, 'VK')
    .replace(/Followers?/ig, 'подписчики')
    .replace(/Subscribers?/ig, 'подписчики')
    .replace(/Members?/ig, 'участники')
    .replace(/Likes?/ig, 'лайки')
    .replace(/Views?/ig, 'просмотры')
    .replace(/Comments?/ig, 'комментарии')
    .replace(/Shares?/ig, 'репосты')
    .replace(/Reposts?/ig, 'репосты')
    .replace(/Friends?/ig, 'друзья')
    .replace(/Reactions?/ig, 'реакции')
    .replace(/Saves?/ig, 'сохранения')
    .replace(/Story|Stories/ig, 'сторис')
    .replace(/Channel/ig, 'канал')
    .replace(/Group/ig, 'группа')
    .replace(/Post/ig, 'пост')
    .replace(/Video/ig, 'видео')
    .replace(/Profile/ig, 'профиль')
    .replace(/Start Time/ig, 'старт')
    .replace(/Speed/ig, 'скорость')
    .replace(/Refill/ig, 'гарантия')
    .replace(/No Refill/ig, 'без гарантии')
    .replace(/High Quality|HQ/ig, 'HQ')
    .replace(/Real/ig, 'реальные')
    .replace(/Cheap/ig, 'дешевые')
    .replace(/Instant/ig, 'быстрый старт')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s || /^\d+$/.test(s)) return `${platform} — ${category}`;
  return s;
}

function normalizeService(item) {
  const rawName = cleanText(item.name || item.service_name || item.title || '');
  const rawCategory = cleanText(item.category || item.category_name || '');
  const joined = `${rawCategory} ${rawName}`;
  const platform = inferPlatform(joined);
  const category = inferCategory(joined);
  const rateUsd = Number(item.rate || item.price || 0);
  const rubRate = getUsdRubRate();
  const priceRub = Number((rateUsd * rubRate * (1 + MARKUP_PERCENT / 100)).toFixed(2));

  return {
    id: String(item.service || item.id || '').trim(),
    name: translateName(rawName, platform, category),
    originalName: rawName,
    originalCategory: rawCategory,
    platform,
    category,
    price: priceRub,
    rateUsd: Number.isFinite(rateUsd) ? rateUsd : 0,
    mode: 'per1000',
    min: Math.max(1, Math.floor(Number(item.min || item.minimum || 1))),
    max: Math.max(1, Math.floor(Number(item.max || item.maximum || 1000000))),
    type: cleanText(item.type || ''),
    refill: Boolean(item.refill) || /refill/i.test(rawName),
    dripfeed: Boolean(item.dripfeed),
    averageTime: cleanText(item.average_time || item.averageTime || item.avg_time || '')
  };
}

async function fetchJapServices() {
  const key = process.env.JAP_API_KEY || '';
  if (!key) return SERVICE_CATALOG;

  const now = Date.now();
  if (cachedServices && now - cachedAt < CACHE_TTL_MS) return cachedServices;

  const response = await fetch(JAP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key, action: 'services' })
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('JAP вернул не JSON при загрузке услуг'); }

  if (!Array.isArray(data)) {
    const message = data?.error || data?.message || 'JAP не вернул список услуг';
    throw new Error(message);
  }

  cachedServices = data
    .map(normalizeService)
    .filter(s => s.id && s.price > 0 && s.min > 0 && s.max >= s.min)
    .sort((a, b) => {
      const pa = String(a.platform).localeCompare(String(b.platform), 'ru');
      if (pa) return pa;
      const ca = String(a.category).localeCompare(String(b.category), 'ru');
      if (ca) return ca;
      return Number(a.price) - Number(b.price);
    });
  cachedAt = now;
  return cachedServices;
}

export async function getAllServices() {
  try {
    return await fetchJapServices();
  } catch (e) {
    console.error('JAP services fallback:', e.message);
    return SERVICE_CATALOG;
  }
}

export async function getServiceById(serviceId) {
  const rawId = String(serviceId || '').trim();
  const aliases = {
    '8777': '10238',
    '10136': '10238',
    '10022': '10122',
    '8101': '10122',
    '8526': '10019',
    '2260': '10019',
    '1543': '3752'
  };
  const normalizedId = aliases[rawId] || rawId;
  const services = await getAllServices();
  return services.find(item => String(item.id) === String(normalizedId));
}

export function calcServicePrice(service, quantity) {
  const qty = Number(quantity || 0);
  if (!service || !Number.isFinite(qty)) return 0;
  return (qty / 1000) * Number(service.price || 0);
}

function platformFromService(service) {
  return service?.platform || inferPlatform(`${service?.originalCategory || ''} ${service?.name || ''}`);
}

export async function validateOrderPayload(payload = {}) {
  const service = await getServiceById(payload.serviceId);
  if (!service) {
    return { ok: false, error: `Услуга не найдена. Обновите страницу и выберите услугу заново. ID: ${String(payload.serviceId || '—')}` };
  }

  const quantity = Math.floor(Number(payload.quantity || 0));
  if (!Number.isFinite(quantity) || quantity < service.min || quantity > service.max) {
    return { ok: false, error: `Неверное количество. Минимум: ${service.min}, максимум: ${service.max}` };
  }

  let link = String(payload.link || '').trim();
  if (!link) return { ok: false, error: 'Введите ссылку на профиль, пост или видео' };

  if (!/^https?:\/\//i.test(link)) {
    if (/^(www\.|instagram\.com|tiktok\.com|vk\.com|vk\.ru|t\.me|telegram\.me|telegram\.dog|youtube\.com|youtu\.be|facebook\.com|x\.com|twitter\.com|twitch\.tv|discord\.gg|open\.spotify\.com)/i.test(link)) {
      link = 'https://' + link.replace(/^\/\/+/, '');
    } else {
      return { ok: false, error: 'Введите полную ссылку, например https://www.tiktok.com/@username' };
    }
  }

  const platform = platformFromService(service);
  const linkLower = link.toLowerCase();
  const checks = {
    'Telegram': /(t\.me|telegram\.me|telegram\.dog)/i,
    'VK': /(vk\.com|vk\.ru)/i,
    'TikTok': /tiktok\.com/i,
    'YouTube': /(youtube\.com|youtu\.be)/i,
    'Instagram': /instagram\.com/i,
    'Facebook': /facebook\.com/i,
    'X / Twitter': /(x\.com|twitter\.com)/i,
    'Twitch': /twitch\.tv/i,
    'Spotify': /open\.spotify\.com/i,
    'Discord': /(discord\.gg|discord\.com)/i
  };
  const rule = checks[platform];
  if (rule && !rule.test(linkLower)) {
    return { ok: false, error: `Ссылка не подходит для выбранной соцсети: ${platform}` };
  }

  const priceRub = Number(calcServicePrice(service, quantity).toFixed(2));
  if (priceRub <= 0) return { ok: false, error: 'Неверная цена услуги' };

  return { ok: true, service, quantity, link, priceRub };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const services = await getAllServices();
    const platforms = [...new Set(services.map(s => s.platform).filter(Boolean))];
    const categories = [...new Set(services.map(s => s.category).filter(Boolean))];
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({
      ok: true,
      markupPercent: MARKUP_PERCENT,
      usdRubRate: getUsdRubRate(),
      count: services.length,
      platforms,
      categories,
      services
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
