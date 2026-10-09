# 07：建立期班

**What to build:** 老師建立每週固定課時選「持續開課」或「期班，共 N 堂」；指定日期一律建立為期班；期班建立時設定報名方式（只收整期／整期和單堂都收）。期班不能生成更多，系列頁標示型態與報名方式。

**Blocked by:** 01 系列全部開放報名（建立時的開放報名勾選框）；02 生成更多提醒（本票要把提醒改成只針對持續開課）；06 公開設定（本票要套用期班整期一致的公開規則）

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** PRISMA_SCHEMA、MIGRATION（系列型態、期班報名方式欄位與舊資料轉換）、STATE_MACHINE

規格：[4.1](../../../../specs/teacher-class-scheduling-spec.md)（Q18、Q20、Q21）；[ADR 0005](../../../../adr/0005-term-class-series-enrollment.md)；推導規則 7。

- [ ] 實作前更新 `docs/domain/data-model.md`、`state-machines.md`，說明欄位、轉換與 rollback。
- [ ] Additive migration：既有每週固定 → 持續開課；既有指定日期 → 期班、整期和單堂都收（目前無正式上線資料）。
- [ ] 建立表單：每週固定增加型態選擇；期班輸入堂數 N（1–26）；期班選報名方式；建立摘要顯示實際堂數（含撞課跳過）。
- [ ] 期班不提供生成更多（server 端也拒絕）；票 02 的提醒改為只針對持續開課。
- [ ] 系列型態與報名方式建立後不能改（推導規則 7，放行時確認）。
- [ ] 期班的公開設定整期一致（推導規則 8）：改公開設定時不提供「只改這場」，套用到所有未開始、未取消的場次與系列預設；測試覆蓋。
- [ ] 本票只建立期班，學員端仍是逐場報名（整期報名在 08）。
- [ ] Smoke 測試覆蓋三種建立路徑、期班拒絕生成更多、舊資料轉換結果；tsc、lint、build、受影響 smoke 通過；RWD 檢查。

## 跨計畫註記：適合對象／準備事項（2026-10-04）

學員流程票 04（`docs/superpowers/plans/member-flow-redesign/tickets/04-recurring-series-class-info.md`）會在系列新增 `suitableFor`／`preparationNotes`。期班建立的表單與生成路徑要包含這兩段，以後做的一方為準：本票若晚於學員流程票 04，需讓期班建立表單與生成的每一場帶著系列上的這兩段並驗證；若早於，由學員流程票 04 覆蓋本票的路徑。銜接規則見 `docs/superpowers/plans/member-flow-redesign/ticket-breakdown.md`。

<!-- codex-peer-reviewed: 2026-10-04T00:20:22Z rounds=4 verdict=approved -->

<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
## 開工前設計（2026-10-06，待產品主人確認）

### 現況（2026-10-06 查證）

- main 已含票 01–06；資料庫與 main 的 migration 一致。
- **學員流程票 04 正在 `C:/Users/franz/fsy-04` 進行中**：`RecurringClassSeries` 新增 `suitableFor`／`preparationNotes`，已產生 migration `20261006100000_recurring_series_member_info`（尚未合併）。它改的檔案與本票幾乎全部重疊：`schema.prisma`、建課表單與 `recurring-actions.ts`、系列頁、生成場次與系列改課核心、`read-service.ts`、改課頁、`data-model.md`。它的基底是票 06 之前的 main（`297fac8`），合併時也需要接上票 06 的 `isPublic`。
- 因此本次只寫設計，不改程式與 `docs/domain/`；開工時以學員流程票 04 合併後的 main 為底。

### 資料庫（HEAVY）

- 新增兩個 enum：`RecurringClassSeriesKind`（`continuous` 持續開課／`term` 期班）、`TermEnrollmentMode`（`term_only` 只收整期／`term_and_single` 整期和單堂都收）。
- `RecurringClassSeries` 新增 `kind RecurringClassSeriesKind @default(continuous)`、`termEnrollmentMode TermEnrollmentMode?`。
- 資料庫檢查規則：`kind = continuous` 時 `termEnrollmentMode` 必須是 NULL；`kind = term` 時必須有值。
- Migration 回填：`dayOfWeek IS NULL`（指定日期）→ `term` + `term_and_single`；其他每週固定 → `continuous`（Q21）。目前沒有正式上線資料。
- Rollback：刪除檢查規則、兩個欄位與兩個 enum；只會失去型態與報名方式，場次與報名不受影響。

