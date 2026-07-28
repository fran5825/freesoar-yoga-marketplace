# DemandRequest Cancellation — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D11）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

Organizer 一旦送出需求，就完全沒有辦法收回——不管是內容打錯、預算變動、還是已經透過其他管道解決，都無計可施。`DemandRequestStatus` enum 裡的 `cancelled` 從一開始就保留但從未接線，`docs/domain/permissions-matrix.md` 明確把 `Cancel demand` 列為「完整狀態機的最終能力，本輪不實作」。這跟上一輪 `class-session-cancellation` 補上的正是同一類缺口，本輪把它接上，讓 demand → response → matching → class → enrollment 整條鏈上每個環節都有對稱的建立/取消能力。

### 1.2 風險等級

中高，理由跟 `class-session-cancellation` 相同但範圍更廣：

1. `published` 或 `matched` 狀態的 demand 可能已經有 Teacher 提交或被選中的 `DemandResponse`，取消需要連帶處理這些回應（見 D4）。
2. `DemandRequest` 這張表的同一行，目前已經有三個既有 mutation 會搶鎖（`submitDemandResponseForTeacher`、`selectDemandResponseForOrganizer`、`createClassSessionForOrganizer`，全部用 `SELECT ... FOR UPDATE`）——本輪的取消必須正確加入這個既有的鎖序列，否則會重演 `class-session-cancellation` D3 那種「取消跟建立/報名沒有正確序列化，資料出現矛盾」的問題（見 D5）。
3. 本輪需要新增一個**全新**的 `NotificationType` enum 值（`demand_request_cancelled`）——這是 `notification` 一輪原始 event 表完全沒有規劃過的事件，需要真的跑一次 migration，跟先前兩輪都只是「接上早就保留好的值」不同（見 D8）。

### 1.3 命名澄清

- **「連帶取消」**：跟 `class-session-cancellation` 的用法一致——取消 DemandRequest 時，跟這個 demand 綁在一起、還「算數」的 `DemandResponse`（`submitted` 或 `selected` 狀態）會在同一個 transaction 內一併轉成 `declined`（D4）。
- **`affected_responder`**：本輪新增的第五種 `NotificationRecipientRole`（前四種是 `self`/`admin`/`counterpart`/`affected_member`，`affected_member` 由 `class-session-cancellation` 新增）。代表「因為連帶取消而受影響的 Teacher（回應被連帶轉為 declined）」。不沿用 `affected_member`，理由見 D9。

## 2. 現況核對（Repo Reality Audit；2026-07-28 working tree = committed `main` @ `6d8774c`）

### 2.1 已 committed 的基礎（可直接依賴）

