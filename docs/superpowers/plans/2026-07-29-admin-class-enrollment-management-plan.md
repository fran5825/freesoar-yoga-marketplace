# Admin Class Session & Enrollment Management — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D9）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

`docs/product/admin-mvp-spec.md` 從一開始就把「管理 class session 基本狀態」「管理 enrollment 基本狀態」列為 Admin 核心任務，`docs/product/route-map.md` 也預先規劃了 `/admin/classes`／`/admin/enrollments` 兩個路由——但目前 `src/app/admin/` 底下**只有** `demands/` 與 `teachers/` 兩個目錄，`docs/domain/permissions-matrix.md` 的 ClassSession／Enrollment 兩節裡，Admin 欄位全部是「完整未來設計，V1 未開放」。這是「媒合 → 開課 → 完成 → 評價」主線之外，Admin 端唯一還缺的營運能力：目前如果一堂課或一筆報名出了問題（重複建立、資料寫錯、需要緊急處理），Admin 沒有任何管道介入，只能請 Organizer 或 Member 自己處理，或直接操作資料庫。

### 1.2 這輪跟既有 scope 文件的關係

`docs/scope/v1-scope.md` 的 Admin Must Have 清單包含「Manage class sessions」「Manage enrollments」，這不是 Nice to Have，是本來就該做但一直被其他主線工作排在後面的既有承諾。`docs/product/admin-mvp-spec.md` 對 Class Session Actions／Enrollment Actions 的描述比本輪實際落地的範圍更大（例如「協助補齊必要資訊」「變更 status」「記錄取消 reason」）——本輪刻意只做其中的**查看 + 取消**子集，理由見 D1／D3／D4，這是延續本專案一貫的 V1 最小化原則，不是誤讀 spec。

### 1.3 風險等級

低到中。沒有新增任何 schema 變更（D8）。**唯一的中風險點**：為了讓 Admin 版取消課程跟既有 Organizer 版取消課程共用同一段「鎖 ClassSession + 連帶取消 confirmed Enrollment + 通知」交易邏輯，需要重構 `src/domain/class-session/__internal__/cancel-class-session-core.ts`（已出貨、已有完整測試覆蓋的程式碼）。重構方式與回歸驗證策略見 D5。

### 1.4 命名澄清

- 「Admin 取消課程」跟既有「Organizer 取消課程」（`class-session-cancellation` 已落地）是同一個狀態轉換（`draft`／`open_for_enrollment` → `cancelled`），差別只在「誰可以觸發、要不要檢查擁有權」，不是新的 business rule。
- 「Admin 取消報名」跟既有「Member 自助取消報名」（`enrollment` 已落地）是同一個狀態轉換（`confirmed` → `cancelled`），差別同上。

## 2. 現況核對（Repo Reality Audit；working tree = committed `main` @ `e6c88fd`）

### 2.1 已 committed 的基礎（可直接依賴）

- **Organizer 版「取消課程」已經落地且有完整測試**：`cancelOwnClassSession`（`src/domain/class-session/service.ts`）解析 `requireUser()` → `organizerProfileId`，委派給 `cancelClassSessionForOrganizer`（`src/domain/class-session/__internal__/cancel-class-session-core.ts`）。這個 `__internal__` 核心整段包在 `prisma.$transaction` 內：`SELECT ... FOR UPDATE` 鎖住 `ClassSession`（`WHERE "id" = ... AND "organizerProfileId" = ...`）、檢查狀態在 `{draft, open_for_enrollment}` 內且 `startAt` 尚未到達、轉成 `cancelled`、用 `UPDATE ... RETURNING "userId"` 把所有 `confirmed` Enrollment 一併轉成 `cancelled` 並拿到受影響 Member 清單，最後在 tx commit 之後（try/catch 隔離）呼叫 `notifyUsers("class_session_cancelled", ...)`，收件人是 Organizer 自己（`self`）、Teacher（`counterpart`）、受影響 Member（`affected_member`）。這段鎖語意會跟 `createEnrollmentForUser`（`src/domain/enrollment/__internal__/create-enrollment-core.ts`）搶同一個 `ClassSession` 資源。
- **Member 版「取消報名」已經落地**：`cancelOwnEnrollment`（`src/domain/enrollment/service.ts`）是單一 `prisma.enrollment.updateMany({ where: { id, userId, status: "confirmed", classSession: { startAt: { gt: new Date() } } }, data: { status: "cancelled" } })`，成功後通知自己（`enrollment_cancelled`／`self`）。**沒有** `__internal__` 拆分、**沒有**鎖——這是單一使用者對單一列的簡單狀態轉換，不像 `createEnrollmentForUser` 需要跨使用者搶 capacity。
- **既有的 Admin-scoped domain service 既有先例**：`src/domain/demand-request/admin-service.ts`（`listSubmittedDemandRequestsForAdmin`／`publishSubmittedDemandRequest`／`rejectSubmittedDemandRequest`）是本輪要照抄的既有形狀——獨立檔案（不是塞進既有 own-scoped `service.ts`）、每個函式開頭 `await requireAdmin()`、`updateMany` + `count === 0` 時再查一次分類錯誤原因、`isAdminPermissionRequiredError` 統一捕捉 `"Authentication required"`／`"Admin access required"` 兩種 `requireAdmin()` 可能丟出的錯誤訊息。
- **既有的 Admin 頁面既有版型**：`src/app/admin/demands/page.tsx`／`src/app/admin/teachers/page.tsx` 都是 `requireAdmin()` 失敗時 `notFound()`（不是 `redirect("/sign-in")`——Admin 頁面刻意不洩漏「這個路由需要權限」這件事本身，統一回應成不存在）、頁首有一個「目前數量」的小卡片、清單用 `<article>` 卡片 + `<details>` 包住需要二次確認的破壞性動作。`admin/teachers/page.tsx` 額外示範了「一次查詢拿到多種狀態、page.tsx 自己用 `.filter()` 分組顯示」的既有手法（`listApprovedAndSuspendedTeacherProfilesForAdmin` 一次查詢，頁面分成 Approved／Suspended 兩個區塊）——本輪的 `/admin/classes` 列表比照這個手法，不是比照 `admin/demands` 的「只顯示單一狀態的審核佇列」手法，因為 ClassSession 從來不需要 Admin 核准才能推進（不像 DemandRequest），Admin 在這裡的角色是總覽 + 必要時介入，不是必經審核關卡，沒有單一「待處理」子集可以篩選。
- **`docs/domain/state-transition-details.md` 的 Enrollment 段落現在明確寫著「Admin 不介入（D10）：本輪 Enrollment 生命週期完全是 Member 與 Organizer/Teacher（唯讀 roster）的範圍」**——這句話本輪會變成不準確，需要修正（見 D9）。ClassSession 段落的「V1 policy notes」表格（落地子集）目前只有 Organizer 一列會觸發 cancelled，也需要新增 Admin 一列。
- **`docs/domain/permissions-matrix.md` 的 ClassSession／Enrollment 兩節，Admin 欄位目前全部是完整未來設計佔位**：`Cancel class session | No | No | Own | No | Admin`、`Cancel own enrollment | No | Own | Member capability only | Member capability only | Admin`——這兩欄位本來就是為了本輪這種情境預留的，本輪把它們從「未開放」改成「已落地（但範圍窄於完整設計，見 D1/D3/D4）」。

