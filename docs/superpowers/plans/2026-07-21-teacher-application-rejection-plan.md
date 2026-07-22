# Teacher Application Reject + Reason — Implementation Plan

> 狀態：planning-only。本輪不實作任何功能，只產出可分片 review 的實作規劃。
> 目標：讓 Admin 可以拒絕 `submitted` 的 `TeacherProfile`、保存具體 rejection reason，並讓 Teacher 看見原因後，沿用「既有」 `rejected → submitted` 重新送審流程。

## 1. 背景與範圍

### 1.1 這輪要解決的產品問題

現況：

- Admin review 只實作了 **approve**（`approveSubmittedTeacherProfileApplication` + `approveTeacherProfileApplicationAction`）。
- **完全沒有 reject 的 service、server action 或 UI**。Admin 目前無法在系統內拒絕一位老師。
- Teacher 端的 `rejected` 狀態文案（`src/app/teacher/dashboard/page.tsx`、`src/app/teachers/join/page.tsx`）已經在對使用者「承諾」會有退回說明，例如「請依平台提供的修正方向調整」「依照退回說明更新需要修正的欄位」，但**系統其實沒有任何欄位保存這個原因**，這段文案目前指向空氣。
- `rejected → submitted` 的重新送審 transition **已經存在且可運作**（`src/domain/teacher-profile/state.ts` 的 submit transition 接受 `from: "draft" | "rejected"`；`saveOwnTeacherProfileDraft` 也允許 `rejected` 更新草稿）。

因此本 feature 的真正缺口只有兩個：

1. Admin 沒有辦法把 `submitted` 老師改成 `rejected`（缺 write path）。
2. 沒有地方保存、也沒有地方顯示「具體 rejection reason」。

重新送審流程**不需要新建**，只需要驗證它與新的 reason 生命週期相容。

### 1.2 這輪明確不做（詳見第 8 節 Non-goals）

不含 suspend/restore、notification/email、marketplace 其他 domain、edit-after-submit、重送次數限制或 lockout。

### 1.3 風險等級

依 `docs/harness/mvp-slicing.md`，本 feature 觸及 **Prisma schema / migration / state machine / core user flow**，屬於 **High-risk**，觸發 High-risk Planning Gate。

→ 因此本文件為 planning-only。**在第 6 節「產品主人決策」全部拍板前，不得產出可直接執行的 Builder implementation prompt。** 各 slice 只描述設計與邊界，不視為已核准的施工單。

## 2. 現況核對（primary sources）

以下皆以實際 repo 內容為準，不接受文件敘述為既定事實。

### 2.1 Prisma schema — `prisma/schema.prisma`

- `TeacherProfile` 欄位：`id, userId(@unique), displayName?, bio?, teachingStyle?, experienceYears?, certifications[], specialties[], serviceAreas[], teachingFormats[], priceRange?, profilePhotoUrl?, status, createdAt, updatedAt`。**目前沒有任何 rejection / review 相關欄位。**
- `enum TeacherProfileStatus { draft submitted approved rejected suspended }` — `rejected` enum 值已存在。
- **`AdminNote` model 不存在於 Prisma schema**。它只出現在 `docs/domain/data-model.md`（欄位：`id, entityType, entityId, adminUserId, note, createdAt`），是尚未落地的設計稿。
- migration 目錄：`prisma/migrations/20260503074202_init_auth_capability_base/`、`20260509035139_add_teacher_profile_phase_1_fields/`。命名慣例為 `<timestamp>_<snake_case_description>`。

### 2.2 Domain / state — `src/domain/teacher-profile/`

- `state.ts`
  - `validateTeacherProfileSubmitTransition(from, input)`：`submitted/approved/suspended` 皆被擋；`draft`/`rejected` 通過 validation 後允許 `→ submitted`。**重新送審已支援。**
  - `validateTeacherProfileApproveTransition(from)`：只有 `submitted → approved`；`draft/approved/rejected/suspended` 各自回傳專屬 error code。
  - **沒有 `validateTeacherProfileRejectTransition`。**
- `service.ts`
  - `approveSubmittedTeacherProfileApplication(id)`：`requireAdmin()` → `updateMany({ where: { id, status: "submitted" }, data: { status: "approved" } })`，用 `count === 0` 回頭判斷 not-found / not-submitted。這是本輪 reject 應對齊的併發安全寫法。
  - `listSubmittedTeacherProfileApplicationsForAdmin()`：只回 `status: "submitted"`，含 `user { id, name, email, phone }`。
  - `getOwnTeacherProfileApplicationSnapshot()`：回自己的 profile（`teacherProfileDraftSelect`，**目前不含任何 reason 欄位**）。
  - **沒有 reject service function。**
- `validation.ts`：只驗證 submit 必填欄位，與 rejection reason 無關。
- `input.ts`：teacher 表單輸入正規化，與 admin reject 無關。

### 2.3 Admin action / UI — `src/app/admin/teachers/`

