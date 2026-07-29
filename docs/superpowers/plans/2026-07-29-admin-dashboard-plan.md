# Admin Dashboard — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D11）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

`docs/product/admin-mvp-spec.md` 從一開始就把 `/admin/dashboard`（顯示待審事項與 basic KPIs）列為 Admin 核心頁面，`docs/product/route-map.md` 也早就預先規劃了這個路由——但 `src/app/admin/` 底下只有 `teachers/`／`demands/`／`classes/` 三個各自獨立的管理頁，沒有任何一個頁面把它們串起來。Admin 現在要知道「有多少待審事項」，得分別造訪三個頁面自己數。

### 1.2 這輪跟既有 scope 文件的關係

`docs/scope/v1-scope.md` 的 Admin Must Have 清單包含「View basic KPIs」。`docs/product/admin-mvp-spec.md` 的「Basic KPIs」清單列了 7 個數字（見 2.1），本輪一次做齊，不分批。

### 1.3 風險等級

低。純粹新增一個唯讀聚合查詢 + 一個新頁面，不修改任何既有的寫入邏輯或狀態轉換，也不需要 schema 變更。

## 2. 現況核對（Repo Reality Audit；working tree = committed `main` @ `5f978cc`）

### 2.1 已 committed 的基礎（可直接依賴／不可直接依賴）

`docs/product/admin-mvp-spec.md` 的 Basic KPIs 清單 7 個數字，逐一核對現況：

| KPI | 現況 |
|---|---|
| teacher applications pending count | 沒有直接可用的 count 查詢；既有 `listSubmittedTeacherProfileApplicationsForAdmin()`（`src/domain/teacher-profile/service.ts`）雖然是同一個 `status="submitted"` 篩選條件，但**不應該重用**，見下方修正說明 |
| approved teachers count | 同上，`listApprovedAndSuspendedTeacherProfilesForAdmin()`（同檔案）回傳 approved **與** suspended 混合，也不應該重用 |
| demand requests pending review count | 同上，`listSubmittedDemandRequestsForAdmin()`（`src/domain/demand-request/admin-service.ts`）也不應該重用 |
| published demand requests count | `DemandRequest.status = "published"` 是已落地、真的會被寫入的狀態（`state-transition-details.md` 確認 `submitted → published` 由 Admin 觸發） |
| matched demand requests count | `DemandRequest.status = "matched"` 是已落地、真的會被寫入的狀態（`published → matched`，見 `demand-response-and-matching-spec.md`）——**注意**：`teacher_responded` 這個 enum 值保留但**從未被 persist**（`state-transition-details.md` 明確記載 V1 用動態推導判斷「有沒有 response」，不落地這個狀態值），任何 KPI 如果誤算 `teacher_responded` 會恆為 0，本輪不使用這個狀態值 |
| upcoming class sessions count | 定義見 D3 |
| confirmed enrollments count | 平台總數，不分課程 |

- **修正（codex round 1 指出的問題，已採納）：7 個數字全部改用獨立的 Prisma `count()` 查詢，不重用任何既有的 `list*ForAdmin()` 函式。** 原始草稿規劃前三個數字直接拿既有 list 函式的 `.length`，但那些函式的 `select` 是為了「列表頁需要顯示的完整欄位」設計的（teacher applications 含 bio／teaching style／specialties 等長欄位，demand requests 含 organization 聯絡資訊等），只是要一個數字卻把整批完整記錄從資料庫撈出來、序列化、傳回，資料量成長後這個 dashboard 會不成比例地變慢，而且撈出使用者不需要看到的個資（dashboard 只顯示數字）沒有必要。除此之外，每重用一個 list 函式就等於多執行一次那個函式自己的 `requireAdmin()`，7 個數字裡有 3 個會變成「重複做 3 次 admin 身份驗證查詢」。修正後，`getAdminDashboardKpis()` 只在函式最開頭呼叫一次 `requireAdmin()`，其餘 7 個全部是形如 `prisma.teacherProfile.count({ where: { status: "submitted" } })` 的獨立輕量查詢，用 `Promise.all` 平行送出（D4）。
- **既有的 Admin-scoped 唯讀查詢慣例**：`listAllClassSessionsForAdmin`／`getClassSessionDetailForAdmin`（`class-session/admin-service.ts`）、`listSubmittedDemandRequestsForAdmin`（`demand-request/admin-service.ts`）、`listSubmittedTeacherProfileApplicationsForAdmin`／`listApprovedAndSuspendedTeacherProfilesForAdmin`（`teacher-profile/service.ts`）都是「函式第一行 `await requireAdmin()`，不做 `__internal__` 拆分」的既有形狀——這些函式本身沒有通知或鎖的需求，`requireAdmin()` 擋在最外層，驗證方式一律是瀏覽器／Playwright 帶 Admin session cookie，不是 throwaway script 直接呼叫（`__internal__` 拆分只在需要注入 `notifyOverride` 或需要鎖的情境才成立，見 `admin-class-enrollment-management` D5 的既有先例）。本輪新增的聚合查詢函式的「`requireAdmin()` 擋最外層、不拆 `__internal__`」這個既有形狀不變，只是內部改成直接查 `count`，不呼叫其他 domain 的既有函式。
- **沒有既有的跨 domain 聚合／dashboard service**：`src/domain/` 底下沒有 `admin/` 目錄，也沒有任何檔案做過跨 domain 的聚合查詢（已用 `grep` 核對過 dashboard／kpi／aggregate 三個關鍵字，皆無命中）。
- **`docs/domain/permissions-matrix.md` 完全沒有提到 dashboard**（已用 `grep` 核對，零命中）——這個頁面不引入任何新的動作／權限邊界（純唯讀聚合既有已公開的計數，`requireAdmin()` 把關的方式跟其餘 `/admin/*` 路由完全一致），見 D7。