### 行為

| 情境 | 結果 |
| --- | --- |
| 每週固定 | 多一組「持續開課（可以一直生成更多）／期班，共 N 堂」；期班的 N 就是要建立的堂數（1–26，沿用現有欄位） |
| 指定日期 | 一律是期班 |
| 期班 | 建立時選報名方式（只收整期／整期和單堂都收）；建立摘要顯示實際堂數（撞課跳過的不算） |
| 生成更多 | 只有持續開課可以；期班在系列頁不顯示、server 端也拒絕 |
| 生成更多提醒（票 02） | 改為只針對持續開課 |
| 型態與報名方式 | 建立後不能改（推導規則 7） |
| 期班的公開設定 | 整期一致（推導規則 8）：期班場次在改課頁改公開設定時，不論選哪個範圍，都套用到所有未開始、未取消的場次與系列設定，畫面說明這點 |
| 系列頁 | 標示「持續開課」或「期班・共 N 堂・只收整期／整期和單堂都收」 |
| 學員報名 | 本票不改報名：學員仍逐場報名；整期報名在票 08 |

### 測試規劃

三種建立路徑（持續開課、每週期班、指定日期期班）與資料庫寫入、期班拒絕生成更多（server）、舊資料回填結果、期班改公開設定套用整期、生成更多提醒只對持續開課、資料庫檢查規則擋下不一致的資料、RWD。

### 待產品主人確認

- **A. 期班報名方式的預設值**：建議「整期和單堂都收」（不會把只想來一次的學員擋在外面；公司課再改選只收整期）。
- **B. 推出時機**：建議票 07 完成後**先 commit 在本機、等票 08（整期報名）完成再一起 push**。原因：只有票 07 時，「只收整期」的期班學員仍只能逐場報名，與老師選的設定不符；一起推出才不會出現這段落差。
- **C. 開工時機**：建議等學員流程票 04 合併進 main 後再開工（兩邊改同一批檔案，同時改一定會衝突）。
- **D. 推導規則 7**：型態與報名方式建立後不能改（建議同意；要改就開新的一期）。
- **E. 推導規則 8**：期班的公開設定整期一致（建議同意；期班在找課程會是一張卡片）。

**2026-10-06 產品主人決定：A–E 照建議。** 期班報名方式預設「整期和單堂都收」；票 07 完成後只在本機 commit，等票 08 完成再一起 push；等學員流程票 04 合併進 main 後才開工；型態與報名方式建立後不能改；期班公開設定整期一致。

<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->

## 實作紀錄（2026-10-09，Claude，worktree `term-classes`）

**Status：done（待 Codex 補審；待產品主人看畫面）**

- Schema／migration `20261009022844_term_class_series_kind`：`RecurringClassSeriesKind`、`TermEnrollmentMode`、`kind`／`termEnrollmentMode` 與 DB check；回填：指定日期 → term + term_and_single，每週固定 → continuous。於獨立測試 DB 以兩筆舊式系列實測回填結果正確，並確認 check 擋下「期班沒有報名方式」。
- 建立表單：每週固定新增「課程型態」（持續開課／期班），期班時堂數欄位改為「這一期共幾堂」；每週期班與指定日期新增「期班報名方式」（預設整期和單堂都收）；摘要與建立訊息顯示實際堂數（「期班已建立，共 N 堂」）。
- 期班不能生成更多：`generateOccurrencesForSeries` 新增 `requireContinuous`，在系列鎖內檢查型態；系列頁不顯示生成更多；老師總覽提醒只列持續開課。
- 推導規則 8：期班場次改 `isPublic`（只改這場或改這場和之後）都套用到整期未開始的草稿／開放場次與系列；鎖順序 系列 → 場次（依 id）→ 老師。改課頁對期班顯示說明。
- 文件：`data-model.md`、`state-machines.md`。
- 測試：新增 `term-class-creation.spec.ts`（驗證、DB check、生成更多拒絕、提醒、公開設定整期一致與持續開課對照、三種建立 UI、改課頁說明）；更新三個斷言指定日期建立訊息的舊測試。`PORT=3200`、獨立測試 DB：tsc、eslint 通過；10 個 spec desktop＋mobile **134 passed / 0 failed**。
