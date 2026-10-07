# 管理後台第二輪實作計畫

日期：2026-10-03。狀態：訪談 Q1–Q20 與完整方案已確認；產品主人選擇在目前 task 執行第一批，並以「照這 4 票切」核准票券。第一批四票已實作並完成工程檢查。後續狀態見第 5 行與第 5 節（第一批、第二批均已畫面驗收）。

2026-10-04 更新：產品主人確認第二批 05–08 四票切分，授權在現有 task 寫入 draft tickets。同日產品主人看過第一批 desktop／mobile 截圖後回覆「第一批通過，開始做 05」，第一批畫面驗收完成，第二批 Builder 在現有 task 放行，依 05 → 06 → 07 → 08 施工。

規格：`docs/specs/admin-usability-redesign-spec.md`。決策來源：`docs/admin-usability-plan.md` 第二輪。

## 1. 執行原則

依 spec → plan → build → test → review → ship 執行；ship 在本任務僅代表產出可驗收成果，不包含 commit、push、部署或發布。每批先完成 desktop／mobile 檢查並回報，再由產品主人看過畫面才進下一批。不得把訪談選項確認解讀為跨越所有後續 gate。

保留現有 Auth、Prisma schema、permission model、state machine、公開／其他角色流程。Admin 資料讀取及 action 必須仍走服務與 server-side guard；新的 query／窄 DTO 需要 security self review。UI 上下文解析不承擔授權判斷。

工作開始及每批前重新確認 git status，不覆蓋其他 task 變更。目前既有 docs 修改來自本訪談；另外出現的 `docs/member-flow-redesign-plan.md` 不屬於本輪，保持原樣。

## 2. 四批切片與順序

### 第一批：共用列表、查找與返回

目標：admin 能從一致的入口定位資料，進入詳情或操作後不失去原搜尋／分類脈絡。

- 導覽改為工作總覽／老師／需求／課程與報名／團體；保留管理後台 area label 與現有角色切換。
- 四種列表套用已核准的基本搜尋、結果數、無結果與清除條件；老師與需求狀態分類一致，補完整需求分類。
- desktop 緊湊列表、mobile 單欄卡片；套用已核准排序。
- 詳情返回及既有成功導向保留來源列表條件。單筆報名取消仍留名單，完整名單搜尋於第三批補齊。
- 詳情本批只增上下文傳遞，不重排內容或變更審核規則；action 本批只增合法返回與結果對象追查，不新增狀態能力。
- 第一批先支援搜尋／狀態的保存；第三批新增關聯與名單條件時沿用同一上下文機制，不讓第一批依賴尚未建立的關聯入口。

候選檔案邊界：

- `src/app/admin/_components/*`、`src/app/admin/_lib/*`（只增本批需要的搜尋、列表、上下文元件／helper）。
- `src/app/admin/teachers/page.tsx`、`src/app/admin/demands/page.tsx`、`src/app/admin/classes/page.tsx`、`src/app/admin/organizations/page.tsx`。
- `src/app/admin/teachers/[teacherProfileId]/page.tsx`、`src/app/admin/demands/[demandRequestId]/page.tsx`、`src/app/admin/classes/[classSessionId]/page.tsx`（只改來源上下文／返回及結果入口）。
- `src/app/admin/teachers/actions.ts`、`src/app/admin/demands/actions.ts`、`src/app/admin/classes/[classSessionId]/actions.ts`（只改上下文、redirect 與結果追查）。
- 若搜尋需讀取層調整：`src/domain/teacher-profile/service.ts`、`src/domain/demand-request/admin-service.ts`、`src/domain/class-session/admin-service.ts`、`src/domain/organizer-profile/admin-service.ts`，僅涉及本批 admin 讀取；不可改其他能力或 mutation 核心。
- 相關 admin smoke tests、必要的 admin query／上下文純函式測試，以及本規格、計畫與 route／review workflow 的實作紀錄。

完成條件：四列表可搜尋；結果／分類數量一致；老師／需求草稿不可見；需求完整分類可用；返回與成功結果保持搜尋／分類；非法 return 值不能造成外部或跨角色跳轉；desktop／mobile 基本查找與返回通過。

### 第二批：審核閱讀、表單與操作回饋

目標：先看清楚對象與資料再做決定，失敗不用重新填寫。

- 老師／需求詳情改摘要 → 重要內容 → 次要資訊 → 操作；頁首提供頁內跳轉，次要資料收合。
- 退回原因按需展開，替換已核准六句範本與需求錯誤 resubmit 提示；暫停原因驗證維持既有規則。
- 統一處理中、停用與錯誤回饋；原因保留採本頁表單狀態，不放 URL，不新增 schema／persistent draft。
- 確認視窗顯示操作對象與實際後果；恢復一鍵，暫停確認；不變更 service 的條件與通知。