### 2.2 上游依賴狀態

- 依賴 `class-session-cancellation`（已落地）、`enrollment`（已落地）。不依賴任何其他進行中輪次。
- 跟目前另一個 session 正在進行中、尚未 commit 的 `docs/superpowers/plans/2026-07-28-role-dashboards-plan.md`（member/organizer dashboard）沒有交集——本輪只碰 `src/app/admin/`，不碰 `src/app/member/page.tsx`／`src/app/organizer/page.tsx`。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做「協助補齊必要資訊」（Admin 編輯既有 class session 的核心欄位）——`class-session-creation` D2 本來就規定 Organizer 建立後不可編輯，Admin 也不例外，見 D1。
- 不做「變更 status」的完整泛用能力（例如 Admin 手動把 `open_for_enrollment` 標記 `completed`，或把 `draft` 手動開放報名）——只做「取消」這一種狀態轉換，見 D1。
- 不做 `attended`／`no_show`（`enrollment` D10 早已列為 future/admin-only，本輪不擴大範圍）。
- 不做取消原因（`cancellationReason`）欄位或輸入 UI，見 D3。
- 不做獨立的 `/admin/enrollments` 路由或任何跨課程的全站 enrollment 列表，見 D2。
- 不做 `/admin/organizations`、`/admin/dashboard`（KPI 總覽）——這兩個是 admin-mvp-spec 列出的其他 Admin 頁面，不在本輪範圍，需要時另開一輪。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `src/domain/class-session/__internal__/cancel-class-session-core.ts`：重構出一個 private 共用核心（鎖 + 連帶取消 + 通知的交易邏輯），讓既有的 `cancelClassSessionForOrganizer`（signature／行為／錯誤碼完全不變）與新增的、同檔案匯出的 `cancelClassSessionForAdmin` 共用同一段邏輯，差別只在鎖查詢的 `WHERE` 子句要不要帶 `organizerProfileId`（見 D5）。
- `src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core.ts`（新檔案）：`cancelEnrollmentForAdminCore(enrollmentId, notifyOverride?)`，不呼叫 `requireAdmin()`，可注入 `notifyOverride`（D4/D5 修正版）。
- `src/domain/class-session/admin-service.ts`（新檔案，比照 `demand-request/admin-service.ts` 既有形狀）：
  - `listAllClassSessionsForAdmin()`：查看所有 class session（任何狀態、任何 organizer），含 organizer/teacher/organization 顯示名稱與 confirmed enrollment 人數。
  - `getClassSessionDetailForAdmin(classSessionId)`：單一 class session 完整詳情 + 完整 roster（新型別 `AdminClassSessionRosterEntry`，含 `status` 欄位、不過濾狀態，見 D7 修正版），查無資料回傳 `null`。
  - `cancelClassSessionForAdmin(classSessionId)`：`requireAdmin()` + 委派給 `__internal__` 版本（別名匯入，見 D5）。
- `src/domain/enrollment/admin-service.ts`（新檔案，比照 `demand-request/admin-service.ts` 既有形狀）：
  - `cancelEnrollmentForAdmin(enrollmentId)`：`requireAdmin()` + 委派給 `cancelEnrollmentForAdminCore`（D4/D5）。
- `src/domain/notification/copy.ts`：修正 `enrollment_cancelled.self`／`class_session_cancelled.self` 的 `body` 為中性語態（D4.1）。
- `src/app/admin/classes/page.tsx`／`actions.ts`：class session 總覽列表，依狀態分組顯示（比照 `admin/teachers/page.tsx` 既有的分組手法，見 D6），連到 detail 頁。
- `src/app/admin/classes/[classSessionId]/page.tsx`／`actions.ts`：單一 class session 詳情（比照 `organizer/classes/[classSessionId]/page.tsx` 既有版型）、完整 roster（每筆 enrollment 旁邊有 Admin 取消按鈕，需二次確認）、Admin 取消課程區塊（只在課程處於可取消狀態時顯示，需二次確認）。
- Playwright smoke 測試（見 Slice 3）。
- 文件對齊（見 D9）：`docs/domain/permissions-matrix.md`、`docs/product/route-map.md`、`docs/product/admin-mvp-spec.md`、`docs/domain/state-transition-details.md`。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- `admin-service.ts` 兩個檔案內的所有函式，第一行都必須是 `await requireAdmin()`；不檢查任何擁有權（`organizerProfileId`／`userId`）——Admin 可以查看與操作任何一筆資料，這是 Admin 角色定義的本質，不是漏洞。
- `/admin/classes`／`/admin/classes/[classSessionId]` 兩個頁面比照既有 `admin/demands`／`admin/teachers` 的既有寫法：`requireAdmin()` 失敗時 `notFound()`，不是 `redirect("/sign-in")`，維持「非 Admin 完全感知不到這個路由存在」的既有一致性。
- 取消動作（課程／報名）都是破壞性、不可逆動作，UI 上都必須有二次確認 checkbox（比照 `admin/demands` 的 `confirmReject` 既有先例），server action 也要再檢查一次（不能只信任 client 端的 `required`）。

