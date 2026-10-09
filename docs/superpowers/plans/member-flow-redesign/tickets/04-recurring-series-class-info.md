# 04: 系列課（每週固定與指定日期）沿用課程資訊

**What to build:** 老師建立系列課時，不論用「每週固定」或「指定日期」，都可以填同樣的「適合對象」與「準備事項」；系列生成的每一場課都帶著這兩段，學員打開任何一場都看得到。

**Blocked by:** 03（共用欄位定義、validation 與詳情顯示）

**Status:** 實作與既有 review 通過；2026-10-09 交付版 tsc／full lint／fresh Webpack build 通過，完整 smoke 為 162 passed／2 failed。產品主人批准只重跑兩項；desktop 定向重跑再次失敗（容量顯示預期 0/4、實際 0/10），mobile 未執行。已保存 trace、清理專屬資源並停止，未 commit／push；老師票 07 的 C 尚未成立。不宣稱 default Turbopack 通過。

**Workflow mode:** HEAVY

**Human Gate:** yes（Prisma schema 新增欄位、系列生成核心）

**Risk flags:** Prisma schema、migration、系列建立 service、逐場生成 core。

**Source:** `docs/member-flow-redesign-plan.md` Q11、分批表第 2 批（「單堂／兩種系列」）；名詞見 `docs/context/glossary.md`「每週固定」「指定日期」。

## 已決定的規格（不重問）

- `RecurringClassSeries` 新增與票 03 相同的兩個 nullable 欄位與限制。
- 兩種排程模式（`weekly`、`fixed_dates`）的建課表單都要有這個選填區，並共用同一套 validation。
- 生成場次時複製到每場 `ClassSession`；本票不做同步或回寫。建立後的修改（含「改這場和之後所有場次」更新系列上的這兩段）由老師排課票 05 負責。
- 條件式責任：開工時先查 main。若老師排課票 05（系列改課）**已完成**，本票必須在既有系列改課表單與寫入路徑一併加上這兩段：「只改這場」只改該場；「改這場和之後所有場次」改該場與之後未開始、未取消的場次並更新系列上的值；不發通知。尚未完成則由該票補上。
- 本票不改系列的公開設定、報名方式與生成規則。系列公開設定由老師排課票 06 負責；期班與整期報名由老師排課票 07～12 負責，都不在本票範圍。
- 若老師排課票 07（期班建立）或 11（追加補課）先完成，本票要一併覆蓋那些新的建立／追加路徑，讓期班與補課場次也帶著這兩段；若本票先完成，則由那些票沿用系列上的值。

## Builder plan（2026-10-06，待 Human Gate）

查證（main `396856f`）：
- 老師排課票 05（系列改課）已完成，所以依條件式責任，**本票要一併支援系列的兩種改法**。票 07（期班建立）、11（追加補課）**尚未實作**（程式沒有系列型態、整期報名或補課路徑），所以本票不處理它們；它們之後實作時，依跨計畫註記沿用系列上的值。
- 系列建立：`src/domain/class-session/service.ts` 的 `prisma.recurringClassSeries.create` 寫入系列，驗證在 `recurring-series-validation.ts`（每週固定與指定日期共用）。
- 每場生成：`__internal__/generate-recurring-occurrences-core.ts` 從系列複製 `description` 等欄位；建立時生成與之後的「生成更多」都走這個核心。
- 系列改課：「只改這一場」走單堂改課核心 `edit-class-session-core-for-teacher.ts`（票 03 已支援這兩欄，但表單對系列場次隱藏、action 沒收到時保留原值）；「改這一場和之後所有場次」走 `edit-series-from-occurrence-core.ts`，同時更新之後的場次與系列本身。
- 主工作目錄目前只有其他任務在 `src/app/organizer/`、部分 tests 的未提交修改，與本票檔案不重疊；仍在獨立 worktree／分支實作，完成後合併。

