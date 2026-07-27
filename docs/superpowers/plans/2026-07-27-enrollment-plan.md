# Enrollment — Implementation Plan

> 狀態：**planning-only**。本輪只產出可逐 slice 執行的規劃，不實作任何 schema / 程式 / 測試。
> 目標 user flow：Organizer 在自己的 class session 詳情頁把 `draft` 課程「開放報名」（`open_for_enrollment`）→ Organizer 把連結分享給潛在會員 → 已登入 Member 透過直接連結進入 `/classes/[classSessionId]` 查看詳情、勾選 basic consent 後報名 → 系統原子檢查名額與重複報名，成功即直接 `confirmed`（V1 跳過 `pending`）→ Member 在 `/member/enrollments` 查看/取消自己的報名 → Organizer／Teacher 在既有 class session 詳情頁看到基本 roster。
> 本文件為 **High-risk Planning Gate** 產物（新增 model／新 state machine／新增第三種登入角色的寫入路徑／併發保護核心是 capacity 這種資源競爭場景）。**在第 5 節產品主人決策（D1–D14）全部拍板前，不得產出可直接執行的 Builder implementation prompt。**

---

## 0. 如何閱讀本 plan（給零背景 Builder）

- 本 plan 目標是自足：Builder 只需讀「本檔 + 目前 repo」即可理解各 slice 設計。
- 第 2 節「現況核對」的敘述以 primary source 為準；Builder 施工前**必須自行再核對一次實際檔案**。
- 「allowed files」為白名單：未列出的檔案一律 forbidden。
- 本 plan 明確**不含**：`/classes` 公開列表、Visitor（未登入）可見的 class detail、`ClassSession: open_for_enrollment → confirmed`、`attended`/`no_show`、`/admin/enrollments`、付款——這些是未來獨立 plan 的範圍（見第 3 節）。

---

## 1. 背景與範圍

### 1.1 產品問題

`docs/superpowers/plans/2026-07-26-class-session-creation-plan.md`（已出貨）完成了「Organizer 建立 ClassSession」這一步，但 `ClassSession` 建立後永遠停在 `draft`，沒有任何人能真正報名上課——demand-to-class 的核心價值鏈到這裡還是斷的。本輪補上「開放報名」與「Member 報名」這兩步，讓一堂課第一次能真正被會員報名。

### 1.2 風險等級

依 `docs/harness/risk-based-workflow.md`／`mvp-slicing.md`：新增 **全新 model（`Enrollment`）、全新 state machine、新增第三種登入角色（Member）第一次擁有的寫入路徑、capacity 併發保護（資源競爭，比前兩輪的「demand 只能被 select/建立一次」更複雜——這次是「同一個 class session 可以被『多位不同』使用者同時報名，直到滿額」）**，屬 **High-risk / Heavy**，先 Planning-only。

Risk flags：`PERMISSION_RISK`、`STATE_MACHINE_RISK`、`SCOPE_DRIFT_RISK`、`BRAND_RISK`、`DATA_INTEGRITY_RISK`（新 migration + capacity 超收風險，見 `class-session-and-enrollment-spec.md` Risks 段）。

### 1.3 命名澄清

「Enrollment」= 開放報名（ClassSession 單一新 transition）＋ Member 建立/取消 enrollment ＋ Organizer/Teacher 唯讀 roster。**不含** Member 直接瀏覽公開課程列表（`/classes`）、`ClassSession` 進一步的 `confirmed`/`completed`/`cancelled` 狀態、`attended`/`no_show`、Admin 管理介面。原因見第 3.2 節。

---

## 2. 現況核對（Repo Reality Audit；2026-07-27 working tree = committed `main` @ `b7e8f03`）

### 2.1 已 committed 的基礎（可直接依賴）

- `prisma/schema.prisma`：**沒有 `Enrollment` model，沒有 `EnrollmentStatus` enum**。`ClassSession.status` 目前只會是 `"draft"`（`class-session-creation` D9 只接線 `(none)→draft`）。**本輪需要新的 migration**。
- `src/domain/class-session/`：
  - `service.ts`：`createOwnClassSession`——本輪**不修改**，ClassSession 建立仍是一次到位、建立後不可編輯（`class-session-creation` D2，本輪沿用不變更）。
  - `__internal__/create-class-session-core.ts`：示範了本專案「auth-resolving 外層 + 不依賴 request context 的 pure 內層 + `hooks.onBeforeLock`/`onLockAcquired`」架構——**本輪的 Enrollment 建立**（`createEnrollmentForUser`，唯一有多個不同使用者競爭同一個有限資源(capacity)的 concurrency-sensitive 場景）**必須沿用同一套架構**，讓 Slice 6 的併發測試能用同一套確定性鎖測試手法（見 Slice 3）。「開放報名」（`openOwnClassSessionForEnrollment`）**不需要**這套架構——它是單一 Organizer 對自己單一 class session 的單純狀態轉換 guard，沒有「多方競爭同一資源」的併發場景需要證明，見 Slice 2 的簡化說明。
  - `read-service.ts`：`getOwnClassSessionDetailForOrganizer(classSessionId)`／`listOwnClassSessionsForTeacher()`，**目前不含任何 Enrollment 相關欄位**。`listOwnClassSessionsForTeacher()` 本輪需要在既有 select 與 `TeacherFacingClassSession` 型別上新增 roster 資訊（見 Slice 4，僅新增欄位，不改變既有回傳型別的其餘部分或 `getOwnClassSessionDetailForOrganizer`）；Organizer 端的 roster 改用 Slice 4 新增的獨立 `listConfirmedEnrollmentsForClassSession` 函式，不修改 `getOwnClassSessionDetailForOrganizer` 本身（避免它的用途混雜，也避免 Organizer 詳情頁在還沒開放報名/沒有 enrollment 時多查一份用不到的資料）。
  - `timezone.ts`：`parseTaipeiDatetimeLocal`／`formatTaipeiDatetime`，class detail 顯示時間需要沿用（D13 精神一致適用）。
- `src/lib/auth/session.ts`：`requireUser()` 回傳 `CurrentUser`（`id`/`email`/`name`/`image`/`isAdmin`）。**沒有** `MemberProfile` model 或 `requireApprovedMember()` 這類東西——`route-map.md` 明確寫「所有登入者預設具備 Member 基本能力」，任何通過 `requireUser()` 的使用者就有 Member 能力，不需要額外的 capability gate 或 profile model。
- `docs/product/route-map.md`：已列出 `/classes/[classSessionId]`（class session 詳情、share link 與 enrollment 入口）、`/member/dashboard`、`/member/enrollments`、`/admin/enrollments`，但**這些路由目前完全不存在**於 `src/app/`。`/classes`（公開列表）明確標記「optional/later，不作為 V1 必做」。
- `src/app/organizer/classes/[classSessionId]/page.tsx`：既有 Organizer class session 詳情頁，目前**沒有任何「開放報名」動作入口**，也沒有顯示任何 roster。
- `src/app/teacher/classes/page.tsx`：既有 Teacher 唯讀列表，目前**沒有顯示任何 roster**。

