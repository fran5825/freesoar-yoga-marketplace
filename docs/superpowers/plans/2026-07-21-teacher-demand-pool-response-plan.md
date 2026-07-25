# Teacher Demand Pool + Response Foundation — Implementation Plan

> 狀態：**planning-only**。本輪只產出可逐 slice 執行的規劃，不實作任何 schema / 程式 / 測試。
> 目標 user flow：`TeacherProfile.status = approved` 的 Teacher 進入 `/teacher/demands` → 瀏覽符合 V1 visibility policy 的 `published` DemandRequest → 進入 `/teacher/demands/[demandRequestId]` 查看資料最小化後的 demand detail → 提交自己的 DemandResponse（同一 Teacher 對同一 DemandRequest 最多一筆有效 response）→ 查看自己的 response status → 可在 allowed state 下 withdraw 尚未 selected 的 response。Organizer 可在自己的 demand detail read-only 查看收到的 responses。
> 本文件為 **High-risk Planning Gate** 產物（觸及 Prisma schema / migration / state machine / core user flow / demand visibility permission）。**本 plan 自身的 D1–D16 已於 2026-07-21（D11）與 2026-07-22（其餘）全部拍板**（見第 5.1 節決策記錄），High-risk Planning Gate 已解除；但本檔仍為 planning 文件，不含實作，且部分 slice 仍受限於 Organizer draft plan 的程式碼落地進度（見下）。
>
> **本 plan 的上游依賴狀態（必讀，2026-07-22 更新）**：`DemandRequest` model **尚未存在於 committed Prisma schema（HEAD）**，但**已出現在 working tree 的未 commit schema 變更中**（見下）。`docs/domain/data-model.md` 設計稿與 `docs/superpowers/plans/2026-07-21-organizer-demand-request-foundation-plan.md`（以下稱「Organizer draft plan」）皆有對應描述。**Organizer draft plan 的 D1–D15 產品主人決策已於 2026-07-21 全部拍板，該文件隨後取得 `codex-peer-reviewed` marker（7 rounds，marker 時間戳 2026-07-22）**（見該 plan 第 5.1 節決策記錄）。**Organizer draft plan 的 Slice 0（docs 對齊）與 Slice 1（`prisma/schema.prisma` 新增 `DemandRequest`/`DemandRequestStatus`/`Organization` contact 欄位）皆已於另一 session 實際落地於 working tree（尚未 commit、尚未產生對應 migration）**——本 plan 撰寫時以 `git diff -- prisma/schema.prisma` 核實，欄位型別（`String?` nullable、`onDelete` 指定）與 D1–D15 決策記錄一致。因此本 plan 的立場調整為：**已拍板決策與 working tree 實際 schema 皆可作為具體事實引用**，**但在該 schema 變更 commit、對應 migration（Slice 2）產生並套用、且 domain/service/route（Slice 3 以後）落地前，仍不得視為穩定可施工的 API**——`DemandRequest` 的 schema 已可在本地 dev 環境參照，但**尚未是 committed baseline 的一部分**，本 plan 仍標示其為 prerequisite contract。詳見第 2 節與第 10 節。

---

## 0. 如何閱讀本 plan（給零背景 Builder）

- 本 plan 目標是自足：Builder 只需讀「本檔 + 目前 repo」即可理解各 slice 設計，不需要本次規劃對話的任何記憶。
- 每個宣稱「repo 現況如何」的敘述，都以第 2 節「現況核對」的 primary source 為準；Builder 施工前**必須自行再核對一次實際檔案**，不接受任何文件敘述為既定事實（AGENTS.md / `docs/harness/mvp-slicing.md` 精神）。
- 「allowed files」是**白名單**：未列出的檔案一律 forbidden。
- 任何 slice 若在施工時發現其依賴的上游（Organizer draft plan 的程式碼落地）尚未完成，**必須停止並回報**，不得猜測預設值或自行採用草案中的推薦方案。（Teacher rejection 功能已於 2026-07-21 commit，不再是「尚未 commit」的風險來源，見 2.1 節；本 plan 自身 D1–D16 已於 2026-07-22 全部拍板，見第 5.1 節。）
- 本 plan **不含**任何可直接複製執行的 Builder implementation prompt——即使 D1–D16 已全部拍板（第 5.1 節），本 plan 至少部分依賴 Organizer draft plan 的**實際程式碼落地**（其 D1–D15 已拍板且文件已取得 `codex-peer-reviewed` marker；**schema 已於 working tree 落地但尚未 commit/migrate，service/route 尚未落地**），故仍不產出可直接施工的 prompt；Builder 需先確認第 10 節所述的落地前提滿足後才能施工。

---

## 1. 背景與範圍

### 1.1 產品問題

Approved Teacher 需要一個清楚、資料最小化、低壓力的方式瀏覽平台上「已審核公開」的團體需求，並針對有興趣的需求提交回應；Organizer 需要能在自己的需求下看到收到哪些老師回應。本輪建立這條路徑的**基礎（foundation）**：demand pool 瀏覽、demand detail、DemandResponse 的建立/查看/withdraw、Organizer 的 read-only 查看。**不含** shortlist、select、matching decision——那是後續獨立的 core-flow plan（見第 3 節）。

### 1.2 本輪 in-scope（詳見第 3 節）

1. Teacher demand pool list（`/teacher/demands`）。
2. Teacher demand detail（`/teacher/demands/[demandRequestId]`）。
3. Server-side approved Teacher capability check。
4. Published-only visibility（且僅資料最小化後的欄位）。
5. `DemandResponse` Prisma/data-model 規劃（schema 尚未落地，本輪只規劃）。
6. Teacher submit response。
7. Teacher 查看自己的 response status。
8. Teacher withdraw allowed response。
9. Organizer read-only 查看自己 demand 收到的 responses。
10. 上述必要的 domain/service/state rules、security、RWD、brand、Playwright smoke 規劃。

### 1.3 風險等級

依 `docs/harness/risk-based-workflow.md` 與 `docs/harness/mvp-slicing.md`，本 feature 觸及 **Prisma schema / migration / state machine / demand visibility permission / core user flows（demand response、withdraw）**，屬 **High-risk / Heavy**，且需先 Planning-only。

Risk flags：`PRISMA_RISK`、`MIGRATION_RISK`、`PERMISSION_RISK`、`STATE_MACHINE_RISK`、`SCOPE_DRIFT_RISK`、`BRAND_RISK`、`LOW_PRESSURE_UX_RISK`。（無 `PAYMENT_RISK`——`proposedPrice` 僅為資訊性欄位，本輪不做付款；無 `ENV_SECRET_RISK` / `PACKAGE_RISK`——本輪不讀 `.env`、不動 `package.json`。）

---

## 2. 現況核對（Repo Reality Audit；primary sources，2026-07-21 working tree）

> 以下皆以實際 repo 檔案為準。Builder 施工前須自行重新核對。

### 2.1 四層現況必須清楚區分

| 類別 | 內容 | 對本 plan 的意義 |
|---|---|---|
| **Committed baseline（HEAD）** | `prisma/schema.prisma`（committed HEAD）含 `User`、`Account`/`Session`/`VerificationToken`（Auth.js）、`TeacherProfile`（含 `status: TeacherProfileStatus @default(draft)`，enum 值 `draft/submitted/approved/rejected/suspended`）、`OrganizerProfile`、`Organization`（**不含** contact 欄位）、`OrganizationType` enum。`TeacherProfileStatus` enum 與 `status` 欄位在**最早的 init migration**（`20260503074202_init_auth_capability_base`）就已建立並套用。`src/domain/teacher-profile/*`（含 approve **與** reject 邏輯，見 2.6）、`src/app/admin/teachers/*`、`src/app/teacher/dashboard/*`、`src/app/teachers/join/*`、`src/lib/auth/session.ts`、三個 `tests/smoke/*.spec.ts`。**`DemandRequest`、`DemandResponse`、`ServiceType`、`DemandRequestStatus`、`DemandResponseStatus` 完全不存在於 committed schema（HEAD）**；`ServiceType`/`DemandResponse`/`DemandResponseStatus` 也不存在於 working tree。**`DemandRequest`、`DemandRequestStatus`、`Organization` 的 contact 欄位已存在於 working tree 的未 commit schema 變更**（Organizer draft plan Slice 1，見下方 Organizer 列），但尚未 commit、尚未有對應 migration。 | 本 plan 的 repo 現況基準與 pattern 來源。**本 plan 對 `DemandRequest` 的引用可參照 working tree 現有 schema 核實形狀，但在其 commit + migration 落地前，仍是 prerequisite contract，不是穩定可用的 committed API。** |
| **Teacher rejection（已於本次工作階段 commit，不再 in-progress）** | Teacher application rejection 功能（`TeacherProfile.rejectionReason`、reject service/state/UI、對應 smoke 測試）**已於 2026-07-21 本次工作階段內 commit**（`git log` 確認 5 個新 commit：`feat: add TeacherProfile.rejectionReason column and migration`、`feat: add teacher application reject domain rule and service`、`feat: add admin reject action and UI with reason`、`feat: show rejection reason to the teacher`、`test: add smoke coverage for teacher application rejection`）。目前 `git status` 不再顯示這批檔案為 modified，`prisma/migrations/20260721000000_add_teacher_profile_rejection_reason/` 也已不是 untracked。規劃文件見 `docs/superpowers/plans/2026-07-21-teacher-application-rejection-plan.md`（**已有 `codex-peer-reviewed` marker，D1–D7 已拍板**）。 | **本 plan 仍不得修改該功能的既有檔案**（`src/domain/teacher-profile/**`、`src/app/admin/teachers/**` 等），但風險性質已從「避免吸收他人未 commit 變更」降為「維持既有 module 邊界、不越界修改已完成功能」的一般紀律。approved/suspended capability check 所需的 `TeacherProfileStatus` enum 與 `status` 欄位本身**已在更早的 committed baseline**（詳見 2.2），與這批已 commit 的 `rejectionReason` 變更是各自獨立的事實，兩者現在都已是穩定的 committed 狀態。 |
| **Organizer demand draft plan（決策已拍板、文件已通過 peer review、Slice 0+1 已於 working tree 落地）** | `docs/superpowers/plans/2026-07-21-organizer-demand-request-foundation-plan.md`——**D1–D15 已於 2026-07-21 全部拍板**（見該 plan 第 5.1 節），該文件**已取得 `codex-peer-reviewed` marker（7 rounds，marker 時間戳 2026-07-22）**。**Slice 0（docs 對齊）與 Slice 1（`prisma/schema.prisma` 新增 `DemandRequest`/`DemandRequestStatus`/`Organization` contact 欄位）皆已於另一 session 實際落地於 working tree**（`git diff -- prisma/schema.prisma` 確認欄位型別與 onDelete 皆與決策記錄一致；尚未 commit，尚未有對應 migration）。但 `src/domain/organizer-profile/*`、`src/domain/demand-request/*`、`src/app/organizer/*`、`src/app/admin/demands/*`（Slice 3 以後）**全部尚未實作**，`prisma/migrations/`（Slice 2）也尚未新增對應 migration。 | 本 plan 可將該 plan 第 5.1 節已拍板的欄位形狀/受控清單/數值界線當作**具體事實**引用，且可直接參照 working tree 現有的 `DemandRequest` schema 核實欄位名稱（例如 `preferredTimeSlots` 受控清單已定案 6 項，見 D6）；但在該 schema commit + migration（Slice 2）套用、且 domain/service（Slice 3 以後）落地前，仍不得視為穩定可施工的 API，本 plan 相依的 slice 仍標示為 prerequisite contract。 |
| **本 plan 未來範圍** | 新增 `DemandResponse`（+ `DemandResponseStatus` enum）；新增 `src/domain/demand-response/*`；新增 `src/app/teacher/demands/*`（list/detail/withdraw）與 `src/app/organizer/demands/[demandRequestId]/responses`（或併入 organizer demand detail，視 Organizer plan 落地形狀）；新增對應 smoke specs；同步既有 docs。 | 逐 slice 執行，見第 8 節。 |

### 2.2 TeacherProfile 現況（approved capability check 可安全依賴的基準）

- 實際欄位（`prisma/schema.prisma`，**committed HEAD**）：`id, userId(@unique), displayName?, bio?, teachingStyle?, experienceYears?, certifications[], specialties[], serviceAreas[], teachingFormats[], priceRange?, profilePhotoUrl?, status(TeacherProfileStatus, default draft), rejectionReason?（已 commit）, createdAt, updatedAt`。
- `enum TeacherProfileStatus { draft submitted approved rejected suspended }`——**在 committed baseline 就存在**（`20260503074202_init_auth_capability_base/migration.sql` 內 `CREATE TYPE "TeacherProfileStatus" AS ENUM (...)`，`status` 欄位 `NOT NULL DEFAULT 'draft'` 於同一 migration 建立 `TeacherProfile` 表時一併建立）。
- **關鍵結論**：`TeacherProfile.status = "approved"` 這個 capability gate，其資料層基礎**已經是 committed baseline 的一部分**，與 teacher-rejection 的 `rejectionReason` 欄位＋reject service/state/UI（**現已一併 commit**，見 2.1 節）是各自獨立、但現在都已是 committed 狀態的變更。**本 plan 的「approved Teacher 才能進 demand pool」查詢條件本來就不需要等待 teacher-rejection commit 才能規劃或施工**，現在兩者皆已 committed，此依賴問題已完全不存在——僅需維持 module 邊界，不修改 `rejectionReason` 或 reject 相關檔案即可。
- `src/domain/teacher-profile/service.ts`（含 reject 邏輯，**已 commit**）已提供 `getOwnTeacherProfileApplicationSnapshot()`（讀自己的 profile，`where: { userId }`）——本 plan 的 Teacher demand pool/response domain**應沿用同一種「以 `userId` 解析 own `TeacherProfile`」模式**，但**必須獨立實作**（新建 `src/domain/demand-response/*`，不 import teacher-profile 的 service，比照 Organizer draft plan 的「沿用 pattern 不沿用 module」原則）。

### 2.3 `DemandRequest` / `DemandResponse` 現況（`DemandRequest` 已於 working tree、`DemandResponse` 仍不存在，皆為 prerequisite contract）

- `prisma/schema.prisma` 的 **committed HEAD 完全沒有** `DemandRequest`、`DemandResponse`、`ServiceType`、`DemandRequestStatus`、`DemandResponseStatus`。**working tree 已有未 commit 的 `DemandRequest`/`DemandRequestStatus`**（Organizer draft plan Slice 1，見 2.1 節），但 `DemandResponse`、`DemandResponseStatus`、`ServiceType` 仍完全不存在於 committed 或 working tree schema。這些概念另外也記載於：
  - `docs/domain/data-model.md`（設計稿，欄位列表見該文件 `DemandRequest`/`DemandResponse` 章節）。
  - `docs/domain/state-machines.md` / `docs/domain/state-transition-details.md`（狀態機文件，非程式碼）。
  - `docs/specs/organizer-demand-request-spec.md` / `docs/specs/demand-response-and-matching-spec.md`（產品 spec，非程式碼）。
  - Organizer draft plan（**D5–D11 已於 2026-07-21 拍板**，欄位/狀態具體形狀已定案；文件已取得 `codex-peer-reviewed` marker，Slice 0 docs 與 Slice 1 schema 皆已落地於 working tree（尚未 commit），但 migration（Slice 2）與 service/route（Slice 3 以後）仍尚未實際落地）。
- **本 plan 的立場**：`DemandRequest` 是**上游 prerequisite contract**。Organizer draft plan 的 D1–D15 已於 2026-07-21 拍板（第 5.1 節決策記錄），且其 Slice 1 schema 已於 working tree 落地（見 2.1 節），故本 plan 第 5 節的 D 決策，凡涉及 `DemandRequest` 欄位/狀態/service 介面時，可**直接引用該決策記錄與 working tree 實際 schema 的具體形狀作為事實**（不再是條件句「若…拍板」），但仍須標註「該 schema 尚未 commit、service/route 尚未落地」，並在第 10 節列出明確的 sequencing gate（等 commit/migration/程式碼落地才能施工）。**本 plan 不得先於 Organizer draft plan 替 `DemandRequest` 做出其決策記錄未涵蓋的額外決策**（例如搶先定義該 plan 未提及的欄位或狀態值）。

### 2.4 Organizer demand routes/service 現況

- `src/app/organizer/**`、`src/app/organizers/request/**`、`src/app/admin/demands/**`、`src/domain/organizer-profile/**`、`src/domain/demand-request/**` **全部不存在**於 repo（`Glob` 核對 `src/app/**/*.tsx` 只有：`layout.tsx`、`dev/auth`、`dev/admin`、`account`、`sign-in`、`page.tsx`（首頁）、`admin/teachers/page.tsx`、`teacher/dashboard/page.tsx`、`teachers/join/page.tsx`）。
- 因此 Teacher demand pool 完全沒有可查詢的真實 `published` demand 資料，也沒有 Organizer 端可整合 read-only response 顯示的既有 detail 頁面可掛載。**本 plan 的所有 route/query slice 在真正可端到端執行前，都需要 Organizer draft plan 至少落地到「`DemandRequest` 有 `published` 資料可查」的程度**（見第 10 節 sequencing）。

### 2.5 Auth / session capability model（`src/lib/auth/session.ts`）

- 具備 `getCurrentUser()`（以 `auth()` 的 email 查 `User`，回 `{id,email,name,image,isAdmin}`）、`requireUser()`（未登入丟 `"Authentication required"`）、`requireAdmin()`（非 admin 丟 `"Admin access required"`）。
- **沒有** `requireApprovedTeacher()` 或任何 teacher capability helper。目前「是否為 approved teacher」在程式層無任何既有判斷點——本 plan 的 domain 層需自行實作（見 D1 / Slice 3）。
- `CurrentUser` 不含 `teacherProfile`。若路由/服務需要 teacher 身分與 status，需以 `currentUser.id` 另查 `TeacherProfile`（不建議擴 `getCurrentUser` 的 select，除非多處需要——比照 Organizer draft plan 對 organizer capability 的處理原則）。

### 2.6 可沿用的 domain / service / action / page / test pattern（來源：`src/domain/teacher-profile/*`、`src/app/**`、`tests/smoke/*`）

> **原則：沿用 pattern，不沿用 module。** 不得把 `teacher-profile` 或（未來的）`demand-request` service 擴成混合 domain service，也不得 import 其 service/validation/state 到 `demand-response` domain。新建 `src/domain/demand-response/`，獨立管理。

可沿用的 pattern（照抄結構、重寫內容）：

