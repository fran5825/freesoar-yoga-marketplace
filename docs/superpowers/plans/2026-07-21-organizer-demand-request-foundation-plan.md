# Organizer Demand Request Foundation — Implementation Plan

> 狀態：**planning-only**。本輪只產出可逐 slice 執行的規劃，不實作任何 schema / 程式 / 測試。
> 目標 user flow：登入使用者建立 `OrganizerProfile` + `Organization` → 建立並保存 `DemandRequest` draft → 補齊必填後 submit → Admin 查看 submitted demand → Admin publish 或 reject → 只有 `published` demand 未來才進入 approved teacher demand pool（demand pool 本身**不在**本輪 scope）。
> 本文件為 **High-risk Planning Gate** 產物（觸及 Prisma schema / migration / capability model / state machine / core user flow）。**D1–D15 已由產品主人於 2026-07-21 拍板（見第 5.1 節決策記錄），Gate 已解除**，可依第 6 節逐 slice 施工；但本檔仍為 planning 文件本身，不含實作。施工前 Builder 仍須自行核對 repo 現況（第 2 節）與第 4 節的 teacher-rejection 依賴分析。

---

## 0. 如何閱讀本 plan（給零背景 Builder）

- 本 plan 目標是自足：Builder 只需讀「本檔 + 目前 repo」即可施工，不需要本次規劃對話的任何記憶。
- 每個宣稱「repo 現況如何」的敘述，都以第 2 節「現況核對」的 primary source 為準；Builder 施工前**必須自行再核對一次實際檔案**，不接受任何文件敘述為既定事實（AGENTS.md / mvp-slicing 精神）。
- 「allowed files」是**白名單**：未列出的檔案一律 forbidden。
- 任何 slice 若在施工時發現其依賴的 D 決策尚未拍板，**必須停止並回報**，不得猜測預設值。

---

## 1. 背景與範圍

### 1.1 產品問題

團主（Organizer）需要一個清楚、被引導、低壓力的方式提出「幫一群人安排瑜伽團課」的需求，並讓平台先 review 再公開，避免未審核需求直接進入 marketplace 造成品質/安全風險。本輪建立這條路徑的**最小基礎**：capability 建立、demand draft/submit、admin publish/reject，以及「只有 published 才可被未來 teacher pool 取用」的資料前提。

### 1.2 本輪 in-scope（僅到「foundation」）

1. 登入使用者自助建立 `OrganizerProfile` 與 `Organization`（capability bootstrap）。
2. `DemandRequest` 的 draft / save / submit（organizer 自己的資料）。
3. Admin 檢視 submitted demand，執行 `publish` 或 `reject`（含 organizer-facing reject reason）。
4. Organizer 檢視自己 demand 的 status list 與 detail。
5. 資料模型上保證「`published` 才是未來可被 approved teacher 看見的狀態」（僅資料/狀態前提，不建 teacher-facing 查詢）。

### 1.3 本輪明確不做（詳見第 9 節 Non-goals）

Teacher demand pool 查詢、`DemandResponse` / teacher matching、`ClassSession`、`Enrollment`、payment/refund、AI matching、Google Calendar sync、email/notification（除非 PO 另行批准）、enterprise organization hierarchy、Wellness/Academy/Retreat、native app。

### 1.4 風險等級

依 `docs/harness/risk-based-workflow.md` 與 `docs/harness/mvp-slicing.md`，本 feature 觸及 **Prisma schema / migration / capability(permission) model / state machine / core user flows**，屬 **High-risk / Heavy**，且需先 Planning-only。Risk flags：`PRISMA_RISK`、`MIGRATION_RISK`、`PERMISSION_RISK`、`STATE_MACHINE_RISK`、`SCOPE_DRIFT_RISK`、`BRAND_RISK`、`LOW_PRESSURE_UX_RISK`。（無 `PAYMENT_RISK` / `ENV_SECRET_RISK` / `PACKAGE_RISK`——本輪不碰 payment、不讀 `.env`、不動 `package.json`。）

---

## 2. 現況核對（primary sources，2026-07-21 working tree）

> 以下皆以實際 repo 檔案為準。Builder 施工前須自行重新核對。

### 2.1 Committed baseline vs Teacher rejection in-progress vs 本 plan 未來範圍

三者必須分清楚：

| 類別 | 內容 | 對本 plan 的意義 |
|---|---|---|
| **Committed baseline（HEAD）** | `prisma/schema.prisma` 已含 `OrganizerProfile`、`Organization`、`OrganizationType` enum、`TeacherProfile`、Auth models。`src/domain/teacher-profile/*`、`src/app/admin/teachers/*`、`src/app/teacher/*`、`src/app/teachers/join/*`、`src/lib/auth/session.ts`、三個 `tests/smoke/*.spec.ts`。 | 本 plan 的 repo 現況基準與 pattern 來源。 |
| **Teacher rejection in-progress（uncommitted）** | `git status` 顯示：`M prisma/schema.prisma`（唯一差異＝`TeacherProfile` 新增 `rejectionReason String?`）、`M docs/domain/data-model.md`、`M docs/domain/state-transition-details.md`、`M docs/specs/admin-review-workflow-spec.md`、`M docs/specs/teacher-onboarding-spec.md`、`M next.config.ts`、`M package.json`、`M playwright.config.ts`、untracked `prisma/migrations/20260721000000_add_teacher_profile_rejection_reason/`。規劃文件見 `docs/superpowers/plans/2026-07-21-teacher-application-rejection-plan.md`。 | **本 plan 不得修改、覆蓋、格式化或吸收上述任何變更。** 見第 4 節依賴/衝突分析。 |
| **本 plan 未來範圍** | 新增 `DemandRequest`（+ `DemandRequestStatus` enum）、視決策擴充 `Organization` / `OrganizerProfile` / `ServiceType`；新增 `src/domain/organizer-profile/*`、`src/domain/demand-request/*`、`src/app/organizer/*`、`src/app/organizers/request/*`、`src/app/admin/demands/*`；新增對應 smoke specs；同步既有 docs。 | 逐 slice 執行，見第 6 節。 |

### 2.2 現有 `OrganizerProfile` / `Organization`（`prisma/schema.prisma`，HEAD 已存在）

```prisma
model OrganizerProfile {
  id             String        @id @default(cuid())
  userId         String        @unique
  organizationId String?
  displayName    String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
}

model Organization {
  id          String             @id @default(cuid())
  name        String
  type        OrganizationType
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  organizerProfiles OrganizerProfile[]
}

enum OrganizationType { company  company_club  community  family_group  other }
```

關鍵事實：

- `OrganizerProfile.userId` 是 `@unique`（`User.organizerProfile` 為 `?`）→ **schema 已強制「一 user 至多一個 OrganizerProfile」**。
- `OrganizerProfile.organizationId` 是**單一 nullable FK**（`organization Organization?`），`onDelete: SetNull` → schema 目前傾向「一 organizer profile 至多一個 organization」。
- `Organization.organizerProfiles` 是 `OrganizerProfile[]` → **一 organization 可對多個 organizer profile**（多對一：多 organizer → 同一 org 是可能的；但反向一 organizer→多 org 目前不行）。
- **`DemandRequest`、`ServiceType`、`DemandResponse`、`ClassSession`、`Enrollment`、`Notification`、`AdminNote`、`Review`、`PaymentIntent`、`TeacherAvailability`、`AvailabilityException` 這些 model 在 schema 中完全不存在**，僅存在於 `docs/domain/data-model.md` 設計稿。
- 目前 repo **沒有任何程式碼引用 `OrganizerProfile` / `Organization`**（無 `src/domain/organizer-profile`、無 `src/app/organizer`、smoke 也未涉及）。這兩個 model 目前是「有 schema、無 runtime」。

### 2.3 規格文件 vs 實際 schema 的差異（重要：drift 都在 committed baseline，非 teacher-rejection 造成）

| 主題 | `docs/domain/data-model.md` / `docs/product/form-field-spec.md` 敘述 | 實際 schema（HEAD） | 差異裁定歸屬 |
|---|---|---|---|
| `OrganizerProfile` 欄位 | data-model 列 `title`, `phone`（無 `displayName`） | 只有 `displayName`（required），無 `title` / `phone` | **D3**（reconcile） |
| `Organization` 欄位 | data-model 列 `area, address, contactName, contactEmail, contactPhone`；form-field-spec 要求 `contactName/contactEmail/contactPhone` 必填 | 只有 `name`, `type` | **D4**（contact fields 放哪） |
| `ServiceType` | 獨立 model（`id,name,description,category,isActive`）＋範例清單 | 不存在 | **D5** |
| `DemandRequest` | 完整欄位列表（含 `serviceTypeId`, `preferredTimeSlots`, `preferredAreas`, `frequency`, `targetLevel`, `budgetRange`, `preferredStartDate`, `classLengthMinutes`, `expectedParticipants` …） | 不存在 | **D6–D10** |
| `DemandRequest.serviceTypeId` | form-field-spec 用 `serviceTypeId`（隱含 FK 到 ServiceType model） | 無 model 可 FK | **D5**（若採受控字串，需把 `serviceTypeId` → `serviceType` 並在 Slice 0 對齊 form/model mapping） |
| Demand reject reason | admin-review-workflow-spec 說「reject 需填 reason」；organizer-demand-request-spec Acceptance 說「reject 並填寫 reason」 | 無 `DemandRequest.rejectionReason` 欄位（該欄不存在，因 model 不存在） | **D11** |
| Demand 狀態 | state-machines / state-transition-details 定義 `draft→submitted→under_review→published→…`；spec 也寫 `under_review` | 無 `DemandRequestStatus` enum | **D8, D9** |

→ 結論：**規格與 schema 有大量差異**，主因是 marketplace 後段 model 從未落地。Slice 0 的核心工作就是「依 D 決策把 docs 與即將落地的 schema 對齊」，避免施工後 docs 與 runtime 漂移。

### 2.4 Auth / session capability model（`src/lib/auth/session.ts`）

- 具備 `getCurrentUser()`（以 `auth()` 的 email 查 `User`，回 `{id,email,name,image,isAdmin}`）、`requireUser()`（未登入丟 `"Authentication required"`）、`requireAdmin()`（非 admin 丟 `"Admin access required"`）。
- **沒有 `requireOrganizer()` / organizer capability 判斷**。目前「是否為 organizer」在程式層無任何判斷點。
- Teacher capability 的既有做法（可類比）：`/teacher/dashboard` 只 `requireUser()` 就允許進入並建立/檢視自己的 `TeacherProfile`（onboarding），**未** gate 在「已是 teacher」；真正的 teacher-only 能力才另外檢查 `TeacherProfile.status`。→ organizer capability bootstrap 可沿用同一精神（見 D1）。
- `CurrentUser` 目前**不含** `organizerProfile`。若路由/服務需要 organizer 身分，需以 `currentUser.id` 另查 `OrganizerProfile`（不建議擴 `getCurrentUser` 的 select，除非多處需要——屬 D1/Slice 3 細節）。

### 2.5 可沿用的 domain / service / action / page / test pattern（來源：`src/domain/teacher-profile/*`、`src/app/**`、`tests/smoke/*`）

> **原則：沿用 pattern，不沿用 module。** 依任務硬性要求，**不得**把 `TeacherProfile` service 擴成混合 domain service，也不得 import teacher-profile 的 service/validation/state 到 organizer/demand domain。新建 `src/domain/organizer-profile/` 與 `src/domain/demand-request/`，各自獨立。

可沿用的 pattern（照抄結構、重寫內容）：

1. **domain 分層**：`input.ts`（form string → normalized input）、`validation.ts`（draft/submit 驗證，回 `{valid, errors[]}`）、`state.ts`（transition 驗證，回 discriminated union `{allowed, from, to, code?}`）、`service.ts`（權限 + Prisma + 組裝 result）。參考 `teacher-profile/validation.ts`、`state.ts`、`service.ts`。
2. **discriminated result union**：`{ ok: true, ... } | { ok: false, code, message, validationErrors? }`，`code` 是明確 union（如 `authentication_required` / `draft_validation_failed`）。
3. **own-resource 併發安全寫入**：見 `approveSubmittedTeacherProfileApplication`——`updateMany({ where:{ id, status:"submitted" }, data:{...} })`，用 `count === 0` 回頭查實際狀態判斷 not-found / not-eligible。Admin publish/reject 直接套此模式；organizer 自己的 draft update 套 `where:{ id, organizerProfile: { userId } }`（見第 3 節安全）。
4. **own-resource 綁定 userId**：見 `saveOwnTeacherProfileDraft` / `getOwnTeacherProfileApplicationSnapshot`——一律 `where:{ userId: currentUser.id }`，**從不信任 client 傳入的 profileId 來決定 own 資源**。
5. **server action**：見 `src/app/teachers/join/actions.ts`（`"use server"`，normalize → service，回序列化結果，`Date` → ISO string）與 `src/app/admin/teachers/actions.ts`（`requireAdmin()` catch → `redirect(...result=error)`；成功 `revalidatePath` + `redirect(...result=success&message=encodeURIComponent)`）。
6. **page**：Admin page 是 **Server Component**（`src/app/admin/teachers/page.tsx`：`requireAdmin()` 失敗 `notFound()`；用 `<form action={serverAction}>` + hidden id；feedback banner 讀 `searchParams.result/message`）。Teacher dashboard（`src/app/teacher/dashboard/page.tsx`）：`requireUser()` 失敗 `redirect("/sign-in")`，用 `statusCopy` record 呈現各 status 文案，含 `break-words` / `min-w-0` 等 RWD 細節。
7. **smoke test seeding**（`tests/smoke/admin-teachers.spec.ts`）：直接用 `new PrismaClient()` 建 `User` + `Session`（cookie `authjs.session-token`，domain `127.0.0.1`）+ 目標 profile；`afterAll` 依 email 清理；`isAdmin` 可控。這是本 feature smoke 的 seeding 樣板（需擴出 organizer/organization/demand 的 seed helper）。