- `actions.ts`：只有 `approveTeacherProfileApplicationAction(formData)`，`requireAdmin()` → 呼叫 service → `revalidatePath("/admin/teachers")` → `redirect` 帶 `result`/`message` query。
- `page.tsx`：`requireAdmin()`（失敗 `notFound()`）；列出 submitted applications；每張卡片只有一顆 **Approve** 按鈕（hidden `teacherProfileId`）。**沒有 reject 按鈕、沒有 reason 輸入、沒有二次確認 UI。**

### 2.4 Teacher 顯示 — dashboard 與 join

- `src/app/teacher/dashboard/page.tsx`：`statusCopy.rejected` 已有標題「你的老師申請可修正後重新送出」與 body「請依平台提供的修正方向調整內容」，但**沒有 render 任何實際 reason**（因為資料層根本沒有）。
- `src/app/teachers/join/page.tsx`：`isRejectedProfile` 分支已存在，多處文案提到「依平台提供的修正方向」「退回說明」，同樣**沒有實際 reason 來源**；hydration 來自 `getInitialTeacherProfileApplicationSnapshotAction()`（不含 reason 欄位）。

### 2.5 Smoke tests — `tests/smoke/`

- `admin-teachers.spec.ts`：驗證非 admin → 404；admin 可 approve；**斷言 `draft/rejected/suspended` 在 queue 中隱藏**（`getByText(...).toBeHidden()`）。→ 新 reject 功能**必須維持** rejected 不出現在 submitted queue。approve 後也驗證 teacher join 顯示「已通過審核」。
- `teacher-dashboard.spec.ts`：對五種 status 逐一驗證標題/action label；`rejected` 標題為「你的老師申請可修正後重新送出」、action label「修正並重新送審」。→ 若 Teacher display slice 改動 rejected 卡片，需同步維持或更新這些斷言。
- `admin-teachers.spec.ts` 的 seed helper `createTeacherProfileWithSession` 直接以 Prisma 建 profile，未寫 reason 欄位；若採「reject 一定要有 reason」的資料不變式，需注意 seed 資料可能是 `rejected` 但 reason 為 null（僅測試資料，不違反 runtime 寫入路徑）。
- `teacher-join.spec.ts` **已存在**（非新增）；本 feature 若要為 join 頁的 reason 顯示補測試，是**修改既有檔**。
- **測試工具現況（重要）**：`package.json` 只有 `test:smoke`（`playwright test`，`pretest:smoke` 先 `next build`），**沒有安裝 Vitest**，且 repo 內目前 **沒有任何 `*.test.ts` unit test**——所有既有測試都是 Playwright smoke。因此「用 Vitest 寫 domain unit test」在現況下**不可執行**，除非改 `package.json` 引入 Vitest；而 `package.json` 是使用者已有本地修改、且本任務明訂**不可納入**的檔案。→ 見 D6：測試策略必須先決定「只用 Playwright smoke」或「另案引入 Vitest」。

### 2.6 權限與 session — `src/lib/auth/session.ts`

- `requireUser()` / `requireAdmin()` 已具備；`requireAdmin` 非 admin 丟 `"Admin access required"`。reject 路徑必須同樣先 `requireAdmin()`。

## 3. 方案比較：AdminNote model vs TeacherProfile 專用 rejection 欄位

本 feature 需要保存「rejection reason」，並且此原因**必須給 Teacher 看見**。這一點是兩案取捨的核心。

### 方案 A：沿用 `AdminNote` model（先把它從 docs 落地到 Prisma）

`docs/domain/data-model.md` 裡的 `AdminNote` 是 **polymorphic**（`entityType`, `entityId`, `adminUserId`, `note`, `createdAt`）。**這個原型不能直接拿來當 teacher-visible rejection reason**，原因有二，因此若 PO 選方案 A，必須採用下面「可實作變體」，不可照 docs 原型直接施作：

- Prisma **無法**用通用字串 `entityId` 對 `TeacherProfile` 建立真正的 relation / FK（Prisma relation 需要具體 FK 欄位）。所以 Slice 1「建立 TeacherProfile ↔ note 的 relation」在原型下不可能達成。
- `admin-review-workflow-spec.md` 明訂「Admin note 不應顯示給一般使用者」。用「該 profile 最新一筆 AdminNote」當 reason，會把**內部備註誤當成對外文字**外洩給 Teacher。

**方案 A 可實作變體（選 A 時的最小合規形狀）**：新增一個**帶真正 FK 的專用 review model**（例如 `TeacherApplicationReview`：`id, teacherProfileId (FK → TeacherProfile), reviewerUserId (FK → User), reason, createdAt`），或在 note model 上加**具體 `teacherProfileId` FK 欄位** + 一個 **visibility / `kind` discriminator**（例如 `kind = "rejection_reason"` 為 teacher-visible，其餘為 internal）。Teacher 端**只讀** teacher-visible 那類、且以明確查詢條件（該 profile、該 kind、最新一筆）取得，不得讀到 internal note。此變體同時要定義 D4 lifecycle（新增列 vs 覆蓋、approve/resubmit 時的處理）與 query 條件。