1. **domain 分層**：`input.ts`（form string → normalized input）、`validation.ts`（回 `{valid, errors[]}` 或帶 `normalizedX`/`code` 的專用驗證函式，如 `validateTeacherProfileRejectionReason` 的模式）、`state.ts`（transition 驗證，回 discriminated union `{allowed, from, to, code?}`）、`service.ts`（權限 + Prisma + 組裝 result）。
2. **discriminated result union**：`{ ok: true, ... } | { ok: false, code, message, validationErrors?/xxxError? }`，`code` 是明確 union。
3. **own-resource 併發安全寫入**：見 `rejectSubmittedTeacherProfileApplication` / `approveSubmittedTeacherProfileApplication`——`updateMany({ where:{ id, status:"submitted" }, data:{...} })`，用 `count === 0` 回頭查實際狀態判斷 not-found / not-eligible / wrong-status。**DemandResponse 的 submit/withdraw 必須套用同一模式**（見第 4 節、D8）。
4. **own-resource 綁定 userId**：見 `getOwnTeacherProfileApplicationSnapshot`——一律 `where:{ userId: currentUser.id }`（或先解析 `teacherProfileId` 再用於 where），**從不信任 client 傳入的 id 來決定 own 資源**。
5. **server action**：見 `src/app/teachers/join/actions.ts`（`"use server"`，normalize → service，回序列化結果，`Date` → ISO string）與 `src/app/admin/teachers/actions.ts`（`requireAdmin()` catch → `redirect(...result=error)`；成功 `revalidatePath` + `redirect(...result=success&message=encodeURIComponent)`）。
6. **page**：`teacher/dashboard/page.tsx` 是唯讀 status page 的最佳範本——`requireUser()` 失敗 `redirect("/sign-in")`；用 `statusCopy` record 呈現各 status 文案；`min-w-0` / `break-words` / `whitespace-pre-wrap` 處理長文字 RWD；`ReadOnlyItem` 元件模式；`formatDateTime`/`formatList` helper。**Teacher demand detail/response status 頁面應沿用此視覺與資料呈現 pattern**。
7. **smoke test seeding**（`tests/smoke/admin-teachers.spec.ts`）：直接用 `new PrismaClient()` 建 `User` + `Session`（cookie `authjs.session-token`，domain `127.0.0.1`）+ 目標 profile；`afterAll` 依 email 清理；`isAdmin`/`status` 可控。這是本 feature smoke 的 seeding 樣板，**但需額外 seed `DemandRequest`（若已存在）與 `Organization`/`OrganizerProfile`**——這是本 plan 對 Organizer draft plan 的資料相依（見第 10 節）。

### 2.7 測試工具現況

- `package.json` scripts 只有 `dev/build/start/lint/pretest:smoke(=next build)/test:smoke(=playwright test)`。
- **repo 無 Vitest、無任何 `*.test.ts` unit test**，所有既有測試都是 Playwright smoke（`tests/smoke/*.spec.ts`）。
- `package.json` 是**使用者已有本地修改、且本任務明訂不可修改/納入**的檔案 → **本 feature 不得引入 Vitest、不得改 `package.json`**（見 D16）。

### 2.8 `docs/specs/demand-response-and-matching-spec.md` 與實際 repo 的差距

該 spec（見引言已讀取內容摘要）定義的 user flow、data requirements、state transitions（`submitted → shortlisted → selected`，終止 `declined/withdrawn/expired`）、permission requirements（Teacher 只能編輯/withdraw 自己 selected 前的 response）、RWD/acceptance criteria，**皆為設計稿，尚未有任何對應程式碼**。差距summary：

| 主題 | Spec 敘述 | 實際 repo | 本 plan 處理方式 |
|---|---|---|---|
| `DemandResponse` model | 完整欄位（`demandRequestId, teacherProfileId, message, proposedTimeSlots, status`，建議 `proposedPrice`） | 不存在 | D4/D5/D6，Slice 1 |
| Edit response | Spec 稱「僅限 selected 前」可編輯 | 無程式碼 | D9（明確詢問是否納入 V1） |
| Shortlist/select | Spec 定義完整 state machine 含 shortlist/select | 不存在，且**明確排除**於本輪（見第 3 節） | 留給下一份獨立 plan |
| `AdminNote`/`Notification` | Spec 列為 Data Requirements | 皆不存在於 schema | 本輪不建立（D14 延後 notification；AdminNote 與本 feature 無關） |

### 2.9 Route map 現況

`docs/product/route-map.md` 已定義 `/teacher/demands`（查看 eligible demand requests）、`/teacher/demands/[demandRequestId]`（查看詳情並提交 response）、`/organizer/demands/[demandRequestId]`（查看需求詳情、老師回覆與 matching 狀態）。**Route Guard 原則**已寫：「其他 `/teacher/*` workspace routes 必須只允許 Teacher 或 Admin；未 approved 的 Teacher 只能進入 onboarding / profile 相關頁。Demand response、eligible demand pool、availability 與 class session 能力必須另外檢查 TeacherProfile status 與 service-layer permission。」→ 與本 plan 的 D1/第 4 節安全規則一致，**route-map 本身不需修改**（既有文字已涵蓋本 feature 的 guard 精神），但需在 Slice 0 確認並補上「Organizer read-only 查看 responses」若尚未涵蓋在 `/organizer/demands/[demandRequestId]` 的既有描述中（目前描述已含「老師回覆」，語意已涵蓋，僅需在 spec/data-model 補充欄位級細節）。

### 2.10 上游 interface 依賴總結

本 plan 之後所有涉及 `DemandRequest` 讀取/狀態判斷/欄位存取的 slice，皆依賴以下上游成果（依 Organizer draft plan 第 5.1 節已確認的形狀）：

1. `DemandRequest` model 於 schema **commit**（Organizer draft plan Slice 1；**現況：已存在於 working tree，尚未 commit**，見 2.1/2.10 節首段）且已 migrate（Slice 2，尚未開始）。
2. 至少有 `status = "published"` 的資料存在（Organizer draft plan Slice 4 draft/submit + Slice 7 admin publish）。
3. Organizer 端有 own-scoped 讀取 service（`getOwnDemandRequestDetail` 或等價物，Organizer draft plan Slice 4）可供本 plan 的 Organizer read-only response 顯示 slice 掛載或至少確認欄位形狀。
4. `DemandRequest.organizerProfileId` / `organizationId` 的 FK 與 `onDelete` 政策（Organizer draft plan D15）已定案，以便本 plan 的 smoke seed 清理順序正確（`DemandResponse → DemandRequest → ...`）。

若上述任一項未拍板/未落地，本 plan 相依的 slice **只能停留在 domain-only（schema + 純函式驗證邏輯）規劃/施工**，不得產出可端到端執行的 route/UI slice（見第 10 節）。

---

## 3. Scope Boundary

### 3.1 本輪 in-scope

- Teacher demand pool list（`/teacher/demands`，published-only、approved-teacher-only）。
- Teacher demand detail（`/teacher/demands/[demandRequestId]`，資料最小化 DTO）。
- Server-side approved Teacher capability check（`requireApprovedTeacher()` 或等價 helper）。
- Published-only visibility（demand pool 查詢條件）。
- Demand detail DTO / allowlist 與資料最小化（避免暴露 Organization/Organizer 私人資料）。
- `DemandResponse` Prisma/data-model planning（schema 尚未落地，本輪規劃形狀）。
- Teacher submit response（含受控/長度驗證）。
- Teacher 查看自己的 response（status、內容）。
- Teacher withdraw allowed response（未 selected 前）。
- Organizer read-only 查看自己 demand 收到的 responses（不可 shortlist/select，此輪唯讀）。
- 必要的 domain/service/state rules。
- Security、RWD、brand 與 Playwright smoke planning。

### 3.2 本輪明確不包含（Non-goals）

- **shortlist**
- **selected response（select 動作本身）**
- **matching decision**
- ClassSession creation
- Enrollment
- Teacher availability calendar
- automatic availability matching
- AI recommendation/ranking
- competitive bidding
- payment/refund
- email/notification
- public demand pool（未登入或非 approved teacher 可見的公開版本）
- teacher contact with organizer outside controlled response（無私訊、無聯絡資訊交換）
- Google Calendar sync
- Wellness / Academy / Retreat
- native app

> **`shortlist`、`select` 與 `matched` 必須明列為下一個獨立 core-flow plan**（暫名 `demand-response-matching-and-selection-plan`），**不可偷偷併入本 plan**。理由：`select` 觸發 `DemandRequest: teacher_responded → matched`、涉及「同一 demand 只能一個 selected response」的併發保護、涉及後續 ClassSession 建立前提，屬於獨立且高風險的 core-flow，混入本輪會違反 `docs/harness/mvp-slicing.md` 的「不混合多個高風險邊界」原則。

---

## 4. 安全與權限設計（貫穿所有 slice）

所有權限**必須在 server/domain layer 檢查**，UI 隱藏只是體驗，不是安全依據（`permissions-matrix.md` 開宗明義）。以下為本 feature 的權威規則，各 slice 必須逐條落實，測試 slice 必須逐條負向測試：

1. **所有 pool/detail 查詢都在 server/domain layer 檢查 `TeacherProfile.status === "approved"`。**
   - `draft`、`submitted`、`rejected`、`suspended` teacher（含未建立 `TeacherProfile` 的一般 signed-in user）**一律不可**查看 demand pool 或 demand detail 的 eligible 內容。
   - capability helper（如 `requireApprovedTeacher()`）一律以 `where:{ userId: currentUser.id }` 解析，**不接受 client 傳入 `teacherProfileId` 來斷定「我是 approved teacher」**。
2. **只能讀取 allowed published/eligible demand。** Demand pool 與 demand detail 的查詢條件必須包含 `status: "published"`（或依 D1 決定的 eligibility 條件），**不得僅由 UI 隱藏 private demand**——同一份 domain 查詢邏輯必須同時用於 list 與 detail，避免「list 有 filter、detail 忘記 filter」的漏洞（例如直接猜 demand id 存取未 published 或不 eligible 的 demand）。
3. **Teacher 只能建立、查看、修改或 withdraw 自己的 response。**
   - 建立：`teacherProfileId` **一律由 server 從 session 解析**（`currentUser.id → TeacherProfile`），且**額外要求** `TeacherProfile.status === "approved"`（不接受 client 傳入值決定 own 資源）。
   - 查看/withdraw own response：一律 `where:{ id, teacherProfileId: <own> }`（先解析自己的 `teacherProfileId` 再用於 where），**不信任 client 傳入的 `teacherProfileId` 或 `demandResponseId` 之外的 ownership 判斷**。
   - **「查看 own response」與「approved-teacher-only 的 demand pool/detail eligibility」是兩條獨立規則，不可用同一個 `requireApprovedTeacher()` gate 混為一談**：查看 own response 只要求 `requireUser()` + 存在（任意 status 的）own `TeacherProfile`，不要求 approved、也不要求該 response 對應的 `DemandRequest` 當下仍為 eligible 狀態（見 D10、D12 與其「落地機制」段落）。只有「建立新 response」與「withdraw」才分別要求 approved（withdraw 額外要求，見 D12）與 demand 當下 eligible（建立時，見規則 8）。
4. **Organizer 只能查看自己 `DemandRequest` 收到的 responses。**
   - `organizerProfileId` 一律 server 解析自 `currentUser.id`（依 Organizer draft plan 的 `getOwnOrganizerContext()` 或等價 helper，本 plan 不重新實作 organizer capability，只消費其介面——若該介面尚未落地，本 slice 停在 domain-only）。
   - 查詢 responses 一律 `where:{ demandRequest: { id, organizerProfile: { userId: currentUser.id } } }`，不得只靠 client 傳入的 `demandRequestId` 定位。
5. **不可信任 client 傳入的 `teacherProfileId`、`organizerProfileId`、`demandRequestId`、`demandResponseId` 作為 ownership 依據。** 這些 id 只能用於「等值驗證」（例如 `where` 條件的一部分），本身不能作為授權來源。
6. **對 unauthorized / cross-owner resource 優先使用 not-found semantics**，避免洩漏資源存在性差異（例如 Teacher A 猜 Teacher B 的 `demandResponseId` 應得到與「不存在」一致的回應，不得回傳「此 response 不屬於你」之類洩漏存在性的訊息）。
7. **Prisma composite unique constraint 防止 concurrent duplicate response**（見 D8 的具體形狀選項與 trade-off）；不能只靠 UI 或 service 層 `findFirst` 後才 `create` 的 check-then-write 模式防止重複。
8. **mutation 需驗證 demand 當下仍允許 response，避免 TOCTOU（time-of-check to time-of-use）**：submit response 的寫入必須是**單一原子語句**內同時確認「demand 當下仍為 eligible 狀態」與「該 teacher 尚無有效 response」，**不得**用「先 `findUnique` 讀 `DemandRequest.status`，確認 published 後再呼叫 `prisma.demandResponse.create`」這種分開兩步的 check-then-write（即使包在 `prisma.$transaction` 內，預設 Read Committed 隔離層級下，這兩步之間 `DemandRequest.status` 仍可能被另一個 session 的 admin/organizer 動作改變，`$transaction` 本身不會重新檢查 SELECT 過的資料是否仍成立——這是本輪 review 已被指出的具體缺口，必須用底下的原子手法取代）。
   - **具體落地手法**：仿照既有 `updateMany({ where:{ id, status:"submitted" } })` 的「單一 SQL 語句內建 guard」精神，但 `create` 沒有原生等價寫法，因此改用 **raw SQL 的 `INSERT ... SELECT ... WHERE EXISTS`**（透過 `prisma.$queryRaw`/`$executeRaw`）：
     ```sql
     INSERT INTO "DemandResponse"
       (id, "demandRequestId", "teacherProfileId", message, "proposedTimeSlots", "proposedPrice", status, "createdAt", "updatedAt")
     SELECT gen_random_uuid()::text, $1, $2, $3, $4, $5, 'submitted', now(), now()
     WHERE EXISTS (
       SELECT 1 FROM "DemandRequest" WHERE id = $1 AND status = ANY($6::"DemandRequestStatus"[])
     )
     RETURNING *;
     ```
     （`$6` 為依 D1 的 `eligibleStatuses` 集合；若 D11=B，該集合固定為 `{'published'}`。）此語句是單一原子操作，PostgreSQL 保證 `WHERE EXISTS` 子查詢與 `INSERT` 在同一個語句內對同一筆資料的可見性一致，不存在「先讀後寫」之間的空窗期。
   - `RETURNING *` 為 0 列時，代表 demand 當下不 eligible（可能已被改為 published 以外的狀態）——回頭查 `DemandRequest.status` 只用於組出對使用者友善的錯誤訊息（例如「這個需求目前已不開放回應」），不作為授權判斷本身（授權判斷已由上面的原子語句完成）。
   - `@@unique([demandRequestId, teacherProfileId])`（依 D8）由 DB 層在同一句 `INSERT` 內保證；違反時捕捉 Postgres unique violation（error code `23505`）轉譯為 `response_already_exists`，不得讓原始 DB 錯誤訊息外流（呼應第 11 點）。
   - 這個 raw SQL 寫入之後，仍需以一次 `prisma.demandResponse.findUniqueOrThrow({ select: <own DTO> })` 重新讀出型別化的結果供 service 回傳，維持與其餘 domain 一致的型別安全介面。
   - **驗證方式的現實限制**：Playwright smoke 無法可靠製造真正的資料庫層級併發競態。Slice 9 的對應案例改採**循序驗證原子 guard 邏輯是否正確**（例如：先讓一個 session 把 demand 狀態改為非 eligible，再讓 teacher session 嘗試 submit，斷言被擋且錯誤訊息正確）；「單一 SQL 語句具原子性」這件事本身由上述 SQL 手法在資料庫層保證，屬於可由程式碼審查驗證的正確性，不需要、也不可能單靠 Playwright 端到端測試證明。
9. **suspended/non-approved Teacher 不可提交新 response。** 若 Teacher 在已有 submitted response 後被轉為 `suspended`，其**既有** response 的可見性/可 withdraw 性依 D12 決定（不得自行假設）。
10. **DTO 必須資料最小化，不可把整個 Prisma relation 直接傳到 UI。** Demand detail 給 Teacher 看的 DTO、Response 列表給 Organizer 看的 DTO，皆須是 explicit allowlist（見 D3、D13），不得用 Prisma 預設 include 整包 relation。
11. **Server action error 不可暴露 DB 或內部 permission 細節。** 錯誤訊息一律走 discriminated union 的 `code` + 中文溫和 `message`，不得把 Prisma error stack 或 SQL 訊息傳給前端。
12. **長 message、price、time slot 必須有 server-side normalization/validation。** trim、長度上限、受控清單（time slot 若沿用 `String[]` 且有受控清單，須驗證落在允許集合），client-side 驗證僅提升體驗，不是安全依據。
13. **需考慮 response submission 與（若採用）DemandRequest status update 的 transaction。** 若 D11 決定要 persist `published → teacher_responded`，該寫入必須與 `DemandResponse` 的建立包在**同一個 `prisma.$transaction(async (tx) => {...})` interactive transaction**，且 `demand-request` domain export 的 transition helper **必須接受外部傳入的 `tx`**（不得自行開啟/管理獨立 transaction 或使用全域 `prisma` client），避免「response 建立成功但 demand 狀態未同步」或反之的不一致（詳見 D11 選項 A 的具體要求、Slice 4 的落地寫法）。
14. `docs/domain/permissions.md` 的 Security Review Required 清單已列「Demand visibility」「Teacher approval」——本 feature 直接觸碰這兩項，每個相關 slice 的 review 必含 security 檢查。

---

## 5. 產品主人決策 Gate（D1–D16）

> **以下 D1–D16 已於 2026-07-21（D11）與 2026-07-22（其餘）全部拍板，見第 5.1 節決策記錄。** 這些決策改變 data model / state machine / 對外可見性，依 AGENTS.md 屬 product owner confirmation 範圍；每項仍保留選項、trade-off 與推薦方案的完整討論供 Builder 理解決策脈絡，但**推薦方案已是 PO 拍板結果，不是待確認事項**。凡涉及 `DemandRequest` 既有欄位/狀態形狀者，額外標示其對 Organizer draft plan 的依賴程度。

### D1 — Demand eligibility

V1 的 eligible 是否只代表：

- `DemandRequest.status = published`
- `TeacherProfile.status = approved`

還是要額外強制 service area 相符、teaching format 相符、specialty/service type 相符、availability 相符？