### 2.6 測試工具現況（決定 Verification 策略）

- `package.json` scripts 只有 `dev/build/start/lint/pretest:smoke(=next build)/test:smoke(=playwright test)`。
- **repo 無 Vitest、無任何 `*.test.ts` unit test**，所有既有測試都是 Playwright smoke（`tests/smoke/*.spec.ts`）。
- `package.json` 是**使用者已有本地修改、且本任務明訂不可修改/納入**的檔案 → **本 feature 不得引入 Vitest、不得改 `package.json`**。行為驗證一律走既有 Playwright smoke（見第 8 節與 D13）。

### 2.7 Route 現況（`docs/product/route-map.md` 已定義，但實作未建）

route-map 已列 `/organizers/request`（public entry）、`/organizer/dashboard|profile|demands|demands/new|demands/[id]|classes`、`/admin/demands`；Route Guard 原則已寫「`/organizer/*` 必須只允許 Organizer 或 Admin」「`/admin/*` 只允許 Admin」。→ **routes 已文件化，但 `src/app/organizer/*`、`src/app/organizers/request/*`、`src/app/admin/demands/*` 皆尚未建立**。本 feature 負責落地其中 foundation 所需者。

---

## 3. 安全與權限設計（貫穿所有 slice）

所有權限**必須在 server/domain layer 檢查**，UI 隱藏只是體驗，不是安全依據（permissions-matrix.md 開宗明義）。以下為本 feature 的權威規則，Slice 3/4/5/6/7 必須逐條落實，Slice 8 必須逐條負向測試：

1. **Organizer 只能建立/讀取/編輯自己的 `OrganizerProfile` / `Organization` / `DemandRequest`。**
   - own OrganizerProfile：一律 `where:{ userId: currentUser.id }`，不接受 client 傳入 `organizerProfileId` 決定 own 對象。
   - own Organization：只能編輯「自己 OrganizerProfile 綁定的那個 organization」；服務端由 `currentUser.id → OrganizerProfile.organizationId` 解析，**不信任 client 傳入的 `organizationId`**。若 client 傳了 `organizationId`，只用於「驗證等於自己綁定的那個」，不得用於直接定位他人 org。
   - own DemandRequest：讀寫一律以 `where:{ id, organizerProfile: { userId: currentUser.id } }`（或先 server 端解析自己的 `organizerProfileId` 再 `where:{ id, organizerProfileId }`）過濾。**建立 demand 時 `organizerProfileId` 一律由 server 從 session 解析，不採用 client 傳入值。**
2. **不可藉由傳入 `organizerProfileId` / `organizationId` 修改他人資料。** 這是本 feature 最關鍵的 IDOR 面向：所有 mutation 的 ownership 條件都必須包含 `userId: currentUser.id`（直接或經 relation）。跨使用者嘗試必回 not-found / not-authorized（不得洩漏他人資源存在與否的細節差異）。
3. **draft / submitted / 未 published 的 demand，不可被 Teacher 或其他 Organizer 看見。**
   - 其他 Organizer：own 過濾天然阻擋。
   - Teacher / 一般 user：本輪**不建任何 teacher-facing demand 查詢**，故無讀取入口；但資料模型與（未來）查詢前提必須是「只有 `published` 才 eligible」。Slice 0 docs 與 Slice 4/7 的狀態語意要把這條寫死，避免未來 pool slice 誤讀非 published。
4. **只有 Admin 可以 `publish` / `reject`。** 服務端一律 `requireAdmin()` 先行；非 admin 走與 approve action 相同的 redirect-to-error / `notFound()` 模式。Admin demand 列表/детail 服務函式亦 `requireAdmin()`。
5. **Teacher demand pool 不在本輪 scope**；不得順手實作 teacher 端查詢或把 demand 曝露給 teacher。
6. **`/admin/*` 與 organizer own 資料存取**觸發 `docs/domain/permissions.md` 的 Security Review Required（Permissions / Demand visibility / Admin actions）→ 每個相關 slice 的 review 必含 security 檢查，Slice 8 集中補負向測試。

---

## 4. 與 Teacher rejection in-progress 的依賴 / 衝突分析（必讀）

Teacher application rejection 功能（見 `docs/superpowers/plans/2026-07-21-teacher-application-rejection-plan.md`，D1–D7 已由 PO 拍板）目前**仍在施工中**，其 uncommitted 變更與本 feature 有**實質檔案重疊**：

### 4.1 檔案級衝突點

| 檔案 | Teacher rejection 會改 | 本 feature 會改 | 衝突性質 |
|---|---|---|---|
| `prisma/schema.prisma` | 已加 `TeacherProfile.rejectionReason`（working tree 已在） | 新增 `DemandRequest` + enum、擴充 `Organization`/`OrganizerProfile`/`ServiceType` | **同檔**：若本 feature Slice 1 在 teacher-rejection 尚未 commit 前動 schema，兩者未 commit 變更混在同一 working tree，難以分辨、且可能被本 plan 規則禁止的「吸收他人變更」污染。 |
| `docs/domain/data-model.md` | teacher rejection reason 語意（已改） | 新增/修正 `DemandRequest`、`Organization`、`OrganizerProfile`、`ServiceType` 欄位定義 | **同檔不同段**：段落多半不同，但仍是同一檔並存未 commit 變更，容易誤 stage / 誤覆蓋。 |
| `docs/domain/state-transition-details.md` | teacher `submitted→rejected` reason lifecycle（已改） | 新增 `DemandRequest` transition 細節 | 同檔不同段。 |
| `docs/specs/admin-review-workflow-spec.md` | teacher reject reason 行為（已改） | demand publish/reject 行為與 reason | 同檔不同段。 |
| `next.config.ts` / `package.json` / `playwright.config.ts` | 使用者/teacher 既有本地修改 | **本 feature 完全不碰** | 無衝突（本 feature 禁止觸碰）。 |
| `prisma/migrations/**` | 已新增 `20260721000000_add_teacher_profile_rejection_reason/` | 本 feature 新增更晚 timestamp 的 create-only migration | **順序相依**：本 feature migration 必須排在 teacher-rejection migration **之後**（更大 timestamp），且應在其已被建立/套用後再生成，維持 migration 歷史線性。 |

### 4.2 明確建議（先後 / 平行）

- **強烈建議：先完成（至少先 commit）Teacher application rejection 的 schema + migration + docs 變更，再開始本 feature 的任何會碰 `prisma/schema.prisma` 或上述四份共用 docs 的 slice。** 理由：(a) 避免兩份未 commit 的 schema/docs 變更混在同一 working tree 被誤納入；(b) 保證 migration timestamp 線性；(c) 符合本 plan「不得吸收 teacher-rejection 變更」的硬限制——最乾淨的保證方式就是讓那批變更先落地成 committed baseline。
- **唯一可安全與 teacher-rejection 完全平行的工作，是「撰寫本 planning 文件」本身**（只新增 `docs/superpowers/plans/2026-07-21-organizer-demand-request-foundation-plan.md`，不碰任何 teacher-rejection 檔案）。本輪即是此工作。
- **本 feature 的 Slice 0（docs 對齊）不建議與 teacher-rejection 平行**：因為 Slice 0 要改的 `data-model.md` / `state-transition-details.md` / `admin-review-workflow-spec.md` 正是 teacher-rejection 尚未 commit 的檔案，平行編輯會造成 diff 交錯與誤覆蓋風險。→ Slice 0 應等 teacher-rejection 的 docs 變更 commit 後再開始。
- 若 PO 決定**必須**平行推進，退而求其次的安全邊界：本 feature 可先做「**完全不碰共用檔**」的預備工作——例如在**本 plan 內**細化 D 決策、或在 teacher-rejection 落地前只停留在 planning。但**不得**平行修改任何 §4.1 標為「同檔」的檔案。

### 4.3 語意依賴（可複用的決策先例）

Teacher rejection 已確立一組「reject + reason」慣例，本 feature 的 demand reject reason（D11）**建議對齊**以維持產品一致性，但仍是獨立欄位、獨立決策：

- 先例：`TeacherProfile.rejectionReason String?`，**面向使用者**（teacher-facing），與內部 `AdminNote` 語意分離；必填、`normalizedReason = input.trim()`、長度 10–1000、前端 `required`+`minLength`+`maxLength` 先擋、後端權威；lifecycle：reject 期間保留、resubmit/approve 清空、再次 reject 覆蓋（單欄位不留歷史）。
- 本 feature 對應：`DemandRequest.rejectionReason String?`（organizer-facing），細節見 D11；是否可 resubmit 見 D9。

---

## 5. 產品主人決策 Gate（D1–D15）

> **下列決策未全部拍板前，不得產出可直接執行的 Builder implementation prompt。** 這些決策改變 data model / capability / state machine / 對外可見性，依 AGENTS.md 屬 product owner confirmation 範圍。每項附選項、trade-off 與**推薦方案（待 PO 確認，不自動採用）**。建議以 human decision record 形式記錄裁定後再進 Slice 1。

### D1 — Organizer capability 如何建立（任何 signed-in user 是否可自助建立 OrganizerProfile？）

- **選項 A（推薦）**：任何 signed-in user 皆可自助建立 `OrganizerProfile` + `Organization`，比照 teacher onboarding（`/teacher/dashboard` 僅 `requireUser()` 即可建立 `TeacherProfile`）。`/organizer/*` 進入點以 `requireUser()` gate，「是否已是 organizer」由是否存在 `OrganizerProfile` 決定，未建立則導向建立流程。
  - 優點：與既有 capability 模型（permissions-matrix「Organizer 能力由 `OrganizerProfile` 開啟」）一致；無需 admin 介入即可 onboard；schema 的 `userId @unique` 天然限制一人一 profile。
  - 風險：任何人可建 organizer 身分——但本輪 organizer 能力僅止於「提需求、等 admin review」，未給任何跨使用者權限，風險低。
- **選項 B**：需 admin 指派或審核才成為 organizer。
  - 優點：品質控管更嚴。缺點：增加 admin flow、與 V1「最小」相悖、超出本輪 scope（會牽動 admin 指派 UI）。
- **推薦：A**。理由：對齊既有 teacher 自助 onboarding、最小、不新增 admin 負擔；organizer 建立的 demand 仍須 admin publish 才公開，品質閘門在 publish 而非 capability 建立。
- **與既有 docs 的衝突（必須在 Slice 0 明確 reconcile）**：若選 A，會與兩份既有 docs 抵觸——(i) `route-map.md` Route Guard 原則寫「`/organizer/*` 必須只允許 Organizer 或 Admin」；(ii) `permissions-matrix.md` 的 `Create organizer profile` 對 Member = No、僅 Organizer=Own。這與 teacher 的既有處理**完全同構**：`route-map.md` 已為 `/teacher/dashboard` 明文開了「允許 signed-in user 進入並建立 teacher application」的 onboarding 例外。→ 選 A 時，Slice 0 **必須**比照 teacher-dashboard 例外，在 `route-map.md` 為 `/organizer/profile`（capability bootstrap 入口）明文標注「允許 signed-in user 進入並建立 OrganizerProfile；其餘 `/organizer/*` workspace routes 仍限已具 organizer 能力者或 Admin」，並在 `permissions-matrix.md` 標注「任何 signed-in user 可自助建立自己的 OrganizerProfile（bootstrap 例外），建立後僅能管理 own 資料」。此 reconcile 是 Slice 0 的**必達 acceptance**，不得視為可選；否則實作與未來 security review 會套用互相矛盾的規則。

### D2 — 一位 Organizer 在 V1 是否只屬於一個 Organization？

- **選項 A（推薦）**：一 OrganizerProfile ↔ 至多一 Organization（沿用現有 schema：單一 nullable `organizationId`）。一 user ↔ 一 OrganizerProfile（現有 `userId @unique`）。
  - 優點：schema 已如此、最小、UI 單純；符合 V1 non-goal「不做 enterprise hierarchy / multi-branch」。
  - 注意：現有 `Organization.organizerProfiles` 為一對多，允許「多個 organizer 共用同一 org」——V1 是否啟用共用需 D2b 補充（見下）。
- **選項 B**：一 organizer 可屬多個 organization（多對多）。→ 需 join table、超出 V1，**不建議**。
- **D2b（附帶）**：V1 是否允許「多個 organizer 綁同一既有 Organization」？**推薦：否**——建立流程一律「建立新 Organization」，不做「加入既有組織」的搜尋/邀請（那屬 enterprise 協作，non-goal）。即每個 OrganizerProfile 建立時一併建立專屬 Organization。若採此，`organizationId` 實務上建立後即非空。
- **推薦：A ＋ D2b=否**。