## 5. 產品主人決策 Gate（D1–D9）

### D1 — Admin 對 ClassSession 的能力範圍：只做取消，不做編輯或泛用的狀態變更

- **推薦：本輪只落地「取消」這一個 Admin 動作。**`docs/product/admin-mvp-spec.md` 描述的完整範圍還包含「協助補齊必要資訊」與「變更 status」，但這兩者本輪都不做：
  1. **「協助補齊必要資訊」= 編輯既有 class session 的核心欄位**——`class-session-creation` D2 已經明確決定 Organizer 建立後不可編輯（一次到位），這是這個 model 從一開始就有的設計限制，不是 Organizer 專屬的限制。允許 Admin 繞過這個限制需要一整套新的編輯表單 + 驗證邏輯，且會產生「Organizer 自己不能改，但 Admin 可以幫他改」這種新的資料一致性心智模型，超出本輪「補齊既有能力缺口」的性質，屬於獨立的大功能，需要時另開一輪。
  2. **「變更 status」的完整泛用能力**——完整設計表格（2.1 已引用）列出 `draft → pending_confirmation → open_for_enrollment → confirmed`，但這些中繼狀態本身就不接線（`pending_confirmation`/`confirmed` 從 `class-session-creation` D9 開始就明確決定不接線），Admin 沒有東西可以「變更」到。真正落地的狀態只有 `draft`/`open_for_enrollment`/`completed`/`cancelled` 四個，其中 `draft → open_for_enrollment` 與 `open_for_enrollment → completed` 目前都是 Organizer own-scoped 動作，讓 Admin 也能觸發這兩個轉換不是本輪要解決的問題（沒有任何已知的營運情境需要 Admin 代替 Organizer 開放報名或標記完成），只做「取消」是因為這是**唯一**明確符合「資料出錯或有問題，需要 Admin 緊急介入停損」這個產品問題的動作。
  3. **修正（codex round 1 指出的問題，已採納）：UI 判斷「要不要顯示取消按鈕」必須同時檢查狀態與 `startAt`，不能只檢查狀態。** `cancelClassSessionCore`（D5）的資格條件是「狀態在 `{draft, open_for_enrollment}` 內**且** `startAt` 尚未到達」，兩個條件缺一不可。`/admin/classes/[classSessionId]` 詳情頁的「取消課程」區塊必須同時滿足 `["draft", "open_for_enrollment"].includes(classSession.status) && classSession.startAt.getTime() > Date.now()` 才顯示，比照既有 `hasClassSessionEnded` 的既有寫法（`src/app/organizer/classes/[classSessionId]/page.tsx` 已有一個等價的 `hasClassSessionEnded` module-scope helper，本輪新增一個對稱的 `hasClassSessionStarted(startAt: Date): boolean` helper，理由同樣是 React Server Component purity lint 規則不能在 render body 直接呼叫 `Date.now()`）——只顯示一個「一定會失敗」的按鈕，對 Admin 是誤導。同理，roster 每一列的個別「取消報名」按鈕也要套用 `cancelEnrollmentForAdminCore`（D5）的相同資格條件（`status === "confirmed" && classSession.startAt.getTime() > Date.now()`），已經開始的課程底下的 roster 只顯示唯讀列表，不顯示取消按鈕。

### D2 — 不做獨立的 `/admin/enrollments` 路由，roster + 取消報名併入 `/admin/classes/[classSessionId]`

- **推薦：拿掉 `docs/product/route-map.md` 原本規劃的 `/admin/enrollments` 路由，改成 Admin 在 class session 詳情頁直接看到完整 roster 並可以取消個別報名。**`/admin/demands` 之所以是一個獨立的全站列表頁，是因為它是一個**審核佇列**（只顯示 `status = "submitted"` 這個需要 Admin 動作的子集，數量天然有限）。Enrollment 完全不是這種情境——沒有任何一種 Enrollment 狀態需要 Admin 核准才能推進（V1 建立就直接是 `confirmed`，見既有 `enrollment` D1），一個「列出全平台所有 enrollment」的頁面沒有天然的篩選子集，會是一個隨著平台成長而無限增長、沒有明確用途的清單。roster 資訊本來就是「屬於某一堂課」的資料，Organizer／Teacher 現有頁面也都是把 roster 顯示在 class session 的詳情頁裡（`listConfirmedEnrollmentsForClassSession`／`listOwnClassSessionsForTeacher` 的既有形狀），Admin 沿用同一個資訊架構最一致：先在 `/admin/classes` 找到出問題的那一堂課，再到詳情頁處理該堂課的報名，比一個扁平、無篩選的全站列表更符合實際的操作情境（Admin 介入通常是因為某一堂課出了問題，而不是要瀏覽全平台的報名總表）。

### D3 — Admin 取消課程不新增 `cancellationReason` 欄位