做法：
1. **Schema**：`RecurringClassSeries` 新增 `suitableFor String?`、`preparationNotes String?`；一個只有兩個 nullable `ADD COLUMN` 的 migration，不回填（既有系列與其場次維持 null）。
2. **驗證**（`recurring-series-validation.ts`）：沿用票 03 匯出的 `normalizeMemberInfoText`、`checkMemberInfoLength`、`MEMBER_INFO_MAX_LENGTH`（CRLF 統一、trim、空白為 null、各 500 字），`normalized` 帶出兩欄；錯誤欄位名 `suitableFor`／`preparationNotes`，與單堂相同。
3. **系列建立**（`service.ts` 的系列建立：只加兩欄寫入；`src/app/teacher/classes/new/recurring-actions.ts` 讀取兩欄）：寫入系列。
4. **逐場生成**（`generate-recurring-occurrences-core.ts`）：每場 `ClassSession` 從系列複製兩欄；「生成更多」因此也沿用系列目前的值。
5. **建課表單**（`ClassSessionCreateForm.tsx`）：每週固定與指定日期兩種建立表單也顯示 `MemberInfoFields`（同一元件、同樣上限與提示，`id` 依模式加前綴避免重複），摘要列出兩段填寫狀態。
6. **系列改課**：
   - 改系列場次的表單（兩種範圍）都顯示這兩欄，帶入**這一場**目前的值。
   - 「只改這一場」：action 傳兩欄，單堂改課核心只改這一場，系列與其他場次不變。
   - 「改這一場和之後所有場次」：`src/app/teacher/classes/[classSessionId]/edit/actions.ts` 的 following 路徑傳兩欄（沒收到則為 `undefined`）；`edit-series-from-occurrence-core.ts` 收到值時寫入這一場與之後未開始、未取消的場次以及系列本身，`undefined` 時不改；仍經同一套驗證；不新增通知（只有時間、地點變動才通知的既有規則不變）。
   - 摘要的「這次會修改」列出兩項。
7. **讀取與呈現**：學員／訪客詳情已讀 `ClassSession` 兩欄（票 03），系列場次直接適用，不需改。老師課程詳情移除「系列場次沒有內容時不顯示」的過渡條件，改為與單堂一致（沒填寫也標示）。老師系列頁（`src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx`、`read-service.ts` 系列 DTO）在說明之後顯示系列上的兩段。
8. **文件**：`docs/domain/data-model.md` 的 `RecurringClassSeries` 段落記錄兩欄與複製規則；`ClassSession` 段落更新為「系列建立與系列改課也可填」。

不做：期班、整期報名、補課（老師排課票 07～12）；系列公開設定（老師排課票 06）；舊系列回填；新通知類型。

**資料庫操作（需產品主人明確同意）**：同票 03，在 worktree 產生 migration，對本機開發 PostgreSQL 以 `prisma migrate deploy` 套用（只新增兩個 nullable 欄位，其他工作階段不受影響）；合併後主工作目錄需 `npx prisma generate` 並重啟開發伺服器。

Allowed files：`prisma/schema.prisma`、新 migration 目錄、`src/domain/class-session/recurring-series-validation.ts`、`src/domain/class-session/service.ts`（只限系列建立寫入兩欄）、`src/domain/class-session/__internal__/generate-recurring-occurrences-core.ts`、`src/domain/class-session/__internal__/edit-series-from-occurrence-core.ts`、`src/domain/class-session/read-service.ts`（系列 DTO）、`src/app/teacher/classes/new/`（表單、`recurring-actions.ts`）、`src/app/teacher/classes/[classSessionId]/edit/`、`src/app/teacher/classes/[classSessionId]/page.tsx`、`src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx`、`docs/domain/data-model.md`、`tests/smoke/class-member-info.spec.ts`（把票 03 的系列「不顯示」案例改為本票的新行為，其餘不刪）、新測試 `tests/smoke/series-member-info.spec.ts`、本票。

測試計畫：
- 驗證純函式：系列驗證的空白→null、CRLF、500／501 字，與單堂一致。
- 每週固定、指定日期各建立一個系列並填兩段 → 系列與生成的每一場都有值 → 學員從分享連結開任一場看得到兩段。
- 兩種模式不填 → 每場顯示「尚未提供」；超過 500 字（移除 `maxLength`）server 擋下、保留輸入、沒有建立系列。
- 「生成更多」新增的場次帶著系列上的值。
- 改系列場次：表單帶入這一場的值；「只改這一場」只改這一場（系列與其他場次不變）；「改這一場和之後所有場次」改這一場、之後未開始未取消的場次與系列，更早的場次不變；之後「生成更多」沿用新值；不發通知；兩種範圍都能清空。
- 改系列的 500 字限制：「只改這一場」與「改這一場和之後所有場次」兩種範圍、兩個欄位，各測 500 字（含換行）成功與 501 字（移除 `maxLength`）被 server 拒絕；拒絕時表單保留輸入，系列與所有場次的兩欄都維持原值。
- 「改這一場和之後所有場次」未送出欄位（`undefined`）時保留原值：直接呼叫 `edit-series-from-occurrence-core.ts`，先讓系列與各場的兩欄內容彼此不同，省略其中一欄送出，確認系列與各場的該欄都沒被清空或統一覆寫；明確送空字串才會清空。
- 系列場次 `isPublic` 與報名方式不因本票改變。
- 一次執行：新 spec＋class-member-info、teacher-recurring-class-series、teacher-series-class-edit、teacher-series-generate-reminder、teacher-class-edit、teacher-class-usability、public-classes-discovery、enrollment 全過。