### D3 — Reconcile `OrganizerProfile` 欄位（schema `displayName` vs docs `title/phone`）

- 現況：schema 只有 `displayName`（required）；docs data-model 寫 `title`, `phone`。
- **選項 A（推薦）**：V1 以 schema 現況 `displayName` 為準（organizer 顯示名稱／聯絡窗口稱謂），**不新增** `title` / `phone`；Slice 0 修正 data-model.md 使其與 schema 一致（把 `title/phone` 標記為 deferred 或改為 `displayName`）。聯絡電話走 Organization contact（見 D4）或 `User.phone`。
  - 優點：不動既有 schema 欄位（additive-only 原則）、最小。
- **選項 B**：依 docs 新增 `title`, `phone` 到 `OrganizerProfile`。→ 擴大 schema、與現有 `displayName` 職責重疊，**不建議**。
- **推薦：A**。並在 Slice 0 明確記載此 reconcile，避免 docs/schema 續漂移。

### D4 — Organization contact fields 放哪（Organization / OrganizerProfile / User）？

- 需求來源：form-field-spec 要求 `contactName`, `contactEmail`, `contactPhone` 必填；data-model 也把這些列在 `Organization`。schema 目前 `Organization` 無這些欄位。
- **選項 A（推薦）**：放 `Organization`（新增 `contactName String?`, `contactEmail String?`, `contactPhone String?`——**schema 層 nullable**，因既有 `Organization` 資料列若直接新增 `NOT NULL` 欄位會使 migration 失敗（additive-safe 原則）；「必填」由 **application-layer submit validation** 強制，而非 DB 層約束；`area String?`, `address String?` 列為 V1 optional/deferred）。
  - 優點：與 form-field-spec / data-model 一致；contact 屬「這個團體對外窗口」，語意歸 organization 最自然；未來多 organizer 共用 org 時 contact 仍成立。
- **選項 B**：放 `OrganizerProfile`（contact 屬個人）。缺點：與 form-field-spec 衝突、多 organizer 時重複。
- **選項 C**：復用 `User.email` / `User.phone`。缺點：user 帳號聯絡 ≠ 團體對外窗口；`User.email` 可能是登入用私人信箱，語意混淆；且 demand 對外窗口需獨立填寫。
- **推薦：A**（`contactName/contactEmail/contactPhone` 加到 `Organization`，schema `String?` nullable、submit 時 application-layer 強制必填；`area`/`address` 列為 V1 optional 或 deferred，由 PO 定）。**PO 已確認採此推薦方案**（見第 5.1 節決策記錄 D4）。Slice 0 需同步 data-model 的 Organization 欄位與 form-field-spec 的 mapping。
- **附帶驗證決策**：`contactEmail` 格式驗證強度（V1 建議「非空 + 基本 email 形狀」即可，不做寄送驗證）；`contactPhone` 僅非空 + 長度界線，不做電信驗證。

### D5 — `ServiceType`：獨立 model / seed data / V1 受控字串？

- 現況：無 `ServiceType` model；repo **無 seed 基礎設施**（無 `prisma/seed.ts`、`package.json` 無 seed script，且 `package.json` 不可改）。form-field-spec 用 `serviceTypeId`（隱含 FK）。
- **選項 A（推薦）— V1 受控字串**：`DemandRequest.serviceType String?`（**nullable**，對齊 D10：draft 階段允許不填，submit 時才由 application-layer validation 強制必填），允許值由**應用層常數清單**（如 `src/domain/demand-request/service-types.ts` 匯出 `const`）約束，server-side 驗證輸入必須落在清單內。對齊既有先例：`TeacherProfile.specialties String[]`「讓 Phase 1 不需要額外建立分類表或複雜 taxonomy」。
  - 優點：無需 seed 基礎設施（避免動 `package.json`）、migration 最小、可隨時擴清單而不需資料遷移；UI 用 `<select>` 綁同一常數。
  - 代價：需在 Slice 0 把 form/model mapping 的 `serviceTypeId` 更名為 `serviceType`（docs 對齊）。
- **選項 B — Prisma enum `ServiceType`**：固定集合、型別安全。
  - 優點：DB 層約束。缺點：新增/更名類型都要 migration；瑜伽類型未來可能常調整，enum 較僵。
- **選項 C — 獨立 `ServiceType` model + seed**：最貼近 data-model 原型、支援 `isActive`/`category`。
  - 缺點：**需 seed 機制**——但 repo 無 seed infra 且不可改 `package.json`；只能靠 migration 內嵌 `INSERT`（把種子資料寫進 migration.sql），這會讓「純 schema」migration 變成「schema + data」，也讓 rollback/測試更重；且 admin 尚無管理 UI。V1 **不建議**。
- **推薦：A（受控字串 + 應用層清單）**。**PO 已確認以下為 V1 最終定案清單（非範例，`service-types.ts` 須逐字採用）**：`Hatha Yoga`、`Yin Yoga`、`Stretch Yoga`、`Breathwork`、`Corporate Relaxation Yoga`、`Beginner Yoga`、`Parent-child Yoga`（共 7 項）。若 PO 未來要 admin 管理類型，再另案升級為 model（屬 V1 之外）。

### D6 — `preferredTimeSlots` 儲存方式（Json / string list / 正規化 relation）？

- **選項 A（推薦）— Postgres string array `String[] @default([])`**：對齊既有 `TeacherProfile.specialties/serviceAreas/teachingFormats` 的 `String[]` 慣例。
  - 優點：與 repo 既有慣例一致、無 join table、Prisma 原生支援、UI 以 checkbox/multi-select 綁受控清單。**PO 已確認 `preferredTimeSlots` 受控清單以下列 6 項為 V1 最終定案（非範例）**：`平日早上`、`平日午間`、`平日晚上`、`週末早上`、`週末午間`、`週末晚上`；此清單須與 teacher-demand-pool-response-plan 的 `proposedTimeSlots` 共用同一份常數（見該 plan D6）。
  - 代價：非強型別的自由字串需 server-side 驗證落在受控清單。
- **選項 B — Json**：彈性高但難查詢、難驗證、易塞任意結構，**不建議**（V1 不需結構化時段物件）。
- **選項 C — 正規化 relation（TimeSlot table）**：過度設計，超出 V1，**不建議**。
- **推薦：A**（`String[]` + 受控清單 + server 驗證至少一項）。

### D7 — `preferredAreas` 儲存方式

- **推薦：`String[]`**（同 D6 理由，對齊 `serviceAreas` 先例）；server 驗證至少一項（form-field-spec 標必填）。V1 採**自由輸入**（不建地區 taxonomy）+ trim。
- **PO 已確認的數值界線**：最多 **10 項**，單項長度 **≤ 50 字**（trim 後計算）；超過上限或單項過長回傳 validation error。

### D8 — `frequency` / `targetLevel` 儲存方式

- **推薦：各為單一受控字串（`String?` **nullable**，對齊 D10：draft 可留空、submit 時強制必填）**，允許值由應用層常數約束：
  - `frequency`：**固定四項**（**PO 已確認、不含 `other`**）：`single`（單堂）/ `weekly`（每週）/ `biweekly`（雙週）/ `monthly`（每月）——form-field-spec 標必填；`service-types.ts` 常數清單即為此四值，server 拒絕清單外任何輸入。
  - `targetLevel`：`beginner`（初學）/ `general`（一般）/ `advanced`（進階）/ `mixed`（混合）——form-field-spec 標必填。
- 替代：Prisma enum。trade-off 同 D5——enum DB 約束 vs 未來調整需 migration。**推薦受控字串**以保持 V1 彈性與最小 migration 面積；由 PO 定是否升級為 enum。

### D9 — `DemandRequest.status` 完整 enum 與實際 transition；是否需要 `under_review`

- docs（state-machines / state-transition-details）定義的完整狀態：`draft, submitted, under_review, published, teacher_responded, matched, converted_to_class, completed, cancelled, expired, rejected`。
- **本 feature 只需要並只實作**：`draft → submitted → published | rejected`（＋ 是否 `cancelled` 見下）。
- **enum 範圍選項**：
  - **選項 A（推薦）**：`DemandRequestStatus` enum **一次定義完整 11 個值**（對齊 docs），但本輪**只實作** draft/submitted/published/rejected 相關 transition，其餘值為「保留、未接線」。
    - 優點：未來 pool/response/matching slice 不需再改 enum（避免多次 enum migration）；docs 與 schema 一次對齊。
    - 風險：schema 出現「已定義但未使用」的狀態值——需在 Slice 0 docs 註明「哪些已接線、哪些保留」。
  - **選項 B**：enum 只放本輪用到的最小集合（`draft, submitted, published, rejected`，＋`cancelled`?），未來再逐步加。
    - 優點：schema 只反映已實作行為。缺點：未來每加一段 flow 就要 enum migration（Postgres 加 enum value 可 additive，但仍是 schema 變更 + docs 同步）。
  - **推薦：A**（完整 enum、部分接線），並在 Slice 0 明列「V1 已接線 = draft/submitted/published/rejected；其餘保留」。
- **`under_review` 是否需要**（本輪實作面）：
  - **選項 A（推薦）**：V1 admin review 直接 `submitted → published | rejected`，**不實作** `under_review` 這一步（對齊 teacher-rejection 直接 `submitted → rejected` 的簡化先例；`under_review` 值可保留於 enum 但不接線）。
    - 優點：最小 admin 操作、無需「認領/開始審查」動作與 UI；review 是一次決策。
  - **選項 B**：實作 `submitted → under_review → published|rejected`（admin 先認領再決策）。
    - 優點：多人 admin 時可標示「審查中」。缺點：增加一個 transition + UI 狀態，V1 admin 單純，收益低。
  - **推薦：A**（跳過 `under_review`）。**注意 docs 衝突**：`admin-review-workflow-spec.md` 與 `state-machines.md` 目前寫 `submitted → under_review → published/rejected`。若採 A，Slice 0 **必須**在這些 docs 標注「V1 簡化為 `submitted → published/rejected`，`under_review` 保留為 future」，避免 runtime 與 docs 漂移（此為明確承認的落差，非默默偏離）。
- **`cancelled` 是否納入本輪**：
  - state-machine 有「Any active state → cancelled（Organizer/Admin）」。本輪**建議不實作 cancel UI/flow**（保留 enum 值即可），以維持 foundation 最小；若 PO 要 organizer 撤回 draft/submitted，再列為小 follow-up。由 PO 於此拍板（納入或延後）。

### D10 — `DemandRequest` 其餘欄位 V1 儲存與必填邊界

依 form-field-spec 的 Organizer Demand Request Form，對齊為：

| 欄位 | 型別（建議） | draft | submit 必填 | 備註 |
|---|---|---|---|---|
| `organizerProfileId` | FK（server 解析） | 自動 | 自動 | 不接受 client 傳入 |
| `organizationId` | FK（server 解析自 profile） | 自動 | 自動 | 同上 |
| `title` | `String?` | optional | **必填** | trim 後 **5–100 字**（D12 驗證邊界；PO 已確認） |
| `serviceType` | `String?`（受控，D5） | optional | **必填** | 需落清單 |
| `description` | `String?` | optional | **必填** | trim 後 **20–2000 字**（PO 已確認） |
| `targetLevel` | `String?`（受控，D8） | optional | **必填** | |
| `expectedParticipants` | `Int?` | optional | **必填** | **1–500**（PO 已確認） |
| `preferredAreas` | `String[]`（D7） | `[]` | **至少一項** | 最多 10 項、單項 ≤50 字（PO 已確認，見 D7） |
| `preferredTimeSlots` | `String[]`（D6） | `[]` | **至少一項** | 落在受控清單內 |
| `classLengthMinutes` | `Int?` | optional | **必填** | **30–240 分鐘**（PO 已確認） |
| `frequency` | `String?`（受控，D8） | optional | **必填** | 落在 D8 四值清單內 |
| `preferredStartDate` | `DateTime?` | optional | 建議（非必填） | form-field-spec 標「建議」；**若填寫必須為今日以後**（PO 已確認） |
| `budgetRange` | `String?` | optional | 建議（非必填） | form-field-spec 標「建議」；brand 提醒勿過度強調價格 |
| `status` | `DemandRequestStatus`（D9） | `draft` | — | |
| `rejectionReason` | `String?`（D11） | null | — | admin 寫入 |

- **原則（對齊 teacher 先例）**：draft 允許保存部分欄位（幾乎全 optional）；submit 時才由 **server-side validation** 要求上述必填齊全（validation.ts 分 `validateDemandRequestDraft` 與 `validateDemandRequestSubmit`，比照 `teacher-profile/validation.ts`）。
- **上表必填集合與所有數值界線已由 PO 於 2026-07-21 確認**（見第 5.1 節決策記錄），Builder 可直接依此施工，不需另外向 PO 詢問這些參數。

### D11 — Demand reject reason 是否需專用 organizer-facing 欄位 + lifecycle