- **推薦：Admin 取消課程完全比照既有 Organizer 取消課程的資料模型，不新增任何欄位。**`docs/product/admin-mvp-spec.md` 的 Class Session Actions 寫著「cancel class session，並記錄 reason」，但核對過這個 repo 目前**沒有任何一個 ClassSession 取消原因會被顯示在任何地方的既有先例**——既有的 Organizer 版 `cancelOwnClassSession`（`class-session-cancellation` 已落地）本身就完全沒有 reason 欄位或輸入 UI。這跟 `TeacherProfile.rejectionReason`／`suspensionReason` 不同：那兩個欄位存在是因為有明確的下游消費者（Teacher 自己的 dashboard 會顯示這個原因，讓 Teacher 知道下一步該怎麼修正），而 ClassSession 被取消後，沒有任何頁面會顯示「為什麼被取消」給 Organizer 或 Teacher 或 Member 看——`class_session_cancelled` 通知的文案是固定的（不含使用者輸入的自由文字），且 Organizer 自己取消時也從來不需要輸入原因。只有 Admin 這條路徑新增一個「其實只存進資料庫、沒有任何地方會顯示」的欄位，是為了滿足文件字面描述而做的裝飾性欄位，不符合這個專案一貫「不做超出目前需求的抽象」的原則。**這條決策明確窄化了 `admin-mvp-spec.md` 原本的文字描述**，本輪會在該文件補上落地現況說明這個範圍縮減與理由（見 D9），需要真正的取消原因記錄與顯示時，可以是獨立一輪（例如順便重新檢視 Organizer 版是否也該補上）。

### D4 — Admin 取消報名沿用既有 Member 自助取消的完全相同限制，不新增能力

- **推薦：`cancelEnrollmentForAdmin` 的資格條件跟既有 `cancelOwnEnrollment` 完全一樣——`status = "confirmed"` 且 `classSession.startAt` 尚未到達，只是拿掉 `userId` 過濾。**這代表 Admin **無法**取消一堂已經開始的課程的報名，跟 Member 自己不能取消是同一個限制（`enrollment` D14：取消一堂已經開始的課程的報名會抹除歷史報名紀錄，且讓這筆 enrollment 永遠無法銜接未來的 `confirmed → attended/no_show`）。這個限制對 Admin 也成立——沒有理由讓 Admin 可以做出比 Member 自己更破壞性的操作。如果未來真的出現「課程已經開始，但這筆報名從一開始就是錯的（例如重複建立、systeam bug）」這種需要 Admin 略過這個限制的情境，屬於獨立的、需要額外設計（例如要不要保留歷史紀錄、要不要影響已經發生的 capacity 計算）的後續需求，本輪不預先猜測著手。通知沿用既有 `enrollment_cancelled`／`self` 角色，收件人是該筆 enrollment 的 Member 本人——不新增角色，理由與文案修正見 D4.1。

#### D4.1 — 修正（codex round 1 指出的問題，已採納）：既有 `self` 角色通知文案是第一人稱主動語態，Admin 觸發時內容會不實

- 核對 `src/domain/notification/copy.ts`：`enrollment_cancelled.self` 目前的文案是「你已經取消「X」的報名。」，`class_session_cancelled.self` 是「你已經取消「X」。」——都是第一人稱主動語態，明確宣稱「收件人自己執行了這個動作」。這兩則文案原本只會在 Member／Organizer own-scoped 自助取消的既有路徑觸發，主詞「你」永遠正確；但本輪新增 Admin-scoped 取消路徑後，同一個 `self` 角色、同一份文案會被複用，此時收件人（Member／Organizer）明明什麼都沒做，卻收到「你已經取消」——這是會直接誤導使用者的錯誤通知內容，不是可以忽略的文字瑕疵。
- **修正方式：把這兩則 `self` 文案的 `body` 改成被動／中性語態，拿掉「你已經」的主動宣稱**：
  - `enrollment_cancelled.self`：`「${classSessionTitle}」的報名已經取消。`
  - `class_session_cancelled.self`：`「${classSessionTitle}」已經取消。`
  - `title` 兩則本來就已經是中性語態（「報名已取消」／「課程已取消」），不需要修改。
- **這個修正對既有 Member／Organizer own-scoped 自助取消路徑仍然完全準確**（「報名已經取消」這句話在「我自己取消的」情境下依然成立，只是不再明確點名是誰做的——這正是我們要的效果，因為同一則通知現在要能同時服務兩種觸發來源）。已核對 `tests/`／`src/` 沒有任何地方依賴這兩則文案的確切逐字內容（`grep "你已經取消"` 只命中 `copy.ts` 本身），修改不會破壞既有測試斷言。
- 本輪不修改 `demand_request_cancelled.self`（同樣是「你已經取消「X」。」的主動語態）——目前只有 Organizer own-scoped 的 `cancelDemandRequestForOrganizer` 會觸發這個角色，沒有 Admin 觸發路徑，維持現狀正確，不在本輪範圍內順手修改不相關的程式碼。

### D5 — 併發設計與可測試性：重構共用核心，Organizer 版行為完全不變，兩個 Admin 動作都要有 `__internal__` pure-core

