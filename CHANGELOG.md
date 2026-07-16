# Auth v9 — Changelog

## 2026-07-16 — full removal of Firebase Redirect Auth

- Google Login переведён с Firebase `/__/auth/handler` helper на Google Identity Services + `signInWithCredential()`.
- Полностью удалён старый Firebase redirect flow и обработчик результата redirect-flow из runtime-кода.
- Кнопка Google вызывает только Google Identity Services token popup, затем `GoogleAuthProvider.credential()` и `signInWithCredential()`.
- Обновлены версии всех подключений auth-скриптов до `20260716-auth-v9`, чтобы Vercel/CDN/браузер не брали старый JS из кэша.
- Удалён Vercel rewrite `/__/auth/*` и `/__/firebase/*` на `*.firebaseapp.com`.
- Старые helper URL `/__/auth/*` и `/__/firebase/*` теперь уходят 308 на `/auth.html`, чтобы не показывать 404.
- Добавлен 308 redirect `www.smm-boost.pro` → `smm-boost.pro`.
- Добавлена runtime-защита от Google-входа на `www`.
- CSP обновлён для `https://accounts.google.com`.
- Исправлен FOUC кнопки «Зарегистрироваться» через классы `sb-auth-booting` / `sb-auth-ready`.
- Добавлен timeout 45 секунд для Google popup.
- Firestore, баланс, JAP API, платежи, заказы и SEO не изменялись.

---

# Исторический changelog старой v4-архитектуры

## Найденные ошибки

1. **Flash of unauthenticated content**: шапка сайта успевала отрисовать
   кнопку «Зарегистрироваться» до того, как Firebase Auth восстанавливал
   сессию. Причина — контроллер шапки не ждал `onAuthStateChanged`.
2. **Отсутствовало меню пользователя после входа**: в шапке не было
   единого слота, а `user-menu.js` из прошлой версии не был единственным
   источником истины — параллельные обработчики (в `header.js`, `navbar.js`,
   `app.js`) конфликтовали и переписывали DOM.
3. **Бесконечный Skeleton на `/auth.html` в новом браузере**: `auth.js`
   ждал `onAuthStateChanged`, но не имел таймаута; при первой инициализации
   Firebase (медленный колд-старт SDK, Safari Private, блокировка
   `localStorage`) промис не резолвился, и форма не появлялась вовсе.
4. **Дублирующиеся подписки** `onAuthStateChanged` в разных файлах
   расходились по состоянию — где-то показывался гость, где-то — юзер.
5. **`signOut` не обновлял UI без перезагрузки** — событие уходило,
   но слот шапки перерисовывался только после reload.
6. **Google-вход падал в WebView / при блокировке попапа** из-за старого Firebase redirect fallback.

## Что исправлено

- Введён **единственный источник истины** `firebase.js` с экспортом
  `authReady` (Promise первичного состояния с жёстким таймаутом 6с) и
  `subscribeAuth(cb)`. Все остальные модули обязаны подписываться через него.
- Skeleton показывается **до** `authReady`, а не после первого рендера —
  мерцание кнопки регистрации исчезло полностью.
- В `auth.js` добавлен `Promise.race([authReady, 6s timeout])` и
  «последний рубеж» через `setTimeout`, снимающий skeleton в любом случае —
  форма регистрации теперь всегда появляется, даже если Firebase недоступен.
- Persistence переключается на `inMemoryPersistence`, если `localStorage`
  недоступен (Safari Private, встроенные WebView) — устраняет случаи
  «не открывается вообще».
- Google-логин в v9 больше не использует Firebase redirect fallback и не обрабатывает redirect-состояние.
- `signOut` в `header.js` немедленно перерисовывает слот в гостевое
  состояние (не ждёт события) + `onAuthStateChanged` синхронно
  подтверждает. Никаких перезагрузок.
- Все спиннеры/кнопки имеют таймауты и снимаются в `finally`.
  «Бесконечных загрузок» больше нет по коду.
- Понятные сообщения об ошибках (карта `auth/*` → человеческий текст),
  Toast-уведомления, красная плашка ошибки с возможностью повторить.

## Изменённые файлы

| Файл | Роль |
| --- | --- |
| `firebase.js` | Единая инициализация Firebase, `authReady`, `subscribeAuth`. Единственный источник истины. |
| `header.js` | Контроллер слота `[data-auth-slot]` в шапке. Skeleton → guest/user, меню, выход. |
| `header-auth.css` | Стили для skeleton, кнопки регистрации и меню пользователя. |
| `auth.js` | Контроллер `/auth.html`. Skeleton + hard timeout, вкладки, Google Identity Services, verify/resend. |
| `auth.html` | Разметка страницы авторизации со skeleton-состоянием. |
| `reset-password.html` | Универсальный обработчик `resetPassword` / `verifyEmail` / `recoverEmail`. |

## Что нужно сделать вручную

1. **Firebase-конфиг**. В `firebase.js` замените объект `firebaseConfig`
   на реальные ключи вашего проекта (те же, что использовались в старом
   `firebase-auth.js`). Ничего другого менять не нужно — все остальные
   модули берут инстанс отсюда.
2. **Разметка шапки**. В шаблонах шапки (например `index.html`,
   `header.html`, `layout.html`) там, где раньше была кнопка
   «Зарегистрироваться» или её обёртка, поставьте единственный слот:

   ```html
   <div data-auth-slot></div>
   ```

   Всё остальное `header.js` вставит сам (skeleton → кнопка либо меню).
   Удалите старые кнопки регистрации/входа и любые старые контроллеры
   меню пользователя из `navbar.js` / `user-menu.js` / `app.js`,
   иначе получатся конфликтующие обработчики.
3. **Подключение скриптов и стилей** — на **каждой** странице сайта:

   ```html
   <link rel="stylesheet" href="/header-auth.css" />
   <script type="module" src="/header.js"></script>
   ```

   На странице `/auth.html` дополнительно уже подключён `/auth.js`.
4. **Пути редиректа**. Константа `REDIRECT_AFTER_LOGIN` в `auth.js` по
   умолчанию `/account.html`. Если у вас другой путь — поменяйте одну строку.
5. **Ссылки в меню пользователя** (`header.js`, функция `userHtml`) по
   умолчанию ведут на `/account.html`, `/orders.html`, `/balance.html`,
   `/settings.html`. Поправьте, если в проекте другие URL.
6. **Ничего в Firestore / правилах / API не изменялось.** Бизнес-логику
   (баланс, бонусы, рефералы, JAP, платежи) не трогали.

## Проверенные сценарии

- ✅ Регистрация Email → отправка письма → экран «Подтвердите email» с таймером повторной отправки.
- ✅ Клик по ссылке из письма → `/reset-password.html?mode=verifyEmail&oobCode=...` → редирект на `/auth.html?verified=1` с тостом.
- ✅ Вход Email/пароль → редирект в кабинет.
- ✅ Забыли пароль → экран «Письмо отправлено» → страница сброса → редирект ко входу.
- ✅ Google-логин: Google Identity Services token popup + `signInWithCredential()`.
- ✅ Выход: моментальная перерисовка шапки без перезагрузки.
- ✅ Уже авторизованный пользователь заходит на `/auth.html` → мгновенный редирект в кабинет, форма не мигает.
- ✅ Гость: skeleton → кнопка «Зарегистрироваться», без мерцаний.
- ✅ Новый браузер / инкогнито: форма регистрации появляется мгновенно (не зависает).
- ✅ Safari Private: работает через `inMemoryPersistence`.
- ✅ Мобильная адаптация (320+): карточка и меню корректны.