### 2.2 上游依賴狀態

無平行未拍板的 draft plan。本輪建立在已 committed 的 `class-session-creation`（`ClassSession` model 與 `draft` 狀態）之上。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- **`/classes` 公開列表**與**未登入 Visitor 可見的 class detail**：`route-map.md` 已標記 optional/later；本輪的 `/classes/[classSessionId]` 只服務**已登入 Member**，不服務 Visitor（見 D4）。
- **`ClassSession: open_for_enrollment → confirmed`**：完整設計裡這是「開課條件成立」的另一個狀態，V1 沒有明確觸發條件（不是機械式的 capacity 檢查），本輪不接線；`open_for_enrollment` 本身已足以讓 Member 報名到滿額為止（見 D3）。
- **`attended`/`no_show`**：`class-session-and-enrollment-spec.md` 已明確標記為「future 或 admin-only 後續能力」，本輪不做。
- **`/admin/enrollments`**：Admin 目前在三輪 plan 中的職責都刻意保持單純（demand publish/reject、不介入 select、不介入 class 建立），本輪延續同一先例，Admin 不參與 Enrollment 生命週期。
- **付款（`PaymentIntent`）**：spec Non-goals 已明確排除，本輪不做。
- **Teacher schedule conflict、可設定的報名截止日（例如「開課前 24 小時截止報名」這種可調整的營運規則）**：本輪不做，比照 `class-session-creation` D8 對「目前沒有清楚觸發條件的規則先不接線」的一貫做法。**這不等於完全不做時間相關的把關**——見 D14：本輪仍會擋下「對已經開始的課程報名/取消」這種基本、與時間相關的合理性檢查，兩者是不同層次的規則（D14 是防止對已過去的課程操作的基本檢查，不是可設定的截止日政策）。

---

## 3. Scope Boundary

### 3.1 本輪 in-scope

- 新增 `Enrollment` model + `EnrollmentStatus` enum（完整值，只接線 `(none)→confirmed`、`confirmed→cancelled`，見 D1）+ migration。
- `ClassSession: draft → open_for_enrollment`，Organizer own-scoped 明確觸發（D2）。
- Member 對 `open_for_enrollment` 的 class session 建立 enrollment：原子檢查名額與重複報名（own-scoped，D5 併發保護）。
- Member 取消自己的 enrollment（own-scoped，D8）。
- Member 唯讀查看自己的 enrollments 列表（`/member/enrollments`）。
- Member 透過直接連結查看 class session 詳情並報名（`/classes/[classSessionId]`，D4）。
- Organizer／Teacher 在既有 class session 詳情頁看到基本 roster（confirmed enrollments 的識別資訊 + notes，D9）。
- 安全、RWD、品牌、Playwright smoke 規劃。

### 3.2 本輪明確不包含

- `/classes` 公開列表、Visitor 可見的 class detail（D4）。
- `ClassSession: open_for_enrollment → confirmed`／`completed`／`cancelled`（見 2.3）。
- `Enrollment: pending` 狀態（D1，V1 直接 `(none)→confirmed`）、`attended`/`no_show`。
- `/admin/enrollments`，Admin 不介入 Enrollment 生命週期（D10）。
- 付款、報名截止日、teacher schedule conflict。
- Notification/email（D12，延續本專案一貫分期）。

---

## 4. 安全與權限設計

1. **Enrollment 建立一律 own-scoped**：`userId` 一律從 `requireUser()` 解析，不信任 client 傳入的任何 id 欄位。
2. **併發保護（capacity + 重複報名）**：Enrollment 建立必須是原子操作，同時滿足「class session 當下是 `open_for_enrollment`」「`startAt` 尚未到達（D14）」「目前 confirmed enrollment 數量 < capacity」「這個 user 尚未對這個 class session 建立過 enrollment」。比照 `create-class-session-core.ts` 已驗證過的 `SELECT ... FOR UPDATE` 鎖 pattern，本輪鎖住的是 `ClassSession` 那一列（見 D5）。`@@unique([classSessionId, userId])` 加在 DB 層面雙重保險「同一 user 不可重複報名同一 class session」。
3. **開放報名（`open_for_enrollment`）一律 Organizer own-scoped**，比照既有 `markDemandRequestAsConvertedToClassIfMatched` 的 `updateMany` guard + throw-on-zero-count 契約。
4. **對 unauthorized / cross-owner resource 優先使用 not-found semantics**，沿用既有慣例。
5. **Member 只能建立/取消/查看自己的 enrollment**，不得查看其他 Member 的 enrollment 或 roster 全貌。
6. **DTO 資料最小化**：Member 查看 class detail 時不需要看到其他人的 enrollment 資訊；Organizer/Teacher 的 roster 只回傳 confirmed enrollment 的必要識別資訊（`User.name`/`User.email` 擇一或並列）與 `notes`，不回傳 Member 的其他個人資料（`User.phone`/`User.image` 等）。
7. **`basicConsent` 持久化為 `consentedAt` 時間戳記**（D6，spec 明確要求「記錄」，與其他純 UX 防誤觸的確認 checkbox 不同性質）：`createEnrollmentForUser` 在成功建立當下寫入 `consentedAt = now()`；server action 仍先驗證 `formData.get("basicConsent") === "yes"`（不通過直接拒絕，不進入建立流程），checkbox 本身依然是 `required` 的 client 端 UX 防誤觸，但這次通過驗證後**確實有一個對應的 DB 欄位記錄「有同意、何時同意」**。其他確認 checkbox（`confirmReject`/`confirmSelect`/`confirmCreate`／本輪開放報名確認）維持既有「不持久化」模式不變。
8. **錯誤訊息不得洩漏內部細節**：中文溫和訊息，discriminated union result。

---

## 5. 產品主人決策 Gate（D1–D14）

### D1 — Enrollment 建立時是否經過 `pending`？

