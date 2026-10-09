# 08：學員報名整期

**What to build:** 學員在期班頁按「報名整期」，一次報上所有尚未開始、未取消的場次；中途加入只報剩下的場次；剩下每一場都有空位才能報。只收整期的期班不提供單堂報名。

**Blocked by:** 07 建立期班

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** PRISMA_SCHEMA、MIGRATION（新增整期報名紀錄資料表與 `Enrollment` 關聯欄位）、STATE_MACHINE、PERMISSION、CONCURRENCY（鎖多場）、NOTIFICATION

規格：[4.7 期班報名](../../../../specs/teacher-class-scheduling-spec.md)（Q19、Q23、Q24、Q27）；[ADR 0005](../../../../adr/0005-term-class-series-enrollment.md)；情境 S5–S7；推導規則 1、5。

- [ ] 實作前更新 `data-model.md`、`state-machines.md`（整期報名狀態與逐場報名連動）、`permissions.md`，並完成安全檢查。
- [ ] 期班頁（學員可見）：期間、全部日期、剩餘堂數、報名方式與「報名整期」；不公開的期班沿用連結招募規則，學員需登入。
- [ ] 整期報名：所有剩餘場次都要已開放報名（推導規則 1）且每一場都有空位，否則不能報並說明原因；成功時建立一筆整期報名紀錄與每場報名。
- [ ] 需確認的期班，每場報名先是 `pending` 並占用名額；不需確認則直接 `confirmed`。
- [ ] 同一學員對同一期班只能有一筆整期報名（含已退出的，推導規則 5）。
- [ ] 已有 `pending`／`confirmed` 單堂報名的場次併入整期報名、保留原狀態，名額只算本次新增的場次；某場有已取消的報名紀錄（每位學員每場只能有一筆報名）時不能報整期，畫面說明原因（推導規則 9，放行時確認）。
- [ ] 鎖定依規格第 6 節：先鎖系列列並重新讀取場次集合，再依 id 排序鎖場次、最後鎖老師；**取得場次鎖之後**才重新確認每場的名額、狀態、開始時間與該學員既有報名，再寫入（系列鎖只保護場次集合，名額由場次鎖保護，單場報名不鎖系列）。
- [ ] Schema 持久保存每筆子報名的來源：「由整期報名新增」或「既有單堂併入」（例如 `Enrollment` 上與整期紀錄 FK 並列的來源欄位），讓票 10 婉拒時不必靠狀態或建立時間推測；更新 `data-model.md` 與 ADR 0005。
- [ ] 只收整期的期班，單場報名 server 端拒絕。
- [ ] 現行老師單場確認／婉拒報名的 service 只檢查 ownership、`pending` 與時間；本票加上 server 端檢查：屬於整期報名的逐場報名一律拒絕個別確認／婉拒（交由票 10 的整期操作）。
- [ ] 整期報名只發一則站內通知（是否需要新通知類型於規劃時決定，若需新增 enum 屬本票 schema 範圍）。
- [ ] Smoke 測試覆蓋：整期報名、中途加入、某場滿額拒絕、尚有草稿拒絕、重複報名、只收整期拒絕單堂、學員自己占最後一席時併入成功、曾取消某場時拒絕、直接呼叫單場確認／婉拒整期子報名被拒、併發不超額（含確定性交錯：整期報名讀取後、取得場次鎖前，最後一席被單場報名占走，整期報名須失敗且不超額）、重新讀取資料後子報名來源正確；tsc、lint、build、受影響 smoke 通過；RWD 檢查。

<!-- codex-peer-reviewed: 2026-10-04T00:20:22Z rounds=4 verdict=approved -->

## 實作紀錄（2026-10-09，Claude，worktree `term-classes`）

**Status：done（Codex 補審通過（2026-10-09，4 輪）；待產品主人看畫面）**。2026-10-09 產品主人一次性放行 07–13 的 schema、推導規則 1／5／9 與通知沿用既有類型。

- Schema／migration `20261009024811_series_enrollment`：`SeriesEnrollment`（pending／confirmed／declined／withdrawn，`@@unique([recurringClassSeriesId, userId])`）、`Enrollment.seriesEnrollmentId`（FK SetNull）＋`seriesEnrollmentSource`（term_created／merged_single），DB check：有整期關聯就必有來源。
- 核心 `src/domain/enrollment/__internal__/create-series-enrollment-core.ts`：鎖序 系列 → 剩餘場次（依 id）→ 老師；取得場次鎖後才確認狀態、名額與既有報名；尚有草稿拒絕（規則 1）、任一需新增的場次滿額拒絕（Q24）、同一學員同一期班只能一筆含已退出（規則 5）、既有 pending／confirmed 單堂併入保留狀態不占新名額、曾取消某場拒絕（規則 9）。通知沿用 `enrollment_confirmed`／`enrollment_pending_review`，課名「（整期 N 堂）」，一次一則（需確認時老師一則）。
- 單場報名：只收整期的期班 server 端拒絕（`term_only_series`）。老師單場確認／婉拒：屬於整期的逐場報名拒絕（`enrollment_in_term`，條件寫在 updateMany）。
- 學員端：新增期班頁 `/classes/terms/[recurringClassSeriesId]`（期間、時間、地點、老師、共幾堂／剩幾堂、報名方式、可見場次清單、報名整期；訪客登入後回同頁）。單堂頁屬於期班時顯示說明與連結，只收整期時不提供單堂報名。
- 文件：`data-model.md`（Enrollment、SeriesEnrollment）、`state-machines.md`（SeriesEnrollment Status）、`permissions.md`、`route-map.md`。
- 測試 `term-enrollment.spec.ts`：整期報名＋中途加入、滿額／草稿／重複（含已退出）拒絕、只收整期拒絕單堂、併入與來源重讀、曾取消拒絕、需確認時狀態與通知數量、確定性交錯（讀取後最後一席被單場報名占走，整期失敗不超收）、兩筆整期同時搶最後名額、期班頁訪客／學員報名、私人期班訪客 404、只收整期單堂頁導向、老師個別確認整期子報名被拒。
- Checks（`PORT=3200`、獨立測試 DB）：tsc、eslint 通過。10 個 spec 首輪 164 passed／8 failed：6 個是本票測試的資料準備錯誤（同一老師多個期班同時段互撞被跳過，已改為每期不同時段），2 個是既有測試在 12.5 分鐘高負載下超時（`class-direct-sign-in.spec.ts:119`、`class-member-info.spec.ts:149`）。修正後重跑本票 spec＋兩個既有案例：23 passed／1 failed（同一個 sign-in 案例）；該案例單獨跑 desktop 通過（13.5s），判定為負載超時，與本票無關（本票未改 `/sign-in`）。
- 已知限制：老師端的整期確認／婉拒與名單標示在票 10；在此之前，需確認期班的整期 pending 報名，老師逐場按「確認」會看到「請到期班頁一次處理」的錯誤。
