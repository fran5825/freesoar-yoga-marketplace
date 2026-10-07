# 14: 第四批整體回歸與畫面驗收

**What to build:** 不新增功能。把第一到三批做好的管理後台，用整條日常工作路徑在 desktop 1280px 與 mobile 390px 各走一遍、留下每一步的截圖，並跑完整的權限、草稿、狀態與時間邊界回歸；整理成一份產品主人可以在手機上翻閱的驗收畫面集。只有發現「阻擋驗收」的問題時，才在本輪範圍內修正並重跑受影響的檢查。

**Blocked by:** 13（第三批全部完成並已 push，2026-10-06）。

**Status:** 兩項 review findings 已修正，工程驗證與獨立 Reviewer 複查 APPROVE；2026-10-07 產品主人看過本次八張 desktop／mobile 重點截圖後回覆「修正畫面接受」，修正畫面驗收完成。同日另回覆「commit+push」，授權提交及推送票 14 完整成果。2026-10-06 原畫面驗收與本次修正驗收分開記錄；部署及重新發布 Artifact 未授權。

**Workflow mode:** STANDARD（verification；修正只限阻擋項）

**Human Gate:** yes（檢查清單確認、以及最後的畫面驗收，都要產品主人紀錄；程式測試通過不等於產品主人已驗收）。

**Risk flags:** SCOPE_DRIFT_RISK（不順手修 backlog）、BRAND_RISK、LOW_PRESSURE_UX_RISK。

**來源：** 計畫第 2 節「第四批」、第 3 節 checks；規格第 11 節驗收清單。

## A. 整條工作路徑（desktop＋mobile，每步截圖）

新增一支逐步截圖的 journey 測試（例如 `tests/smoke/admin-journey.spec.ts`），用自己建立、測完清掉的資料走：

1. 工作總覽 → 一次點擊進待審老師 → 先閱讀再通過；另一位用範本退回、原因不足失敗後原因仍在、修正後退回 → 回到原列表與條件。
2. 工作總覽 → 待審需求 → 公開；另一筆退回並確認「另建需求」文案。
3. 老師列表搜尋 → 已通過 → 暫停（原因＋確認老師與影響）→ 結果提示可追查 → 恢復。
4. 查歷史資料：需求列表「已建課」→ 需求詳情 → 查看課程 → 授課老師 → 這位老師的課程。
5. 團體列表 → 查看需求／查看課程（限定列表）→ 課程詳情 → 名單搜尋與分類 → 取消待老師確認的報名、取消已報名的報名（留在名單、保留條件、查看這筆）→ 取消整堂 → 回原課程列表。
6. 工作總覽 KPI → 四個精準列表（含「即將開始」條件）。
7. 送出中防重複：通過、公開、退回、暫停、恢復各做一次「延遲伺服器回應」——按鈕顯示處理中並停用、同一筆的其他審核操作也停用、強制再點不會再送出、實際只送出 1 次請求，放行後結果正確（比照票 08 取消的同類測試）。
8. 重新整理不遺失：老師、需求、團體、課程列表各自帶上適用的搜尋＋分類＋關聯／即將開始條件後重新整理，網址、搜尋框內容、目前分類、限定對象提示與結果筆數都不變；課程詳情的名單搜尋與分類也一樣。
9. B1 同名老師：建立名稱、狀態、地區、年資與更新時間相同的兩位老師；列表顯示各自 email，點擊依 id 開到正確詳情且 email 一致；desktop／mobile 各留列表與詳情截圖。

## B. 邊界資料（同一支或分開的測試）

- 長名稱、長 email、長退回原因；同名團體／老師；多個篩選同時成立；零結果與清除條件。
- 剛處理的資料移出分類後仍可追查（老師、需求、課程、報名）。
- 沒有關聯：老師開課（無需求、無團體）、團主直接開團（有團體、無需求）。
- 歷史狀態：已出席、未出席、已取消、已完成的課程。
- 視覺通過條件（每項都在 desktop 1280px 與 mobile 390px 親看截圖；畫面穩定後，document／body 的 `scrollWidth` 與文字右緣不得超出 `page.viewportSize().width`，容許 1px rounding）：長名稱、長 email、長原因與確認視窗內容完整換行、不被截斷；沒有頁面橫向溢出；送出、取消、返回等操作不被遮擋且可點；同名團體／老師在列表與詳情上能靠聯絡方式或 email 分辨。手機 `innerWidth` 可能隨溢出內容變寬，不能作為驗收基準。
- 人工檢查（計畫第 3 節）：鍵盤 Tab／Enter／Esc 完成確認視窗與主要操作、焦點回到觸發按鈕；手機觸控可完成同樣操作。無法實際操作的項目明列為未驗證。