### 2.2 上游依賴狀態

- 依賴 `admin-class-enrollment-management`（已落地，`/admin/classes` 提供 class session 資料）、`organizer-demand-request-foundation`（已落地，`/admin/demands` 提供 demand request 資料）、`teacher-profile-suspension`（已落地，`/admin/teachers` 提供 teacher profile 資料）。不依賴任何其他進行中輪次。
- 跟目前另一個 session 正在進行中、尚未 commit 的 `docs/superpowers/plans/2026-07-28-role-dashboards-plan.md`（`src/app/member/page.tsx`／`src/app/organizer/page.tsx`）沒有交集——本輪只碰 `src/app/admin/dashboard/`，不碰 `src/app/member/`／`src/app/organizer/`。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做任何互動式圖表／時間序列趨勢（例如「過去 7 天新增需求數」），`admin-mvp-spec.md` 的 V1 不做清單明確排除 Advanced analytics dashboard。
- 不做可自訂的日期範圍篩選——所有數字都是「目前」的即時計數，不是某個時間區間的統計。
- 不新增任何寫入動作或狀態轉換——這個頁面純唯讀。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `src/domain/admin/dashboard-service.ts`（新檔案，新 domain 目錄——這是跨 teacher-profile／demand-request／class-session／enrollment 四個既有 domain 的聚合查詢，不天然屬於任何一個既有 domain，見 D7）：`getAdminDashboardKpis()`，`requireAdmin()` 把關一次，`Promise.all` 平行送出 7 個獨立 Prisma `count` 查詢（見 D1 修正版）。
- `src/app/admin/dashboard/page.tsx`：顯示「待審事項」（teacher applications pending／demand requests pending review 兩個數字，各自連到 `/admin/teachers`／`/admin/demands`，見 D2）與「Basic KPIs」（其餘 5 個數字，純顯示不連結）；頁首加上共用 admin 導覽列（見 D10）。
- `src/app/admin/teachers/page.tsx`／`src/app/admin/demands/page.tsx`／`src/app/admin/classes/page.tsx`：三個既有頁面的 `<header>` 各自加上同一組共用 admin 導覽列（只加連結，不改動既有內容或邏輯，見 D10）。
- Playwright smoke 測試（見 Slice 2）。
- 文件對齊（見 D11）：`docs/product/admin-mvp-spec.md`、`docs/product/route-map.md`。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- `getAdminDashboardKpis()` 第一行 `await requireAdmin()`，比照既有 `listAllClassSessionsForAdmin` 等唯讀查詢的既有形狀，不做擁有權檢查（這個頁面本來就是要看到平台全貌）。
- `/admin/dashboard` 頁面比照既有 `admin/demands`／`admin/teachers`／`admin/classes` 的既有寫法：`requireAdmin()` 失敗時 `notFound()`，不是 `redirect("/sign-in")`。
- 這個頁面只顯示計數（數字），不顯示任何個別使用者的姓名/email/聯絡資訊等私人資料，沒有新的資料揭露疑慮。