- 優點
  - 與 `docs/domain/data-model.md`、`docs/specs/admin-review-workflow-spec.md`（Data Requirements 已列 `AdminNote`）的既有設計方向一致。
  - 天生保留歷史（多筆列、可加 `createdAt` 排序），未來 suspend/其他 entity 也能重用。
- 風險 / 疑慮
  - **語意衝突（最關鍵）**：若沿用單一 note 表又要顯示給 Teacher，會破壞 AdminNote 既有「不對外」語意；必須靠上面的 visibility discriminator 明確隔離，否則極易外洩內部 note。
  - **需要真 FK + discriminator**：原型的 polymorphic `entityId` 不可用；落地時實質上會變成「帶 FK 與 visibility 的專用 model」，複雜度與 migration 面積高於方案 B。
  - **migration 較大**：新增 table + 對 `TeacherProfile`、`User` 的 relation + index + discriminator，rollback 面積較大。
  - 需額外決定「哪一筆、哪一類才是要顯示的 reason」（kind + 最新一筆 + query 條件），複雜度上升。

### 方案 B：`TeacherProfile` 專用 rejection 欄位（建議作為 MVP 起點）

作法：在 `TeacherProfile` 上加最小欄位，例如 `rejectionReason String?`（是否加 `reviewedAt` / `reviewedByUserId` 交由第 6 節決策）。reject 時寫入；Teacher 直接從自己的 profile snapshot 讀。

- 優點
  - **語意乾淨**：這是一個「面向 Teacher 的退回說明」欄位，與「內部 AdminNote」語意分離，不會混淆可見性規則。
  - **migration 最小**：對既有 table 加 nullable 欄位，既有列 backfill 為 null，rollback 只需 drop column。
  - 直接對齊既有 `teacherProfileDraftSelect` / snapshot 讀取路徑，Teacher 顯示 slice 幾乎零額外查詢。
  - 併發寫入可沿用 approve 的 `updateMany({ where:{ id, status:"submitted" }})` 模式。
- 風險 / 疑慮
  - **單欄位只保存「最新一次」reason**；重新送審或再次 reject 會覆蓋，**不保留歷史**。若產品要 audit trail，需另案（`TeacherApplicationReview` 之類），屬 V1 之外。
  - 若未來 suspend 也要 reason，不能直接重用此欄位（但那本就在本輪 Non-goals）。
  - 需決定 reason 在 `approve` / `rejected → submitted` 時是否清空（見第 6 節），避免「已通過的老師仍殘留舊退回說明」被誤顯示。

### Migration impact 摘要

| 面向 | 方案 A AdminNote | 方案 B 專用欄位 |
|---|---|---|
| Schema 變更 | 新 review model + FK relation(TeacherProfile, User) + index + visibility/`kind` discriminator | `TeacherProfile` 加 1 個 nullable 欄位（視決策再加 1~2 個 review 追蹤欄位） |
| 既有資料 backfill | 不需（新表為空） | 既有列自動 null，不需資料轉換 |
| Rollback | drop table + relation | drop column（若加多欄則多 drop 幾個） |
| 對現有 query 影響 | 需新增 join / 額外查詢 | 併入既有 select，無新查詢 |
| 是否偏離既有 docs | 較貼近 data-model.md，但踩到 AdminNote 可見性語意 | 需在 data-model.md 補一個新欄位定義 |

### 初步建議（待 PO 確認，不自動採用）

以 V1「最小、可 rollback、語意清楚」為原則，**建議方案 B（TeacherProfile 專用欄位）**，理由是可見性語意乾淨、migration 最小、直接對齊既有讀取路徑；歷史/audit 需求留待未來另案。此建議**必須**經第 6 節 D1 決策確認後才成立；在此之前兩案並列。

## 4. 目標狀態機（不新增狀態，只補一條寫入路徑）

沿用 `docs/domain/state-machines.md` / `state-transition-details.md` 既有定義，本輪把「已文件化但未實作」的 `submitted → rejected` **狀態轉換與 reason 保存** 落地為程式碼：

```
submitted → rejected      (Actor: Admin，前置：profile 不符合要求，後置：保存 reason；rejected 不公開、不可回應 demand)
rejected  → submitted      (Actor: Teacher，已存在，僅需驗證與 reason 生命週期相容)
```

不允許的 reject 來源：`draft / approved / rejected / suspended → rejected` 一律拒絕（對齊 approve transition 的防呆風格，各自回傳專屬 error code）。

**與 source-of-truth 文件的已知落差（notification）**：`state-transition-details.md` 把「通知 Teacher 修正方向」列為 `submitted → rejected` 的**後置效果**，`AGENTS.md` 也把 Email notification 列入 V1。本輪依任務硬性限制**不做 notification / email**，因此本輪只**部分**落地該 transition：以「Teacher 在 dashboard / join 頁看見 reason」作為 V1 的**站內告知**，取代 email 通知。這是一個需要明確承認、而非默默留下的落差：

- Slice 0 的 docs 更新**必須**在 `state-transition-details.md` 標註「V1 先以站內 reason 顯示告知 Teacher；email notification 為後續切片」，避免 runtime 行為與文件無聲漂移。
- Email/notification 列為**具體後續切片**（見第 8 節 Non-goals 的 follow-up），並於第 6 節 D7 記錄為需 PO 確認的 core-flow 分期決策。
- 本文件不再宣稱「完整落地既有狀態機」，只宣稱落地「狀態轉換 + reason 保存 + 站內告知」。