- **推薦（對齊 teacher-rejection 先例）**：新增 `DemandRequest.rejectionReason String?`，**organizer-facing**（顯示給該 demand 的 organizer），與內部 `AdminNote` 語意分離（本輪不建 `AdminNote`）。
  - 必填/長度：reject 時**必填**，`normalizedReason = input.trim()`，長度 10–1000（沿用 teacher 建議界線，可由 PO 調整）；前端 `required`+`minLength`+`maxLength`，後端權威。
  - lifecycle：依 D9 是否允許 resubmit 而定——
    - 若 demand `rejected` 為**終局**（D9 建議，見下）：reason 於 reject 時寫入並**永久保留於該（終局）demand**，organizer 讀取展示；不需清空邏輯；organizer 若要再提需求則**建立新 demand**。
    - 若 D9 允許 `rejected → draft/submitted` 重新送審：則需比照 teacher 定義 resubmit/publish 時清空、再次 reject 覆蓋。
- **是否允許 demand 被 reject 後 resubmit**（與 D9 綁定，需明確裁定）：
  - **選項 A（推薦）**：`rejected` 為終局；organizer 依 reason 另建新 demand。最小、無需 resubmit transition 與 reason 清空邏輯。
  - **選項 B**：允許 `rejected → draft`（或 `→ submitted`）重新送審（比照 teacher）。較貼近 teacher 一致性，但增加 transition + reason 清空邏輯 + UI。
  - **推薦：A**（終局），除非 PO 認為 organizer 需求應可原地修正重送。
- **publish 時 reason 欄位**：publish 是正向，reason 應保持 null（publish 不寫 reason）；若某 demand 曾 reject 後（在選項 A 下）不可能再 publish（終局），故無殘留問題；選項 B 下 publish/resubmit 需清空。

### D12 — draft 與 submit 的 server-side validation 邊界

- **draft**：比照 `validateTeacherProfileDraft`（目前幾乎 pass-through）——只做「型別/正規化可存」層級檢查（如數字可 parse、陣列去空白），**不**要求必填齊全；允許保存極不完整草稿。
- **submit**：`validateDemandRequestSubmit` 依 D10 必填集合逐欄驗證，回 `validationErrors[]`（`{field, code, message}`，中文溫和訊息），比照 `validateTeacherProfileSubmit`。
- **權威性**：client-side 可先擋提升體驗，但 server-side validation 才是資料正確性與權限依據（form-field-spec 通則）。受控字串（serviceType/targetLevel/frequency/timeSlots）必須 server 驗證落在允許集合，防止繞過 UI 塞任意值。
- 各欄長度/數值界線具體數值已由 PO 確認，見 D10 表格（title 5–100字、description 20–2000字、expectedParticipants 1–500、classLengthMinutes 30–240分鐘、preferredAreas 上限10項/單項≤50字），不再是待確認事項。

### D13 — 測試策略（Vitest? / Playwright smoke?）

- 現況：repo **無 Vitest、無 unit test**，只有 Playwright smoke；`package.json` 不可改。
- **推薦：只用既有 Playwright smoke** 做行為驗證（含 domain 規則經由端到端 admin/organizer 流程覆蓋），**不引入 Vitest、不改 `package.json`**。
- 若 PO 未來要 domain unit test，引入 Vitest 屬**獨立前置 slice**（會改 `package.json` + 新增 config，超出本 feature 且被本任務禁止），須另案 PO 核准。**本 feature 任何 slice 不得偷改 `package.json`。**

### D14 — notification / email 是否延後

- **推薦：延後**。本輪**不做** email/notification（demand submitted 通知 admin、published/rejected 通知 organizer 皆先不做）。
- **docs 落差承認**：`state-transition-details.md` / `AGENTS.md` 把 notification 列為狀態變更後置效果與 V1 範圍。若延後，Slice 0 須在相關 docs 標注「V1 先以站內 status 顯示告知，email/notification 為後續切片 `organizer-demand-notification`」，避免無聲漂移（比照 teacher-rejection D7 處理方式）。
- 若 PO 要本輪就做 notification → 屬另一高風險邊界（recipient logic 觸發 security review），應獨立 slice，**不建議**併入 foundation。

### D15 — `DemandRequest → Organization` 的刪除政策（data-lifecycle 決策）

- 背景：為避免回歸既有 `User → OrganizerProfile onDelete: Cascade`（見 Slice 1），**`DemandRequest → OrganizerProfile` 必須 `onDelete: Cascade`**——這條是「保住既有 user 刪除行為」的硬性技術需求，**不需 PO 裁量**。但 **`DemandRequest → Organization` 的 `onDelete` 是獨立且有後果的資料生命週期決策**，須由 PO 明確裁定，不得預設：
  - **選項 A — `Cascade`**：刪除 Organization 時一併永久刪除其所有 demand 歷史。優點：清理單純、無孤兒。缺點：**會永久刪除 demand 歷史**（含已 published/rejected 紀錄），資料不可回復。
  - **選項 B — `Restrict`**：Organization 有 demand 時禁止刪除，須先處理 demand。優點：保護 demand 歷史不被連帶刪除。缺點：刪 org 前需額外流程；本輪無 org 刪除 UI，實務上 org 幾乎不會被刪。
- **推薦：B（`Restrict`）**——V1 無 organization 刪除入口，demand 歷史應保守保留；`Restrict` 對本輪幾乎無操作成本，又避免誤刪連帶清除需求歷史。但因兩者皆有後果，**最終由 PO 於此拍板**。（注意：無論 A/B，profile-side 仍為 `Cascade`，故刪 User 仍會經 OrganizerProfile 連帶刪其 demand；D15 只決定「直接刪 Organization」時對 demand 的處置。）

### 5.1 決策記錄（Human Decision Record — 2026-07-21 產品主人確認）

以下 D1–D15 已由產品主人確認，**全部採用本 plan 各節提出的推薦方案**；Builder 以此為準。未被此記錄覆蓋的細節仍回到各 slice 的 acceptance criteria。

| # | 裁定 | 對施工的影響 |
|---|---|---|
| D1 | **選項 A**：任何 signed-in user 皆可自助建立 `OrganizerProfile` + `Organization`（比照 teacher onboarding，`/organizer/profile` 僅 `requireUser()` gate） | Slice 0 須依 D1=A 完成 `route-map.md`/`permissions-matrix.md` 的 reconcile（見 D1 段落的必達 acceptance）；Slice 3/5a 依此設計 capability bootstrap |
| D2 | **選項 A + D2b=否**：一 OrganizerProfile ↔ 至多一 Organization（沿用現有 schema）；建立流程一律新建專屬 Organization，不提供加入既有組織 | Slice 3 的 `createOwnOrganizerProfileWithOrganization` 一律走「新建 org」路徑，不做組織搜尋/邀請 UI |
| D3 | **選項 A**：`OrganizerProfile` 欄位維持現況 `displayName`，不新增 `title`/`phone` | Slice 0 修正 `data-model.md` 使其與 schema 一致；聯絡電話走 D4 或 `User.phone` |
| D4 | **選項 A**：`contactName`/`contactEmail`/`contactPhone` 放在 `Organization`（`area`/`address` 列為 V1 optional/deferred） | Slice 1 於 `Organization` 新增此三欄；因 additive-safe 考量設為 `String?` nullable，由 application-layer submit 驗證強制必填（見 Slice 1 acceptance criteria 既有說明） |
| D5 | **選項 A**：`ServiceType` 採 V1 受控字串（`DemandRequest.serviceType String?` **nullable**，draft 可留空、submit 時 application-layer 強制必填，應用層常數清單約束），不建獨立 model、不建 Prisma enum；**清單本身已定案為 7 項**（見 D5 段落） | Slice 1 schema 型別為 `String?`（與 D10 表格一致，不得寫成 non-nullable `String`）；Slice 4 新增 `service-types.ts` 常數清單，逐字採用已定案的 7 項；Slice 0 把 `serviceTypeId` 統一改名為 `serviceType` |
| D6/D7 | **`String[]`**：`preferredTimeSlots`、`preferredAreas` 皆採 `String[] @default([])`，對齊 `TeacherProfile.serviceAreas` 慣例；`timeSlots` 受控清單，`areas` 自由輸入+trim；**`preferredAreas` 上限 10 項、單項 ≤50 字**（PO 已確認） | Slice 1 schema 型別；Slice 4 validation 依此驗證「至少一項」+ 上限 |
| D8 | **受控字串**：`frequency`、`targetLevel` 各為應用層常數約束的 `String?`（**nullable**，draft 可留空）；**`frequency` 固定 4 值（single/weekly/biweekly/monthly），不含 `other`**（PO 已確認） | Slice 1 schema 型別為 `String?`；Slice 4 `service-types.ts` 一併收錄 |
| D9 | **選項 A**：`DemandRequestStatus` enum 一次定義完整 11 值，V1 只接線 `draft→submitted→published\|rejected`；`under_review` 保留不接線；`cancelled` 保留 enum 值、本輪不做 cancel UI/flow | Slice 1 enum 完整定義；Slice 0 於 `admin-review-workflow-spec.md`/`state-machines.md` 明確標註「V1 簡化，`under_review`/`cancelled` 為 future」；Slice 7 admin 只提供 publish/reject 兩個動作 |
| D10 | **採用 plan 第 5 節表格，且具體數值已一併確認**：`organizerProfileId`/`organizationId` server 解析自動帶入；`title`（5–100字）/`serviceType`/`description`（20–2000字）/`targetLevel`/`expectedParticipants`（1–500）/`preferredAreas`（見 D7 附帶）/`preferredTimeSlots`/`classLengthMinutes`（30–240分鐘）/`frequency`（見 D8 附帶，四值不含 other）submit 時必填；`preferredStartDate`/`budgetRange` 建議非必填 | Slice 4 `validateDemandRequestSubmit` 依此表與確認數值直接施工，不需再向 PO 詢問長度/數值界線 |
| D11 | **選項 A**：新增 `DemandRequest.rejectionReason String?`（organizer-facing，與 `AdminNote` 分離）；`rejected` 為**終局狀態**，organizer 需另建新 demand，不提供原地 resubmit | Slice 1 新增欄位；Slice 7 reject 時必填 reason（trim、10–1000 字，比照 teacher-rejection 先例）；不需要 resubmit transition 或 reason 清空邏輯 |
| D12 | draft/submit 驗證邊界沿用與 `TeacherProfile` 相同模式（draft 從寬，submit 時 server-side 權威驗證，受控字串必須落在允許集合） | Slice 4 `validation.ts` 依此比照 `teacher-profile/validation.ts` 結構 |
| D13 | **只用既有 Playwright smoke**；不引入 Vitest、不改 `package.json` | Slice 8 集中執行行為驗證；無 unit-test slice |
| D14 | **延後** email/notification，V1 只用站內 status 顯示告知；email 列為後續切片 `organizer-demand-notification` | Slice 0 於 `state-transition-details.md`/相關 spec 標註分期 |
| D15 | **選項 B（`Restrict`）**：`DemandRequest → Organization` 設為 `Restrict`；`DemandRequest → OrganizerProfile` 維持技術硬性要求的 `Cascade`（不需 PO 裁量部分） | Slice 1 schema 明確指定兩條 relation 的 `onDelete`；Slice 8 smoke seed 清理順序依此設計（先刪 demand 再刪 organization，或倚賴 profile-side cascade） |

**跨 plan 依賴確認**：`docs/superpowers/plans/2026-07-21-teacher-demand-pool-response-plan.md`（Teacher demand pool + response foundation plan，已由 Codex peer review 通過）的 D11（第一筆 `DemandResponse` 是否觸發 `DemandRequest: published → teacher_responded`）已由產品主人確認採**動態推導（不 persist）**——即 `DemandRequest` 狀態機**不會**因為 teacher 端的 response 動作而被寫入。因此**本 plan 不需要**為此新增任何 export helper（例如 `markDemandRequestAsRespondedIfPublished`）；`DemandRequest` 的狀態轉換維持只由本 plan（Organizer/Admin 動作）驅動，兩份 plan 在 `DemandRequest` 的寫入權責上完全解耦。

**Gate 狀態**：D1–D15 **已拍板** → High-risk Planning Gate **解除**，可進入施工；但**仍須逐 slice 進行**（Slice 0 → 1 → 2 → 3 → 4 → 5a/5b → 5c → 6/7 → 8），每 slice 各自 review、各自可 rollback，Prisma migration（Slice 1/2）維持 additive。本記錄不改變 commit / push gate：仍不得在未經產品主人明確要求下 commit 或 push。**施工前仍須先確認 Teacher application rejection 的 schema/docs 變更已 commit**（見第 4 節分析），避免同一 working tree 內混雜兩份未 commit 的高風險變更。

---

## 6. 實作切片（Slice 0–8；施工 slice 皆以 D1–D15 已拍板為前提）

> 通則：
> - 各 slice「allowed files」為**白名單**，未列出者一律 forbidden。
> - 全 feature 共同 forbidden：`.env`（不得讀取）、`package.json`、`next.config.ts`、`playwright.config.ts`、以及任何 teacher-rejection in-progress 檔案（§4.1）中「非本 slice 該碰」的部分。**不得** commit / push（除非 PO 明確要求）。
> - 高風險 slice（0/1/2/3/4/7）為 **micro**，一次只碰一個邊界，可單獨 review、單獨 rollback。
> - Slice 依賴見 §6.10 順序圖；**Slice 0/1 之前，先確認 teacher-rejection 的 schema/docs 已 commit（§4.2）。**

### Slice 0 — 產品決策落地 + 既有 docs 對齊（docs-only）

