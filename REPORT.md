# REPORT.md — диагностика Google Auth `auth/internal-error`

## Что было найдено

1. `getRedirectResult()` запускался при открытии `auth.html` без проверки, что пользователь реально начинал Google redirect. Поэтому старое/битое состояние Firebase в браузере могло вызывать `auth/internal-error` сразу при загрузке страницы, до клика.
2. В проекте оставались дубли Firebase-инициализации в отдельных JS-файлах: `app.js`, `free.js`, `orders.js`, `referral.js`, `wallet.js`, `admin.js`, `mutuals.js`, `track.js`, старый `google-auth.js`.
3. Часть HTML-страниц тянула старые query-string версии скриптов (`auth-v5`, `seo`, старые версии `app.js`), поэтому Vercel/браузер могли отдавать закэшированный код.
4. В API-файлах оставался старый `authDomain`, что не было главным источником ошибки, но создавало неоднородную конфигурацию.

## Что исправлено

- `firebase.js` оставлен центральным AuthManager.
- `getRedirectResult()` теперь вызывается только при наличии маркера `sb_google_redirect_pending`, который ставится перед `signInWithRedirect()`.
- Google popup теперь делает fallback на redirect, включая случай `auth/internal-error`.
- Добавлено подробное логирование в Console: `[SMM-Boost Auth]`, `[SMM-Boost Auth Page]`, `[SMM-Boost Google Auth Legacy]`.
- `google-auth.js` заменён на legacy-wrapper без отдельного `initializeApp()`.
- Основные JS-файлы переведены на импорт `firebaseApp` из центрального `firebase.js`.
- В HTML обновлены версии скриптов на `20260716-auth-v6` для сброса кэша.
- В `vercel.json` сохранён proxy для `/__/auth/*` и `/__/firebase/*`.
- API-файлы приведены к `authDomain: smm-boost.pro`.

## Как проверить

1. Залить файлы из архива с сохранением структуры папок.
2. Сделать новый Deploy в Vercel.
3. Открыть `https://smm-boost.pro/auth.html` в инкогнито.
4. Ошибка не должна появляться до клика по Google.
5. Нажать Google-вход. Если ошибка останется, точная причина будет раскрыта в Console под префиксом `[SMM-Boost Auth]`.

## Важно

Бизнес-логика Firestore, платежей, баланса, заказов и JAP API не менялась по смыслу. Изменения касаются авторизации, общей Firebase-конфигурации и cache-busting подключений.