## Acceptance criteria

- [x] 開工前提供具體 Builder plan，經 Human Gate 確認（2026-10-06 產品主人選 A，含同意套用到本機開發資料庫）
- [x] 「每週固定」與「指定日期」兩種表單都有同一個選填區，限制與單堂一致
- [x] 兩種模式各自驗證：系列本身與生成的每一場都保存正確內容；沒填的系列每場顯示「尚未提供」
- [x] 學員從分享連結開兩種系列中任一場，都看得到兩段資訊
- [x] 本票沒有改變系列的公開設定與報名方式（與實作當下的 main 行為一致）
- [x] 僅在老師排課票 07／11 已完成時：期班建立與追加補課產生的場次都帶著系列上的這兩段（不適用：兩張票尚未實作，之後由那兩張票依跨計畫註記沿用系列上的值）
- [x] 僅在老師排課票 05 已完成時：兩種套用範圍都能修改、清空這兩段，500 字限制一致，之後生成／追加的場次沿用新值，不發通知
- [x] `docs/domain/data-model.md` 同步
- [x] prisma validate、client generation、migration 審核；不自行套用真實 DB migration
- [x] tsc、lint、build；兩種系列生成相關 smoke 與新增案例通過

## 實作結果（2026-10-06，未 commit）

**Status 補充：** 已實作並驗證，在分支 `member-flow-04-series-info`（worktree `C:/Users/franz/fsy-04`，基底 origin/main `297fac8`）；尚未 commit、尚未合併回 main。

Changed files：`prisma/schema.prisma`、`prisma/migrations/20261006100000_recurring_series_member_info/`（新）、`src/domain/class-session/recurring-series-validation.ts`、`src/domain/class-session/service.ts`（只在系列建立寫入兩欄）、`src/domain/class-session/__internal__/generate-recurring-occurrences-core.ts`、`src/domain/class-session/__internal__/edit-series-from-occurrence-core.ts`、`src/domain/class-session/read-service.ts`（系列 DTO）、`src/app/teacher/classes/new/_components/ClassSessionCreateForm.tsx`、`src/app/teacher/classes/new/recurring-actions.ts`、`src/app/teacher/classes/[classSessionId]/edit/actions.ts`、`src/app/teacher/classes/[classSessionId]/page.tsx`、`src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx`、`docs/domain/data-model.md`、`tests/smoke/class-member-info.spec.ts`（票 03 的系列「不顯示」案例改為新行為，保留「只改這一場」不清掉既有內容的檢查）、`tests/smoke/series-member-info.spec.ts`（新）、本票。

與計畫的差異：
- 學員／訪客詳情不需改（票 03 已讀 `ClassSession` 兩欄）。
- 「改這一場和之後所有場次」的核心以 `memberInfoUpdate` 只寫入有收到的欄位（場次與系列一致），避免驗證把 `undefined` 整理成 null 而清掉原值。

資料庫：依產品主人同意，對本機開發 PostgreSQL 執行 `prisma migrate deploy`，只套用本票 migration（`RecurringClassSeries` 兩個 nullable `ADD COLUMN`）；執行前確認沒有其他未套用的 migration。合併回 main 後，主工作目錄需 `npx prisma generate` 並重啟開發伺服器。

驗證（worktree，PORT=3300，production build）：
- `prisma validate`、tsc、全專案 eslint、`next build` 通過。
- 新 spec `series-member-info`＋更新後的 `class-member-info`：32/32。
- 一次執行 series-member-info＋class-member-info＋teacher-recurring-class-series＋teacher-series-class-edit＋teacher-series-generate-reminder＋teacher-class-edit＋teacher-class-usability＋public-classes-discovery＋enrollment：**148/148 通過**。
- Codex 實作 review 核准後建議補齊驗證矩陣，已補：指定日期「有填內容」的學員頁讀回、「只改這一場」的清空。補完後 `series-member-info` 單獨重跑 16/16（上面的 148/148 是補測前那一版）。
- 未另寫、以等價路徑代表的情境：每週固定的「沒填」與「超過 500 字」——與指定日期走同一個 `recurring-actions.ts` 與 `validateRecurringSeriesInput`，由指定日期的對應測試與純函式測試涵蓋。
- 證據：`.ai-runs/member-flow-redesign-04/`（`final-command.txt`、`final-full-output.log`、`series-spec-after-review.log`、`eslint.log`、`build-tail.log`、`prisma.log`）。