## 5. 實作切片（micro slices，可獨立 review）

> 每個 slice 都是 **micro slice**（高風險邊界），一次只碰一個邊界，可單獨 review、單獨 rollback。
> Slice 3–7 皆以第 6 節決策已拍板為前提；未拍板前不得施工。
> 各 slice 的「allowed files」為白名單，**未列出的檔案一律 forbidden**。

### Slice 0（docs / data model）— 更新設計文件

- 目的：先把「reject + reason」的資料模型、狀態、可見性寫進 Chinese docs，作為後續 slice 的 source of truth。
- Slice type：micro（docs-only，但屬 state machine / data model 文件，需嚴謹）。
- Allowed files（依 D1 決策，只會動到其中相關者）：
  - `docs/domain/data-model.md`（新增 rejection 欄位或 AdminNote 落地說明）
  - `docs/domain/state-transition-details.md`（把 `submitted → rejected` 的前置/後置/reason 生命週期補明確）
  - `docs/specs/teacher-onboarding-spec.md` 與 `docs/specs/admin-review-workflow-spec.md`（補 reject reason 行為與可見性）
- Forbidden areas：`prisma/**`、`src/**`、`tests/**`、`package.json`、任何 config、`next.config.ts`、`playwright.config.ts`、`.env`。
- Acceptance criteria：文件清楚定義（a）reason 存哪、（b）誰可見、（c）reject/approve/resubmit 時 reason 生命週期、（d）reason 必填與長度界線；且與既有 docs 無矛盾（特別是 AdminNote 可見性）。
- Checks：人工閱讀；`git status --short` 只顯示上述 docs；不需跑測試。
- Security / RWD / brand review：確認退回文案符合品牌語氣（清楚、溫和、不羞辱）；不揭露內部審核細節給非必要角色。
- Stop conditions：若撰寫時發現 D1/D2/D3 尚未拍板 → 停止並回報，不猜測預設值。

### Slice 1（Prisma migration）— schema + migration only

- 目的：落地 D1 選定的資料結構（方案 A 或 B），只改 schema 與新增 migration，不動 runtime 邏輯。
- Slice type：micro（Prisma / migration，最高風險）。
- Allowed files：`prisma/schema.prisma`、`prisma/migrations/<new_timestamp>_<desc>/migration.sql`（例如 `add_teacher_profile_rejection_reason`）、必要時 `prisma/migrations/migration_lock.toml`。
- Forbidden areas：`src/**`、`tests/**`、`docs/**`（Slice 0 已處理）、`package.json`、所有 config、`next.config.ts`、`playwright.config.ts`、`.env`（不得讀取）。
- Acceptance criteria：schema 反映 D1；migration 為 additive（nullable / 新表），不破壞既有資料；`prisma generate` 型別可用；migration 命名符合既有慣例。
- **方案 A 專屬約束**：若 D1 選方案 A，**不得**照 `data-model.md` 的 polymorphic `AdminNote(entityType, entityId)` 原型施作（Prisma 無法用通用 `entityId` 建立對 `TeacherProfile` 的 FK relation，且會有內部 note 外洩風險）。必須採第 3 節「方案 A 可實作變體」：帶真正 `teacherProfileId` FK 的專用 review model（或加 FK 欄位 + visibility/`kind` discriminator），schema 需明確定義該 FK relation、index 與 discriminator，並定義 teacher-visible 的 query 條件（該 profile、該 kind、最新一筆）。並在 Slice 2 以 **`prisma.$transaction`** 同時寫「status → rejected」與「建立 review 列」，避免兩筆寫入其一失敗造成「已 rejected 但無 reason」或「孤立列」的不一致。方案 B 為單列 update，天生原子，不需 transaction。
- Checks：`npx prisma validate`；`npx prisma migrate diff` 或 dry-run（不對 production DB 施作）；TypeScript build 不因型別缺失而壞。**不得對正式資料庫執行不可逆操作。**
- Security / RWD / brand review：安全審查（資料模型變更觸發 `docs/domain/permissions.md` 的 Security Review Required）；RWD/brand 不適用。
- Rollback：drop 新欄位 / 新表；刪除該 migration 資料夾（需在未套用到共享環境前）。
- Stop conditions：D1 未拍板、或發現需要 non-additive 變更（例如要改既有欄位 NOT NULL）→ 停止回報。

### Slice 2（domain / state rule）— reject transition + service

- 目的：新增 `submitted → rejected` 的 domain rule 與 service，含 reason 寫入與 admin 權限檢查，對齊 approve 的併發安全模式。
- Slice type：micro（state machine + core user flow）。
- Allowed files：
  - `src/domain/teacher-profile/state.ts`（新增 `validateTeacherProfileRejectTransition` 與對應 error code type）
  - `src/domain/teacher-profile/service.ts`（新增 `rejectSubmittedTeacherProfileApplication`；視 D4 決定是否在 approve / resubmit 清空 reason；視 D1 調整 select 讓 snapshot 帶出 reason）
  - 視 D3（reason 必填/長度）是否需要 `src/domain/teacher-profile/validation.ts` 新增 reason 驗證
