# TeacherProfile Suspend/Restore — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D9）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

**重要澄清（跟這輪最初的假設不同，逐行核對程式碼後才發現）**：這輪原本的出發點是「`suspended → approved` 的 restore 一直沒有正式 UI/API」，但實際稽核 `src/domain/teacher-profile/` 全部檔案後發現：**`approved → suspended`（暫停）本身也從未真正實作過**。整個 repo 裡沒有任何一處程式碼會把 `TeacherProfile.status` 寫成 `"suspended"`（已用 `grep` 逐字確認）。`docs/domain/permissions-matrix.md`、`docs/domain/state-transition-details.md`、`docs/specs/teacher-onboarding-spec.md` 三份文件都把 `suspend` 描述成「已經是 V1 admin action」，但這是文件跟現實脫節，不是真的落地狀態——這是本輪需要一併修正的文件債務（見 D9）。

因此本輪的真實範圍是：**`approved → suspended`（暫停）與 `suspended → approved`（恢復）一起接線**，不是「只補 restore」——restore 若沒有 suspend，語意上無法成立（沒有東西可以恢復）。好消息是：所有下游會檢查 `suspended` 狀態的既有 guard（`requireApprovedTeacher()`、`withdrawOwnDemandResponse` 的顯式檢查、Teacher dashboard 的 `suspended` 文案）**全部都已經正確寫好、只是從未被真正觸發過**（2.1 已逐一核對）——這代表本輪的爆炸半徑其實很小：只需要新增兩個 Admin mutation 與對應 UI，不需要修改任何既有的下游判斷邏輯。

### 1.2 風險等級

低–中（codex round 1 指出後上修）。這是 Admin-only、單一狀態欄位翻轉的動作，需要一個新的 schema 欄位（`suspensionReason`，見 D1/D8）與兩個新的 `NotificationType` enum 值（見 D4/D8，需要 migration，跟 `demand-request-cancellation` D8 是同一類低風險加法變更）。**修正（codex round 1 指出的問題，已採納）：本輪不是完全零 cascade——`selectDemandResponseForOrganizer` 目前完全沒有檢查 teacherProfile 狀態，暫停一位老師後，Organizer 仍可以選定他既有的 `submitted` response、進而建立新的 `ClassSession`，直接違反「暫停限制未來能力」這個核心目的。本輪必須同時修正這個既有函式（見 D7 修正版），這代表本輪會觸碰一個已經上線、被其他兩輪（`demand-response-selection-and-matching`、`demand-request-cancellation`）依賴並測試過的共用檔案 `src/domain/demand-response/__internal__/select-and-submit-core.ts`，不是原本設想的「完全不動任何既有程式碼」，風險因此上修一級（但修正方式是對稱套用該檔案裡已經存在的既有寫法，不是發明新邏輯，見 D7）。

### 1.3 命名澄清

- **本輪的「暫停」／「恢復」**指 `TeacherProfile.status: approved ↔ suspended` 這一組雙向轉換，跟老師申請審核（`draft → submitted → approved/rejected`）是完全獨立的既有流程，本輪不改動後者任何一行程式碼。
- **`suspensionReason`（本輪新增欄位）**：跟既有 `rejectionReason` 是兩個獨立欄位，不 reuse 同一個欄位——理由見 D1。

## 2. 現況核對（Repo Reality Audit；2026-07-29 working tree = committed `main` @ `9781fd1`）

### 2.1 已 committed 的基礎（可直接依賴）

- **`suspended` 是合法 enum 值，但從未被寫入過**：`TeacherProfileStatus`（`prisma/schema.prisma`）已經有 `suspended`，`src/domain/teacher-profile/state.ts` 的 `validateTeacherProfileSubmitTransition`/`validateTeacherProfileApproveTransition`/`validateTeacherProfileRejectTransition` 三個既有 guard 都已經正確把 `suspended` 當成一個會擋下其他轉換的來源狀態處理——但**沒有任何函式會把狀態寫成 `suspended`**，也沒有對應的 `validateTeacherProfileSuspendTransition`/`validateTeacherProfileRestoreTransition`（已用 `grep "status:\s*\"suspended\""` 對整個 `src/` 確認零筆結果）。
- **`src/domain/teacher-profile/service.ts` 沒有 `__internal__` 子目錄**，`approveSubmittedTeacherProfileApplication`／`rejectSubmittedTeacherProfileApplication`（line 384-554）都直接是頂層 exported 函式，內建 `requireAdmin()` + 單一 `prisma.teacherProfile.updateMany({ where: {id, status: "submitted"}, ... })` + `count === 0` 時再查一次分類錯誤原因的既有寫法，沒有 own-scoped 解析（Admin 操作不需要）。本輪比照同一個既有形狀。
- **`requireApprovedTeacher()`（`src/domain/demand-response/capability.ts` line 11-27）已經正確只認 `status === "approved"`**：一旦本輪真的把某個 teacher 標記為 `suspended`，這個既有 gate 會立刻正確擋下該老師查看/回應新 demand，不需要修改這個檔案。
- **`withdrawOwnDemandResponse` 已經有顯式的 suspended 檢查**（`src/domain/demand-response/service.ts` line 126-129 的既有註解：「D12：withdraw 額外顯式檢查 `teacherProfile.status === "approved"`（`suspended` 不可 withdraw），不透過 `requireApprovedTeacher()`，因為那會連「查看」都一併擋掉」）——這代表被暫停的老師仍可以查看自己既有的 response（唯讀），但不能再撤回，這個既有行為本輪不需要改動。
- **`src/app/teacher/dashboard/page.tsx` 的 `statusCopy.suspended`（line 50-57）已經寫好完整文案**（label「Suspended」、標題「你的老師狀態目前暫停中」、內文「此狀態下不會公開顯示，也不能回應新的 demand request。若需要協助，請聯絡平台管理者。」），從未被觸發過。一旦本輪真的寫入 `suspended`，這個既有頁面會**自動**正確顯示，不需要改這個檔案——但這個既有文案沒有顯示 suspension 原因，D1 決定新增一個顯示原因的區塊（比照同檔案 `rejected` 分支既有的 `rejectionReason` 顯示區塊，line 124-136）。
- **`src/app/admin/teachers/page.tsx` 目前只列出 `status: "submitted"` 的申請**（透過 `listSubmittedTeacherProfileApplicationsForAdmin()`），完全沒有列出 `approved`／`suspended` 老師的介面——本輪需要新增查詢與 UI 區塊（見 D3）。
- **`AdminNote` model 在 `prisma/schema.prisma` 裡不存在**：`docs/domain/data-model.md` 只是把它列為完整設計的一部分，這個 repo 從未真的建立這個 model（跟 `Review` model 目前沒有對應 `src/domain/review/` 目錄是同一類「文件描述完整設計、程式碼只落地部分」的既有情況）。本輪不建立它，理由見 D1。
- **`NotificationType` 目前沒有任何跟 suspend/restore 相關的值**：已核對 `prisma/schema.prisma` 的 enum 定義（15 個值：`teacher_application_*` 三個、`demand_request_*` 四個、`demand_response_*` 兩個、`class_session_*` 三個、`enrollment_*` 兩個、`class_reminder_basic`），沒有 `teacher_profile_suspended`／`teacher_profile_restored` 這類值，也沒有被預先保留——本輪需要真的跑一次 migration（跟 `demand-request-cancellation` D8 是同一類「原始事件表沒規劃過、需要新增值」的情況，不是「接上已保留的值」）。
- **修正（codex round 1 指出的問題，已採納）：`submitDemandResponseForTeacher` 已經正確檢查 teacher 資格，但 `selectDemandResponseForOrganizer` 沒有——這是本輪真正的既有缺口，不是本輪造成的**：`src/domain/demand-response/__internal__/select-and-submit-core.ts` 的 `submitDemandResponseForTeacher`（line 72-154）在自己的原子 INSERT 陳述式裡，本來就有 `AND EXISTS (SELECT 1 FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} AND "status" = 'approved'::"TeacherProfileStatus")`（line 99-102）——這代表一旦本輪真的把某位老師標記為 `suspended`，他就**已經**不能再對任何 demand 提交新的 response（既有邏輯自動生效，不需要修改這個函式）。但同一個檔案的 `selectDemandResponseForOrganizer`（line 192-298）的原子 UPDATE 陳述式完全沒有對應的 teacher 狀態檢查——這代表一位老師被暫停「之前」已經提交、但還沒被選定的 `submitted` response，暫停之後 Organizer 仍然可以選定它，等於老師的暫停被繞過，新的媒合承諾（甚至新的 `ClassSession`）仍然可能在暫停之後才成立。這是 `admin-mvp-spec.md`「Admin 不應：讓 suspended teacher 回應新需求」這條既有原則目前沒有被完整落實的地方，本輪必須一併補上（見 D7 修正版）。