- **選項 A（推薦）**：只有上述兩條件。任何 approved teacher 可看見所有 published demand，不做欄位比對過濾。
  - 優點：最小、無需比對邏輯、避免把 demand pool 做成 automatic matching/推薦引擎（任務明確要求避免）；Teacher 自行判斷是否符合專長/地區/時間，這正是既有 spec 的「讓雙方有足夠資訊做決策」精神，而非平台代為篩選。
  - 風險：Teacher 可能看到大量不相關需求。V1 規模小，風險可控；未來若量大可另案加篩選（見 D2）。
- **選項 B**：額外強制 service area / teaching format / specialty 相符才可見。
  - 缺點：這已經是「自動媒合」的雛形——用資料庫條件篩選「誰看得到什麼」等同於系統代為判斷適配性，違反任務指示「避免把簡單 demand pool 變成 automatic matching 或推薦引擎」；且此比對需要 `DemandRequest.serviceType`/`preferredAreas` 與 `TeacherProfile.specialties`/`serviceAreas` 的交集邏輯，屬於新增業務規則，超出 foundation 範圍。
- **推薦：A**。與 D2（filtering，使用者主動選擇而非系統強制）搭配，區分「系統強制可見性（eligibility）」與「使用者自助縮小範圍（filtering）」。
- **與 D11 的關鍵依賴（必須一併裁定，否則會產生真實 bug）**：本節「eligibility」的查詢條件不是單純寫死 `status = "published"`，而是一組 `eligibleStatuses` 集合，其內容依 D11 的裁定而定：
  - 若 **D11 = B（推薦，動態推導，不 persist `teacher_responded`）**：`eligibleStatuses = { "published" }`，即本節描述的預設情況。
  - 若 **D11 = A（persisted write，第一筆 response 時把 `DemandRequest.status` 改為 `teacher_responded`）**：`eligibleStatuses` **必須**同時包含 `{ "published", "teacher_responded" }`（直到 demand 進一步轉為 `matched`/`cancelled`/`expired` 才排除）。理由：`DemandResponse` 允許多位不同 teacher 各自提交一筆（D8 只限制「同一 teacher 對同一 demand 最多一筆」，不是「同一 demand 只能有一筆 response」），且 Organizer read-only 查看的是「responses」複數。若 eligibility 只認 `published`，第一筆 response 送出後 demand 立即從所有其他 approved teacher 的 pool/detail 消失，其餘 teacher 將永遠無法再看到或回應這個需求，直接牴觸「收集多位老師回應」的預期流程。**Slice 3 的查詢條件必須參照此處的 `eligibleStatuses`，不得寫死單一狀態值。**

### D2 — Pool filtering

V1 是否只提供最小 filters（area / service type / preferred time summary），或第一版只做 published list，不做 filters？

- **選項 A（推薦）**：V1 只做 published list，**不做 filters**。
  - 優點：foundation 最小；避免一次把 list、filter UI、filter query 都做進同一個 slice（違反 mvp-slicing「不混合多個目的」）；filters 可作為明確的 fast-follow standard slice。
- **選項 B**：提供最小 filters（area / service type / preferred time summary）。
  - 優點：demand 量大時可用性更好。缺點：filter UI 與 query 邏輯是額外一個需要獨立驗收的目的，且 filter 選項依賴 D1 決定的受控清單是否與 `DemandRequest` 欄位（Organizer draft plan D5–D7）一致，屬於跨 plan 依賴，會拖慢 foundation 落地。
- **推薦：A**（V1 無 filter，只有 published list，依 D15 做基本 pagination/ordering）。filters 留待 PO 觀察實際 demand 量後決定是否要開下一個 standard slice。

### D3 — Demand detail data boundary（Teacher 可見的 Organization/Organizer 欄位）

Teacher 在 demand detail 可看到哪些 Organization/Organizer 資料？必須設計 explicit DTO/field allowlist。

- **推薦 allowlist（僅此）**：
  - 來自 `DemandRequest`：`title`、`serviceType`（受控字串）、`description`、`targetLevel`、`expectedParticipants`、`preferredAreas`、`preferredTimeSlots`、`classLengthMinutes`、`frequency`、`preferredStartDate`（若有）、`budgetRange`（若有，且依品牌規則呈現方式見第 6 節）、`status`（僅用於判斷可否 response，不需完整暴露內部狀態機細節給 UI 之外的意義）、`createdAt`/`publishedAt`（若有）。
  - 來自 `Organization`：**僅** `name`、`type`（用於「這是什麼樣的團體」的脈絡判斷）。
  - **明確排除**：`Organization.contactEmail`、`contactPhone`、`contactName`（私人聯絡窗口，任務指示明確排除私人 email/phone）、`Organization.address`（若有，同排除）、`OrganizerProfile` 的任何欄位（`displayName` 等——Teacher 在 response 前不需要知道特定 organizer 是誰，避免繞過平台私下聯絡）、任何 `rejectionReason`（`DemandRequest` 若有，屬於 organizer-facing，不對 teacher 顯示）、任何 admin 內部欄位。
- **技術落地方式**：Prisma `select`（不用 `include`）明確列出上述欄位，組成獨立的 `TeacherFacingDemandDetail` type，**不得**回傳 Prisma 原生 `DemandRequest & { organization: Organization }` 型別給 UI 層。
- **PO 已確認**：`budgetRange` **顯示**給 teacher（品牌考量，見第 6 節），但呈現方式須符合「視覺次要、不作為排序依據」原則——不得做成排序欄位或以顯著樣式強調。

### D4 — `DemandResponse` model 欄位

比較並決定至少：`demandRequestId`、`teacherProfileId`、`message`、`proposedTimeSlots`、`proposedPrice`、`status`、timestamps、unique constraint、indexes。

- **推薦欄位形狀**：
  ```text
  DemandResponse {
    id               String   @id @default(cuid())
    demandRequestId  String
    teacherProfileId String
    message          String?
    proposedTimeSlots String[] @default([])
    proposedPrice    String?          // 見 D5
    status           DemandResponseStatus @default(submitted)
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt

    demandRequest  DemandRequest  @relation(fields: [demandRequestId], references: [id], onDelete: Cascade)   // prerequisite：依存於 DemandRequest 落地
    teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)

    @@unique([demandRequestId, teacherProfileId])   // D8 已拍板：全表終身唯一（withdraw 後不可再對同一 demand 建立新 response）
    @@index([demandRequestId])
    @@index([teacherProfileId])
    @@index([status])
  }
  ```
- `message` **必填**（PO 已確認，品牌考量——一個空白的 response 不符合「專業、溫和、具體」的品牌語氣要求，見第 6 節），trim 後長度 **10–1000 字**（定案值，對齊既有 `rejectionReason` 的驗證慣例，非範例）。
- `demandRequest`/`teacherProfile` 的 `onDelete`：**PO 已確認**——`teacherProfile` 側 `Cascade`（teacher 帳號刪除時 response 隨之刪除，避免孤兒列與既有 `User → TeacherProfile onDelete: Cascade` 一致）；`demandRequest` 側**確定為 `Cascade`**（Organizer draft plan D15 已拍板 `DemandRequest → Organization` 為 `Restrict`，但 `DemandResponse → DemandRequest` 是獨立的技術一致性決定：demand 若真被刪除，其收到的 response 應隨之清除，避免孤兒列，不受 `Organization` 端政策牽動）。Slice 1 直接以此兩個 `Cascade` 施工，不需再確認。
- **此欄位形狀整體依賴 `DemandRequest` model 已存在**（prerequisite contract）；`demandRequest` 這條 relation 要求對方 model 已存在於 `schema.prisma` 文字內容中（Prisma 語法要求）。**現況（2026-07-22）**：`DemandRequest` 已存在於 working tree 的未 commit `schema.prisma`（Organizer draft plan Slice 1，見 2.1/2.10 節），技術上已滿足「model 存在」的語法前提；但**本 plan 的 Slice 1 仍不應在 Organizer draft plan 的 Slice 1 schema 變更 commit 前動筆**，避免兩個 session 同時編輯同一份 `schema.prisma` 造成衝突或覆蓋對方尚未 commit 的內容（見 Slice 1 的 stop condition）。

### D5 — `proposedPrice` 儲存方式

比較 `String?` / `Int?`（最小貨幣單位）/ Prisma `Decimal?`。

- **選項 A（推薦）— `String?`**：對齊既有 `TeacherProfile.priceRange String?` 慣例（同樣是「參考收費區間」性質，非結構化金額）。允許 teacher 填「依實際安排討論」「約 NT$ 1,500–2,000/堂（可再議）」等自然語言區間，而非強制單一數字。
  - 優點：V1 無 payment，`proposedPrice` 純資訊性，不需要精確計算或加總；避免用結構化數字欄位暗示「可排序比價」（品牌風險，見第 6 節）；serialization 簡單（字串直接顯示，無幣別/精度問題）。
  - 代價：無法做數值排序/篩選（但 D1/D2 已排除自動排序，此非缺點）；未來若要接 payment，需要遷移為結構化欄位（屬已知的未來 migration，非本輪負擔）。
- **選項 B — `Int?`（最小貨幣單位，如分）**：結構化、精確，適合未來接金流。
  - 缺點：V1 無 payment，過早結構化；容易誤導 UI 呈現成「單一價格」而非「區間」，與品牌「非比價工具」原則衝突；serialization 需額外幣別欄位（V1 只有 TWD，隱含假設）。
- **選項 C — Prisma `Decimal?`**：精確金額計算，適合正式財務系統。
  - 缺點：V1 無任何金額計算需求，過度設計；JSON serialization 需額外處理（`Decimal` 非原生 JSON 型別）。
- **推薦：A（`String?`）**。若 PO 認為 V1 就需要結構化價格以利未來 payment 對接，可選 B，但需接受「呈現為單一數字」的品牌風險必須額外用 UI copy 弱化（例如加註「僅供參考，實際依討論確認」）。

### D6 — `proposedTimeSlots` 儲存方式

- **推薦：`String[] @default([])`**，對齊既有 `TeacherProfile.serviceAreas`/`specialties` 與**已拍板**的 `DemandRequest.preferredTimeSlots`（Organizer draft plan D6/D7，見前段）的慣例。
- **依賴狀態（Organizer draft plan D6/D7 已拍板，2026-07-21）**：`DemandRequest.preferredTimeSlots` 已確定用 `String[]`，受控清單已**定案**為 6 項：`平日早上`/`平日午間`/`平日晚上`/`週末早上`/`週末午間`/`週末晚上`。**`DemandResponse.proposedTimeSlots` 應沿用同一份清單常數**（供 UI 呈現「老師可配合時段」與「團主偏好時段」的交集比對，即使本輪不做自動比對，共用清單仍有助於使用者自行判斷）。此欄位形狀已不再是暫定推薦——但實際 `service-types.ts`/常數模組須等 Organizer draft plan 的 Slice 4 落地後才能真正 import/共用，本 plan 施工前仍須確認該常數模組已存在且內容與此處記載一致。
- 至少一項驗證：submit 時 `proposedTimeSlots` 至少一項（對齊 `docs/product/form-field-spec.md` Demand Response Form 的「必填」標記）。

### D7 — Response status enum

完整 enum：`submitted / shortlisted / selected / declined / withdrawn / expired`（對齊 `docs/domain/data-model.md`、`state-machines.md`、`demand-response-and-matching-spec.md`）。

- **推薦（比照 Organizer draft plan D9 對 `DemandRequestStatus` 的處理原則）**：`DemandResponseStatus` enum **一次定義完整 6 個值**，但本輪**只接線** `submitted` 與 `withdrawn` 兩個 transition（`(none) → submitted`、`submitted → withdrawn`）。`shortlisted`、`selected`、`declined`、`expired` 為**已定義但未接線**的保留值，供下一份 matching plan 使用，避免該 plan 又要多跑一次 enum migration。
- **必須清楚區分（schema/文件皆須標註）**：
  - **enum exists**：全部 6 值皆在 Prisma enum 中。
  - **runtime transition implemented**：本輪只有 `submitted`（建立時預設）與 `withdrawn`（Teacher 主動 withdraw）。
  - **future/unwired**：`shortlisted`/`selected`/`declined`/`expired` 沒有任何 service function 可寫入，僅作為 schema 預留。

### D8 — Duplicate response policy（含 race condition）

同一 Teacher 對同一 DemandRequest：終身只能一筆 response / withdrawn 後可重新提交同一筆（原地復用）/ withdrawn 後建立新 response？

- **技術限制先說明**：Prisma schema 的 `@@unique([demandRequestId, teacherProfileId])` 是**對整張表**生效的複合唯一鍵，無法只針對「非 withdrawn」的列生效（Prisma 原生不支援 partial/filtered unique index；若要「withdrawn 後可再建新列」，需要 partial unique index，Prisma 需以**手寫 raw SQL migration**達成，且 Prisma Client 層無法自動感知該限制，`create` 前仍需自行處理衝突分支）。
- **選項 A（推薦）— 終身一筆（lifetime one response）**：`@@unique([demandRequestId, teacherProfileId])` 對整表生效，withdraw 後**不可再對同一 demand 建立新 response**，也不可將 withdrawn response 復活。
  - 優點：schema 最小、DB 層原生保證唯一、無需 partial index、無 race condition 死角；且與現有 `state-transition-details.md` 一致——文件中 `withdrawn` 是**終止狀態**，並未定義任何「withdrawn → submitted」或「withdrawn 後建立新列」的 transition，選 A 是對既有文件最保守、無需新增未文件化 transition 的選擇。
  - 風險：Teacher 誤 withdraw 後無法補救（只能等 demand 有新一輪或聯繫平台）。V1 可接受（demand 生命週期短，且這是使用者主動動作的自然後果）。
- **選項 B — withdrawn 後可重新提交同一筆（原地復用，`withdrawn → submitted`）**：需新增未文件化的 transition，且需重新驗證/覆蓋 `message`/`proposedTimeSlots`/`proposedPrice`。
  - 缺點：`state-transition-details.md`/`state-machines.md` 目前明確把 `withdrawn` 列為終止狀態，選 B 等於新增一條未經 PO 在既有 state machine 文件拍板的 transition，需要額外的 docs 修改與審視（不只是本 feature 決策，還牽動既有 state machine 文件的權威性）。
  - **若 PO 選 B**：必須同時裁定是否也要修改 `docs/domain/state-machines.md`/`state-transition-details.md` 的既有 `DemandResponse` 狀態機定義（新增 `withdrawn → submitted`），並重新評估這是否仍算「foundation」還是應歸入下一份 matching plan。
- **選項 C — withdrawn 後建立新 response（新列）**：需要 partial unique index（raw SQL）或移除 unique constraint 改用 service 層檢查「無 active（非 withdrawn/declined/expired）response」再 `create`，並用 `prisma.$transaction` + `SELECT ... FOR UPDATE`-等價手法（Prisma 可用 `Serializable` isolation transaction）防止併發下重複建立 active response。
  - 優點：保留完整歷史（每次 withdraw 後的新嘗試都有紀錄）。缺點：技術複雜度最高，需要 raw SQL 或 transaction isolation 手法，超出 foundation 應有複雜度。
- **推薦：A**。若 PO 需要「可修正後重新提交」的體驗，建議先以「withdraw 後仍可查看 demand detail 頁但顯示已無法再提交」作為 V1 的誠實呈現，未來若確定需求再開獨立 slice 升級到 B 或 C（連帶處理 state machine 文件修改）。

### D9 — Edit policy（submitted response 是否可編輯）

- **既有文件狀態**：`docs/domain/permissions.md`/`permissions-matrix.md`/`demand-response-and-matching-spec.md` 皆已寫「Teacher 可編輯或 withdraw 自己 selected 前的 response」——即「edit」在既有文件中**已經被列為既定政策**，但本次任務給的 in-scope 清單（見引言）只明確列出「submit」「查看」「withdraw」，**未明確列出「edit」**。
- **選項 A（推薦，V1 不可編輯，只能 withdraw）**：V1 **不提供** update-in-place 編輯；Teacher 若要修改內容，只能 withdraw（依 D8=A，withdraw 後不可再對同 demand 提交）。
  - 優點：foundation 最小，避免「edit 需要重新驗證/重新檢查 demand 仍可回應/是否需要 re-notify organizer」等額外規則；與 D8=A（終身一筆）自然一致——若允許 edit，實務上就不太需要「withdraw 後不能重來」這麼嚴格，兩者要一起看。
  - **與既有文件的落差**：需在 Slice 0 於 `docs/specs/demand-response-and-matching-spec.md`/`permissions-matrix.md` 明確註記「V1 foundation 暫不實作 edit-in-place，Teacher 修改內容須先 withdraw；若未來開放 edit，需重新評估 D8 的 duplicate policy」，避免文件與 runtime 無聲漂移（比照 teacher-rejection D7、organizer D14 的既有處理方式）。
- **選項 B — selected 前可編輯（update-in-place）**：對齊既有文件字面意義。
  - 需額外決定：edit 後是否要求重新驗證（可能）、是否需要限制編輯次數、是否要通知 organizer（本輪 notification 延後，故不做）、與 D8 的交互（若可 edit，通常不需要「withdraw 後不能重建」這麼嚴格，因為 edit 已滿足「修正」需求）。
  - 若 PO 選 B，需同步升級 D8 討論（edit 是否取代部分 withdraw 情境）。
- **推薦：A**，且**明確承認與既有文件的落差**（非默默偏離）。

### D10 — Withdraw policy

哪些狀態可以 withdraw？Demand 已不再 published、cancelled、expired 或 matched 時如何處理？

- **推薦**：Teacher 可 withdraw 的**必要條件**是「自己的 response 目前是 `submitted`」（依 D7，本輪未接線 `shortlisted`，故無需考慮該分支）。**不論 `DemandRequest` 當下狀態為何**（即使 demand 已被 admin cancel/expire，或已 matched 給其他 teacher），只要該 teacher 自己的 response 尚未被標記為 `selected`/`declined`/`expired`/`withdrawn`，withdraw 動作本身（「我不要再等這個機會了」）**應允許**——因為 withdraw 是 teacher 單方面退出的意思表示，不需要 demand 端配合。
  - 理由：withdraw 對 demand 本身無副作用（本輪不做 `DemandRequest` 狀態聯動於 withdraw），风险最低；若限制「demand 必須仍是 published 才能 withdraw」，反而會出現「demand 被 cancel 後 teacher 卡住無法 withdraw 自己的 response」的體驗死角。
  - **例外（安全預設）**：若該 response 已是 `selected`（本輪未接線，理論上不會出現，但防禦性寫死）——**不可** withdraw（對齊 `state-transition-details.md`「`selected` response 不可由 Teacher 自行 withdraw」的既有禁止條件）。