Security self review：只新增老師自己系列與場次的兩個文字欄位；寫入仍經既有 own-scope、approved 老師、系列鎖、狀態與開始時間檢查；學員端讀取範圍不變；系列場次 `isPublic` 與報名方式未改（測試確認）。


<!-- codex-peer-reviewed: 2026-10-05T22:50:58Z rounds=2 verdict=approved -->

## 接回 main：來源整合（2026-10-07）

本輪產品主人選擇 1，批准以 main `a5c1ec2` 接回已審查的公開設定 × 學員資訊候選；授權只包含來源整合與不連 DB 的檢查。既有 main dirty 工作保留，原 fsy-04 與候選 worktree 不修改。

- [x] 保存本輪 task-start／ticket-start baseline、HEAD／index／dirty 狀態與 checksum。
- [x] 核對候選 19 個非 docs 檔案與已審版本一致；保留 migration 原位元組。
- [x] 接回 source／tests／migration／相關文件；data-model 僅合併系列課段落與 ClassSession 資訊欄，保留團主票 15a。
- [x] 本輪 Prisma validate、無 DB client generation、tsc、diff／scope checks；使用 process-local 佔位 URL，未連 DB。
- [x] 本輪 whitelist 16 個 TypeScript 檔案定向 ESLint 通過（不是全專案 lint 通過）。
- [x] 全專案 `npm run lint`：先前失敗（1097 errors、9225 warnings；errors 全在 `.ai-runs`／`.claude`）已保留證據。產品主人另選 1 核准 `eslint.config.mjs` 僅新增 `.ai-runs/**`、`.claude/**` 兩個 global ignore pattern；不改 rules、不刪證據。全專案重跑 exit 0、無 warnings。
- [x] 本輪 self review、完整 task-start patch 與 Builder Review Packet，見本輪 evidence。
- [ ] 接回後有效 build／隔離 DB smoke／必要回歸（本輪未授權，不宣稱 main 通過）。
- [ ] commit／merge／push（本輪未授權）；票 07 仍未開工。

候選歷史證據：`C:/Users/franz/.codex/worktrees/series-visibility-member-info/freesoar-yoga-marketplace/.ai-runs/series-integration-1791245052403/`；138/138 smoke、24 個 RWD 狀態、獨立 Reviewer APPROVE。它們證明候選版本，不等於目前 main 的完整整合驗收。
本輪 evidence：`.ai-runs/current/2026-10-07-member-flow-04-source-integration/`。

Self review／scope：來源整合 19 檔（18 個候選差異加票 04 進度），後續另核准 1 檔 lint config 修正；不新增產品規則。符合 V1，沒有 Wellness／Academy／Retreat、AI matching、金流／退款或 native app。19 個非 docs 候選檔案與已審版本一致，own-scope、approved 老師、origin／status／time guards、transaction／locks 保留；角色、permission、state machine 與 route map 未變。團主票 15a 與其他既有 dirty 工作、Git HEAD／index、原 fsy-04 與候選來源保留。既有 RWD／品牌證據仍限候選，不宣稱目前 main runtime 已驗收。不 auto commit／merge／push，不開始票 07。

### Lint scope 修正（2026-10-07，已完成）

- [x] 修改前保存 config、票 04 與 packet baseline；產品主人於目前 task 選擇 1 核准精確範圍。
- [x] config 只新增兩個 local-only 目錄 ignore pattern；沒有改 lint rules、既有 ignores 或任何產品 source。
- [x] `npm run lint` exit 0；sandbox 的 Node EPERM 失敗與原權限重跑 PASS logs 分別保留。
- [x] 更新本票與 packet，diff／scope／self review；不操作 DB／server、不 build 或 commit／merge／push。

本輪 evidence：`.ai-runs/current/2026-10-07-member04-lint-scope/`。此 tooling-only 修改符合 V1，與 data model、roles／permissions、state machines、route map、RWD／品牌無新增影響；只排除 local evidence／嵌套 checkout，不放寬 lint rules。下一步仍是接回後的有效 build／隔離 DB smoke 與 review，不因 lint 通過而自動放行。