- `DemandRequestStatus` enum：`draft → submitted → published → matched → converted_to_class`，終止狀態 `rejected`（僅能從 `submitted` 觸發，`src/domain/demand-request/state.ts` 的 `validateDemandRequestRejectTransition` 已確認）；`under_review`/`teacher_responded`/`completed`/`cancelled`/`expired` 保留未接線。
- **Response 只能在 `published` 狀態被提交**：`src/domain/demand-response/__internal__/select-and-submit-core.ts` 的 `submitDemandResponseForTeacher`（line 70–122）裡 `eligibleStatusesForSubmit = ["published"]`（line 20）。這代表 `draft`／`submitted` 狀態的 demand **不可能**有任何 `DemandResponse`——取消這兩個狀態完全不需要處理連帶取消。
- **`published → matched` 由 select 觸發**：`selectDemandResponseForOrganizer`（同檔案 line 160–240）在自己的 `prisma.$transaction` 內，先用 raw SQL `SELECT ... FOR UPDATE` 鎖住 `DemandRequest` 那一行（同時驗證 `organizerProfileId` 擁有權，line 171–177），把被選中的 response 轉 `selected`，其餘 `submitted` 轉 `declined`（line 211–218），最後呼叫 `markDemandRequestAsMatchedIfPublished`（`src/domain/demand-request/matching-service.ts` line 13–26，同一個 tx 內把 demand 轉 `matched`）。
- **`matched → converted_to_class` 由建立課程觸發**：`createClassSessionForOrganizer`（`src/domain/class-session/__internal__/create-class-session-core.ts` line 74–171）也在自己的 `$transaction` 內，先用 raw SQL `SELECT ... FOR UPDATE` 鎖住同一張 `DemandRequest` 表的同一行（line 84–91），查出 `selected` 的 `DemandResponse`，建立 `ClassSession`，最後呼叫 `markDemandRequestAsConvertedToClassIfMatched`（同一個 matching-service.ts，line 33–46）。
- **三個既有 mutation 都鎖同一張表的同一行**：`submitDemandResponseForTeacher`（提交時鎖 demand 防止 eligibility 在檢查與寫入之間變化）、`selectDemandResponseForOrganizer`、`createClassSessionForOrganizer`。本輪的取消必須用同一套 `SELECT ... FOR UPDATE` 手法加入這個鎖序列，理由見 D5。
- **Admin 的 publish/reject 是單一 `updateMany`，沒有顯式鎖**：`src/domain/demand-request/admin-service.ts` 的 `publishSubmittedDemandRequest`／`rejectSubmittedDemandRequest` 都是 `prisma.demandRequest.updateMany({where:{id,status:"submitted"},...})`，單一陳述式。這不需要修改——Postgres 對單一 UPDATE 陳述式本來就有列鎖，會跟本輪新增的 `SELECT ... FOR UPDATE` 正確互相排隊，不會有兩者都成功套用矛盾轉換的問題（跟 `openOwnClassSessionForEnrollment` 當初不需要 pure-core 是同一個理由）。
- **`DemandResponse` 的既有 `declined` 語意**：目前唯一產生 `declined` 的地方是 select 時「其餘 submitted 轉 declined」（見上）。Teacher 端顯示這個狀態的既有文案（`src/app/teacher/demands/[demandRequestId]/page.tsx` line 30–33）寫死「團主這次選擇了其他老師，感謝你的回應。」——**這句話在本輪的連帶取消情境下是錯的**（demand 根本被取消了，不是「選了別人」），見 D9 的 UI 修正。
- **Teacher 端讀取自己回應不受 demand 狀態限制**：同一個檔案第 70–78 行有明確註解「D12：查看 own response 不受 approved-teacher eligibility gate 限制」，`getOwnDemandResponseForDemand`（`src/domain/demand-response/service.ts` line 224–244）完全不檢查 `DemandRequest.status`，只要 Teacher 對這個 demand 有任何回應，這個頁面就會顯示，不會因為 demand 被取消而 404（跟 `getPublishedDemandRequestDetailForTeacher` 只認 `published` 狀態、demand 一旦離開 `published` 就 404 是兩條獨立路徑——已逐行確認，稽核依據見上）。這代表本輪的 UI 文案修正是**必要**的，不是可以靠「反正頁面會 404」迴避的邊界情況。
- **Organizer 端 status label 已備好**：`src/app/organizer/demands/_components/status-labels.ts` 的 `demandRequestStatusLabels`／`demandRequestStatusToneClasses` 已經有 `cancelled: "已取消"`（跟 `class-session-cancellation` 遇到的情況一樣，label 早就備好，只是從未有實際資料觸發）。
- **`docs/superpowers/plans/2026-07-27-notification-plan.md`／`2026-07-28-class-session-cancellation-plan.md` 已確認並驗證過的既有設計**：resolver query 與 `notifyUsers` 呼叫一律在主要 tx commit **之後**才用 `prisma`（不是 `tx`）執行，外層包 try/catch（notification D4）；`__internal__` pure-core 額外接受一個可注入的 `notifyOverride` 測試專用參數（enrollment/class-session 兩輪已用同一設計）；`NotificationRecipientRole` 目前是 `"self" | "admin" | "counterpart" | "affected_member"`（`class-session-cancellation` D7 新增第四種），`copy.ts` 的 `COPY_TABLE` 是 `Partial<Record<NotificationType, Partial<Record<NotificationRecipientRole, CopyBuilder>>>>`。

### 2.2 上游依賴狀態

