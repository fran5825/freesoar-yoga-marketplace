# 03: 開放報名前的收款資訊提醒

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 老師在任何會讓課程開始收報名的操作之前，若沒填收款帳號或收款規則，會看到對應的提醒（分開提示缺哪個），說明學員報名時拿到當下的收款資訊、之後補填不會更新給已報名的人，並附連結到「收款與聯絡」。提醒不擋操作。

**Blocked by:** 02（單堂建立時直接開放是入口之一）

**Status:** in-progress（程式與測試已完成；smoke 待資料庫啟動後執行）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

- [x] 先在程式中盤點所有老師端會把課程改成開放報名的操作，清單寫進本票進度紀錄
- [x] 至少涵蓋：單堂課頁開放報名、單堂建立時直接開放、系列建立時全部開放、系列頁全部開放、系列單場快速開放、生成更多時直接開放、期班追加補課在全開時
- [x] 帳號與規則分開判斷，只填規則也提醒帳號
- [x] 提醒出現在按下之前；不填照樣可以開放
- [x] 判斷邏輯在 domain 層共用
- [x] smoke 測試涵蓋至少單堂與系列兩種入口

## 進度紀錄

- 2026-10-24 盤點（搜尋 `open_for_enrollment` 寫入與呼叫它們的老師端 action）：老師端會讓課程開始收報名的操作共 7 個——
  1. 單堂課頁「開放報名」：`/teacher/classes/[id]` → `openOwnClassSessionForEnrollmentAction` → `openClassSessionForEnrollmentForTeacher`
  2. 單堂建立時直接開放：`/teacher/classes/new` 單堂 → `createOwnClassSessionAction`（`openForEnrollment`，票 02）
  3. 系列建立時「建立後全部開放報名」：`/teacher/classes/new` 每週固定／指定日期 → `createOwnRecurringClassSeriesAction`
  4. 系列頁「全部開放報名」：`openAllDraftOccurrencesAction` → `open-all-draft-occurrences-core`
  5. 系列頁單場快速「開放報名」：系列頁 `OccurrenceQuickAction` → `openOwnClassSessionForEnrollmentAction`
  6. 系列頁「生成更多」勾「建立後全部開放報名」：`generateMoreOccurrencesAction`
  7. 期班「追加補課」在剩餘場次都已開放時：`addMakeupSessionAction` → `add-makeup-session-core`（規則抽成 `makeupOpensForEnrollment`，核心與頁面共用）
  不在本票範圍：團主端開放（`/organizer/classes/[id]` 的 `openForEnrollmentAction`、團主直接開團 `open-direct-class-core`），那是團主角色的操作，收款資訊也不是老師在那裡填。
- 2026-10-24：判斷放在 `src/domain/teacher-profile/payment-reminder.ts`（`buildPaymentInfoReminder`），讀取用 `getOwnPaymentInfoReminder`；畫面共用 `PaymentInfoReminderNotice`。7 個入口都在按下之前顯示（5 與 4 同一區塊，位於場次清單之前；6 勾選後才顯示；7 只在補課會直接開放時顯示），不擋操作。tsc、lint 通過；smoke（新檔 teacher-payment-reminder）因本機 PostgreSQL（Docker）未啟動尚未執行。