並行狀態補充：lint 收尾核對時，團主票 15 的 plan／ticket docs 相對來源整合起點另有更新；相對本次 lint 起點只有票 15 ticket 改變。本 task 未寫入或還原它們。所有候選程式與原來源 checksum、HEAD／index 仍符合預期；不把外部 docs 更新算成本輪修改。

### 接回 main 隔離驗證（2026-10-07，前置檢查停止）

產品主人於目前 task 選擇 1，批准既有 `next-isolated-validation-plan.md` 的 code-only 快照、指定 disposable DB／container／volume、fresh build、10 specs smoke、獨立 Reviewer 與專屬資源清理；同時指定「檢查失敗就停止」。此批准不包含產品 source 修改、共用 DB、原 server、commit／merge／push 或票 07。

- [x] 準備 395 個 source／migration／test／必要設定的隔離快照，排除 `.env*`、credentials、Git 與 build output。
- [x] 原依賴唯讀連結；為避免 generated client realpath 讀到 main `.env`，將既有 `@prisma/client` 與 `.prisma/client` 原位元組複製到 staging，不 regenerate 或修改共享 client。
- [x] 檢查失敗後停止：generated schema 原始文字比對因 `Notification` 九欄對齊空白不同而失敗。唯讀診斷確認移除空白／註解且保留字串後的 token hash 相同，395 個快照檔案與 main 相符。這是驗證腳本比對過嚴，不是模型變動。
- [x] 確認指定 container／volume 不存在；未建立或連接 DB，未執行 migration／build／smoke，未啟停 server，沒有資源需要清理。
- [x] 保留失敗原腳本與 raw diff；另存只修正 token 比對並使用新 staging 目錄的續接草稿，完成 syntax check 與唯讀 guard 診斷，未執行草稿。
- [x] 獨立 Reviewer 直接核對停止 closeout、完整 docs patch 與續接草稿：APPROVE 限收尾及草稿可交人批准，無 blocking findings。前輪 provisional 原文與工具限制保留；runtime／ship 未放行。
- [ ] 失敗後由產品主人指示續接，同一已批准隔離方案完成 runtime checks 與獨立 review；不能引用歷史 candidate 結果宣稱 main 通過。
- [ ] commit／push main；票 07 的 C 條件仍未滿足。

Evidence：`.ai-runs/current/2026-10-07-member04-main-isolated-validation/`。本階段只更新本票、累積 packet 及 local-only 驗證材料，沒有產品程式／schema／migration 修改。Self review：V1 scope、Auth／roles／permissions、state machine、data model、route map 與品牌／RWD 無新增影響；未新增 Wellness／Academy／Retreat、AI matching、payment 或 native app。隔離 DB 與 env guard 尚未在 runtime 執行，不宣稱安全／RWD 驗收完成。其他任務既有 dirty 工作不覆寫；不 auto commit／push。獨立 Reviewer 結果與精準 docs patch 見該 run closeout。

### 隔離驗證續接（2026-10-07，空 DB 身分探測失敗後停止）

產品主人再次選 1，明確指示依已審 `next-resume-builder-prompt.md` 恢復；沿用原隔離 DB／ports／migrations／fixtures／cleanup 與停止條件，無新產品決策。

- [x] 新 resume run 保存395個 source 與124個本地 Prisma client檔案checksum、28 migrations、docs baseline、HEAD／index；schema token檢查通過。
- [x] env guard PASS；驗明local Docker／image／空閒資源與ports，建立指定container／volume，核對ID／run label／本次owner nonce／mount／binding。
- [ ] 驗明空DB身分：`empty-db-identity` exit 1，依停止條件中止。現有probe只保存generic error，未能確認精確原因；readiness只檢查Unix socket，與Prisma使用的TCP目標不同，不能據此宣稱外部TCP已ready。
- [ ] deploy／status既有28 migrations，核對系列欄位（NOT RUN）。
- [ ] fresh build與指定10 specs（desktop／mobile、workers=1；NOT RUN）。
- [x] 核對owned identity後刪除本次container與volume，兩個loopback ports釋放；395 source／124 client checksum、HEAD／index未變。
- [x] 診斷草稿另存新run路徑：明確TCP readiness、allowlist error name／Prisma code、保留redacted container startup log；只syntax check，未執行草稿或重建DB。
- [x] 獨立Reviewer與最終packet：APPROVE限本輪停止收尾與診斷草稿，無blocking findings；review指出草稿log失敗可能妨礙cleanup的P2已修正，stub fault-injection驗證nonfatal diagnostic與identity guard。Runtime／ship未放行；不commit／push、不開始票07。