### 2.2 上游依賴狀態

- 無新的上游依賴。本輪不需要 `class-session-completion`（已 codex 核准但尚未實作）或其他任何進行中輪次的變更，兩者互相獨立，不會互相阻塞。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做「暫停時主動 cascade 既有的 `submitted` response（例如自動轉成某個狀態）」，也不觸碰任何已經是 `selected` 的 response 或已經建立的 `ClassSession`（見 D7 修正版）——暫停只限制老師**未來**能不能被選定/建立新承諾，不回頭改寫已經存在的既有資料或既有承諾。本輪改用「在 select 當下即時擋下」取代「暫停當下主動 cascade」，理由見 D7。
- 不通知其他受影響角色（例如某個 Organizer 已經選定這位老師、他被暫停了）——本輪只通知老師自己（見 D4），跨角色的連鎖通知是完全獨立、範圍更大的功能，不在本輪 scope。
- 不建立 `AdminNote` model（2.1 已確認這個 model 從未真正建立過，本輪延續現狀，新增的 `suspensionReason` 是 teacher-facing 說明，不是 internal admin note，跟既有 `rejectionReason` 的既有先例一致）。
- 不做「申訴」流程（`teacher-onboarding-spec.md` 既有文字明確把這個列為「future slice / admin-manual decision」，本輪不擴大範圍）。
- 不修改 `/admin/dashboard`（不存在）或任何跟 `2026-07-28-role-dashboards-plan.md` 重疊的範圍——那是完全獨立、已 codex 核准但尚未實作的另一輪工作，本輪只擴充既有的 `/admin/teachers` 頁面本身。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `prisma/schema.prisma`：`TeacherProfile` 新增 `suspensionReason String?` 欄位（D1）；`NotificationType` 新增 `teacher_profile_suspended`／`teacher_profile_restored`（D4/D8，需要 migration）。
- `src/domain/teacher-profile/state.ts`：新增 `validateTeacherProfileSuspendTransition`／`validateTeacherProfileRestoreTransition`（比照既有 `validateTeacherProfileApproveTransition`/`validateTeacherProfileRejectTransition` 的既有形狀）。
- `src/domain/teacher-profile/validation.ts`：新增 `validateTeacherProfileSuspensionReason`（比照既有 `validateTeacherProfileRejectionReason` 的既有形狀：必填、trim 後 10–1000 字）。
- `src/domain/teacher-profile/__internal__/suspend-restore-core.ts`（實作時新增，見 D5 修正版「實作補充」）：`suspendApprovedTeacherProfileForAdmin`／`restoreSuspendedTeacherProfileForAdmin`，帶原子 `RETURNING` 寫法 + staleness check + `notifyOverride`/`onBeforeNotifyCheck` 測試掛鉤。
- `src/domain/teacher-profile/service.ts`：新增 `suspendApprovedTeacherProfile(teacherProfileId, suspensionReason)`／`restoreSuspendedTeacherProfile(teacherProfileId)`（Admin-only 薄 wrapper：`requireAdmin()` 把關 + `suspensionReason` 驗證，委派給上面的 pure-core；回傳型別簡化為 `{ok:true} | {ok:false,...}`，不含 `profile` 欄位），並新增 `listApprovedAndSuspendedTeacherProfilesForAdmin()` 供 Admin UI 列出這兩種狀態的老師。
- **修正（codex round 1/2 指出的問題，已採納）：`src/domain/demand-response/__internal__/select-and-submit-core.ts` 的 `selectDemandResponseForOrganizer` 需要擴充，新增 `response_teacher_not_approved` 錯誤碼；`src/domain/demand-response/organizer-select-service.ts`（唯一的 auth-resolving 外層）需要同步新增對應的錯誤碼映射與使用者文案**（見 D7 修正版）——這是本輪唯一觸碰到 `teacher-profile` 領域之外既有檔案的地方，範圍與理由見 D7。
- `src/app/admin/teachers/page.tsx` 新增「Approved teachers」／「Suspended teachers」兩個區塊；`actions.ts` 新增 `suspendTeacherProfileAction`／`restoreTeacherProfileAction`。
- `src/app/teacher/dashboard/page.tsx` 的 `suspended` 分支新增顯示 `suspensionReason` 的區塊（比照既有 `rejected` 分支顯示 `rejectionReason` 的既有寫法）。
- Playwright smoke 測試（狀態邊界 + IDOR 不適用（Admin-only，無 own-scoped 概念）+ 原因必填驗證 + 重複暫停/恢復 + 通知正確性（含 D5 修正版的決定性競態測試）+ select 擋下 suspended 老師既有 response（D7 修正版）+ Teacher 端文案顯示 + 完整 UI E2E 流程）；重跑既有 `demand-response-selection.spec.ts`／`demand-request-cancellation.spec.ts` 確認沒有破壞既有的 select 行為。
- 文件對齊：`docs/domain/state-transition-details.md`（TeacherProfile 第一次補上「V1 落地範圍」子集段落，比照其他實體既有的既有格式）、**修正（codex round 1 指出的問題，已採納）新增 `docs/domain/state-machines.md`**（TeacherProfile 圖示第一次補上 `suspended → approved` 這條邊與 V1 子集說明）、`docs/domain/permissions-matrix.md`（新增 `Restore profile` 列，修正 `Suspend profile` 列的舊敘述）、`docs/product/notification-spec.md`（落地現況段落追加兩個新事件）、`docs/domain/data-model.md`（`NotificationType` 事件計數更新、`TeacherProfile` 新增 `suspensionReason` 欄位說明）、`docs/specs/teacher-onboarding-spec.md`（新增落地現況段落，不動歷史敘述本身）、**修正（codex round 1 指出的問題，已採納）新增 `docs/specs/admin-review-workflow-spec.md`**（User Flow 第 3 步補上 restore、UI Requirements 補上 suspension reason 必填說明，比照既有 rejection reason 那條的既有寫法）、**修正（codex round 1 指出的問題，已採納）新增 `docs/product/admin-mvp-spec.md`**（Teacher Review Actions 段落補一句落地確認：「讓 suspended teacher 回應新需求」這條既有原則本輪起才真正被 `selectDemandResponseForOrganizer` 的新檢查落實）。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- `suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile`／`listApprovedAndSuspendedTeacherProfilesForAdmin` 都必須 `requireAdmin()` 把關，比照既有 `approveSubmittedTeacherProfileApplication` 等既有先例。
- 沒有 own-scoped 概念（Admin 操作任何 teacher profile，不是「自己的」資源），因此不適用 IDOR 這類測試類別；但仍要驗證非 Admin 使用者無法呼叫這兩個函式（`admin_permission_required`）。
- `suspensionReason` 只顯示給被暫停的那位老師本人（Teacher dashboard，own-scoped 讀取），不對外公開、不對其他角色顯示。

