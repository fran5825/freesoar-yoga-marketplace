# 01: 共用就地元件，先用在「我的報名」頁整期卡

來源：[spec 3.1–3.3、I1、I2、I5、I9](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 學員在「我的報名」頁的整期卡，直接在每一堂那一列按「請假」（就地展開確認，不換頁），已請假的列顯示「請假中」與「取消請假」；卡片底部有「退出整期」按鈕，就地展開會取消的堂數與確認。拿掉「某一堂不能來…請到期班頁」那行字與整期區的小標題。整期仍有效時，請假中的堂移進整期卡，不再重複列在下方「過去與已取消」。同一套就地元件與 server action 包裝之後給期班頁與單堂頁共用。

**Blocked by:** None (can start immediately)

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（不改 schema、權限、state machine；沿用既有 service 規則與鎖）。

- [x] 共用元件：一列的狀態標籤、請假（依 `term_only`／`term_and_single` 兩種文案）、取消請假、名額被報滿與其他不能取消請假的原因文字；有效報名的請假資格沿用 `cancelOwnEnrollment`（本人、整期有效、課程未取消未完成、未開始），已請假的列才用 `getReEnrollState`；兩者都在 service layer／共用函式算好
- [x] 「我的報名」讀取函式帶出每一列需要的資料（取消者、整期報名狀態、占用名額、期班報名方式、老師狀態），整期卡包含即將上課的有效堂與整期仍有效時的請假中堂
- [x] 整期卡每一堂列有請假與取消請假；底部有退出整期；請假與取消請假做完回到「我的報名」並顯示結果訊息，網址帶 `open=sessions` 與 `focus` 參數，整期卡的「查看每一堂」保持展開，成功捲到剛操作的那一列、失敗捲到可見的結果訊息（`id="action-feedback"`）；退出整期成功後整期卡消失，只回到同一頁並顯示結果訊息（不帶 fragment），失敗時整期卡仍在並顯示原因
- [x] 拿掉「某一堂不能來…」說明與「整期報名」小標題；整期卡的堂不再重複出現在「過去與已取消」
- [x] 測試：請假、取消請假、退出整期（桌面與手機）、名額被報滿與整期已終結的列沒有按鈕、375px 無橫向溢出、舊的「過去與已取消」測試更新

## 進度紀錄（2026-10-10）

- 新增 `term-row-controls.ts`（`getTermRowControl`：有效報名的請假沿用 `cancelOwnEnrollment` 資格，已請假的列用 `getReEnrollState`）、`TermRowControls.tsx`（列標籤、請假、取消請假、就地退出整期）、共用 server action `term-row-actions.ts`（回傳網址限站內三種頁面，見 `term-row-return-path.ts`）。
- 發現 server action 的 redirect 不保留網址 fragment，改用 `focus` 參數＋client 元件 `ScrollToTarget` 捲到目標（成功捲到該列、失敗捲到 `#action-feedback`）；已同步 spec 與票券。
- 「我的報名」整期卡：每列請假／取消請假、卡底退出整期；整期仍有效時請假中的堂收進卡內；拿掉說明行與小標題。
- 新增 `inline-term-actions-enrollments.spec.ts`（桌面＋手機 12 項）；相關 spec 142 項通過，`member-journey-acceptance` 桌面批次中失敗一次（先前已記錄的不穩定測試）。

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