Evidence：`.ai-runs/current/2026-10-07-member04-main-isolated-validation-resume/`。舊失敗材料保留，不覆寫。

本階段self review：只改本票、累積packet及local-only驗證材料；沒有修改產品source／schema／migration／config／dependencies或其他task文件。符合V1，未新增Wellness／Academy／Retreat、AI matching、金流／退款自動化或native app；Auth／roles／permissions、state machine、data model、routes、品牌／RWD無新增產品變更。僅嘗試連線已批准的專屬DB，不操作共用DB／原server；runtime／新RWD未驗收，不auto commit／push。

### Diagnostic 續接（2026-10-07，Turbopack build 失敗後停止）

產品主人再選1，恢復已審diagnostic Builder；沿用原disposable目標／fixtures／cleanup／stop condition，不新增產品規則。Evidence：`.ai-runs/current/2026-10-07-member04-main-isolated-validation-resume-diagnostic/`。

- [x] 新code-only快照、395 source／124既有client checksum、schema tokens、docs baseline與HEAD／index保存。
- [x] env guard、資源／ports／local Docker／cached image驗明；明確TCP readiness，empty DB identity PASS。
- [x] 在執行DB檢查前將probe SQL的DB／user名稱與information_schema metadata明確cast為text，保留相同identity／empty／URL／client／env guards；無產品source／schema更動。TCP readiness＋metadata cast一起通過，不單獨歸因前次generic failure。
- [x] 僅對專屬新空DB deploy／status既有28 migrations，系列isPublic／suitableFor／preparationNotes欄位核對PASS。
- [ ] fresh production build與指定10 specs：default Turbopack在snapshot的Next package解析失敗，build exit1，smoke NOT RUN；依stop condition未重試。保留raw log，不能宣稱產品compile error或main default build通過。
- [x] owned container／volume清理、startup log安全保存、兩portsfree；395 source／124 client、HEAD／index未變，完整docs patch保存。
- [x] 另存未執行Webpack pipeline草稿：staging先`npm run build -- --webpack`，成功後原Playwright CLI／10 specs／config；不改產品package／config或放寬checks。三草稿syntax PASS。
- [x] 獨立review、最終packet：APPROVE限停止收尾與Webpack pipeline草稿，無blocking findings；本版build／smoke／runtime／ship未放行。不commit／push、不開始票07。

本階段self review：只有本票、累積packet與local-only驗證材料變更；產品source／schema／migration／config／dependencies、Auth／roles／permissions、state machine、data model、routes／品牌／RWD無新增修改。符合V1，未新增Wellness／Academy／Retreat、AI matching、金流／退款自動化或native app。DB操作僅新建驗明的disposable DB（28 migrations，未fixtures），已清除；不碰shared DB／原server／其他task文件。不auto commit／push；runtime／新RWD未驗收。

### 本學員 task 接手 Webpack 驗證（2026-10-07，runtime 與獨立 review 通過）

產品主人在學員 task 選擇 1，批准已審 `next-webpack-builder-prompt.md` 的恢復指示；原老師 task 已停止，沒有同時續跑。沿用產品決策、精確 disposable 目標、10 specs、cleanup 與失敗停止條件。票 06 的原批准保留，票 04 runtime／review 通過後才接續。

- [x] 新 run 保存 395 source、28 migrations、124 client 的 checksum、task-start docs baseline、HEAD／index；Prisma client schema token 與 env 路徑隔離檢查通過。
- [x] env guard、Docker／資源身分、TCP readiness 與 empty DB identity。
- [x] 專屬空 DB 的既有 migrations deploy／status、系列欄位核對。
- [x] fresh Webpack production build；成功後原 10 specs，desktop／mobile、workers=1。
- [x] owned 資源清理、來源／client／HEAD／index 保留檢查。
- [x] self review、完整本輪 patch／packet 與獨立 Reviewer；APPROVE 限本版 Webpack runtime 前置，不將結果寫成 default Turbopack 通過。

Evidence：`.ai-runs/current/2026-10-07-member04-main-isolated-validation-resume-diagnostic-webpack/`。本輪不 commit／push、不開始老師票 07。

本輪結果：Webpack production build 與 TypeScript 通過；原 10 specs 一次執行 **164/164 通過**（desktop／mobile、workers=1）。

Sandbox Docker API denied 的首次 run 未建立 DB，原紀錄保留；依工具權限批准以新 escalated run 重跑。兩份 scripts 只替換 run 路徑，guards 與測試斷言不變。Google 設定使用 process-local 假 ID／secret，瀏覽器導向由既有 smoke 攔截，未執行真實 Google 帳號登入。

