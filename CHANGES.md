# CHANGES.md — Security Stage 1 + оптимизация Serverless Functions

Дата: 2026-07-10
Проект: SMM-Boost

## 1. Изменённые файлы

| Файл | Что изменено |
|---|---|
| `admin.html` | Убран литеральный пароль из клиентского кода. Логин админа теперь через `POST /api/admin-login`; при успехе в `sessionStorage` кладётся короткоживущий токен. |
| `api/balance-order.js` | Добавлена идемпотентность по `requestId` (коллекция `order_requests`). Проверка сессии `sessionToken`. Списание средств через `runTransaction` только **после** успешного ответа JAP. Валидация payload через `service-catalog.validateOrderPayload`. Таймаут запроса к JAP + AbortController. |
| `api/check-status.js` | Требование `userId`+`sessionToken`, проверка владельца заказа перед возвратом статуса. |
| `api/cryptobot-webhook.js` | Проверка HMAC-подписи (`crypto-pay-api-signature`). Идемпотентность по `invoice_id`. Транзакционное зачисление на баланс. |
| `api/yookassa-webhook.js` | Проверка `event=payment.succeeded`, идемпотентность по `payment.id`. Транзакционное зачисление. |
| `api/free-gift.js` | Транзакционное списание/начисление, защита от повторного получения. |
| `app.js` | Замена прямых записей в Firestore на вызовы серверных API. Использование `sessionToken`. |
| `package.json` | Актуализированы зависимости (`firebase`), убраны лишние. |
| `vercel.json` | Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Rewrite `/api/create-balance-yookassa` → `/api/create-balance-invoice?provider=yookassa`. |
| `api/create-balance-invoice.js` | Объединён с бывшим `api/create-balance-yookassa.js`. Диспетчер `detectProvider()` по URL/`req.body.provider`. |

## 2. Новые файлы

| Файл | Назначение |
|---|---|
| `api/admin-login.js` | Серверная проверка пароля админа. `ADMIN_PASSWORD` берётся из env. Timing-safe compare через `crypto.timingSafeEqual`. Rate-limit в памяти инстанса (8 попыток / 15 мин на IP). Выдаёт случайный токен-маркер сессии. |
| `firestore.rules` | Полностью закрывает прямую запись с клиента во все коллекции (`users`, `orders`, `topups`). Чтение — только владельцу. **Требуется ручной деплой в Firebase.** |
| `CHANGES.md` | Этот файл. |

## 3. Файлы, которые нужно удалить из репозитория GitHub

| Файл | Причина |
|---|---|
| `api/create-balance-yookassa.js` | Логика перенесена в `api/create-balance-invoice.js`. Совместимость сохранена через rewrite в `vercel.json` — фронтенд (`wallet.js`) продолжает вызывать `/api/create-balance-yookassa` без изменений. |

Других файлов на удаление нет.

## 4. Переименованные файлы

Нет.

## 5. Объединение Serverless Functions

Было 13 функций → превышение лимита Vercel Hobby (максимум 12).

**Объединено:**
- `api/create-balance-yookassa.js` + `api/create-balance-invoice.js` → **`api/create-balance-invoice.js`**
  - Один файл обслуживает обоих провайдеров.
  - Провайдер определяется функцией `detectProvider(req)`:
    - если `req.body.provider === 'yookassa'` → YooKassa;
    - если URL содержит `yookassa` (через rewrite) → YooKassa;
    - иначе → CryptoBot (по умолчанию).
  - Rewrite в `vercel.json` перенаправляет старый путь `/api/create-balance-yookassa` на `/api/create-balance-invoice?provider=yookassa`, поэтому фронтенд не требует правок.

**Итоговый список — 12 функций в `api/`:**
1. `admin-login.js`
2. `auth-social-register.js`
3. `balance-order.js`
4. `check-status.js`
5. `create-balance-invoice.js` *(CryptoBot + YooKassa)*
6. `create-vpn-order.js`
7. `cryptobot-webhook.js`
8. `free-gift.js`
9. `list-orders.js`
10. `service-catalog.js` *(и helper, и endpoint для фронта)*
11. `social-bonus.js`
12. `yookassa-webhook.js`

## 6. Ручные действия после замены файлов

### 6.1. Environment Variables в Vercel
Убедиться, что в Project Settings → Environment Variables заданы (значения оставить прежние — не ротировать):
- `ADMIN_PASSWORD` — пароль админ-панели (**обязательно, новое требование**).
- `JAP_API_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `CRYPTOBOT_TOKEN`
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`

Если `ADMIN_PASSWORD` не задан — `/api/admin-login` вернёт 500. Это единственная новая переменная окружения.

### 6.2. Деплой Firestore Rules
Правила из `firestore.rules` **не деплоятся автоматически**. Выполнить один раз:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project smm-boost-905d5
```

Либо скопировать содержимое `firestore.rules` в Firebase Console → Firestore Database → Rules → Publish.

**Без этого шага защита Firestore не активна** (серверные API уже работают правильно, но клиент теоретически всё ещё может писать напрямую).

### 6.3. Проверка Firebase Web API Key
Ключ публичный (лежит в клиентском коде — это норма для Firebase), но в Google Cloud Console → APIs & Services → Credentials рекомендуется:
- ограничить HTTP referrer доменом `smm-boost.pro` и `*.vercel.app`;
- ограничить список API (Identity Toolkit, Firestore, Firebase Installations).

## 7. Работоспособность после удаления перечисленных файлов

Да, подтверждаю: после удаления `api/create-balance-yookassa.js` проект остаётся полностью работоспособным:

- Фронтенд `wallet.js` вызывает `POST /api/create-balance-yookassa` → rewrite в `vercel.json` направляет запрос на `/api/create-balance-invoice?provider=yookassa` → диспетчер вызывает ветку YooKassa. Ответ идентичен старому.
- Фронтенд `wallet.js` также вызывает `POST /api/create-balance-invoice` → диспетчер по умолчанию использует CryptoBot. Ответ идентичен старому.
- Все остальные эндпоинты не тронуты.
- Число функций строго 12 → соответствует лимиту Vercel Hobby → деплой пройдёт.

## Итог по Security Stage 1

Устранённые уязвимости:
- Литеральный пароль админа в клиентском JS → серверная проверка.
- Прямая запись клиента в Firestore (`orders`, `users`, `topups`) → закрыто правилами + серверные API.
- Отсутствие проверки подписи вебхуков → HMAC для CryptoBot, валидация статуса для YooKassa.
- Race conditions на балансе / повторные начисления бонусов / повторные заказы → `runTransaction` + идемпотентность по `requestId`/`invoice_id`/`payment.id`.
- Списание средств до подтверждения JAP → списание только после успеха.
- Отсутствие security headers → CSP, HSTS, X-Frame-Options и др. в `vercel.json`.
- Отсутствие rate-limit на логин админа → 8 попыток / 15 мин на IP.

Осталось на Stage 2 (не входит в этот архив):
- JWT-сессия админа вместо sessionStorage-токена + серверные админ-эндпоинты для изменения балансов/статусов.
- Аудит SEO, мобильной адаптации, производительности.
- Ограничение Firebase Web API Key в Google Cloud Console (пункт 6.3).
