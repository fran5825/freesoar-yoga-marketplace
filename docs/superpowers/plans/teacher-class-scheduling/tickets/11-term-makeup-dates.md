# 11：期班追加補課日期

**What to build:** 老師在期班加入補課日期；補課場次沿用系列設定，整期學員自動報上並收到通知；未開始、未取消的場次合計最多 26 場。

**Blocked by:** 08 學員報名整期

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** STATE_MACHINE（自動建立報名）、CONCURRENCY、NOTIFICATION

規格：[4.4](../../../../specs/teacher-class-scheduling-spec.md)（Q4、Q16、Q22）；情境 S11、S12；推導規則 2、3。

- [ ] 期班系列頁可選日期追加；撞課日期不建立並指出撞到哪堂。
- [ ] 先鎖系列列（規格第 6 節），鎖內重新計算未開始、未取消場次，追加後合計不超過 26；鎖內重新讀取有效整期學員。
- [ ] 公開找課程的星期篩選改用每場實際上課日期判斷，不再優先用系列的星期設定（補課可能在別的星期）。
- [ ] 期班已全部開放時，補課場次直接開放報名（推導規則 2，放行時確認）。
- [ ] 有效的整期學員自動報上，需確認的期班沿用每位學員已確認的狀態；名額容不下所有整期學員時不能追加（推導規則 3，放行時確認）。
- [ ] 每位自動報上的學員收到一則站內通知；沿用票 01 的通知邊界：transaction commit 後才發送，rollback 時不發送。
- [ ] 持續開課系列不提供本功能（持續開課用生成更多）。
- [ ] Smoke 測試覆蓋追加、自動報上、撞課、名額不足、上限 26（含兩次追加同時進行）、追加與整期報名交錯時新學員也報上補課、週四補課在週二期班的星期篩選結果、他人拒絕；tsc、lint、build、受影響 smoke 通過；RWD 檢查。

## 跨計畫註記：適合對象／準備事項（2026-10-04）

學員流程票 04（`docs/superpowers/plans/member-flow-redesign/tickets/04-recurring-series-class-info.md`）會在系列新增 `suitableFor`／`preparationNotes`。補課場次沿用系列設定時要包含這兩段，以後做的一方為準：本票若晚於學員流程票 04，需讓追加的補課場次帶著系列上的這兩段並驗證；若早於，由學員流程票 04 覆蓋本票的路徑。銜接規則見 `docs/superpowers/plans/member-flow-redesign/ticket-breakdown.md`。

<!-- codex-peer-reviewed: 2026-10-04T00:20:22Z rounds=4 verdict=approved -->

<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->

## 實作紀錄（2026-10-09，Claude，worktree `term-classes`）

**Status：done（待 Codex 補審；待產品主人看畫面）**。推導規則 2、3 已於 2026-10-09 一次性放行。

- 核心 `src/domain/class-session/__internal__/add-makeup-session-core.ts`：鎖本人系列（own-scope 在 WHERE）→ 鎖內重讀設定、尚未開始未取消的場次（追加後 ≤ 26）、有效整期學員（人數 > 名額上限就拒絕，規則 3）→ 撞課檢查（系列 → 老師，回傳撞到的課名）→ 建立場次（沿用系列設定含公開設定與學員資訊；剩下場次都已開放時直接開放，規則 2）→ 有效整期學員自動報上（沿用各自整期狀態，來源 term_created）。commit 後才發通知（老師「課程已建立」、每位自動報上的學員一則）。只限期班；持續開課回 `series_not_term`。
- 系列頁（期班）新增「追加補課日期」；錯誤訊息說明撞到哪堂課、名額不足人數、26 堂上限。
- 公開找課的星期篩選改為一律用每一場實際上課日期（`public-read-service.ts`），不再優先用系列 `dayOfWeek`。
- 測試 `term-makeup.spec.ts`：追加＋沿用設定＋自動報上（confirmed／pending 各自沿用）＋通知數、草稿期班的補課是草稿、他人與持續開課被拒、名額不足、撞課（含課名）、26 上限含兩次同時追加只成功一筆、追加與整期報名交錯時新學員也報上補課、追加與退出整期交錯後沒有殘留有效報名（票 09 留下的項目）、週四補課在週二期班的星期篩選、UI 追加。連同找課與系列舊測試 desktop＋mobile **60 passed / 0 failed**。