- `ClassSession.demandRequestId` 是 `@unique` 外鍵，`onDelete: Restrict`（非 cascade）。一旦 demand 轉為 `converted_to_class`，代表已經有一個 `ClassSession` 指向它；如果本輪允許在這個狀態下取消 demand，會產生「`ClassSession` 存在，但它所屬的 `DemandRequest` 卻是 `cancelled`」這種語意矛盾的資料。本輪明確**不**允許從 `converted_to_class` 取消（D1）——這個狀態下要取消，Organizer 應該改用已出貨的 `class-session-cancellation` 去取消對應的 `ClassSession`。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不允許從 `matched` 之後（`converted_to_class`）取消（見 2.2、D1）。
- 不做取消原因欄位（比照 `class-session-cancellation` D6 的既有先例，理由相同：沒有下游需要顯示原因）。
- 不讓 ClassSession 或 Enrollment 因為 DemandRequest 被取消而連帶變化——本輪只處理 DemandRequest 自己與其 `DemandResponse`，不觸及已經是 `class-session-cancellation` 範圍的東西（結構上也不可能：能取消 demand 的狀態集合裡沒有 `converted_to_class`，所以永遠不會有 ClassSession 存在）。
- 不做 Admin 代為取消（延續 `class-session-creation`/`enrollment`/`class-session-cancellation` 系列先例：Admin 不介入 Organizer own-scoped 的動作）。
- 不新增 `DemandResponseStatus` 的新值——連帶取消統一 reuse 既有的 `declined`（D4），不新增例如 `demand_cancelled` 這種更精確但沒必要的新狀態值。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `prisma/schema.prisma`：`NotificationType` 新增 `demand_request_cancelled`（D8，需要 migration）。
- `src/domain/demand-request/__internal__/cancel-demand-request-core.ts`：新的 pure-core，鎖 + 狀態轉換 + DemandResponse 連帶取消（D4/D5）。
- `src/domain/demand-request/service.ts` 新增 `cancelOwnDemandRequest`（auth wrapper）。
- `src/domain/notification/types.ts` 的 `NotificationRecipientRole` 新增 `"affected_responder"`（D9）。
- `src/domain/notification/copy.ts` 新增 `demand_request_cancelled` 的 `self`/`affected_responder` 文案。
- `src/app/organizer/demands/[demandRequestId]/actions.ts` 新增 `cancelDemandRequestAction`；`page.tsx` 新增取消區塊（D10）。
- `src/app/teacher/demands/[demandRequestId]/page.tsx`：修正 `declined` 狀態文案，區分「被連帶取消」與「被選了別人」（D9，必做，見 2.1 的稽核）。
- Playwright smoke 測試（決定性併發測試 + 連帶取消驗證 + 通知驗證 + 完整 UI E2E 流程，見 D11）。
- 文件對齊：`docs/domain/state-transition-details.md`、`docs/domain/state-machines.md`、`docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`、`docs/product/notification-spec.md`、`docs/specs/organizer-demand-request-spec.md`（新增落地現況段落）。

### 3.2 本輪明確不包含

見 2.3。額外重申：不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 4. 安全與權限設計

- `cancelOwnDemandRequest` 必須 own-scoped：`requireUser()` 解析出 `organizerProfileId`，鎖查詢的 `WHERE` 同時驗證 `id` 與 `organizerProfileId`，非自己的 demand 一律回傳 not-found 語意（比照既有 `createClassSessionForOrganizer`／`cancelClassSessionForOrganizer` 先例）。
- Admin 不介入（見 2.3），也沒有對應的 Admin API。
- 連帶取消（連帶轉 `declined` 的 `DemandResponse`）不需要受影響 Teacher 的 session——系統內部因果，不是使用者發起的 mutation。
- 通知內容不得洩漏超出既有頁面就會顯示的資訊。

## 5. 產品主人決策 Gate（D1–D11）

### D1 — 誰可以取消？從哪些狀態可以取消？

- **推薦：Organizer own-scoped，Admin 不介入**（延續系列先例）。可從 `draft`、`submitted`、`published`、`matched` 四個狀態取消。**明確排除 `converted_to_class`**（2.2 已說明：這個狀態下已經有 `ClassSession` 存在，取消 demand 會產生語意矛盾的資料，應改用 `class-session-cancellation` 取消對應的 ClassSession）。`rejected` 已經是終止狀態，不可再取消。已經是 `cancelled` 的 demand 再次取消，回傳「已經取消過」的明確錯誤碼，不是 no-op 成功。

### D2 — `matched` 狀態下取消，要不要也算進來？

- **推薦：算。** 這是本輪唯一容易漏掉的情境：`matched` 代表 Organizer 已經選定一位 Teacher，但**還沒**建立 `ClassSession`（一旦建立就轉 `converted_to_class`，D1 已排除）。如果只允許從 `draft`/`submitted`/`published` 取消，Organizer 選定老師之後、建立課程之前這段期間會完全卡死、無法回頭——這正是本輪要補的缺口，不能因為範圍複雜就跳過。`matched` 狀態下取消時，那筆 `selected` 的 `DemandResponse` 也要連帶轉 `declined`（D4）。

