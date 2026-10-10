// lightweight-payment-v0：老師收款與聯絡設定的字數上限。獨立成不含任何 server 相依的小檔，
// 讓 client component（表單字數限制）與 server 驗證共用同一組數字。
export const PAYMENT_ACCOUNT_INFO_MAX_LENGTH = 300;
export const PAYMENT_RULES_TEXT_MAX_LENGTH = 1000;
export const CONTACT_INFO_MAX_LENGTH = 200;
