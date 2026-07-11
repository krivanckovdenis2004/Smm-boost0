# Восстановление регистрации и входа из архива «старт»

## Причина
В `api/auth-social-register.js` был указан НЕВЕРНЫЙ `firebaseConfig`
(чужие `apiKey`, `appId`, `messagingSenderId`, `storageBucket`).
Из-за этого клиентский Firebase SDK не мог писать в Firestore проекта
`smm-boost-905d5` — регистрация и вход падали.

## Что сделано
Файл `api/auth-social-register.js` полностью перенесён из архива
`Smm-boost0-старт.zip` (эталон, где регистрация и вход работали).
Возвращён корректный `firebaseConfig`:

- apiKey: AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8
- appId: 1:554912523069:web:26d405b696b9d45e5edb54
- messagingSenderId: 554912523069
- storageBucket: smm-boost-905d5.firebasestorage.app
- measurementId: G-E6SRLXZW5V

Вся остальная логика идентична: PBKDF2 (120000 итераций, sha512),
timing-safe сравнение, сессионный токен, регистрационный бонус,
валидация логина, endpoint `/api/auth-social-register` с действиями
`register` и `login`.

## Изменённые файлы
- `api/auth-social-register.js` — перенесён из архива «старт».

## НЕ тронуто
Дизайн, вёрстка, страницы, услуги, калькулятор, цены, пополнение,
бонусы, админка, SEO, `vercel.json`, `package.json`, остальные API,
`auth.html`, `auth.js`, `user-state.js`, `firestore.rules`.

## Ручные действия
Не требуются. Google Auth / Admin SDK / Service Account в проекте
отсутствуют, дополнительных секретов Vercel не нужно.
