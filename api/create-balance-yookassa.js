// Прямой Vercel endpoint для ЮKassa.
// Нужен, потому что на части деплоев rewrite /api/create-balance-yookassa
// превращался в NOT_FOUND до попадания в общий обработчик.

import createBalanceInvoiceHandler from './create-balance-invoice.js';

export default createBalanceInvoiceHandler;