- **推薦：把 `cancelClassSessionForOrganizer` 的交易邏輯抽成一個 private 共用核心 `cancelClassSessionCore(organizerProfileId: string | null, classSessionId, hooks, notifyOverride)`，`organizerProfileId` 為 `null` 代表 Admin-scoped（不檢查擁有權）。**
  - 鎖查詢的 `WHERE` 子句用 `Prisma.sql` 組合：`organizerProfileId` 非 null 時附加 `AND "organizerProfileId" = ${organizerProfileId}`，為 null 時完全省略這個條件（Admin 可以鎖住任何一筆 ClassSession）。
  - **修正（codex round 2 指出的問題，已採納）：鎖查詢的 `SELECT` 欄位必須額外帶出這筆 ClassSession 實際的 `organizerProfileId`，交易回傳值也要包含它，tx commit 之後的通知收件人解析要改用這個「從鎖住的列讀出來的」值，不能繼續用函式參數 `organizerProfileId`。** 原始草稿誤以為「通知邏輯完全不變」，但既有程式碼裡通知收件人解析的 Organizer 那一段（`prisma.organizerProfile.findUnique({ where: { id: organizerProfileId }, ... })`）用的正是函式參數 `organizerProfileId`——Admin 路徑呼叫時這個參數是 `null`，這段查詢會直接查不到（或視 Prisma 型別產生執行期錯誤），Organizer 完全收不到通知，而外層的 try/catch 會把這個失敗默默吞掉，變成「看起來成功、實際上 Organizer 從未被通知」的隱性 bug。修正後，鎖查詢的 `SELECT` 增加 `"organizerProfileId"` 欄位，交易回傳的物件從 `{ teacherProfileId, title, affectedMemberUserIds }` 擴充成 `{ organizerProfileId, teacherProfileId, title, affectedMemberUserIds }`，通知解析階段一律使用這個從資料庫讀出來的 `organizerProfileId`（不管是 Organizer 自己觸發還是 Admin 觸發，這個值永遠是這筆 ClassSession 真正的擁有者），Organizer own-scoped 呼叫路徑下這個值理論上會跟函式參數相同（因為鎖查詢的 `WHERE` 已經用函式參數過濾過），但改用「讀出來的值」更穩固、且是唯一能讓 Admin 路徑正確運作的作法。
  - 既有的 `cancelClassSessionForOrganizer(organizerProfileId, classSessionId, hooks?, notifyOverride?)` 改成單純委派給 `cancelClassSessionCore(organizerProfileId, ...)`——**exported function 的 signature、回傳型別、錯誤碼、行為必須完全不變**，這是已經出貨且有完整 Playwright 測試覆蓋（`tests/smoke/class-session-cancellation.spec.ts`）的程式碼，重構的唯一目的是消除重複，不能連帶改變既有行為。
  - 新增 `cancelClassSessionForAdmin(classSessionId, hooks?, notifyOverride?)`，**這個函式跟既有 `cancelClassSessionForOrganizer`一樣，都留在 `src/domain/class-session/__internal__/cancel-class-session-core.ts` 這個檔案裡 export，本身完全不呼叫 `requireAdmin()`**（跟既有 `cancelClassSessionForOrganizer` 從來不呼叫 `requireUser()` 是同一個既有慣例——擁有權／權限檢查一律交給呼叫端解析），委派給 `cancelClassSessionCore(null, ...)`。通知邏輯（收件人解析：Organizer `self`、Teacher `counterpart`、受影響 Member `affected_member`）完全不變，因為通知對象跟「誰觸發了取消」無關，只跟「這堂課本來屬於誰、誰報名了」有關（`self` 文案已修正為中性語態，見 D4.1）。
  - **為什麼必須共用而不是複製貼上一份新的**：這段邏輯包含 `SELECT ... FOR UPDATE` 鎖 + 連帶取消 Enrollment 的 `UPDATE ... RETURNING` + 通知收件人解析，複製一份等於這段複雜的併發正確性邏輯要維護兩份，未來任何一次修正很容易漏掉另一份，風險比重構本身更高。
  - **回歸驗證要求（寫進 Slice 1 驗證清單）**：重構完成後，必須先完整重跑一次既有的 `tests/smoke/class-session-cancellation.spec.ts`，全數通過才能繼續，不能只驗證新增的 Admin 路徑。
  - `src/domain/class-session/admin-service.ts` 的 `cancelClassSessionForAdmin` 是一個**同名但不同檔案**的薄 auth-wrapper：`await requireAdmin()` 之後委派給 `__internal__/cancel-class-session-core.ts` 匯出的核心版本。為避免零背景 Builder 混淆兩個同名 export，`admin-service.ts` 匯入時必須用別名：`import { cancelClassSessionForAdmin as cancelClassSessionForAdminCore } from "./__internal__/cancel-class-session-core"`（比照既有 `service.ts` 匯入 `cancelClassSessionForOrganizer` 的既有寫法，只是這次額外加別名避免命名衝突）。

- **修正（codex round 1 指出的問題，已採納）：`cancelEnrollmentForAdmin` 也需要一個不呼叫 `requireAdmin()`、可注入 `notifyOverride` 的 `__internal__` pure-core，理由不是併發鎖（這裡確實不需要，維持原判斷），而是可測試性。** 原始草稿假設「這是單一列的簡單 `updateMany`，不需要 `__internal__` 拆分」，但這個判斷只考慮了「要不要鎖」，沒有考慮「`admin-service.ts` 裡的函式一旦呼叫 `requireAdmin()`，就無法在 Node/Playwright 的 throwaway script context 直接呼叫，也就沒有地方可以注入 `notifyOverride` 驗證通知正確性」——這正是本輪稍早在 `teacher-profile-suspension`／`class-session-review` 兩輪已經確立、且本 plan 自己在 Slice 1 驗證清單裡也預設要用的既有先例（`__internal__` 拆分有兩個獨立成立的理由：鎖，或者可測試性，任一成立就要拆）。
  - 新增 `src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core.ts`：匯出 `cancelEnrollmentForAdminCore(enrollmentId: string, notifyOverride: NotifyFn = notifyUsers)`，內容就是既有 `cancelOwnEnrollment` 的同一段 `updateMany` 邏輯，只是拿掉 `userId` 過濾、不呼叫 `requireUser()`／`requireAdmin()`，成功後呼叫 `notifyOverride("enrollment_cancelled", [{ userId: <該筆 enrollment 的 userId>, role: "self" }], { classSessionTitle })`。
  - `src/domain/enrollment/admin-service.ts` 的 `cancelEnrollmentForAdmin(enrollmentId)`：`await requireAdmin()` 之後委派給 `cancelEnrollmentForAdminCore`。
  - 這個檔案不需要鎖（維持原判斷）：沒有跨列的連帶效果、沒有 capacity 計算的併發風險，取消只會讓已用的名額減少，不會有兩個併發取消互相打架的問題。