### D3 — 取消需不需要時間限制（比照 ClassSession D2／Enrollment D14）？

- **推薦：不需要。** `DemandRequest` 沒有 `startAt` 這種「這件事已經發生」的時間欄位——`class-session-cancellation` D2 與 `enrollment` D14 的理由（取消已經開始的課程／已經開始的報名會抹除歷史紀錄正確性）在這裡不適用，因為 demand 本身沒有一個「已經發生」的時間點可以比較。`preferredStartDate` 只是「希望的開課日期」，不是承諾，即使已經過了也不代表這個 demand 不能取消。

### D4 — 取消時，既有的 `DemandResponse` 要怎麼處理？

- **推薦：在同一個 transaction 內，把該 demand 底下所有 `status IN ('submitted', 'selected')` 的 `DemandResponse` 一併轉成 `status = 'declined'`。** 理由跟 `class-session-cancellation` D4 一致：如果不連帶處理，Teacher 會在自己的回應詳情頁看到一筆「已送出」或「已被選中」的回應，實際上這個 demand 早就被取消了，會誤導 Teacher 繼續期待後續進展。
  - 由 D1/D2 可知：`draft`/`submitted` 狀態不可能有任何 `DemandResponse`（2.1 已確認），所以這個 cascade 對這兩個來源狀態永遠是 no-op；`published` 狀態可能有 0 到多筆 `submitted`；`matched` 狀態恰好有 1 筆 `selected`、其餘皆已是 `declined`（select 當下就已經連帶處理過，不需要本輪重複處理）。
  - **不新增新的 `DemandResponseStatus` 值**：reuse 既有的 `declined`，不新增例如 `demand_cancelled` 這種更精確但沒必要的新狀態值（對齊 V1 一貫的最小化原則）。差異只透過 D9 的 UI 文案與通知內容表達「為什麼」被 declined，不需要在資料庫層面區分。
  - 這個 UPDATE 用 `RETURNING "id", "teacherProfileId"` 取回被連帶取消影響的 Teacher，供 tx commit 之後的通知使用（D9）——不需要額外查詢（比照 `class-session-cancellation` D4 用 `RETURNING` 的手法）。

### D5 — 併發設計：需不需要 `__internal__` pure-core + hooks？

- **推薦：需要。** 兩個獨立理由都成立：
  1. **多步驟原子性**：取消需要「檢查狀態 → 轉換狀態 → cascade 更新 DemandResponse」三個步驟一起原子完成，單一 `updateMany` 做不到（跟 `class-session-cancellation` D3 的理由一致）。
  2. **搶同一把既有的鎖**：`submitDemandResponseForTeacher`、`selectDemandResponseForOrganizer`、`createClassSessionForOrganizer` 三個既有 mutation 都對同一張 `DemandRequest` 表的同一行做 `SELECT ... FOR UPDATE`。取消如果不用同一套鎖，會出現跟 `class-session-cancellation` D3 描述的完全同一類問題——例如：Organizer 對一個 `published` demand 送出取消，Teacher 幾乎同時提交一則新回應；如果取消沒有正確鎖住這一行，可能出現「demand 已經是 cancelled，但底下多了一筆從未被 cascade 處理過的 submitted response」。
- 做法：新增 `src/domain/demand-request/__internal__/cancel-demand-request-core.ts`，整段包在 `prisma.$transaction` 內，第一步用跟其餘三個既有 mutation 完全一致的手法——`SELECT ... FOR UPDATE` 鎖住 `DemandRequest` 那一行（`WHERE id = ... AND organizerProfileId = ...`，鎖查詢本身就驗證擁有權）。
- Admin 的 `publish`/`reject` 不需要修改（2.1 已說明：單一 UPDATE 陳述式的列鎖會自然跟本輪的 `FOR UPDATE` 正確排隊）。

### D6 — 取消是否要驗證「還沒有 ClassSession」？

- **推薦：不需要額外驗證。** D1 已經把可取消狀態限定在 `draft`/`submitted`/`published`/`matched`，這四個狀態本身就代表「還沒有 ClassSession」（`ClassSession` 只在 demand 轉為 `converted_to_class` 的同一個 transaction 內建立）。鎖查詢裡直接檢查 `status IN (...)` 就足以保證這一點，不需要另外查一次 `ClassSession` 表。