- Forbidden areas：`prisma/**`、`src/app/**`（UI 在 Slice 3–4）、`tests/**`、config、`next.config.ts`、`playwright.config.ts`、`.env`。
- Acceptance criteria：
  - 只有 `submitted` 可被 reject；其餘來源回傳專屬 error code。
  - reject 使用 `updateMany({ where:{ id, status:"submitted" }})` 併發安全模式，`count === 0` 時回頭判斷 not-found / not-submitted。**方案 A 時**：status 更新與 review 列建立須包在同一個 `prisma.$transaction`，且以 `updateMany` 的 `count` 作為 transaction 內的 guard，`count === 0` 即 rollback（不建立孤立列）；Teacher 端讀取須以 visibility/`kind` 過濾，不得讀到 internal note。
  - `requireAdmin()` 先行；非 admin 得到 `admin_permission_required`。
  - reason 依 D3 驗證（必填？trim？長度上限？）。
  - 依 D4 正確處理 approve / resubmit 時 reason 是否清空。
- Checks：`tsc` / ESLint 通過。**行為驗證**依 D6 決定的測試策略（現況 repo 無 Vitest、無任何 unit test，只有 Playwright smoke）：
  - 若 D6 = 「只用 Playwright smoke」：本 slice 不含測試，reject 的 transition / reason 驗證行為由 Slice 5 的 admin smoke 端到端覆蓋（transition 分支的錯誤路徑亦透過 smoke 觸發 admin action 驗證）。
  - 若 D6 = 「另案引入 Vitest」：引入 Vitest 屬**獨立前置 slice**（會改 `package.json` / 新增 config，本任務範圍外、且 `package.json` 不可納入），需先由 PO 核准並單獨施作；核准後才在該前置 slice 的 allowed files 內加 `*.test.ts` 與工具設定。**不得**在本 feature 的任何 slice 內偷改 `package.json`。
- Security / RWD / brand review：權限檢查為安全重點；reason 訊息語氣溫和。
- Rollback：還原 state.ts / service.ts；移除新 export。
- Stop conditions：D1/D3/D4/D6 未拍板 → 停止。

### Slice 3（Admin UI / action）— reject 按鈕 + reason 輸入 + server action

- 目的：讓 Admin 在 `/admin/teachers` 每張 submitted 卡片能輸入 reason 並 reject，含二次確認。
- Slice type：micro（core user flow，含 server action 權限）。
- **二次確認的實作方式（重要）**：`src/app/admin/teachers/page.tsx` 目前是 **Server Component**（`export default async function`，無 `"use client"`），approve 是純 `<form action={serverAction}>`。reject 需要「輸入 reason + 二次確認」，有兩條可行路線，須在施工前於 prompt 明確擇一：
  - **(路線 1，建議) 無 JavaScript 的原生 disclosure**：用 `<details>`/`<summary>` 或雙欄位 confirm（例如需勾一個 `confirm` checkbox 且 reason 非空，`required` 屬性做前端擋）包住 reject `<form>`，維持 Server Component、不新增 Client Component；後端 service 仍為權威驗證。allowed files 維持只有 `actions.ts` + `page.tsx`。
  - **(路線 2) 新增小型 Client Component** 做 confirm dialog：此時**必須**把新的 `src/app/admin/teachers/*.tsx`（Client Component）加入本 slice 的 allowed files 白名單，並標明 `"use client"` 範圍僅限該元件。
- Allowed files：
  - `src/app/admin/teachers/actions.ts`（新增 `rejectTeacherProfileApplicationAction`，`requireAdmin()`、讀 `teacherProfileId` 與 `rejectionReason`、呼叫 service、`revalidatePath`、`redirect` 帶 result/message）
  - `src/app/admin/teachers/page.tsx`（每張卡片加 reject `form`：reason `textarea` + hidden id + 二次確認；沿用既有 feedback banner 樣式）
  - （僅路線 2 需要）新增的 admin reject confirm Client Component 檔案
- Forbidden areas：`src/domain/**`（Slice 2 已完成）、`prisma/**`、`tests/**`、其他 route、config、`next.config.ts`、`playwright.config.ts`、`.env`。
- Acceptance criteria：
  - Admin 可對 submitted 老師輸入 reason 並 reject；成功後該卡片離開 submitted queue（維持既有「rejected 不顯示」行為）。
  - reject 是 negative action → 需二次確認（對齊 `admin-review-workflow-spec.md`「每個 destructive/negative action 需確認」）。
  - reason 依 D3 前端驗證（必填時空白不可送出）；後端仍為權威驗證。
  - 錯誤（權限、not submitted、缺 reason）以既有 error banner 呈現，訊息透過 `encodeURIComponent`，不把 reason 放進可被索引的 URL 之外的敏感位置。
