# 03: 單堂課的適合對象與準備事項

**What to build:** 老師建立單堂課時，可以在同一頁選填「適合對象／程度」與「準備事項」；學員（訪客與登入者）在課程詳情看到這兩段。沒填的課（含舊課與團主團課）顯示「尚未提供」。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（Prisma schema 新增欄位與 migration；需產品主人確認具體 Builder plan）

**Risk flags:** Prisma schema、migration、老師建課 write path、公開／學員詳情 DTO。

**Source:** `docs/member-flow-redesign-plan.md` Q8、Q11、分批表第 2 批。

## 已決定的規格（Q11，不重問）

- `ClassSession` 新增 nullable `suitableFor`、`preparationNotes`，各最多 500 字；trim 後空字串視為未提供。
- 不做等級 enum，不從課程類型推測內容；舊課與團主團課不回填。
- 本票只做建立時填寫；不新增建課後編輯，也不擴充團主建課表單。
- 2026-10-04 修訂（產品主人選 A，配合 `docs/specs/teacher-class-scheduling-spec.md` Q7）：這兩段屬於「內容類欄位」，之後由老師排課票 04（單堂改課）、05（系列改課）提供建立後修改，規則與課程介紹相同（隨時可改、不通知）。欄位與 validation 要能讓改課票直接重用。
- 條件式責任：開工時先查 main。若老師排課票 04（單堂改課）**尚未完成**，本票不實作修改，由該票之後補上；若**已完成**，本票必須在既有單堂改課表單與寫入路徑一併加上這兩段（隨時可改、不通知），並納入下方驗收。
- `RecurringClassSeries` 的欄位留給票 04，本票只做單堂。

## Builder plan（2026-10-05，待 Human Gate）

查證（main `89d3ac9`）：
- 老師排課票 04（單堂改課）已隨 `36d56e5` 完成，所以依條件式責任，**本票要一併在單堂改課加上這兩段**。改課是整份表單重送、經 `validateClassSessionCreate` 重新驗證（`edit-class-session-core-for-teacher.ts`）；只在時間或地點變動時通知，新欄位修改不會觸發通知。
- `validateClassSessionCreate` 由老師單堂建立、老師改課、團主媒合建課共用。團主路徑不傳新欄位，結果為 null，不受影響。
- 主工作目錄目前有其他任務（團主重新設計票 09）未 commit 的 `service.ts` 等修改，因此本票在獨立 worktree／分支實作，完成後再合併回 main；合併若有衝突，回報衝突內容與解法。

做法：
1. **Schema**：`ClassSession` 新增 `suitableFor String?`、`preparationNotes String?`（與 `description` 同為 text，長度由應用層限制）。新增一個 migration，只有兩個 `ADD COLUMN`（nullable、無預設值、不回填）。`RecurringClassSeries` 的欄位留給票 04。
2. **驗證**（`src/domain/class-session/validation.ts`）：輸入新增兩個選填欄位；trim 後空字串視為 null；各上限 500 字，超過回 `suitable_for_too_long`／`preparation_notes_too_long`，訊息「適合對象不可超過 500 個字。」「準備事項不可超過 500 個字。」；`normalized` 帶出兩欄。
3. **老師單堂建立**：建課表單在「課程內容」區、課程說明之後加兩個選填 textarea（`maxLength=500`，附簡短提示），不增加步驟；`form-state.ts` 的欄位清單與錯誤對應、`actions.ts` 讀取、`create-teacher-class-session-core.ts` 寫入兩欄；建立摘要（`ClassCreateSummary`）列出兩段，空白時寫「未填寫」。`ClassSessionCreateForm` 是單堂／每週固定／指定日期共用元件，且改課也用它（一律 `mode="single"`，系列場次另以 `editScope` 區分），所以顯示條件不能只看排程模式：**只有「建立單堂課」與「改不屬於系列的單堂課」顯示這兩欄**；建立系列、改系列場次（「只改這一場」與「改這一場和之後所有場次」兩種）一律不顯示，摘要同樣不列。系列的兩種改法由 member-flow 票 04 一起加上，避免本票在「改這場和之後」顯示了卻被 `edit-series-from-occurrence-core.ts` 忽略。
4. **老師單堂改課**（`src/app/teacher/classes/[classSessionId]/edit/`、`edit-class-session-core-for-teacher.ts`、`service.ts` 的改課輸入對應）：只針對不屬於系列的單堂課；表單帶入目前值，可修改或清空；寫入兩欄；不新增通知。系列場次的「只改這一場」雖然也走這個核心，但本票不在表單顯示、action 不傳這兩欄，核心收到未提供時**保留原值**（不是清成 null），避免系列場次被誤清。
5. **讀取與呈現**：
   - 公開詳情（`public-read-service.ts`）與學員詳情（`enrollment/read-service.ts`）的 select 與 DTO 加兩欄。
   - 學員／訪客課程詳情：在「課程說明」之後新增「適合對象」「準備事項」兩個區塊，缺值顯示「尚未提供」；保留 `whitespace-pre-wrap` 與長字換行；不改報名區位置。
   - 老師列表／詳情與改課預填實際讀取的是 `src/domain/class-session/__internal__/class-session-detail-core-for-teacher.ts` 的 `teacherFacingClassSessionSelect`：select 與型別加兩欄（DTO 為 `string | null`，不用空字串代替，避免預填遺失原值）。老師自己的課程詳情（`src/app/teacher/classes/[classSessionId]/page.tsx`）顯示兩段；`src/domain/class-session/read-service.ts` 若有其他老師端讀取也一併補齊。