### D6 — Admin 列表顯示範圍：全部狀態、依狀態分組，不是審核佇列

- **推薦：`listAllClassSessionsForAdmin()` 一次查詢回傳所有狀態的 class session，`/admin/classes` 頁面依狀態分成「開放中」「已完成」「已取消」「草稿」四個區塊顯示（比照 `admin/teachers/page.tsx` 用 `.filter()` 分組顯示多種狀態的既有手法），不是像 `admin/demands` 那樣只顯示單一「待處理」狀態。**理由見 2.1 最後一點：ClassSession 從來不需要 Admin 核准才能推進狀態，Admin 在這裡的角色是總覽與必要時介入，沒有天然的「待處理」子集可以篩選，顯示全部並分組是最誠實反映 Admin 實際需求的呈現方式。排序：每個分組內依 `updatedAt` 新到舊（比照既有 `admin/demands` 的排序方向）。
- **接受的 V1 限制（codex round 1 建議，已採納但不視為阻擋項）**：`listAllClassSessionsForAdmin()` 是無上限的 `findMany`，資料量成長後會有效能疑慮。這個專案目前所有清單頁（`admin/demands`／`admin/teachers`／`organizer/classes`／`teacher/classes`）都是同一種無分頁設計，屬於既有、一致的 V1 慣例，不是本輪獨有的新債務。之後如果任何一個清單頁真的因為資料量出現效能問題，應該是跨頁面的一次性分頁切片，不在本輪單獨處理。

### D7 — 資料揭露範圍：跟既有 Organizer/Admin 頁面已揭露的資訊一致，不新增隱私邊界；roster 顯示全部狀態（不只 confirmed）

- **推薦：Admin 詳情頁顯示的欄位完全比照 Organizer 自己詳情頁能看到的（organizer 顯示名稱、teacher 顯示名稱、organization 名稱、Member 顯示名稱/email fallback/notes），不做額外遮蔽。**Admin 在 `admin/demands` 頁面已經可以看到 Organization 的 `contactEmail`／`contactPhone` 等聯絡資訊，本輪揭露的單筆 enrollment 欄位集合遠比那個更窄（不含 `phone`/`image`），沒有引入任何新的隱私考量。
- **修正（codex round 2 指出的問題，已採納）：Admin 版 roster **不能**直接沿用既有 `ClassSessionRosterEntry`／`listConfirmedEnrollmentsForClassSession` 的既有形狀，因為那個型別根本沒有 `status` 欄位、底層查詢也永遠只回傳 `status = "confirmed"` 的列（`WHERE ... status: "confirmed"`）。原始草稿一邊說「roster 比照既有 `ClassSessionRosterEntry` 形狀」，一邊又要求「每一列個別檢查 `status === "confirmed"` 才顯示取消按鈕」——這兩句話互相矛盾：如果查詢本來就只回傳 confirmed 列，逐列檢查 `status` 永遠是恆真、不可能有其他值可比較。** 修正為：`getClassSessionDetailForAdmin` 回傳一個新的 `AdminClassSessionRosterEntry` 型別（`id`／`memberLabel`／`notes`／`status: EnrollmentStatus`），底層查詢**不加** `status` 過濾，回傳這堂課底下所有 enrollment（含 `confirmed`／`cancelled`，V1 不會出現 `pending`/`attended`/`no_show`，見既有 `enrollment` D10）——這是 Admin 版刻意要比 Organizer 版更完整的地方：Admin 需要看到「這位 Member 是不是已經自己取消過了」這種歷史狀態，才能正確判斷要不要／能不能介入，不是單純的報名名單。UI 每一列顯示一個 `status` 標籤（比照既有狀態徽章的既有版型），只有 `status === "confirmed"` 且該堂課 `startAt` 尚未到達的列才顯示取消按鈕（D1 第 3 點），`cancelled` 列純顯示、不提供任何動作。

### D8 — Migration 風險確認

- **推薦：本輪沒有任何 schema 變更，不需要 migration。**純粹是既有 model 上的新讀取查詢與既有狀態轉換的新觸發路徑（Admin-scoped），這是本輪風險最低的部分。

### D9 — 文件對齊策略

- **推薦**：
  1. `docs/domain/permissions-matrix.md`：ClassSession 表格的 `Cancel class session` 列 Admin 欄位從 `Admin`（完整未來設計佔位）改成已落地說明；Enrollment 表格的 `Cancel own enrollment` 列同樣補上 Admin 已落地的說明（own-scoped 限制拿掉，改成任何 enrollment，但取消資格條件跟 Member 自助取消完全相同，見 D4）。兩節下方的「V1 落地範圍」說明段落各自補上一句，並明確標註「協助補齊必要資訊」「變更 status（泛用）」「取消原因記錄」「`/admin/enrollments` 獨立路由」這幾項本輪刻意不做（連結 D1/D2/D3）。
  2. `docs/product/route-map.md`：Admin Routes 表格拿掉 `/admin/enrollments` 這一列（改用註記說明併入 `/admin/classes/[classSessionId]`，見 D2），新增 `/admin/classes/[classSessionId]` 一列，`/admin/classes` 該列的說明從「管理 class sessions」補充成「已落地：查看全部與取消」。
  3. `docs/product/admin-mvp-spec.md`：Class Session Actions／Enrollment Actions 兩節各自補上落地現況說明（比照既有 `teacher-profile-suspension` 那則落地現況說明的既有格式），明確寫出本輪範圍窄於原始描述的部分與理由（連結 D1/D3/D4）。
  4. `docs/domain/state-transition-details.md`：
     - ClassSession 段落的「V1 policy notes」表格（落地子集）新增一列：`draft`/`open_for_enrollment` → `cancelled`，Actor 改成 `Organizer / Admin`（或新增一列專門描述 Admin 版，效果與既有 Organizer 版說明一致，只差擁有權檢查）。
     - Enrollment 段落現有那句「**Admin 不介入**（D10）：本輪 Enrollment 生命週期完全是 Member 與 Organizer/Teacher（唯讀 roster）的範圍」需要修正——改成說明 Admin 現在可以取消任何一筆 `confirmed` enrollment（限制與 Member 自助取消相同），但 `attended`/`no_show`／`pending → confirmed` 仍然不接線。
  5. **不修改 `docs/scope/v1-scope.md`／`docs/scope/future-expansion.md`**：延續本專案一貫只更新落地現況追蹤文件、不回頭改規劃輸入文件本身的既有慣例。