本輪 runtime evidence：`.ai-runs/current/2026-10-07-member04-main-isolated-validation-resume-diagnostic-webpack-escalated/`。只修改本票、累積 packet 與 local-only 材料；runtime 完成後先等獨立 Reviewer，尚不宣稱 commit／push readiness，也不開始老師票 07。

獨立 Reviewer 最終 APPROVE，原文保存為該 run 的 `reviewer-output.md`；無 required changes。票 06 的 runtime／review 前置成立，依產品主人原批准在本學員 task 接續；不授權 commit／push、部署、default Turbopack 通過宣稱或老師票 07。

### 票 04 GitHub 交付（2026-10-07，環境權限阻塞）

產品主人在老師 task 明確要求「04 push」，授權票 04 必要的本機 commit 與 GitHub main push；不包含學員票 06、老師票 07、其他 dirty 工作或任意 DB 操作。此為最新交付授權，先前各階段的禁止 ship 紀錄保留為當時的邊界。

- [x] 唯讀核對 GitHub main `928b4d502fa33c0353c4a0aab59f2e7d7b45eef0`；相對本機 `a5c1ec2` 的管理員票 14 增量不碰本票檔案。
- [x] 16 個本票 source／tests／migration 加 lint config 與已通過 runtime 的 frozen checksum 一致；未修改產品程式。
- [x] 整理獨立 20 檔交付 patch（16 source／tests／migration、1 lint config、3 docs）；data-model 僅納入已審系列資訊／公開設定整合段落，排除團主票 15a 與其他未提交內容。
- [x] patch 在最新 GitHub base 的檔案快照上 `git apply --check --no-index` 通過；這不是新的 build／smoke，也不是正式提交。
- [x] 保存本輪 baseline、manifest、交付 patch、檢查與停止原因；來源 HEAD／index 保留。
- [ ] 建立隔離交付 worktree：`git worktree add --detach` 因 `.git/worktrees/checkout` 寫入 Permission denied 停止。此 task 的 `.git` 是唯讀，approval policy 為 never；未嘗試繞過權限。
- [ ] 確認實際 staging 範圍、必要整合檢查與 commit；未執行。
- [ ] normal fast-forward push GitHub main 並驗證遠端 SHA／票 04 migration；未執行，老師票 07 的 C 前置仍未成立。

Evidence：`.ai-runs/current/2026-10-07-member04-delivery/`。恢復 Git 寫入權限後沿用本次「04 push」授權，重新核對遠端及目前來源，不必再次請產品主人批准相同範圍。

Self review：本輪只修改本票的最新狀態與交付進度，並新增 local-only 交付材料；沒有寫入其他任務的產品檔案，20 檔 candidate 是交付快照，不是新產品修改。V1、Auth／roles／permissions、state machines、schema、routes、品牌與 RWD 沒有新增變更；沒有 Wellness／Academy／Retreat、AI matching、金流／退款自動化或 native app。已有驗證限先前的已審 source 與 Webpack pipeline，未宣稱新的完整 main／Turbopack 或學員票 06 驗收通過。本輪未操作 DB／server；commit／push 已獲明確授權但因環境未執行，未開始票 07。

### GitHub 交付續接（2026-10-09）

沿用產品主人「04 push」授權與本輪「同意」，權限已恢復；不新增產品規則、不納入學員票 06／老師票 07 或其他任務未提交內容。

- [x] 核對遠端 main 仍為 `928b4d5`；20 檔 whitelist 與交付材料無 drift，保存主工作樹 69 個 dirty 檔案與 HEAD／index baseline。
- [x] 在最新 main 的獨立 worktree 套用精確票 04 patch；排除團主票 15a 的 data-model hunks。
- [x] 交付tree的TypeScript、full lint、fresh Webpack build；專屬空DB身分與既有28 migrations通過。
- [ ] 10 specs desktop／mobile smoke：162 passed／2 failed（11.1m），不能標成全套通過。兩個原toHaveURL的5000ms失敗：desktop teacher-series-class-edit:343、mobile class-member-info:244；畫面仍儲存中，尚不能確認根因／寫入結果。
- [x] 失敗後owned container／volume清理、portsfree、396 source／124 client hashes及HEAD／index未變；完整失敗證據保留，不修改source／assertions／timeouts。
- [x] 備妥只重跑兩個原案例、沿用同一成功build的新run診斷草稿；schema／client／env／identity／owned cleanup守門保留，syntax PASS；未執行、未重建DB。
- [x] 定向草稿獨立 review APPROVE；產品主人批准「只重跑兩項，通過後 push」。本次 desktop 再次失敗，沒有取得完整有效交付 checks，依指示停止 mobile 與 ship。
- [ ] 核對 source／migration、self review、獨立 Reviewer 與實際 staged whitelist。
- [ ] 必要 commit、normal fast-forward push GitHub main、遠端 SHA／migration 核對；不 force push、不部署。
- [ ] 保留主工作目錄／他人未提交內容、更新本票交付結果；不自動開始票 07。