## 5. 產品主人決策 Gate（D1–D9）

### D1 — 暫停：誰、從哪個狀態、要不要填原因？

- **推薦：Admin-only，只能從 `approved` 觸發，原因必填。** Admin-only 沒有懸念——教師資格審核從一開始就是 Admin 專屬能力，這條線沒有類似「Organizer own-scoped」的既有先例可以套用。來源狀態只能是 `approved`：`draft`/`submitted`/`rejected` 都還沒有 marketplace 資格可以暫停，暫停一個從未通過審核的老師沒有意義。
- **原因必填，新增獨立欄位 `suspensionReason`（不 reuse `rejectionReason`）**：`teacher-onboarding-spec.md` 既有文字明確要求「需保留 reason」，且比照既有 `reject` 的既有先例（`rejectionReason` 必填、trim 後 10–1000 字），暫停也應該讓老師知道具體原因，避免困惑與客訴。不 reuse `rejectionReason` 欄位的理由：那個欄位名稱本身就是「退回」語意，套用在「暫停一個已通過審核的老師」這個完全不同的情境下會造成語意混淆（跟這個系列已經修過的教訓一致——`demand-request-cancellation` D9 就是因為某個既有欄位/狀態被兩種不同原因共用，導致 UI 文案講錯話，見該輪修正 `declined` 文案的先例）。新增一個語意精確的欄位，比硬套一個名字不合的既有欄位更清楚。

### D2 — 恢復：誰、從哪個狀態？

- **推薦：Admin-only，只能從 `suspended` 觸發。** 單純把狀態轉回 `approved`，同時清空 `suspensionReason`（比照 `rejectionReason` 在 `approve`/`resubmit` 時清空的既有 lifecycle 慣例——恢復之後這筆舊的暫停原因不再有意義，Teacher dashboard 也不該再顯示它）。不需要額外驗證：D1 已經確定只有 `approved` 可以被暫停，因此能被恢復的來源狀態就只有 `suspended` 本身，不需要像 D6 那樣另外查詢佐證。

### D3 — Admin UI 放哪裡？

- **推薦**：擴充既有的 `src/app/admin/teachers/page.tsx`（目前只列 `submitted`），新增兩個區塊：「Approved teachers」列表，每張卡片旁邊有一個「Suspend…」`<details>`/`<summary>` 展開後帶必填 `suspensionReason` textarea + confirm checkbox（比照既有 `Reject…` 區塊的既有寫法，line 147-197）；「Suspended teachers」列表，每張卡片旁邊有一個單純的 confirm checkbox + 「Restore」按鈕（不需要文字輸入，比照既有 `Approve` 按鈕的既有寫法，line 133-145，不需要 `<details>` 展開，因為沒有額外欄位要填）。
- `listApprovedAndSuspendedTeacherProfilesForAdmin()` 一次查詢回傳兩種狀態、UI 層再依 `status` 分兩組渲染，不需要兩個獨立查詢。

### D4 — 要不要新增 Notification？