## 5. 產品主人決策 Gate（D1–D11）

### D1 — 7 個計數的精確定義

- **推薦**（修正版，codex round 1 指出前三個不該重用既有 list 函式後，7 個全部統一改成獨立 `count` 查詢）：
  - `teacher applications pending count`：`prisma.teacherProfile.count({ where: { status: "submitted" } })`。
  - `approved teachers count`：`prisma.teacherProfile.count({ where: { status: "approved" } })`。
  - `demand requests pending review count`：`prisma.demandRequest.count({ where: { status: "submitted" } })`。
  - `published demand requests count`：`prisma.demandRequest.count({ where: { status: "published" } })`。
  - `matched demand requests count`：`prisma.demandRequest.count({ where: { status: "matched" } })`——**只算 `matched`，不含 `converted_to_class`**。`converted_to_class` 代表已經進到下一步（已經建立 `ClassSession`），語意上不再是「等待轉換的 matched 需求」，混進去會讓這個數字失去「還有多少需求卡在 matched 階段」的訊號價值。
  - `upcoming class sessions count`：`prisma.classSession.count({ where: { status: "open_for_enrollment", startAt: { gt: now } } })`——**不是單純數 `open_for_enrollment` 狀態的總數**。一堂 `open_for_enrollment` 但 `startAt` 已經過去的課程（尚未被 Organizer 標記完成）已經不是「即將到來」，混進去會讓「upcoming」這個字失真。這跟既有 `completeOwnClassSession`／`admin-class-enrollment-management` 判斷「是否已開始」的既有邏輯（`startAt.getTime() <= Date.now()`）同一個精神。
  - `confirmed enrollments count`：`prisma.enrollment.count({ where: { status: "confirmed" } })`——平台總數，不分課程。

### D2 — 「待審事項」跟「Basic KPIs」的呈現方式：只有兩項有連結

- **推薦：7 個數字裡，只有 `teacher applications pending count` 與 `demand requests pending review count` 這兩個放進「待審事項」區塊，各自連到 `/admin/teachers`／`/admin/demands`；其餘 5 個放進「Basic KPIs」區塊，純顯示數字，不加連結。** 理由：「待審事項」的語意是「需要 Admin 採取動作的佇列」——這兩個數字正好對應 `/admin/teachers`／`/admin/demands` 兩個既有的審核佇列頁面（只顯示 `submitted` 狀態），點進去就是同一批項目，連結有明確、唯一的目標頁。其餘 5 個數字（approved teachers／published demands／matched demands／upcoming class sessions／confirmed enrollments）不對應任何「需要動作」的佇列——`/admin/classes` 目前是依狀態分組顯示**所有**課程，不是「只顯示 upcoming」的篩選頁，勉強連過去語意不精確；`/admin/demands` 也不提供依 `published`/`matched` 篩選的視圖。與其做出連結卻連到語意不吻合的頁面，不如維持純數字顯示，之後真的有需要再各自新增對應的篩選視圖。

### D3 — 「upcoming」的定義是否要排除 capacity 已滿的課程？

- **推薦：不排除。** `upcoming class sessions count` 只反映「還沒開始的、狀態是 open_for_enrollment 的課程數量」，不管名額滿不滿——這是 admin-mvp-spec.md 原始描述裡沒有提到的額外篩選條件，屬於過度延伸，V1 不做。

### D4 — 併發／效能：7 個查詢是否需要合併成一次查詢？

- **推薦：不需要，`Promise.all` 平行送出 7 個獨立查詢即可。** 這個系統目前所有清單頁都是無分頁的 `findMany`（`admin-class-enrollment-management` D6 已確認接受這個 V1 限制），7 個 `count`/`.length` 查詢的成本遠低於任何一個既有清單頁的 `findMany`，沒有理由為了這個頁面特別優化成單一複合查詢，那會犧牲可讀性換取目前用不到的效能。

### D5 — 這個聚合函式要不要做成 `__internal__` pure-core，方便 throwaway script 直接測試？

