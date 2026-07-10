# CHANGES — удаление Google-авторизации

## Что сделано
Google Sign-In полностью удалён из фронтенда. Авторизация по логину и паролю (`auth.js` + формы `#registerForm` / `#loginForm`) не тронута и работает как раньше. Новые API-функции не создавались, в `/api` по-прежнему 12 файлов.

## Удалённые файлы
- `google-auth.js` — Firebase Google Sign-In клиент, динамическая загрузка Firebase SDK, `SBGoogleAuth`, обработка redirect-результата, диагностические сообщения `auth/*`.

## Изменённые файлы
- `auth.html`
  - Удалена кнопка «Войти или зарегистрироваться через Google» (`.google-auth-block`, `.google-btn`, SVG-иконка, разделитель `.auth-divider`).
  - Удалены inline-стили `.google-btn` / `.auth-divider` / `.google-auth-block` из `<head>`.
  - Удалён inline-скрипт привязки клика `[data-google-signin]` (в т.ч. таймер ожидания `SBGoogleAuth` и сообщения об ошибках Google).
  - Удалён `<script type="module" src="google-auth.js?...">`.
- `vercel.json`
  - Из CSP убраны Google-Auth-специфичные записи: `https://apis.google.com` (script-src), `https://identitytoolkit.googleapis.com`, `https://securetoken.googleapis.com` (connect-src), `https://*.firebaseapp.com`, `https://accounts.google.com` (frame-src).
  - Firestore-записи (`*.googleapis.com`, `firestore.googleapis.com`, `*.firebaseio.com`) оставлены — их использует остальной код (кошелёк, заказы и т.д.).

## Что не менялось
- `auth.js` и HTML-формы логин/пароль — без изменений.
- `/api/*` — 12 функций, ничего не добавлялось и не удалялось.
- Остальные модули, использующие Firestore (`wallet.js`, `orders.js`, `mutuals.js`, `track.js`, `app.js`, `admin.js`) — не тронуты.