## C. 權限、草稿與規則回歸

- 非 admin 打開每個 admin 頁面（含帶條件的網址）都是 404；admin action 仍擋。
- 讀取層 guard：逐一確認每個 admin 讀取函式本身都先呼叫 `requireAdmin()`（老師、需求、課程、團體、總覽、名稱查找、計數），不只靠頁面擋；能在測試中直接呼叫者，補「沒有登入呼叫會被拒絕」的測試，無法直接呼叫者以 code review 紀錄列出檔案與行數。
- 報名個資邊界：確認 `memberName`／`memberEmail` 只出現在 admin 專用型別與頁面；公開、團主、老師、學員的名單／課程讀取型別與 helper 沒有被改動或引用 admin 型別；結果提示與定位參數不含 email。
- 老師／需求草稿不因搜尋、關聯限定、計數或詳情連結出現。
- 狀態轉換、開始時間邊界（已開始的課不能取消課程或報名）、名額（pending＋confirmed 佔位）、同學員不可重報、通知行為不變。
- App-ready：沒有新增 route 以外的 API，business logic 仍在 service 層。

## D. Checks

- `npx tsc --noEmit`、`npm run lint`、`npm run build`、`git diff --check`。
- build 後在 PowerShell 執行（3100 被占用改 3200）：
  `$env:PORT='3100'; npx playwright test admin- role-switch signed-in-navigation teacher-profile-suspension enrollment notification class-session-cancellation organizer-direct-class`
  （含 desktop＋mobile 兩個 project）。`teacher-profile-suspension` 涵蓋非法暫停／恢復、重複操作、原因清除與通知。
- 高負載下已知會逾時的長流程（記錄於票 08、12、13）若失敗，單獨重跑並如實記錄，不寫成通過。
- Codex peer review 本票與 journey 測試。

## 規格第 11 節對照

| 規格驗收項 | 本票對應 |
| --- | --- |
| 1280／390 完成審核、查找、關聯導覽、課程與報名取消 | A1–A5（雙尺寸截圖） |
| 總覽一次點擊到待審詳情；有關聯時一次點擊到資料或限定列表 | A1、A2、A4、A5、A6 |
| 搜尋、狀態、關聯可組合；計數正確；無結果可清除；返回與重新整理不遺失 | A5、A6、A8、B（多篩選、零結果）、既有 `admin-related-lists`／`admin-dashboard-kpi` |
| 恢復／暫停／退回後移出分類仍可追查 | A1–A3、B（移出分類） |
| 報名取消留在名單保留條件；課程取消回原列表 | A5、既有 `admin-roster` |
| 失敗保留原因；送出中防重複；確認視窗鍵盤／手機可用、焦點與返回 | A1、A7、B（人工檢查） |
| 無橫向溢出、不遮擋操作、同名對象可辨識 | B（固定 viewport 視覺條件）、A5 同名團體、B1 同名老師 |
| 非 admin 頁面／讀取／action 被擋；草稿不出現；狀態、開始時間、名額、不可重報不變 | C、D（含 `teacher-profile-suspension`、`enrollment*`、`class-session-cancellation`） |
## E. 交付給產品主人

- 驗收畫面集：每條路徑的 desktop／mobile 截圖依步驟排好，附一句說明這一步要看什麼。建議發布成一個手機可翻閱的私人 Artifact 頁面（手機版長截圖無法直接傳到手機），但發布需產品主人另外同意，清單確認與畫面驗收都不自動授權發布；未同意時只放在 `.ai-runs/admin-usability/` 由桌面 App 查看。
- 回報：checks 結果、未驗證項、發現的問題與處理方式。產品主人看過畫面後才記錄第四批驗收。

## 執行紀錄（2026-10-06）