- **goal**：把 D1–D15 裁定寫入 Chinese docs，並修正「規格 vs schema」drift（§2.3），作為後續 slice 的 single source of truth。含：`DemandRequest` 欄位/狀態、`Organization` contact 欄位、`OrganizerProfile` reconcile、`ServiceType` 受控字串決策、`under_review` 簡化註記、reject reason 語意、notification 延後註記。
- **slice type**：micro（docs-only，但屬 data model / state machine 文件，需嚴謹；非 batch，因牽動核心語意）。
- **prerequisites**：D1–D15 全部拍板；**teacher-rejection 對 `data-model.md`/`state-transition-details.md`/`admin-review-workflow-spec.md` 的變更已 commit**（§4.2），避免同檔未 commit 變更交錯。
- **allowed files**（依實際裁定只動相關者）：
  - `docs/domain/data-model.md`（`DemandRequest` 欄位對齊 D5–D11；`Organization` contact 欄位 D4；`OrganizerProfile` reconcile D3；`ServiceType` 標記為 V1 受控字串/deferred model）
  - `docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`（`DemandRequest` V1 已接線 transition = `draft→submitted→published|rejected`；`under_review`/其餘保留；reason lifecycle；notification 延後註記）
  - `docs/domain/permissions.md`、`docs/domain/permissions-matrix.md`（demand 可見性；**若 D1=A，必須**標注「任何 signed-in user 可自助建立 own `OrganizerProfile` 的 bootstrap 例外」，與 D1 的 reconcile 要求一致）
  - `docs/product/form-field-spec.md`（`serviceTypeId`→`serviceType` mapping；Organization contact mapping；必填集合對齊 D10）
  - `docs/product/route-map.md`（**若 D1=A，必須**比照 `/teacher/dashboard` 例外，為 `/organizer/profile` 明文標注 signed-in-user onboarding 例外；其餘 `/organizer/*` workspace routes 仍限 organizer/admin。**並須新增本 feature 落地但 route-map 尚未列出的 route**：`/organizer/demands/[demandRequestId]/edit`（續編自己的 draft）與 `/admin/demands/[demandRequestId]`（admin demand detail，若採 detail route，見 Slice 7），使 route-map 與 runtime 一致）
  - `docs/specs/organizer-demand-request-spec.md`、`docs/specs/admin-review-workflow-spec.md`（demand publish/reject 行為、reject reason 可見性、`under_review` 簡化、notification 延後）
- **forbidden files / areas**：`prisma/**`、`src/**`、`tests/**`、`docs/specs/teacher-onboarding-spec.md`（teacher-rejection 專屬，勿碰）、共同 forbidden 清單。
- **domain and permission rules**：docs 必須明確寫死：demand 僅 `published` 為未來 teacher-eligible；draft/submitted/未 published 不對 teacher/其他 organizer 可見；publish/reject 僅 admin；organizer own-only。
- **acceptance criteria**：(a) docs 與「即將落地的 schema（D5–D11 形狀）」一致，無自相矛盾；(b) `under_review`/`ServiceType`/notification 的 V1 簡化與延後都有明確註記（承認落差，非默默偏離）；(c) `serviceType` 命名在 data-model 與 form-field-spec 一致；(d) **若 D1=A**：`route-map.md` 已明文為 `/organizer/profile` 標注 signed-in-user onboarding 例外、`permissions-matrix.md` 已標注 own OrganizerProfile 自助建立例外（兩處缺一即未達 acceptance）；(e) `route-map.md` 已列出本 feature 新增的 route（至少 `/organizer/demands/[demandRequestId]/edit`；若 Slice 7 採 admin detail route 則含 `/admin/demands/[demandRequestId]`），與 runtime 一致；(f) 未觸碰 teacher-rejection 專屬段落。
- **checks**：人工閱讀；`git status --short` 僅顯示上述 docs；`git diff` 確認未動 teacher-rejection 段落；不需跑測試。
- **manual smoke scenarios**：不適用（docs-only）；改為「交叉閱讀」：對照 data-model / form-field-spec / state-transition-details 三處 `DemandRequest` 描述是否一致。
- **security / RWD / brand review**：確認 reject/退回文案與 status 文案符合品牌語氣（清楚、溫和、不焦慮、不強調低價）；不揭露內部審核細節給非必要角色。RWD 不適用。
- **rollback notes**：`git checkout -- <docs>` 還原；因 docs-only，rollback 無資料風險。
- **stop conditions**：發現任一 D 決策未拍板、或 teacher-rejection docs 尚未 commit（會造成同檔交錯）→ 停止並回報，不猜測。
- **需要 PO 再次確認？**：否（前提是 D1–D15 已拍板；本 slice 是落實裁定）。但若落地時發現裁定間矛盾，需回 PO。

### Slice 1 — Prisma schema（schema only，不含 migration 執行）

- **goal**：依裁定新增/擴充 model：`DemandRequest` + `DemandRequestStatus` enum；`Organization` 新增 contact 欄位（D4）；（若 D3/D5 需要）`OrganizerProfile`/`ServiceType` 調整。**只改 `schema.prisma`，不寫 migration、不改 runtime**。
- **slice type**：micro（Prisma schema，最高風險）。
- **prerequisites**：Slice 0 完成；**teacher-rejection 的 `prisma/schema.prisma` 變更（`TeacherProfile.rejectionReason`）已 commit**（§4.2），確保本 slice diff 乾淨、不吸收他人未 commit 變更。
- **allowed files**：`prisma/schema.prisma`（僅新增 `DemandRequest` model、`DemandRequestStatus` enum、`Organization` 新欄位、必要 relation/index）。
- **forbidden files / areas**：`prisma/migrations/**`（Slice 2 處理）、`src/**`、`tests/**`、`docs/**`（Slice 0 已處理）、共同 forbidden 清單。**不得修改 `TeacherProfile` 或其 `rejectionReason`**（teacher-rejection 疆域）。
- **domain and permission rules**（schema 層面）：
  - `DemandRequest` 必含 `organizerProfileId`（FK → `OrganizerProfile`）、`organizationId`（FK → `Organization`），relation 具體、可 own 過濾（供 `where:{ organizerProfile: { userId } }`）。
  - **`onDelete` 必須明確指定（關鍵，勿用 Prisma 預設）**：現有 schema 為 `User → OrganizerProfile onDelete: Cascade`、`OrganizerProfile → Organization onDelete: SetNull`。若 `DemandRequest → OrganizerProfile` 這條**必要** FK 不指定 `onDelete`，Prisma 對必要關係預設為 `Restrict`，會使「刪除 User → 連鎖刪 OrganizerProfile」在該 organizer 已有 demand 時**因 FK 限制而失敗**，直接回歸破壞既有 User 刪除行為（也會弄壞 smoke `afterAll` 依 email 刪 user 的清理）。因此：`DemandRequest.organizerProfile` **必須** 設 **`onDelete: Cascade`**（demand 隨 profile/user 一併刪除——此為保住既有 user 刪除行為的硬性需求，不需 PO 裁量）。`DemandRequest.organization` 為必要 FK，其 `onDelete` 是**獨立且有後果的資料生命週期決策，依 D15 由 PO 裁定**（推薦 `Restrict`）——Builder **不得**自行預設 Cascade。此兩項 onDelete 決策須在 Slice 0 docs 一併記載；Slice 8 smoke `afterAll` 依「demand → organization → organizerProfile → user」順序清理（或倚賴 profile-side cascade；organization 因 D15 可能為 `Restrict`，故須顯式先刪 demand 再刪 organization）。
  - 欄位型別依 D6–D11：`String[] @default([])`（preferredAreas/preferredTimeSlots）、受控 `String?`（**nullable**——`serviceType`/`targetLevel`/`frequency`，對齊 D10：draft 可留空，submit 時由 application-layer validation 強制必填且落在受控清單內；**不得**宣告為 non-nullable `String`，否則 draft 建立會因缺欄位而失敗）、`Int?`（expectedParticipants/classLengthMinutes）、`DateTime?`（preferredStartDate）、`rejectionReason String?`、`status DemandRequestStatus @default(draft)`。
  - `DemandRequestStatus` enum 依 D9（完整 11 值 or 最小集合）。
  - 為 admin 查詢與 own 查詢加合理 index（如 `@@index([status])`、`@@index([organizerProfileId])`）。
- **acceptance criteria**：`npx prisma validate` 通過；schema 反映 D5–D11；所有新變更為 **additive**（新 model / 新 enum / 對 `Organization` 新增欄位）；**`Organization.contactName`/`contactEmail`/`contactPhone` 已由 D4 拍板為 `String?` nullable**（改由 application-layer submit 驗證強制必填，以保 migration additive-safe，既有 `Organization` 資料列不會因新增 `NOT NULL` 欄位而失敗）——這是**已定案的 schema 型別**，Builder **不得**改採其他形狀（例如非空+default）；此細節已於 D4、本節與 Slice 0 明確記載，Slice 1 直接依此施工，不需再判斷或選擇。
- **checks**：`npx prisma validate`；`npx prisma generate`（確認型別可生成，不對 DB 施作）；不得對任何實際資料庫執行不可逆操作。
- **manual smoke scenarios**：不適用（schema-only）。
- **security / RWD / brand review**：資料模型變更觸發 `docs/domain/permissions.md` Security Review Required（Permissions / Demand visibility）；確認 relation 支援 own 過濾與 admin 查詢。RWD/brand 不適用。
- **rollback notes**：`git checkout -- prisma/schema.prisma`（尚未產 migration 前，rollback 零資料風險）。
- **stop conditions**：發現需 non-additive 變更（改既有欄位 NOT NULL / 改型別 / 破壞既有資料）→ 停止升級為獨立 decision 回報；D5–D11 或 D15 有任一未定 → 停止。
- **需要 PO 再次確認？**：否（若 D 已拍板）；但「contact 欄位 nullable vs 非空+default」若偏離 D4 裁定，需回 PO。

### Slice 2 — create-only migration

- **goal**：為 Slice 1 的 schema 產生**新增式（create-only）** migration，不改動既有資料、不執行破壞性操作。
- **slice type**：micro（migration，最高風險）。
- **prerequisites**：Slice 1 完成且 `prisma validate` 綠燈；teacher-rejection migration（`20260721000000_...`）已存在/已套用，本 migration timestamp 必須**更晚**以維持線性。
- **allowed files**：`prisma/migrations/<new_timestamp>_add_organizer_demand_request_foundation/migration.sql`（命名沿用 `<timestamp>_<snake_case>` 慣例）；必要時 `prisma/migrations/migration_lock.toml`（僅在 Prisma 自動更新時）。
- **forbidden files / areas**：`prisma/schema.prisma`（Slice 1 已定稿）、既有任何 migration 目錄（**不得改動 teacher-rejection 的 `20260721000000_...` migration**）、`src/**`、`tests/**`、共同 forbidden 清單。
- **domain and permission rules**：不適用（純 DDL）；但 SQL 必須是 `CREATE TABLE "DemandRequest"`、`CREATE TYPE "DemandRequestStatus"`、`ALTER TABLE "Organization" ADD COLUMN ...`（additive），不得 `DROP` / 改既有欄位型別 / 加無 default 的 `NOT NULL` 到既有非空表。
- **acceptance criteria**：migration 為 additive；在乾淨 DB 上可套用；migration 內容與 Slice 1 schema 對應（`prisma migrate diff` 無殘差）；不含任何 seed/`INSERT`（除非 D5 選 model+seed，但 D5 推薦受控字串，故**不應**有 seed）。
- **checks**：`npx prisma migrate diff --from-schema-datamodel ... --to-migrations ...`（或 `migrate dev --create-only` 於本地 dev DB，**不對共享/正式 DB 施作**）；`prisma validate`。本 planning 不要求實際跑；施工時於隔離 dev 環境驗證。
- **manual smoke scenarios**：本地隔離 DB 套用 migration 後 `prisma studio` 或 `psql` 確認新表/新欄位/新 enum 存在且既有資料未受影響。
- **security / RWD / brand review**：確認無破壞既有 Auth/Teacher 資料；無敏感資料寫入 migration。
- **rollback notes**：未套用到共享環境前，刪除該 migration 資料夾即可；若已於 dev 套用，準備對應 `DROP TABLE/TYPE/COLUMN` 的回退（僅 dev）。**禁止對共享/正式 DB 施作不可逆操作。**
- **stop conditions**：`migrate diff` 顯示非 additive 或會改既有資料 → 停止回報；發現 contact 欄位若定為 `NOT NULL` 且既有表有資料會失敗 → 回 Slice 1 改 nullable（見 Slice 1 建議）。
- **需要 PO 再次確認？**：否（技術性落地）；但若必須非 additive → 升級 human decision。

### Slice 3 — OrganizerProfile / Organization domain foundation（+ organizer capability）