- **推薦：要，比照既有 `teacher_application_approved`/`teacher_application_rejected` 的既有先例（這兩個都只通知 Teacher 自己）。** 新增兩個 `NotificationType`：`teacher_profile_suspended`（收件人：`self`，內容帶 `suspensionReason`，比照 `teacher_application_rejected` 帶 `rejectionReason` 的既有寫法）、`teacher_profile_restored`（收件人：`self`，單純告知已恢復）。不需要新增 `NotificationRecipientRole`——`self` 已經存在，這兩個事件只有一種收件人（跟 2.3 已經說明的「不通知其他角色」一致）。

### D5 — 併發設計：需不需要 `__internal__` pure-core + hooks？

- **推薦：不需要 `SELECT ... FOR UPDATE` 鎖序列（沒有多方競爭同一資源的併發場景，理由不變），但寫法需要修正。**
- **實作補充（施工時發現，codex 4 輪審查沒有觸及的實作細節問題）：仍然需要一個 `__internal__` 拆分，但理由跟既有 `cancel-demand-request-core.ts` 等檔案不同——不是為了鎖序列，是因為 `suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 頂層呼叫 `requireAdmin()`（依賴真正的 HTTP session），如果 `notifyOverride`／`onBeforeNotifyCheck` 這兩個測試用參數留在頂層函式，決定性測試就沒辦法在 Node context（throwaway script 或 Playwright 測試檔案內直接呼叫）觸發，只能被迫透過瀏覽器 UI 間接測試——而瀏覽器操作無法精準控制到毫秒級的交錯時機，等於沒辦法真的證明 D5 修正版要解決的那個競態。解法：新增 `src/domain/teacher-profile/__internal__/suspend-restore-core.ts`，把原子 `UPDATE ... RETURNING`／staleness check／`notifyOverride` 呼叫都搬進 `suspendApprovedTeacherProfileForAdmin`／`restoreSuspendedTeacherProfileForAdmin` 這兩個不呼叫 `requireAdmin()` 的 pure-core 函式；`service.ts` 的 `suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 縮減成只做 `requireAdmin()` 把關 + `suspensionReason` 驗證，再委派給 pure-core，比照 `cancelOwnDemandRequest`／`cancelDemandRequestForOrganizer` 的既有 auth-wrapper + pure-core 架構。
- **修正（codex round 1 指出的問題，已採納）：不能用「`updateMany` 之後再用獨立的 `findUnique` 組裝通知內容」這個既有寫法，會有雙向操作互相競態的風險。** 跟既有 `approveSubmittedTeacherProfileApplication`/`rejectSubmittedTeacherProfileApplication`（單向：只能從 `submitted` 出發，兩者互斥、不可能互相把對方的結果讀壞）不同，暫停/恢復是**雙向**操作：暫停成功之後，資源立刻進入一個「恢復」可以合法作用的狀態。如果照抄既有寫法（`updateMany` 成功 → 之後才用 `prisma.teacherProfile.findUnique` 讀資料組通知），會有這個交錯：Admin A 呼叫暫停，`updateMany` 成功寫入 `suspended`；在 A 的 `findUnique` 執行**之前**，Admin B 呼叫恢復，完整跑完（`updateMany` 把狀態改回 `approved`、清空 `suspensionReason`、送出「已恢復」通知）；A 的 `findUnique` 這時才執行，讀到的是**已經被 B 改過**的資料（`status: "approved"`、`suspensionReason: null`），A 的「暫停」通知因此會送出錯誤或缺失的內容（原因消失、或跟老師實際當下狀態矛盾）。
  - **修正方式**：`suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 都改用 `prisma.$queryRaw` 執行帶 `RETURNING` 子句的原子 `UPDATE`，直接從**這次成功的寫入本身**取回通知所需的欄位（暫停：`RETURNING "userId", "suspensionReason"`；恢復：`RETURNING "userId"`），不再另外呼叫 `findUnique` 組裝通知內容。這樣通知內容永遠來自「這次呼叫自己真正寫入的值」，不管其他 Admin 之後做了什麼都不會被污染——不是靠鎖或延遲，是直接讓資料來源跟寫入動作變成同一個原子陳述式（比照 `cancel-demand-request-core.ts` 用 `RETURNING` 從自己的 UPDATE 取回受影響資料的既有先例）。`count === 0`（失敗）時的錯誤分類查詢不受影響，可以繼續用獨立的 `findUnique`——那只影響錯誤訊息的精確度，不影響任何已經成功寫入的資料或通知內容。
  - **修正（codex round 3 指出的問題，已採納）：`$queryRaw` 不會像 Prisma Client 的 `.update()`/`.updateMany()` 那樣自動維護 `@updatedAt` 欄位，兩個 SQL 都必須明確 `SET "updatedAt" = NOW()`。** `TeacherProfile.updatedAt` 是 schema 裡的 `@updatedAt`，這個自動維護行為只在透過 Prisma Client 的 update 方法寫入時才會觸發，改用原生 `$queryRaw` 執行 UPDATE 時完全不會自動更新——如果沒有明確處理，暫停/恢復後 `updatedAt` 會停留在舊值，而 Teacher dashboard（`src/app/teacher/dashboard/page.tsx`）明確把這個欄位顯示成「Last updated」，會顯示錯誤的時間。兩個 SQL 陳述式都要明確加上 `"updatedAt" = NOW()`（比照 `cancel-demand-request-core.ts` 既有 raw SQL 用 `${now}` 明確設定 `updatedAt` 的既有寫法），並在測試裡斷言暫停與恢復都會正確推進這個時間戳。
  - **回傳型別同步簡化**：核對 `src/app/admin/teachers/actions.ts` 既有的 `approveTeacherProfileApplicationAction`/`rejectTeacherProfileApplicationAction`，兩者都只用 `result.ok`／`result.message`，從未讀取 `result.profile`——本輪的 `suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 因此不需要比照 `TeacherProfileApproveResult` 那種帶 `profile` 欄位的形狀，回傳單純的 `{ok:true} | {ok:false; code; message}` 即可，順便避免「回傳的 profile 物件可能被同時發生的另一個操作弄過期」這個額外疑慮。
  - **修正（codex round 2 指出的問題，已採納）：`RETURNING` 只解決通知「內容」被污染，沒有解決通知「順序」可能顛倒，需要額外加一道 staleness check。** 即使暫停呼叫的通知內容永遠正確（來自 `RETURNING`），如果暫停呼叫的 `notifyOverride` 因為某種排程延遲，在恢復呼叫的通知**已經**送出**之後**才真正送出，`Notification` 表裡兩筆記錄的 `createdAt` 順序會是「先出現『已恢復』、後出現『已暫停』」——這個順序本身就會誤導老師（他會先看到「你已經恢復」，過一會又看到「你被暫停」，即使他當下真正的狀態其實是 approved）。修正方式：`suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 在呼叫 `notifyOverride` **之前**，先重新讀一次目前的 `TeacherProfile.status`（單純 `findUnique`，不是原子檢查，是 best-effort 的過期判斷）；暫停呼叫發現目前狀態已經不是 `suspended`（代表中間已經有一次恢復發生過），就跳過發送「已暫停」通知（只記錄一行 console log，不視為錯誤，`suspendApprovedTeacherProfile` 本身仍然回傳 `{ok:true}`，因為主要的狀態轉換寫入本來就已經成功）；恢復呼叫對稱地在發送「已恢復」通知前確認目前狀態仍是 `approved`。這是 best-effort 抑制，不是強一致性保證（check 跟 notify 之間仍有極小窗口），但明確比照 `class-session-cancellation` D7、`demand-request-cancellation` D11 item 1 已經接受的既有先例——「只斷言 DB 最終狀態正確，Notification 相對寫入順序只做 best-effort 處理，不做強一致性保證」，這裡是把 best-effort 的力度從「完全不管」提升到「至少過濾掉最容易誤導人的明顯過期通知」，符合這個專案一貫對 notification 風險的處理尺度，不是過度工程。
  - **決定性測試（改寫，原本的版本codex round 2 指出只證明內容沒被污染、卻反而固定重現了順序顛倒的問題）**：比照 `cancel-demand-request-core.ts` 已驗證過的 `notifyOverride` 注入手法，`suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile` 都接受一個可注入的 `notifyOverride` 測試參數，並在「重新讀取目前狀態」這一步之前新增一個 `onBeforeNotifyCheck` hook（生產路徑上恆為 no-op，只供測試使用）。測試流程：呼叫暫停，在它的 `onBeforeNotifyCheck` hook 裡卡住（此時暫停的主要狀態轉換已經透過 `RETURNING` 成功寫入 DB）；卡住期間呼叫恢復，讓它完整跑完（狀態轉回 `approved`、清空 `suspensionReason`、正確送出「已恢復」通知）；才釋放暫停的 hook，讓它繼續執行 staleness check——斷言：(a) 暫停呼叫最終仍回傳 `{ok:true}`；(b) 暫停呼叫的 `notifyOverride` **完全沒有被呼叫**（因為 staleness check 應該偵測到狀態已經不是 `suspended` 而跳過）；(c) 查詢 `Notification` 表，只有一筆「已恢復」記錄，沒有任何「已暫停」記錄——證明 stale 通知被正確抑制，不是只證明內容沒被污染。

### D6 — 對既有下游程式碼有沒有影響？

- **推薦：`teacher-profile` 領域內部沒有，但 D7 修正版需要觸碰 `demand-response` 領域一個既有檔案。** 2.1 已經逐一核對：`requireApprovedTeacher()`、`withdrawOwnDemandResponse` 的顯式檢查、Teacher dashboard 的 `statusCopy.suspended` 都已經正確處理 `suspended` 狀態，只是這個狀態從未被真正寫入過，這幾處不需要修改。但 `selectDemandResponseForOrganizer` 需要修改，見 D7 修正版——這是本輪唯一的例外。

### D7 — 暫停時要不要連帶處理既有的 `DemandResponse`／`ClassSession`？

- **修正（codex round 1 指出的問題，已採納，取代原本「完全不做」的推薦）：已經 `selected` 的 response 與已經建立的 `ClassSession` 仍然不動；但還沒被選定的既有 `submitted` response，必須在「被選定的當下」擋下，不能讓暫停之後才成立的新媒合承諾繼續生效。**
  - **已經 `selected`／已經有 `ClassSession` 的部分維持原推薦不變**：暫停的語意是「限制這位老師**未來**的能力」，不是「回溯性地讓過去已經成立的承諾失效」。一位已經被 Organizer 選定、甚至已經排定 `ClassSession` 的老師，如果因為不相關的品質/營運原因被暫停，不應該讓那堂已經排定的課或已經媒合的 response 被靜默改變狀態——通知 Organizer、要不要連帶取消 `ClassSession`，是完全獨立、影響範圍大得多的另一個決策，不屬於本輪範圍。
  - **codex round 1 指出的真正缺口**：`selectDemandResponseForOrganizer`（`src/domain/demand-response/__internal__/select-and-submit-core.ts` line 192-298）完全沒有檢查 teacherProfile 狀態，只檢查 response 自己的狀態是不是 `submitted`、demand 有沒有其他已選定的 response。這代表一位老師暫停「之前」提交、但暫停時還沒被選定的 `submitted` response，暫停「之後」Organizer 依然可以選定它——這不是「過去已經成立的承諾」，是暫停之後才真正成立的**新**承諾，會直接違反 `docs/product/admin-mvp-spec.md` 既有寫明的「Admin 不應：讓 suspended teacher 回應新需求」這條原則（select 的效果等同讓老師「進一步取得新的媒合」，即使 submit 動作本身發生在暫停之前）。
  - **修正方式**：比照同一個檔案裡 `submitDemandResponseForTeacher` 既有的對稱寫法（line 99-102 的 `AND EXISTS (SELECT 1 FROM "TeacherProfile" WHERE "id" = ... AND "status" = 'approved'::"TeacherProfileStatus")`），在 `selectDemandResponseForOrganizer` 的原子 `UPDATE ... WHERE ...` 陳述式追加同樣的 `EXISTS` 檢查（透過 `demandResponseId` join 回 `TeacherProfile`）。`selectedRows.length === 0` 時既有的分類查詢邏輯**維持原有順序**（先查是否已有其他 selected response → `response_demand_already_matched`；再查目標 response 自己的狀態是不是還是 `submitted` → 若不是，`response_not_submitted`，這條分支正是 `demand-request-cancellation` D11 item 2 已經驗證過、且必須繼續正確運作的既有情境）；只有在前兩個分類都排除之後（demand 沒有其他 selected、目標 response 自己的狀態確實還是 `submitted`），才代表唯一可能的原因是 teacher 狀態不通過，回傳新增的 `response_teacher_not_approved` 錯誤碼——不會誤判、也不會影響任何既有測試已經驗證過的兩個既有分支。
  - **修正（codex round 2 指出的問題，已採納）：`__internal__` 的新錯誤碼必須同步接到公開的 wrapper，否則使用者看到的只會是通用失敗訊息。** `src/domain/demand-response/organizer-select-service.ts` 的 `selectDemandResponse()` 是 `selectDemandResponseForOrganizer` 唯一的 auth-resolving 外層，它的 `SelectDemandResponseErrorCode` union 與內部的 if/else 錯誤碼映射（line 6-96）目前逐一列舉了 `demand_response_not_found`／`response_not_submitted`／`response_demand_already_matched`，任何沒被列舉到的 core 錯誤碼都會落到最後的通用 `demand_response_select_failed` 分支——這代表如果只改 `__internal__`，Organizer 在真正的 UI 上永遠只會看到「選定暫時無法完成，請稍後再試。」這種誤導性的通用訊息，看不到「這位老師目前無法被選定」的真正原因。本輪必須同步在這個 wrapper 新增 `response_teacher_not_approved` 的映射分支（訊息比照既有分支的既有語氣，例如「這位老師目前無法被選定，可能帳號已被暫停，請重新整理後確認。」），並補上對應的 wrapper-layer 測試（不能只測 `__internal__`）。
  - **接受的已知限制（V1 不解決，記錄下來避免被誤判成疏漏）**：一位老師被暫停後，他既有的 `submitted` response 不會被主動轉成任何其他狀態或標記——Organizer 在自己的 demand 詳情頁仍然會看到這筆回應顯示「已送出」，直到真的嘗試選定它才會收到 `response_teacher_not_approved` 錯誤。本輪不做「主動讓 UI 提前顯示這筆回應已經不可選」這件事，因為那需要在 Organizer 詳情頁的 response 列表查詢裡額外 join teacher 狀態、並設計對應文案，屬於範圍更大的 UI 一致性工作，不影響資料正確性（唯一被擋下的是「錯誤地讓新承諾成立」這個真正的風險），留給有需要時的後續切片。

### D8 — Migration 風險確認

- **推薦：兩個新增都是低風險加法變更。** `TeacherProfile.suspensionReason`：`ALTER TABLE "TeacherProfile" ADD COLUMN "suspensionReason" TEXT`，nullable，不影響既有資料。`NotificationType` 新增兩個值：兩次 `ALTER TYPE ... ADD VALUE`，不影響任何既有資料或既有 enum 值（跟 `demand-request-cancellation` D8 已經走過的同一類 migration 一致）。

### D9 — 文件需要修正哪些跟現況矛盾的舊敘述？

- **推薦：五處都要修正（codex round 1/2 兩輪陸續指出原本漏了項目），這是本輪風險最集中的非程式碼工作，因為文件目前的敘述會誤導後續規劃者以為 `suspend` 早就是 V1 功能，或彼此互相矛盾。**
  1. `docs/domain/state-transition-details.md` 的 TeacherProfile 小節，是這個文件裡**唯一**沒有「上方 Transitions 表格是完整最終設計，目前只落地以下子集」這個既有格式的實體小節（DemandRequest/DemandResponse/ClassSession/Enrollment 都有）——本輪要第一次補上這個格式，明確劃出 V1 落地的子集（`draft → submitted → approved|rejected`、`rejected → submitted`，本輪新增 `approved ↔ suspended`），並修正既有的 Admin action matrix（目前寫死「`approved` | `suspend`」、「`suspended` | `restore to approved` 可在 policy 上允許；正式 UI / API 是否實作由 product owner 另行批准」，這兩句話都是本輪之前就不準確的敘述）。**修正（codex round 2 指出的問題，已採納）**：同一份文件底部的「Notification Side Effects」段落目前寫「13 個事件」，本輪新增兩個 `NotificationType`（D4/D8）後要同步改成 15 個，並在條列的事件清單追加 `teacher_profile_suspended`／`teacher_profile_restored`（比照該段落既有的條列格式與既有的「V1 已確認」附註寫法）。
  2. `docs/domain/state-machines.md` 的 TeacherProfile 小節——目前的 ASCII 圖示（`draft → submitted → approved → rejected → suspended`）完全沒有畫出 `suspended → approved` 這條邊，也沒有其他實體小節都有的「V1 落地範圍」子集說明。本輪第一次補上這條邊與對應說明，比照同一份文件裡 DemandRequest/DemandResponse/ClassSession/Enrollment 小節既有的既有格式。
  3. `docs/domain/permissions-matrix.md` 的 TeacherProfile 表格新增 `Restore profile` 列（目前完全沒有這一列），並在下方新增一段「V1 落地範圍」說明修正 `Suspend profile` 那一列的既有敘述（目前這個表格的 TeacherProfile 小節完全沒有這種說明段落，本輪一併補上，比照其他實體小節的既有格式）。
  4. `docs/specs/teacher-onboarding-spec.md` 新增一段「落地現況」（這份文件目前完全沒有這種段落），說明 `suspend`／`restore` 直到本輪才真正落地，不動既有歷史敘述本身（例如 line 111 那句「`restore to approved` 是 allowed policy，但正式 restore UI / API 是否納入 V1 需 product owner 另行批准」——這句話描述的是這份 spec 原始撰寫當下的決策狀態，仍然正確，只是需要在新段落裡說明後續輪次已經核准並落地）。
  5. **修正（codex round 1 指出遺漏這兩份文件、codex round 2 進一步指出第一份原本規劃的修正範圍太窄，已採納）**：
     - `docs/specs/admin-review-workflow-spec.md`——這份文件跟現況矛盾的地方不只 User Flow/UI Requirements 兩處，逐段核對後要修正四處：(a) User Flow 第 3 步從「approve / reject / suspend」擴充成「approve / reject / suspend / restore」；(b) UI Requirements 補上一條 suspension reason 必填說明，比照既有 teacher rejection reason 那條（line 37）的既有寫法；(c) **State Transitions 段落**（line 66）目前寫「`TeacherProfile`: `submitted → approved/rejected`、`approved → suspended`」，完全沒提到 `suspended → approved`，也沒提到本輪新增的 `Notification` 記錄（跟該段落既有句子「V1 以站內顯示告知老師，email 為後續切片」的既有語氣一致，本輪的站內通知延續這個既有原則，不寄 email）——本輪把這條擴充成完整的雙向轉換並補上這個事實；(d) **Acceptance Criteria 段落**（line 83）目前只寫「Admin 可以 approve、reject、suspend teacher」，沒提到 suspend 也需要必填原因、也沒提到 restore——本輪擴充成「Admin 可以 approve、reject、suspend、restore teacher；suspend 需填寫必填 suspension reason（trim 後 10–1000 字），reason 保存於 `TeacherProfile.suspensionReason` 並顯示給該老師」。這四處都是直接的事實性更新，不是「落地現況」這種事後追加的段落（這份文件本來就是在描述現在 Admin 應該做什麼，本輪之後這麼寫才是準確的）。
     - `docs/product/admin-mvp-spec.md`：「Teacher Review Actions」段落已經正確寫著「suspend teacher，並填寫 reason」（第 50 行）與「Admin 不應：讓 suspended teacher 回應新需求」（第 56 行）——這兩句話原本就精準地描述了本輪要落地的目標，只是從未真正被程式碼滿足過。本輪在這段落尾端補一句簡短的落地確認：這兩條原則從本輪起才真正由 `suspendApprovedTeacherProfile` 與 `selectDemandResponseForOrganizer` 的新檢查（見 D7 修正版）落實，並補一句 restore 對應的動作說明（這份文件目前完全沒有提到 restore）。

## 6. 品牌與 UX 規則

- 暫停與恢復的文案清楚、溫和，不使用威脅或指責性字眼；暫停原因對老師本人可見，但不對外公開。
- 比照既有 `reject` 的既有先例，UI 需明示「此說明會顯示給老師」。

## 7. RWD Requirements

- Admin `/admin/teachers` 頁面新增的兩個區塊在 360px 手機寬度可用，比照既有 `Approve`/`Reject…` 區塊版型。

## 8. 實作切片（Slice 1–3；施工前提：D1–D9 已拍板）

### Slice 1 — Schema + 暫停/恢復 domain service

- `prisma/schema.prisma`：`TeacherProfile.suspensionReason`（D1）、`NotificationType` 新增兩個值（D4/D8）；跑 `npx prisma migrate dev`，核對 migration SQL 只是 `ADD COLUMN`／`ADD VALUE`，不影響既有資料。
- `src/domain/teacher-profile/state.ts`：`validateTeacherProfileSuspendTransition`／`validateTeacherProfileRestoreTransition`（D1/D2）。
- `src/domain/teacher-profile/validation.ts`：`validateTeacherProfileSuspensionReason`（D1）。
- `src/domain/teacher-profile/service.ts`：`suspendApprovedTeacherProfile`／`restoreSuspendedTeacherProfile`／`listApprovedAndSuspendedTeacherProfilesForAdmin`（D1/D2/D3/D4/D5 修正版：兩個 mutation 都用帶 `RETURNING` 的 `$queryRaw` 原子更新，回傳 `{ok:true} | {ok:false;code;message}`，接受可選的 `notifyOverride` 測試參數）。
- `src/domain/notification/copy.ts`：新增 `teacher_profile_suspended`／`teacher_profile_restored` 的 `self` 文案（D4）。
- **修正（codex round 1/2 指出的問題，已採納）：`src/domain/demand-response/__internal__/select-and-submit-core.ts` 的 `selectDemandResponseForOrganizer` 新增 teacher 狀態檢查與 `response_teacher_not_approved` 錯誤碼；`src/domain/demand-response/organizer-select-service.ts` 的 `selectDemandResponse()` 同步新增這個錯誤碼的映射與文案（D7 修正版）**——這兩個檔案屬於 `demand-response` 領域，不是 `teacher-profile` 領域，但這個修正是本輪範圍內唯一能讓「暫停真正擋下新承諾」成立的必要變更（且必須連公開 wrapper 一起改，否則使用者看不到真正的錯誤原因），一併放進 Slice 1（domain 層），不延到 Slice 2/3。
- **驗證**：throwaway `tsx` script 直接呼叫，涵蓋：`approved → suspended`（含原因必填/長度邊界）、`suspended → approved`（含 `suspensionReason` 確實清空）、四種錯誤來源狀態邊界（`draft`/`submitted`/`rejected` 不可暫停；`draft`/`submitted`/`rejected`/`approved` 不可恢復）、重複暫停/恢復、通知正確性（含 D5 修正版描述的決定性 staleness 測試：暫停呼叫在 `onBeforeNotifyCheck` hook 卡住期間，恢復呼叫完整跑完，斷言暫停呼叫的 `notifyOverride` 完全沒被呼叫、只留下一筆「已恢復」通知）、非 Admin 呼叫被擋下、`selectDemandResponseForOrganizer`／`selectDemandResponse`（wrapper）對一筆暫停老師既有的 `submitted` response 正確回傳 `response_teacher_not_approved`（且不影響既有的 `response_not_submitted`／`response_demand_already_matched` 兩個分類分支，需要對照既有測試情境重新跑一次確認沒有改變既有行為）、暫停與恢復都正確推進 `TeacherProfile.updatedAt`（D5 修正版）。

### Slice 2 — Admin UI + Teacher dashboard 顯示

- `src/app/admin/teachers/page.tsx`：「Approved teachers」／「Suspended teachers」兩個區塊（D3）。
- `src/app/admin/teachers/actions.ts`：`suspendTeacherProfileAction`／`restoreTeacherProfileAction`。
- `src/app/teacher/dashboard/page.tsx`：`suspended` 分支新增顯示 `suspensionReason` 的區塊（D1，比照既有 `rejected` 分支寫法）。
- **驗證**：瀏覽器實際操作——Admin 對一位 approved 老師執行暫停（填寫原因），確認該老師從「Approved」區塊移到「Suspended」區塊；老師登入 Teacher dashboard 看到暫停狀態與原因；Admin 執行恢復，確認老師移回「Approved」區塊，Teacher dashboard 不再顯示舊的暫停原因。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/teacher-profile-suspension.spec.ts`：涵蓋 Slice 1 驗證清單的所有邊界（用真正的 Playwright smoke 測試取代 throwaway script 的等價案例，含 D5 修正版的決定性競態測試與 D7 修正版的 select 邊界測試）、通知正確性、Teacher 端文案顯示（含 `suspensionReason` 顯示與恢復後清空）、完整 UI E2E 流程。不需要決定性鎖測試（`__internal__`+hooks 那一套）——D5 修正版的競態測試靠 `notifyOverride` 注入達成決定性，不需要 `onBeforeLock`/`onLockAcquired`。
- 重跑既有 `tests/smoke/demand-response-selection.spec.ts`／`tests/smoke/demand-request-cancellation.spec.ts`，確認 `selectDemandResponseForOrganizer` 新增的 teacher 狀態檢查沒有破壞既有的 select 行為（尤其是 `demand-request-cancellation` D11 item 2 驗證過的 `response_not_submitted` 分類分支）。
- **實作時發現（既有測試因為 UI 新增區塊而過期，非新程式碼的 bug）**：`tests/smoke/admin-teachers.spec.ts` 原本有兩處斷言「非 submitted 狀態的老師整頁都看不到」（含 `suspended` 狀態的既有 control fixture、以及 approve 成功後預期 `Submitted Teacher` 整頁消失）——這兩個假設在本輪新增「Approved teachers」／「Suspended teachers」區塊之後不再成立（這些老師現在會正確出現在新區塊，只是不在待審核佇列裡）。修正為改用 `getByRole("article").filter({ has: heading, hasText: "Approve" })` 搭配 `toHaveCount(0)`，驗證「不在待審核佇列裡」這個仍然成立的原始意圖，而不是「整頁看不到」這個已經過期的斷言。
- 更新 `docs/domain/state-transition-details.md`（D9 第 1 點）、`docs/domain/state-machines.md`（D9 第 2 點）、`docs/domain/permissions-matrix.md`（D9 第 3 點）、`docs/product/notification-spec.md`（落地現況段落追加兩個新事件）、`docs/domain/data-model.md`（`NotificationType` 事件計數更新、`TeacherProfile` 新增欄位說明）、`docs/specs/teacher-onboarding-spec.md`（D9 第 4 點）、`docs/specs/admin-review-workflow-spec.md`（D9 第 5 點）、`docs/product/admin-mvp-spec.md`（D9 第 5 點）。
- **實作時追加（原本 D9 沒有列出，逐一核對 select 相關文件時發現同一類缺口）**：`docs/specs/demand-response-and-matching-spec.md` 既有的「落地現況」段落描述 select 的既有落地行為，完全沒提到本輪新增的 teacher 資格檢查——追加一條說明，不動既有段落其餘內容。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 → 2 必須先完成（schema/domain service 先於 UI）。Slice 3 排最後。