- 技術落地：`updateMany({ where:{ id, teacherProfileId: <own>, status: "submitted" }, data:{ status: "withdrawn" } })`，`count===0` 回頭查判斷 not-found / not-own / wrong-status（比照既有 approve/reject 併發安全模式）。

### D11 — DemandRequest status side effect（`published → teacher_responded`）

第一筆有效 response 是否寫入該 persisted 狀態轉換，或由 response count 動態推導？**此為任務明確要求「提出方案並交由產品主人決定」的項目。**

- **關鍵限制**：`DemandRequest` 屬於**另一個 domain**（Organizer draft plan 的 `src/domain/demand-request/*`；該 plan D1–D15 已拍板，但程式碼尚未落地）。本 plan 若要直接寫入 `DemandRequest.status`，會產生**跨 domain 寫入耦合**——`demand-response` domain 直接對 `demand-request` 的表做 mutation，違反「沿用 pattern 不沿用 module、各自獨立」的既有原則，也讓 `DemandRequest` 的 state guard（哪些來源可轉到哪個狀態）分散在兩個 domain 裡維護，增加未來不一致風險。
- **選項 A — Persisted write（在 response 建立時透過 transaction 一併寫入 `DemandRequest.status`）**：
  - 作法：`demand-response` domain 呼叫 `demand-request` domain **exported 的 transition-safe function**，但該函式**必須接受一個 `Prisma.TransactionClient` 參數**而非使用全域 `prisma` client——例如 `markDemandRequestAsRespondedIfPublished(tx: Prisma.TransactionClient, demandRequestId: string)`，內部用 `tx.demandRequest.updateMany({ where:{ id, status:"published" }, data:{ status:"teacher_responded" } })`。呼叫方（`demand-response` domain）必須以 `prisma.$transaction(async (tx) => { ... })` 的 **interactive transaction** 形式，在同一個 `tx` 內先執行第 4 節規則 8 的原子 `INSERT`（`tx.$queryRaw`/`tx.$executeRaw`），確認插入成功後**在同一個 `tx`** 內呼叫這個 helper；兩個寫入必須共同 commit 或共同 rollback——**不得**先在一個 transaction/連線內完成 `INSERT`，再用另一次獨立呼叫（不同 transaction、甚至不同 client 實例）去更新 `DemandRequest.status`，那樣若第二步失敗，會產生「response 已建立但 demand 狀態未同步」的不一致（這正是本輪 review 具體指出的缺口）。此為**必要的 upstream contract 要求**：`demand-request` domain 若要支援 D11=A，其 export 的 transition helper 介面簽章必須是「接受外部傳入的 transaction client」，而非自行開啟/管理 transaction。
  - 優点：`DemandRequest` 狀態忠實反映「已有老師回應」，未來 admin/organizer 查詢可直接依狀態篩選，不需即時 count。
  - 代價：**強依賴 `demand-request` domain 必須先 export 這樣一個 transition helper**——這是 Organizer draft plan 目前完全沒有規劃的介面（其 Slice 4/7 只規劃了 draft/submit/publish/reject，未規劃「teacher 端觸發的狀態轉換」）。若採 A，等於本 plan 對 Organizer draft plan 提出**新的介面需求**，必須列為明確的 upstream contract 要求，不能自行在 `demand-response` domain 內對 `DemandRequest` 表做 raw `prisma.demandRequest.updateMany`（那會繞過 organizer domain 的封裝、造成兩個 domain 對同一張表各自寫 guard 邏輯，難以維護）。
  - **必要的連動修正（否則會產生真實 bug）**：一旦選 A，D1 的 `eligibleStatuses` **必須**同步改為 `{ "published", "teacher_responded" }`，且 `markDemandRequestAsRespondedIfPublished` 只應在 demand **目前沒有任何其他 teacher_responded 標記時**執行第一次轉換（`updateMany` 的 `where: { status: "published" }` guard 本身已保證這點——第二位、第三位 teacher 提交時 `updateMany` 會因 `status` 已是 `teacher_responded` 而 `count === 0`，不需視為錯誤，直接略過狀態寫入即可，只需成功建立各自的 `DemandResponse`）。此細節必須在 Slice 4（若採 A）明確寫成 acceptance criteria，避免 Builder 誤把「第二位 teacher 的狀態轉換 `count===0`」當成錯誤而擋下其 response 建立。
- **選項 B（推薦，V1 起點）— Dynamic derivation（不 persist，動態推導）**：不寫入 `DemandRequest.status`，`DemandRequest` 狀態機維持只有 organizer/admin 動作驅動的轉換（`draft→submitted→published|rejected`，依 Organizer draft plan）。「這個 demand 是否已有老師回應」由**查詢 `DemandResponse` 是否存在該 `demandRequestId` 的任一非 withdrawn 列**動態判斷，供 UI 呈現（例如 organizer demand list 顯示「已有 N 位老師回應」文字提示），不改變 `DemandRequest.status` 本身。
  - 優点：完全不需要跨 domain 寫入耦合，本 plan 的所有 slice 可以獨立於 Organizer draft plan 是否提供額外 transition helper 而落地（只要能**讀** `DemandRequest` 即可）；`DemandRequest` 的 state machine 維持單一 domain 擁有者（organizer/admin 動作驅動），符合既有 `docs/domain/state-transition-details.md`「所有狀態變更都應集中在 domain/service layer」但不要求「集中在單一 domain」的精神做更嚴格的收斂。
  - 代價：`DemandRequest.status` 欄位本身**永遠不會出現 `teacher_responded` 這個值**（除非未來 Organizer/Admin 端也想要這個狀態文字，屆時另案評估是否要由 organizer/admin 動作或排程重新計算後寫入)。這與 `docs/domain/state-machines.md` 文件定義的完整狀態機（`published → teacher_responded → matched`）有落差，**必須在 Slice 0 明確承認**：V1 foundation 採動態推導，`teacher_responded` 狀態值暫不接線寫入，留待下一份 matching plan（該 plan 若要接線 `select`，屆時很可能需要同時處理 `teacher_responded` 的寫入時機，一併解決會比現在倉促決定更完整）。
- **推薦：B**。理由：(1) 避免本 plan 對 Organizer draft plan 強加新介面需求（即使其 D1–D15 已拍板，也不包含這類 teacher 端觸發的 transition helper）；(2) 降低跨 domain 耦合，讓本 plan 的 slice 依賴面更小、更容易獨立 review/rollback；(3) `teacher_responded` 這個狀態的「持久化時機」本質上與「select 何時發生」高度相關（例如是否要在 selected 之後才把 teacher_responded 意義上收斂），與下一份 matching plan 一起決定更不會走回頭路。
- **PO 決策記錄**：產品主人已於 2026-07-21 就本項**率先單獨**確認採**選項 B（動態推導，不 persist）**——確認時機早於本 plan 其餘 D1–D10/D12–D16 的正式拍板，原因是 Organizer demand draft plan 需要在其自身決策記錄中引用本項結果（見該 plan 第 5.1 節「跨 plan 依賴確認」）。此確認**只涵蓋 D11**：`DemandRequest` 狀態機維持只由 Organizer/Admin 動作驅動，本 plan 不需要、也不會要求 Organizer draft plan 新增任何 transition helper 介面。**本 plan 其餘 D1–D10、D12–D16 已於 2026-07-22 全數確認**（見第 5.1 節決策記錄），High-risk Planning Gate 已解除。

### D12 — Suspended Teacher 的既有 response

Teacher 從 `approved` 變成 `suspended` 後：是否仍可查看自己的既有 response？是否可 withdraw？Organizer 是否仍可看到？是否自動 declined/expired？

- **推薦（安全預設，不發明新 workflow）**：
  - **查看既有 response：允許**。`suspended` 只禁止「新建能力」與「公開顯示」（`state-transition-details.md`：「`suspended` teacher 不可公開顯示或建立新 response」），並未文件化禁止「查看自己過去已建立的資料」；比照既有 `TeacherProfile` 本身在 `suspended` 狀態下 teacher 仍可查看自己的 dashboard（`teacher/dashboard/page.tsx` 的 `suspended` 分支只說明狀態，未阻擋存取）。故 own response 的**讀取**不额外限制 suspended。
  - **Withdraw：不允許**。`suspended` 語意是「帳號目前暫停中」，允許暫停帳號還能對外採取「withdraw」這種會影響 organizer 端可見資訊的主動動作，與「暫停」精神衝突；且 D10 已把 withdraw 定位為「單方面退出」，暫停帳號不應保留這個能動性。技術上：capability check 在 withdraw service 額外要求 `teacherProfile.status === "approved"`（不只要求「是 own response」）。
  - **Organizer 是否仍可看到：允許（不改變）**。這是已經發生的歷史回應，Organizer 的決策資訊不應因老師事後被停權而消失（避免造成「回應憑空消失、organizer 疑惑」的體驗）；且本輪不做自動變更 response 狀態，維持資料一致性最簡單。
  - **是否自動 declined/expired：不做**。任務指示「避免自行發明 suspend workflow」——自動轉換 response 狀態屬於新的業務規則（需要決定觸發時機、是否通知、是否影響其他 teacher 的機會），明確超出 foundation 範圍，**留待 PO 未來另案決定**，本輪 `suspended` 對既有 `DemandResponse.status` 沒有任何自動副作用。
- 以上四點**已由 PO 於 2026-07-22 全部確認採推薦預設**（見第 5.1 節決策記錄）。
- **落地機制（必要，否則 D12 只是政策宣示、無法真正運作）**：「查看既有 response 允許」這條裁定，**不能**透過 Slice 3 的 `requireApprovedTeacher()` 或「demand 當下必須仍是 eligible 狀態」來實作——這兩者都會直接擋掉 suspended teacher 或 demand 已離開 published/eligible 狀態的情境，與 D10（withdraw 不論 demand 當下狀態為何皆可執行）、D12（suspended 仍可查看）互相矛盾。因此：
  - **own-response 的讀取路徑必須是獨立於 pool/demand-detail eligibility 的一條規則**：只要求 `requireUser()` + 該 user 存在（任何 status 的）`TeacherProfile`，據此解析 `teacherProfileId`，再以 `where:{ demandRequestId, teacherProfileId }` 讀取 `DemandResponse`（若存在）。**不檢查** `TeacherProfile.status` 是否 approved，**不檢查** `DemandRequest.status` 是否仍 published/eligible。
  - **withdraw 的寫入路徑維持較嚴格的 gate**：除 `where` 需要 `status: "submitted"`（狀態守衛）外，額外要求 `teacherProfile.status === "approved"`（依 D12，suspended 不可 withdraw）。
  - 供頁面顯示用的「demand 基本資訊」（如 title）：既然 teacher 是在該 demand 仍 eligible 時合法提交了 response，事後查看自己 response 所屬的 demand 標題等最小上下文，不構成新的資料外洩，**可用獨立、不受 eligibility 條件限制的最小 `select`**（僅 `title`，不含完整 D3 allowlist）取得，與「瀏覽 pool 的 eligibility 查詢」是兩條不同的查詢路徑。
  - 詳細落地見 Slice 4（新增 own-response 讀取函式）與 Slice 7（page 邏輯重整）。

### D13 — Organizer response visibility（TeacherProfile 欄位 allowlist）

Organizer 可看到 `TeacherProfile` 哪些欄位？

- **推薦 allowlist（僅此）**：`displayName`、`bio`、`teachingStyle`、`experienceYears`、`specialties`、`serviceAreas`、`teachingFormats`、`profilePhotoUrl`。以及該 teacher 這筆 `DemandResponse` 的 `message`、`proposedTimeSlots`、`proposedPrice`、`status`、`createdAt`。
- **明確排除**：`TeacherProfile.rejectionReason`（内部/teacher-facing 專用，與 organizer 無關）、`TeacherProfile.certifications`/`priceRange`（V1 建議排除以避免變相比價工具——`priceRange` 是老師的一般收費參考，若同時顯示會強化「比較列表」觀感；`certifications` 屬建議欄位，可視 PO 意見決定是否納入，非本輪必要）、`User.email`/`User.phone`（老師私人聯絡方式，避免 organizer 繞過平台直接聯絡）、`User.id`（無需暴露內部 id 以外的識別）。
- **技術落地**：Prisma `select` 明確列出，組成 `OrganizerFacingResponseSummary` type，不得回傳完整 `TeacherProfile` relation。

### D14 — Notification 分期

本輪是否明確延後 new response 通知 Organizer / response withdrawn 通知 Organizer / demand 狀態改變通知 Teacher？

- **推薦：全部延後**，對齊 teacher-rejection（D7）與 Organizer draft plan（D14）的既有分期先例。V1 以站內查看（Teacher 自己的 response status 頁、Organizer 的 demand detail read-only responses 區塊）作為告知手段，不引入 email/Resend。
- **docs 落差承認**：`docs/domain/state-transition-details.md` 的 Notification Side Effects 章節已把「DemandResponse submitted / selected」列為觸發通知的狀態變更。Slice 0 須在該文件標註「V1 先以站內顯示告知，email/notification 為後續切片 `demand-response-notification`」。

### D15 — Pagination / ordering

V1 pool 與 response list 是否需要最小 pagination、固定上限、`publishedAt`/`createdAt` ordering、過期需求排除？

- **推薦**：
  - Demand pool（`/teacher/demands`）：`orderBy: { createdAt: "desc" }`（若 Organizer draft plan有 `publishedAt` 欄位則改用該欄位；若無，`updatedAt`/`createdAt` 亦可，待該 plan 定案），**搭配最小 cursor-based pagination（`take: 20` + `cursor`/`skip: 1` 的下一頁，UI 呈現為「載入更多」按鈕）**，**不得**只設固定 `take` 上限而不提供任何取得後續資料的路徑——若 published（或依 D11 的 `eligibleStatuses`）demand 數量超過單頁上限，缺少分頁會讓第 N+1 筆之後的 demand **永久對所有 teacher 不可見**，直接牴觸「approved teacher 可瀏覽符合 visibility policy 的 published demand」這個核心流程，是本輪 review 已指出的具體缺口。技術落地：`findMany({ take: 20, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })`（複合 orderBy 含 `id` 避免同一 `createdAt` 造成分頁不穩定），list route 讀取 query string 的 `cursor` 參數決定下一頁起點。若 `DemandRequestStatus` 含 `expired`（依 Organizer draft plan D9 討論），查詢條件應排除 `expired`（只要 `expired` 不在 `eligibleStatuses` 集合內即自然排除)。
  - Organizer 的 response list（單一 demand 底下）：`orderBy: { createdAt: "asc" }`（先到先看，貼近既有 admin submitted queue 的 `orderBy: { updatedAt: "asc" }` 慣例），量通常不大（單一 demand 的回應數），可不設分頁上限，但仍建議設一個合理防禦性上限（如 `take: 200`）避免極端情況。
  - Teacher 自己的 response（單一 teacher 對單一 demand 至多一筆，依 D8=A）：無需分頁。
- **原則**：不使用無界 `findMany()`；所有 list 查詢皆須有明確 `orderBy` 與上限。

### D16 — Test strategy

- 現況：repo 無 Vitest、無任何 unit test，只有 Playwright smoke；`package.json` 不可改（與 Organizer draft plan D13、teacher-rejection D6 一致的現況）。
- **推薦：只用既有 Playwright smoke** 做行為驗證，**不引入 Vitest、不改 `package.json`**。
- 若 PO 未來要 domain unit test，引入 Vitest 屬**獨立前置 slice**（會改 `package.json` + 新增 config），須另案 PO 核准，**本 feature 任何 slice 不得偷改 `package.json`**。

### 5.1 決策記錄（Human Decision Record — 2026-07-22 產品主人確認）

以下 D1–D10、D12–D16 已由產品主人確認，**全部採用本 plan 各節提出的推薦方案**（D11 已於 2026-07-21 單獨確認，見該節）；Builder 以此為準。未被此記錄覆蓋的細節仍回到各 slice 的 acceptance criteria。

| # | 裁定 | 對施工的影響 |
|---|---|---|
| D1 | **只要兩條件**：`DemandRequest.status` 落在 `eligibleStatuses` 且 `TeacherProfile.status = approved`，不額外強制 service area/teaching format/specialty 相符 | Slice 3 的查詢條件維持最小，不實作任何自動媒合/比對邏輯 |
| D2 | **V1 不做 filter**，只顯示 published（依 `eligibleStatuses`）list | Slice 6 不需 filter UI/query；filters 留待未來 fast-follow standard slice |
| D3 | Demand detail DTO allowlist 依第 5 節既定範圍；**`budgetRange` 顯示給 teacher，但視覺次要、不作為排序依據** | Slice 3 的 select 包含 `budgetRange`；Slice 7 UI 呈現時字級/位置需次要化，不得做成排序欄位 |
| D4 | `DemandResponse.message` **必填**，trim 後長度 **10–1000 字**（比照 `TeacherProfile.rejectionReason` 先例定案，非待確認參數） | Slice 4 `validateDemandResponseSubmit` 要求 `message` 非空且落在 10–1000 字界線內 |
| D5 | `proposedPrice` 採 **`String?`** 自然語言區間，對齊 `TeacherProfile.priceRange` 慣例 | Slice 1 schema 型別為 `String?`；Slice 4 只做長度上限驗證，不做數值解析 |
| D6 | `proposedTimeSlots` 採 **`String[]`**，與 Organizer plan 已定案的 6 項受控清單（平日早上/平日午間/平日晚上/週末早上/週末午間/週末晚上）**共用同一份常數** | Slice 4 **必須 import（或 re-export）** Organizer plan 的 `service-types.ts`（或等價常數模組）匯出的同一份常數，**不得**另建、複製或手動謄寫第二份清單——即使暫時內容相同，日後任一方修改都會造成不同步 |
| D7 | `DemandResponseStatus` enum **一次定義完整 6 值**（submitted/shortlisted/selected/declined/withdrawn/expired），V1 **只接線** `(none)→submitted`、`submitted→withdrawn` | Slice 1 enum 完整定義；Slice 4 的 state.ts 只實作這兩個 transition，其餘值保留未接線並於 Slice 0 docs 註明 |
| D8 | **終身一筆**：`@@unique([demandRequestId, teacherProfileId])` 對整表生效，withdraw 後**不可**再對同一 demand 建立新 response | Slice 1 schema 的 unique constraint 依此；Slice 4 submit 邏輯的 duplicate 錯誤訊息依此終局性質誠實告知；不需要 `withdrawn→submitted` transition |
| D9 | **V1 不可編輯**，Teacher 只能 withdraw，不提供 update-in-place | Slice 4 不提供 edit service function；Slice 0 需在 `demand-response-and-matching-spec.md`/`permissions-matrix.md` 標註此 V1 簡化與既有文件字面（「selected 前可編輯」）的落差 |
| D10 | Withdraw **不論 `DemandRequest` 當下狀態**（即使已 cancelled/matched），只要 own response 仍為 `submitted` 即允許；`selected` 狀態（本輪未接線）防禦性禁止 | Slice 4 的 `withdrawOwnDemandResponse` 不檢查 `DemandRequest.status`，只檢查 own response 自身狀態 |
| D12 | Suspended teacher：**可查看**既有 response、**不可 withdraw**、**organizer 仍可見**、**不自動 declined/expired** | Slice 4 的 `getOwnDemandResponseForDemand` 不檢查 approved；`withdrawOwnDemandResponse` 顯式檢查 approved；無任何 suspend 觸發的自動狀態轉換邏輯 |
| D13 | Organizer 可見 TeacherProfile 欄位：`displayName`/`bio`/`teachingStyle`/`experienceYears`/`specialties`/`serviceAreas`/`teachingFormats`/`profilePhotoUrl`；**排除** `rejectionReason`/`certifications`/`priceRange`/`User.email`/`User.phone` | Slice 5 的 `listResponsesForOwnDemandRequest` select 明確列出此 allowlist，不得 `include` 整包 relation |
| D14 | **延後** notification（new response/withdrawn/demand 狀態變化），V1 只用站內狀態顯示 | Slice 0 於 `state-transition-details.md` 標註「V1 先以站內顯示告知，email 為後續切片」 |
| D15 | Demand pool 採 **cursor-based pagination**（`take: 20` + cursor，UI 為「載入更多」），不使用固定上限無分頁 | Slice 6 的 `listPublishedDemandRequestsForTeacher` 依此實作；避免任何 demand 因固定上限而永久不可見 |
| D16 | **只用既有 Playwright smoke**；不引入 Vitest、不改 `package.json` | Slice 9 集中執行行為驗證；無 unit-test slice |