- **goal**：新建**獨立** `src/domain/organizer-profile/`，提供：解析/建立自己的 `OrganizerProfile` + `Organization`（D1/D2 bootstrap）、讀取自己的 profile+org snapshot、編輯自己的 org 基本/contact 資料；並提供 organizer capability helper（如 `requireOrganizer()` 或 `getOwnOrganizerContext()`）。**不得** import / 擴充 teacher-profile domain。
- **slice type**：micro（capability/permission model + core flow）。
- **prerequisites**：Slice 2 migration 已於 dev 套用；D1–D4、D12 已拍板。
- **allowed files**：
  - `src/domain/organizer-profile/input.ts`（form string → normalized input）
  - `src/domain/organizer-profile/validation.ts`（org/profile 欄位驗證，draft/submit 邊界比照 teacher pattern）
  - `src/domain/organizer-profile/service.ts`（`getOwnOrganizerContext()`、`createOwnOrganizerProfileWithOrganization(input)`、`updateOwnOrganization(input)`；全部 `where:{ userId }` 綁定）
  - （若採 `requireOrganizer()` 且放共用層）`src/lib/auth/session.ts` —— **注意**：此檔屬 Auth capability，改動觸發 security review；**若不需要動 session.ts**（改為在 organizer domain 內以 `requireUser()` + 查 `OrganizerProfile` 實作 capability），則**不列入** allowed files（推薦：capability 判斷放 organizer domain，session.ts 保持不動以縮小高風險面積）。
- **forbidden files / areas**：`src/domain/teacher-profile/**`（不得 import/改）、`prisma/**`、`src/app/**`（route 在 Slice 5）、`tests/**`、共同 forbidden 清單。
- **domain and permission rules**：
  - 建立 organizer：`requireUser()` → 若已存在 `OrganizerProfile`（`userId @unique`）則回既有/擋重複建立；否則 `prisma.$transaction` 同時建 `Organization` + `OrganizerProfile`（避免孤兒 profile 無 org / 或孤兒 org）。ownership 綁 `currentUser.id`。
  - 編輯 org：一律 `where:{ id: <自己 profile 的 organizationId>, organizerProfiles: { some: { userId: currentUser.id } } }` 或先解析自己的 `organizationId` 再限定；**不信任 client 傳入的 `organizationId`**。
  - capability：`getOwnOrganizerContext()` 回 `{ organizerProfile, organization } | null`，供 route/其他 domain 判斷「是否已具 organizer 能力」。
  - 併發/唯一：利用 `userId @unique` 防重複；建立競態以 unique 衝突處理（try/catch 回 `organizer_profile_already_exists`）。
- **acceptance criteria**：可為登入 user 建立一組 profile+org（原子）；重複建立被擋；讀/寫皆 own-scoped；跨 user 無法讀寫他人 org/profile；result 為 discriminated union + 中文溫和訊息；無 import teacher-profile。
- **checks**：`tsc`、ESLint 綠燈。行為驗證交由 Slice 8 smoke（依 D13 只用 Playwright）。
- **manual smoke scenarios**（供 Slice 8 具體化）：登入 user A 建 profile+org 成功；A 再次建立被擋；user B 無法透過傳入 A 的 `organizationId` 讀/改 A 的 org。
- **security / RWD / brand review**：Security 為重點——所有 mutation 綁 `userId`；IDOR 防護（傳入 id 僅用於等值驗證）。RWD/brand 不適用（無 UI）。
- **rollback notes**：刪除 `src/domain/organizer-profile/*` 新檔；若動了 `session.ts`（不建議）則 `git checkout` 還原。
- **stop conditions**：發現需要跨 user 讀取、或需擴 `getCurrentUser` select、或不得不 import teacher domain → 停止重新設計；D1/D2 未定 → 停止。
- **需要 PO 再次確認？**：若最終需要改 `src/lib/auth/session.ts`（Auth capability）→ **是**（Auth 變更需 PO/security review）。若 capability 判斷留在 organizer domain 則否。

### Slice 4 — DemandRequest draft / save / submit domain rules

- **goal**：新建**獨立** `src/domain/demand-request/`，提供 organizer 對**自己**的 demand 之 create-draft / save-draft / submit，含受控字串驗證與狀態轉換。不含 admin publish/reject（Slice 7）、不含 teacher pool。
- **slice type**：micro（state machine + core flow）。
- **prerequisites**：Slice 3 完成（需 `getOwnOrganizerContext()` 解析 `organizerProfileId`/`organizationId`）；D5–D12 已拍板。
- **allowed files**：
  - `src/domain/demand-request/service-types.ts`（受控清單常數：serviceType / targetLevel / frequency / timeSlots 允許值）
  - `src/domain/demand-request/input.ts`（form → normalized；string list 拆分、數字 parse、trim）
  - `src/domain/demand-request/validation.ts`（`validateDemandRequestDraft`、`validateDemandRequestSubmit`，依 D10/D12）
  - `src/domain/demand-request/state.ts`（`validateDemandRequestSubmitTransition(from,input)`：`draft → submitted` 允許；`submitted/published/rejected → submitted` 各回專屬 error code）
  - `src/domain/demand-request/service.ts`（`saveOwnDemandRequestDraft`、`submitOwnDemandRequest`、`getOwnDemandRequestList`、`getOwnDemandRequestDetail`；全 own-scoped）