- **修正（codex round 2 指出的問題，已採納）：需要，理由跟 round 1 的判斷相反。** 原始推薦援引「這個專案的 `__internal__` 拆分只在鎖或通知注入這兩種情況成立」——但這個判斷本身就不完整：這個 session 稍早在 `admin-class-enrollment-management` 一輪（`cancelEnrollmentForAdminCore`）已經確立過**第三種獨立成立的理由：可測試性**——當一個函式因為呼叫 `requireAdmin()`/`requireUser()` 而無法在 Node context 直接呼叫時，若又需要對它的邏輯做決定性驗證（不能只靠 Playwright），就值得拆出一個不含權限檢查的 pure-core。這裡正好是這個情境：`getAdminDashboardKpis()` 的兩個邊界判斷（`matched` 不含 `converted_to_class`、`upcoming` 不含已過 `startAt` 的 `open_for_enrollment`）如果只能透過 Playwright 驗證，會撞上 round 2 指出的併發污染問題（見 D9 修正版）——這 7 個計數是**平台全域總數**，`npm run test:smoke` 用 `chromium-desktop`／`chromium-mobile` 兩個 project 平行執行（`playwright.config.ts` 沒有設定 `workers: 1` 或任何序列化），極可能同一個測試在兩個 project 上同時執行，兩邊各自在對方的 baseline 到 after 讀值區間內新增了會被算進同一個全域計數的資料，導致觀察到的差值變成 `2N` 而不是 `N`——差值手法只能消除「執行前既存的資料」，消除不了「執行區間內其他 worker 平行寫入」這個更根本的問題，而這個系統目前完全沒有 per-worker 資料庫隔離的既有基礎設施（這正是本 repo 目前 `organizer-dashboard.spec.ts`——另一個 session 進行中、尚未 commit 的工作——長期呈現 flaky 失敗的同一種根因，可以直接參考成為這個風險不是假設性的證據）。
  - **推薦：新增 `src/domain/admin/__internal__/dashboard-kpis-core.ts`，匯出 `getAdminDashboardKpisCore(client: Prisma.TransactionClient | PrismaClient = prisma)`（7 個 `count` 查詢本體，不呼叫 `requireAdmin()`）。`src/domain/admin/dashboard-service.ts` 的 `getAdminDashboardKpis()` 縮減成 `await requireAdmin()` 之後委派給這個 core（不傳 `client` 參數，用預設值，行為不變），比照 `admin-class-enrollment-management` 已經驗證過的同一個模式。**
  - **修正（codex round 4 指出的問題，已採納）：`client` 這個可選參數不是為了production 行為，是專門為了讓 Slice 2 的正式回歸測試能在 `REPEATABLE READ` transaction 裡呼叫「真正的」`getAdminDashboardKpisCore()`，而不是在測試裡重寫一份篩選邏輯**（見 D9 最終版第 4 點的完整說明）——codex 指出 round 3 版本的 `id: { in: [...] }` 手法雖然不受併發污染，但它是測試自己手刻的 `where` 條件，不是呼叫真正的 production 函式，如果 `getAdminDashboardKpisCore()` 本身的篩選邏輯被改壞（例如不小心把 `converted_to_class` 也算進 `matched`），這個測試仍然會通過、偵測不到——這是真正的回歸保護缺口，不是可以忽略的次要問題。
  - Slice 1 的 throwaway script **直接呼叫 `getAdminDashboardKpisCore()`**（單一 process、單一時間點執行）做一次性的粗略 sanity check（7 個數字都能正確跑出結果、型別正確），主要目的是在寫完 Slice 1 當下快速確認函式沒有寫錯，不是這個功能唯一的正式回歸保護。
  - **修正（codex round 3 指出的問題，已採納）：兩個邊界案例的正式、永久回歸測試最終定案為「寫在 `npm run test:smoke` 裡、用 `id: { in: [...] }` 範圍限定查詢」（見 D9 最終版），不是 Slice 1 throwaway script 跑完即刪——round 2 那版把精確驗證放在 throwaway script 雖然當下不會 flaky，但腳本執行完就跟著測試資料一起被刪除，日後這段邏輯被改壞時，正式測試套件完全偵測不到，等於沒有真正的回歸保護，這是 round 3 指出的新問題，理由與最終解法見 D9。

### D6 — 空狀態（V1 資料量還很少時）要不要特別處理？

- **推薦：不需要，數字就是 0，不做「尚無資料」這種特殊文案。** 這是純粹的計數顯示，`0` 本身就是完整、正確的資訊，不像列表頁「目前沒有資料」需要引導文案，加上額外的空狀態判斷只會讓元件複雜化，沒有對應的使用者價值。

### D7 — 為什麼這個函式放在新的 `src/domain/admin/` 目錄，不是塞進既有某個 domain？