Evidence：`.ai-runs/current/2026-10-09-member04-delivery/`；實際 runtime 子 run 位於該交付 worktree 的 `.ai-runs/current/2026-10-09-member04-delivery-validation/`。驗證與交付完成後勾選，不以既有候選結果代替此次交付結果。

本輪self review：僅交付票04的既有20檔whitelist與本票最新進度；產品source未新增修改。V1、Auth／roles／permissions、state machines、schema方案、routes、品牌／RWD沒有新規則，未新增Wellness／Academy／Retreat、AI matching、payment／refund automation或native app。主工作目錄HEAD／index不動，學員06／團主15票並行docs更新未覆寫也不納入交付。只操作原批准且驗明的disposable DB；沒有shared DB／原server操作。Commit／push授權保留，但checks未通過不提前ship；票07 C仍未成立。詳見母run packet／manifest／scope-audit與targeted-resume-plan。


### 定向續接收尾（2026-10-09，再次失敗停止）

- [x] 等 prepare 完成後才啟 runner；沿用同一成功 Webpack build，保留原測試檔／assertions／5000ms expect timeout／config，未 rebuild、regenerate 或重跑已成功的 162 項。
- [x] 驗明原指定專屬新空 DB、env 邊界與 owned identity，deploy／status 既有 28 migrations 通過。
- [x] desktop `teacher-series-class-edit.spec.ts:343` 執行一次，失敗於 line 368 容量顯示，預期「已報名 0 / 4 人」、實際「已報名 0 / 10 人」。本次原 line 357 跳頁及後續系列修改斷言已通過；不能因此宣稱全案例通過或確認根因。
- [x] 依任一再失敗就停止：mobile `class-member-info.spec.ts:244` 本次 NOT RUN；沒有繼續修正 source、放寬 timeout、再次重跑、stage／commit／push。
- [x] 保存原 162/2 完整 run、此次 log／error-context／trace；分開 output 沒有覆寫原失敗 evidence。
- [x] 本次 owned container／volume 移除、兩 loopback ports free；396 source／124 client／353 reused build files mismatch 0，HEAD／index 未變，沒有 cleanupFailure／closeoutFailure。
- [ ] 有效 smoke 與 ship review；本輪停止，不能勾選或交付 GitHub。

Evidence：交付 checkout 的 `.ai-runs/current/2026-10-09-member04-delivery-targeted-retry/`。Self review：本輪 repository 只更新本票進度，產品 source／schema／migration 未變；符合 V1，無 Wellness／Academy／Retreat、AI matching、金流／退款自動化、native app。Auth、roles／permissions、state machines、data model、route map、品牌／RWD 無新增變更；本輪失敗不宣稱品質 gate 通過。其他任務 dirty 檔案不納入、不覆寫，主 HEAD／index 保留；04 push 授權保留但檢查未過，未 commit／push，不開始票 07。

### 失敗根因與修正（2026-10-09，Claude）

- 根因：`teacher-series-class-edit.spec.ts:343` 在「只改第一場名額」那段按下「儲存修改」後，沒等存檔完成就 `page.goto` 到系列頁；機器忙時換頁會打斷還在處理的存檔，名額維持 10。失敗截圖沒有錯誤訊息、第一場仍是原值，與此一致。產品 source（改課 action 會讀名額、成功才 redirect）沒有問題。
- 修正：只改測試，按下儲存後加 `await expect(page).toHaveURL(...)` 等跳回課程詳情頁，與同檔第 357 行、`class-member-info.spec.ts:261` 的寫法一致。未改 timeout、assertion 或產品 source。
- [x] 主工作目錄 `PORT=3100 CI=1`：`npm run test:smoke`（含 pretest build，Next 16 預設 build）desktop `teacher-series-class-edit.spec.ts:343` 通過；mobile `class-member-info.spec.ts:244` 通過。使用本機共用開發 DB，未用隔離 DB。
- 尚未做：commit／push 需產品主人另行同意；完整 smoke 未重跑（本次只跑原失敗的兩項）。
