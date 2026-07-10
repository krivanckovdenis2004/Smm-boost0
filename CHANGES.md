# CHANGES — Google Sign-In (Stage 2 auth) + hotfix кнопки

## Hotfix (текущий пакет)
- **Проблема:** клик по кнопке «Войти через Google» вообще ничего не делал.
- **Причина:** привязка обработчика жила внутри `<script type="module">` вместе с импортами Firebase с `gstatic.com`. При любом сбое загрузки модулей (сеть/кеш/блокировщик/CSP) весь модуль не выполнялся → `addEventListener` на кнопке никогда не ставился → клик молча игнорировался.
- **Исправление:**
  - `auth.html` — привязка клика вынесена в обычный (не `type="module"`) inline-скрипт, работает всегда. По клику вызывает `window.SBGoogleAuth.signInWithGoogle()`; если модуль ещё не загрузился — ждёт до ~6 с с видимым сообщением об ошибке, если так и не загрузился.
  - `google-auth.js` — Firebase SDK импортируется **динамически** внутри клика (`await import(...)`), а не на верхнем уровне модуля. Любая ошибка загрузки/подписи домена/попапа выводится в `#authMessage` (включая `auth/unauthorized-domain`). Кеш-бастер `?v=20260710` в подключении.

## 1. Изменённые файлы
- `auth.html` — добавлена кнопка «Войти или зарегистрироваться через Google» (единая кнопка над вкладками «Регистрация» / «Войти»), стили `.google-btn` / `.auth-divider` встроены в `<head>`, подключён модуль `google-auth.js`.
- `firestore.rules` — коллекция `users/{uid}`: разрешён `create` и `update` только владельцу (`request.auth.uid == userId`) и только для полей профиля (`uid, displayName, email, photoURL, authType, createdAt` / для update — `displayName, email, photoURL, updatedAt`). Финансовые поля по-прежнему пишутся только сервером.

## 2. Новые файлы
- `google-auth.js` — клиентский ES-модуль. Инициализирует Firebase Auth + Firestore, реализует `signInWithPopup` (с fallback на `signInWithRedirect` при блокировке popup), делает `getDoc → setDoc` (документ создаётся только при первом входе), сохраняет сессию в `localStorage['sb_user']` совместимо с существующим `user-state.js` (поля `userId`, `displayName`, `email`, `photoURL`, `sessionToken`), вызывает `window.SBUserState.refresh()` и `window.sbGoal('registration'|'login', ...)`.

## 3. Файлы к удалению из GitHub
Нет.

## 4. Serverless-функции `/api`
Осталось ровно **12** файлов — ни один не добавлен и не удалён:
`admin-login.js, auth-social-register.js, balance-order.js, check-status.js, create-balance-invoice.js, create-vpn-order.js, cryptobot-webhook.js, free-gift.js, list-orders.js, service-catalog.js, social-bonus.js, yookassa-webhook.js`.

Вся авторизация Google выполняется клиентским Firebase SDK — без создания новой serverless-функции.

## 5. Ручные действия
1. **Firebase Console → Authentication → Sign-in method** — включить провайдер **Google** (если ещё не включён).
2. **Firebase Console → Authentication → Settings → Authorized domains** — добавить продовый домен (`smm-boost.ru` / `*.vercel.app`) и `localhost` для локальной разработки.
3. **Deploy правил Firestore:**
   ```
   firebase deploy --only firestore:rules --project smm-boost-905d5
   ```
   (или скопировать `firestore.rules` в Firebase Console → Firestore → Rules → Publish).
4. Vercel: переменные окружения не меняются.

## 6. Что реализовано
- Единая кнопка Google на странице `auth.html` работает и как вход, и как регистрация (Firebase сам различает первый и повторный вход).
- После успешного входа проверяем `users/{uid}` через `getDoc`; если документа нет — создаём `setDoc` с `uid, displayName, email, photoURL, authType='google', createdAt: serverTimestamp()`. Повторный вход документ не перезаписывает.
- Сессия сохраняется в `localStorage['sb_user']` в том же формате, что и логин по паролю, поэтому `user-state.js` без правок показывает имя/аватар в верхней навигации и меню.
- `onAuthStateChanged` подхватывает уже авторизованного пользователя при возврате на сайт и синхронизирует локальное состояние.
- Redirect-режим (`signInWithRedirect` + `getRedirectResult`) как fallback для окружений, где popup заблокирован.
- Правила Firestore ограничивают запись только своим документом и только безопасными полями — балансы/бонусы под клиентом изменить нельзя.