**Gate 狀態**：D1–D16 **已於 2026-07-21（D11）與 2026-07-22（其餘 D1–D10、D12–D16）全部拍板** → 本 plan 自身的 High-risk Planning Gate **已解除**，可依第 8 節逐 slice 施工；但**仍須逐 slice 進行**，每 slice 各自 review、各自可 rollback，Prisma migration（Slice 1/2）維持 additive。本記錄不改變 commit / push gate：仍不得在未經產品主人明確要求下 commit 或 push。

**此外，即使本 plan 的 D1–D16 全部拍板，凡涉及 `DemandRequest` 既有形狀的 slice，仍需等待 Organizer draft plan 自身的程式碼（schema commit/migration/service/route）實際落地，才能真正動工**——本 plan 的 Gate（決策層面）與 Organizer draft plan 的程式碼落地進度是**兩件獨立的事**：本 plan 的決策 Gate 已解除，但第 10 節所述的程式碼落地前提尚未全部滿足。**現況（2026-07-22）**：Organizer draft plan 已取得自己的 `codex-peer-reviewed` marker（7 rounds）且 D1–D15 已拍板；其 **Slice 0（docs）與 Slice 1（schema）已於另一 session 落地於 working tree，但尚未 commit**；Slice 2（migration）以後尚未開始。Domain-only 部分（Slice 3、Slice 6，依第 10.4 節排序彈性）可在 `DemandRequest` schema **commit 並完成 migration** 後即開始，不需等待 Organizer draft plan 的 route/UI 層完成。

---

## 6. Brand and UX rules

- Demand pool **不可**像低價工作競標平台。卡片優先呈現課程目的、參與者、地區、時段與團體需求，**而非**最低預算；若顯示 `budgetRange`/`proposedPrice`，一律以次要、非強調的視覺層級呈現（比照 `TeacherProfile.priceRange` 現有呈現慣例——資訊性文字，非排序依據）。
- Proposed price 若保留（依 D5），**不可**作為自動排序或公開排名依據；Organizer response 列表**預設 orderBy 用時間**（見 D15），不得提供「依價格排序」的 UI 控制項（那等同建立比價機制，違反品牌與任務指示的排斥項）。
- Teacher response form 語氣需專業、溫和、具體：欄位 label/placeholder 應引導老師具體描述教學方式與可配合安排，而非單純填公文；對齊 `docs/context/voice-and-tone.md` 的「Calm confidence」「Clear guidance」原則。範例語氣：「請簡單說明你的教學風格與這次合作的想法」而非「請輸入 message」。
- Organizer response view **不使用**「最低價優先」排序或標籤（如「最划算」「CP值最高」等用詞禁止）。
- 未 approved Teacher 的阻擋文案清楚但不羞辱：例如「你的老師資格審核完成後，就可以在這裡瀏覽並回應需求」，**不使用**「你還不夠格」「審核未通過」等負面措辭（`draft`/`submitted`/`rejected`/`suspended` 分別給予符合該狀態、溫和引導的文案，比照 `teacher/dashboard/page.tsx` 既有 `statusCopy` pattern）。
- 無 published demand 時提供平靜、具方向性的 empty state：例如「目前沒有符合條件的需求，之後有新的需求會顯示在這裡」，**不使用**焦慮式或催促語氣（如「快來搶」「機會有限」）。
- Withdraw 必須有清楚確認，但避免高壓或恐嚇語氣：確認文案應說明「這個動作會撤回你對這個需求的回應，之後不會再送出」（依 D8=A 的終局性質誠實告知），**不使用**「確定要放棄這個機會嗎？」之類製造 FOMO 的措辭。
- 所有品牌檢查需對照 `docs/context/voice-and-tone.md` 的 Good/Avoid 範例（避免「最低價搶課」「保證」「立即」等 hard-sell 用語）與 `docs/context/brand-rules.md`（若有補充規則，Slice 0 需一併核對）。

---

## 7. RWD Requirements

- `/teacher/demands` 在 **360px / 390px** 可快速掃描：demand pool 以 **cards**（非寬表格）呈現，每張卡片聚焦標題、地區、時段摘要、程度、人數，長文字 `truncate`/`line-clamp` 處理。「載入更多」（依 D15 分頁）在手機上需為足夠大的觸控目標，且不與卡片內容擠在一起。
- Demand cards 不使用寬表格；欄位資訊以直向堆疊或 2 欄 grid（比照 `teacher/dashboard/page.tsx` 的 `ReadOnlyItem` grid 模式）。
- Demand detail 資訊分區呈現（比照 organizer demand form 的分段精神：需求概述 / 課程細節 / 時間地點 / 補充資訊），避免單一長段落。
- 長 `message`（response 內容）與 `preferredTimeSlots`/`proposedTimeSlots`（陣列）不造成水平溢出：沿用既有 `break-words`、`whitespace-pre-wrap`、`min-w-0` 慣例（`teacher/dashboard/page.tsx` 已示範）。
- Response form 在手機上可輸入長文（`message` 用 `<textarea>`，具合理 `rows`，避免手機上顯示過小）。
- CTA（submit response、withdraw）、validation error、withdraw confirmation 在手機可操作（按鈕最小觸控尺寸、不與其他元素太擠、confirmation 不依賴 hover）。
- Organizer response list 在手機使用 **cards**，不使用比較寬表格（每位老師一張卡片，顯示 D13 allowlist 欄位 + response 內容）。
- 所有 RWD 驗證至少涵蓋 **360px** 與 **390px** 兩種寬度（對齊既有 smoke 慣例）。

---

## 8. 實作切片（Slice 0–10；施工 slice 皆以 D1–D16 已拍板、且第 10 節所述上游前提已滿足為前提）

> 通則：
> - 各 slice「allowed files」為**白名單**，未列出者一律 forbidden。
> - 全 feature 共同 forbidden：`.env`（不得讀取）、`package.json`、`next.config.ts`、`playwright.config.ts`、任何 teacher-rejection **已 commit** 檔案中「非本 slice 該碰」的部分（`src/domain/teacher-profile/**`、`src/app/admin/teachers/**`）、任何 Organizer draft plan 尚未落地的 `src/domain/organizer-profile/**`、`src/domain/demand-request/**`、`src/app/organizer/**`、`src/app/organizers/**`、`src/app/admin/demands/**`（**本 plan 不得搶先建立這些目錄**，那是 Organizer draft plan 的疆域；本 plan 只能在其已落地後以「只 import 讀取介面」的方式整合，見 Slice 9）。**不得** commit / push（除非 PO 明確要求）。
> - 高風險 slice（0/1/2/3/4/6/8/9）為 **micro**，一次只碰一個邊界，可單獨 review、單獨 rollback。

### Slice 0 — 產品決策落地 + 既有 docs 對齊（docs-only）

- **goal**：把 D1–D16 裁定（已於第 5.1 節記錄）寫入 Chinese docs，並修正「規格 vs 未落地 schema」drift；明確標註本 feature 對 `DemandRequest`（Organizer draft plan）的 prerequisite 依賴——即決策層面 Gate 雖已解除，schema/程式碼落地前仍不可視為穩定 API。
- **slice type**：micro（docs-only，但屬 data model / state machine 文件，需嚴謹）。
- **prerequisites**：D1–D16 全部拍板；Organizer draft plan 的 D1–D15 亦已拍板（至少涉及 `DemandRequest` 形狀、`onDelete` 政策的相關決策）；teacher-rejection 對共用 docs 的變更已 commit（避免同檔未 commit 交錯，理由同 Organizer draft plan 第 4 節分析）。
- **allowed files**：
  - `docs/domain/data-model.md`（`DemandResponse` 欄位對齊 D4–D7；`DemandResponseStatus` enum 全值 + 接線範圍註記）
  - `docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`（`DemandResponse` V1 已接線 transition = `(none)→submitted`、`submitted→withdrawn`；其餘保留；D11 動態推導 vs persisted 的裁定與落差註記；D9 edit-policy 落差註記；notification 延後註記）
  - `docs/domain/permissions.md`、`docs/domain/permissions-matrix.md`（demand pool/detail 可見性條件明確化為 D1 裁定；DemandResponse 各 action 的角色權限對齊 D 決策）
  - `docs/product/form-field-spec.md`（Demand Response Form 對齊 D4–D6 最終欄位/驗證邊界）
  - `docs/product/route-map.md`（若 Slice 0 發現 `/teacher/demands`、`/teacher/demands/[demandRequestId]`、`/organizer/demands/[demandRequestId]` 的既有描述需要補充「僅 approved teacher」「read-only responses」等細節，於此更新；不改變既有 route 清單結構）
  - `docs/specs/demand-response-and-matching-spec.md`（D1–D16 對應行為裁定；明確標註 shortlist/select/matched 為下一份獨立 plan 的 non-goal 邊界）
- **forbidden files / areas**：`prisma/**`、`src/**`、`tests/**`、`docs/specs/teacher-onboarding-spec.md`/`docs/specs/admin-review-workflow-spec.md`（teacher-rejection 疆域，勿碰）、`docs/specs/organizer-demand-request-spec.md`（Organizer draft plan 疆域，勿碰，除非該 plan 已定案且本 slice 僅新增本 feature 相關的交叉引用一行——預設不改）、共同 forbidden 清單。
- **domain and permission rules**：docs 必須明確寫死：demand pool/detail 僅 approved teacher + demand 狀態落在 `eligibleStatuses`（依 D1/D11 裁定，預設僅 `published`；若 D11=A 則含 `published`/`teacher_responded`）才可見；response 僅 own teacher 可建立/查看/withdraw（查看/withdraw 不受 `eligibleStatuses` 限制，見 D12 落地機制）；organizer 僅 own demand 的 responses 可 read-only 查看；shortlist/select/matched 不在本輪範圍。
- **acceptance criteria**：(a) docs 與「即將落地的 `DemandResponse` schema（D4–D8 形狀）」一致；(b) D9（edit-policy）、D11（動態推導/persisted）、notification 延後的 V1 落差都有明確註記；(c) 明確標註本 feature 對 `DemandRequest` 的 prerequisite 依賴與其 gate 狀態；(d) 未觸碰 teacher-rejection 或 Organizer draft plan 的專屬段落。
- **checks**：人工閱讀；`git status --short` 僅顯示上述 docs；不需跑測試。
- **manual smoke scenarios**：不適用（docs-only）；改為交叉閱讀 data-model / form-field-spec / state-transition-details 三處 `DemandResponse` 描述是否一致。
- **security / RWD / brand review**：確認 withdraw 確認文案、empty state、response form 引導語氣符合品牌（第 6 節）；不揭露內部審核細節給非必要角色。RWD 不適用。
- **rollback notes**：`git checkout -- <docs>` 還原；docs-only 無資料風險。
- **stop conditions**：發現任一 D 決策未拍板 → 停止並回報，不猜測。（teacher-rejection 已 commit、Organizer draft plan D1–D15 已拍板，此二者不再是本 slice 的 stop condition 來源；僅需確認 docs 段落編輯時不誤動 teacher-rejection 或 Organizer draft plan 的專屬段落。）
- **需要 PO 再次確認？**：否（前提是 D1–D16 與 Organizer draft plan 相關決策已拍板）；若落地時發現裁定間矛盾，需回 PO。

### Slice 1 — `DemandResponse` Prisma schema 規劃（schema only，不含 migration 執行）

- **goal**：依裁定新增 `DemandResponse` model + `DemandResponseStatus` enum。**本 slice 的可執行性依賴 `DemandRequest` 已存在於 `schema.prisma` 且該變更已 commit**（Organizer draft plan 的 Slice 1 已 commit、Slice 2 migration 已合入）——`DemandRequest` **現已存在於 working tree**（見 2.1/2.10 節），技術上滿足 Prisma 的 relation 語法要求，但**本 slice 仍不得在 Organizer draft plan 的 Slice 1 commit 前動筆**，理由是避免兩個 session 同時修改同一份未 commit 的 `schema.prisma` 造成衝突／覆蓋對方變更。若 Organizer draft plan 的 Slice 1 尚未 commit，本 slice **只能產出 schema 片段草案（放在 plan 文件或 review packet 中）**，不得實際寫入共用的 `schema.prisma`。
- **slice type**：micro（Prisma schema，最高風險）。
- **prerequisites**：Slice 0 完成；**`DemandRequest` model 已於 `prisma/schema.prisma` 落地**（Organizer draft plan Slice 1 已合入且 D15 的 `onDelete` 政策已拍板，以確定 `DemandResponse → DemandRequest` 的 `onDelete` 是否需要與之協調）；teacher-rejection 的 `prisma/schema.prisma` 變更已 commit。
- **allowed files**：`prisma/schema.prisma`（僅新增 `DemandResponse` model、`DemandResponseStatus` enum、必要 relation/index；**不得修改** `DemandRequest`、`TeacherProfile`、`Organization`、`OrganizerProfile` 既有欄位——僅可能需要在 `DemandRequest`/`TeacherProfile` 加上反向 relation 欄位，此為 Prisma 雙向 relation 的必要最小改動，且僅限加一行 `demandResponses DemandResponse[]`，不得動其餘欄位）。
- **forbidden files / areas**：`prisma/migrations/**`（Slice 2 處理）、`src/**`、`tests/**`、`docs/**`（Slice 0 已處理）、共同 forbidden 清單。**不得修改** `DemandRequest` 的欄位形狀或狀態機定義（Organizer draft plan 疆域）、**不得修改** `TeacherProfile.rejectionReason`（teacher-rejection 疆域）。
- **domain and permission rules（schema 層面）**：
  - `DemandResponse` 必含 `demandRequestId`（FK → `DemandRequest`）、`teacherProfileId`（FK → `TeacherProfile`），relation 具體、可 own 過濾。
  - `onDelete` 明確指定：`teacherProfile` 側 `Cascade`（同既有 `User → TeacherProfile` 模式，避免刪除 user 時因 FK Restrict 而失敗）；`demandRequest` 側**確定為 `Cascade`**（PO 已確認，即使 `DemandRequest → Organization` 為 `Restrict`——Organizer draft plan D15——`DemandResponse → DemandRequest` 仍是獨立的 `Cascade`：demand 若真被刪除，其收到的 response 理應隨之清除，避免孤兒列）。
  - `@@unique([demandRequestId, teacherProfileId])`（**D8 已確認為選項 A**：全表唯一鍵，withdraw 後不可再對同一 demand 建立新 response；不需要 partial index 或其他變體，Slice 2 的 migration 直接產生標準 unique constraint 即可）。
  - `@@index([demandRequestId])`、`@@index([teacherProfileId])`、`@@index([status])` 供 pool/detail/admin 查詢效能。
- **acceptance criteria**：`npx prisma validate` 通過；schema 反映 D4–D8；所有新變更為 **additive**（新 model/新 enum，對 `DemandRequest`/`TeacherProfile` 僅新增反向 relation 欄位，不改變既有欄位語意）。
- **checks**：`npx prisma validate`；`npx prisma generate`（確認型別可生成，不對 DB 施作）；不得對任何實際資料庫執行不可逆操作。
- **manual smoke scenarios**：不適用（schema-only）。
- **security / RWD / brand review**：資料模型變更觸發 `docs/domain/permissions.md` Security Review Required（Demand visibility）。RWD/brand 不適用。
- **rollback notes**：`git checkout -- prisma/schema.prisma`（尚未產 migration 前，rollback 零資料風險）。
- **stop conditions**：`DemandRequest` 尚未存在於 schema，或雖存在但 Organizer draft plan 的 Slice 1 尚未 commit（即使已在 working tree）→ 停止，本 slice 降級為「schema 草案文字規劃」而非實際檔案修改，避免與另一 session 同時編輯 `schema.prisma` 衝突。
- **需要 PO 再次確認？**：否（若 D 已拍板）。

### Slice 2 — create-only migration

- **goal**：為 Slice 1 的 schema 產生新增式（create-only）migration。
- **slice type**：micro（migration，最高風險）。
- **prerequisites**：Slice 1 完成且 `prisma validate` 綠燈；`DemandRequest` 的 migration 已存在/已套用，本 migration timestamp 必須更晚。
- **allowed files**：`prisma/migrations/<new_timestamp>_add_demand_response_foundation/migration.sql`；必要時 `prisma/migrations/migration_lock.toml`。
- **forbidden files / areas**：`prisma/schema.prisma`（Slice 1 已定稿）、既有任何 migration 目錄、`src/**`、`tests/**`、共同 forbidden 清單。
- **domain and permission rules**：不適用（純 DDL）；SQL 必須是 `CREATE TABLE "DemandResponse"`、`CREATE TYPE "DemandResponseStatus"`、必要 `ALTER TABLE` 加反向 relation（若需要，Prisma 通常不需要為 1-to-many 的「多」端加欄位）（additive），不得 `DROP`/改既有欄位型別。
- **acceptance criteria**：migration 為 additive；在乾淨 DB 上可套用；`prisma migrate diff` 無殘差；不含任何 seed/`INSERT`。
- **checks**：`npx prisma migrate diff`（或 `migrate dev --create-only` 於本地 dev DB，不對共享/正式 DB 施作）；`prisma validate`。
- **manual smoke scenarios**：本地隔離 DB 套用 migration 後確認新表/新欄位/新 enum 存在且既有資料未受影響。
- **security / RWD / brand review**：確認無破壞既有資料；無敏感資料寫入 migration。
- **rollback notes**：未套用到共享環境前，刪除該 migration 資料夾即可。**禁止對共享/正式 DB 施作不可逆操作。**
- **stop conditions**：`migrate diff` 顯示非 additive → 停止回報。
- **需要 PO 再次確認？**：否（技術性落地）。