- Checks：手動走查 + 由 Slice 5 的 admin smoke 覆蓋；`tsc` / ESLint / build 通過。
- Security / RWD / brand review：
  - Security：server action 必 `requireAdmin()`；非 admin 走 approve action 相同的 redirect-to-error 模式。
  - RWD：reject 表單在 360/390px 可用，reason textarea 與確認鈕不擁擠、不誤觸（admin 需求至少 tablet/desktop，但沿用既有 mobile-first 樣式）。
  - Brand：按鈕與確認文案清楚、溫和、不製造焦慮。
- Rollback：移除 reject form 與 action，回到只有 approve 的頁面。
- Stop conditions：Slice 2 未合入、或 D3 未拍板 → 停止。

### Slice 4（Teacher display）— 在 dashboard / join 顯示 reason

- 目的：把實際 rejection reason 顯示給被退回的老師，讓現有「依退回說明修正」文案有真實內容。
- Slice type：micro（core user flow 的對外顯示）。
- Allowed files：
  - `src/app/teacher/dashboard/page.tsx`（`rejected` 卡片顯示 reason；無 reason 時的 fallback）
  - `src/app/teachers/join/page.tsx`（`isRejectedProfile` 區塊顯示 reason）
  - 視 D1，若 snapshot 需帶 reason：確認 Slice 2 已在 service snapshot select 補上（本 slice 不改 domain；若未補則退回 Slice 2）
- Forbidden areas：`src/domain/**`、`prisma/**`、`src/app/admin/**`、`tests/**`、config、`next.config.ts`、`playwright.config.ts`、`.env`。
- Acceptance criteria：
  - `rejected` 老師在 dashboard 與 join 能看到 Admin 填寫的 reason 原文（或 D2 決定的呈現方式）。
  - reason 為空時有溫和 fallback（例如「平台尚未提供具體說明」），不顯示空白區塊或壞版。
  - 重新送審流程不受影響（`rejected → submitted` 仍可走）。
- Checks：由 Slice 5 的 dashboard smoke 覆蓋；`tsc` / ESLint / build。
- Security / RWD / brand review：
  - Security：只顯示自己的 reason（沿用 `getOwnTeacherProfileApplicationSnapshot`，不跨使用者）；不外洩其他人的內部資料。
  - RWD：長 reason 在 360/390px 不造成水平溢出（對齊 dashboard smoke 既有 overflow 斷言）。
  - Brand：退回說明呈現溫和、具體、不羞辱。
- Rollback：移除 reason 顯示區塊，回到純文案。
- Stop conditions：Slice 2 的 snapshot 尚未帶 reason、或 D2 未拍板 → 停止。

### Slice 5（tests）— Playwright smoke（V1 預設）

- 目的：為 reject 路徑補齊自動化測試，並確保既有斷言不回歸。
- Slice type：micro（測試，但涉及 core flow 驗證）。
- **前提**：此 slice 依 **D6** 的測試策略。現況 repo **無 Vitest、無任何 unit test**，只有 Playwright smoke，因此**預設用 Playwright smoke 端到端驗證**；下列 allowed files 均為**修改既有檔**（三個 smoke spec 都已存在），非新增。若 D6 另案引入 Vitest，domain unit test 屬那個獨立前置 slice，不在本 slice。
- Allowed files（皆為既有檔）：
  - `tests/smoke/admin-teachers.spec.ts`（新增案例：admin 可 reject 並填 reason；reject 後該 profile 離開 submitted queue；**非 admin 不可 reject**）
  - `tests/smoke/teacher-dashboard.spec.ts`（新增/更新：rejected 老師在 dashboard 看得到 reason；長 reason 無水平溢出）
  - `tests/smoke/teacher-join.spec.ts`（**既有檔，修改**：rejected 老師在 join 頁看得到 reason）
- Forbidden areas：`src/**`、`prisma/**`、`package.json`、所有 config、`next.config.ts`、`playwright.config.ts`、`.env`。
- Acceptance criteria：
  - 涵蓋：`submitted → rejected` 成功並保存 reason、非 `submitted` 來源被擋、**非 admin 被擋**、reason 必填（若 D3=必填則空白不可送出）、Teacher 在 dashboard 與 join 都看得到 reason、rejected 不出現在 submitted queue。
  - **reason 生命週期（D4）必須有對應 smoke 覆蓋**：resubmit 後 reason 是否清除、approve 後 reason 是否清除、再次 reject 覆蓋／保留——每一條 D4 裁定都要有一條斷言驗證，避免核心資料生命週期實作錯誤卻無測試發現。
  - 既有 admin/dashboard/join smoke 斷言維持綠燈或被有意識地更新（更新須在 review packet 說明原因）。
- Checks：`npm run test:smoke`（Playwright，含 `next build`）通過；`tsc` / ESLint。
- Security / RWD / brand review：測試需含一條「非 admin 不可 reject」的權限案例；含一條長 reason 的 RWD 溢出案例（對齊 dashboard smoke 既有 overflow 斷言）。
- Rollback：移除新增案例；還原被修改的既有斷言。
- Stop conditions：D6 未拍板 → 停止（無法決定測試放哪、用什麼工具）。Slice 2–4 尚未全部合入 → 只寫已具備對象的案例，其餘標記 pending 並回報。