- **推薦：新增 `src/domain/admin/dashboard-service.ts`。** 這個函式同時查詢 `TeacherProfile`／`DemandRequest`／`ClassSession`／`Enrollment` 四個既有 domain 的資料，天然不屬於其中任何一個——放進其中一個既有 domain 的 `admin-service.ts`（例如 `class-session/admin-service.ts`）會讓那個檔案意外依賴其他三個 domain 的 model，模糊了既有「一個 domain 目錄對應一個業務概念」的既有慣例。獨立一個 `admin/` domain 目錄，語意上代表「橫跨多個既有 domain 的 Admin 專用聚合」，之後如果有其他跨 domain 的 Admin 專用查詢（例如未來的 Admin note 統計），也有明確的家可以放。

### D9 — 修正（codex round 1／2／3 逐輪指出，本版為最終修正）：全域計數的正式回歸測試設計

這 7 個計數都是**平台全域總數**，`npm run test:smoke` 用 `chromium-desktop`／`chromium-mobile` 兩個 project 平行跑（`playwright.config.ts` 沒有 `workers: 1` 或任何序列化），同一個資料庫裡同時還有其他 spec 檔案在對 `TeacherProfile`／`DemandRequest`／`ClassSession`／`Enrollment` 做新增、刪除、狀態轉換。這是本 repo 目前 `organizer-dashboard.spec.ts`（另一個 session 進行中、尚未 commit 的工作）長期 flaky 失敗的同一種根因，不是假設性風險。這一項在三輪 review 裡被逐步修正，記錄如下，避免下一個讀者重蹈同樣的錯誤推理：

- **round 1 的錯誤**：規劃用「執行前後差值」驗證絕對計數，沒有意識到差值本身也會被同一個時間窗口內其他 worker 的新增操作污染（尤其 desktop/mobile 同時跑同一個測試名稱）。
- **round 2 的錯誤**：改成「只做 `after >= before + 1` 的單調斷言，理由是干擾只會讓數字變大」——**這個推理本身是錯的**。codex round 3 指出：既有 smoke specs 的 `afterAll` 會 `deleteMany`，且部分測試會把 `submitted` 轉成 `approved`/`rejected` 等其他狀態，這些操作會讓同一個全域計數在 baseline 到 after 之間**變小**，不是只會變大；`>=` 假設「干擾只會加分」不成立，一樣可能誤判失敗。
- **round 2 另一個被指出的問題**：即使前面的驗證手法本身沒問題，兩個邊界案例（`matched` 不含 `converted_to_class`、`upcoming` 不含已過 `startAt`）如果只在 Slice 1 的 throwaway script 驗證過一次就把腳本刪掉，之後這段邏輯如果被改壞，`npm run test:smoke`（唯一會被持續重跑的正式測試）完全偵測不到，等於這兩個邊界條件沒有真正的回歸保護。

**最終推薦（三輪修正後的設計）**：

1. **兩個邊界案例改成永久、committed 的正式測試**（不再是跑完即刪的 throwaway script），寫在 `tests/smoke/admin-dashboard.spec.ts` 裡，跟其餘測試一起被 `npm run test:smoke` 持續重跑，解決 round 2 指出的「沒有永久回歸保護」問題。
2. **修正（codex round 4 指出的問題，已採納）：驗證手法改成「在 `REPEATABLE READ` transaction 內，直接呼叫真正的 `getAdminDashboardKpisCore(tx)` 做前後差值比對」，不是在測試裡重寫一份篩選邏輯。** round 3 版本規劃用 `id: { in: [...] }` 限定範圍的獨立 count 查詢——這個手法雖然不受併發污染，但 codex round 4 指出一個更根本的問題：那是測試自己手刻的 `where` 條件，沒有真的呼叫 `getAdminDashboardKpisCore()`，如果這個函式的篩選邏輯本身被改壞（例如不小心把 `converted_to_class` 也算進 `matched`、或移除 `upcoming` 的 `startAt` 篩選），這個測試仍然會通過——完全偵測不到正式函式的回歸，等於沒有真正保護到需要保護的程式碼。
   - **推薦（最終版）**：`getAdminDashboardKpisCore()` 改成接受一個可選的 `client` 參數（D5 修正版），Slice 2 的正式測試用 `prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })` 包住整個「讀 baseline、建立 fixture、讀 after」流程，**baseline 與 after 兩次都直接呼叫 `getAdminDashboardKpisCore(tx)`（真正的 production 函式）**，fixture 也用同一個 `tx` 建立。PostgreSQL 的 `REPEATABLE READ` 隔離等級保證：這個 transaction 一旦開始就鎖定一個一致的資料快照，看不到任何**其他** transaction 在這之後才 commit 的變更（不管是其他 worker 新增、刪除還是狀態轉換），但看得到**自己**在同一個 transaction 內寫入的資料——這代表 baseline 讀到的是「這個 transaction 開始那一刻」的快照，after 讀到的是「同一個快照 + 自己剛剛建立的 fixture」，兩者的差值精確等於這個測試自己建立的筆數，跟資料庫裡同時有多少其他 worker 在做什麼完全無關。這是唯一能同時滿足「呼叫真正的 production 函式」與「不受併發污染」兩個要求的做法，不需要新增任何 per-worker 資料庫隔離基礎設施——`REPEATABLE READ` 是 PostgreSQL 內建的標準隔離等級，Prisma 的互動式 transaction（`$transaction(fn, { isolationLevel })`）原生支援指定它。
   - 兩個邊界案例都用這個手法：驗證「`matched` 不含 `converted_to_class`」時，在同一個 `tx` 裡建立 1 筆 `matched` + 1 筆 `converted_to_class` 的 DemandRequest，斷言 `after.matchedDemandRequests - before.matchedDemandRequests === 1`（不是 2）；`upcoming` 排除已過 `startAt` 的案例同理，建立 1 筆 `open_for_enrollment` 且 `startAt` 未來、1 筆 `open_for_enrollment` 但 `startAt` 已過，斷言差值剛好是 1。