候選檔案：老師／需求詳情及其 actions、admin 共用表單／提示元件；課程詳情及其 actions 僅處理票 08 的取消對象、確認、pending／錯誤與結果回饋，不重排課程內容或補第三批名單能力；相關 admin smoke tests。必要時擴充既有元件，保持其他角色行為不變，domain services／mutation cores 不變。

已確認的票券切分（2026-10-04，完整條件見 [票單](admin-usability-redesign/tickets/README.md)）：

- 05：老師申請閱讀與審核回饋，驗證共用表單／失敗回饋模式；第二批內無票券依賴。
- 06：需求閱讀與審核回饋，包含正確「另建需求」文案；依賴 05。
- 07：老師暫停與恢復，原因／對象確認、一鍵恢復及回饋；依賴 05。
- 08：課程與報名取消確認及回饋；第二批內無票券依賴。

四票均為 STANDARD、Human Gate yes，切票時 Status 為 draft（2026-10-05 已全部畫面驗收，狀態見第 5 節）。第二批內的技術依賴與第一批畫面／本批 Builder gate 分開記錄；切票核准不等於實作放行。為避免共用元件衝突，依 05 → 06 → 07 → 08 施工，後續變更共用元件時回歸已完成票券。

完成條件：必看資料完整；正常通過與退回可完成；原因不足、資格變動或 service 失敗時留當頁且保留輸入；送出中不能重複提交；兩種裝置與鍵盤的確認／返回均可用。

### 第三批：跨資料、課程、名單與總覽

目標：從已知資料追到相關資料，並能在同一課程內連續處理報名。

- 以既有關聯 id 補團體／老師／需求／課程之間的導覽；限定列表可顯示對象與清除條件。
- 課程窄 DTO 補完整課程風格、瑜伽類型、來源、報名方式與公開狀態；不新增編輯／代建／系列管理能力。
- 名單顯示姓名＋email、搜尋及狀態數量；補既有 pending 取消 UI。取消單筆後留在名單並保留條件；已移出分類的結果仍可追查。
- 工作總覽維持待辦最優先；KPI 提供精準分類與未開始課程入口，已確認報名只作統計。
- 團體相關需求計數／入口遵守 non-draft 可見範圍；不把原始 relation count 當可查看數量。

候選檔案：admin dashboard／四列表／三詳情／共用上下文與名單元件；admin dashboard、老師、需求、課程、團體讀取服務；相關 smoke tests。禁止改 enrollment／class cancellation 核心、state 或 schema。

已確認票券切分（2026-10-05 產品主人確認，完整條件見 [票單](admin-usability-redesign/tickets/README.md)）：

- 09：團體／老師的關聯限定列表，擴充 `list-context.ts` 關聯條件；第三批內無票券依賴。
- 10：需求、課程詳情之間的關聯入口與團體限定；依賴 09。
- 11：課程詳情摘要優先與完整課程資料；第三批內無票券依賴。
- 12：報名名單姓名＋email、搜尋分類與 pending 取消入口；依賴 11。
- 13：工作總覽 KPI 精準入口與「即將開始」課程條件；依賴 09。

五票均為 STANDARD、Human Gate yes。產品主人已放行 Builder 從 09 開始，依 09 → 10 → 11 → 12 → 13 施工，每票完成回報後再接下一票。

完成條件：有關聯時一次點擊到精準目的；老師自建課無需求／團體時不產生死連結；同名資料仍依 id 正確限定；KPI 與結果條件相同；pending／confirmed 取消、不可重報、跨開始時間與連帶效果不變；名單輸入只在 admin 邊界呈現。

### 第四批：整體回歸與畫面驗收

目標：驗證整條工作路徑；不得用最後一批補做前三批本應完成的手機基本檢查。

- 從工作總覽到審核完成、查找歷史資料、從團體追課程、從課程處理報名，整條 desktop／mobile smoke。
- 檢查長名稱、email、長原因、多個篩選、零結果、剛處理資料移出分類、無關聯與已有歷史狀態。
- Role guard／server action、草稿不可見、狀態與時間邊界、通知及 App-ready 邊界回歸。
- 整理實際截圖與檢查結果；產品主人確認畫面後才記錄驗收，不能把程式測試通過寫成使用者已驗收。

本批原則上是 verification；若有 blocking finding，修復須限定本輪範圍並重跑受影響 checks，不順手修其他 backlog。