- **問題**：完整設計是 `(none) → pending → confirmed`，`pending → confirmed` 的 Actor 是「System / Admin」，前置條件只是「capacity 仍可用」——這跟建立當下的 capacity 檢查是**同一個機械式判斷**，沒有獨立的人工審核或其他業務動作卡在中間。
- **選項 A（推薦）**：V1 **跳過 `pending`**，Member 建立 enrollment 通過原子 capacity／重複報名檢查後，**直接寫入 `confirmed`**。對齊本專案一貫的「跳過沒有獨立業務動作的中間狀態」簡化先例（`DemandRequest` 跳過 `under_review`、`DemandResponse` 跳過 `shortlisted`、`ClassSession` 跳過 `pending_confirmation`）。`pending` enum 值保留但不接線。
- **選項 B**：實作完整兩階段。
  - 缺點：`pending→confirmed` 沒有清楚的獨立觸發條件或業務理由，等於是為了「兩階段」而兩階段，增加狀態機複雜度但沒有對應價值。
- **推薦：A**。

### D2 — `ClassSession: draft → open_for_enrollment` 由誰、如何觸發？

- **選項 A（推薦）**：**Organizer own-scoped 明確按鈕觸發**（不自動）。在既有 `/organizer/classes/[classSessionId]` 詳情頁新增「開放報名」按鈕（`status === "draft"` 時顯示），點擊後（含二次確認，比照既有 pattern）原子把 `status` 轉為 `open_for_enrollment`。
  - 理由：`ClassSession` 建立時已經是一次到位、建立後不可編輯（`class-session-creation` D2），Organizer 可能想在正式開放報名前再次確認資訊無誤（畢竟建立後不能改，一旦開放就可能有真人報名）；保留這個人工檢查點比自動開放更保守、更符合「Gentle, Trustworthy」品牌調性。
- **選項 B**：建立當下直接是 `open_for_enrollment`，不用 `draft` 中繼。
  - 缺點：需要回頭修改已出貨的 `create-class-session-core.ts`，且拿掉了 Organizer 在真正開放前的最後確認機會。
- **推薦：A**。

### D3 — `open_for_enrollment` 之後要不要接 `confirmed`（class-level）？

- **推薦：不接**。完整設計裡 `open_for_enrollment → confirmed` 的前置條件是「開課條件成立」，V1 沒有明確、機械式的觸發規則（不像 capacity 那樣可以自動判斷）。`open_for_enrollment` 本身已經足以讓 Member 報名到滿額為止；`confirmed`/`completed`/`cancelled`（class-level）enum 值保留但本輪不接線。

### D4 — Member 如何存取 class session 詳情以報名？`isPublic` 欄位扮演什麼角色？

- **問題**：`route-map.md` 把 `/classes` 公開列表明確標記 optional/later，但 `/classes/[classSessionId]` 詳情頁（含 share link 與 enrollment 入口）**是 Enrollment 這條 user flow 唯一的入口**，沒有它 Member 完全無法報名。同時，`class-session-creation` 已經收了 `isPublic` 欄位（預設 `false`），但那一輪明確說「本輪不建立任何依賴它的公開路由」，沒有定義這個欄位在 Member 存取時该扮演什麼角色；`ClassSession` 建立後也不可編輯，若把 Member 存取權跟 `isPublic` 綁死，Organizer 建立時忘記勾選就永遠無法補救。
- **選項 A（推薦）**：`/classes/[classSessionId]` 只服務**已登入 Member**（`requireUser()`，任何角色都有 Member 能力），**不檢查 `isPublic`**——任何已登入使用者只要有這個 class session 的直接連結（`classSessionId`）且該 class session 是 `open_for_enrollment`，就能查看詳情並報名。`isPublic` 欄位本輪維持「已收集、未使用」狀態，留給未來「公開 `/classes` 列表」那一輪決定它的真正語意（例如未來可能是「是否出現在公開列表／是否允許 Visitor 未登入查看」）。**不對 Visitor（未登入）開放**，未登入導向 `/sign-in`。
- **選項 B**：把 Member 存取權綁定 `isPublic = true`。
  - 缺點：`isPublic` 建立後不可編輯，一旦 Organizer 建立時漏勾，這個 class session 就永久無法開放給任何 Member，且这個限制對「先用直接連結小範圍分享」這個本輪唯一支援的分享模式（share link，不是公開列表）沒有實質防護意義。
- **推薦：A**。此決策不影響、也不需要回頭修改 `isPublic` 欄位本身或建立流程。

### D5 — Enrollment 併發保護具體手法？

- **推薦**：比照 `create-class-session-core.ts` 已驗證過的 demand-level lock 手法，本輪鎖 `ClassSession`：

  ```sql
  -- Enrollment 建立 transaction 的第一個語句
  SELECT "id", "status", "capacity" FROM "ClassSession" WHERE "id" = $classSessionId FOR UPDATE
  ```

  取得鎖後，同一 transaction 內依序：(a) 檢查 `status === "open_for_enrollment"`；(b) `COUNT(*)` 目前 `status = "confirmed"` 的 enrollment 數量，若 `>= capacity` 回傳「已額滿」；(c) 檢查這個 `userId` 是否已對這個 `classSessionId` 有 enrollment（任何狀態，見 D8 的取消後不可重新報名規則）；(d) 通過後 `INSERT ... status = 'confirmed'`。四步都在鎖之下執行，確保併發報名不會超收，且錯誤語意（額滿 vs. 重複報名 vs. 未開放）彼此不會互相搶答（比照 `class-session-creation` D5 對「檢查順序決定錯誤碼是否可達」的教訓，這裡的檢查順序也是刻意的：先確認 open_for_enrollment 再判斷額滿/重複，理由與該輪一致——避免對已經不開放的 class session 誤報「已額滿」這種語意不精確的錯誤）。
- **架構**：沿用 `create-class-session-core.ts` 的 auth-wrapper + `__internal__` pure-core + `hooks.onBeforeLock`/`onLockAcquired` 模式（見 Slice 3），讓 Slice 6 能用同一套確定性鎖測試手法驗證「兩個 Member 同時搶最後一個名額，只有一個成功」。

### D6 — `basicConsent` 是否持久化？