3. **UI 端到端接線驗證（證明頁面真的把資料庫的值顯示出來）改成「建立 1 筆已知會被算進去的資料後，斷言頁面顯示的數字 `>= 1`，不比較 before/after」**：這個絕對值下限斷言之所以安全，是因為這個專案所有既有 fixture 清理函式（`cleanupOrganizerDemandFixtures`／`cleanupDemandResponseFixtures`／各 spec 檔案自己的 `afterAll`）**清一色只刪除自己建立的資料**（一律用 `email: { in: emails }` 或關聯到這些 email 的資料過濾，已逐一核對過），沒有任何一個既有清理函式會刪除別的測試建立的資料——這代表這個測試自己剛建立的那一筆，在自己的 `afterAll` 執行之前，保證不會被任何其他平行測試刪除或改變狀態，所以「這筆資料存在，計數至少是 1」在任何併發情境下都成立，不需要跟任何 baseline 比較。
4. **具體做法**：`getAdminDashboardKpis()`（有 `requireAdmin()` 把關的 wrapper）第一行呼叫 `requireAdmin()`，依賴真正的 HTTP session，在 Playwright 測試檔案的 Node process 裡直接呼叫會丟出例外（本專案這個 session 已反覆確認過的既有限制）——但兩個邊界案例的正式測試呼叫的是**不含 `requireAdmin()` 的 `getAdminDashboardKpisCore(tx)`**（D5 修正版新增的可選 `client` 參數），可以在測試的 Node process 裡直接呼叫，不需要透過 HTTP。UI 端到端驗證（第 3 點）則因為必須驗證「頁面真的有把資料庫的值顯示出來」這件事本身，一律透過帶 Admin session cookie 的 `page.goto("/admin/dashboard")` 讀取頁面顯示的數字文字，不能繞過頁面直接呼叫函式。

**明確承認的殘餘風險（不是本輪要解決、也解決不了的範圍）**：`getAdminDashboardKpisCore(tx)` 接受可選的 `client` 參數這個小改動，只影響「測試可以傳入一個 transaction client 進來」這件事，不影響 production 呼叫路徑（`dashboard-service.ts` 不傳這個參數，用預設的真正 `prisma`，行為完全不變）。第 4 節「UI 端到端接線驗證」仍然是透過真正的 HTTP 頁面載入，沒有辦法用同一個 transaction 包住（頁面載入是完全獨立的連線／process），所以那部分保留「建立後斷言 `>= 1`」的絕對值下限手法，不是逐字精確驗證——這是刻意的取捨：UI 那一層只需要證明「接線正確」，聚合邏輯本身的精確度已經由第 2 點的 transaction 手法對真正的 production 函式做了決定性驗證，不需要在 UI 層重複做一次同等精確度的驗證。

### D10 — 修正（codex round 1 指出的問題，已採納）：`/admin/*` 四個頁面互相沒有任何連結，需要一個最小共用導覽

