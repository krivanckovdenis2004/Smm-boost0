# CHANGES — Регистрация/вход через Firebase Admin SDK (без открытия /users)

## Что было не так

Предыдущий фикс ослаблял `firestore.rules` до `allow read, write: if true`
для коллекции `/users`. Это неприемлемо: любой клиент мог бы читать и
переписывать чужие профили и балансы.

## Что сделано

Регистрация и вход по логину/паролю переведены на **Firebase Admin SDK**.
Admin SDK работает по service-account и **обходит Firestore-правила** —
поэтому серверный API может писать в `/users`, а правила при этом
остаются строгими для клиента.

### 1. `api/auth-social-register.js` — переписан
- `firebase/app` + `firebase/firestore` → `firebase-admin/app` + `firebase-admin/firestore`.
- Инициализация через `initializeApp({ credential: cert(serviceAccount) })`,
  где `serviceAccount` берётся из env-переменной `FIREBASE_SERVICE_ACCOUNT`
  (JSON сервис-аккаунта одной строкой).
- Логика (валидация логина/пароля, PBKDF2-хэш, timing-safe сравнение,
  бонус +5 ₽, сессионный токен) — без изменений.
- Отдельный API-файл не добавлен, общее число функций в `/api` = **12**.

### 2. `firestore.rules` — возвращены строгие правила `/users`
```
match /users/{userId} {
  allow read:  if request.auth != null && request.auth.uid == userId;
  allow write: if false;   // клиент не пишет — только Admin SDK через API
}
```
Клиенту `/users` полностью закрыт. Заказы, пополнения, каталог — как были.

### 3. `package.json`
Добавлена зависимость `"firebase-admin": "^12.3.0"`. `firebase` (клиентский
SDK) оставлен — его использует фронтенд и остальные API.

## Изменённые файлы
- `api/auth-social-register.js`
- `firestore.rules`
- `package.json`
- `CHANGES.md`

## Новые файлы
- нет

## Удалить
- нет

## Ручные действия (обязательно, один раз)

**1. Создать service-account в Firebase:**
Firebase Console → ⚙ Project settings → вкладка **Service accounts** →
кнопка **Generate new private key** → скачается JSON-файл.

**2. Добавить его в Vercel как переменную окружения:**
Vercel → Project → Settings → **Environment Variables** → добавить:
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: **всё содержимое** скачанного JSON-файла, одной строкой
  (можно с переносами — код толерантен к `\n` внутри `private_key`).
- Environments: Production, Preview, Development (все три).
- Save → **Redeploy** проекта, чтобы переменная попала в функции.

**3. Опубликовать правила Firestore:**
```
firebase deploy --only firestore:rules --project smm-boost-905d5
```
или Firebase Console → Firestore Database → Rules → вставить содержимое
`firestore.rules` → Publish.

## Проверка после деплоя
1. `auth.html` → «Регистрация» → новый логин + пароль → «Зарегистрироваться».
   Ожидается успех и переход в `wallet.html`.
2. Выйти (очистить `localStorage.sb_user`) → «Войти» с тем же логином/паролем
   → успех.
3. Firebase Console → Firestore → `users` → появился документ с полями
   `passwordHash`, `passwordSalt`, `balance: 0`, `bonusBalance: 5`.
4. Попытка прочитать чужой документ `/users/<чужойId>` из клиента должна
   упереться в правила (`permission-denied`) — это норма.

## Локальная проверка сборки
`node --input-type=module -e "import('./api/auth-social-register.js')"` —
модуль загружается без синтаксических ошибок; при отсутствии/невалидности
`FIREBASE_SERVICE_ACCOUNT` API отдаёт понятную ошибку из handler'а.