- **問題**：`class-session-and-enrollment-spec.md` 明確寫「V1 Enrollment **需記錄** basic consent」——這跟本專案其他「確認 checkbox」（`confirmReject`/`confirmSelect`/`confirmCreate`）不是同一種性質：那些是「確認要執行一個不可逆動作」的 UX 防誤觸，checkbox 本身不是需要留存的紀錄；但 basic consent 是「使用者確認了解此課程非醫療行為」這句話本身——是面向未來可能的責任釐清的**紀錄**，spec 用「記錄」這個字不是隨意的。
- **推薦：持久化**。`Enrollment` 新增 `consentedAt: DateTime`（**非 nullable、無 `@default`**——這是全新 table，沒有舊資料相容性問題，V1 唯一的建立路徑必定顯式寫入這個值，nullable 只會允許一個理論上不該存在、且會削弱「每筆 enrollment 都有同意紀錄」這個不變量的狀態，見 Slice 1），比照時間戳記而非單純 boolean——除了記錄「有沒有同意」，也留下「何時同意」，語意更完整且不需要额外的一個 boolean 判斷。**其餘既有確認 checkbox（`confirmReject`/`confirmSelect`/`confirmCreate`／本輪 Slice 2 的開放報名確認）維持第 4 節第 7 點原本的「不持久化」設計不變**——這個決定只針對 basic consent，因為只有它被 spec 明確要求「記錄」，不是把所有 confirm checkbox 的既有慣例都推翻。

### D7 — `notes` 欄位驗證？

- **推薦**：選填，若提供 trim 後上限 500 字（比照本專案既有欄位的「選填欄位給較保守上限」先例，這個欄位性質是簡短備註，不需要 `DemandRequest.description` 等級的 2000 字上限）。

### D8 — 是否提供「取消報名」？取消後可否重新報名？

- **選項 A（推薦）**：提供。Member own-scoped，`confirmed → cancelled`，取消後**釋放名額**（cancelled enrollment 不計入 D5 的 capacity COUNT）。**取消後不可對同一 class session 重新報名**——`@@unique([classSessionId, userId])` 是資料庫層面唯一約束，只認 `(classSessionId, userId)` 這個組合本身是否已存在過（不分狀態），不是只認 `confirmed` 狀態；D5 步驟 (c) 的重複報名檢查同理，只要這個組合曾經存在（不論 `confirmed` 或 `cancelled`）就擋下重新報名。**取消也受 D14 的時間限制**：只能在 `startAt` 之前自助取消，課程開始後不提供自助取消（見 D14 的修正說明——這不是原本以為的「無害」動作，取消會抹除「這位 member 曾經是這堂已發生課程的 confirmed 報名者」這筆歷史紀錄，且讓這筆 enrollment 永遠無法在未來銜接 `confirmed → attended/no_show`）。
  - 理由：避免「取消又重新排隊」的搶名額拉扯（品牌風險：太像搶購工具，見 spec Risks 段），且簡化 unique 約束設計（不需要 partial unique index）。
- **選項 B**：取消後可重新報名（`@@unique` 只對 `confirmed` 狀態生效，需要 partial index）。
  - 缺點：明顯更複雜的約束設計，且「取消再报名」的產品價值在 V1 不明確。
- **推薦：A**。

### D9 — Organizer／Teacher roster 顯示範圍？

- **推薦**：只顯示 `confirmed` 狀態的 enrollment（`cancelled` 不顯示在 roster，但**不刪除資料**，只是不出現在這個唯讀列表）。每筆顯示 `User.name ?? User.email`（`name` 可能為 null，取 `email` 當備援識別）與 `notes`（若有）。**不回傳** `User.phone`／`User.image`／`email`（若已用 `name` 識別）等其他個人資料——`email` 僅在 `name` 為 null 時才作為識別用途揭露，其餘情況不揭露。Teacher 與 Organizer 看到的 roster 內容相同（沒有理由讓兩者看到不同範圍，都是為了準備上課）。

### D10 — Admin 是否介入？

- **推薦：不介入**。比照三輪以來的一貫先例（`demand-response-selection-and-matching` D2、`class-session-creation` D1/D10），Admin 職責保持單純，`/admin/enrollments` 本輪不做。

### D11 — `attended`/`no_show` 是否納入？

- **推薦：不納入**（見第 3.2 節）。enum 值保留。

### D12 — Notification？

- **推薦：延後**，對齊本專案一貫分期（D10 系列先例）。V1 以站內狀態顯示（Member 自己在 `/member/enrollments` 看到 `已確認`／`已取消`）作為告知，不寄 email。

### D13 — 測試策略？

- **推薦：只用既有 Playwright smoke**，不引入 Vitest、不改 `package.json`。

### D14 — 是否需要基本的時間合理性檢查（防止對已過去的課程操作）？

- **問題**：D3 決定本輪不接線 `open_for_enrollment` 之後的任何 `ClassSession` 狀態轉換，這代表**只用 `status` 判斷完全無法防止對一堂已經開始、甚至已經結束的課報名或取消**——`status` 會永遠停在 `open_for_enrollment`，即使 `startAt` 早就過了。這不是 D3 本身的問題（D3 的決策仍然成立），而是 D3 決策底下需要額外補上的一個獨立、輕量的檢查。
- **推薦**：以下三個動作都必須額外檢查 `startAt > now()`（比照 `class-session-creation` D6 對 `startAt` 已經有的「必須晚於送出當下」精神，這裡是同一種基本時間合理性檢查，不是新發明），不通過一律回傳 `class_session_already_started`：
  - **開放報名**（Slice 2 的 `openOwnClassSessionForEnrollment`）：不允許把一堂已經開始的課從 `draft` 轉為 `open_for_enrollment`，避免建立一個「開放但已經沒有意義」的狀態，也避免 Slice 5 的表單基於 `status` 顯示出「看起來可以報名、送出才失敗」的體驗。
  - **建立 enrollment**（既有設計，`createEnrollmentForUser`）。
  - **取消 enrollment**（`cancelOwnEnrollment`／其內層核心，見 Slice 3）：**修正**——原本認為取消沒有實質危害而不設限制，但取消會抹除「這位 member 曾經是這堂已發生課程的 confirmed 報名者」這筆歷史紀錄，且讓這筆 enrollment 永遠無法在未來銜接 `confirmed → attended/no_show`（D11 保留但未來要接的狀態）。這是真正的資料完整性問題，不是單純的「使用者反悔空間」問題，V1 課程開始後不提供自助取消（若真的需要修正歷史紀錄，屬於 Admin 未來職責，本輪不做）。
- **與 Non-goals 的「報名截止日」區分**：這裡的檢查是「課程是否已經開始」這個客觀事實，沒有可調整的參數；「報名截止日」（例如「開課前 24 小時截止」）是一個需要額外欄位／營運設定的政策，本輪仍不做（2.3 節）。

> **Gate 狀態**：D1–D14 **尚未拍板** → High-risk Planning Gate **未解除**。在 PO 逐項裁定前，第 8 節各施工 slice **不得**產出可執行 Builder implementation prompt。