- 目前 `/admin/teachers`／`/admin/demands`／`/admin/classes` 三個既有頁面完全獨立，repo 裡沒有任何地方連到它們，也沒有任何 admin 專用的 layout 或導覽元件（已核對 `src/app/admin/` 底下沒有 `layout.tsx`）。本輪如果只讓 `/admin/dashboard` 存在、卻不讓 Admin 有辦法從既有頁面找到它（或反過來，從 dashboard 到既有頁面只有兩個連結、看不到 `/admin/classes`），並沒有真正解決 1.1 描述的「Admin 得分別造訪三個頁面自己數」這個產品問題——本輪的 dashboard 會變成一個只能手動輸入網址才找得到的孤島。
- **推薦：新增一個最小的共用 admin 導覽列**（純文字連結，不是完整的 layout 元件庫），四個頁面（`/admin/dashboard`／`/admin/teachers`／`/admin/demands`／`/admin/classes`）的 `<header>` 都加上同一組「Dashboard・Teachers・Demands・Classes」連結列，比照既有各頁 header 裡「Admin」／「Admin review」這行小字的既有位置與樣式（`text-sm font-medium text-sky-700`），不做成 `layout.tsx`（四個頁面目前分散在不同子目錄、各自的 `page.tsx` 已經有自己的 `requireAdmin()` 把關與 `<main>` 版型，硬做一個共用 `layout.tsx` 需要調整既有三個頁面的既有結構，風險與範圍都超出「加一列連結」這個最小修正）。這代表本輪除了新增的 `dashboard/page.tsx` 之外，還要小幅修改既有的 `admin/teachers/page.tsx`／`admin/demands/page.tsx`／`admin/classes/page.tsx` 三個檔案的 `<header>`（只加連結，不改動其餘既有內容或邏輯）。

### D11 — 文件對齊策略：不修改 `permissions-matrix.md`

- **推薦**：
  1. `docs/product/admin-mvp-spec.md`：`/admin/dashboard` 該列（Admin Pages 表格）與「Basic KPIs」整節補上落地現況說明（比照既有格式），明確記錄 D1 的精確定義（尤其是「matched 不含 converted_to_class」「upcoming 需要 startAt 尚未到達」這兩個容易被誤解的地方）。
  2. `docs/product/route-map.md`：`/admin/dashboard` 該列的說明從「Admin dashboard 與 basic KPIs」補充成「已落地」。
  3. **不修改 `docs/domain/permissions-matrix.md`**：這個頁面沒有引入任何新的動作或權限邊界（純唯讀聚合既有已經在其他地方記錄過可見範圍的計數），`requireAdmin()` 的把關方式跟其餘 `/admin/*` 路由完全一致，且該文件目前完全沒有 dashboard 相關的既有段落可以掛上這個修正，新增一個只有「頁面存在」這種資訊、沒有任何動作/角色矩陣內容的段落沒有實質價值。
  4. **不修改 `docs/scope/v1-scope.md`／`docs/scope/future-expansion.md`**：延續本專案一貫只更新落地現況追蹤文件、不回頭改規劃輸入文件本身的既有慣例。

## 6. 品牌與 UX 規則

- 數字要大、清楚，比照既有 `admin/demands`／`admin/teachers` 頁首那個「目前數量」小卡片的既有版型。
- 待審事項區塊放在頁面最上方（Admin 最需要優先看到的資訊），Basic KPIs 區塊放在下方。

## 7. RWD Requirements

- Admin pages 至少要在 tablet 與 desktop 可用（`docs/product/route-map.md` 既有 RWD 原則），比照既有 `admin/demands`／`admin/teachers`／`admin/classes` 的既有做法，不需要 360px 手機寬度。

## 8. 實作切片（Slice 1–2；施工前提：D1–D11 已拍板）

### Slice 1 — Domain service + UI