### Slice 3 — Approved Teacher capability + published-demand read service（資料最小化 DTO）

- **goal**：新建**獨立** `src/domain/demand-response/`（capability 與讀取部分），提供：approved teacher capability helper（如 `requireApprovedTeacher()`）、published demand pool 讀取 service（回傳 D3 allowlist DTO 的 list 與 detail）。**不含** response 的建立/withdraw（Slice 4）。**本 slice 的 capability gate 只適用於「瀏覽/發現新 demand」的情境**（pool list、可提交 response 的 detail 頁）；**不適用於**「查看自己已提交的 response」——那條讀取路徑刻意不經過 `requireApprovedTeacher()`（見 D12「落地機制」與 Slice 4 的 own-response 讀取函式），避免 suspended teacher 或 demand 已離開 eligible 狀態時，連自己既有的 response 都讀不到。
- **slice type**：micro（capability/permission model + demand visibility）。
- **prerequisites**：Slice 2 migration 已於 dev 套用（若僅需讀取 `DemandRequest`，本 slice 實際上只依賴 `DemandRequest` 已存在且有 `published` 資料可查，不強制要求 `DemandResponse` 表已建立——但為維持 slice 邊界清晰，仍排在 migration 之後）；D1–D3、D15 已拍板；Organizer draft plan 的 `DemandRequest` 讀取路徑（欄位形狀）已定案。
- **allowed files**：
  - `src/domain/demand-response/capability.ts`（`requireApprovedTeacher()`：`requireUser()` → 查own `TeacherProfile` → `status !== "approved"` 則丟型別化 error 或回傳 discriminated result，供 route 層判斷導向何處）
  - `src/domain/demand-response/demand-read-service.ts`（`listPublishedDemandRequestsForTeacher()`、`getPublishedDemandRequestDetailForTeacher(demandRequestId)`；皆先 `requireApprovedTeacher()`，查詢條件 `status: { in: eligibleStatuses } `（`eligibleStatuses` 依 D1/D11 裁定；D11=B 時固定為 `["published"]`），`select` 明確列出 D3 allowlist，不得 `include` 整包 relation；list 依 D15 orderBy + pagination；detail 對非 eligible 或不存在的 id 回傳 `null`/not-found，不洩漏存在性差異；**Builder 施工前須以實際落地的 `DemandRequest` schema 重新核對本節假設的欄位名稱**，因為即使 Organizer draft plan 的決策已拍板，實際 migrate 落地的欄位名稱仍以當下 repo 現況為準）
- **forbidden files / areas**：`src/domain/teacher-profile/**`（不得 import/改）、`src/domain/organizer-profile/**`、`src/domain/demand-request/**`（**只能透過 Prisma 直接 select `DemandRequest` 欄位讀取，不得 import 該 domain 的 service 函式**——即使 Organizer draft plan 的 D1–D15 決策已拍板，其 `src/domain/demand-request/*` 程式碼於本 plan 撰寫時仍尚未實際落地/尚未 commit，介面簽章仍可能在實作階段與規劃有出入；本 slice 應以最小假設的欄位名稱直接 `prisma.demandRequest.findMany/findUnique`，若欄位名稱與已拍板的第 5.1 節決策記錄不符，由本 slice 的 stop condition 觸發回報調整）、`prisma/**`、`src/app/**`（route 在 Slice 6）、`tests/**`、共同 forbidden 清單。
- **domain and permission rules**：
  - capability：`requireApprovedTeacher()` 一律 `where:{ userId: currentUser.id }` 解析own `TeacherProfile`；非 approved（含不存在）一律視為無 capability。
  - demand 讀取：`status: "published"` 為查詢條件的一部分（不是 UI 端 filter）；list 與 detail **共用同一組 select 定義**，避免兩處 allowlist 漂移。
- **acceptance criteria**：非 approved teacher（含無 profile）呼叫皆被擋且回傳一致的 not-eligible 語意；approved teacher 只能讀到 `status` 落在 `eligibleStatuses` 的 demand（依 D1/D11 裁定，非單純寫死 `published`）；DTO 不含 `Organization` 私人聯絡欄位或 `OrganizerProfile` 任何欄位（依 D3）；list 有 orderBy + pagination（依 D15）；detail 對不存在/不 eligible 的 id 回傳一致的「找不到」結果。
- **checks**：`tsc`、ESLint 綠燈。行為驗證交由 Slice 9 smoke（依 D16 只用 Playwright）。
- **manual smoke scenarios**（供 Slice 9 具體化）：approved teacher 看得到 eligible demand list/detail（依 `eligibleStatuses`）；draft/submitted/rejected/suspended teacher（含無 profile 的一般 user）看不到任何內容；不 eligible 的 demand（例如 draft/submitted/rejected/cancelled/expired，若 D11=B 則另含 `teacher_responded`）無法透過猜 id 讀到 detail；若 D11=A，`teacher_responded` 狀態的 demand 仍可被其他 approved teacher 讀到。
- **security / RWD / brand review**：Security 為重點（demand visibility、IDOR 防護）。RWD/brand 不適用（無 UI）。
- **rollback notes**：刪除 `src/domain/demand-response/{capability,demand-read-service}.ts`。
- **stop conditions**：`DemandRequest` 欄位名稱與本 slice 假設不符、或 Organizer draft plan 尚未落地 published 資料路徑 → 停止重新對齊；D1–D3/D15 未定 → 停止。
- **需要 PO 再次確認？**：否（若 D 已拍板）。

### Slice 4 — DemandResponse submit / withdraw domain rules

- **goal**：新建 `src/domain/demand-response/{input,validation,state,service}.ts`，提供 approved teacher 對**自己**的 response 之 create/submit（一次到位，非 draft-then-submit 兩階段——依 D4/D7，`DemandResponse` 無 draft 狀態，建立即是 `submitted`）、withdraw、own 查詢。
- **slice type**：micro（state machine + core flow + IDOR 防護）。
- **prerequisites**：Slice 1–3 完成；D4–D10、D12 已拍板。
- **allowed files**：
  - `src/domain/demand-response/input.ts`（form → normalized；`message` trim、`proposedTimeSlots` 拆分/去空白、`proposedPrice` trim）
  - `src/domain/demand-response/validation.ts`（`validateDemandResponseSubmit`：`message` 長度界線、`proposedTimeSlots` 至少一項且落在受控清單（若 D6 有清單）、`proposedPrice` 長度上限）
  - `src/domain/demand-response/state.ts`（`validateDemandResponseWithdrawTransition(from)`：僅 `submitted → withdrawn`；其餘來源回專屬 error code，比照 `teacher-profile/state.ts` 的 reject transition 風格）
  - `src/domain/demand-response/service.ts`（`submitOwnDemandResponse(demandRequestId, input)`、`withdrawOwnDemandResponse(demandResponseId)`、`getOwnDemandResponseForDemand(demandRequestId)`；**capability 要求依函式而異，不可全部套用同一個 gate**：
    - `submitOwnDemandResponse`：`requireApprovedTeacher()`（沿用 Slice 3）。
    - `withdrawOwnDemandResponse`：`requireUser()` + 解析 own `teacherProfileId` + **額外顯式檢查** `teacherProfile.status === "approved"`（依 D12，suspended 不可 withdraw；**不use** `requireApprovedTeacher()` 這個共用 helper 直接擋，而是在本函式內部顯式檢查，因為此函式仍需要能讀到 non-approved teacher 的 profile 以產生正確的錯誤訊息）。
    - `getOwnDemandResponseForDemand`：**只要求** `requireUser()` + 解析 own `teacherProfileId`（**不檢查** `status === "approved"`，任何曾建立過 `TeacherProfile` 的 user 皆可查——依 D12「落地機制」，suspended teacher 仍可查看既有 response）；查詢 `where:{ demandRequestId, teacherProfileId }`，**不檢查** `DemandRequest.status` 是否仍 eligible；若需顯示 demand 標題等最小上下文，另以 `prisma.demandRequest.findUnique({ where:{ id: demandRequestId }, select:{ title: true } })` 取得，不套用 D3 eligibility 條件。）
- **forbidden files / areas**：`src/domain/teacher-profile/**`、`src/domain/organizer-profile/**`、`prisma/**`、`src/app/**`、`tests/**`、共同 forbidden。`src/domain/demand-request/**`：**不得修改**；**唯讀 import 的允許範圍依 D11 裁定而異**——若 D11=B（**已由 PO 確認**，動態推導），本 slice 不需 import 該 domain 任何內容，僅以 Prisma 直接 select `DemandRequest` 欄位（同 Slice 3 理由，因該 domain 程式碼於本 plan 撰寫時尚未實際落地，即使決策已拍板，介面簽章仍待實作階段確認）；**若 D11=A**，本 slice **必須** import 該 domain export 的 `markDemandRequestAsRespondedIfPublished(tx, demandRequestId)`（見 D11 選項 A 的 transaction-aware helper 要求），此為明確允許的例外 import，且以「該 helper 已由 Organizer draft plan 落地並符合此簽章」為 prerequisite（若尚未落地或簽章不符，本 slice 依 stop condition 停止回報，不得自行在本 domain 內重新實作一份繞過封裝的 `DemandRequest` 寫入邏輯）。
- **domain and permission rules**：
  - **submit**：`requireApprovedTeacher()` → 解析own `teacherProfileId` → 驗證 form 輸入（`validateDemandResponseSubmit`）→ 整段包在 `prisma.$transaction(async (tx) => { ... })` 內：(a) 以第 4 節規則 8 定義的**原子 `INSERT ... SELECT ... WHERE EXISTS` raw SQL**（透過 `tx.$queryRaw`，`WHERE` 條件使用依 D1/D11 決定的 `eligibleStatuses` 集合，而非寫死 `"published"`）執行寫入；(b) `RETURNING` 0 列時 `throw` 一個內部 sentinel error 使整個 `tx` rollback，外層 catch 後回頭以 `prisma.demandRequest.findUnique`（在 transaction 外）查 `DemandRequest.status` 組出 `demand_not_eligible` 錯誤訊息；(c) **若 D11=A**，在 `INSERT` 成功後、**同一個 `tx`** 內呼叫 `markDemandRequestAsRespondedIfPublished(tx, demandRequestId)`（`updateMany` guard，`count===0` 視為正常略過，不視為錯誤——因為可能是第二位以後的 teacher 提交），使兩個寫入共同 commit/rollback（見 D11 選項 A 的 transaction-aware helper 要求，避免「response 已建立但 demand 狀態未同步」）。捕捉 Postgres unique violation（`23505`）轉譯為 `response_already_exists`（訊息依 D8 裁定的終局性質誠實告知）；transaction 成功後以 `findUniqueOrThrow` 重新讀出型別化結果。**不得**用「先 `findUnique` 檢查 `DemandRequest.status` 再呼叫 `prisma.demandResponse.create`」的兩步式寫法——那無法防止 TOCTOU（見第 4 節規則 8 的具體原因）。
  - **withdraw**：先解析 own `teacherProfileId` 並顯式檢查 `status === "approved"`（非 approved 回傳 `teacher_not_approved_cannot_withdraw`，不得混用 `requireApprovedTeacher()` 導致連「查看」都被一併擋下）；通過後 `updateMany({ where:{ id, teacherProfileId: <own>, status: "submitted" }, data:{ status: "withdrawn" } })`，`count===0` 回頭查判斷 not-found / not-own / wrong-status（比照既有併發安全模式）；**withdraw 動作本身不檢查 `DemandRequest` 當下狀態**（依 D10，demand 已 cancelled/expired/matched 皆不影響 teacher 單方面 withdraw 自己 response 的能力）。
  - own 查詢：`getOwnDemandResponseForDemand` 一律 `where:{ demandRequestId, teacherProfileId: <own> }`，不接受 client 傳入 `teacherProfileId`，**且不檢查 `TeacherProfile.status` 或 `DemandRequest.status`**（見上方 allowed files 說明；此為 D12 得以真正落地的關鍵）。
  - 受控字串（若 D6 有清單）：`proposedTimeSlots` 值必須落在允許集合，否則 validation error。
- **acceptance criteria**：approved teacher 可對 eligible demand（依 `eligibleStatuses`）建立一筆 response；非 approved/未 profile 被擋；對非 eligible demand submit 被擋（以第 4 節規則 8 的原子 SQL 保證，非分開兩步檢查）；重複建立（依 D8）被擋且訊息一致誠實；若 D11=A，第二位以後 teacher 提交時，`markDemandRequestAsRespondedIfPublished` 的 `count===0` 不視為錯誤；withdraw 只允許 own + `submitted` 狀態 + `teacherProfile.status === "approved"`；suspended teacher 不可 withdraw（依 D12），但**仍可透過 `getOwnDemandResponseForDemand` 讀到自己既有 response**（即使 demand 已離開 eligible 狀態）；跨 teacher 無法讀寫他人 response；受控欄位越界被擋。
- **checks**：`tsc`、ESLint 綠燈；行為驗證交由 Slice 9 smoke。
- **manual smoke scenarios**（供 Slice 9）：A 提交 response 成功；A 重複提交被擋；A withdraw 成功後無法再查到 active response（依 D8=A，也無法再建立新的）；B 無法讀/改 A 的 response；對非 eligible demand 提交被擋；A 被轉為 suspended 後仍可讀到自己既有 response，但呼叫 withdraw 被擋；A 的 demand 被轉為 cancelled/matched（非 published）後，A 仍可讀到並 withdraw 自己的 `submitted` response。
- **security / RWD / brand review**：Security 為重點（own-scoped、TOCTOU 防護、unique constraint、suspended 額外檢查）。RWD/brand 不適用（無 UI）。
- **rollback notes**：刪除 `src/domain/demand-response/{input,validation,state,service}.ts` 中本 slice 新增部分。
- **stop conditions**：D4–D10/D12 未定 → 停止；發現需要 admin/organizer 能力（不該在此 slice）→ 越界停止；**若 D11=A 但 `demand-request` domain 尚未 export 符合 `(tx, demandRequestId)` 簽章的 `markDemandRequestAsRespondedIfPublished`** → 停止回報，不得自行在 `demand-response` domain 內重新實作一份繞過封裝的 `DemandRequest` 寫入邏輯。
- **需要 PO 再次確認？**：否（若 D 已拍板）。

### Slice 5 — Organizer read-only response 讀取 service