---

## 6. 品牌與 UX 規則

- 報名表單語氣延續品牌「Gentle, Trustworthy」：不使用「搶名額」「手刀報名」等競爭性字眼；額滿時的訊息溫和說明「名額已滿」而非強調「錯過」。
- Basic consent checkbox 文案直接採用 spec 定案文字：「我了解此課程非醫療行為，會依自身身體狀況參與。」
- Roster 呈現避免像管理後台密集表格，卡片式呈現，手機版友善。
- 「開放報名」的二次確認文案需清楚說明「開放後 Member 就能看到並報名這堂課」。

## 7. RWD Requirements

- 報名表單與取消報名在 360px/390px 需可操作。
- Roster 卡片在手機版一欄呈現，不使用密集表格。
- Class detail 頁的報名 CTA 在手機上清楚可見（比照 spec UI Requirements）。

---

## 8. 實作切片（Slice 1–6；施工前提：D1–D14 已拍板）

### Slice 1 — Schema + Migration

- **goal**：新增 `Enrollment` model + `EnrollmentStatus` enum。
- **slice type**：micro（schema + migration）。
- **allowed files**：
  - `prisma/schema.prisma`：新增 `Enrollment` model（欄位：`id`/`classSessionId`/`userId`/`status`(`EnrollmentStatus` `@default(confirmed)`)/`notes`(`String?`)/`consentedAt`(**`DateTime`，非 nullable**，D6——這是全新的 table，沒有舊資料相容性問題，V1 唯一的建立路徑必定會顯式寫入這個值，用 nullable 只會允許一個理論上不該存在的狀態，削弱這個欄位原本要保證的「每筆 enrollment 都有同意紀錄」不變量，故不給 `?`、不給 `@default`，由 `createEnrollmentForUser` 在 `create` 呼叫裡明確傳入)/`createdAt`/`updatedAt`；relations 到 `ClassSession`/`User`，`onDelete: Cascade`（enrollment 是使用者自己的報名紀錄，隨 class session 或帳號刪除而一併清除是合理行為，這點與 `ClassSession` 本身的 `onDelete: Restrict` 不同，因為 enrollment 不是需要獨立保存的營運紀錄主體）；`@@unique([classSessionId, userId])`（D8）；`EnrollmentStatus` enum 完整值（`pending`/`confirmed`/`cancelled`/`attended`/`no_show`，只接線 `confirmed`/`cancelled`，D1/D11）；`ClassSession`/`User` 加 `enrollments Enrollment[]` 反向 relation。
  - `prisma/migrations/`：新增 migration（純新增）。
- **forbidden files / areas**：`src/**`、`tests/**`。
- **acceptance criteria**：`npx prisma migrate dev` 成功套用；`@@unique([classSessionId, userId])` 在 DB 層面阻擋重複報名（含 cancelled 後重新報名，D8）。
- **checks**：`tsc`/ESLint、`prisma migrate dev` 實際套用成功。
- **stop conditions**：D1/D8 未拍板 → 停止。

### Slice 2 — 開放報名 domain service

- **goal**：新增 `openOwnClassSessionForEnrollment(classSessionId)`，Organizer own-scoped 把 `draft → open_for_enrollment`。
- **slice type**：micro（core flow）。
- **allowed files**：
  - `src/domain/class-session/service.ts`（既有檔案，**僅新增**這一個 export，不修改既有函式）：`openOwnClassSessionForEnrollment(classSessionId)`——`requireUser()` 解析 organizer、確認自己擁有這筆 class session（`updateMany({where:{id,organizerProfileId,status:"draft",startAt:{gt:new Date()}},data:{status:"open_for_enrollment"}})`——D14：把 `startAt` 已過也一併納入 guard 的 `where` 子句，不是額外一次查詢，避免對一堂已經開始的課開放報名這種沒有意義的狀態；`count===0` 時需要一次額外查詢判斷回傳哪種錯誤——「不存在/非自己」、「非 draft 狀態」、或「`startAt` 已過」（`class_session_already_started`，與 D14 的其他情境共用同一個錯誤碼）——比照既有 pattern）。
- **forbidden files / areas**：`src/domain/class-session/__internal__/**`（本次是單一 `updateMany` guard，不涉及跨表 transaction，不需要 pure-core + hooks 架構，直接寫在 auth-resolving 的 `service.ts` 內即可，比照既有 `withdrawOwnDemandResponse` 的簡單 guard pattern，不是每個 mutation 都要套用完整的 lock 架構）、`prisma/**`。
- **acceptance criteria**：成功後 `status === "open_for_enrollment"`；對非 own/非 draft 的 class session 呼叫被擋；對已經是 `open_for_enrollment` 的 class session 重複呼叫回傳明確的「非 draft」錯誤（不是 not-found）。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D2 未拍板 → 停止。

### Slice 3 — Enrollment 建立/取消 domain service

- **goal**：新增 `src/domain/enrollment/` domain，提供驗證、建立、取消 service，沿用 auth-wrapper + `__internal__` pure-core + hooks 架構。
- **slice type**：micro（core flow + 併發保護 + 可測試性）。
- **allowed files**：
  - `src/domain/enrollment/validation.ts`（新增）：`notes` 選填，trim 後上限 500 字（D7）。
  - `src/domain/enrollment/service.ts`（新增），export：
    - `createOwnEnrollment(classSessionId, input)`：`requireUser()` 解析 `userId`，驗證 `basicConsent === true`（D6，client 傳入的 boolean；驗證通過後由內層函式寫入 `consentedAt`，見下），驗證 `notes`，呼叫下面的內層函式。
    - `cancelOwnEnrollment(enrollmentId)`：`requireUser()` 解析 `userId`，確認這筆 enrollment 屬於自己，`updateMany({where:{id,userId,status:"confirmed",classSession:{startAt:{gt:new Date()}}},data:{status:"cancelled"}})` guard（D14：透過 relation filter 把 `startAt` 檢查一併納入同一個 guard，不用額外查詢）。`count===0` 時需要一次額外查詢區分「不存在/非自己」、「非 confirmed 狀態」、或「`startAt` 已過」（`class_session_already_started`）三種錯誤語意。
  - `src/domain/enrollment/__internal__/create-enrollment-core.ts`（新增）：`createEnrollmentForUser(userId, classSessionId, input, hooks?: { onBeforeLock?; onLockAcquired? })`——不呼叫 `requireUser()`。整段包在 `prisma.$transaction(async (tx) => {...})`：(a) `await hooks?.onBeforeLock?.()` → `SELECT "id","status","capacity","startAt" FROM "ClassSession" WHERE "id" = ${classSessionId} FOR UPDATE`（0 列 → throw not-found）→ `await hooks?.onLockAcquired?.()`；(b) 檢查 `status === "open_for_enrollment"`（否則 throw `class_session_not_open`）；(c) 檢查 `startAt > now()`（D14，否則 throw `class_session_already_started`）；(d) `tx.enrollment.count({where:{classSessionId,status:"confirmed"}})` 與 `capacity` 比較（`>=` → throw `class_session_full`）；(e) 檢查是否已有這個 `(classSessionId,userId)` 的 enrollment（任何狀態，D8）（存在 → throw `already_enrolled`）；(f) `tx.enrollment.create({...status:"confirmed", consentedAt: now()})`（D6；`@unique` 約束 defense-in-depth，catch unique violation 同樣轉譯為 `already_enrolled`）。**檢查順序刻意如此**（open_for_enrollment → 時間 → capacity → 重複報名）：比照 `class-session-creation` D5 已驗證過的「檢查順序決定哪個錯誤碼可達」教訓，避免對已關閉或已過去的 class session 誤報「額滿」。
