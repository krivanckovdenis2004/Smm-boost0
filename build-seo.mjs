// SMM-Boost programmatic SEO generator
// Generates clean-URL folder pages: /{platform}/{service}/index.html
// Regenerates sitemap.xml, robots.txt, 404.html, manifest.webmanifest
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const SITE = 'https://smm-boost.pro';
const YEAR = 2026;

// Каталог: платформа -> список услуг с уникальными SEO текстами.
// Цены соответствуют типичным ставкам JAP + наценка ~10%.
const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    emoji: '📸',
    color: '#E1306C',
    linkExample: 'https://www.instagram.com/username',
    services: {
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 189, min: 50, unit: 'подписчиков', keyword: 'накрутка подписчиков Instagram' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 39, min: 20, unit: 'лайков', keyword: 'накрутка лайков Instagram' },
      'views': { title: 'просмотров видео', h1Word: 'просмотров', price: 19, min: 100, unit: 'просмотров', keyword: 'накрутка просмотров Instagram' },
      'comments': { title: 'комментариев', h1Word: 'комментариев', price: 299, min: 10, unit: 'комментариев', keyword: 'накрутка комментариев Instagram' },
      'reels-views': { title: 'просмотров Reels', h1Word: 'просмотров Reels', price: 25, min: 100, unit: 'просмотров', keyword: 'накрутка Reels' },
      'story-views': { title: 'просмотров Stories', h1Word: 'просмотров Stories', price: 49, min: 100, unit: 'просмотров', keyword: 'накрутка Stories' },
      'saves': { title: 'сохранений', h1Word: 'сохранений', price: 59, min: 20, unit: 'сохранений', keyword: 'накрутка сохранений Instagram' },
      'reach': { title: 'охватов', h1Word: 'охвата', price: 79, min: 100, unit: 'охватов', keyword: 'накрутка охватов Instagram' }
    }
  },
  tiktok: {
    label: 'TikTok',
    emoji: '📱',
    color: '#00F2EA',
    linkExample: 'https://www.tiktok.com/@username',
    services: {
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 349, min: 100, unit: 'подписчиков', keyword: 'накрутка подписчиков TikTok' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 12, min: 50, unit: 'лайков', keyword: 'накрутка лайков TikTok' },
      'views': { title: 'просмотров', h1Word: 'просмотров', price: 6, min: 100, unit: 'просмотров', keyword: 'накрутка просмотров TikTok' },
      'comments': { title: 'комментариев', h1Word: 'комментариев', price: 249, min: 10, unit: 'комментариев', keyword: 'накрутка комментариев TikTok' },
      'shares': { title: 'репостов', h1Word: 'репостов', price: 19, min: 50, unit: 'репостов', keyword: 'накрутка репостов TikTok' },
      'live-views': { title: 'зрителей прямого эфира', h1Word: 'зрителей LIVE', price: 199, min: 50, unit: 'зрителей', keyword: 'зрители TikTok LIVE' },
      'saves': { title: 'сохранений', h1Word: 'сохранений', price: 29, min: 50, unit: 'сохранений', keyword: 'сохранения TikTok' }
    }
  },
  youtube: {
    label: 'YouTube',
    emoji: '▶️',
    color: '#FF0000',
    linkExample: 'https://www.youtube.com/watch?v=xxxxxxxx',
    services: {
      'subscribers': { title: 'подписчиков', h1Word: 'подписчиков', price: 690, min: 50, unit: 'подписчиков', keyword: 'накрутка подписчиков YouTube' },
      'views': { title: 'просмотров', h1Word: 'просмотров', price: 149, min: 500, unit: 'просмотров', keyword: 'накрутка просмотров YouTube' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 179, min: 20, unit: 'лайков', keyword: 'накрутка лайков YouTube' },
      'comments': { title: 'комментариев', h1Word: 'комментариев', price: 349, min: 10, unit: 'комментариев', keyword: 'накрутка комментариев YouTube' },
      'watch-time': { title: 'часов просмотра', h1Word: 'часов просмотра', price: 590, min: 50, unit: 'часов', keyword: '4000 часов просмотра YouTube' },
      'shorts-views': { title: 'просмотров Shorts', h1Word: 'просмотров Shorts', price: 99, min: 500, unit: 'просмотров', keyword: 'накрутка Shorts' }
    }
  },
  telegram: {
    label: 'Telegram',
    emoji: '💬',
    color: '#229ED9',
    linkExample: 'https://t.me/channel',
    services: {
      'members': { title: 'участников канала', h1Word: 'подписчиков', price: 379, min: 100, unit: 'подписчиков', keyword: 'накрутка подписчиков Telegram' },
      'post-views': { title: 'просмотров поста', h1Word: 'просмотров', price: 39, min: 100, unit: 'просмотров', keyword: 'накрутка просмотров Telegram' },
      'reactions': { title: 'реакций', h1Word: 'реакций', price: 79, min: 20, unit: 'реакций', keyword: 'накрутка реакций Telegram' },
      'comments': { title: 'комментариев', h1Word: 'комментариев', price: 289, min: 10, unit: 'комментариев', keyword: 'накрутка комментариев Telegram' },
      'premium': { title: 'Premium-подписчиков', h1Word: 'Premium-подписчиков', price: 690, min: 50, unit: 'Premium-подписчиков', keyword: 'Telegram Premium подписчики' },
      'boosts': { title: 'бустов канала', h1Word: 'бустов', price: 149, min: 5, unit: 'бустов', keyword: 'буст Telegram канала' }
    }
  },
  vk: {
    label: 'VK',
    emoji: '🌐',
    color: '#0077FF',
    linkExample: 'https://vk.com/id123',
    services: {
      'friends': { title: 'друзей', h1Word: 'друзей', price: 179, min: 50, unit: 'друзей', keyword: 'накрутка друзей ВКонтакте' },
      'group-subscribers': { title: 'подписчиков группы', h1Word: 'подписчиков', price: 149, min: 100, unit: 'подписчиков', keyword: 'накрутка подписчиков группы ВК' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 39, min: 20, unit: 'лайков', keyword: 'накрутка лайков ВК' },
      'views': { title: 'просмотров', h1Word: 'просмотров', price: 15, min: 100, unit: 'просмотров', keyword: 'накрутка просмотров ВК' },
      'reposts': { title: 'репостов', h1Word: 'репостов', price: 99, min: 20, unit: 'репостов', keyword: 'накрутка репостов ВК' },
      'comments': { title: 'комментариев', h1Word: 'комментариев', price: 249, min: 10, unit: 'комментариев', keyword: 'накрутка комментариев ВК' }
    }
  },
  facebook: {
    label: 'Facebook',
    emoji: '📘',
    color: '#1877F2',
    linkExample: 'https://www.facebook.com/username',
    services: {
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 259, min: 50, unit: 'подписчиков', keyword: 'подписчики Facebook' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 89, min: 20, unit: 'лайков', keyword: 'лайки Facebook' },
      'views': { title: 'просмотров', h1Word: 'просмотров', price: 39, min: 100, unit: 'просмотров', keyword: 'просмотры Facebook' }
    }
  },
  twitter: {
    label: 'X / Twitter',
    emoji: '🐦',
    color: '#000000',
    linkExample: 'https://x.com/username',
    services: {
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 399, min: 50, unit: 'подписчиков', keyword: 'подписчики X Twitter' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 59, min: 20, unit: 'лайков', keyword: 'лайки X Twitter' },
      'views': { title: 'просмотров', h1Word: 'просмотров', price: 19, min: 100, unit: 'просмотров', keyword: 'просмотры Twitter' },
      'retweets': { title: 'ретвитов', h1Word: 'ретвитов', price: 129, min: 20, unit: 'ретвитов', keyword: 'ретвиты X' }
    }
  },
  twitch: {
    label: 'Twitch',
    emoji: '🎮',
    color: '#9146FF',
    linkExample: 'https://www.twitch.tv/username',
    services: {
      'followers': { title: 'фолловеров', h1Word: 'фолловеров', price: 249, min: 50, unit: 'фолловеров', keyword: 'фолловеры Twitch' },
      'views': { title: 'зрителей', h1Word: 'зрителей', price: 199, min: 20, unit: 'зрителей', keyword: 'зрители Twitch' }
    }
  },
  spotify: {
    label: 'Spotify',
    emoji: '🎧',
    color: '#1DB954',
    linkExample: 'https://open.spotify.com/artist/xxx',
    services: {
      'plays': { title: 'прослушиваний', h1Word: 'прослушиваний', price: 89, min: 500, unit: 'прослушиваний', keyword: 'прослушивания Spotify' },
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 199, min: 50, unit: 'подписчиков', keyword: 'подписчики Spotify' },
      'monthly-listeners': { title: 'ежемесячных слушателей', h1Word: 'ежемесячных слушателей', price: 249, min: 100, unit: 'слушателей', keyword: 'ежемесячные слушатели Spotify' }
    }
  },
  discord: {
    label: 'Discord',
    emoji: '🎧',
    color: '#5865F2',
    linkExample: 'https://discord.gg/xxxxxx',
    services: {
      'members': { title: 'участников сервера', h1Word: 'участников', price: 349, min: 50, unit: 'участников', keyword: 'участники Discord сервера' }
    }
  },
  threads: {
    label: 'Threads',
    emoji: '🧵',
    color: '#000000',
    linkExample: 'https://www.threads.net/@username',
    services: {
      'followers': { title: 'подписчиков', h1Word: 'подписчиков', price: 279, min: 50, unit: 'подписчиков', keyword: 'подписчики Threads' },
      'likes': { title: 'лайков', h1Word: 'лайков', price: 49, min: 20, unit: 'лайков', keyword: 'лайки Threads' }
    }
  }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function fmtPrice(p) { return String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

function relatedInPlatform(platform, currentSlug) {
  return Object.entries(PLATFORMS[platform].services)
    .filter(([slug]) => slug !== currentSlug)
    .slice(0, 4)
    .map(([slug, s]) => ({
      href: `/${platform}/${slug}/`,
      title: `${PLATFORMS[platform].label} — ${s.title}`,
      price: s.price
    }));
}
function popularAcross(exclude) {
  const list = [
    { platform: 'instagram', slug: 'followers' },
    { platform: 'tiktok', slug: 'views' },
    { platform: 'youtube', slug: 'subscribers' },
    { platform: 'telegram', slug: 'members' },
    { platform: 'vk', slug: 'group-subscribers' },
    { platform: 'instagram', slug: 'likes' }
  ];
  return list
    .filter(x => `${x.platform}/${x.slug}` !== exclude)
    .slice(0, 4)
    .map(({ platform, slug }) => {
      const s = PLATFORMS[platform].services[slug];
      return { href: `/${platform}/${slug}/`, title: `${PLATFORMS[platform].label} — ${s.title}`, price: s.price };
    });
}
function frequentlyBought(platform, currentSlug) {
  // Пары, которые логично купить вместе
  const pairs = {
    followers: ['likes', 'views', 'comments'],
    likes: ['views', 'comments', 'followers'],
    views: ['likes', 'comments', 'followers'],
    comments: ['likes', 'views', 'followers'],
    subscribers: ['views', 'likes', 'comments'],
    members: ['post-views', 'reactions', 'comments'],
    'group-subscribers': ['likes', 'views', 'reposts'],
    friends: ['likes', 'views', 'reposts']
  };
  const partners = pairs[currentSlug] || Object.keys(PLATFORMS[platform].services);
  return partners
    .filter(slug => slug !== currentSlug && PLATFORMS[platform].services[slug])
    .slice(0, 3)
    .map(slug => {
      const s = PLATFORMS[platform].services[slug];
      return { href: `/${platform}/${slug}/`, title: `${PLATFORMS[platform].label} — ${s.title}`, price: s.price };
    });
}

const NAV = `
<nav class="navbar trust-navbar">
  <a class="nav-logo" href="/" aria-label="SMM-Boost главная">SMM-Boost</a>
  <div class="nav-links main-nav-links">
    <a href="/auth.html" class="nav-register-link">Зарегистрироваться</a>
    <button class="menu-toggle" type="button" aria-label="Открыть меню" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
  <div class="nav-menu" id="navMenu">
    <a href="/services.html"><span class="menu-emoji">🚀</span><span>Заказать услуги</span></a>
    <a href="/wallet.html"><span class="menu-emoji">💰</span><span>Баланс</span></a>
    <a href="/orders.html"><span class="menu-emoji">📦</span><span>Мои заказы</span></a>
    <a href="/auth.html"><span class="menu-emoji">🎁</span><span>Регистрация / вход</span></a>
    <a href="/free.html"><span class="menu-emoji">🎁</span><span>Бесплатная накрутка</span></a>
    <a href="/#faq"><span class="menu-emoji">❔</span><span>FAQ</span></a>
    <a href="/contacts.html"><span class="menu-emoji">💬</span><span>Поддержка</span></a>
    <a href="/privacy.html"><span class="menu-emoji">🛡</span><span>Политика</span></a>
  </div>
</nav>`;

const FOOTER = `
<footer class="footer trust-footer">
  <div class="footer-logo">SMM-Boost</div>
  <p>Продвижение социальных сетей</p>
  <div class="footer-links">
    <a href="/offer.html">Оферта</a>
    <a href="/privacy.html">Политика</a>
    <a href="/refund.html">Возврат</a>
    <a href="/contacts.html">Контакты</a>
    <a href="/services.html">Услуги</a>
    <a href="/free.html">Бесплатная накрутка</a>
  </div>
  <div class="footer-copy">© ${YEAR} SMM-Boost. Все права защищены.</div>
</footer>
<a href="https://t.me/smm_boost_vesty" class="telegram-support telegram-channel-fab" target="_blank" rel="noopener" aria-label="Telegram канал"><img src="https://cdn.simpleicons.org/telegram/FFFFFF" alt="Telegram канал" loading="lazy" decoding="async" /></a>
<a href="https://t.me/smm_boost_support0" class="telegram-support" target="_blank" rel="noopener" aria-label="Telegram поддержка"><img src="https://cdn.simpleicons.org/telegram/FFFFFF" alt="Telegram поддержка" loading="lazy" decoding="async" /></a>
<div id="live-orders"></div>
<script type="module" src="/app.js?v=20260714-seo"></script>
<script src="/user-state.js?v=20260714-seo"></script>
<script>
(function(){
  const btn=document.querySelector('.menu-toggle'),menu=document.querySelector('.nav-menu');
  if(!btn||!menu)return;
  btn.addEventListener('click',e=>{e.stopPropagation();const o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false');});
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!btn.contains(e.target)){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');}});
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');btn.setAttribute('aria-expanded','false');}));
})();
</script>`;

const HEAD_COMMON = (opts) => {
  const { title, desc, canonical, ogImage, keywords, robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' } = opts;
  return `<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="keywords" content="${esc(keywords)}" />
<meta name="robots" content="${robots}" />
<meta name="theme-color" content="#0b0716" />
<meta name="format-detection" content="telephone=no" />
<meta name="yandex-verification" content="78f301f98d510d8b" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" hreflang="ru" href="${canonical}" />
<link rel="alternate" hreflang="x-default" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="SMM-Boost" />
<meta property="og:locale" content="ru_RU" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${ogImage}" />
<link rel="icon" href="/favicon.ico" type="image/x-icon" />
<link rel="icon" type="image/png" href="/logo.png" />
<link rel="apple-touch-icon" href="/logo.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/style.css?v=20260714-seo" />
<link rel="preload" as="image" href="/logo.png" fetchpriority="high" />
<script src="/metrika-goals.js" defer></script>`;
};

function buildFaq(platform, svc, spec) {
  return [
    { q: `Как заказать ${spec.title} ${platform.label}?`, a: `Зарегистрируйтесь на SMM-Boost, пополните баланс от 100₽ и в разделе «Услуги» выберите «${platform.label} — ${spec.title}». Вставьте ссылку и укажите количество — заказ уйдёт в работу автоматически.` },
    { q: `Сколько стоит накрутка ${spec.title} ${platform.label}?`, a: `Стоимость от ${spec.price}₽ за 1000 ${spec.unit}. Итоговая цена рассчитывается автоматически исходя из количества и наценки ~10% к оптовой ставке JAP.` },
    { q: `Безопасно ли это для аккаунта?`, a: `Мы используем реальные и полу-реальные источники, соблюдаем безопасную скорость доставки. Пароль от аккаунта не нужен — заказ оформляется по публичной ссылке.` },
    { q: `Как быстро начнётся выполнение?`, a: `Обычно старт занимает от 1 до 30 минут. Скорость доставки зависит от выбранной услуги и объёма — детали видны в момент оформления.` },
    { q: `Есть ли гарантия и списание?`, a: `Многие услуги отмечены значком «гарантия» — при списаниях в течение 30 дней автоматически включается долив. Точный тип защиты указан в описании услуги.` },
    { q: `Можно ли получить накрутку бесплатно?`, a: `Да, на странице /free.html доступна бесплатная накрутка каждые 30 минут после регистрации и подписки на наш Telegram-канал.` }
  ];
}

function schemaBlocks({ platform, spec, url, breadcrumb, faq, title, description }) {
  const priceValue = spec.price.toFixed(2);
  return [
    {
      "@context":"https://schema.org","@type":"BreadcrumbList",
      itemListElement: breadcrumb.map((b,i)=>({
        "@type":"ListItem", position:i+1, name:b.name, item: b.url
      }))
    },
    {
      "@context":"https://schema.org","@type":"Product",
      name: title, description: description,
      brand:{"@type":"Brand", name:"SMM-Boost"},
      category:`${platform.label} — ${spec.title}`,
      image:[`${SITE}/preview.jpg`,`${SITE}/logo.png`],
      offers:{
        "@type":"Offer", url:url, priceCurrency:"RUB",
        price: priceValue,
        availability:"https://schema.org/InStock",
        priceValidUntil: `${YEAR+1}-12-31`,
        seller:{"@type":"Organization", name:"SMM-Boost"}
      },
      aggregateRating:{"@type":"AggregateRating", ratingValue:"4.9", reviewCount:"1284", bestRating:"5", worstRating:"1"}
    },
    {
      "@context":"https://schema.org","@type":"Service",
      serviceType:`Накрутка ${spec.title} ${platform.label}`,
      provider:{"@type":"Organization", name:"SMM-Boost", url:SITE},
      areaServed:{"@type":"Country", name:"Russia"},
      offers:{"@type":"Offer", price: priceValue, priceCurrency:"RUB", url:url}
    },
    {
      "@context":"https://schema.org","@type":"FAQPage",
      mainEntity: faq.map(f=>({
        "@type":"Question", name:f.q,
        acceptedAnswer:{"@type":"Answer", text:f.a}
      }))
    }
  ];
}

function renderServicePage(platformKey, slug) {
  const platform = PLATFORMS[platformKey];
  const spec = platform.services[slug];
  const url = `${SITE}/${platformKey}/${slug}/`;
  const title = `Накрутка ${spec.title} ${platform.label} — от ${fmtPrice(spec.price)} ₽/1000 | SMM-Boost`;
  const description = `${platform.emoji} Накрутка ${spec.title} ${platform.label} онлайн: от ${spec.min} ${spec.unit}, цена от ${spec.price}₽ за 1000. Быстрый старт, безопасно, оплата с баланса, поддержка 24/7.`;
  const keywords = `${spec.keyword}, накрутка ${platform.label}, ${spec.title} ${platform.label}, купить ${spec.title} ${platform.label}, продвижение ${platform.label}, smm boost`;
  const breadcrumb = [
    { name: 'Главная', url: `${SITE}/` },
    { name: platform.label, url: `${SITE}/${platformKey}/` },
    { name: spec.title, url: url }
  ];
  const faq = buildFaq(platform, spec, spec);
  const related = relatedInPlatform(platformKey, slug);
  const popular = popularAcross(`${platformKey}/${slug}`);
  const together = frequentlyBought(platformKey, slug);
  const schemas = schemaBlocks({ platform, spec, url, breadcrumb, faq, title, description });

  const orderHref = `/services.html?social=${encodeURIComponent(platform.label)}&category=${encodeURIComponent(spec.title.split(' ')[0])}`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
${HEAD_COMMON({ title, desc: description, canonical: url, ogImage: `${SITE}/preview.jpg`, keywords })}
${schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
</head>
<body class="trust-ui service-lp">
<div class="bg-animation" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
${NAV}

<nav class="breadcrumbs" aria-label="Хлебные крошки">
  <ol>
    ${breadcrumb.map((b,i)=>`<li>${i===breadcrumb.length-1?`<span aria-current="page">${esc(b.name)}</span>`:`<a href="${b.url.replace(SITE,'')||'/'}">${esc(b.name)}</a>`}</li>`).join('<li class="sep">›</li>')}
  </ol>
</nav>

<main>
<section class="hero trust-hero service-lp-hero">
  <div class="hero-content trust-hero-grid">
    <div class="trust-hero-copy">
      <div class="trust-kicker">${platform.emoji} ${platform.label} • ${esc(spec.title)}</div>
      <h1>Накрутка ${esc(spec.h1Word)} ${platform.label}</h1>
      <p class="hero-subtitle">Быстрый и безопасный способ увеличить ${esc(spec.title)} в ${platform.label}. Цена от <strong>${spec.price}₽ за 1000 ${esc(spec.unit)}</strong>, минимальный заказ — ${spec.min} ${esc(spec.unit)}. Оплата с баланса, старт от 1 минуты.</p>
      <div class="hero-main-actions">
        <a href="${orderHref}" class="hero-button">🚀 Заказать сейчас</a>
        <a href="/free.html" class="hero-button hero-register-button">🎁 Попробовать бесплатно</a>
      </div>
      <div class="trust-mini-row">
        <span>🛡 Безопасно для аккаунта</span>
        <span>⚡ Старт от 1 минуты</span>
        <span>💬 Поддержка 24/7</span>
      </div>
    </div>
    <aside class="trust-hero-card price-card" aria-label="Цена и условия">
      <div class="price-card-head">${platform.emoji} ${platform.label}</div>
      <div class="price-card-price"><strong>${fmtPrice(spec.price)}</strong><span>₽ / 1000</span></div>
      <ul class="price-card-list">
        <li>Мин. заказ: <b>${spec.min} ${esc(spec.unit)}</b></li>
        <li>Старт: 1–30 минут</li>
        <li>Долив при списании</li>
        <li>Не нужен пароль</li>
      </ul>
      <a href="${orderHref}" class="trust-card-button">Оформить заказ →</a>
    </aside>
  </div>
</section>

<section class="trust-section seo-service-text">
  <h2>Что вы получаете, заказав ${esc(spec.title)} ${platform.label}</h2>
  <p>${platform.label} — одна из главных площадок для роста в 2026 году. Накрутка ${esc(spec.title)} через SMM-Boost помогает выглядеть популярнее в глазах алгоритма и реальных пользователей: посты попадают в рекомендации, доверие к профилю растёт, а органический охват начинает подтягиваться самостоятельно. Мы работаем через проверенных провайдеров JAP, поэтому доставка идёт стабильно и без риска для аккаунта — пароль от профиля никогда не требуется, достаточно публичной ссылки вида <code>${esc(platform.linkExample)}</code>.</p>
</section>

<section class="trust-section trust-proof" aria-label="Преимущества">
  <div class="proof-card"><b>⚡ Быстрый старт</b><p>Заказ уходит в работу за 1–30 минут. Скорость и объём подстраиваются под безопасные лимиты ${platform.label}.</p></div>
  <div class="proof-card"><b>🛡 Безопасно</b><p>Никакого пароля и доступов. Работаем только по публичным ссылкам, аккаунт остаётся полностью под вашим контролем.</p></div>
  <div class="proof-card"><b>💳 Прозрачная оплата</b><p>Списание с баланса SMM-Boost. Пополнение от 100₽, есть СБП, карты РФ, ЮMoney и Crypto Bot.</p></div>
  <div class="proof-card"><b>🎁 Бонусы</b><p>Приветственный бонус на баланс + бесплатная накрутка каждые 30 минут в разделе Free.</p></div>
</section>

<section class="trust-section how-it-works">
  <div class="section-head">
    <span>Как заказать</span>
    <h2>Заказ ${esc(spec.title)} ${platform.label} в 3 шага</h2>
  </div>
  <div class="steps-grid">
    <div class="step-card"><strong>1</strong><b>Регистрация</b><p>Создайте аккаунт SMM-Boost за 30 секунд — почтой или через Google.</p></div>
    <div class="step-card"><strong>2</strong><b>Пополнение баланса</b><p>Пополните минимум 100₽ удобным способом. Средства зачислим моментально.</p></div>
    <div class="step-card"><strong>3</strong><b>Оформление заказа</b><p>В разделе «Услуги» выберите «${platform.label} — ${esc(spec.title)}», вставьте ссылку и количество.</p></div>
  </div>
</section>

<section class="trust-section why-us">
  <div class="section-head">
    <span>Почему выбирают нас</span>
    <h2>SMM-Boost — сервис №1 для ${platform.label}</h2>
  </div>
  <div class="review-grid">
    <div class="review-card"><b>🔥 5+ лет на рынке</b><p>Более 50 000 выполненных заказов и 12 000 постоянных клиентов, которые возвращаются снова.</p></div>
    <div class="review-card"><b>💬 Поддержка 24/7</b><p>Отвечаем в Telegram-чате в среднем за 3 минуты. Помогаем даже с настройкой профиля.</p></div>
    <div class="review-card"><b>🎯 Долив</b><p>Если ${platform.label} снял часть ${esc(spec.unit)} — мы автоматически восполним объём в течение 30 дней.</p></div>
  </div>
</section>

<section class="trust-section related-services" aria-label="Похожие услуги">
  <div class="section-head"><span>Похожие услуги ${platform.label}</span><h2>Что ещё можно накрутить в ${platform.label}</h2></div>
  <div class="category-grid">
    ${related.map(r=>`<a href="${r.href}" class="category-card"><b>${platform.emoji} ${esc(r.title)}</b><span>от ${fmtPrice(r.price)}₽ / 1000</span></a>`).join('')}
  </div>
</section>

<section class="trust-section related-services" aria-label="Часто покупают вместе">
  <div class="section-head"><span>Часто покупают вместе</span><h2>Комплекс для ${platform.label}</h2></div>
  <div class="category-grid">
    ${together.map(r=>`<a href="${r.href}" class="category-card"><b>${platform.emoji} ${esc(r.title)}</b><span>от ${fmtPrice(r.price)}₽ / 1000</span></a>`).join('')}
  </div>
</section>

<section class="trust-section related-services" aria-label="Популярные услуги">
  <div class="section-head"><span>Популярные услуги SMM-Boost</span><h2>Вам также может понравиться</h2></div>
  <div class="category-grid">
    ${popular.map(r=>`<a href="${r.href}" class="category-card"><b>${esc(r.title)}</b><span>от ${fmtPrice(r.price)}₽ / 1000</span></a>`).join('')}
  </div>
</section>

<section class="trust-section faq" id="faq" aria-label="Частые вопросы">
  <div class="section-head"><span>FAQ</span><h2>Частые вопросы про накрутку ${esc(spec.title)} ${platform.label}</h2></div>
  ${faq.map(f=>`<details class="faq-item"><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('')}
</section>

<section class="trust-section cta-block">
  <h2>Готовы увеличить ${esc(spec.title)} в ${platform.label}?</h2>
  <p>Начните с бесплатной накрутки или сразу оформите заказ от ${spec.min} ${esc(spec.unit)}.</p>
  <div class="hero-main-actions">
    <a href="${orderHref}" class="hero-button">🚀 Заказать за 1 минуту</a>
    <a href="/free.html" class="hero-button hero-register-button">🎁 Бесплатно</a>
  </div>
</section>
</main>
${FOOTER}
</body>
</html>`;
}

function renderPlatformIndex(platformKey) {
  const platform = PLATFORMS[platformKey];
  const url = `${SITE}/${platformKey}/`;
  const title = `Накрутка ${platform.label} — подписчики, лайки, просмотры от ${fmtPrice(Math.min(...Object.values(platform.services).map(s=>s.price)))}₽ | SMM-Boost`;
  const description = `${platform.emoji} Все услуги накрутки ${platform.label} на SMM-Boost: подписчики, лайки, просмотры, комментарии и другие метрики. Быстрый старт, безопасно, оплата с баланса.`;
  const keywords = `накрутка ${platform.label}, подписчики ${platform.label}, лайки ${platform.label}, просмотры ${platform.label}, продвижение ${platform.label}, smm boost`;
  const breadcrumb = [
    { name: 'Главная', url: `${SITE}/` },
    { name: platform.label, url: url }
  ];
  const services = Object.entries(platform.services).map(([slug, s]) => ({
    slug, s, href: `/${platformKey}/${slug}/`
  }));
  const schemas = [
    { "@context":"https://schema.org","@type":"BreadcrumbList",
      itemListElement: breadcrumb.map((b,i)=>({"@type":"ListItem", position:i+1, name:b.name, item:b.url})) },
    { "@context":"https://schema.org","@type":"CollectionPage",
      name: title, description, url,
      about:{"@type":"Thing", name:`${platform.label} продвижение`} },
    { "@context":"https://schema.org","@type":"ItemList",
      itemListElement: services.map((it,i)=>({
        "@type":"ListItem", position:i+1,
        url: `${SITE}${it.href}`,
        name: `${platform.label} — ${it.s.title}`
      }))
    }
  ];
  return `<!DOCTYPE html>
<html lang="ru">
<head>
${HEAD_COMMON({ title, desc: description, canonical: url, ogImage: `${SITE}/preview.jpg`, keywords })}
${schemas.map(s=>`<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
</head>
<body class="trust-ui platform-lp">
<div class="bg-animation" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
${NAV}
<nav class="breadcrumbs" aria-label="Хлебные крошки">
  <ol>
    <li><a href="/">Главная</a></li>
    <li class="sep">›</li>
    <li><span aria-current="page">${esc(platform.label)}</span></li>
  </ol>
</nav>
<main>
<section class="hero trust-hero">
  <div class="hero-content trust-hero-grid">
    <div class="trust-hero-copy">
      <div class="trust-kicker">${platform.emoji} ${platform.label}</div>
      <h1>Накрутка ${platform.label}</h1>
      <p class="hero-subtitle">Все услуги накрутки ${platform.label} в одном месте: подписчики, лайки, просмотры, комментарии и другие метрики. Быстрый старт, безопасно, оплата с баланса.</p>
      <div class="hero-main-actions">
        <a href="/services.html?social=${encodeURIComponent(platform.label)}" class="hero-button">🚀 Заказать сейчас</a>
        <a href="/free.html" class="hero-button hero-register-button">🎁 Бесплатная накрутка</a>
      </div>
    </div>
  </div>
</section>
<section class="trust-section">
  <div class="section-head"><span>Услуги ${platform.label}</span><h2>Выберите категорию</h2></div>
  <div class="category-grid">
    ${services.map(({href,s})=>`<a href="${href}" class="category-card"><b>${platform.emoji} ${esc(s.title)}</b><span>от ${fmtPrice(s.price)}₽ / 1000 · мин. ${s.min}</span></a>`).join('')}
  </div>
</section>
<section class="trust-section seo-service-text">
  <h2>Почему SMM-Boost для ${platform.label}</h2>
  <p>SMM-Boost помогает быстро прокачать профиль ${platform.label} без риска для аккаунта. Мы работаем с проверенными провайдерами JAP, поддерживаем безопасную скорость доставки и не запрашиваем пароль. Оплата идёт с баланса SMM-Boost — так вы видите все расходы в одном месте, а история заказов сохраняется в личном кабинете.</p>
</section>
${(() => {
  const pop = popularAcross(`${platformKey}/`);
  return `<section class="trust-section related-services"><div class="section-head"><span>Популярные направления</span><h2>Вам также может понравиться</h2></div><div class="category-grid">${pop.map(r=>`<a href="${r.href}" class="category-card"><b>${esc(r.title)}</b><span>от ${fmtPrice(r.price)}₽ / 1000</span></a>`).join('')}</div></section>`;
})()}
</main>
${FOOTER}
</body>
</html>`;
}

// === Write ===
function write(rel, content) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

const sitemapUrls = [];
function addUrl(u, changefreq='monthly', priority='0.6') {
  sitemapUrls.push({ url: u, changefreq, priority });
}

// Root static pages
[
  ['/', 'daily', '1.0'],
  ['/services.html', 'daily', '0.9'],
  ['/wallet.html', 'weekly', '0.7'],
  ['/orders.html', 'weekly', '0.6'],
  ['/auth.html', 'monthly', '0.5'],
  ['/free.html', 'weekly', '0.8'],
  ['/giveaway.html', 'weekly', '0.6'],
  ['/contacts.html', 'monthly', '0.5'],
  ['/referral.html', 'monthly', '0.5'],
  ['/mutuals.html', 'monthly', '0.4'],
  ['/track.html', 'monthly', '0.4'],
  ['/daily.html', 'weekly', '0.4'],
  ['/offer.html', 'yearly', '0.3'],
  ['/privacy.html', 'yearly', '0.3'],
  ['/refund.html', 'yearly', '0.3'],
  ['/terms.html', 'yearly', '0.3'],
  ['/agreement.html', 'yearly', '0.3']
].forEach(([u,c,p])=>addUrl(SITE+u,c,p));

// Programmatic pages
for (const [pk, platform] of Object.entries(PLATFORMS)) {
  write(`${pk}/index.html`, renderPlatformIndex(pk));
  addUrl(`${SITE}/${pk}/`, 'weekly', '0.8');
  for (const slug of Object.keys(platform.services)) {
    write(`${pk}/${slug}/index.html`, renderServicePage(pk, slug));
    addUrl(`${SITE}/${pk}/${slug}/`, 'weekly', '0.8');
  }
}

// sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(x=>`  <url><loc>${x.url}</loc><changefreq>${x.changefreq}</changefreq><priority>${x.priority}</priority></url>`).join('\n')}
</urlset>
`;
write('sitemap.xml', sitemapXml);

// robots.txt (расширенный)
write('robots.txt', `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin.html
Disallow: /admin.js
Disallow: /success.html
Disallow: /track.html?
Disallow: /*?utm_
Disallow: /*?fbclid
Disallow: /*?yclid
Disallow: /*?gclid

User-agent: Yandex
Allow: /
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid&fbclid /

User-agent: Googlebot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: CCBot
Allow: /

Host: smm-boost.pro
Sitemap: ${SITE}/sitemap.xml
`);

// manifest.webmanifest
write('manifest.webmanifest', JSON.stringify({
  name: "SMM-Boost — накрутка соцсетей",
  short_name: "SMM-Boost",
  description: "Премиум-сервис накрутки подписчиков, лайков и просмотров для TikTok, Instagram, Telegram, YouTube, VK.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0b0716",
  theme_color: "#0b0716",
  lang: "ru",
  icons: [
    { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
  ]
}, null, 2));

console.log(`generated ${sitemapUrls.length} urls; programmatic pages under ${Object.keys(PLATFORMS).length} platforms.`);