- **goal**：新建 `src/domain/demand-response/organizer-read-service.ts`，提供 organizer 對**自己** `DemandRequest` 收到的 responses 之 read-only 查詢（D13 allowlist DTO）。
- **slice type**：micro（demand visibility + IDOR 防護，跨 domain 讀取）。
- **prerequisites**：Slice 1–2 完成；D13、D15 已拍板；**Organizer draft plan 的 organizer capability 讀取路徑（`getOwnOrganizerContext()` 或等價物）已落地**，否則本 slice 無法安全解析「這是不是我的 demand」。
- **allowed files**：`src/domain/demand-response/organizer-read-service.ts`（`listResponsesForOwnDemandRequest(demandRequestId)`：先解析 organizer own context（依賴 Organizer draft plan 介面，若尚未提供對應 helper，本 slice 改為直接 `prisma` 查詢 `where:{ id: demandRequestId, organizerProfile: { userId: currentUser.id } }` 驗證擁有權後再查 responses，**不 import** organizer-profile domain 內部實作細節，僅使用其 export 的公開介面或退回直接查 Prisma 驗證擁有權）→ 回傳 D13 allowlist 的 response 陣列，依 D15 orderBy）。
- **forbidden files / areas**：`src/domain/organizer-profile/**`（不得修改，僅可能 import 其 export 的 capability helper）、`src/domain/demand-request/**`（不得修改）、`src/domain/teacher-profile/**`、`prisma/**`、`src/app/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：
  - 一律先驗證「這個 `demandRequestId` 屬於目前登入 organizer」，驗證失敗（不存在或非 own）回傳一致的 not-found 語意，不洩漏「demand 存在但不是你的」與「demand 根本不存在」的差異。
  - 查詢 responses 時 `select` 明確列出 D13 allowlist（`teacherProfile` 子物件 + response 本身欄位），不得 `include` 整包 `TeacherProfile`。
  - 本 slice **唯讀**，不提供任何 mutation（shortlist/select 不在本輪，見第 3 節）。
- **acceptance criteria**：organizer 只能讀到自己 demand 的 responses；跨 organizer 讀取他人 demand 的 responses 一致回傳 not-found；DTO 不含 `TeacherProfile.rejectionReason`/`User.email`/`User.phone`（依 D13）。
- **checks**：`tsc`、ESLint 綠燈；行為驗證交由 Slice 9 smoke。
- **manual smoke scenarios**（供 Slice 9）：organizer A 讀自己 demand 的 responses 成功且欄位符合 allowlist；organizer A 讀 organizer B 的 demand responses 被擋（not-found）；demand 尚無任何 response 時回傳空陣列（非錯誤）。
- **security / RWD / brand review**：Security 為重點（跨 organizer IDOR 防護、TeacherProfile 資料最小化）。RWD/brand 不適用（無 UI）。
- **rollback notes**：刪除 `organizer-read-service.ts`。
- **stop conditions**：Organizer draft plan 的 organizer capability 介面尚未落地/不穩定 → 停止，改為回報需要的最小介面需求；D13/D15 未定 → 停止。
- **需要 PO 再次確認？**：否（若 D 已拍板）；若必須修改 Organizer draft plan 以補上介面 → 是（跨 plan 變更需 PO 知情）。

### Slice 6 — Teacher demand pool list route（`/teacher/demands`）

- **goal**：approved teacher 可於 `/teacher/demands` 瀏覽 published demand list（mobile-first cards）。
- **slice type**：standard（單一 route，讀取邏輯已在 domain）。
- **prerequisites**：Slice 3 完成。
- **allowed files**：`src/app/teacher/demands/page.tsx`（Server Component；`requireUser()` 失敗 `redirect("/sign-in")`；呼叫 `requireApprovedTeacher()`，非 approved 時依第 6 節品牌文案顯示對應狀態引導卡片（比照 `teacher/dashboard/page.tsx` 的 `statusCopy` pattern），approved 則讀取 `searchParams.cursor` 呼叫 `listPublishedDemandRequestsForTeacher({ cursor })` 渲染 cards + 「載入更多」連結（依 D15 的 cursor pagination，`<Link href="?cursor=<lastId>">`，Server Component 下用連結而非 client-side 按鈕即可達成無 JS 分頁）；無資料時顯示 empty state）。
- **forbidden files / areas**：`src/domain/**`（只 import）、`src/app/organizer/**`、`src/app/admin/**`、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：`requireUser()` gate；capability 檢查全部委由 Slice 3 domain；不接受任何 query param 覆蓋 eligibility 條件（`cursor` 只影響分頁起點，不影響 `eligibleStatuses` 過濾條件）。
- **acceptance criteria**：approved teacher 看到 published demand cards；demand 數量超過單頁上限時「載入更多」可正確取得下一批，不遺漏任何 eligible demand；非 approved（含各 status）看到對應溫和引導文案而非清單；未登入導向 sign-in；無資料時 empty state 符合品牌語氣。
- **checks**：`tsc`/ESLint/`next build`；Slice 9 smoke 覆蓋。
- **manual smoke scenarios**：360/390px 下 cards 可快速掃描不溢出；各 teacher status 對應文案正確；seed 超過單頁上限的 published demand，確認「載入更多」可取得原本看不到的那些。
- **security / RWD / brand review**：Security（capability gate 全在 domain，route 僅呼叫）；RWD（cards、360/390px）；Brand（第 6 節 empty state 與未 approved 引導文案）。
- **rollback notes**：刪除 `src/app/teacher/demands/page.tsx`。
- **stop conditions**：Slice 3 未合入 → 停止。
- **需要 PO 再次確認？**：否。

### Slice 7 — Teacher demand detail + submit response（`/teacher/demands/[demandRequestId]`）

- **goal**：approved teacher 可查看 demand detail（D3 DTO）、查看自己既有 response（若有）、提交新 response、withdraw 既有 response。
- **slice type**：micro→standard（core flow 表單 + server action，觸及 mutation，偏謹慎）。
- **prerequisites**：Slice 3、4 完成；D3–D10、D12 已拍板。
- **allowed files**：
  - `src/app/teacher/demands/[demandRequestId]/page.tsx`（`requireUser()`；**頁面邏輯必須拆成兩條獨立路徑，不可用單一 `requireApprovedTeacher()` 一次性 gate 全部內容**（呼應 D12 落地機制與 Slice 3/4 的拆分）：
    1. **先**呼叫 `getOwnDemandResponseForDemand(demandRequestId)`（不要求 approved、不要求 demand 仍 eligible）。
    2. **若已有 own response**：直接顯示「你的回應狀態 + withdraw」區塊（withdraw 是否可用由 response 自身 `status` 與呼叫 `withdrawOwnDemandResponse` 時的 domain 檢查決定，不在 page 層預先擋掉 suspended teacher 的查看權，只在其嘗試 withdraw 時由 action 回傳對應錯誤）；此路徑**不需要**呼叫 `getPublishedDemandRequestDetailForTeacher`，demand 標題等最小上下文改用 Slice 4 提供的非 eligibility-gated 查詢。
    3. **若沒有 own response**：才呼叫 `requireApprovedTeacher()` + `getPublishedDemandRequestDetailForTeacher(demandRequestId)`；非 approved → 導引文案；demand 不存在/非 eligible → `notFound()`；approved 且 eligible → 顯示完整 D3 detail + 回應表單。）
  - `src/app/teacher/demands/[demandRequestId]/actions.ts`（`"use server"`；`submitDemandResponseAction`、`withdrawDemandResponseAction`；分別呼叫 Slice 4 對應函式（capability 要求不同，見 Slice 4）；catch 對應 error code → 導向錯誤訊息；normalize → Slice 4 service；成功 `revalidatePath` + 導回 detail 顯示回饋）
- **forbidden files / areas**：`src/domain/**`（只 import）、`src/app/organizer/**`、`src/app/admin/**`、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：`requireUser()`；capability 與 ownership 全部委由 Slice 3/4 domain，**page 層不得自行重新實作或收緊/放寬 domain 已定義的 gate**（例如不得在 page 層額外加一層 `requireApprovedTeacher()` 包住「查看 own response」路徑）；withdraw 需二次確認（見第 6 節，非高壓語氣但需明確確認，可用 native `<details>`/confirm checkbox 模式，比照 Organizer draft plan Slice 7 對 admin reject 二次確認的处理方式，避免用單純 disclosure 充當確認）。
- **acceptance criteria**：approved teacher 對沒有 own response 的 eligible demand 可查看 detail 並提交 response；已有 own response 時**一律**顯示 response 狀態（而非重複表單），**不論目前 `TeacherProfile.status` 是否仍 approved、也不論該 demand 是否仍 eligible**（例如 suspended teacher、或 demand 已 matched/cancelled，仍可看到自己過去的 response 狀態）；withdraw 需真正確認步驟且成功後狀態更新為對應語意（依 D8=A，withdraw 後不再顯示可重新提交的入口，改為說明性文案）；suspended teacher 嘗試 withdraw 時得到清楚但不羞辱的錯誤說明（非崩潰、非空白頁）；非 approved 且無 own response 時導向溫和引導；非 eligible 且無 own response 的 demand id 回 not-found；受控欄位越界時前端擋、後端權威驗證。
- **checks**：`tsc`/ESLint/`next build`；Slice 9 smoke 覆蓋 submit、重複 submit 被擋、withdraw、withdraw 後狀態正確。
- **manual smoke scenarios**：360/390px 完成 response 表單；長 message 不溢出；withdraw 確認流程手機可操作。
- **security / RWD / brand review**：Security（own-scoped、TOCTOU、二次確認的後端權威驗證）；RWD（第 7 節全部項目）；Brand（response form 引導語氣、withdraw 確認文案，第 6 節）。
- **rollback notes**：刪除 `src/app/teacher/demands/[demandRequestId]/*`。
- **stop conditions**：Slice 3/4 未合入 → 停止。
- **需要 PO 再次確認？**：否。

### Slice 8 — Organizer demand detail read-only responses 整合

- **goal**：在 organizer 自己的 demand detail 頁面新增/整合「收到的回應」read-only 區塊。
- **slice type**：micro（跨 plan 整合點，需明確界定與 Organizer draft plan 的邊界）。
- **prerequisites**：Slice 5 完成；**Organizer draft plan Slice 6（organizer demand list/detail route）已落地**（`/organizer/demands/[demandRequestId]` 頁面已存在）。
- **allowed files**：
  - 若 Organizer draft plan 已提供可擴充的 detail page（`src/app/organizer/demands/[demandRequestId]/page.tsx`）：**本 slice 只能新增一個獨立的顯示區塊/子元件**，例如 `src/app/organizer/demands/[demandRequestId]/_components/response-list.tsx`（純顯示，呼叫 Slice 5 的 `listResponsesForOwnDemandRequest`），並在該 page.tsx 中**新增**（非重寫）引用該元件的一行。**修改既有 page.tsx 屬跨疆域高風險動作**，必須在白名單中明確標註「僅新增 import + 一個 JSX 區塊，不更動既有邏輯」，且該檔案的其餘部分是 Organizer draft plan 的疆域，本 slice 不得動其他任何行。
- **forbidden files / areas**：`src/domain/**`（只 import Slice 5 的 service）、`src/app/organizer/demands/[demandRequestId]/actions.ts`（若存在，不得修改——本 slice 唯讀無 mutation）、`src/app/organizer/**` 其餘檔案、`prisma/**`、`tests/**`、共同 forbidden。
- **domain and permission rules**：唯讀；ownership 驗證全部委由 Slice 5 domain；不提供任何 shortlist/select UI 或按鈕（即使只是 disabled 佔位，也不做——避免視覺上暗示「即將可用」造成使用者誤解，且屬於下一份 plan 的職責）。
- **acceptance criteria**：organizer 在自己 demand detail 可看到收到的 responses（D13 DTO 呈現，cards 於手機版）；無 response 時顯示平靜 empty state（例如「目前還沒有老師回應，之後有回應會顯示在這裡」）；非 own demand 無法透過此區塊間接洩漏資料（因頁面本身已受 Organizer draft plan 的 ownership 檢查保護，本 slice 的 service 呼叫是第二層防線）。
- **checks**：`tsc`/ESLint/`next build`；Slice 9 smoke 覆蓋。
- **manual smoke scenarios**：360/390px response cards 顯示正確；organizer 看不到其他 organizer demand 的 responses（雙重防線：頁面層 + service 層）。
- **security / RWD / brand review**：Security（雙重 ownership 防線）；RWD（cards，第 7 節）；Brand（response 呈現不強調價格排序，第 6 節）。
- **rollback notes**：移除新增的元件檔與 page.tsx 中新增的一行 import/JSX。
- **stop conditions**：Organizer draft plan 的 demand detail page 尚未落地、或其檔案結構與本 slice 假設不符 → 停止回報，不強行修改對方疆域。
- **需要 PO 再次確認？**：否（若上游已落地且 D 已拍板）；若發現必須大幅修改 Organizer draft plan 的既有 detail page 結構才能整合 → 是（跨 plan 影響需 PO 知情）。

### Slice 9 — Tests / security / RWD / brand verification（Playwright smoke）

- **goal**：以既有 Playwright smoke 覆蓋本 feature 關鍵 flow 與**負向 security cases**，並確認既有 smoke 不回歸。
- **slice type**：micro（測試，涉及 core flow + security 驗證）。
- **prerequisites**：Slice 3–8 已合入（或已合入者先寫，其餘標 pending 回報）；D16＝只用 Playwright smoke；**需要 seed 資料橫跨 `User`/`TeacherProfile`/`OrganizerProfile`/`Organization`/`DemandRequest`/`DemandResponse`，其中 `DemandRequest` 的 seed helper 依賴 Organizer draft plan 的 schema 已落地**。
- **allowed files**：
  - `tests/smoke/teacher-demand-pool.spec.ts`（approved teacher 瀏覽 pool/detail；非 approved 各 status 被擋；不 eligible 的 demand（依 `eligibleStatuses`）不可見；直接猜 demand id 不能讀取不 eligible/private 內容；若 D11=A，`teacher_responded` demand 仍可見）
  - `tests/smoke/teacher-demand-response.spec.ts`（submit、重複 submit 被擋、own-only 查看、withdraw、withdraw 後狀態、suspended 不可 withdraw、受控欄位驗證）
  - `tests/smoke/organizer-demand-responses.spec.ts`（organizer read-only 查看自己 demand 的 responses；跨 organizer 被擋；DTO 資料最小化斷言）
  - （如需）共用 seed helper：置於上述 spec 內嵌 `PrismaClient`，或 `tests/smoke/_helpers/*.ts` 並列白名單。
- **forbidden files / areas**：`src/**`、`prisma/**`、`package.json`、所有 config、既有三個 teacher/admin-teacher smoke 檔（預設不改，除非為既有斷言相容性微調且於 review packet 說明）、Organizer draft plan 未來新增的 smoke 檔（`tests/smoke/organizer-demand.spec.ts`/`admin-demands.spec.ts`，若已存在，不得修改）、共同 forbidden。
- **domain and permission rules（測試需覆蓋）**：
  - 正向：approved teacher 瀏覽 pool/detail；submit response；查看自己 response status；withdraw；organizer 查看自己 demand 的 responses。
  - **負向 security（必含，對齊任務第 8 節要求）**：
    1. 無 `TeacherProfile` 的一般 signed-in user 不可進 pool。
    2. `draft`/`submitted`/`rejected`/`suspended` teacher 不可進 pool。
    3. approved teacher 可見 `eligibleStatuses` 內的 demand；不 eligible 的 demand 不可見（直接猜 id 不能讀取）；若 D11=A，`teacher_responded` 仍在 eligible 集合內、不可誤判為不可見。
    4. Teacher A 不可讀寫 Teacher B 的 response。
    5. 同一 teacher concurrent submit 不可產生重複 response（依 D8 的 unique constraint，透過第 4 節規則 8 的原子 `INSERT ... WHERE EXISTS` 保證）。
    6. 非 organizer owner 不可查看 responses；organizer A 不可查看 organizer B demand 的 responses。
    7. response `message`/`proposedTimeSlots`/`proposedPrice` validation（過短/越界受控清單被擋）。
    8. invalid status 不可 submit/withdraw（例如已 withdrawn 的 response 不可再 withdraw）。
    9. demand 狀態在 submit 之前已改變（例如恰好被 admin cancel/expire）時不可錯誤接受 response（以循序方式驗證第 4 節規則 8 的原子 SQL guard：先讓 demand 離開 eligible 狀態，再嘗試 submit，斷言被擋且錯誤訊息正確——真正的資料庫層級併發競態由 SQL 語句原子性保證，非本測試範圍）。
    10. DTO 不包含私人 contact（`Organization.contactEmail/contactPhone`）、`TeacherProfile.rejectionReason`、`User.email/phone`（依 D3/D13）。
    11. 360px/390px 無水平溢出（pool cards、detail、response form、organizer response cards）。
    12. **suspended teacher 仍可讀到自己既有 response（含 demand 已非 eligible 時），但呼叫 withdraw 被擋**（依 D12 落地機制；驗證「查看」與「withdraw」是兩條獨立規則，未被 `requireApprovedTeacher()` 誤一起擋掉）。
    13. teacher 對已離開 published（如 matched/cancelled）的 demand，其既有 `submitted` response 仍可正常 withdraw（依 D10：withdraw 不看 demand 當下狀態）。
    14. published demand 數量超過單頁上限時，「載入更多」/下一頁可取得原本看不到的 demand，確認無 demand 因固定 `take` 上限而永久不可見（依 D15 修正後的 pagination）。
    15. 若 D11=A：第二位 teacher 對已有一筆 response 的 demand（狀態已是 `teacher_responded`）仍可成功提交自己的 response（驗證 eligibility 已同步涵蓋 `teacher_responded`，且 `markDemandRequestAsRespondedIfPublished` 的 `count===0` 不誤判為錯誤）。
  - **seed 清理順序**：`afterAll` 須依 `DemandResponse → DemandRequest → Organization → OrganizerProfile/TeacherProfile → User`（或倚賴各層 `onDelete: Cascade`）清理，避免 FK 限制導致清理失敗。
- **acceptance criteria**：上述正向 + 15 條負向皆有對應斷言且綠燈；既有 teacher/admin-teacher smoke 維持綠燈。
- **checks**：`npm run test:smoke`（含 `next build`）綠燈；`tsc`/ESLint。**本 planning 不要求實際執行**；施工時執行。
- **manual smoke scenarios**：手機視窗（360/390px）人工走查 pool/detail/response form/withdraw/organizer response cards。
- **security / RWD / brand review**：Security（本 slice 即 security 驗證集中地，11 條負向為硬要求）；RWD（360/390px 溢出斷言）；Brand（人工確認文案語氣，第 6 節）。
- **rollback notes**：刪除新增 spec/helper；若曾微調既有 spec，一併還原。
- **stop conditions**：Slice 3–8 尚未合入者，只寫已具對象的案例，其餘標 pending 回報；`DemandRequest` seed 依賴的 Organizer draft plan schema 尚未 **commit + migrate**（即使已存在於 working tree）→ 本 slice 的相關 spec 無法執行，需標記 blocked。
- **需要 PO 再次確認？**：否。

### Slice 10 — Slice 順序與相依總覽（非施工 slice，彙整用）

```text
（前置）Organizer draft plan D1–D15 已拍板 + Teacher rejection docs/schema 已 commit
   ↓
Slice 0（本 plan docs 對齊）
   ↓
（前置）Organizer draft plan Slice 1–2（DemandRequest schema + migration）已合入
   ↓
Slice 1（DemandResponse schema） → Slice 2（migration）
   ↓
Slice 3（approved teacher capability + published-demand read） ── 可與 Slice 5 平行（各自 review）
   ↓                                                                ↑（需 Organizer draft plan organizer capability 已落地）
Slice 4（submit/withdraw domain）                              Slice 5（organizer read-only response service）
   ↓                                                                ↓
Slice 6（/teacher/demands list）                                    │
   ↓                                                                │
Slice 7（/teacher/demands/[id] detail + submit/withdraw）           │
   ↓                                                                │
                    （需 Organizer draft plan Slice 6 已落地）
                                    ↓
                              Slice 8（organizer demand detail 整合 responses）
                                    ↓
                              Slice 9（Playwright smoke + security/RWD/brand 驗證）
```

- Slice 3 與 Slice 5 可平行開發（皆為唯讀 service，互不依賴），但 Slice 5 額外依賴 Organizer draft plan 的 organizer capability 介面已落地。
- Slice 6/7（teacher 端 route）只依賴 Slice 3/4，**不依賴** Organizer draft plan 的 route 層落地——這代表若 Organizer draft plan 的 schema/migration/organizer capability 已落地但其 route UI 尚未完成，Slice 6/7 仍可獨立施工與 review。
- Slice 8（organizer 端整合）**必須**等 Organizer draft plan 的 demand detail route 存在才能開始，是本 plan 對上游 route 層要求最晚的一個 slice。
- Slice 9 建議最後，且其 seed 資料完整性取決於上游 `DemandRequest` schema 是否已可用。

---

## 9. Verification planning（本 planning 不實際執行）

- **測試工具現況**：repo 無 Vitest、無 unit test，只有 Playwright smoke。**本 plan 不默認新增任何 package**；`package.json` 不可改（D16）。若未來要 unit test，引入 Vitest 屬另案獨立前置 slice，需 PO 核准。
- **規劃中的檢查**（施工時各 slice 執行，本 planning-only 不跑）：
  - `tsc`（TypeScript）、`eslint`（ESLint）：所有含 `src/**` 變更的 slice。
  - `npx prisma validate` / `prisma generate` / `migrate diff`（Slice 1/2，隔離 dev DB，不對共享/正式 DB 施作）。
  - `next build`：含 route 的 slice（6/7/8）。
  - `npm run test:smoke`（Playwright，`pretest:smoke` 先 `next build`）：Slice 9 集中執行。
- **必含負向 security cases**（Slice 9，完整列表見第 8 節 Slice 9）：
  - 無 `TeacherProfile` 不可進 pool。
  - draft/submitted/rejected/suspended teacher 不可進 pool。
  - approved teacher 可見 `eligibleStatuses` 內的 demand；不 eligible 的 demand 不可見（`eligibleStatuses` 依 D1/D11 裁定，不等於單純 `published`）。
  - 直接猜 private demand id 不能讀取。
  - Teacher A 不可讀寫 Teacher B 的 response。
  - 同一 teacher concurrent submit 不可產生重複 response（原子 SQL guard，見第 4 節規則 8）。
  - 非 organizer owner 不可查看 responses；organizer A 不可查看 organizer B demand 的 responses。
  - response message/time/price validation。
  - invalid status 不可 submit/withdraw。
  - demand 狀態在 submit 之前已改變時不可錯誤接受 response（TOCTOU，循序驗證代理）。
  - DTO 不包含私人 contact、internal note 或 rejection reason。
  - 360px/390px 無水平溢出。
  - suspended teacher 仍可讀到既有 response 但不可 withdraw（D12）。
  - demand 已非 published（matched/cancelled）時，own `submitted` response 仍可 withdraw（D10）。
  - published demand 超過單頁上限時分頁可取得全部（D15）。
  - 若 D11=A：多位 teacher 皆可對已有回應的 demand 繼續提交（eligibility 涵蓋 `teacher_responded`）。
- **RWD 驗證**：pool、detail、response form、organizer response list 至少 360px/390px。
- **本 planning-only 任務不要求實際執行 build 或 smoke**；上述為施工時的驗證計畫。

---

## 10. Dependency and Sequencing

### 10.1 Organizer demand plan 的決策與程式碼落地進度，對本 plan 各部分的影響

> **狀態更新（2026-07-22）**：Organizer draft plan 的 D1–D15 已由產品主人拍板，該文件已取得 `codex-peer-reviewed` marker（7 rounds）。其 **Slice 0（docs 對齊）與 Slice 1（`prisma/schema.prisma` 新增 `DemandRequest`）皆已於另一 session 落地於 working tree，但尚未 commit**；Slice 2（migration）以後尚未開始。本節原先「決策未拍板」的 conditional planning 情境已不適用，以下重新分類為「**決策層面已確定、可直接引用**」與「**仍需等程式碼實際落地（commit/migration/service/route）**」兩類。

**決策已確定，欄位/清單/命名可直接引用（不再是條件句）**：

- D3（demand detail DTO allowlist 的欄位名稱——`serviceType`（非 `serviceTypeId`），已由 Organizer draft plan D5 拍板並反映於 working tree 實際 schema）。
- D6（`proposedTimeSlots` 與 `DemandRequest.preferredTimeSlots` 共用同一份 6 項受控清單，已由 Organizer draft plan D6/D7 拍板）。
- D11（已確認選 B，動態推導，**不需要** `demand-request` domain 的 transition helper，此項已完全解決，不再是對 Organizer draft plan 的待定需求）。

**決策已確定，但仍需等程式碼實際落地才能施工**：

- Slice 1（`DemandResponse` 的 `demandRequest` relation 需要 `DemandRequest` model 存在於 `schema.prisma`——**現已存在於 working tree**，但本 plan 的 Slice 1 仍須等 Organizer draft plan 的 Slice 1 **commit** 後才能動筆，避免同時編輯同一份未 commit 檔案，見 Slice 1 的 stop condition）。
- Slice 3（讀取 `DemandRequest` 欄位的 select 清單——欄位名稱已可從 working tree schema 核對，但仍須等 commit + migration 後才能在穩定環境施工）。
- Slice 5/8（organizer capability helper 與 organizer demand detail route——`src/domain/organizer-profile/*`、`src/app/organizer/*` 仍完全不存在於 repo，此二 slice 仍是真正的 conditional planning，需等對應程式碼落地）。

### 10.2 Organizer demand 至少完成哪些 slices，Teacher pool 才能施工？

- **Domain-only 部分（Slice 1、3、4 的 schema/service 層）**：至少需要 Organizer draft plan **Slice 1–2**（`DemandRequest` schema + migration）已合入且 dev 環境有實際 `published` 資料可測（即至少也需要 Slice 4 的 draft/submit 與 Slice 7 的 admin publish 已可運作，才有真實資料驗證 Slice 3/4 的查詢邏輯）。
- **Route 部分（Slice 6、7）**：只依賴上述 domain 部分，**不依賴** Organizer draft plan 的 route 層（Slice 5a–7）。
- **Slice 5、8（organizer 端整合）**：額外依賴 Organizer draft plan **Slice 3**（organizer capability）與 **Slice 6**（organizer demand list/detail route）已落地。
- **結論**：Teacher demand pool 的「讀取」半邊（Slice 3、6）比「organizer 整合」半邊（Slice 5、8）更早可以開始，因為前者只需要 `DemandRequest` 有資料可讀，不需要 organizer 端 UI 存在。

### 10.3 Teacher rejection feature 至少完成到哪裡，approved/suspended capability 才可安全依賴？

**已經可以安全依賴，且 teacher-rejection 功能已於 2026-07-21 本次工作階段內 commit（詳見 2.1 節）。** 如 2.2 節確認，`TeacherProfileStatus` enum 與 `status` 欄位（含 `approved`/`suspended` 值）在最早的 init migration 就已是 committed baseline，與 teacher-rejection 的 `rejectionReason` 欄位 + reject service/state/UI（現已一併 commit）是兩批各自獨立、但現在都已穩定的 committed 變更。**現存的施工紀律**：本 feature 仍**不得修改** teacher-rejection 的既有檔案（`src/domain/teacher-profile/**`、`src/app/admin/teachers/**`），維持 module 邊界即可，不再有「誤把他人未 commit 變更一併帶入」的風險（因為已無未 commit 變更可誤帶）。

### 10.4 Pool 讀取 slice 是否可以早於 DemandResponse schema 安全實作？

**可以。** Slice 3（approved teacher capability + published-demand read）**不依賴** `DemandResponse` model 是否存在——它只讀 `TeacherProfile`（capability）與 `DemandRequest`（demand 內容），完全不涉及 response 資料。因此 Slice 3、Slice 6（`/teacher/demands` list route）理論上可以在 Slice 1/2（`DemandResponse` schema/migration）之前先完成，只要 `DemandRequest` 已可用。本 plan 第 8 節仍將 Slice 3 排在 Slice 1–2 之後，是為了**保持 slice 編號與 schema 落地順序一致、降低認知負擔**，而非技術上的硬性依賴——若 PO 希望更快看到 teacher 端可瀏覽的畫面，**可以要求調整順序，先做 Slice 3+6，再做 Slice 1–2+4+7**，此為排序彈性，不影響任何 D 決策的正確性。

### 10.5 哪些檔案會與未完成的 Organizer/Teacher feature 共用，如何避免 dirty working tree、誤 stage 或誤覆蓋？

| 共用/鄰近檔案 | 誰在改 | 本 plan 的因應 |
|---|---|---|
| `prisma/schema.prisma` | teacher-rejection（`rejectionReason`，**已於本次工作階段 commit，不再是風險**）、Organizer draft plan（`DemandRequest` 等，**決策已拍板，且 schema 已於另一 session 落地於 working tree，但尚未 commit**）、本 plan（`DemandResponse`） | 本 plan 的 Slice 1 **必須**在 Organizer draft plan 的 `DemandRequest` schema 變更**已 commit**（不只是存在於 working tree）後才動筆，且 Builder 施工前须 `git diff prisma/schema.prisma` 確認自己只新增了 `DemandResponse` 相關內容、未意外覆蓋或吸收 Organizer draft plan 尚未 commit 的變更。 |
| `docs/domain/data-model.md` / `state-transition-details.md` / `permissions.md` / `permissions-matrix.md` | 三方皆可能觸及（各自不同段落） | 本 plan Slice 0 只新增/修改 `DemandResponse`/demand-pool 可見性相關段落，**逐段編輯前先讀最新版本**，不得用整檔覆寫（避免 Edit 工具的大範圍替換不小心吃掉其他人段落）。 |
| `docs/product/route-map.md` | Organizer draft plan（新增 organizer routes）、本 plan（若需補充 teacher/organizer route 描述細節） | 同上，逐段編輯，Slice 0 checklist 明確列出「只改哪幾行」。 |
| `src/app/organizer/demands/[demandRequestId]/page.tsx` | Organizer draft plan（建立此檔）、本 plan Slice 8（新增 responses 區塊） | 本 plan Slice 8 **必須**在該檔已由 Organizer draft plan 建立並穩定後才動筆，且只新增 import + 一個 JSX 區塊，不重寫既有內容（見 Slice 8 allowed files 說明）。 |
| `package.json` / `next.config.ts` / `playwright.config.ts` | 使用者既有本地修改 | 本 plan 完全不碰，全程共同 forbidden。 |

### 10.6 是否應先完成並 review 上游 feature，再開始本 feature Builder？

**建議：是，尤其是 Slice 1（schema）與 Slice 5/8（organizer 整合）。** 理由（**現況更新**：Organizer draft plan 的 D1–D15 決策已拍板，以下風險改為「code review/實作階段可能與已拍板規劃有出入」而非「決策本身可能改變」）：

- Slice 1 若在 Organizer draft plan 的 `DemandRequest` schema **實際合入 committed schema** 前就動筆，即使欄位/`onDelete` 政策已拍板且文件已通過 7 輪 Codex peer review（該多輪審查過程中曾發現並修正 schema nullability 等細節，顯示「決策已拍板」不代表「文件細節從第一版就完全正確」），仍可能在該 plan 的實際 Slice 1 施工階段發現需要微調，本 plan 的 relation 定義可能需要跟著改，造成重工。
- Slice 5/8 直接依賴 Organizer draft plan 的 organizer capability 與 route 層**程式碼**，若那些尚未實際落地，這兩個 slice 連「該 import 什麼」都無法確定（即使決策已拍板，尚未落地的程式碼仍可能在實作時與規劃有細節出入）。

**可以不等待、可平行的部分**：

- 本 plan 的 **Planning 文件本身**（本輪即是）。
- Slice 0（docs 對齊；本 plan 自身 D1–D16 已於 2026-07-21/22 全部拍板，且不需要等 Organizer draft plan 的**程式碼**落地——其 D 決策已拍板，只是本 plan 的 Slice 0 docs 撰寫本身不需要等對方程式碼存在）。
- D1、D2、D7–D10、D12–D16**已全部拍板**（不涉及 `DemandRequest` 具體形狀的決策，其施工規劃本就不依賴 Organizer draft plan 的程式碼是否落地；D11 更早於 2026-07-21 單獨確認）。
- Slice 3、Slice 6（若 PO 接受 10.4 的排序彈性，且 `DemandRequest` 至少 schema 已**實際落地**有資料可讀，organizer 端 UI 是否完成不影響這兩個 slice）。

### 10.7 即使 planning 可平行，implementation 應如何保持一次一個 core flow？

- **一次只讓一個 feature 的高風險 slice（Prisma schema/migration/state machine/core flow mutation）進入實作**，即使兩份 plan 都已拍板。理由：`docs/harness/mvp-slicing.md` 明確要求「不混合多個高風險邊界」，兩份 plan 若同時動 `prisma/schema.prisma`（即使是不同 model），仍會讓 working tree 同時存在兩組未 commit 的高風險 schema 變更，難以獨立 review/rollback。
- **具體建議順序**：Organizer draft plan 的 Slice 1–2（schema/migration）先完整合入並 commit → 本 plan 的 Slice 1–2 才開始 → 兩者的 migration timestamp 自然保持線性、review 邊界清楚。
- **UI/route 層（非高風險 slice）可以更寬鬆地交錯**：例如本 plan 的 Slice 6/7（teacher 端 route）與 Organizer draft plan 的 Slice 5a–7（organizer 端 route）技術上可以由不同人平行處理，因為它們觸碰的檔案樹狀不重疊（`src/app/teacher/**` vs `src/app/organizer/**`），唯一交會點是 Slice 8（本 plan）與 Organizer draft plan Slice 6 的同一個 `page.tsx`，這一點應**明確排在 Organizer draft plan 該檔案穩定之後**（見 10.5、10.6）。
- **每個 slice 仍須各自 review、各自可 rollback**，不因為「上游已拍板」就把多個 slice 合併成一次大 commit。

---

## 11. Non-goals（本 feature 明確不做）

- 不做 **shortlist**、**select**、**matching decision**（`DemandRequest: teacher_responded → matched`）——留給下一份獨立 core-flow plan。
- 不做 **ClassSession**（含 `converted_to_class`）。
- 不做 **Enrollment**。
- 不做 **Teacher availability calendar**、**automatic availability matching**。
- 不做 **AI recommendation/ranking**、**competitive bidding**。
- 不做 **payment/refund**（`proposedPrice` 僅資訊性欄位）。
- 不做 **email/notification**（demand response submitted/withdrawn 通知）——延後，見 D14。
- 不做 **public demand pool**（未登入或非 approved teacher 可見的公開版本）。
- 不做 **teacher 與 organizer 在 controlled response 以外的聯絡管道**（無私訊功能）。
- 不做 **Google Calendar sync**。
- 不做 **Wellness / Academy / Retreat** 模組。
- 不做 **native app**。
- 不做 **DemandRequest 的任何 mutation**（本 plan 只讀取 `DemandRequest`，若 D11 選 A 才會有唯一的、且需 Organizer draft plan 配合的 persisted write；預設推薦 D11=B，完全不寫入 `DemandRequest`）。
- 不改 `next.config.ts` / `package.json` / `playwright.config.ts`（使用者既有本地修改，須保留且不納入）。
- 不碰 teacher-rejection 既有疆域（`src/domain/teacher-profile/**`、`src/app/admin/teachers/**`，已 commit，見 §2.1）；不碰 Organizer draft plan 尚未落地的疆域（`src/domain/organizer-profile/**`、`src/domain/demand-request/**`、`src/app/organizer/**` 除 Slice 8 明確允許的最小整合外）；不讀 `.env`；不 commit、不 push。

---

## 12. Rollback 總則

- **Slice 1/2（schema/migration）最關鍵**：務必 additive（新 model/enum，對 `DemandRequest`/`TeacherProfile` 僅新增反向 relation 欄位）。禁止對共享/正式 DB 施作不可逆操作；rollback 僅需 drop 新表/enum/欄位並刪 migration（未共享前）。
- **依相依反序 rollback**：Slice 9 → 8 → 7 → 6 → 5/4/3（3、4、5 之間依實際完成順序）→ 2 → 1 → 0。UI/service 為純程式碼，還原檔案/import/export 即可。
- **資料殘留**：若已寫入 response 後回退欄位，drop column/table 會遺失資料；回退前確認無正式資料依賴。
- **文件同步**：回退 schema 需同步回退 Slice 0 docs，避免 docs 與程式碼漂移。
- **跨 plan 隔離**：任何 rollback 不得波及 teacher-rejection 或 Organizer draft plan 的檔案；若發現本 feature 誤動其疆域，立即回報並還原。
- **Slice 8 的特別 rollback 注意**：因其修改了 Organizer draft plan 擁有的 `page.tsx`（僅新增一行 import + 一個 JSX 區塊），rollback 時須精確移除該兩處新增，不得誤還原到「該檔案本身在 Organizer draft plan 落地前」的狀態（那會破壞上游功能）。

---

## 13. Planning-only self review

- **變更檔案**：僅新增本檔 `docs/superpowers/plans/2026-07-21-teacher-demand-pool-response-plan.md`。未動 `prisma/**`、`src/**`、`tests/**`、既有 docs、`package.json`、`next.config.ts`、`playwright.config.ts`；未讀 `.env`；未 commit / push。
- **V1 scope**：符合；只建立 teacher demand pool + response foundation，未擴張 shortlist/select/matched/ClassSession/Enrollment/payment/AI/calendar/notification/Wellness-Academy-Retreat/native app（第 11 節）。
- **permissions**：approved-teacher-only pool/detail、own-only response CRUD-subset（create/read/withdraw）、organizer own-only read-only responses，皆以 server/domain layer 檢查（第 4 節），Slice 9 負向測試覆蓋。
- **state machine**：`DemandResponse` 本輪僅接線 `(none)→submitted`、`submitted→withdrawn`；其餘保留（D7）。`DemandRequest` 本輪**不做任何 mutation**（預設 D11=B，動態推導），與既有文件的落差已要求 Slice 0 明確註記。
- **security**：IDOR 防護（id 僅等值驗證、server 解析 own id）、demand visibility（published-only、DTO 資料最小化）、TOCTOU 防護（transaction + unique constraint）——皆列入相關 slice 與 Slice 9。
- **RWD**：pool/detail/response form/organizer response list 360/390px 驗證（第 7 節、Slice 6/7/8/9）。
- **brand**：非比價工具、溫和引導、withdraw 誠實但不高壓確認（第 6 節、Slice 6/7/8）。
- **上游依賴/衝突**：已於第 2、10 節詳細分析——Organizer draft plan 的 D1–D15 已於 2026-07-21 拍板，且該文件**已取得 `codex-peer-reviewed` marker**（7 rounds，marker 時間戳 2026-07-22），其 **Slice 0（docs 對齊）與 Slice 1（schema）皆已於另一 session 落地於 working tree（尚未 commit）**，故本 plan 對 `DemandRequest` 的欄位形狀/清單/數值可作具體事實引用，且可直接參照 working tree schema 核對欄位名稱；但該 schema 變更**尚未 commit**、Slice 2 migration 與 Slice 3 以後的 service/route **仍尚未落地**，本 plan 對 `DemandRequest` 實際 API 仍標示為 prerequisite contract。teacher-rejection 的 approved/suspended capability 基礎已是 committed baseline，且其 in-progress 變更已於本次工作階段中被 commit（5 個新 commit），不再是 uncommitted 風險。
- **產品主人決策**：D1–D16 **已於 2026-07-21（D11）與 2026-07-22（其餘）全部拍板**（第 5.1 節決策記錄），本 plan 自身的 High-risk Planning Gate **已解除**。即使如此，仍需 Organizer draft plan 的實際程式碼（schema/migration/service/route）落地到第 10 節所述前提，才能真正動工涉及 `DemandRequest` 的 slice——這是**程式碼落地**層面的依賴，不是決策層面的依賴。本 plan 本身未附任何可直接施工的 Builder prompt（因為即使決策已拍板，Builder 施工前仍須自行核對 repo 現況，且部分 slice 仍 blocked 於上游程式碼落地）。
- **未修改無關檔案**：無。

<!-- codex-peer-reviewed: 2026-07-22T06:09:00Z rounds=16 verdict=approved -->