## 9. Verification Planning

- Domain 層（Slice 1）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 跨領域影響（Slice 1/3）：重跑既有 `demand-response-selection.spec.ts`／`demand-request-cancellation.spec.ts` 確認 `selectDemandResponseForOrganizer` 的新增檢查沒有破壞既有的 select 行為（D7 修正版）。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- Slice 1 的 migration 只新增一個 nullable 欄位與兩個 enum 值，本機開發資料庫可用 `prisma migrate reset` 復原，不影響任何已部署環境（本專案目前沒有已部署環境）。
- 跟 `class-session-completion` 那一輪不同，本輪**沒有**「一旦有資料寫入就不能整批 revert」的問題——沒有任何既有的讀取路徑需要因為 `suspended` 狀態真的被使用過而擴大查詢條件（D6 已確認所有下游 guard 早就正確處理 `suspended`，不是本輪新增的讀取邏輯），因此本輪的變更可以安全整批 `git revert`，不需要拆成「可回滾」跟「不可回滾」兩類。

## 11. Planning-only self review

- 已核對：整個 `src/` 沒有任何一處把 `TeacherProfileStatus` 寫成 `suspended`（`grep` 確認零筆結果），這代表本輪範圍必須同時涵蓋 suspend 與 restore，不能只做 restore。
- 已核對：`requireApprovedTeacher()`、`withdrawOwnDemandResponse`、Teacher dashboard 的 `statusCopy.suspended`、`submitDemandResponseForTeacher` 四處既有程式碼都已經正確處理 `suspended` 狀態，本輪不需要修改這四處；但 `selectDemandResponseForOrganizer` 沒有對應檢查（codex round 1 指出，已修正為 D7 的核心內容，逐行核對過該檔案的既有 `WHERE`/分類查詢邏輯，確認新檢查不會影響既有的兩個錯誤分類分支）。
- 已核對：`docs/domain/state-transition-details.md`／`docs/domain/state-machines.md`／`docs/domain/permissions-matrix.md`／`docs/specs/teacher-onboarding-spec.md`／`docs/specs/admin-review-workflow-spec.md`／`docs/product/admin-mvp-spec.md` 六份文件目前都把 `suspend` 描述成已落地或已規劃的 V1 能力，但實際程式碼從未落地，這是文件債務，D9 已列出具體修正方式（codex round 1 指出原本只找到其中三份，追加了 `state-machines.md`／`admin-review-workflow-spec.md`／`admin-mvp-spec.md` 三份）。
- 已核對：`src/app/admin/teachers/actions.ts` 既有的 `approveTeacherProfileApplicationAction`/`rejectTeacherProfileApplicationAction` 都只用 `result.ok`／`result.message`，從未讀取 `result.profile`，確認本輪的 suspend/restore 回傳型別可以簡化成不含 `profile` 欄位（D5 修正版）。
- 待 codex 檢查：D1 新增獨立 `suspensionReason` 欄位（不 reuse `rejectionReason`）是否是正確的取捨；D7 修正版「已選定/已建立 ClassSession 的部分仍然不連帶處理，只在 select 當下擋新承諾」這個切分點是否還有遺漏的資料一致性風險；D4 只通知 Teacher 自己、不通知任何其他角色，是否有遺漏的使用者體驗風險；D5 修正版的 `RETURNING` 寫法是否有遺漏的邊界情況。

<!-- codex-peer-reviewed: 2026-07-28T22:21:56Z rounds=4 verdict=approved -->