6. **文件**：`docs/domain/data-model.md` 的 `ClassSession` 段落記錄兩欄、選填、500 字、建立與單堂改課可填、團主路徑與舊資料為 null。

不做：建課後的系列場次修改（票 04）、團主建課表單、舊資料回填、新通知類型、報名或權限變更。

**資料庫操作（需產品主人明確同意）**：
- 在 worktree 產生 migration 檔與 Prisma client（client 只在 worktree 的 node_modules 複本內）。
- 要跑 smoke，需要把這個 migration 套用到**本機開發用 PostgreSQL**（所有工作階段共用）。只新增兩個 nullable 欄位：其他工作階段尚未知道這兩欄的程式碼照常運作（它們不讀不寫這兩欄）。合併回 main 後，主工作目錄需 `npx prisma generate`，開發伺服器需重啟才會讀到新欄位。
- 不碰任何正式環境（目前沒有）。

Allowed files：`prisma/schema.prisma`、新 migration 目錄、`src/domain/class-session/validation.ts`、`src/domain/class-session/__internal__/create-teacher-class-session-core.ts`、`src/domain/class-session/__internal__/edit-class-session-core-for-teacher.ts`、`src/domain/class-session/service.ts`（只限建立／改課輸入對應兩欄）、`src/domain/class-session/read-service.ts`、`src/domain/class-session/__internal__/class-session-detail-core-for-teacher.ts`、`src/domain/class-session/public-read-service.ts`、`src/domain/enrollment/read-service.ts`、`src/app/teacher/classes/new/`（表單、`_lib/form-state.ts`、單堂 `actions.ts`、摘要）、`src/app/teacher/classes/[classSessionId]/edit/`、`src/app/teacher/classes/[classSessionId]/page.tsx`、`src/app/classes/[classSessionId]/page.tsx`、`docs/domain/data-model.md`、新測試 `tests/smoke/class-member-info.spec.ts`、本票。

測試計畫（`tests/smoke/class-member-info.spec.ts`＋既有相關 smoke）：
- 驗證純函式：空白→null、trim、500 字通過、501 字回錯誤碼。
- 老師建立單堂課填兩段 → DB 有值 → 訪客與登入學員詳情都看到，位置在課程說明之後。
- 不填 → 詳情顯示「尚未提供」；舊課（直接以 fixture 建、欄位 null）與團主媒合課同樣顯示「尚未提供」。
- 超過 500 字：測試先移除 textarea 的 `maxLength` 屬性再填 501 字（否則瀏覽器會先截斷，測不到 server 驗證），表單顯示錯誤、保留其他輸入、沒有建立課程。
- 單堂改課：建課後老師詳情看得到兩段 → 改課表單正確預填 → 不動這兩欄、只改標題儲存，兩段原值保留 → 修改、清空都生效；已報名學員沒有收到新通知；500 字限制一致（同樣移除 `maxLength` 測 501 字）。
- 系列：建立系列與改系列場次（兩種範圍）都不出現這兩欄；系列場次「只改這一場」儲存後，兩欄維持原值（null）。
- 手機 375 與桌機：長文字換行、無橫向捲動。
- 一次執行：新 spec＋teacher-class-edit、teacher-class-usability、class-session-creation、teacher-initiated-open-classes、public-classes-discovery、enrollment 相關 smoke 全過。

## Acceptance criteria

- [x] 開工前提供具體 Builder plan（allowed files、migration 內容、影響、checks），經 Human Gate 確認（2026-10-05 產品主人選 A，含同意套用到本機開發資料庫）
- [x] 老師單堂建課表單新增選填區，不增加步驟；超過 500 字有明確錯誤
- [x] 送出後資料正確寫入；空白視為未提供
- [x] 訪客與登入學員詳情都在「介紹」之後顯示兩段；缺值顯示「尚未提供」
- [x] 舊課、團主團課詳情正常，顯示「尚未提供」
- [x] 僅在老師排課票 04 已完成時：單堂改課可修改、清空這兩段，500 字限制一致，修改後不發通知，學員詳情顯示新內容
- [x] `docs/domain/data-model.md` 同步更新
- [x] `npx prisma validate`、client generation、migration 內容審核；不自行對真實 DB 執行 migration／db push（只依產品主人同意對本機開發資料庫執行 `prisma migrate deploy`）
- [x] tsc、lint、build；smoke 覆蓋有填／沒填／超長／舊課／團主課，手機 375 與桌機