## 3. Checks 與測試環境

- 每批 code 變更：`npx tsc --noEmit`、`npm run lint`、`npm run build`、`git diff --check`。
- 在 build 後設定 `$env:PORT='3100'`，執行本批受影響的 admin smoke specs；現有 Playwright projects 已含 1280px desktop 與 390px mobile。沿用 serial workers 及測試 fixture 清理，不連用 3000 開發伺服器。
- 變更 query／返回 helper 或邏輯時補有意義的純函式或 service 驗證，優先使用 repo 現有測試能力；尚無 Vitest 設定，不為本輪自行新增 package。
- 第四批執行全部 admin smoke 與受影響的 role switching／signed-in navigation／老師狀態／enrollment 邊界測試，依實際 diff 選定。
- 每批親看 desktop／mobile 畫面，檢查首屏、長內容、橫向溢出、焦點、鍵盤／觸控與操作位置；沒有可用登入狀態時回報未驗證項，不宣稱完成 manual smoke。
- 本次 docs-only 整理不跑 code 或 DB 測試；只做 diff、連結、決策與 domain 一致性檢查。

## 4. Gate 與完成報告

完整方案共同理解與第一批 Builder 已獲產品主人確認。每批完成後提供 changed files、diff、checks、manual smoke、self review、scope drift、未驗證項與下一步；正式 review packet 使用 `docs/harness/review-packet-spec.md` 的完整 Common Handoff Schema。第一批、第二批成果已交付並經產品主人畫面驗收（2026-10-04、2026-10-05）；第三批仍須另行切票與放行。

遇到需要更改 Auth／schema／permissions／state machine／既有 core transition、擴大 scope、覆蓋其他 task 的檔案或擴大 checks repair 時，停止該擴大工作並提出具體影響與選項。不得自行 commit／push／部署。即使第一批通過，也不能自動進第二批；待產品主人看畫面。

## 5. 狀態紀錄

| 階段 | 狀態 |
| --- | --- |
| 訪談設計選項 | Q1–Q20 已確認。 |
| 完整方案共同理解 | 已確認，產品主人回覆「1」選擇現有 task 執行。 |
| 第一批 | [四張票](admin-usability-redesign/tickets/README.md) 已實作；typecheck／lint／build／diff check 通過，88 項 smoke 覆蓋最終皆通過；desktop／390px mobile 截圖已檢查；2026-10-04 產品主人回覆「第一批通過，開始做 05」，畫面驗收完成。 |
| 第二批 | [05–08](admin-usability-redesign/tickets/README.md) 已實作，各票經 Codex peer review 核准；typecheck／lint／build／diff check 通過，admin smoke 與受影響回歸通過（高負載下的長流程逾時已單獨重跑通過並記錄於票券）。2026-10-05 產品主人回覆「第二批畫面看過了，通過」，畫面驗收完成。 |
| 第三批 | 2026-10-05 切 [09–13](admin-usability-redesign/tickets/README.md) 五張票並經產品主人確認。09–12 已實作、各票經 Codex peer review 核准並畫面驗收通過（09、10–11、12 已分三次 commit／push 到 main）。13 與課程來源用詞統一（2026-10-06 產品主人選 1）已實作、經 Codex 核准，2026-10-06 畫面驗收通過。第三批完成；第四批狀態見下一列。 |
| 第四批 | 2026-10-06 [票 14](admin-usability-redesign/tickets/14-full-regression-and-visual-acceptance.md) 原畫面以私人 Artifact 驗收；原完整 300 項回歸是歷史紀錄。Codex review 指出結果提示溢出與同名老師不可辨識，產品主人授權修正；2026-10-07 補固定 viewport 反證與同名老師測試後，typecheck／lint／build／diff check 與 164/164 admin／暫停回歸通過，獨立 Reviewer APPROVE（報告在 `.ai-runs/admin14-review-fixes/independent-review.md`）。同日產品主人看過八張修正截圖並回覆「修正畫面接受」，之後另以「commit+push」授權提交及推送本票八檔至既有 Claude 分支。人工鍵盤／實機觸控未另測，Artifact 未更新或重新發布。 |
| Commit／push／部署 | 票 14 已依產品主人 2026-10-07 明確授權，以 `1830513` 提交並推送 `origin/claude/nice-fermat-7b1fb3`；之後產品主人另要求推送 main，放行在既有 Claude worktree 整合最新 main 並常規推送。整合後 build／TypeScript／lint／diff check 與 172/172 admin／老師暫停／系列公開設定回歸通過。不收錄其他 task 的未提交變更，部署與重新發布 Artifact 未授權。 |

