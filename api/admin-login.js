import crypto from 'crypto';

// Простая защита от перебора: счётчик попыток по IP в памяти инстанса.
// На serverless состояние не гарантированно шарится между инстансами,
// но замедляет самые примитивные атаки. Полноценный rate-limit — Этап 2.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // выравниваем длину, чтобы избежать утечки длины через таймингы
    const max = Math.max(bufA.length, bufB.length);
    const padA = Buffer.concat([bufA, Buffer.alloc(max - bufA.length)]);
    const padB = Buffer.concat([bufB, Buffer.alloc(max - bufB.length)]);
    crypto.timingSafeEqual(padA, padB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server' });
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }
  if (record.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' });
  }

  const password = String(req.body?.password || '');
  if (!password) {
    return res.status(400).json({ error: 'Пароль обязателен' });
  }

  const ok = timingSafeEqualStr(password, expected);
  if (!ok) {
    record.count += 1;
    attempts.set(ip, record);
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  // Успех: сбрасываем счётчик и выдаём короткоживущий токен-сессию.
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  // Токен серверно не хранится (нет БД сессий на этом этапе).
  // Клиент кладёт его в sessionStorage — этого достаточно, чтобы убрать
  // literal-пароль из клиентского кода. Реальная защита админ-действий
  // придёт на Этапе 2 через firestore.rules + серверные админ-эндпоинты.
  return res.status(200).json({ ok: true, token });
}