### D7 — 取消是否要填寫原因？

- **推薦：不用。** 比照 `class-session-cancellation` D6：沒有下游頁面需要顯示「這個需求為什麼被取消」，通知文案只需要說「已取消」。用一個純 UX confirm checkbox 把關即可，不寫入資料庫。

### D8 — Notification：新增 `demand_request_cancelled` 事件，需要 migration

- **推薦：新增。** 這是本輪跟前兩輪 notification 相關工作最大的不同：`docs/product/notification-spec.md` 原始的 14 個事件表裡從來沒有規劃過「demand 被取消」這個事件，`NotificationType` enum 裡也沒有預先保留這個值（不像 `class_session_cancelled` 當初就已經保留）。本輪需要真的執行一次 `prisma migrate dev`，在 `NotificationType` enum 新增 `demand_request_cancelled`。這是本輪風險最集中的一步，改動的是一個所有既有 notification 邏輯共用的 enum，必須確認：
  1. 新增 enum 值是**加法**操作（`ALTER TYPE ... ADD VALUE`），不影響任何既有資料或既有 enum 值，屬於低風險 schema 變更。
  2. 不需要同時新增 `class_session_changed`/`class_reminder_basic`（原本就保留但仍未接線）——本輪只新增這一個全新值，其餘維持原狀。

### D9 — Notification 收件人角色設計

- **推薦**：收件人分兩種角色：
  - `self`（Organizer 自己）
  - **新增第五種角色 `affected_responder`**（每一位因為 D4 連帶取消而受影響的 Teacher，各自收到一筆；`published`/`matched` 狀態下才可能有，`draft`/`submitted` 狀態下這個收件人清單永遠是空的）
- **為什麼新增角色，不沿用 `affected_member`**：`affected_member`（`class-session-cancellation` 新增）的既有文案「「X」已經取消，你的報名也一併取消了。」是 Enrollment／Member 語境的措辭，套用在 Teacher／DemandResponse 語境下文法與情境都不對。`copy.ts` 的 `COPY_TABLE` 本來就是 `(type, role)` 各自對應一份文案，不會因為兩個角色字串不同而增加額外的結構性負擔——新增一個語意精確的角色名稱，比硬套一個名字聽起來不合的既有角色更清楚，也維持了「角色名稱要精確描述受影響對象」這個從 `affected_member` 開始建立的慣例。
- **不套用在 `enrollment_cancelled`／`class_session_cancelled` 既有的角色上**：這是全新的 `demand_request_cancelled` 事件類型，跟既有兩個取消類事件完全獨立（互不影響既有已出貨行為）。
- **修正既有的 Teacher 端 UI 文案（見 2.1 稽核，必做）**：`src/app/teacher/demands/[demandRequestId]/page.tsx` 的 `responseStatusCopy.declined` 目前寫死「團主這次選擇了其他老師，感謝你的回應。」——這句話在本輪的連帶取消情境下是不實敘述。修正方式：這個頁面已經有一次 `prisma.demandRequest.findUnique({where:{id},select:{title:true}})` 查詢（line 74–77），把 `select` 擴充為同時取回 `status: true`（不需要新增查詢），當 `ownResponse.status === "declined" && demand?.status === "cancelled"` 時，改顯示「團主已取消這則需求，感謝你的回應。」，其餘情況維持既有文案不變。
- 收件人解析：resolver query 在 tx commit **之後**用 `prisma`（不是 `tx`）執行，取得受影響 Teacher 的 `userId`（`__internal__` 回傳的 `teacherProfileId` 清單只是 profile id，需要一次查詢解析成 `userId`，比照 `class-session-cancellation` D7 對 `organizerProfileId`/`teacherProfileId` 的既有處理手法）。整段包在 try/catch，失敗不影響 `cancelOwnDemandRequest` 的回傳結果。

### D10 — UI 放哪裡？

- **推薦**：`src/app/organizer/demands/[demandRequestId]/page.tsx` 新增一個「取消需求…」區塊，`draft`/`submitted`/`published`/`matched` 四種狀態都顯示（比照 `class-session-cancellation` 既有的 confirm checkbox 樣式：`<details>`/`<summary>` + 一個帶 checkbox 的 `<form>`，文案清楚說明「取消後無法復原，已提交或已選定的老師回應也會一併取消」）。
- `src/app/organizer/demands/[demandRequestId]/actions.ts` 新增 `cancelDemandRequestAction`，比照既有 `openForEnrollmentAction`/`cancelClassSessionAction` 的寫法（`revalidatePath` + `redirect` + query string 帶 result/message）。