## 6. 第一批 Builder prompt（已核准）

此 prompt 對齊 `docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md`。產品主人已確認方案並選擇現有 task；授權僅限第一批，後續批次仍需先看過本批畫面。

```text
我確認 docs/specs/admin-usability-redesign-spec.md 及四批計畫已反映 Q1–Q20，我們已達共同理解。請依 docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md 執行第一批 Builder。

Approved task:
僅實作 docs/superpowers/plans/2026-10-03-admin-usability-redesign-plan.md 第一批「共用列表、查找與返回」：共用導覽、四列表搜尋與篩選、完整需求分類、已核准排序、RWD，以及來源搜尋／分類的返回與既有操作成功導向。第二至四批不得自動開工。

開始前：讀 AGENTS.md、完整新規格、四批計畫與既有 admin source；檢查 git status 並辨識其他 task 變更，只在本批範圍內工作。

Allowed files:
- src/app/admin/_components/*、src/app/admin/_lib/*，僅本批必要的共用列表、搜尋、上下文 helper。
- src/app/admin/teachers/page.tsx、src/app/admin/demands/page.tsx、src/app/admin/classes/page.tsx、src/app/admin/organizations/page.tsx。
- src/app/admin/teachers/[teacherProfileId]/page.tsx、src/app/admin/demands/[demandRequestId]/page.tsx、src/app/admin/classes/[classSessionId]/page.tsx；詳情本批只改上下文／返回與結果追查。
- src/app/admin/teachers/actions.ts、src/app/admin/demands/actions.ts、src/app/admin/classes/[classSessionId]/actions.ts；只改上下文／redirect 與結果追查。
- src/domain/teacher-profile/service.ts、src/domain/demand-request/admin-service.ts、src/domain/class-session/admin-service.ts、src/domain/organizer-profile/admin-service.ts；僅必要的 admin 讀取，不改 mutation 或其他角色。
- tests/smoke/admin-*.spec.ts，包含必要的新 admin 上下文／查詢測試。
- docs/admin-usability-plan.md、docs/specs/admin-usability-redesign-spec.md、docs/superpowers/plans/2026-10-03-admin-usability-redesign-plan.md、docs/product/route-map.md、docs/specs/admin-review-workflow-spec.md，僅記錄本批實作及驗證狀態。

Forbidden files / areas:
Auth/session、Prisma schema/migrations、permission model、domain state/validation/mutation cores、package/lock/env/deployment、其他角色或公開 UI，以及其他 task 變更。不得新增其他批次的表單重排、完整課程欄位、關聯入口或名單能力；不動 backlog 17 的授權功能。

Completion criteria:
符合計畫第一批完成條件。搜尋欄位與分類／結果數正確；清除條件可用；草稿不因搜尋出現；成功與返回保留搜尋／分類，結果可追查；無效 return 值安全回退，不能外部或跨角色 redirect；desktop／390px mobile 可完成本批查找與返回。

Checks to run:
npx tsc --noEmit
npm run lint
npm run build
git diff --check
build 後在 PowerShell 設定 $env:PORT='3100'，執行 npx playwright test admin- role-switch.spec.ts（以 Playwright 檔案名稱 filter 選取 admin specs 與角色切換回歸），含兩個現有 desktop/mobile projects。
對變更的 query／上下文邏輯補有意義的測試，使用 repo 現有能力，不自行新增 Vitest 或 package。
親看 desktop/mobile 的首屏、搜尋、分類、返回、長文字與無結果畫面；無法驗證時明確報告，不宣稱已完成。

Stop conditions:
- 需超出 allowed files，或覆蓋其他 task 工作。
- 需更改 Auth/schema/permissions/state machine/既有 core transition，或超出本批已核准流程。
- checks repair 會擴大 scope。
- 本批完成後停下讓產品主人看畫面，不自動進下一批。

Output Report Requirement:
繁體中文回報 Changed files、本批完整 git diff／新檔內容、checks result、manual smoke result、self review、scope drift、未驗證項，以及 Recommended Next Step。若產出正式 Builder Review Packet，必須使用 docs/harness/review-packet-spec.md 的完整 Common Handoff Schema。不得把其他 task diff 歸到本輪，也不得把產品主人尚未確認的畫面寫成已驗收。
不 commit、不 push、不部署。
```

<!-- codex-peer-reviewed: 2026-10-04T21:27:48Z rounds=1 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T03:25:05Z rounds=2 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T21:19:50Z rounds=2 verdict=approved -->
