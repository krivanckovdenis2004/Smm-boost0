# smm-boost-auth-v11 — Надёжная проверка Firebase ID Token

## Причина
В v10 верификация ID Token шла через `identitytoolkit.googleapis.com/v1/accounts:lookup`
с публичным Web API Key. У этого ключа в Google Cloud стоят HTTP-referer restrictions
(smm-boost.pro), поэтому server-side вызов с Vercel возвращает 403 → resolveAuthedUser
падает на legacy sessionToken → API отдаёт "Аккаунт не найден" / "Ошибка создания оплаты".

## Фикс (только 1 файл)
`api/_lib/shared.js` — verifyFirebaseIdToken теперь проверяет подпись JWT напрямую:
  - Тянет публичные сертификаты Google securetoken (`.../x509/securetoken@system.gserviceaccount.com`)
  - Кэширует по Cache-Control max-age
  - Проверяет alg=RS256, kid, exp/iat, aud=projectId, iss=securetoken.google.com/<projectId>
  - Верифицирует RSA-SHA256 подпись через node:crypto

Не нужен ни firebase-admin, ни разблокировка API-ключа. Работает на Vercel serverless.

## Как заменить
Просто перезаписать один файл: `api/_lib/shared.js`.