### D11 — 測試策略？

- **推薦：只用既有 Playwright smoke**，不引入 Vitest。必做的決定性測試：
  1. **取消 vs 提交回應的併發序列化**：比照既有手法，證明 `cancelDemandRequestForOrganizer` 與 `submitDemandResponseForTeacher` 搶同一把 `DemandRequest` 鎖時會被資料庫序列化，且不管哪一方先搶到鎖，最終 DB 狀態永遠正確（不會出現「demand 已取消、但還有一筆從未被連帶處理的 submitted response」）。只斷言 DB 最終狀態，不斷言 Notification 相對寫入順序（比照 `class-session-cancellation` D7 已明確接受的殘留風險，同一類限制在這裡一樣適用，不重複展開）。
  2. **取消 vs 選定回應的併發序列化（codex round 1 指出的問題，已採納新增）**：D5 指出取消要跟 `selectDemandResponseForOrganizer` 搶同一把鎖，但只測 1 項不足以證明這個特定的鎖互動——`submitDemandResponseForTeacher` 跟 `selectDemandResponseForOrganizer` 的 guard 條件不同（前者只檢查 `published`，後者還要確認沒有其他 response 已經 selected），必須各自獨立證明。同樣用決定性 hooks 手法，證明兩種先後順序都不會產生矛盾資料：若 select 先贏得鎖並把 demand 轉為 `matched`，取消（D2 已確認 `matched` 可取消）之後仍要正確連帶取消那筆剛產生的 `selected` response；若取消先贏得鎖，select 之後應該拿到既有的 `response_not_submitted` 錯誤碼——**修正（codex round 2 指出的問題，已採納）**：這不是需要新增或修改的錯誤語意，是 `selectDemandResponseForOrganizer` 既有邏輯自然就會產生的結果，因為 D4 的連帶取消已經把目標 response 從 `submitted` 轉成 `declined`，`selectedRows.length === 0` 的既有 fallback 邏輯查不到「已有其他 selected response」，就會落到既有的 `response_not_submitted` 分支（見 `src/domain/demand-response/__internal__/select-and-submit-core.ts` 既有程式碼），不需要新增任何錯誤碼或修改既有的 select 邏輯。測試斷言 `{ok:false, code:"response_not_submitted"}` 即可，不會憑空產生一筆 `selected` response 掛在已取消的 demand 底下。
  3. **取消 vs 建立課程的併發序列化（codex round 1 指出的問題，已採納新增）**：D5 也指出取消要跟 `createClassSessionForOrganizer` 搶同一把鎖，這是本輪風險最高的互動——2.2 已經說明，如果沒有正確序列化，可能出現「`ClassSession` 已建立，但它所屬的 `DemandRequest` 卻是 `cancelled`」這種語意矛盾的資料，且 `ClassSession.demandRequestId` 是 `onDelete: Restrict` 的外鍵，一旦發生這種矛盾幾乎沒有簡單的方式挽回。必須用決定性 hooks 手法證明：若建立課程先贏得鎖並把 demand 轉為 `converted_to_class`，取消之後必須正確地拿到「不可取消」的錯誤（因為 `converted_to_class` 不在可取消狀態集合內，D1），不會憑空把一個已經有 ClassSession 的 demand 轉成 `cancelled`；若取消先贏得鎖，建立課程之後應該正確地拿到「demand 不是 matched」的錯誤。
  4. **連帶取消（published，多筆 submitted）**：一則 `published` demand 已有多筆 `submitted` 回應，取消後全部轉 `declined`；其他不相關 demand 的回應不受影響。
  5. **連帶取消（matched，selected + 其餘 declined）**：一則 `matched` demand（已有 1 筆 `selected`、其餘已是 `declined`），取消後那筆 `selected` 也轉 `declined`。
  6. **D1 狀態邊界**：`converted_to_class`／`rejected` 狀態不可取消，回傳明確錯誤碼。
  7. **Notification**：取消後，Organizer(self) 與每一位受影響 Teacher(affected_responder) 各自收到正確文案的 `demand_request_cancelled` 記錄；`draft`/`submitted` 狀態取消時（沒有任何回應）只有 Organizer 收到通知，沒有任何 `affected_responder` 記錄產生。
  8. **通知失敗隔離的決定性測試（codex round 1 指出的問題，已採納新增）**：D9 要求 resolver query 與 `notifyUsers` 呼叫失敗絕不能影響 `cancelDemandRequestForOrganizer` 的回傳結果，但如果沒有測試驗證，一個把這段邏輯誤放進 `$transaction` 內的實作也會通過上面所有其他測試（因為那些測試從不刻意讓通知失敗）。比照 `class-session-cancellation` D10 第 7 項已驗證過的手法：直接呼叫 `cancelDemandRequestForOrganizer`，透過 `notifyOverride` 參數注入一個保證同步丟出例外的函式，斷言（a）回傳值仍是 `{ok:true}`、（b）`DemandRequest` 確實轉為 `cancelled`、（c）連帶取消的 `DemandResponse` 確實轉為 `declined`——證明例外發生在 trigger 外層的 try/catch 範圍內，不會讓已經成功的 DB 變更被回滾或誤報失敗。
  9. **Teacher 端文案修正驗證**：一則 `published` demand 有 Teacher 提交回應後被取消，該 Teacher 造訪自己的回應詳情頁，斷言看到的是修正後的取消文案，不是舊的「選了別人」文案。
  10. **IDOR**：非本人 Organizer 無法取消別人的 demand（not-found 語意）。
  11. **重複取消**：已經是 `cancelled` 的 demand 再次取消，回傳明確錯誤碼，不是靜默成功。
  12. **必做的 UI E2E 測試**：從瀏覽器實際走完整流程：Organizer 建立並送出需求 → Admin 發布 → Teacher 提交回應 → Organizer 在需求詳情頁點擊取消 → 確認 checkbox → 送出 → 確認頁面顯示取消成功的 feedback、狀態徽章顯示「已取消」，Teacher 端該回應顯示修正後的取消文案。

