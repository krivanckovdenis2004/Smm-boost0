# REPORT.md — полная диагностика Firebase Authentication v9

## Первопричина Google Auth

Текущая реализация пыталась использовать Firebase Auth helper `/__/auth/handler` на проекте, который размещён на GitHub + Vercel и не использует Firebase Hosting. Для такого хостинга обычный rewrite на `*.firebaseapp.com` не является полноценным Firebase Hosting helper.

Проверка показала: `https://smm-boost-905d5.firebaseapp.com/__/firebase/init.json` возвращает `Site Not Found`, то есть Firebase Hosting helper для проекта не развёрнут. Поэтому старый Firebase redirect fallback неизбежно приводил к `/__/auth/handler`, `404`, `Site Not Found` или `Unable to process request due to missing initial state`.

Чтобы выполнить требование «только GitHub + Vercel, без Firebase Hosting, без firebaseapp.com», Google Login переведён с Firebase popup/redirect helper на Google Identity Services:

`accounts.google.com` → access token → `GoogleAuthProvider.credential()` → `signInWithCredential()`.

Такой поток не открывает `/__/auth/handler`, не требует Firebase Hosting и не зависит от `firebaseapp.com` helper.

## Найденные проблемы

1. `firebase.js`: `auth/internal-error` ошибочно отправлялся в старый Firebase redirect fallback.
2. `firebase.js` / `firebase-auth.js`: обработчик результата redirect-flow оставался частью активного потока и мог обрабатывать старое битое redirect-состояние.
3. `vercel.json`: rewrite `/__/auth/*` и `/__/firebase/*` на `smm-boost-905d5.firebaseapp.com` вёл на неразвёрнутый Firebase Hosting.
4. `vercel.json`: не было жёсткого 308 canonical redirect с `www.smm-boost.pro` на `smm-boost.pro`.
5. `user-state.js` / `style.css`: на старых HTML-страницах статическая ссылка «Зарегистрироваться» могла появляться до завершения AuthManager.
6. `auth.js`: страница авторизации не защищала себя от запуска через `www`.

## Что исправлено

1. Google Login переведён на Google Identity Services + `signInWithCredential()`.
2. Старый Firebase redirect helper, Firebase popup helper и обработчик результата redirect-flow полностью убраны из runtime-кода.
3. `auth.js`, `google-auth.js` и `firebase-auth.js` больше не экспортируют и не вызывают redirect-совместимость; кнопка Google идёт только через Google Identity Services token popup.
4. Все cache-busting версии auth-скриптов обновлены до `20260716-auth-v9`.
5. `/__/auth/*` и `/__/firebase/*` больше не проксируются на `firebaseapp.com`; старые helper URL безопасно уходят 308 на `/auth.html`.
6. Добавлен 308 redirect `www.smm-boost.pro` → `smm-boost.pro`.
7. Добавлена runtime-защита от запуска авторизации на `www`.
8. Обновлён CSP для Google Identity Services: `https://accounts.google.com` добавлен в `script-src`, `connect-src`, `frame-src`.
9. Исправлен FOUC в шапке через `sb-auth-booting` / `sb-auth-ready`.
10. Google popup ограничен timeout 45 секунд, чтобы кнопка не зависала бесконечно.

## Контрольный глобальный поиск в папке архива

- Запрещённые старые Firebase redirect/popup вызовы: не найдены.
- Старые cache-busting версии прошлых auth-сборок: не найдены.
- Google-вход в коде: `accounts.google.com` → `GoogleAuthProvider.credential()` → `signInWithCredential()`.

## Что не менялось

- Firestore-структура пользователей.
- Баланс, заказы, JAP API.
- Платёжные API и webhooks.
- SEO-страницы и programmatic SEO.
- Логика рефералов и синхронизации пользователя через `/api/auth-social-register`.