- **forbidden files / areas**：`src/domain/teacher-profile/**`、`src/domain/organizer-profile/**`（可 import 其 `getOwnOrganizerContext`，但不得修改）、`prisma/**`、`src/app/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：
  - create/save draft：`organizerProfileId`/`organizationId` **一律 server 解析自 `getOwnOrganizerContext()`**；若 user 尚無 organizer context → 回 `organizer_profile_required`（引導先建 profile）。
  - draft 可保存不完整（D12）；submit 走 `validateDemandRequestSubmit` + `validateDemandRequestSubmitTransition`。
  - own 過濾：save/submit/read 一律 `where:{ id, organizerProfile: { userId: currentUser.id } }`（或先解析 own `organizerProfileId`）。
  - **save draft 的寫入 predicate 必須含狀態守衛**：更新既有 demand 的 draft 時，用 `updateMany({ where:{ id, organizerProfileId:<own>, status:"draft" }, data:{ ...normalizedDraftInput } })`（**不可**只靠「先 findUnique 查 status 再 update」的 check-then-write，避免併發 submit 後仍被 stale draft 覆寫成回 draft/覆蓋 submitted 內容）；`count===0` 回頭判斷 not-found / not-own / not-draft。建立新 demand 走 `create`（status 預設 `draft`）。
  - **submit 必須原子地一併寫入「已驗證的 normalized 輸入 + status」**（比照 teacher 先例 `submitOwnTeacherProfileApplication` 的 `update({ data:{ ...toDraftData(input), status:"submitted" }})`）：`updateMany({ where:{ id, organizerProfileId:<own>, status:"draft" }, data:{ ...normalizedSubmitInput, status:"submitted" } })`。**不得**只寫 `status:"submitted"` 而不落地 input——否則會「驗證當前表單資料，卻送出 DB 內舊/不完整資料」。`count===0` 回頭判斷 not-found / not-own / not-draft。
  - **submit 前必須驗證所連 `Organization` 的必填 contact 完整**：因 contact 欄位在 schema 為 nullable（Slice 1 additive-safe 決策），既有 organizer 的 org 可能 `contactName`/`contactEmail`/`contactPhone` 為 null。submit 服務端須讀取該 demand 連結的 organization，若任一必填 contact 為空 → 回 `organization_contact_incomplete`（引導 organizer 回 `/organizer/profile` 補齊），**不得**允許 org contact 不完整的 demand 進入 submitted。此規則納入 `validateDemandRequestSubmit` 的前置或 service 層檢查，並由 Slice 8 smoke 覆蓋。
  - 受控字串：serviceType/targetLevel/frequency/timeSlots 值必須落在 `service-types.ts` 允許集合，否則 validation error（防繞過 UI）。
- **acceptance criteria**：organizer 可建立/更新自己的 draft；缺 organizer context 被擋；submit 前必填不齊被擋並回 field errors；submit 成功時 **DB 內同時落地已驗證的表單值與 `status="submitted"`**（非只改 status）；所連 org contact 不完整時 submit 被擋（`organization_contact_incomplete`）；`draft→submitted` 成功；非 draft 來源被擋；並行 submit 後的 stale draft save 不會覆寫 submitted demand（狀態守衛 predicate）；跨 user 無法讀寫他人 demand；受控字串越界被擋。
- **checks**：`tsc`、ESLint 綠燈；行為驗證交由 Slice 8 smoke。
- **manual smoke scenarios**（供 Slice 8）：A 建 draft → 補齊 → submit 成功且 status=submitted；A 缺欄位 submit 被擋；B 無法讀/改 A 的 draft；塞非法 serviceType 被擋。
- **security / RWD / brand review**：Security 為重點（own-scoped + server 解析 id + 受控字串）；驗證訊息溫和。RWD/brand 不適用。
- **rollback notes**：刪除 `src/domain/demand-request/*`。
- **stop conditions**：D5–D12 未定 → 停止；發現需 admin 能力（不該在此 slice）→ 移交 Slice 7。
- **需要 PO 再次確認？**：否（若 D 已拍板）。

### Slice 5 — Organizer 建立流程 + demand 建立表單（protected routes + mobile-first form）

> **拆分建議（重要）**：原編號 Slice 5 混了三個不同風險/職責邊界——(a) organizer capability bootstrap UI、(b) public marketing entry、(c) protected demand form。建議**進一步拆為 5a / 5b / 5c**，各自獨立 review/rollback，不為遵守編號硬綁一起。

#### Slice 5a — Organizer capability bootstrap route（`/organizer/profile`）

- **goal**：登入 user 可透過 `/organizer/profile` 建立/檢視/編輯自己的 `OrganizerProfile` + `Organization`（呼叫 Slice 3 domain）。
- **slice type**：standard（單一 route + server action，權限邏輯已在 domain）。
- **prerequisites**：Slice 3 完成。
- **allowed files**：`src/app/organizer/profile/page.tsx`、`src/app/organizer/profile/actions.ts`（`"use server"`，`requireUser()`，normalize→domain，`revalidatePath`+`redirect` feedback，比照 teachers/join actions）。
- **forbidden files / areas**：其他 route、`src/domain/**`（Slice 3 已完成，只 import）、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：`requireUser()` gate；未登入 `redirect("/sign-in")`；所有寫入經 Slice 3 own-scoped service；不接受 client 傳 `organizationId` 定位他人。
- **acceptance criteria**：登入 user 可建立 profile+org 並看到成功回饋；重複建立被擋；未登入被導向登入。
- **checks**：`tsc`/ESLint/`next build`；Slice 8 smoke 覆蓋。
- **manual smoke scenarios**：360/390px 下完成建立表單；未登入存取被導離。
- **security / RWD / brand review**：Security（`requireUser()` + own service）；RWD（表單 mobile-first，欄位 label/helper/error 清楚，360/390px 不溢出）；Brand（引導式、溫和文案，不像填公文）。
- **rollback notes**：刪除 `src/app/organizer/profile/*`。
- **stop conditions**：Slice 3 未合入 → 停止。
- **需要 PO 再次確認？**：否。

#### Slice 5b — Public organizer request entry（`/organizers/request`）

- **goal**：public 行銷入口頁，說明「Free Soar Yoga 如何協助團體開課」，導引 visitor 登入/註冊後前往 `/organizer/profile` 或 `/organizer/demands/new`。**唯讀/導引，不含表單提交、不含私有資料。**
- **slice type**：standard（低風險 public 頁；接近 batch/light，但因是新 user flow 入口列 standard）。
- **prerequisites**：無強相依（可較早做）；文案對齊 Slice 0 品牌語氣。
- **allowed files**：`src/app/organizers/request/page.tsx`（純展示 + `<Link>` 導引；Server Component，無敏感邏輯）。
- **forbidden files / areas**：任何 mutation/action、`src/domain/**`、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：public 可見；不查任何私有資料；不建立任何資源。
- **acceptance criteria**：visitor 可見說明與清楚 CTA；已登入者 CTA 導向 organizer 流程；無任何私有資料外洩。
- **checks**：`tsc`/ESLint/`next build`；Slice 8 smoke（public 可達、CTA 存在）。
- **manual smoke scenarios**：未登入於 360/390px 檢視入口頁；點 CTA 導向 sign-in / organizer 流程。
- **security / RWD / brand review**：Security（純 public、無資料存取）；RWD（mobile-first）；Brand（重點——需 gentle/spacious/trustworthy，不強調低價，符合 voice-and-tone「為公司社團與社區，找到適合的瑜伽老師」調性）。
- **rollback notes**：刪除 `src/app/organizers/request/*`。
- **stop conditions**：文案與 Slice 0 品牌決策衝突 → 停止校準。
- **需要 PO 再次確認？**：否（文案調整屬 brand review 範圍，非 core decision）。

#### Slice 5c — Protected demand 建立 + 續編表單（`/organizer/demands/new` 與 `/organizer/demands/[id]/edit`）

- **goal**：organizer 於 `/organizer/demands/new` 建立新 demand（save draft 或 submit），並可於 `/organizer/demands/[demandRequestId]/edit` **重新開啟自己既有的 draft**（hydrate 既有值）續填、save 或 submit（呼叫 Slice 4 domain）。mobile-first、分段（團體資訊/課程需求/時間地點/預算備註）。
- **拆分理由（draft 續編是 committed flow 的必要環節）**：目標 user flow 第 2–3 步是「建立並保存 draft → 之後補齊必填後 submit」。若只有 `/new` 而無載入既有 draft 的路徑，已存的 draft 將無法被重新開啟、補齊、送出，會留下無法完成的孤兒 draft。因此本 slice **必須**同時提供「新建」與「續編既有 draft」兩條路徑（共用同一表單元件）。edit 路徑僅允許 `status="draft"`（submitted/published/rejected 不可再編輯，導回 detail）。
- **slice type**：micro→standard（core flow 表單 + server action；因觸 core user flow，偏 micro 謹慎）。
- **prerequisites**：Slice 4 完成（需 `getOwnDemandRequestDetail` 供 hydrate、`saveOwnDemandRequestDraft`/`submitOwnDemandRequest` 供寫入）；Slice 5a（user 需先有 organizer context，否則表單導向先建 profile）。
- **allowed files**：
  - `src/app/organizer/demands/new/page.tsx`、`src/app/organizer/demands/new/actions.ts`
  - `src/app/organizer/demands/[demandRequestId]/edit/page.tsx`（`requireUser()`；經 Slice 4 own-scoped `getOwnDemandRequestDetail` 載入既有 draft；非 own 或非 draft → `notFound()` 或導回 detail）、`src/app/organizer/demands/[demandRequestId]/edit/actions.ts`
  - 共用表單元件（避免 new/edit 重複）：`src/app/organizer/demands/_components/*.tsx`；若需 client 互動（多選 timeSlots/areas），該元件標 `"use client"`，範圍僅限自身
  - 全部須明確列入白名單；`requireUser()`；normalize→Slice 4 service；save/submit 兩動作；feedback（比照 teachers/join actions）。
- **forbidden files / areas**：`src/domain/**`（只 import）、`src/app/admin/**`、`src/app/organizers/**`、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：`requireUser()`；缺 organizer context → 導向 `/organizer/profile` 先建立；new/edit 的 save/submit 全經 Slice 4 own-scoped service（edit 亦以 own-scoped by-id 載入與寫入，跨 user id → not-found）；edit 僅接受 `status="draft"`；受控欄位 UI 綁 `service-types.ts` 同源清單；client 驗證僅體驗、server 權威。
- **acceptance criteria**：organizer 可新建 draft、可**重新開啟自己既有 draft** 並看到既有值 hydrate、可續填後 save 或 submit；必填不齊時 submit 被擋且顯示 field 級溫和錯誤；org contact 不完整時 submit 被擋並引導補齊（Slice 4 規則）；submit 後顯示「已收到，待平台審核」類回饋；缺 organizer context 導向建立；他人 demand id 進 edit → not-found；非 draft demand 進 edit → 導回 detail（不可編）。
- **checks**：`tsc`/ESLint/`next build`；Slice 8 smoke 覆蓋 new draft、reopen/edit draft、submit。
- **manual smoke scenarios**：360/390px 完成分段表單；存 draft 後從 demand list 重新開啟續填並 submit；日期/多選時段/地區操作不卡；submit 後回饋清楚。
- **security / RWD / brand review**：Security（own-scoped、server 解析 id、edit by-id own 過濾與狀態守衛、受控字串）；RWD（長欄位 label/helper/error、日期與多選手機友善、無水平溢出）；Brand（引導式、非公文、送出後安心回饋）。
- **rollback notes**：刪除 `src/app/organizer/demands/new/*`、`src/app/organizer/demands/[demandRequestId]/edit/*` 與 `_components/*`。
- **stop conditions**：Slice 4/5a 未合入 → 停止。
- **需要 PO 再次確認？**：否。

### Slice 6 — Organizer demand status list / detail（`/organizer/demands`, `/organizer/demands/[id]`）

- **goal**：organizer 檢視自己所有 demand 的 status（list，手機以 cards）與單筆 detail（含被 reject 時的 organizer-facing reason）。
- **slice type**：standard（唯讀 own 資料展示 + 單一 detail route）。
- **prerequisites**：Slice 4（`getOwnDemandRequestList/Detail`）；Slice 7 未必需先完成（reject reason 顯示可先寫 fallback，待 Slice 7 產生 rejected 資料）。
- **allowed files**：`src/app/organizer/demands/page.tsx`（list）、`src/app/organizer/demands/[demandRequestId]/page.tsx`（detail）。（如需共用展示元件，可加 `src/app/organizer/demands/_components/*.tsx` 並列入白名單。）
- **forbidden files / areas**：`src/domain/**`（只 import）、`src/app/admin/**`、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：`requireUser()`；list/detail 一律 own-scoped（Slice 4 service）；跨 user 存取他人 demand id → not-found（不洩漏存在性）；draft/submitted/rejected/published 皆只有本人可見。
- **acceptance criteria**：organizer 只見自己的 demand；各 status 有清楚中文標示；rejected demand 顯示 reason（無 reason 時溫和 fallback）；他人 demand id 存取回 not-found；**`draft` demand 的 list/detail 提供前往 `/organizer/demands/[id]/edit` 續編的入口**（連結 Slice 5c 的 edit 路徑，使已存 draft 可被重新開啟完成）。
- **checks**：`tsc`/ESLint/`next build`；Slice 8 smoke 覆蓋 own-only 與 status 顯示。
- **manual smoke scenarios**：A 於 360/390px 檢視自己 demand list（cards、不溢出）；A 開自己 demand detail；A 開 B 的 demand id → not-found；長 reason 不水平溢出。
- **security / RWD / brand review**：Security（own-only、IDOR not-found）；RWD（list 手機用 cards、長文不溢出，比照 teacher dashboard `break-words`/`min-w-0`）；Brand（status 文案溫和，reject reason 呈現具體不羞辱）。
- **rollback notes**：刪除 `src/app/organizer/demands/page.tsx` 與 `[demandRequestId]/*`。
- **stop conditions**：Slice 4 未合入 → 停止。
- **需要 PO 再次確認？**：否。

### Slice 7 — Admin submitted demand review / publish / reject（`/admin/demands`）

- **goal**：Admin 檢視 submitted demand queue，對單筆執行 `publish` 或 `reject`（reject 必填 organizer-facing reason + 二次確認）。含 admin domain service。
- **slice type**：micro（admin core flow + state transition + permission）。
- **prerequisites**：Slice 4（demand 已能進 submitted）；D9/D11 已拍板（transition 與 reason lifecycle）。
- **allowed files**：
  - `src/domain/demand-request/admin-service.ts`（`listSubmittedDemandRequestsForAdmin`、`publishSubmittedDemandRequest(id)`、`rejectSubmittedDemandRequest(id, reason)`；全 `requireAdmin()` 先行；`updateMany({ where:{ id, status:"submitted" }})` 併發安全模式，`count===0` 回查判斷）——或併入 `src/domain/demand-request/service.ts`（擇一，白名單標明）。
  - `src/domain/demand-request/state.ts`（新增 `validateDemandRequestPublishTransition` / `validateDemandRequestRejectTransition`：僅 `submitted →`；其餘來源回專屬 error code）——**修改** Slice 4 既有檔（白名單標明）。
  - `src/domain/demand-request/validation.ts`（新增 reject reason 驗證：trim、10–1000、非空，依 D11）——**修改**既有檔。
  - `src/app/admin/demands/page.tsx`（Server Component，`requireAdmin()` 失敗 `notFound()`；列 submitted；每筆 publish `<form>` 與 reject `<form>`（reason textarea + 二次確認）；feedback banner 讀 searchParams，比照 `admin/teachers/page.tsx`）。
  - `src/app/admin/demands/actions.ts`（`publishDemandRequestAction`、`rejectDemandRequestAction`；`requireAdmin()` catch→redirect error；`revalidatePath`；成功/失敗 `redirect` + `encodeURIComponent`）。
  - **二次確認實作（必須是真正的確認步驟，不能只是展開控制項）**：`<details>`/`<summary>` 只「顯示」reject 表單，本身**不構成**對 destructive action 的確認；不得以單純 disclosure 充當「二次確認」。可接受的無 JS 方案為：reject `<form>` 內含一個**必填的 confirm checkbox**（`required`，例如「我了解此退回說明會顯示給團主」）**且** reason 非空，兩者皆滿足才可提交；或採明確兩段式（先展開 → 再獨立確認提交）；或 client dialog（則把新增的 `src/app/admin/demands/*.tsx` `"use client"` 元件列入白名單）。後端仍為權威（缺 confirm/reason 一律擋）。此確認步驟必須由 Slice 8 smoke 驗證（未勾 confirm 或空 reason 不得 reject 成功）。
- **forbidden files / areas**：`src/domain/organizer-profile/**`、`src/domain/teacher-profile/**`、`src/app/organizer/**`、`src/app/admin/teachers/**`（勿碰 teacher-rejection 疆域）、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：
  - `requireAdmin()` 先行（list/publish/reject 皆是）；非 admin：page `notFound()`、action `redirect(...result=error)`。
  - publish：`submitted → published`；`updateMany({ where:{ id, status:"submitted" }, data:{ status:"published" } })`；`count===0` 回查判斷 not-found / not-submitted。
  - reject：`submitted → rejected` + 寫 `rejectionReason`（trim 後值，權威驗證 10–1000）；同 `updateMany` guard；reject 為 negative action → **二次確認**（admin-review-workflow-spec 要求）。
  - 依 D9：`under_review` 不接線（不提供該動作）；依 D11：reason lifecycle（若 D9 選 rejected 終局，則寫入即保留、無清空）。
  - 只有 `published` demand 為未來 teacher-eligible（本 slice 不建 teacher 查詢，僅確保狀態語意）。
  - **admin 必須能在 publish/reject 前看到足以評估需求的完整內容**（不得只用 title-only 卡片）：`listSubmittedDemandRequestsForAdmin` 的 select 須帶出 demand 全欄位（`title, serviceType, description, targetLevel, expectedParticipants, preferredAreas, preferredTimeSlots, classLengthMinutes, frequency, preferredStartDate, budgetRange, createdAt/updatedAt`）＋所連 `Organization`（`name, type, contactName, contactEmail, contactPhone`）＋所連 `OrganizerProfile`（`displayName`）。呈現方式可比照 `admin/teachers/page.tsx` 的展開 read-only 卡片（`ReadOnlyText`/`ReadOnlyList`），或另設 admin demand detail route `/admin/demands/[demandRequestId]`（若採用，須列入 allowed files 並於 Slice 0 route-map 補列）。
- **acceptance criteria**：admin 見 submitted queue（非 submitted 不顯示）；**每筆可見足以評估的完整 demand 欄位 + 所連 organization（含 contact）+ organizer displayName**（非僅 title）；可 publish（status→published）；可 reject 並填 reason（status→rejected，reason 持久化 trim 值）；reject 需通過真正的確認步驟（confirm checkbox 必勾 + reason 非空），未確認/空白/過短被前端擋、後端權威驗證；非 admin 全被擋；publish/reject 對非 submitted 來源回錯誤。
- **checks**：`tsc`/ESLint/`next build`；Slice 8 smoke 覆蓋（含非 admin 負向）。
- **manual smoke scenarios**：admin 見 submitted；publish 後離開 queue 且 organizer detail 顯示 published；reject 後 organizer detail 顯示 reason；非 admin 存取 `/admin/demands` → 404；非 admin 呼叫 action → error redirect。
- **security / RWD / brand review**：Security（重點：admin-only、state guard、reason 權威驗證、reason 經 `encodeURIComponent` 不置於可索引敏感位置）；RWD（admin 至少 tablet/desktop，reject 表單 360/390px 可用不誤觸）；Brand（reject 文案溫和具體、UI 明示「此說明會顯示給團主」）。
- **rollback notes**：刪除 `src/app/admin/demands/*` 與 `admin-service.ts`；還原 `state.ts`/`validation.ts` 新增部分（移除 publish/reject transition 與 reason 驗證）。
- **stop conditions**：D9/D11 未定 → 停止；發現需改 `admin/teachers` 或 teacher domain → 越界，停止。
- **需要 PO 再次確認？**：否（若 D9/D11 已拍板）。

### Slice 8 — Tests / security / RWD / brand verification（Playwright smoke）

- **goal**：以既有 Playwright smoke 覆蓋本 feature 關鍵 flow 與**負向 security cases**，並確認既有 smoke 不回歸。
- **slice type**：micro（測試，涉及 core flow + security 驗證）。
- **prerequisites**：Slice 3–7 已合入（或已合入者先寫，其餘標 pending 回報）；D13＝只用 Playwright smoke。
- **allowed files**（新增 spec；依 D13 不得改 `package.json`/config）：
  - `tests/smoke/organizer-demand.spec.ts`（organizer bootstrap、draft/submit、own-only list/detail）
  - `tests/smoke/admin-demands.spec.ts`（admin publish/reject、reject reason、非 admin 被擋）
  - （如需）共用 seed helper：置於上述 spec 內，或 `tests/smoke/_helpers/*.ts` 並列白名單（比照現有 spec 內嵌 `PrismaClient` seeding 風格；`afterAll` 清理）。
- **forbidden files / areas**：`src/**`、`prisma/**`、`package.json`、所有 config、既有三個 teacher/admin-teacher smoke 檔（**除非**需為既有斷言相容性微調，且須在 review packet 說明——預設**不改**）、共同 forbidden。
- **domain and permission rules**（測試需覆蓋）：
  - 正向：user 建 organizer profile+org；**重新開啟自己既有 draft 續填並 submit**（reopen/edit flow）；**編輯自己的 organization 基本/contact 資料**；建 draft→submit；admin 見 submitted→publish／reject+reason；organizer 見自己各 status 與 reject reason。
  - **負向 security（必含）**：
    1. 跨使用者 ownership——user B 無法讀/改 user A 的 organization / demand / draft（傳入 A 的 id 應 not-found / not-authorized；含 `/organizer/demands/[id]/edit`）。
    2. 非 Admin 無法 publish/reject（route 404 + action error）。
    3. private demand visibility——draft/submitted/未 published demand 不對其他 organizer 顯示（own-only）。
    4. 受控字串越界被 server 擋（非法 serviceType/targetLevel/frequency/timeSlot）。
    5. reject reason 必填/長度界線（空白/過短被擋）+ reject 確認步驟（未勾 confirm 不得 reject 成功）。
    6. org contact 不完整時 submit demand 被擋（`organization_contact_incomplete`）。
    7. submit 原子性——submit 後 DB 內確實同時落地已驗證表單值與 `status="submitted"`（驗證後 re-query demand 欄位值符合送出內容，而非空/舊值）。
    8. **admin review 完整性（防 title-only 回歸）**——smoke 必須斷言 admin 在 `/admin/demands` 對某筆 submitted demand，於 publish/reject 前**實際看得到**至少：demand 的 `description`（或另一非 title 核心欄位）、所連 `Organization.contactEmail`（或另一 contact 欄位）、與 organizer `displayName`。若採 Slice 7 的「展開卡片」路線，斷言這些文字出現在該卡片內；若採「admin detail route」路線，斷言 detail 頁面出現這些文字。此案缺席等同 acceptance 未達成。
    9. **stale draft save 不會覆寫已 submitted 的 demand**——這是 Slice 4 明確承諾的併發保護（`saveOwnDemandRequestDraft` 的 `updateMany` 必須帶 `status:"draft"` 守衛）。驗證分兩層，**兩層都必須通過，缺一不可**：
       - **功能回歸層（Playwright，可驗證但不足以證明原子性）**：對同一 demand，先完成一次 submit（`status` 變為 `submitted`），再對**同一個 demand id**呼叫一次 draft-save（模擬使用者分頁停留在舊表單、submit 後才觸發的自動存檔或重複提交）；斷言該 draft-save 呼叫回傳「非 draft 狀態」的錯誤，且 re-query 該 demand 的 `status` 與欄位值仍與 submit 當下一致、未被 draft-save 覆寫。**明確承認此測試的侷限**：這是循序（非併發）執行，一個「先 `findUnique` 檢查 `status` 再 `update`」的 check-then-write 實作在此循序情境下也會得到相同（正確）結果，因此本測試**不能單獨證明**實作使用了真正的原子 `updateMany` guard，只能作為基本回歸防線。
       - **程式碼審查層（code-review gate，非 Playwright，證明原子性的必要條件）**：Slice 8 的 review packet 必須附上 `saveOwnDemandRequestDraft`（Slice 4）的實際程式碼片段，並由 reviewer 明確確認寫入語句是**單一** `prisma.demandRequest.updateMany({ where: { id, organizerProfileId, status: "draft" }, data: {...} })`（`status:"draft"` 條件與資料寫入在同一句 SQL 內），**而非**「先 `findUnique`/`findFirst` 讀 `status` 判斷、再呼叫不帶 `status` 條件的 `update`」這種兩步式寫法。此確認為**書面 acceptance criteria**（review packet 需附程式碼引用），不依賴 Playwright 證明，理由與 teacher-demand-pool-response-plan 的 D11 TOCTOU 討論一致：資料庫層級的原子性競態無法由端到端測試可靠重現，需靠程式碼結構本身保證並經人工/reviewer 確認。
  - **seed 清理順序**：`afterAll` 須依 `DemandRequest → Organization → OrganizerProfile → User`（或倚賴 Slice 1 的 `onDelete: Cascade`）清理，避免 FK 限制導致 user 刪除失敗（見 Slice 1 onDelete 決策）。
- **acceptance criteria**：上述正向 + **9** 條負向皆有對應斷言且綠燈；既有 teacher/admin-teacher smoke 維持綠燈（未被本 feature 破壞）；**第 9 條的 code-review gate 層**（`saveOwnDemandRequestDraft` 使用單一原子 `updateMany` guard，非 check-then-write）已於 review packet 附程式碼引用並經確認。
- **checks**：`npm run test:smoke`（含 `next build`）綠燈；`tsc`/ESLint；**人工 code review 確認 `saveOwnDemandRequestDraft` 的原子寫入結構**（見上）。**本 planning 不要求實際執行**；施工時執行。
- **manual smoke scenarios**：手機視窗（360/390px）人工走查 organizer form 與 demand list（cards、長 reason 不溢出）；admin reject 二次確認流程。
- **security / RWD / brand review**：Security（本 slice 即 security 驗證集中地，9 條負向為硬要求）；RWD（含 360/390px 溢出斷言，比照 dashboard smoke overflow 檢查）；Brand（人工確認文案語氣）。
- **rollback notes**：刪除新增 spec / helper；若曾微調既有 spec，一併還原至原綠燈。
- **stop conditions**：D13 未定 → 停止（無法決定測試工具/位置）；Slice 3–7 尚未合入者，只寫已具對象的案例，其餘標 pending 回報。
- **需要 PO 再次確認？**：否。

### 6.10 Slice 順序與相依

```
（前置）Teacher rejection schema/docs 已 commit（§4.2）
   ↓
Slice 0 (docs 對齊)
   ↓
Slice 1 (schema) → Slice 2 (migration)
   ↓
Slice 3 (organizer-profile domain)
   ↓
Slice 4 (demand-request domain)
   ↓
Slice 5a (/organizer/profile)  ── Slice 5b (/organizers/request, 可較早獨立)
   ↓
Slice 5c (/organizer/demands/new)
   ↓
Slice 6 (organizer demand list/detail)   Slice 7 (admin /admin/demands)   ← 6 與 7 可平行（各自 review）
   ↓
Slice 8 (Playwright smoke + security/RWD/brand 驗證)
```

- Slice 5b（public entry）低相依，可在 Slice 0 品牌決策後任意時點插入。
- Slice 6 與 7 皆相依 Slice 4；彼此可平行，但 Slice 6 的 reject-reason 顯示要有實資料需 Slice 7（可先寫 fallback）。
- Slice 8 建議最後；domain 行為驗證依 D13 由 smoke 端到端覆蓋（無 unit-test slice）。

---

## 7. Quality gates（對齊 AGENTS.md，各 slice 合入前依相關項確認）

TypeScript passes、ESLint passes、Build passes、變更邏輯的行為以 Playwright smoke pass（D13）、關鍵 flow 的 E2E smoke pass、Role permissions reviewed（organizer own-only / admin-only publish-reject / demand visibility）、Marketplace state transitions reviewed（`draft→submitted→published|rejected`）、Brand consistency reviewed（引導式表單、送出後安心回饋、reject 文案溫和、不強調低價）、RWD/mobile reviewed（organizer form 與 demand list 360/390px）、App-readiness boundary 不被破壞（domain/service 清楚、UI 不夾業務邏輯）。

---

## 8. Verification strategy（本 planning 不實際執行）

- **測試工具現況**：repo **無 Vitest、無 unit test**，只有 Playwright smoke（`tests/smoke/*.spec.ts`）。**本 plan 不默認新增任何 package**；`package.json` 不可改（D13）。若未來要 unit test，引入 Vitest 屬另案獨立前置 slice，需 PO 核准。
- **規劃中的檢查**（施工時各 slice 執行，本 planning-only 不跑）：
  - `tsc`（TypeScript）、`eslint`（ESLint）：所有含 `src/**` 變更的 slice。
  - `npx prisma validate` / `prisma generate` / `migrate diff`（Slice 1/2，隔離 dev DB，不對共享/正式 DB 施作）。
  - `next build`：含 route 的 slice（5a/5b/5c/6/7）。
  - `npm run test:smoke`（Playwright，`pretest:smoke` 先 `next build`）：Slice 8 集中執行。
- **必含負向 security cases**（Slice 8，共 9 條，詳見 Slice 8 完整清單）：跨使用者 ownership（B 不能動 A 的 org/demand）、非 Admin publish/reject（404 + action error）、private demand visibility（draft/submitted/未 published 不對他人可見）、受控字串越界、reject reason 必填/長度、org contact 不完整擋 submit、submit 原子性、**admin review 完整性（防 title-only 回歸）**、**stale draft save 不會覆寫已 submitted 的 demand**（Slice 4 併發保護承諾的直接驗證）。
- **RWD 驗證**：organizer form 與 demand status list 至少 **360px / 390px** 檢視（cards、label/helper/error、日期與多選手機友善、長 reason 無水平溢出）。
- **本 planning-only 任務不要求實際執行 build 或 smoke**；上述為施工時的驗證計畫。

---

## 9. Non-goals（本 feature 明確不做）

- 不做 **Teacher demand pool**（approved teacher 查詢/瀏覽 published demand 的介面與查詢）——本輪只保證資料/狀態前提「published 才 eligible」。
- 不做 **DemandResponse** 或 teacher matching / shortlist / select。
- 不做 **ClassSession**（含 `converted_to_class`）。
- 不做 **Enrollment**。
- 不做 **payment / refund**（含 `PaymentIntent`）。
- 不做 **AI matching / recommendation**。
- 不做 **Google Calendar sync**。
- 不做 **email / notification**（demand submitted/published/rejected 通知）——除非 PO 於 D14 另行批准；預設以站內 status 顯示告知，email 列為後續切片 `organizer-demand-notification`。
- 不做 **enterprise organization hierarchy / multi-branch / 加入既有組織的協作邀請**（D2b=否）。
- 不做 **Wellness / Academy / Retreat** 模組。
- 不做 **native app**。
- 不做 **demand cancel / expire flow**（除非 D9 附帶決定納入 cancel；預設保留 enum 值不接線）。
- 不做 **`under_review` transition**（D9 推薦簡化；enum 保留）。
- 不改 `next.config.ts` / `package.json` / `playwright.config.ts`（使用者/teacher 既有本地修改，須保留且不納入）。
- 不碰 teacher-rejection in-progress 疆域（§4.1）；不讀 `.env`；不 commit、不 push。

---

## 10. Rollback 總則

- **Slice 1/2（schema/migration）最關鍵**：務必 additive（新 model/enum、`Organization` 加 nullable 欄位）。**建議 contact 欄位落地為 `String?` nullable、由 application submit 驗證強制必填**，以保 migration additive-safe（既有 `Organization` 資料列不會因 `NOT NULL` 失敗）。禁止對共享/正式 DB 施作不可逆操作；rollback 僅需 drop 新表/enum/欄位並刪 migration（未共享前）。
- **依相依反序 rollback**：Slice 8 → 7 → 6 → 5c → 5a/5b → 4 → 3 → 2 → 1 → 0。UI/service（3–7）為純程式碼，還原檔案/ import/export 即可。
- **資料殘留**：若已寫入 demand/reason 後回退欄位，drop column 會遺失資料；回退前確認無正式資料依賴。
- **文件同步**：回退 schema 需同步回退 Slice 0 docs，避免 docs 與程式碼漂移（AGENTS.md：架構變更需同步更新 Chinese docs）。
- **teacher-rejection 隔離**：任何 rollback 不得波及 teacher-rejection 檔案；若發現本 feature 誤動其疆域，立即回報並還原。

---

## 11. Planning-only self review

- **變更檔案**：僅新增本檔 `docs/superpowers/plans/2026-07-21-organizer-demand-request-foundation-plan.md`。未動 `prisma/**`、`src/**`、`tests/**`、既有 docs、`package.json`、`next.config.ts`、`playwright.config.ts`；未讀 `.env`；未 commit / push。
- **V1 scope**：符合；只建立 organizer demand foundation，未擴張 teacher pool / response / class / enrollment / payment / AI / calendar / notification / enterprise hierarchy / Wellness-Academy-Retreat / native app（第 9 節）。
- **permissions**：organizer own-only、admin-only publish/reject、demand visibility（published 才 eligible）皆以 server/domain layer 檢查（第 3 節），Slice 8 負向測試覆蓋。
- **state machine**：本輪僅接線 `draft→submitted→published|rejected`；`under_review` 等保留；與 docs 落差已要求 Slice 0 明確註記（第 5 節 D9）。
- **security**：IDOR 防護（id 僅等值驗證、server 解析 own id）、admin gate、受控字串 server 驗證、reject reason 權威驗證——皆列入相關 slice 與 Slice 8。
- **RWD**：organizer form 與 demand list 360/390px 驗證（第 8 節、Slice 5c/6/8）。
- **brand**：引導式表單、送出後安心回饋、reject 文案溫和、不強調低價（第 7 節、Slice 5b/5c/6/7）。
- **teacher-rejection 依賴/衝突**：已於第 4 節分析並建議「先讓 teacher-rejection schema/docs commit，再開始本 feature 會碰共用檔的 slice」；唯一可安全平行者為本 planning 文件本身。
- **產品主人決策**：D1–D15 已於 2026-07-21 全部拍板（第 5.1 節決策記錄），High-risk Planning Gate 已解除。本 plan 本身仍是 planning 文件，未附任何已執行的程式碼變更；Builder 依第 6 節逐 slice 施工前，仍須自行核對 repo 現況與 teacher-rejection 依賴狀態（第 4 節）。
- **未修改無關檔案**：無。

<!-- codex-peer-reviewed: 2026-07-22T00:15:00Z rounds=7 verdict=approved -->