## 6. 品牌與 UX 規則

- 取消文案清楚說明後果（無法復原、已提交或已選定的老師回應也會一併取消），不使用威脅或模糊字眼。
- Notification 文案延續既有「清楚、溫和、可信任」原則。

## 7. RWD Requirements

- 取消區塊在 360px 手機寬度可用，比照既有「取消課程」區塊版型，不使用密集表格。

## 8. 實作切片（Slice 1–5；施工前提：D1–D11 已拍板）

### Slice 1 — Schema + Notification 角色擴充

- `prisma/schema.prisma`：`NotificationType` 新增 `demand_request_cancelled`（D8）；跑 `npx prisma migrate dev`，核對 migration SQL 只是 `ALTER TYPE ... ADD VALUE`，不影響既有資料。
- `src/domain/notification/types.ts`：`NotificationRecipientRole` 新增 `"affected_responder"`（D9）。
- `src/domain/notification/copy.ts`：新增 `demand_request_cancelled` 的 `self`/`affected_responder` 文案。
- **驗證**：throwaway `tsx` script 直接呼叫 `notifyUsers("demand_request_cancelled", [...], {...})` 兩種角色各一筆，確認文案正確、事後清除測試資料。

### Slice 2 — 取消 domain service

- `src/domain/demand-request/__internal__/cancel-demand-request-core.ts`：`cancelDemandRequestForOrganizer(organizerProfileId, demandRequestId, hooks?, notifyOverride?)`（D1/D2/D4/D5/D9，簽章比照 `cancelClassSessionForOrganizer` 的既有設計）。
- `src/domain/demand-request/service.ts`：新增 `cancelOwnDemandRequest(demandRequestId)`（auth wrapper）。
- **驗證**：throwaway `tsx` script 直接呼叫 `cancelDemandRequestForOrganizer`，涵蓋：`draft`/`submitted`/`published`（含連帶取消多筆 submitted）/`matched`（含連帶取消 selected）四種來源狀態、`converted_to_class`/`rejected` 狀態邊界、重複取消。

### Slice 3 — UI

- `src/app/organizer/demands/[demandRequestId]/actions.ts`：`cancelDemandRequestAction`。
- `src/app/organizer/demands/[demandRequestId]/page.tsx`：取消區塊（D10）。
- `src/app/teacher/demands/[demandRequestId]/page.tsx`：修正 `declined` 狀態文案（D9 修正版）。
- **驗證**：瀏覽器實際操作——建立需求、送出、發布、Teacher 提交回應、Organizer 取消，確認 Organizer 頁面顯示「已取消」、Teacher 端顯示修正後的取消文案。