- **A 整條路徑（Claude 初次執行）**：新增 `tests/smoke/admin-journey.spec.ts`（A1–A8），desktop＋mobile 16/16 通過。每一步截圖到 `.ai-runs/admin-usability/batch4/<project>/`（當時共 70 張）。當時以 `innerWidth` 檢查溢出，漏掉手機結果提示的 677px 頁寬，因此不能以該次通過宣稱沒有溢出；本次固定 viewport 回歸與截圖見下方修正紀錄。A7 驗證通過、退回（老師）、公開、退回（需求）、暫停、恢復六種操作的處理中／互斥停用／只送 1 次；A8 驗證五處列表／名單重新整理保留條件。
- **發現並修正（阻擋項）**：手機上沒有空白的長名稱會跑出共用列表卡片 `AdminListCard`（老師、需求、課程列表），標題與補充行改用 `wrap-anywhere`。新的文字溢出檢查在修正前的版本上會失敗、修正後通過。
- **查證後判定不是問題**：第一次截圖時，手機版操作後回到列表的畫面看起來停在下方、看不到結果提示。三次量測（含從總覽點進去、可捲動的長列表）都是 `scrollY` 為 0、提示距頂端 250px；原因是 Chromium 手機模擬的可視範圍截圖沿用換頁前的捲動位置。曾加入的自動捲動修正已撤回，改為沒有指定焦點的步驟截整頁；journey 測試保留「結果提示在畫面內」的斷言。
- **C 權限與個資**：讀取層 guard 以 code review 逐一確認（這些函式會載入登入 session 模組，無法在測試中直接呼叫）：`class-session/admin-service.ts`（countClassSessionsForTeacherForAdmin、listAllClassSessionsForAdmin、getClassSessionDetailForAdmin、cancelClassSessionForAdmin）、`demand-request/admin-service.ts`（listSubmittedDemandRequestsForAdmin、listDemandRequestsForAdmin、getDemandRequestForAdmin、publishSubmittedDemandRequest、rejectSubmittedDemandRequest）、`organizer-profile/admin-service.ts`（getOrganizationNameForAdmin、listOrganizationsForAdmin）、`enrollment/admin-service.ts`（cancelEnrollmentForAdmin）、`admin/dashboard-service.ts`（getAdminDashboardKpis、listAdminPendingItems）、`teacher-profile/service.ts`（四個 admin 列表／詳情／名稱讀取與通過、退回、暫停、恢復），每個函式本身都先呼叫 `requireAdmin()`。`memberName`／`memberEmail`／`AdminClassSessionRosterEntry` 只出現在 `class-session/admin-service.ts` 與 admin 課程詳情頁；老師端課程頁的同名區域變數是原本的老師名單，沒有引用 admin 型別。非 admin 404、草稿不可見與規則邊界由既有與新增測試涵蓋。
- **D Checks**：tsc、lint、build、`git diff --check` 通過。完整回歸指令 300 項中 298 項首輪通過；2 項是 `teacher-profile-suspension` 的 UI 測試還在找第二批票 07 之前的暫停提示「這位老師已經暫停。」（現為「這位老師已經暫停，暫停原因會顯示給老師。」），屬既有測試未跟上，產品沒壞；更新斷言後該檔 20/20 通過。
- **E 交付**：驗收畫面集發布為私人 Artifact（產品主人 2026-10-06 同意）：https://claude.ai/artifact/7pRdCmwoEL9sTqtar5W7jf 。產品主人看過畫面後才記錄第四批驗收。
- **Review 與未驗證項**：Codex 初次 review 為 REQUEST CHANGES（結果提示溢出／同名老師列表不可辨識），產品主人授權修正；2026-10-07 獨立 Reviewer 已複查並 APPROVE，報告見 `.ai-runs/admin14-review-fixes/independent-review.md`。Playwright 以外的人工鍵盤／實機觸控操作未另外實測；原私人 Artifact 不會自動更新或重新發布，不能視為修正後畫面已驗收。末尾 marker 僅記錄原檢查清單的 peer review，本次 approval 以獨立報告為準。
## Codex review 修正清單（2026-10-06）

產品主人回覆「1」，授權在目前 task／Claude worktree 修正兩項 findings；不授權 commit／push。沿用原票與 spec，不改 Auth／schema／permissions／state machine。

- [x] 補固定 viewport 寬度的溢出檢查與同名老師辨識測試，先確認現行 UI 會失敗。四項中 1 通過、3 預期失敗：手機結果提示頁寬 677px，同名老師 desktop／mobile 皆找不到卡片 email；見 `.ai-runs/admin14-review-fixes/red.log`。
- [x] 修正 `AdminFlash` 長名稱換行；老師列表沿用既有 admin-only DTO 的 email 辨識對象。
- [x] 執行 typecheck／lint／build／diff check 與受影響雙尺寸 smoke，親看修正截圖。`npx playwright test admin- teacher-profile-suspension` 在 build 後以 PORT=3200 執行，164/164 首輪通過（journey A1–A8＋B1 共 18 項）；logs 在 `.ai-runs/admin14-review-fixes/`。
- [x] 更新驗證紀錄、self review／scope drift；完整修正 patch 與正式 Builder packet 在 `.ai-runs/admin14-review-fixes/`，用於獨立 Reviewer 複查。
- [x] 獨立 Reviewer 只讀複查六檔 patch、反證、164 項回歸 log 與八張截圖：APPROVE，無 blocking findings；報告見 `.ai-runs/admin14-review-fixes/independent-review.md`。
- [x] 產品主人確認修正畫面：2026-10-07 回覆「修正畫面接受」；不自動 commit／push 或重新發布 Artifact。

### 修正驗證與 self review（2026-10-07）

