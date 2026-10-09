# 10：老師處理整期報名

**What to build:** 老師在期班頁看到整期學員名單、每人的請假場次與待確認的整期報名；需要確認的期班，對每位整期學員確認或婉拒一次，就套用到這位學員所有未開始的場次。單場詳情的名單標示整期或單堂報名。

**Blocked by:** 08 學員報名整期

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** STATE_MACHINE、PERMISSION（老師 own-scoped）、NOTIFICATION、CONCURRENCY

規格：[4.7、4.9](../../../../specs/teacher-class-scheduling-spec.md)（Q26）；情境 S5。

- [ ] 期班頁的整期學員名單只讀取本人期班，不外洩其他老師或學員資料。
- [ ] 整期確認：底下未開始的 `pending` 場次改為 `confirmed`。
- [ ] 整期婉拒：整期報名改為婉拒，依票 08 保存的子報名來源，「由整期報名新增」的未開始場次取消；「既有單堂併入」的報名脫離整期、恢復為單堂並保留狀態（推導規則 9）。婉拒前顯示影響。
- [ ] 確認／婉拒先鎖系列列（規格第 6 節），鎖內重新讀取，避免與追加補課交錯漏掉場次。
- [ ] 整期確認、婉拒各只發一則站內通知給學員。
- [ ] 單場詳情名單標示報名來源（整期／單堂）；單場不提供個別確認整期學員的操作，避免狀態不一致。
- [ ] Smoke 測試覆蓋確認、婉拒（含狀態相同的「新增」與「併入」子報名並存，重新讀取後各自處理正確）、他人拒絕、通知數量；tsc、lint、受影響 smoke 通過；RWD 檢查。

<!-- codex-peer-reviewed: 2026-10-04T00:20:22Z rounds=4 verdict=approved -->

## 實作紀錄（2026-10-09，Claude，worktree `term-classes`）

**Status：done（Codex 補審通過（2026-10-09，4 輪）；待產品主人看畫面）**。推導規則 9 已於 2026-10-09 一次性放行。

- 核心 `src/domain/enrollment/__internal__/decide-series-enrollment-core.ts`：先鎖系列（own-scope：`teacherProfileId` 寫在鎖查詢 WHERE）再鎖整期報名列，必須是 pending。確認：未開始的 pending 逐場改 confirmed、整期改 confirmed。婉拒：整期改 declined；`term_created` 的未開始逐場改 cancelled；`merged_single` 的逐場清空整期關聯與來源、保留原狀態恢復為單堂。各只通知學員一則。
- 系列頁（期班）：新增「整期學員」名單（狀態、之後幾堂、備註、請假日期），待確認的可「確認整期報名」或「婉拒」（確認視窗先說明會取消幾堂、幾堂恢復為單堂）。
- 老師單場頁：期班場次的名單標示「整期／單堂」；整期子報名不顯示單場確認／婉拒，改連到期班頁處理（server 端拒絕仍在）。
- 測試 `term-teacher-handling.spec.ts`：整期確認與通知數、重複處理被拒、婉拒時新增與併入並存且重讀後各自正確、他人老師被拒、UI 名單與確認。票 08 的老師單場測試改為檢查不顯示確認按鈕、改顯示連結。7 個 spec desktop＋mobile 92 passed／2 failed（本票測試的通知計數未排除建立場次的通知，已修正並重跑通過）。