### Slice 4 — Tests + Docs 對齊

- `tests/smoke/demand-request-cancellation.spec.ts`：D11 列出的 12 類測試（含必做的 UI E2E 測試與通知失敗隔離測試）。
- 更新 `docs/domain/state-transition-details.md`（DemandRequest 新增 `→ cancelled` 轉換說明、Notification Side Effects 新增 `demand_request_cancelled`）、`docs/domain/state-machines.md`（DemandRequest V1 落地範圍更新）、`docs/domain/data-model.md`（`NotificationType` 事件計數更新、新增 `demand_request_cancelled` 說明）、`docs/domain/permissions-matrix.md`（`Cancel demand` 列的 V1 落地範圍註記，修正 DemandRequest 與 Notification 兩處舊敘述）、`docs/product/notification-spec.md`（落地現況段落追加 `demand_request_cancelled`，並補充這是原始 event 表沒有規劃過的新事件、`affected_responder` 角色是站內落地細節）。
- **修正（codex round 1 指出的問題，已採納新增）**：也要更新 `docs/specs/organizer-demand-request-spec.md`。這份是 DemandRequest 的原始 canonical spec，目前完全沒有「落地現況」段落，而且文中明確寫著「`demand cancel/expire flow`」是 `organizer-demand-request-foundation` 這一輪「額外明確不做」的項目（line 131）、狀態機說明也寫著 `cancelled` 不在該輪 scope（line 103）。本輪落地後，若不補一個「落地現況」段落（比照本專案其他 spec 檔案的既有慣例，例如 `class-session-and-enrollment-spec.md`／`notification-spec.md` 的做法），這份 canonical spec 會跟已落地的程式碼與其他已更新的 domain 文件互相矛盾，造成後續規劃誤判。**不要**改動 line 103/131 這兩句歷史敘述本身（那是描述 `organizer-demand-request-foundation` 那一輪的既有事實，仍然正確），只在檔案開頭新增一個「落地現況」段落說明 demand cancel 已經在本輪（`class-session-cancellation` 之後、本輪 `demand-request-cancellation`）落地。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 → 2 必須先完成（schema/notification 角色擴充 + 核心 service）。Slice 3 依賴 Slice 2。Slice 4 排最後。

## 9. Verification Planning

- Domain 層（Slice 1–2）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 3）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 併發相關（Slice 2/4）：新的決定性鎖測試 + 重跑既有 `tests/smoke/demand-response-selection.spec.ts`／`class-session-creation.spec.ts` 確認沒有破壞既有的鎖行為（這兩個既有測試都直接依賴 `DemandRequest` 的 `FOR UPDATE` 鎖序列）。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- Slice 1 的 migration 只新增一個 enum 值（`ALTER TYPE ... ADD VALUE`），本機開發資料庫可用 `prisma migrate reset` 復原，不影響任何已部署環境（本專案目前沒有已部署環境）。
- 若任何 Slice 的併發鎖測試發現破壞既有的 `demand-response-selection`／`class-session-creation` 測試，優先 revert 該筆 commit，不做 hotfix 疊加。

## 11. Planning-only self review

- 已核對：`submitDemandResponseForTeacher`／`selectDemandResponseForOrganizer`／`createClassSessionForOrganizer` 三個既有 mutation 的鎖查詢寫法與檔案行號，全部逐行讀取確認，不是猜測。
- 已核對：`NotificationType` 目前沒有 `demand_request_cancelled` 這個值，本輪確實需要新的 migration（跟前兩輪只是「接上已保留的值」不同）。
- 已核對：`src/app/teacher/demands/[demandRequestId]/page.tsx` 的 `declined` 文案與 `getOwnDemandResponseForDemand` 不受 demand 狀態限制的既有行為，確認 UI 文案修正是必要的，不是可以靠既有 404 迴避的邊界情況。
- 待 codex 檢查：D2 把 `matched` 狀態納入可取消範圍是否有遺漏的邊界情況；D5 的併發設計是否正確涵蓋所有既有鎖的互動；D9 新增 `affected_responder` 角色與既有 `NotificationRecipientRole`/`copy.ts` 型別是否有破壞性影響；D8 的 migration 是否有遺漏的相依風險。

<!-- codex-peer-reviewed: 2026-07-28T14:18:26Z rounds=3 verdict=approved -->
