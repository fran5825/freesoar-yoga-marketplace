# 01：系列全部開放報名與總覽草稿合併

**What to build:** 老師建立系列或生成更多時可勾「建立後全部開放報名」，系列頁也能一鍵開放所有未開始的草稿場次；老師總覽把同一系列的草稿合併成一張卡片並顯示日期，單堂草稿卡片也顯示日期。

**Blocked by:** None (can start immediately)

**Status:** accepted（2026-10-04 實作；2026-10-09 產品主人看過驗收畫面包後回覆「排課 01–06 都通過」）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK（沿用既有 `draft → open_for_enrollment` 轉換，不新增狀態）、CONCURRENCY（生成更多改為系列鎖內單一 transaction）

規格：[4.2 開放報名](../../../../specs/teacher-class-scheduling-spec.md)（Q1、Q11）；情境 S2、S3。

- [x] 建立每週固定與指定日期系列時有「建立後全部開放報名」勾選框，預設不勾；勾選後建立完成的場次直接開放報名。
- [x] 「生成更多」有同樣的勾選框，預設沿用老師上次在該系列的選擇（瀏覽器端記憶，不新增欄位）。
- [x] 改造既有「生成更多」以符合規格第 6 節：現況在 transaction 外讀最後一場並計算日期，再逐場呼叫各自開 transaction 的建課核心；改為在同一個 transaction 內先鎖系列列、鎖內重讀系列設定與最後一場、計算日期，並在同一 transaction 內建立場次（建課核心要能在呼叫端的 transaction 內執行，撞課檢查仍鎖老師）。票 11 的追加補課沿用這個鎖內生成方式。
- [x] 通知的 commit 邊界：現行建課核心在自己的 transaction 結束後，用全域連線查新課並發送 `class_session_created`。改造後，transaction 內只完成寫入並回傳通知所需資料；外層 transaction 成功 commit 後才發送通知，通知失敗不撤銷建課。票 11 沿用此邊界。
- [x] 系列頁「全部開放報名」只把尚未開始的 `draft` 場次開放；已開始、已取消的場次不受影響；確認前顯示會開放幾場。
- [x] 批次開放在 server 端自行檢查：own-scoped、老師為已通過審核（現行單場開放沒有檢查老師狀態，不能直接沿用；單場入口的補強在票 04）、場次未開始；先鎖系列列再處理場次（規格第 6 節鎖定協定）。他人系列、暫停中的老師一律拒絕。
- [x] 老師總覽同一系列的草稿合併為一張卡片，顯示系列名稱、草稿場數與最近日期，點進系列頁；單堂草稿卡片顯示日期。
- [x] Smoke 測試覆蓋：勾選建立即開放、系列頁批次開放、他人系列拒絕、暫停老師直接呼叫批次開放被拒、總覽合併卡片、兩次生成更多同時送出不產生重複日期、生成更多與全部開放報名交錯不死鎖、成功生成後通知確實寫入、外層 transaction rollback 時沒有通知；tsc、lint、受影響 smoke 通過；375／768／1440 RWD 檢查。

<!-- codex-peer-reviewed: 2026-10-04T00:20:21Z rounds=4 verdict=approved -->

## 執行紀錄（2026-10-04）

產品主人放行 01。已讀完相關程式，規劃如下，下次從第 1 步開始：

1. `create-teacher-class-session-core.ts`：抽出在呼叫端 transaction 內執行的版本（回傳結果、不拋預期錯誤、回傳通知所需的 title 與老師 userId），輸入新增 `openForEnrollment`（建立即 `open_for_enrollment`；單場開放本來就不發通知）；原函式包 transaction，commit 後才發通知。
2. `generate-recurring-occurrences-core.ts`：改為單一 transaction：`FOR UPDATE` 鎖本人系列列 → 鎖內讀系列與老師狀態 → 日期可傳陣列或在鎖內計算的 resolver（測試仍傳陣列）→ 逐場呼叫 in-tx 版本 → commit 後通知。transaction timeout 需調高（最多 26 場）。
3. `service.ts`：建立系列與生成更多帶 `openForEnrollment`；生成更多的最後一場讀取與日期計算移進 resolver；新增 `openAllDraftOccurrencesForTeacher`（鎖系列、檢查 approved、updateMany 未開始草稿）。
4. UI：建立表單（`recurring-actions.ts`＋表單元件）加勾選框；系列頁加「全部開放報名」確認視窗（沿用 `ConfirmActionDialog`）與生成更多勾選框（localStorage 依系列記憶）。
5. `teacher-next-step.ts` 的 `buildTeacherTodoItems`：同系列草稿合併成一張卡（連系列頁、列最近日期），單堂草稿加日期；`timezone.ts` 加短日期格式。既有測試只比對 href／label，不受文案影響。
6. 測試與 checks 依本票驗收。

注意：其他 task 正在改 `prisma/schema.prisma`、admin／member 檔案，本票不碰；member-flow-redesign 票 04 也在做學員端系列資訊，之後票 12 要對齊。

### 完成結果（2026-10-04）

- 第 1–6 步全部完成。建課核心拆出 `createClassSessionForTeacherInTransaction`（不拋預期錯誤、回傳通知資料）與 `notifyClassSessionsCreated`；系列生成改為鎖系列 → 鎖內讀設定與日期 → 同一 transaction 建立 → commit 後通知；新增 `__internal__/open-all-draft-occurrences-core.ts`（鎖系列、檢查 approved、只開未開始草稿）。
- 畫面：建立系列多「建立後」選項（先存成草稿／建立後全部開放報名，預設草稿）；系列頁新增「全部開放報名（N 場）」確認視窗；生成更多改為 `GenerateMoreForm`，勾選框依系列記在瀏覽器；總覽同系列草稿合併成一張卡片並列日期，單堂草稿加日期。
- 文件：`state-machines.md` 補批次開放的觸發方式；`conflict-check.ts` 註解改為全站鎖定順序。
- Checks：整個 repo `tsc`、`eslint` 通過；`next build` 通過。Playwright 10 個檔 132 個測試通過（電腦版＋手機版），含新增 `teacher-series-open-all.spec.ts`（建立即開放與通知數、rollback 無場次無通知、兩次同時生成無重複日期、全部開放與生成更多同時執行不死鎖、他人系列與暫停老師被拒、總覽合併卡片、UI 建立／確認視窗／生成更多記憶）。
- RWD：375／768／1440 總覽、系列頁、確認視窗、建立表單無橫向捲動；新增元件觸控高度 ≥ 44px。
- 執行方式：3100 埠被另一個 task 的完整測試占用，為了不覆寫它正在使用的 `.next`，把專案複製到系統暫存資料夾另行 build，用 3200 埠測試；資料庫共用，測試帳號各自獨立並已清理。
- 既有問題（非本票造成，未修）：老師總覽「看全部課程 →」連結的觸控高度不足 44px。