## 實作結果（2026-10-05，未 commit）

**Status 補充：** 已實作並驗證，在分支 `member-flow-03-class-info`（worktree `C:/Users/franz/fsy-03`，基底 main `89d3ac9`）；尚未 commit、尚未合併回 main。

Changed files：`prisma/schema.prisma`、`prisma/migrations/20261005200000_class_session_member_info/`（新）、`src/domain/class-session/validation.ts`、`src/domain/class-session/__internal__/create-teacher-class-session-core.ts`、`src/domain/class-session/__internal__/edit-class-session-core-for-teacher.ts`、`src/domain/class-session/__internal__/class-session-detail-core-for-teacher.ts`、`src/domain/class-session/read-service.ts`、`src/domain/class-session/public-read-service.ts`、`src/domain/enrollment/read-service.ts`、`src/app/teacher/classes/new/_components/ClassSessionCreateForm.tsx`、`src/app/teacher/classes/new/_lib/form-state.ts`、`src/app/teacher/classes/new/actions.ts`、`src/app/teacher/classes/[classSessionId]/edit/actions.ts`、`src/app/teacher/classes/[classSessionId]/edit/page.tsx`、`src/app/teacher/classes/[classSessionId]/page.tsx`、`src/app/classes/[classSessionId]/page.tsx`、`docs/domain/data-model.md`、`tests/smoke/class-member-info.spec.ts`（新）、本票。

與計畫的差異：
- `service.ts` 不需要修改：建立與改課的 service 都把輸入原樣傳給核心，所以沒有動到其他任務正在改的 `service.ts`。
- 驗證過程發現並修正一個真的 bug：表單送出時瀏覽器把換行變成 `
`（兩個字元），但輸入框的 `maxLength` 把換行算一個字，含換行、剛好 500 字的內容會被 server 誤判超過。`normalizeMemberInfoText` 先把 `
` 統一成 `
` 再檢查長度，並加了回歸測試。
- 系列場次「只改這一場」不顯示這兩欄，改課 action 沒收到就傳 `undefined`，核心保留原值（測試以已有內容的系列場次驗證不會被清掉）。

資料庫：依產品主人同意，對本機開發 PostgreSQL 執行 `prisma migrate deploy`，只套用本票 migration（兩個 nullable `ADD COLUMN`）；執行前確認其他 migration 都已套用。合併回 main 後，主工作目錄需 `npx prisma generate` 並重啟開發伺服器。

驗證（worktree，PORT=3300，production build）：
- `prisma validate`、tsc、全專案 eslint、`next build` 通過。
- 新 spec `class-member-info` 14/14（desktop／mobile；修正後為 16 支）。
- 一次執行 class-member-info＋teacher-class-edit＋teacher-series-class-edit＋teacher-class-usability＋teacher-recurring-class-series＋class-session-creation＋teacher-initiated-open-classes＋public-classes-discovery＋enrollment：**152/152 通過**。
- 375px 截圖：兩段在課程說明之後，長文字換行、無橫向捲動。
- 測試撰寫過程的失敗都是測試寫法（等待網址的規則），已修正。
- Codex 實作 review 第 1 輪發現：「適合對象與準備事項」區塊的展開狀態完全由「有沒有內容」決定，清空唯一有內容的欄位時區塊會突然收起、打斷重寫。改為比照課程說明，由使用者的展開狀態決定（已有內容或送出錯誤時展開），並新增「清空後繼續輸入」測試；改課測試補上學員端讀回新內容（清空的顯示「尚未提供」）。
- 修正後重新 tsc、全專案 eslint、build 通過，並以同一組 spec 再一次執行：153 passed／1 failed。失敗為 `teacher-recurring-class-series.spec.ts:59` desktop（建立每週固定系列後 5 秒內未看到成功訊息），本票未改系列建立路徑、該區塊在系列模式不顯示；單獨 `--repeat-each 4` 8/8 通過，判定為偶發的速度問題，未能證實根因。
- 證據：`.ai-runs/member-flow-redesign-03/`（`final-command.txt` 為最後一次執行指令，`final-full-output.log` 為完整輸出，`series-rerun.log` 為重跑）。

Security self review：只新增老師自己課程的兩個文字欄位；寫入仍經既有 own-scope、approved 老師、狀態與開始時間檢查；學員端只讀既有可讀課程的欄位，未改可見範圍；以 React 文字輸出（無 HTML 注入）。


<!-- codex-peer-reviewed: 2026-10-05T13:55:06Z rounds=2 verdict=approved -->