- 修正範圍：`AdminFlash.tsx`、`admin/teachers/page.tsx`、`admin-journey.spec.ts`，以及本票、票券 README 與四批計畫，共六檔。Claude 原本的 `AdminListCard` 與暫停測試變更保留，不歸為本次新增修正。
- 溢出斷言在 UI 修正前量到手機頁寬 677px；修正後固定 390px 檢查通過，Pixel 5 的 2.75 倍率截圖寬度由 1862px 回到正常 rounding 的 1073px。長名稱完整換行、不截斷。
- 新增 B1 驗證同名老師的兩張卡片各自顯示 email，點進正確 id 的詳情。親看 desktop／mobile 結果提示、同名老師列表與詳情的八張重點截圖，保存在 `.ai-runs/admin14-review-fixes/screenshots/`；整條 journey 共 76 張。
- typecheck、lint、build、diff check 通過。初次啟動部分 checks 遇到沙箱 EPERM，重新在允許的環境執行後通過；`red.log` 的 3 項預期失敗是 UI 修正前的反證，不隱藏或歸為產品修正後失敗。完整 300 項回歸本次未重跑，原 Claude 結果仍是歷史紀錄。
- V1／domain／security：未加入 Wellness／Academy／Retreat、AI matching、支付退款或 native app；Auth、schema、角色／permissions、state machine、data model、route map 與取消／通知核心不變。email 原已在 admin-only DTO，僅於既有 guarded 頁面顯示；不加入結果 URL 或公開／其他角色 DTO。
- 品牌與 RWD：沿用色票、字型與膠囊按鈕；本次 1280px desktop／390px mobile 驗證通過。無新增產品政策決策。產品主人已接受本次修正畫面；人工鍵盤／實機觸控仍未另外實測，原 Artifact 未更新，不把畫面接受回填為這些項目已驗證。
- Scope drift：只改上述六檔與 ignored 證據；未修改其他 task／`.claude/settings.local.json`，未 commit／push／部署。
- 獨立 review 完成後只補上述三份 docs 的事實狀態；source／test 與受審版本 SHA256 相同。受審快照為 `review-fixes-reviewed.patch`／`reviewed-file-manifest.json`，最新六檔 patch 與 manifest 另保存在同一證據目錄。

### 修正畫面 Human Decision Record（2026-10-07）

- 決策：產品主人在本 task 明確回覆「修正畫面接受」。
- 材料：`.ai-runs/admin14-review-fixes/screenshots/` 八張 1280px desktop／390px mobile 截圖，涵蓋結果提示長名稱換行、同名老師列表 email 辨識，以及 alpha／beta 各自詳情；164/164 回歸與獨立 Reviewer APPROVE 已交代。
- 邊界：完成修正畫面 Human Gate；人工鍵盤／實機觸控仍未另測，原 Artifact 未更新。此次接受不授權 commit／push／部署／發布或其他票施工。
- 本輪 self review：只同步本票、README、計畫與 ignored 證據狀態；V1 scope、Auth、schema、角色／permissions、state machines、data model、route map 與 source／test 不變，未新增禁止模組、未修改無關檔案，無新增 security／RWD／品牌風險或產品政策決策。

### Commit／push 授權紀錄（2026-10-07）

- 產品主人另回覆「commit+push」，明確放行本票 Git commit 與 push；不依畫面接受推定 Git 授權。
- 提交範圍：本票、README、計畫、`AdminFlash.tsx`、`AdminListCard.tsx`、`admin/teachers/page.tsx`、`admin-journey.spec.ts`、`teacher-profile-suspension.spec.ts`，共八檔，包含 Claude 初始成果及 Codex 核准修正。
- 目標：既有 `claude/nice-fermat-7b1fb3` 分支推送到同名 origin 分支；不合併 main，不包含 `.claude/settings.local.json`、ignored 截圖／logs 或其他 task。
- 工程依據：已通過 checks、164/164 回歸、獨立 review 與產品主人畫面確認；source／test 未再修改，僅補授權紀錄並核對 staged diff。
- 此授權不包含部署、重新發布 Artifact 或其他票施工；Git 執行結果另存於 `.ai-runs/admin14-review-fixes/` 並向產品主人回報。

## 已知待辦（不在本票修，只記錄）

- 老師端檔案 `src/domain/class-session/__internal__/open-all-draft-occurrences-core.ts` 結尾多一個空行（其他 task 的檔案）。
- 已知高負載下偶爾逾時或資料庫連線錯誤的測試清單（見票 08、12、13）。

## 不做

不新增功能、不改 Auth／schema／permissions／state machine／取消與報名核心、不做 backlog 17。不得 commit／push，除非產品主人另外要求。

<!-- codex-peer-reviewed: 2026-10-05T22:29:10Z rounds=2 verdict=approved -->