## 6. 品牌與 UX 規則

- Admin 頁面文案可以比 Member/Organizer/Teacher 端更直接、資訊密度更高（比照既有 `admin/demands`／`admin/teachers` 的既有語氣），不需要像面向一般使用者那樣溫和包裝。
- 取消動作維持既有的二次確認 checkbox 慣例，不新增額外的摩擦（例如不需要打字確認課程名稱這種更重的確認機制）；確認文案必須明確說明「取消後無法復原，也無法重新建立」（見第 10 節修正版），不能沿用既有 Organizer 版比較含糊的「取消後無法復原」文案。

## 7. RWD Requirements

- Admin pages 至少要在 tablet 與 desktop 可用（`docs/product/route-map.md` 既有 RWD 原則），不需要跟 Member/Organizer/Teacher 端一樣做到 360px 手機寬度，比照既有 `admin/demands`／`admin/teachers` 的既有做法。

## 8. 實作切片（Slice 1–3；施工前提：D1–D9 已拍板）

### Slice 1 — Domain services（重構共用核心 + 新增 Admin-scoped 函式）

- `src/domain/class-session/__internal__/cancel-class-session-core.ts`：抽出 private `cancelClassSessionCore(organizerProfileId: string | null, classSessionId, hooks?, notifyOverride?)`（D5），既有 `cancelClassSessionForOrganizer` 改為委派、signature 不變；新增同檔案匯出、同樣不呼叫 `requireAdmin()` 的 `cancelClassSessionForAdmin(classSessionId, hooks?, notifyOverride?)`（D5）。
- `src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core.ts`（新檔案）：`cancelEnrollmentForAdminCore(enrollmentId, notifyOverride?)`，不呼叫 `requireAdmin()`（D5 修正版）。
- `src/domain/class-session/admin-service.ts`（新檔案）：`listAllClassSessionsForAdmin`、`getClassSessionDetailForAdmin`（純讀取，`requireAdmin()` 把關）、`cancelClassSessionForAdmin`（`requireAdmin()` + 委派給 `__internal__` 版本，匯入別名見 D5）。
- `src/domain/enrollment/admin-service.ts`（新檔案）：`cancelEnrollmentForAdmin`（`requireAdmin()` + 委派給 `cancelEnrollmentForAdminCore`，D4/D5）。
- 修正 `src/domain/notification/copy.ts`：`enrollment_cancelled.self`／`class_session_cancelled.self` 的 `body` 改成中性語態（D4.1）。
- **驗證**：
  1. 先完整重跑既有 `tests/smoke/class-session-cancellation.spec.ts`，確認重構後 Organizer 版行為/錯誤碼 100% 不變（D5 硬性要求）。
  2. throwaway `tsx` script **直接呼叫兩個 `__internal__` pure-core**（`cancelClassSessionForAdmin`／`cancelEnrollmentForAdminCore`，兩者都不呼叫 `requireAdmin()`，可以直接傳入信任過的 ID），涵蓋：Admin 可以取消任何 organizer 的 class session（不受擁有權限制）、取消已經開始/已完成/已取消的課程都被正確擋下並回傳對應錯誤碼、取消動作正確連帶取消 confirmed enrollment 並通知三方（`notifyOverride` 注入驗證收件人、角色、且文案不再宣稱「你已經取消」；**尤其要驗證 Admin 路徑下 Organizer 確實收到通知**，這是 D5 修正版要解決的問題——用 `organizerProfileId = null` 呼叫、確認回傳的收件人清單裡仍然包含正確的 Organizer userId）、`cancelEnrollmentForAdminCore` 可以取消任何 user 的 enrollment、已經開始的課程的報名被擋下、通知內容正確（`notifyOverride` 注入驗證）。
  3. `listAllClassSessionsForAdmin`／`getClassSessionDetailForAdmin`／`admin-service.ts` 的兩個 auth-wrapper（`cancelClassSessionForAdmin`／`cancelEnrollmentForAdmin`）都呼叫 `requireAdmin()`，無法在 Node context 直接呼叫，行為驗證延到 Slice 2 的瀏覽器實際操作與 Slice 3 的 Playwright 測試（比照 `class-session-review-plan` Slice 1 對 `listReviewsForClassSession` 的既有處理方式）。

### Slice 2 — UI