- `src/domain/admin/__internal__/dashboard-kpis-core.ts`（新檔案）：`getAdminDashboardKpisCore()`（D5 修正版，7 個 `count` 查詢本體，不呼叫 `requireAdmin()`）。
- `src/domain/admin/dashboard-service.ts`（新檔案）：`getAdminDashboardKpis()`（`requireAdmin()` + 委派給 core，D1/D4/D7）。
- `src/app/admin/dashboard/page.tsx`：待審事項 + Basic KPIs 兩個區塊（D2/D6），頁首共用 admin 導覽列（D10）。
- `src/app/admin/teachers/page.tsx`／`src/app/admin/demands/page.tsx`／`src/app/admin/classes/page.tsx`：`<header>` 加上同一組共用 admin 導覽列（D10）。
- **驗證**：
  1. throwaway script 直接呼叫 `getAdminDashboardKpisCore()` 做一次性粗略 sanity check（7 個數字都能正確跑出結果、型別正確），跑完即刪除腳本與測試資料——這不是正式的回歸保護，精確的邊界驗證定案在 Slice 2（D9 最終版）。
  2. 瀏覽器實際操作：確認 `/admin/dashboard` 頁面正確顯示待審事項與 Basic KPIs 兩個區塊、連結正確；確認四個 admin 頁面之間的共用導覽列都能正確跳轉。

### Slice 2 — Tests + Docs 對齊

- `tests/smoke/admin-dashboard.spec.ts`：
  - 非 Admin 存取 `/admin/dashboard` 回傳 404（比照既有 `admin/demands`／`admin/teachers`／`admin/classes` 的既有 non-admin 測試手法）。
  - **兩個邊界案例的永久回歸測試**（D9 最終版）：在 `prisma.$transaction(async (tx) => {...}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })` 內，前後兩次直接呼叫真正的 `getAdminDashboardKpisCore(tx)`（D5 修正版新增的可選 `client` 參數），中間用同一個 `tx` 建立 fixture，斷言差值精確等於預期值——`REPEATABLE READ` 隔離等級保證這個 transaction 看不到任何其他 transaction 之後才 commit 的變更，差值不受其他平行測試影響，同時真的驗證到 production 函式本身（不是重寫一份篩選邏輯）。`matched` 不含 `converted_to_class`；`upcoming`（`open_for_enrollment` 且 `startAt` 未來）不含已過 `startAt` 的 `open_for_enrollment`。
  - **UI 端到端接線驗證**（D9 最終版）：建立這個測試自己的 1 筆 `submitted` TeacherProfile 之後，`page.goto("/admin/dashboard")` 讀取頁面上顯示的 `teacher applications pending` 數字，斷言 `>= 1`（絕對值下限，不跟 before 比較——理由見 D9：這個專案所有既有 fixture 清理函式都只刪除自己建立的資料，這筆新建立的資料在測試自己的 `afterAll` 執行之前保證不會被任何其他平行測試刪除，因此「至少是 1」在任何併發情境下都成立）。
  - 待審事項連結正確指向 `/admin/teachers`／`/admin/demands`；四個 admin 頁面之間的共用導覽列連結都能正確跳轉（D10）。
  - **RWD 驗證（codex round 1 指出的問題，已採納）**：在 desktop viewport 之外，額外把 viewport resize 成 tablet 寬度（768px），對 `/admin/dashboard` 執行既有 `expectNoHorizontalOverflow` 手法（比照 `tests/smoke/teacher-dashboard.spec.ts` 既有的 `expectNoHorizontalOverflow` helper，量測 `document.body`／`document.documentElement` 的 `scrollWidth` 不超過 `clientWidth`），不能只靠文字/連結斷言就宣稱符合第 7 節的 RWD 要求。
- 更新 `docs/product/admin-mvp-spec.md`（D11 第 1 點）、`docs/product/route-map.md`（D11 第 2 點）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 → Slice 2。

## 9. Verification Planning

- Domain 層粗略 sanity check（Slice 1）：throwaway `tsx` script 直接對本機 Postgres、直接呼叫 `getAdminDashboardKpisCore()`，跑完即刪除腳本與測試資料，不是正式回歸保護。
- UI 層（Slice 1）：瀏覽器手動驅動確認頁面顯示與導覽連結。
- 永久回歸測試（Slice 2，`npm run test:smoke`）：兩個邊界案例在 `REPEATABLE READ` transaction 內直接呼叫真正的 `getAdminDashboardKpisCore(tx)` 做精確差值驗證；UI 端到端接線用「建立後絕對值下限 `>= 1`」驗證；兩者都不受平行測試影響（完整理由見 D9 最終版）。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- 純新增功能，沒有 migration，沒有修改任何既有的寫入邏輯或狀態轉換，`git revert` 對應的 slice commit 即可安全復原，不涉及任何資料狀態的變化（這個頁面本身完全不寫入任何資料）。

<!-- codex-peer-reviewed: 2026-07-29T11:16:51Z rounds=5 verdict=approved -->
