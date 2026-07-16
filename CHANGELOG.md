# smm-boost-auth-v10 — Fix "Аккаунт не найден"

## Причина
API проверяли только legacy `sessionToken` из Firestore. Если документ пользователя
не был создан (sync упал / инкогнито / первое подключение через Google) — все
операции возвращали "Аккаунт не найден. Войдите заново."

## Что исправлено
1. **api/_lib/shared.js** — новый универсальный резолвер `resolveAuthedUser(db, req)`:
   - Проверяет Firebase **ID Token** (через Identity Toolkit `accounts:lookup`).
   - Детерминированный `userId = sha256('email:'+email).slice(0,32)`.
   - **Автосоздаёт документ** в `users/{userId}`, если его нет.
   - Обновляет `sessionToken`/`firebaseUid` без затирания баланса.
   - Fallback на legacy `userId+sessionToken`, если ID Token отсутствует.

2. **API-эндпоинты** переведены на общий резолвер:
   - `api/create-balance-invoice.js` (YooKassa + CryptoBot)
   - `api/balance-order.js` (JAP заказы)
   - `api/list-orders.js`
   - `api/free-service.js` (GET + POST)

3. **Клиенты** теперь всегда прикладывают `idToken` от `auth.currentUser`:
   - `wallet.js` — пополнение
   - `app.js` — заказ через баланс
   - `orders.js` — список заказов
   - `free.js` — бесплатные услуги

## Как заменить
Скопировать файлы из архива с сохранением путей (перезаписывая).
Никакие переменные окружения не требуются.