- `src/app/admin/classes/page.tsx`／`actions.ts`：列表頁（D6，依狀態分組），連到 detail 頁。
- `src/app/admin/classes/[classSessionId]/page.tsx`／`actions.ts`：詳情頁（D7 資料揭露範圍）、roster + 個別取消報名（D4，每列取消按鈕只在 `status === "confirmed" && startAt` 尚未到達時顯示，見 D1 第 3 點）、取消課程區塊（D1/D3，只在狀態可取消**且** `startAt` 尚未到達時顯示，新增 `hasClassSessionStarted` module-scope helper，見 D1 第 3 點）。
- **驗證**：瀏覽器實際操作——建立多個不同狀態（draft/open_for_enrollment/completed/cancelled）的 class session（含 confirmed enrollment），確認 `/admin/classes` 正確分組顯示；進入 detail 頁確認 roster 正確、取消課程只在可取消狀態**且未開始**時顯示（額外建立一個 `open_for_enrollment` 但 `startAt` 已過的 class session，確認取消區塊與 roster 個別取消按鈕都不顯示，見 D1 第 3 點）；實際執行一次 Admin 取消課程（確認連帶取消 enrollment、course 狀態變更、既有 Organizer/Teacher 頁面同步反映、Organizer/Teacher 收到的通知文案不再宣稱「你已經取消」）；實際執行一次 Admin 單獨取消一筆 enrollment（不取消整堂課，確認只有那一筆 enrollment 受影響、名額釋放、該 Member 收到的通知文案同樣修正過）。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/admin-class-session-management.spec.ts`：涵蓋 Slice 1 驗證清單的所有邊界（用真正的 Playwright smoke 測試取代 throwaway script 的等價案例）、非 Admin 存取 `/admin/classes`／`/admin/classes/[classSessionId]` 回傳 404（比照既有 `admin/demands`／`admin/teachers` 的既有 non-admin 測試手法）、完整 UI E2E 流程（Admin 取消課程、Admin 取消單一報名）。
- 更新 `docs/domain/permissions-matrix.md`（D9 第 1 點）、`docs/product/route-map.md`（D9 第 2 點）、`docs/product/admin-mvp-spec.md`（D9 第 3 點）、`docs/domain/state-transition-details.md`（D9 第 4 點）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`（含重跑 `class-session-cancellation.spec.ts` 確認沒有回歸）。

### Slice 順序

Slice 1 必須先完成且通過既有取消測試的回歸驗證，才能開始 Slice 2（UI 依賴 Admin-scoped domain service）。Slice 3 排最後。

## 9. Verification Planning

- Domain 層（Slice 1）：既有測試回歸 + throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- **修正（codex round 1 指出的問題，已採納；round 2 進一步修正）：「沒有 migration」不等於「沒有不可逆的資料變化」，原始草稿把這兩件事混為一談，是錯的。** 本輪沒有 schema 變更（D8），但**取消是單向動作**——這個系統目前完全沒有「恢復已取消的 ClassSession／Enrollment」這個 transition（`cancelled` 是終局狀態，比照既有 Organizer 版取消、Member 版取消完全一樣的既有性質，不是本輪新引入的限制）。`git revert` 對應的 slice commit 只能移除「Admin 可以觸發取消」這個**能力**，不會、也不可能復原任何已經透過這個能力被取消的真實資料。
- **修正（codex round 2 指出的問題，已採納）：round 1 的修正版誤以為「重新走一次既有建立流程」是可行的補救方式，實際上被既有 schema 約束完全擋死，不存在這條路。** 核對過 `ClassSession.demandRequestId` 是 `@unique`，且既有 `class-session-cancellation` D5 已經明確決定「取消不影響 DemandRequest：`converted_to_class` 是媒合流程走到這一步的歷史事實，不因為之後那堂課被取消而回頭改變」——代表一筆 `DemandRequest` 一旦轉成 `converted_to_class` 並建立過 `ClassSession`，即使那個 `ClassSession` 之後被取消，這筆 `DemandRequest` 也永遠卡在 `converted_to_class`，**沒有任何既有 transition 能讓它回到 `matched`**，Organizer 不可能對同一筆 `DemandRequest` 重新建立第二個 `ClassSession`（`createClassSessionForOrganizer` 的既有資格檢查要求 `matched` 狀態）。Enrollment 同理：`@@unique([classSessionId, userId])` 加上既有 `enrollment` D8「取消後不可重新報名——這個 unique constraint 只認組合本身是否存在過，不分狀態」，代表同一位 Member 對同一堂被取消的課永遠無法重新建立 enrollment。**正確的說法是：Admin 一旦執行取消，這個系統目前完全沒有任何使用者可以自助操作的復原路徑**（既不是「重新建立」也不是「重新報名」，兩者都被既有的資料庫約束擋死）；唯一的補救是全新的、不相關的 `DemandRequest`／`ClassSession`／`Enrollment` 記錄（不是原本那筆的復原，是另起爐灶），或者需要工程人員直接介入資料庫。這個限制本輪之前就已經對 Organizer／Member 自助取消成立，本輪沒有讓它變得更差，只是新增了第三種可以觸發同一個不可逆動作的角色——但**Admin 端 UI 的二次確認文案必須誠實反映這一點**（例如「取消後無法復原，也無法重新建立」），不能沿用既有 Organizer 版「取消後無法復原」這種比較含糊、沒有明講「連重新建立都不行」的既有文案。
- 重構 `cancel-class-session-core.ts` 的部分（D5）如果回歸測試發現任何既有行為改變，必須在同一個 Slice 1 內修正到完全一致才能繼續，不允許帶著已知的行為差異進入後續 slice。

## 11. Planning-only self review

- 已核對：本輪不需要新的 `NotificationType` 或角色（D5/D4 都是重用既有事件與角色）。
- 已核對：`ClassSessionStatus`／`EnrollmentStatus` 兩個 enum 都沒有新增值的需求。
- 已核對：`/admin/classes`／`/admin/classes/[classSessionId]` 兩個新路由不會跟另一個進行中、未 commit 的 role-dashboards 工作（`src/app/member/page.tsx`／`src/app/organizer/page.tsx`）有任何檔案交集。

<!-- codex-peer-reviewed: 2026-07-29T10:09:52Z rounds=3 verdict=approved -->