### Slice 順序與相依

```
Slice 0 (docs) → Slice 1 (migration) → Slice 2 (domain) → Slice 3 (admin UI) 與 Slice 4 (teacher display) → Slice 5 (tests)
```

Slice 3 與 4 都相依 Slice 2；彼此可平行，但建議各自獨立 PR/review。Slice 5（Playwright smoke）建議最後。domain 行為的驗證依 D6：預設由 Slice 5 的 smoke 端到端覆蓋；若 D6 另案引入 Vitest，該工具引入為獨立前置 slice，不併入本 feature 任何 slice。

## 6. 需要產品主人決定的事項（Gate）

**下列決策未全部拍板前，不得產出可直接執行的 Builder implementation prompt。** 這些決策改變 data model / core flow / 對外可見性，依 AGENTS.md 需 product owner 確認。

- **D1 — 儲存模型**：採「方案 B：`TeacherProfile.rejectionReason` 專用欄位」或「方案 A：落地 `AdminNote` model」？（計畫初步建議 B，理由見第 3 節；需 PO 拍板。）此決策決定 Slice 1 的 schema 形狀。
- **D2 — reason 對 Teacher 的可見性與呈現**：是否把 Admin 填寫的 reason **原文**顯示給 Teacher？或需要「面向老師的說明」與「內部備註」分離？（若選 A 又要顯示，會踩到 AdminNote「不顯示給一般使用者」的既有語意，須明確裁定。）
- **D3 — reason 是否必填、長度與格式界線**：reject 時 reason 是否**必填**？最小/最大長度？是否允許純空白？（影響 validation 與 admin 前後端。）
- **D4 — reason 生命週期**：
  - Teacher `rejected → submitted` 重新送審時，是否清空舊 reason？
  - Admin `approve` 時是否清空 reason（避免已通過老師殘留退回說明）？
  - 再次 reject 時覆蓋舊 reason（單欄位）或保留歷史（需方案 A 或新表）？
- **D5 — 是否記錄審核人 / 時間**：是否需要 `reviewedByUserId` / `reviewedAt`（誰在何時 reject）？此為最小 audit 資訊，會擴大 Slice 1 schema；若 V1 不需要，明確排除。
- **D6 — 測試策略**：本 feature 的行為驗證是「**只用既有 Playwright smoke**」（符合 repo 現況：無 Vitest、無任何 unit test），或「**另案先引入 Vitest**」再寫 domain unit test？後者會改 `package.json` 並新增 config（本任務範圍外、且 `package.json` 不可納入），須先由 PO 核准並單獨施作。此決策決定 Slice 2 的行為驗證放哪、以及 Slice 5 的範圍。
- **D7 — notification 分期**：確認本輪**不做** email/notification、改以「站內 reason 顯示」作為 V1 對 Teacher 的告知，並同意把 email notification 列為**後續切片**、由 Slice 0 在 `state-transition-details.md` 標註分期（見第 4 節、第 8 節）。此為 core-flow 分期決策，須 PO 明確確認以免 runtime 與文件漂移。

> 建議以 `docs/harness/ai-runs-current-templates/06-human-decision-record.md`（human decision record）形式記錄 D1–D7 的裁定，再進入 Slice 1 施工。

### 6.1 決策記錄（Human Decision Record — 2026-07-21 產品主人確認）

以下 D1–D7 已由產品主人確認，**Builder 以此為準**；未被此記錄覆蓋的細節仍回到各 slice 的 acceptance criteria。

| # | 裁定 | 對施工的影響 |
|---|---|---|
| D1 | **方案 B**：在 `TeacherProfile` 新增 `rejectionReason String?`（**不採**方案 A） | Slice 1 只加此 nullable 欄位；第 3 節方案 A 與其「可實作變體」降為**參考 / 未採用**，Builder 不實作 AdminNote / review model / discriminator |
| D2 | reason 為 **teacher-facing**，原文顯示給該老師；本輪**不**建立內部 admin note | Slice 3 admin 輸入框旁須標明「此說明會顯示給老師」；Slice 4 顯示原文；無 internal/visible 分流需求 |
| D3 | reason **必填**：以 `normalizedReason = input.trim()` 為單一基準——server-side **驗證且持久化** `normalizedReason`（非空、長度以 trim 後計算、**最少 10 字、最多 1000 字**），不得驗證 trim 後值卻寫入原始未 trim 值。前端 `required` + **`minLength={10}`** + **`maxLength={1000}`** 先擋（與後端同界線）；後端為權威驗證 | Slice 2 validation 以 trim 後值驗證**並寫入** DB；Slice 3 前端須同時含 min/max，與後端界線一致 |
| D4 | 生命週期（單欄位、只留最新、不保留歷史）：`rejected` 期間**保留**（供老師邊看邊改）；於 `rejected → submitted` transition **清空**；`approve` **清空**；再次 reject **覆蓋** | Slice 2：submit transition 與 approve 路徑都要把 `rejectionReason` 設為 null；reject 直接覆寫。注意 approve 現行 `updateMany` 需一併 `rejectionReason: null` |
| D5 | V1 **不新增** `reviewedByUserId` / `reviewedAt`（以 `TeacherProfile.updatedAt` 作粗略時間） | Slice 1 schema 不含審核人 / 時間欄位；未來要問責再另案追加 |
| D6 | 測試策略 = **只用既有 Playwright smoke**；**不**引入 Vitest、**不**動 `package.json` | Slice 2 行為驗證交由 Slice 5 smoke 端到端覆蓋；無 unit-test slice；三個 smoke spec 皆為既有檔修改 |
| D7 | **確認延後** email/notification，本輪以站內 reason 顯示作為對老師的告知；email 列為後續切片 `teacher-application-rejection-notification` | Slice 0 須在 `state-transition-details.md` 標註「V1 先以站內顯示告知、email 為後續切片」 |