- **forbidden files / areas**：`src/domain/class-session/**`（唯讀 import 現有 export，不修改）、`prisma/**`。
- **domain and permission rules**：own-scoped 擁有權驗證內建在查詢的 `WHERE` 子句本身，不透過額外的預先 SELECT 判斷擁有權（避免 TOCTOU 縫隙，比照既有 pattern）。
- **acceptance criteria**：成功建立後 `Enrollment.status === "confirmed"`、`consentedAt` 已寫入（D6）；併發兩個 user 對只剩一個名額的 class session 同時報名，只有一個成功，確定性地（非機率性）；對非 `open_for_enrollment` 的 class session 報名被擋；對 `startAt` 已過的 class session 報名被擋（D14）；額滿被擋；重複報名被擋（含 cancelled 後重新報名，D8）；取消後名額正確釋放（下一個人可以成功報名）；**對 `startAt` 已過的 confirmed enrollment 呼叫取消同樣被擋（D14 修正——取消與建立、開放報名一樣受時間限制，見上）**；`createOwnEnrollment`／`createEnrollmentForUser` 的行為、錯誤碼、回傳型別一致。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D1/D5/D6/D7/D8/D14 未拍板 → 停止。

### Slice 4 — Enrollment 讀取 domain service

- **goal**：新增讀取函式：Member 自己的 enrollments、Organizer/Teacher 的 roster。
- **slice type**：micro（純讀取）。
- **allowed files**：
  - `src/domain/enrollment/read-service.ts`（新增）：
    - `listOwnEnrollmentsForMember()`：`requireUser()`，回傳自己所有 enrollment（含 class session 基本資訊，供 `/member/enrollments` 顯示）。
    - `getClassSessionForMember(classSessionId)`：`requireUser()`，**只回傳 `status === "open_for_enrollment"` 的 class session**，`draft` 一律回傳 `null`（not-found 語意）。這個過濾**不會**讓「目前無法報名」畫面變成不可達：D14 只在 `open_for_enrollment` 之上疊加一個「`startAt` 是否已過」的時間檢查，並不會把 class session 轉成別的 `status`（D3 已確定本輪不接線 `open_for_enrollment` 之後的任何狀態轉換）——所以一個「已經開始但還沒被任何機制關閉」的 class session，`status` 依然是 `open_for_enrollment`，這個函式依然會回傳它，UI 層再用 `startAt` 判斷要顯示報名表單還是「目前無法報名」（見 Slice 5）。這裡刻意**不**回傳 `draft` 狀態：`draft` 代表 Organizer 根本還沒開放、也還沒產生過任何分享連結，任何人（包含 Member 自己）都不應該能透過猜測或提早取得 `classSessionId` 就看到未開放課程的完整內容（時間、地點、老師等），這是資訊揭露而非「暫時無法報名」這種溫和訊息可以涵蓋的範疇，兩者的處理方式必須不同（`draft` 用 not-found 隱藏；已開放但已過期用「目前無法報名」溫和顯示）。+ 自己是否已有 enrollment（供 `/classes/[classSessionId]` 判斷顯示報名表單或既有報名狀態）。
    - `listConfirmedEnrollmentsForClassSession(classSessionId)`：**僅供 Organizer 的單一 class session 詳情頁使用**（own-scoped，檢查 `organizerProfileId` 屬於自己），只回傳 `confirmed` 的 enrollment，DTO 為 `{ id, memberLabel: string, notes: string | null }`（`memberLabel` 即 D9 的 `User.name ?? User.email`，在 service 層算好，UI 不需要再處理 fallback 邏輯）。這個函式一次只服務一個 class session，用在 Organizer 詳情頁（本來就是單一 class session 的 context）沒有 N+1 問題。
  - `src/domain/class-session/read-service.ts`（既有檔案，**僅修改** `listOwnClassSessionsForTeacher()` 這一個函式的 Prisma `select` **與 `TeacherFacingClassSession` 這一個型別的定義**——兩者必須同時改，否則型別對不上執行時的實際回傳值，`src/app` 那端也拿不到欄位；不修改其他函式或型別，包含 `OrganizerFacingClassSession`/`getOwnClassSessionDetailForOrganizer`）：在既有 select 上新增 `enrollments: { where: { status: "confirmed" }, select: { id: true, notes: true, user: { select: { name: true, email: true } } } }`，`TeacherFacingClassSession` 型別同步新增對應的 `enrollments: { id: string; notes: string | null; user: { name: string | null; email: string | null } }[]` 欄位，讓 Teacher 列表頁**一次查詢就拿到所有 class session 各自的 roster**，不需要對每張卡片再發一個 `listConfirmedEnrollmentsForClassSession` 的獨立 auth 查詢（Teacher 的列表本來就已經是 own-scoped，roster 只是同一筆資料多選幾個欄位，不需要重複驗證擁有權）。`memberLabel` 的 `name ?? email` fallback 這次改在 UI 層算（因為這裡回傳的是原始 `user.name`/`user.email`，不是 domain service 算好的 `memberLabel` 字串——與 Organizer 那個單一 class session 版本的 DTO 形狀刻意不同，因為兩者的資料來源路徑不同，沒有必要為了統一而讓 Teacher 版本也繞回一個逐筆查詢）。
