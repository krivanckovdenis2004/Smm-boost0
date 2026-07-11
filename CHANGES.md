# CHANGES — Возврат к простой регистрации/входу по логину и паролю

## Что сделано

Полностью удалены следы Google Auth, Firebase Auth и Firebase Admin SDK.
Регистрация и вход работают через тот же серверный API, что и до
экспериментов с Google Auth — клиентский Firebase SDK на сервере.

### 1. `api/auth-social-register.js` — переписан обратно
- Убраны импорты `firebase-admin/app`, `firebase-admin/firestore`,
  `cert`, `getApps` от admin.
- Возвращены импорты клиентского SDK: `firebase/app`, `firebase/firestore`.
- Убрана логика чтения `FIREBASE_SERVICE_ACCOUNT`. Никаких service-account,
  никаких переменных окружения для auth больше не нужно.
- Бизнес-логика без изменений: валидация логина, PBKDF2-хэш пароля,
  timing-safe сравнение, сессионный токен, бонус +5 ₽ при регистрации.
- Файл по-прежнему обрабатывает `action: register` и `action: login`.

### 2. `firestore.rules` — правила без Admin SDK
Так как серверный API пишет в Firestore без `request.auth`, правила
`/users/{userId}` разрешают `create/update` только для документов
правильной формы (обязательные поля `userId`, `passwordHash`,
`passwordSalt`, `username`) и запрещают перезапись хэша/соли/логина.
Чтение чужих документов и удаление запрещены. Заказы и пополнения —
только чтение владельцем, запись сервером.

### 3. `package.json`
- Удалена зависимость `firebase-admin`.
- Оставлен `firebase` — используется фронтендом и API.

### 4. Файлы Google Auth
На момент этого шага их в проекте уже не было (`google-auth.js` удалён
на предыдущей итерации). Дополнительно проверено — импортов Google Auth
в `auth.html`, `auth.js`, `wallet.html`, `index.html` нет.

## Изменённые файлы
- `api/auth-social-register.js`
- `firestore.rules`
- `package.json`
- `CHANGES.md`

## Новые файлы
- нет

## Удалить
- нет (все Google-файлы уже удалены ранее)

## Ручные действия
1. Опубликовать `firestore.rules`:
   ```
   firebase deploy --only firestore:rules --project smm-boost-905d5
   ```
   или Firebase Console → Firestore → Rules → вставить и Publish.
2. В Vercel Environment Variables можно удалить переменную
   `FIREBASE_SERVICE_ACCOUNT` — она больше не используется.
3. Redeploy проекта, чтобы подтянулся обновлённый `package.json`
   (без `firebase-admin`).

## Что не менялось
- Цены, калькулятор, промокоды, баланс, пополнения, платежи.
- Дизайн (`style.css`, HTML-страницы).
- Все остальные API-функции (`balance-order`, `list-orders`,
  `social-bonus`, `free-gift`, `check-status`,
  `create-balance-invoice`, `create-vpn-order`, `cryptobot-webhook`,
  `yookassa-webhook`, `service-catalog`, `admin-login`).
- Количество функций в `/api` = **12**.

## Проверка
1. `auth.html` → «Регистрация» → логин + пароль → «Зарегистрироваться».
   Ожидается успех и переход в `wallet.html`, документ создаётся
   в Firestore `users` с `passwordHash`, `passwordSalt`, `balance: 0`,
   `bonusBalance: 5`.
2. Выйти (очистить `localStorage.sb_user`) → «Войти» с теми же
   учётными данными → успех.
3. Повторная регистрация того же логина → ошибка «Такой логин уже
   зарегистрирован».