**Gate 狀態**：D1–D7 已拍板 → High-risk Planning Gate 解除，可進入施工；但**仍須逐 slice 進行**（Slice 0 → 1 → 2 → 3/4 → 5），每 slice 各自 review、各自可 rollback，Prisma migration（Slice 1）維持 additive。本記錄不改變 commit / push gate：仍不得在未經產品主人明確要求下 commit 或 push。

**參數可調**：D3 的 10 / 1000 字為建議界線，如需調整由產品主人指定即可，不影響其餘決策。

## 7. Quality gates（對齊 AGENTS.md）

各實作 slice 合入前需確認（依該 slice 相關項）：TypeScript passes、ESLint passes、Build passes、變更邏輯的 unit tests pass、關鍵 flow 的 E2E smoke pass、Role permissions reviewed（reject 為 admin-only）、Marketplace state transitions reviewed（新增 `submitted → rejected`）、Brand consistency reviewed（退回文案）、RWD/mobile reviewed（admin reject 表單、teacher reason 顯示）、App-readiness boundary 不被破壞。

## 8. Non-goals（本輪明確不做）

- 不做 suspend / restore（`approved → suspended`、`suspended → approved`）任何 UI/API。
- 不做 notification / email（reject 通知、Resend 整合）——`state-transition-details.md` 把「通知 Teacher」列為 `submitted → rejected` 後置效果，本輪以「站內 reason 顯示」替代，email 通知**列為後續切片**（follow-up：`teacher-application-rejection-notification`），並由 Slice 0 在 `state-transition-details.md` 標註分期、由 D7 記錄 PO 確認。本輪不實作 email。
- 不碰其他 marketplace domain（DemandRequest / DemandResponse / ClassSession / Enrollment / Organization）。
- 不新增 edit-after-submit（`submitted` 老師直接改核心欄位）。
- 不新增重送次數限制、counter 或 lockout（維持 `state-transition-details.md`：V1 不限制重送次數）。
- 不建大型 audit log / 多層 admin role / RBAC。
- 不改 `next.config.ts`、`package.json`、`playwright.config.ts`（使用者已有本地修改，須保留且不納入本任務）。
- 不讀取 `.env`；不 commit、不 push。

## 9. Rollback considerations

- **Slice 1（migration）最關鍵**：務必為 additive（nullable 欄位 / 新表），使既有資料無需轉換、rollback 只需 drop column/table。避免任何 non-additive（改 NOT NULL、改型別）操作；若不得不，須升級為獨立 decision 並回報。禁止對共享/正式 DB 施作不可逆操作。
- **依相依反序 rollback**：Slice 5 → 4 → 3 → 2 → 1 → 0。UI/service（2–4）為純程式碼，還原 import/export 與檔案即可。
- **資料殘留**：若已寫入 reason 後決定回退欄位，drop column 會遺失 reason；回退前確認無正式資料依賴。
- **文件同步**：若回退 schema，需同步回退 Slice 0 的 docs，避免 docs 與程式碼漂移（AGENTS.md：架構變更需同步更新 Chinese docs）。
- **既有測試**：Slice 5 若更新了既有 admin/dashboard smoke 斷言，rollback 時一併還原，確保回到原綠燈狀態。

## 10. 自我檢查（planning-only self review）

- 變更檔案：僅新增本檔 `docs/superpowers/plans/2026-07-21-teacher-application-rejection-plan.md`。
- V1 scope：符合；只補齊已文件化的 `submitted → rejected` 與 reason，未擴張 Wellness/Academy/Retreat、AI 審核、payment、native app。
- 一致性：對齊既有 role model、permissions、state machines、data model、route map（`/admin/teachers`、`/teacher/dashboard`、`/teachers/join`）。
- 安全 / RWD / brand：已於各 slice 標註；reject 為 admin-only，reason 顯示限本人，文案需溫和。
- 產品主人決策：D1–D5 為必要 gate，未定前不得產出 Builder prompt。
- 未修改無關檔案；未 commit / 未 push；未讀 `.env`；未動 `next.config.ts` / `package.json` / `playwright.config.ts`。

<!-- codex-peer-reviewed: 2026-07-20T20:12:27Z rounds=5 verdict=approved -->