- **forbidden files / areas**：`src/domain/class-session/**` 內除 `listOwnClassSessionsForTeacher()` 以外的函式與型別、`src/domain/enrollment/__internal__/**`（不修改）、`prisma/**`。
- **acceptance criteria**：Member 只看到自己的 enrollments；`listConfirmedEnrollmentsForClassSession` 只回傳 `confirmed`、DTO 不含 `phone`/`image`、`name` 為 null 時正確 fallback 到 `email`、非 own class session 的查詢回傳 not-found 語意；Teacher 列表頁的 roster 資料由 `listOwnClassSessionsForTeacher()` 單一查詢一次帶出，不對每個 class session 額外發查詢（用 Playwright 測試搭配 `read_network_requests`／或直接檢查 domain service 呼叫次數不現實，這項改用 code review 方式確認 Slice 5 沒有在迴圈裡呼叫 `listConfirmedEnrollmentsForClassSession`，並非本 slice 自己的自動化驗證項目，而是 Slice 5 的實作紀律要求）。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D9 未拍板 → 停止。

### Slice 5 — UI 整合

- **goal**：Member 報名/取消 UI；Organizer 開放報名 + roster；Teacher roster。
- **slice type**：standard（新路由 + 既有頁面最小整合）。
- **allowed files**：
  - `src/app/classes/[classSessionId]/page.tsx`（新增）+ `src/app/classes/[classSessionId]/actions.ts`（新增，`enrollAction`）：未登入導向 `/sign-in`；`getClassSessionForMember` 回傳 `null`（`draft` 或不存在）一律 `notFound()`（D4 修正：`draft` 不揭露任何資訊，見 Slice 4 的更新說明）；回傳有值但**`startAt` 已過**（D14）時顯示溫和的「目前無法報名」訊息，不顯示表單；已有 enrollment 顯示狀態（含取消入口，見下，取消入口本身也依 D14 檢查 `startAt`）；否則（`open_for_enrollment` 且 `startAt` 未過）顯示報名表單（`notes` 選填 + basicConsent 必勾，比照既有二次確認 pattern）。
  - `src/app/member/enrollments/page.tsx`（新增）+ `src/app/member/enrollments/actions.ts`（新增，`cancelEnrollmentAction`）：列表 + 取消報名（二次確認）。
  - `src/app/organizer/classes/[classSessionId]/page.tsx`（既有檔案，僅新增：`status === "draft"` 時的「開放報名」表單區塊 + `status === "open_for_enrollment"` 時的**分享連結顯示**（`/classes/[classSessionId]` 的完整可分享網址，以純文字／可選取的方式呈現，不需要額外的複製到剪貼簿 JS 元件——D4 已確定這是本輪唯一的報名入口，若沒有這個顯示，Organizer 無從得知連結存在，整個 Enrollment user flow 就沒有起點）＋ roster 顯示 + import）。
  - `src/app/organizer/classes/[classSessionId]/actions.ts`（新增，`openForEnrollmentAction`，比照既有 `createClassSessionAction` 的 `revalidatePath`+`redirect`+encoded-feedback pattern）。
  - `src/app/teacher/classes/page.tsx`（既有檔案，僅新增：每個 class session 卡片下方的 roster 顯示區塊 + import；不新增路由，roster 直接顯示在既有列表頁，因為 Teacher 目前沒有個別 class session 的詳情頁）。
- **forbidden files / areas**：`src/domain/**`（只 import）、`src/app/organizer/demands/**`（本輪不需要改）。
- **acceptance criteria**：Organizer 可開放報名（含二次確認）；開放後頁面顯示可分享的報名連結；已開放的 class session 顯示 roster；Member 透過該連結可查看/報名/取消；額滿時表單正確顯示「已額滿」而非崩潰；Teacher 在自己的 class session 列表看到對應 roster；跨 organizer/teacher/member 存取被擋（not-found 或 empty）。
- **RWD/brand review**：依第 6/7 節。
- **stop conditions**：Slice 1–4 未合入 → 停止。

### Slice 6 — Tests + Docs 對齊

- **goal**：Playwright smoke 覆蓋開放報名 + 報名/取消 + capacity 併發保護 + roster + docs 對齊。
- **slice type**：batch（測試 + docs-only）。
- **allowed files**：
  - `tests/smoke/enrollment.spec.ts`（新增，可 import `src/domain/enrollment/__internal__/create-enrollment-core.ts`，比照前兩輪的既定作法——唯一允許本 slice import 的 `src/**` 路徑）：
    - **UI 全流程**：Organizer 開放報名（頁面成功顯示可分享的報名連結，斷言連結文字/href 存在）、Member 透過該連結報名成功且 DB 內 `consentedAt` 已寫入非空值、Member 查看/取消自己的 enrollment、Organizer/Teacher 看到 roster。
    - **驗證邊界**：`notes` 超長被拒；未勾選 basicConsent 被拒（伺服器端，繞過前端 required）。
    - **業務規則**：對非 `open_for_enrollment` 的 class session 報名被擋；重複報名被擋；取消後不可重新報名（D8）；取消後名額釋放，下一位可成功報名。
    - **D14 時間合理性檢查**（三個情境都要覆蓋）：
      - 對 `startAt` 已過的 `open_for_enrollment` class session 呼叫 `createEnrollmentForUser` 被擋（`class_session_already_started`）——這個可以直接呼叫，因為 `__internal__/create-enrollment-core.ts` 是本 slice 唯一允許 import 的 `src/**` 路徑（見下方 allowed files）。
      - `openOwnClassSessionForEnrollment`（開放報名）與 `cancelOwnEnrollment`（取消）都呼叫 `requireUser()`，依賴 Auth.js 的 request-scoped context，**不能**在 Playwright test body 當一般 Node 函式直接呼叫（比照本檔 D2/Slice 2 的既有說明：這兩者是單純的 auth-wrapped `updateMany` guard，不是 concurrency-sensitive 的 `__internal__` pure-core，所以不在允許 import 的白名單內）——這兩個情境改**走 UI**驗證：seed 一筆 `startAt` 已過的 `draft` class session，以該 organizer 身分點擊「開放報名」+ 二次確認，斷言錯誤 feedback 且 DB 內 `status` 仍是 `draft`；seed 一筆 `startAt` 已過的 confirmed enrollment，以該 member 身分在 `/member/enrollments` 點擊取消 + 二次確認，斷言錯誤 feedback 且 DB 內 `status` 仍是 `confirmed`。
    - **`draft` 保密性**（D4 修正）：**走 UI** 驗證——seed 一筆 `draft` class session，以任一已登入 member 身分（含該 class session 所屬 organizer 之外的其他人）造訪 `/classes/[classSessionId]`，斷言回應狀態碼為 404、且頁面不含該 class session 的標題／地點等任何欄位文字（同樣因為 `getClassSessionForMember` 是 auth-wrapped 函式，不在允許直接 import 的白名單內，不能繞過 UI 直接呼叫驗證）。
    - **併發保護**：比照前兩輪的 hooks 確定性鎖測試手法，建立一個 `capacity=1` 的 class session，兩個 Member 同時呼叫 `createEnrollmentForUser`，證明第一個真的持有鎖、第二個真的被擋住，鎖釋放後才繼續，且只有一個成功、額滿。
    - **IDOR**：跨 member 查看/取消他人 enrollment 被擋；跨 organizer/teacher 查看他人 class session 的 roster 被擋。
  - `docs/domain/data-model.md`：`Enrollment` 欄位草稿核對（目前已是 `userId`/`status`/`notes`，與本輪一致）；**新增 `consentedAt` 到欄位清單**（D6，既有草稿沒有這個欄位，本輪新增，需要明確補上，不能只核對既有欄位）；其餘若有落差一併修正。
  - `docs/domain/state-machines.md`：ClassSession Status V1 落地範圍新增 `draft → open_for_enrollment`；新增 Enrollment Status 的 V1 落地範圍小節（只接線 `(none)→confirmed`、`confirmed→cancelled`，D1/D8/D11）。
  - `docs/domain/state-transition-details.md`：ClassSession V1 policy notes 新增一列；新增 Enrollment 的 V1 policy notes 小節。
  - `docs/domain/permissions-matrix.md`：Enrollment 表格下方新增 V1 落地範圍註記（比照既有慣例）：`Create enrollment`/`Cancel own enrollment`/`View own enrollment` 皆 Member own-scoped；`View class roster basics` Organizer/Teacher own-scoped；`Confirm enrollment`/`Mark attended/no_show` 本輪不接線（D1/D11）；Admin 不介入（D10）。ClassSession 表格下方的既有註記補充 `Open for enrollment` 的 V1 落地說明（僅 Organizer own-scoped，D2）。
  - `docs/product/route-map.md`：
    - `/classes/[classSessionId]` 那一列的角色欄位從「Visitor, Member」改為「Member」（D4：本輪只服務已登入 Member，不服務 Visitor），描述維持不變（詳情/share link/enrollment 入口本輪已確認落地）。
    - Route Guard 原則既有一行「公開 class detail / share link 只允許 `open_for_enrollment` 或 `confirmed` 且標記可公開的 class session。」——這句話描述的是**完整未來設計**（Visitor 可見、依 `isPublic` 把關），與本輪 D4 的實際落地（僅 Member、不檢查 `isPublic`）不同，需要在後面明確加註本輪範圍：「（`enrollment` 已確認：V1 僅開放已登入 Member 存取，不對 Visitor 開放，也不檢查 `isPublic`——`isPublic` 目前只保留給未來公開列表使用，見 `class-session-creation` D11、`enrollment` D4）」。
    - `/member/enrollments` 路由描述若需要更新為「已確認」狀態；`/member/dashboard` 本輪不做，不需要新增描述（維持路由存在但功能未落地的既有慣例，不用特別標註）。
  - `docs/specs/class-session-and-enrollment-spec.md`：更新「落地現況」段落（該輪已建立），把 User Flow 第 4 步（開放報名）與部分第 5–8 步（Member 報名、capacity/重複檢查、confirmed）標註為已出貨；第 9 步（attended/no_show）與公開列表相關項目維持未落地。
- **forbidden files / areas**：`src/**`（除上方明列路徑外）、`prisma/**`、`package.json`、既有 spec/test 檔案（預設不改）。
- **acceptance criteria**：上述測試全數綠燈；既有 smoke 維持綠燈；docs 通讀不再與實際接線矛盾。
- **stop conditions**：D13 未定、或 Slice 1–5 未合入 → 停止。

### Slice 順序

```
Slice 1（schema + migration）
   ↓
Slice 2（開放報名）── Slice 3（enrollment 建立/取消）
                              ↓
                        Slice 4（enrollment 讀取）
                              ↓
                        Slice 5（UI 整合，依賴 2+3+4）
                              ↓
                        Slice 6（tests + docs）
```

---

## 9. Verification Planning

- `tsc`/ESLint：所有含 `src/**` 變更的 slice。
- `prisma migrate dev`：Slice 1 完成後立即套用並確認 schema 符合預期。
- `next build`：Slice 5 之後。
- `npm run test:smoke`：Slice 6 集中執行。
- **必含負向 security cases**：跨 member IDOR、跨 organizer/teacher roster IDOR、額滿併發保護（僅一個成功）、重複報名被擋、取消後不可重新報名、對非 open_for_enrollment 的 class session 報名被擋、`draft` class session 對 Member 不可見（D4）、對已過 `startAt` 的操作被擋（D14：開放報名／報名／取消三處都要）。
- **本 planning-only 任務不要求實際執行**；上述為施工時的驗證計畫。

---

## 10. Rollback 總則

- Slice 1 有 migration（新增 model/enum/FK，純新增不影響既有資料），rollback 需要新的 down migration 移除新增的 table/enum/FK；其餘 slice 皆為新增檔案 + 對既有三個檔案（`class-session/service.ts`、`organizer/classes/[classSessionId]/page.tsx`、`teacher/classes/page.tsx`）的最小新增修改。
- 依相依反序 rollback：Slice 6 → 5 → 4 → 3 → 2 → 1。

---

## 11. Planning-only self review

- **變更檔案**：新增本檔 `docs/superpowers/plans/2026-07-27-enrollment-plan.md`。本輪未預先修改任何其他檔案。
- **V1 scope**：符合；明確排除公開 `/classes` 列表、Visitor 可見 class detail、`open_for_enrollment` 之後的 ClassSession 狀態、`attended`/`no_show`、`/admin/enrollments`、付款。
- **一致性**：對齊既有 role model、permissions、state machines、data model、route map。
- **安全**：own-scoped、IDOR not-found 語意、併發保護（demand-level lock 手法沿用兩輪已驗證架構）、DTO 最小化，皆列入相關 slice。
- **RWD/brand**：已於第 6、7 節規劃。
- **產品主人決策**：D1–D14 為必要 gate，未全部拍板前不得產出可執行 Builder prompt。本 plan 未附任何可直接施工的 Builder prompt。
- **未修改無關檔案**：無。

<!-- codex-peer-reviewed: 2026-07-27T06:03:55Z rounds=4 verdict=approved -->
