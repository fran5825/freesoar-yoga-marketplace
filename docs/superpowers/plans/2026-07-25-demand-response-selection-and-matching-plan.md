# Demand Response Selection and Matching — Implementation Plan

> 狀態：**planning-only**。本輪只產出可逐 slice 執行的規劃，不實作任何 schema / 程式 / 測試。
> 目標 user flow：Organizer 在自己的 demand detail（`/organizer/demands/[demandRequestId]`）查看收到的老師回應 → 選定一位老師（select）→ 該 `DemandResponse` 進入 `selected`，其餘 response 自動進入 `declined` → 對應 `DemandRequest` 進入 `matched` → Teacher 在自己的 response 頁面看到「已被選中」或「未獲選」的清楚狀態。
> 本文件為 **High-risk Planning Gate** 產物（觸及 state machine / core user flow / 併發保護 / demand visibility 的下游語意）。**在第 5 節產品主人決策（D1–D11）全部拍板前，不得產出可直接執行的 Builder implementation prompt。**

---

## 0. 如何閱讀本 plan（給零背景 Builder）

- 本 plan 目標是自足：Builder 只需讀「本檔 + 目前 repo」即可理解各 slice 設計。
- 第 2 節「現況核對」的敘述以 primary source 為準；Builder 施工前**必須自行再核對一次實際檔案**。
- 「allowed files」為白名單：未列出的檔案一律 forbidden。
- 本 plan 明確**不含** ClassSession 建立——那是下一份獨立 plan 的範圍（見第 3 節）。

---

## 1. 背景與範圍

### 1.1 產品問題

`docs/superpowers/plans/2026-07-21-teacher-demand-pool-response-plan.md`（已出貨，2026-07-25 commit+push 進 `main`）完成了「Teacher 瀏覽 published demand → 提交/撤回 response、Organizer 唯讀查看 response」這條線的頭尾兩端，但整條 demand-to-class 的核心價值鏈仍缺一塊：**Organizer 無法從收到的回應中選定老師**。沒有這一步，`DemandRequest` 永遠卡在 `published`，`DemandResponse` 永遠卡在 `submitted`，marketplace 無法真正促成一堂課。本輪補上這一塊。

### 1.2 風險等級

依 `docs/harness/risk-based-workflow.md`／`mvp-slicing.md`：觸及 **state machine（DemandResponse selected/declined、DemandRequest matched）、core user flow（select 動作）、併發保護（同一 demand 只能一個 selected response）**，屬 **High-risk / Heavy**，先 Planning-only。

Risk flags：`PERMISSION_RISK`、`STATE_MACHINE_RISK`、`SCOPE_DRIFT_RISK`、`BRAND_RISK`。（無 Prisma schema 變更——本輪只是把既有 `DemandResponseStatus` enum 中已保留但未接線的 `selected`/`declined` 值接上 transition，不需要新增欄位或 migration；`DemandRequest.status` 的 `matched` 同理，enum 值已存在。）

---

## 2. 現況核對（Repo Reality Audit；2026-07-25 working tree = committed `main` @ `43e8ced`）

### 2.1 已 committed 的基礎（可直接依賴，不是 prerequisite contract）

- `prisma/schema.prisma`：`DemandResponseStatus` enum 已是完整 6 值（`submitted/shortlisted/selected/declined/withdrawn/expired`）；`DemandRequestStatus` enum 已含 `matched`（與 `under_review`/`teacher_responded`/`converted_to_class`/`completed`/`cancelled`/`expired` 一併保留）。**兩個 enum 都不需要新增值，本輪 schema-only 部分僅可能新增 index，無需 migration 也可能完全不動 schema。**
- `src/domain/demand-response/`：
  - `capability.ts`：`requireApprovedTeacher()`、`getOwnTeacherProfileId()`。
  - `state.ts`：僅有 `validateDemandResponseWithdrawTransition`（`submitted→withdrawn`）。**沒有** select/decline 的 transition 函式，需本輪新增。
  - `service.ts`：`submitOwnDemandResponse`（raw SQL atomic insert）、`withdrawOwnDemandResponse`、`getOwnDemandResponseForDemand`。**沒有** select/decline 的 mutation，需本輪新增。
  - `organizer-read-service.ts`：`listResponsesForOwnDemandRequest(demandRequestId)`——**唯讀**，D13 allowlist（`displayName/bio/teachingStyle/experienceYears/specialties/serviceAreas/teachingFormats/profilePhotoUrl` + response 本身欄位）。本輪的 select mutation **不得**沿用這個唯讀 service，須新增獨立的 write-path 函式，但可沿用其 ownership 驗證 pattern（`demandRequest.organizerProfile.userId` 比對）。
  - `demand-read-service.ts`：Teacher 端唯讀（pool/detail），與本輪無直接關係。
- `src/app/organizer/demands/[demandRequestId]/page.tsx`：Organizer demand detail，**已整合** `ResponseList`（`_components/ResponseList.tsx`，唯讀顯示）。本輪需要在這個既有 UI 上加「選定」動作，但**不得**大幅重寫這個檔案——比照 teacher-demand-pool-response-plan 對 Organizer 疆域的「僅新增 import + 一個 JSX 區塊」原則（見第 8 節 Slice 設計）。
- `src/app/teacher/demands/[demandRequestId]/page.tsx`：Teacher 查看自己 response 的頁面，**`responseStatusCopy` 字典已經涵蓋** `selected`/`declined`/`expired` 的文案（`已被選中`/`未獲選`/`已過期`），因為當初設計時就對齊了完整 6 值 enum，只是沒有任何 transition 會把狀態寫成這些值。**本輪一旦接上 select/decline transition，這個既有頁面不需要改任何程式碼就能正確顯示新狀態**——這是本輪的一個有利現況，值得在 Slice 設計中明確驗證（見 Slice 3 的 manual smoke scenario）。
- `docs/product/route-map.md`：`/organizer/demands/[demandRequestId]` 的描述已經寫「查看需求詳情、老師回覆與 matching 狀態」——route 本身不需要新增，matching 動作可以整合進既有頁面。

### 2.2 上游依賴狀態

無。本輪完全建立在已 committed 且已通過完整 codex peer review（16 rounds）的 `teacher-demand-pool-response-plan` 之上，沒有平行未拍板的 draft plan 需要協調。這是三份 plan 中依賴最單純的一份。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- **ClassSession 建立**（`DemandRequest: matched → converted_to_class`）：`data-model.md` 已有 `ClassSession` 欄位設計稿，但 `route-map.md` 完全沒有任何 ClassSession 路由，`prisma/schema.prisma` 也沒有 `ClassSession` model。這是明顯更大、更獨立的下一塊，本輪不做，列為下一份獨立 plan。
- **Enrollment**：同上，更下游，不在本輪範圍。
- **Notification/email**：延後（見 D10，對齊 teacher-rejection D7、organizer-demand D14、teacher-demand-pool D14 的既有分期先例）。

---

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `DemandResponse` 的 `select`／`decline` transition（domain state + service）。
- Select 動作觸發「同一 demand 的其餘 submitted response 自動轉 declined」（D3）。
- Select 動作觸發 `DemandRequest: published → matched`（D4，persisted write，與前一輪的動態推導哲學不同，理由見 D4）。
- Organizer 在既有 demand detail 頁面執行 select（UI 整合，不新增 route）。
- Teacher 端顯示 selected/declined 狀態（**已有現成 UI**，本輪只需確認 transition 接上後運作正確，見 2.1）。
- 併發保護：同一 demand 不可同時有多個 selected response。
- 安全、RWD、品牌、Playwright smoke 規劃。

### 3.2 本輪明確不包含

- **ClassSession 建立**（下一份獨立 plan，`DemandRequest: matched → converted_to_class`）。
- Enrollment。
- Shortlist 是否落地為獨立步驟，交由 D1 決定；若選跳過，`shortlisted` enum 值保留但不接線（比照本專案一貫的「完整 enum、最小接線」慣例）。
- Admin 介入 select（D2 預設只開放 Organizer own-scoped，Admin 的爭議處理留待未來）。
- 取消 selected（select 為終局動作，見 D8）。
- Notification/email（D10）。
- Teacher availability calendar、AI matching、競標、付款。

---

## 4. 安全與權限設計

1. **select/decline 一律 own-scoped**：Organizer 只能對「自己 `DemandRequest` 底下的 `DemandResponse`」執行 select，`organizerProfileId` 一律從 session 解析，不信任 client 傳入的 `organizerProfileId`；ownership 驗證沿用 `organizer-read-service.ts` 的 `demandRequest.organizerProfile.userId` 比對 pattern。
2. **併發保護（TOCTOU）——不只 select-vs-select，也包含 submit-vs-select**：select 必須是單一原子操作，同時滿足「demand 當下尚無 selected response」與「該 response 屬於這個 demand 且狀態為 submitted（或 shortlisted，依 D1）」，並同時寫入 `DemandRequest.status = matched`。但光靠 select 內部的原子 UPDATE 不足以防止一種跨 service 的競態：Teacher 的 `submitOwnDemandResponse` 只檢查 `DemandRequest.status = published`，若這個檢查發生在 select 的 transaction commit **之前**、但 INSERT 真正完成在 select 的「其餘轉 declined」步驟**之後**，就會產生一筆永遠卡在 `submitted` 但所屬 demand 已經 `matched` 的孤兒 response，而且 select 的 file allowlist 若禁止修改 `submitOwnDemandResponse` 所在的 `service.ts`，就沒有地方能防堵這個時窗。**解法見 D5**：submit 與 select 共用同一把 demand-level lock，兩者的 transaction 都必須先鎖住目標 `DemandRequest` 那一列，才能確保時序上互斥。
3. **一次寫入兩張表（DemandResponse.selected + DemandRequest.matched + 其餘 response 轉 declined）必須是同一個 transaction**，任一步失敗全部 rollback，避免「demand 已 matched 但 response 未標記 selected」或反之的不一致。
4. **對 unauthorized / cross-owner resource 優先使用 not-found semantics**，不洩漏資源存在性差異，沿用既有慣例。
5. **Teacher 端不得能觸發或影響 select 的結果**：select 的決策（誰被選中）完全是 Organizer 動作，Teacher 端現有的 `getOwnDemandResponseForDemand`／`withdrawOwnDemandResponse` 邏輯**不得修改**（withdraw 已經正確防禦 `selected` 狀態不可自行撤回，見既有 `validateDemandResponseWithdrawTransition` 的 `selected_response_cannot_withdraw` 分支）。**唯一例外**是 D5／Slice 2 要求的 `submitOwnDemandResponse` 鎖語句改動——這不改變 Teacher 能做什麼或看到什麼，純粹是讓 submit 這個既有動作在時序上與 select 互斥，屬於併發保護的內部機制，不是新增或變更 Teacher 的能力。
6. **DTO 資料最小化**：select 動作的 server action 不需要回傳新的 teacher 私人資料，沿用既有 D13 allowlist 原則。
7. **錯誤訊息不得洩漏內部細節**：中文溫和訊息，discriminated union result。
8. **可測試性拆分不得成為權限繞過**：D5／Slice 2 為了讓併發測試能繞開 `requireUser()` 的 request-context 限制，把 `selectDemandResponse`／`submitOwnDemandResponse` 拆成「auth 外層 + 內層」。這個拆分帶來兩層不同性質的風險，分開處理：
   - **資料層級的繞過（狀態不變量）**：內層函式必須自己拒絕「不合法的狀態」——`selectDemandResponseForOrganizer` 的擁有權檢查是原子 UPDATE 的 `WHERE` 子句一部分；`submitDemandResponseForTeacher` 的 approved-teacher 檢查是同一個 `WHERE EXISTS` 的一部分（見 Slice 2）。這一層**已經解決**：就算這兩個函式被非預期地直接呼叫，也不會產生「選中不屬於自己 demand 的 response」或「非 approved teacher 成功提交」這種資料不一致，不依賴註解或呼叫慣例，是 DB 層面強制的。
   - **身分層級的繞過（impersonation，已知殘留風險，刻意不做更重的解法）**：即使狀態不變量成立，內層函式仍然是「信任呼叫方宣稱的 `organizerProfileId`／`teacherProfileId` 就是目前操作者本人」——它們無法證明呼叫方真的是那個身分，只能證明那個 id 本身在資料庫裡是合法、有權限的。要做到「呼叫方無法偽造身分」，標準解法是讓外層 `requireUser()`／`requireApprovedTeacher()` 產生一個只有它能建構的 unforgeable capability（例如 nominal-typed token 或執行期簽章），內層函式改吃這個 token 而非原始字串 id。**本輪刻意不做這一層**：(1) TypeScript 的型別系統在執行期會被抹除，branded type 只防手滑、不防蓄意偽造，要做到真正無法偽造需要執行期驗證機制（例如簽章或 WeakSet 註冊），這是這個 V1 marketplace 專案目前完全沒有的一類基礎設施，全專案其他任何 domain 函式都沒有這種保護；(2) 這兩個內層函式在本輪結束時只有唯一合法呼叫方（對應的 auth 外層）與測試檔案會 import 它們，不對外部 HTTP／API 曝露、不改變任何外部可觸及的攻擊面——`selectDemandResponse`／`submitOwnDemandResponse` 這兩個唯一從外部可達的入口點，仍然 100% 自行呼叫 `requireUser()`／`requireApprovedTeacher()`，行為與抽出前完全相同；(3) 剩餘風險模型與這個 codebase 現有每一個「吃 id 參數、不驗證呼叫方」的內部函式完全一樣（例如 `prisma.organizerProfile.update({where:{id}})` 這類呼叫在整個 domain 層隨處可見），要求這兩個新函式達到比全專案基礎設施更高的標準不成比例；殘留風險的邊界是「未來有人明知故犯地在別處直接呼叫這個 export、繞過正確的 auth 外層」，屬於 code review 要攔的問題，不是這一輪 foundation 要解決的新攻擊面。
   - **仍然採取的最小防禦**：內層函式移到獨立的 `src/domain/demand-response/__internal__/` 目錄（見 Slice 2），這是這個專案沒有既有 import-boundary lint 規則情況下能做到的最強訊號——命名本身明確告知「這不是給任意程式碼呼叫的公開 API」，未來若專案導入 import-boundary 工具（例如 ESLint 的 `no-restricted-imports`），這個目錄是第一個該被規則鎖住的地方。

---

## 5. 產品主人決策 Gate（D1–D11）

### D1 — Shortlist 是否在本輪落地為獨立步驟？

- **選項 A（推薦）**：V1 **跳過 shortlist**，Organizer 直接對任一 `submitted` response 執行 select（一步到位），對齊本專案一貫的「跳過中間審查狀態」簡化先例（`TeacherProfile` 跳過無、`DemandRequest` 跳過 `under_review`）。`shortlisted` enum 值保留但不接線。
  - 優點：foundation 最小，避免「shortlist 算不算篩選、要不要限制數量」等額外規則；single-step 心智模型對 Organizer 更直覺。
- **選項 B**：實作完整 `submitted → shortlisted → selected` 兩階段。
  - 缺點：多一組 UI 與 transition，且「shortlist 多位、最後只能 select 一位」的體驗設計本身就是一塊獨立工作量，不屬於「補上核心價值鏈缺口」的最小需求。
- **推薦：A**。

### D2 — 誰可以執行 select？

- **選項 A（推薦）**：僅 **Organizer**（own-scoped）。Admin 不介入 select（`docs/specs/demand-response-and-matching-spec.md` 原文寫「Organizer 或 Admin」，但目前 `/admin/demands` 只做 publish/reject，從未涉入 matching 決策；V1 保持 Admin 職責單純）。
- **選項 B**：Organizer 或 Admin 皆可。
  - 缺點：需要在 `/admin/demands` 新增一個目前不存在的 matching 介面，擴大本輪範圍。
- **推薦：A**。若未來需要 Admin 爭議仲裁，可另案追加。

### D3 — Select 後，其餘（非選中）responses 如何處理？

- **選項 A（推薦）**：select 成功時，**同一 transaction 內**把該 demand 底下其餘所有 `submitted`（若 D1=B 則含 `shortlisted`）response 自動轉為 `declined`。
  - 優點：Organizer 與其餘老師都能立刻看到明確結果（品牌要求「Selected 狀態要清楚，避免多位老師誤以為自己已被選中」，見既有 spec UI Requirements）；不需要 Organizer 額外操作。
- **選項 B**：保持其餘 response 為 `submitted`，Organizer 需個別手動 decline。
  - 缺點：需要額外一組「手動 decline」UI 與 server action，且會有一段時間其他老師誤以為機會仍在。
- **推薦：A**。

### D4 — `DemandRequest` 是否要 persist `matched` 狀態？

- **關鍵差異**：teacher-demand-pool-response-plan 的 D11 選擇「動態推導、不 persist」`teacher_responded`，理由是那是**高頻、teacher 端觸發**的事件，persist 會造成跨 domain 寫入耦合。但 `matched` 不同：
  - 它是**低頻、Organizer 主動決策觸發**的事件（一個 demand 一生只會發生一次）。
  - 它是**下一步（ClassSession 建立）的必要 gate**——未來的 ClassSession 建立 slice 需要明確查詢「哪些 demand 已 matched」，動態推導（「查詢是否存在 selected response」）雖然可行，但語意上不如直接查 `status` 欄位清楚，且 `docs/domain/state-machines.md` 已把 `matched` 列為 `DemandRequest` 完整狀態機的正式一環（不像 `teacher_responded` 那樣本輪選擇性省略）。
  - **選項 A（推薦）**：select 成功時，**同一 transaction** 內把 `DemandRequest.status` 從 `published` 更新為 `matched`。因為 select service 本身就屬於 `demand-response` domain，但要寫入 `DemandRequest` 表——沿用 teacher-demand-pool-response-plan D11 選項 A 討論過的「transaction-aware helper」模式：`demand-request` domain（已存在於 `src/domain/demand-request/`）需要 export 一個接受外部 `Prisma.TransactionClient` 的函式（例如 `markDemandRequestAsMatchedIfPublished(tx, demandRequestId)`），select service 在同一個 `tx` 內先執行 response 的原子 update，成功後在同一個 `tx` 呼叫這個 helper。
  - **選項 B**：動態推導（不 persist matched，靠「demand 是否有 selected response」判斷）。
- **推薦：A**。**此決策的落地需要修改 `src/domain/demand-request/`**（新增一個 export function），這是本輪唯一需要碰觸「別的 domain」的地方，需在 Slice 設計中明確標示為跨 domain 的最小必要改動（新增 function，不修改既有邏輯）。

### D5 — Select 与 Submit 之间的併發保護具體手法（demand-level 共享鎖）

- **問題**：select-vs-select（兩個 Organizer 請求，或同一 Organizer 連點兩次）與 submit-vs-select（Teacher 提交新 response 的同時 Organizer 正在 select）是兩種不同的競態，只解 select 內部的原子性不夠：
  - 若只靠「兩個 `UPDATE ... WHERE ... AND NOT EXISTS (...)` 各自跑」防 select-vs-select，兩者可能都先通過 `NOT EXISTS` 檢查（各自看到「demand 尚無 selected」），都成功把**不同**的 response 標成 `selected`，接下來各自的「其餘轉 declined」步驟會互相嘗試鎖對方剛標的那筆列 → deadlock，其中一個 transaction 被 Postgres 中止，但走的是通用 DB failure 路徑而非可預期的「已有別人 selected」錯誤分支，且沒有測試驗證最終只有一個 selected。
  - submit-vs-select 的問題見上方第 4 節第 2 點：submit 的 eligibility 檢查與 select 的 decline-others 快照之間有時窗，可能留下孤兒 `submitted` response。
- **推薦**：submit 與 select 的 transaction 都必須以「鎖住目標 `DemandRequest` 那一列」作為交易內的**第一個語句**，讓兩者（以及兩個並行 select）對同一個 demand 的操作序列化：

  ```sql
  -- 兩條路徑（submit、select）transaction 內的第一個語句
  SELECT "id" FROM "DemandRequest" WHERE "id" = $demandRequestId FOR UPDATE
  ```

  取得鎖後，select 依序執行：

  ```sql
  UPDATE "DemandResponse"
  SET "status" = 'selected', "updatedAt" = now()
  WHERE "id" = $responseId
    AND "demandRequestId" = $demandRequestId
    AND "status" = 'submitted'
    AND NOT EXISTS (
      SELECT 1 FROM "DemandResponse"
      WHERE "demandRequestId" = $demandRequestId AND "status" = 'selected'
    )
  RETURNING "id"
  ```

  0 列被更新 → 代表「demand 已有別的 selected response」或「這筆 response 已不是 submitted」，回頭查詢判斷回傳哪種錯誤。此 UPDATE 與 D3 的「其餘轉 declined」、D4 的「DemandRequest 轉 matched」須在同一個 `prisma.$transaction(async (tx) => {...})` 內、鎖之後依序執行，任一步失敗全部 rollback。

  **鎖如何解掉兩種競態**：
  - **select-vs-select**：兩個 select 對同一 demand 都先搶 `FOR UPDATE` 鎖，只有一個能先進去；先進去者完成三步驟並 commit 釋放鎖；後進去者拿到鎖後重新執行上面的原子 UPDATE，此時 `NOT EXISTS` 條件已經是 false（已有 selected response），確定性地回傳 0 列，走既有「demand 已有別的 selected response」錯誤分支——不再依賴 deadlock resolution。
  - **submit-vs-select**：若 select 先拿到鎖並 commit，`DemandRequest.status` 已變成 `matched`；submit 拿到鎖後，既有的 `WHERE EXISTS (... status = ANY(eligibleStatuses))` guard（`eligibleStatuses = ['published']`）自然讀到最新值而回傳 0 rows → `demand_not_eligible`，**不需要修改這段判斷邏輯本身**。若 submit 先拿到鎖並 commit（demand 當時仍是 `published`，insert 成功），select 拿到鎖後執行的「其餘轉 declined」`UPDATE ... WHERE status = 'submitted'` 讀到的是鎖釋放後的最新已 commit 資料，會**一併正確涵蓋**這筆新 response，不會留下孤兒列。
  - 這個鎖語句是**唯一**允許加進 `submitOwnDemandResponse`（`src/domain/demand-response/service.ts`）的修改：把原本單一 raw SQL statement 包進 `prisma.$transaction(async (tx) => {...})`，第一步在 `tx` 內執行上面的 `SELECT ... FOR UPDATE`，第二步原封不動地用 `tx.$queryRaw` 執行既有的 `INSERT ... SELECT ... WHERE EXISTS` 邏輯，不改變其驗證、錯誤處理、回傳值或 not-found 語意（見 Slice 2 file allowlist 調整）。

### D6 — Select 是否需要二次確認？

- **推薦：需要**。Select 是不可逆的終局動作（D8：不提供取消 selected），比照 admin reject／teacher withdraw 的既有二次確認 pattern（`<details>` + 必勾 checkbox），確認文案需清楚說明「選定後其餘老師的回應會自動標記為未獲選，且無法復原」。

### D7 — Teacher 端是否需要新增畫面或文案？

- **推薦：不需要**。如 2.1 節所述，`/teacher/demands/[demandRequestId]` 的 `responseStatusCopy` 已涵蓋 `selected`/`declined`，一旦 transition 接上即可正確顯示，本輪不修改該檔案（維持 forbidden，只讀不改，除非測試發現實際文案需要微調）。

### D8 — 是否提供「取消 selected」？

- **推薦：不提供**。Select 為終局動作。若 Organizer 選錯人，V1 不提供 UI 復原路徑（需聯繫平台管理者手動處理，屬 Admin 未來職責，不在本輪）。

### D9 — ClassSession 是否納入本輪？

- **推薦：不納入**（見第 3.2 節）。本輪結束於 `DemandRequest.status = matched`，下一份獨立 plan 處理 `matched → converted_to_class`。

### D10 — Notification 分期

- **推薦：延後**，對齊本專案所有先前 D 決策的一貫分期（teacher-rejection D7、organizer-demand D14、teacher-demand-pool D14）。V1 以站內狀態顯示（Organizer 自己看到 `已選定` 標籤、Teacher 自己看到 `已被選中`/`未獲選`）作為告知，不寄 email。

### D11 — 測試策略

- **推薦：只用既有 Playwright smoke**，不引入 Vitest、不改 `package.json`，對齊本專案唯一慣例。

> **Gate 狀態**：D1–D11 **尚未拍板** → High-risk Planning Gate **未解除**。在 PO 逐項裁定前，第 8 節各施工 slice **不得**產出可執行 Builder implementation prompt。

---

## 6. 品牌與 UX 規則

- Select 確認文案語氣溫和但清楚，不使用「淘汰」「出局」等競爭性字眼；其餘老師的狀態呈現為「未獲選」而非負面標籤。
- Organizer 端 response 列表一旦有 selected response，應清楚標示「已選定」並讓其餘卡片呈現「未獲選」的次要視覺層級，不使用醒目的紅色警示色（避免製造焦慮）。
- Teacher 端「未獲選」文案已經是溫和語氣（`責備了嗎？沒有——`「團主這次選擇了其他老師，感謝你的回應。」`，見既有 `responseStatusCopy`），本輪不需要調整。
- 「已被選中」的呈現需清楚但不誇張，符合品牌「Gentle, Trustworthy」語氣。

## 7. RWD Requirements

- Organizer demand detail 的 select 按鈕與二次確認在 360px/390px 需可操作，不誤觸。
- 選定後的「已選定」／「未獲選」標籤在手機版不造成版面錯亂。

---

## 8. 實作切片（Slice 1–5；施工前提：D1–D11 已拍板）

### Slice 1 — DemandResponse select/decline domain state + transaction-aware helper

- **goal**：在 `src/domain/demand-response/state.ts` 新增 select/decline transition 驗證；在 `src/domain/demand-request/`（既有 domain，僅新增檔案或新增 export，不修改既有邏輯）新增 D4 所需的 transaction-aware helper。
- **slice type**：micro（state machine + 跨 domain 介面）。
- **allowed files**：
  - `src/domain/demand-response/state.ts`（新增 `validateDemandResponseSelectTransition`／`validateDemandResponseDeclineTransition`，修改既有檔案，僅新增函式）
  - `src/domain/demand-request/service.ts` 或新增 `src/domain/demand-request/matching-service.ts`（新增 `markDemandRequestAsMatchedIfPublished(tx, demandRequestId)`，簽章比照 teacher-demand-pool-response-plan D11 選項 A 的既定要求：接受外部 `Prisma.TransactionClient`，不自行開啟 transaction）
- **forbidden files / areas**：`prisma/**`（本輪不需要 schema 變更）、`src/app/**`、`tests/**`、`src/domain/demand-request/` 內既有函式的簽章與行為（只能新增，不能修改）。
- **acceptance criteria**：select transition 只允許 `submitted → selected`（D1=A）；decline transition 只允許 `submitted → declined`；`markDemandRequestAsMatchedIfPublished` 使用 `updateMany({where:{id,status:"published"}})` guard。**`count===0` 的處理契約（呼叫方 Slice 2 必須遵守，非本 slice 自行決定，但簽章需支援）**：`prisma.$transaction(async (tx) => {...})` 的 callback 只有在**丟出例外**時才會 rollback，單純 `return {ok:false, ...}` 會讓 callback 正常結束、transaction 照常 commit——因此 `markDemandRequestAsMatchedIfPublished` 在 `count===0` 時必須 `throw`（例如丟出一個帶錯誤代碼的自訂 Error 子類別），讓呼叫方在 `prisma.$transaction(...)` 外層用 `try/catch` 攔截、轉譯成 discriminated union 錯誤，藉此保證前面已在同一個 `tx` 內執行的 select/decline 寫入會隨這次拋錯一起 rollback，不會出現「response 已 selected/declined 但 demand 未 matched」的不一致（見第 4 節第 3 點的既有不變量）。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D1/D4 未拍板 → 停止。

### Slice 2 — Select service（原子 select + 連帶 decline + matched）

- **goal**：新增 `src/domain/demand-response/organizer-select-service.ts`，提供 `selectDemandResponse(demandResponseId)`（Organizer own-scoped）；並依 D5，把 `submitOwnDemandResponse` 改成先取 demand-level lock 再 insert，讓 submit 與 select 共用同一把鎖。**兩個函式都拆成「auth-resolving 外層 + 不依賴 request context 的 pure 內層」**，讓 Slice 4 的併發測試能在 Node 測試進程直接呼叫內層函式（見下方與 Slice 4 說明）。
- **slice type**：micro（core flow + 併發保護 + 跨 domain transaction + 可測試性）。
- **allowed files**：
  - `src/domain/demand-response/organizer-select-service.ts`（新增），export：
    - `selectDemandResponse(demandResponseId)`：`requireUser()` 解析目前使用者，查出這筆 response 所屬 demand 的 `organizerProfileId` 並確認等於自己，然後呼叫下面的內層函式（不帶 `hooks` 參數）。
  - `src/domain/demand-response/__internal__/select-and-submit-core.ts`（新增；`__internal__` 目錄命名是刻意的「genuinely restricted boundary」信號，見第 4 節第 8 點）：
    - `selectDemandResponseForOrganizer(organizerProfileId, demandResponseId, hooks?: { onBeforeLock?: () => void | Promise<void>; onLockAcquired?: () => void | Promise<void> })`：**不呼叫 `requireUser()`／不依賴 `next/headers`**，但**不代表信任呼叫方身分**——D5 的原子 UPDATE 的 `WHERE` 子句本身就同時驗證 `organizerProfileId` 擁有權（見下方 domain rules），非法或不屬於自己的 `organizerProfileId` 只會查不到列、回傳 not-found 語意。`hooks` **僅供 Slice 4 的鎖測試使用**：`onBeforeLock` 在**送出** D5 的 `SELECT ... FOR UPDATE` 陳述式**之前**呼叫並 `await`（讓測試能確認這次呼叫已經真的抵達鎖陳述式本身，而不是還卡在取得 DB connection 之類的更早階段）；`onLockAcquired` 在該陳述式**回傳、鎖已到手之後**呼叫並 `await`。正式路徑（`selectDemandResponse`）呼叫時不傳 `hooks`，兩個 await 在生產路徑上恆為 no-op。
    - `submitDemandResponseForTeacher(teacherProfileId, demandRequestId, input, hooks?: { onBeforeLock?: () => void | Promise<void>; onLockAcquired?: () => void | Promise<void> })`：**不呼叫 `requireApprovedTeacher()`**——approved-teacher 檢查是同一個原子 `WHERE EXISTS` 的一部分，不是呼叫方事先把關、這個函式盲目信任的東西：把現有 `submitOwnDemandResponse` 內單一 raw SQL statement 包進 `prisma.$transaction(async (tx) => {...})`，第一步 `await hooks?.onBeforeLock?.()` → 新增 `tx.$queryRaw\`SELECT "id" FROM "DemandRequest" WHERE "id" = ${demandRequestId} FOR UPDATE\`` → `await hooks?.onLockAcquired?.()`，第二步用 `tx.$queryRaw` 執行 INSERT，`WHERE EXISTS` guard 除了原有的「demand 狀態合法」，**必須新增**一個子句 `AND EXISTS (SELECT 1 FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} AND "status" = 'approved')`。這樣即使未來有其他程式碼直接呼叫這個 export（略過 `submitOwnDemandResponse` 外層），也無法讓非 approved teacher 的 id 成功插入 response——不是靠註解或呼叫慣例，是靠這個函式自己在 DB 層面拒絕。此舉同時比原本設計更安全：teacher 的 approved 狀態現在跟 demand 的 eligible 狀態一樣，是同一個原子語句檢查的，不再有「`requireApprovedTeacher()` 檢查完之後、INSERT 執行之前狀態被改掉」的 TOCTOU 縫隙。
  - `src/domain/demand-response/service.ts`（**僅限**）：`submitOwnDemandResponse(demandRequestId, input)` 改為 auth-resolving 外層：驗證 + `requireApprovedTeacher()` 解析 `teacherProfileId` 後，呼叫 `submitDemandResponseForTeacher`（不帶 `hooks`）。`requireApprovedTeacher()` 現在的角色是「產生清楚的『非 approved teacher』錯誤訊息、避免不必要的 DB 往返」，不再是唯一防線。對外行為、錯誤碼、回傳型別**完全不變**。`withdrawOwnDemandResponse`／`getOwnDemandResponseForDemand` 不得改動。
- **forbidden files / areas**：`src/domain/demand-response/organizer-read-service.ts`（既有唯讀邏輯不得修改）、`prisma/**`、`service.ts` 內除 `submitOwnDemandResponse` 以外的函式。
- **domain and permission rules**：
  - `selectDemandResponseForOrganizer` 整段包在 `prisma.$transaction(async (tx) => {...})`：(a) `await hooks?.onBeforeLock?.()` → 執行 D5 的 `SELECT ... FOR UPDATE` 鎖住 demand → `await hooks?.onLockAcquired?.()`；(b) D5 的原子 UPDATE 把該 response 轉 selected（`WHERE` 子句需同時涵蓋 `demandRequestId` 對應的 `organizerProfileId = $organizerProfileId`，不透過額外的預先 SELECT 判斷擁有權——避免另一個 TOCTOU 縫隙），0 列 → `throw`（帶錯誤代碼，供外層 catch 轉譯成 `response_not_selectable` 之類的錯誤，需能區分「不存在/非自己」與「已有別人 selected」兩種語意供 not-found semantics 使用）；(c) 若 (b) 成功，`updateMany` 把同 demand 其餘 `submitted` response 轉 `declined`；(d) 呼叫 `markDemandRequestAsMatchedIfPublished(tx, demandRequestId)`——依 Slice 1 的契約，這一步在 `count===0` 時會自己 `throw`，**這裡不得 catch 之後改成單純回傳 `{ok:false}`**，必須讓例外持續往外傳出 `prisma.$transaction` 的 callback 邊界，交易才會 rollback；`selectDemandResponseForOrganizer` 函式本體在 `prisma.$transaction(...)` 呼叫的**外層**用 `try/catch` 統一把 (b)/(d) 的 throw 轉譯成 discriminated union 錯誤回應。
  - 四步驟中任一步異常，整個 transaction rollback（(b) 或 (d) 的 throw 必須真的傳到 `$transaction` 外面才會觸發，不可在 tx 內部吞掉）。
- **acceptance criteria**：成功 select 後，目標 response 為 `selected`、其餘為 `declined`、`DemandRequest` 為 `matched`；併發兩個 select 請求只有一個成功，另一個確定性地收到「demand 已有別的 selected response」錯誤（非 deadlock/generic DB error）；submit 與 select 併發時，最終狀態不會出現「demand 已 matched 但存在孤兒 `submitted` response」；非 own demand 的 response 回 not-found 語意；對已有 selected response 的 demand 再次嘗試 select 被擋；`selectDemandResponse`／`submitOwnDemandResponse` 的既有對外行為（錯誤碼、回傳型別、not-found 語意）與抽出 pure 核心前完全一致；**直接以非 approved 的 `teacherProfileId` 呼叫 `submitDemandResponseForTeacher` 必須被拒絕（0 rows / 對應錯誤），即使繞過外層 `requireApprovedTeacher()`**；**直接以不屬於該 demand 的 `organizerProfileId` 呼叫 `selectDemandResponseForOrganizer` 必須回傳 not-found，不會誤選中別人 demand 底下的 response**。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D2/D3/D4/D5 未拍板 → 停止。

### Slice 3 — Organizer UI 整合（select 按鈕 + 二次確認）

- **goal**：在既有 `src/app/organizer/demands/[demandRequestId]/_components/ResponseList.tsx` 每張 response 卡片加上 select 表單（僅在 demand 尚無 selected response時顯示），並在 `page.tsx` 做最小必要的 import/資料傳遞修改。
- **slice type**：standard→micro（UI + server action，但 mutation 邏輯已在 domain）。
- **allowed files**：
  - `src/app/organizer/demands/[demandRequestId]/_components/ResponseList.tsx`（既有檔案，修改：加入 select 表單/二次確認）
  - `src/app/organizer/demands/[demandRequestId]/actions.ts`（新增檔案，`selectDemandResponseAction`）
  - `src/app/organizer/demands/[demandRequestId]/page.tsx`（既有檔案，僅新增 import 與 action 傳遞，不重寫既有邏輯）
- **forbidden files / areas**：`src/app/teacher/**`（D7：不修改，只驗證既有文案正確顯示）、`src/domain/**`（只 import）。
- **server action contract**（比照既有 `src/app/teacher/demands/[demandRequestId]/actions.ts` 的 `withdrawDemandResponseAction` pattern，不得發明新模式）：
  - 二次確認（`<details>` + 必勾 checkbox）**只是 UX 防誤觸**，不是 server 端的授權依據；`selectDemandResponseAction` 本身被呼叫、且 ownership 檢查通過，就是唯一的授權判斷——不需要、也不應該額外新增一個「confirmed=true」欄位讓 server 檢查（現有 withdraw action 就是這個模式：checkbox 只用 HTML `required` 擋 UI 誤觸，server 端不重覆驗證）。
  - action 成功或失敗後都必須 `revalidatePath(\`/organizer/demands/${demandRequestId}\`)` 並 `redirect` 回同一頁、把結果編碼進 query string（比照既有 `redirectWithFeedback(demandRequestId, "success" | "error", message)` 的做法，可直接複用同一個 helper 函式的寫法或抽到共用位置——但不強制抽共用模組，複製一份等價邏輯即可，避免跨 route boundary 的耦合）。
  - 失敗時（domain service 回傳 `ok:false`）：不得 throw，走 `error` feedback 分支，訊息用 `result.message`。
  - 頁面需依 query string 顯示對應的成功/錯誤 banner（比照既有 organizer demand detail 頁面若已有 `searchParams` 讀取 pattern；若目前沒有，需新增，比照 teacher 端頁面的既有做法）。
- **acceptance criteria**：Organizer 可對 `submitted` response 執行 select 並通過二次確認；select 成功後畫面清楚標示「已選定」與其餘「未獲選」，且顯示成功 feedback banner；select 失敗（例如併發已被搶先）時顯示清楚的錯誤 feedback banner，不留白畫面或 stale 資料；Teacher 端不需修改任何程式碼即可看到對應狀態（見 2.1 現況，本 slice 的 manual smoke 需驗證這一點）。
- **RWD/brand review**：依第 6/7 節。
- **stop conditions**：Slice 1/2 未合入、或 D6 未拍板 → 停止。

### Slice 4 — Tests（Playwright smoke）

- **goal**：新增 `tests/smoke/demand-response-selection.spec.ts`，覆蓋：Organizer 可 select 一位老師（UI 全流程，含開啟二次確認、勾選 checkbox）；select 後其餘 response 自動 declined；DemandRequest 轉 matched；Teacher 端正確看到 selected/declined 狀態；非 own demand 的 select 被擋（IDOR）；已有 selected response 的 demand 不可再 select；一個確定性證明 `FOR UPDATE` 鎖真的會序列化併發 transaction 的鎖原語測試；以及在此基礎上驗證業務邏輯正確接鎖的 select-vs-select、submit-vs-select 兩種併發案例。
- **slice type**：micro（測試，涉及 core flow + 併發驗證）。
- **allowed files**：`tests/smoke/demand-response-selection.spec.ts`（新增，可重用 `tests/smoke/_helpers/demand-response-fixtures.ts` 既有 helper，並 import Slice 2 的 `src/domain/demand-response/__internal__/select-and-submit-core.ts`）。
- **forbidden files / areas**：`src/**`、`prisma/**`、`package.json`、既有 spec 檔案（預設不改）。
- **UI happy-path 測試**：比照既有 `teacher-demand-response.spec.ts` 的 withdraw 測試手法——先點開二次確認的 `<details>`，勾選必勾 checkbox，再點確認按鈕，斷言成功 feedback banner 與最終畫面狀態。
- **併發測試手法（第三版，直接對production內層函式做確定性同步，不再用獨立的假鎖或機率性 `Promise.all`）**：
  - `selectDemandResponse`／`submitOwnDemandResponse`（auth-resolving 外層）依賴 `requireUser()`／`requireApprovedTeacher()`，這兩者經由 Auth.js 的 request-scoped `headers()`/`cookies()`（`next/headers`）解析，只能在真正的 Next.js request 生命週期內執行，不能在 Playwright test body 當一般 Node 函式呼叫。但 Slice 2 的 `__internal__/select-and-submit-core.ts` 匯出的 `selectDemandResponseForOrganizer`／`submitDemandResponseForTeacher` **不依賴 request context**，可以直接在 Playwright test body（跑在 Node）`import` 後呼叫，用已知的 fixture id（`createOrganizerProfileWithOrganization`／`createTeacherProfileWithSession` 回傳的 `organizerProfileId`／`teacherProfileId`，兩者都是純 `prisma` 建立，不需要活的 HTTP session）直接觸發——**且直接呼叫的正是正式流程實際執行的同一份程式碼**，不是另外重寫一份等價邏輯，這樣測試才真的驗證到 production 行為，而不是驗證一個平行的替身。
  - 光靠 `Promise.all` 讓兩次呼叫「幾乎同時」送出，仍然只是**機率上很可能重疊**，不是保證。改用 Slice 2 設計的 `hooks.onLockAcquired` 同步點，把「第一個呼叫已經拿到鎖、第二個呼叫確實被擋住」變成與時序無關的確定性斷言：
    ```ts
    const releaseFirst = createDeferred<void>();
    let firstAcquired = false;
    let secondReachedLockStatement = false; // 證明第二個呼叫真的送出了 FOR UPDATE，不是卡在更早的階段（例如等 DB connection）
    let secondAcquired = false;

    // 第一個呼叫：真正的 selectDemandResponseForOrganizer，只是在拿到鎖後刻意暫停，
    // 直到測試明確放行——這就是在測 production 程式碼本身，不是複製一份查詢。
    const firstCall = selectDemandResponseForOrganizer(organizerProfileId, responseIdA, {
      onLockAcquired: async () => {
        firstAcquired = true;
        await releaseFirst.promise;
      },
    });

    await waitUntil(() => firstAcquired); // 確定第一個呼叫已經真的持有鎖

    // 第二個呼叫：同樣是 production 程式碼，鎖住同一個 demand。
    const secondCall = selectDemandResponseForOrganizer(organizerProfileId, responseIdB, {
      onBeforeLock: () => { secondReachedLockStatement = true; },
      onLockAcquired: () => { secondAcquired = true; },
    });

    await waitUntil(() => secondReachedLockStatement); // 先確定第二個呼叫真的送出了 FOR UPDATE 陳述式本身

    // 這時再給一段合理時間（如 300ms），斷言它「還沒」進入 onLockAcquired——
    // 因為已經先證明它送出了同一句 FOR UPDATE，這裡測到的延遲只可能是
    // 被 Postgres 的列鎖真正擋住，不會是「還在等 connection pool」之類的偽陽性。
    await sleep(300);
    expect(secondAcquired).toBe(false);

    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(secondAcquired).toBe(true);
    ```
    `submit-vs-select` 案例用同一個 `hooks.onLockAcquired` 手法，一邊是 `selectDemandResponseForOrganizer(...)`、另一邊是 `submitDemandResponseForTeacher(...)`，證明兩個不同函式真的共用同一把鎖（互相阻塞），不只是各自內部序列化。
  - 業務不變量斷言（在上面的鎖已被確定性證明真的擋住之後，檢查最終結果是否正確）：
    - **select-vs-select**：`firstResult`／`secondResult` 恰好一個 `ok:true`、一個 `ok:false`（`ok:false` 的錯誤語意明確是「demand 已有別的 selected response」，不是 generic DB error/deadlock）；查 DB 確認該 demand 底下 `status='selected'` 恰好 1 筆、未選中那筆為 `declined`；`DemandRequest.status` 為 `matched`。
    - **submit-vs-select**：不斷言哪個先完成（兩種順序都是合法結果，見 D5 說明），只斷言與順序無關的不變量：測試結束後查 DB，該 demand 底下**不存在**任何 `status='submitted'` 的 response（要嘛 select 贏、submit 因 `demand_not_eligible` 被擋而 0 筆插入，要嘛 submit 贏、其插入的那筆被 select 的 decline-others 步驟一併轉成 `declined`）；`DemandRequest.status` 為 `matched`。
  - 這些併發案例**不經過 UI／HTTP／`requireUser()`**，直接驗證 `__internal__` 內層函式；`selectDemandResponse`／`submitOwnDemandResponse` 這兩個 auth 外層的行為（含 ownership／approved-teacher 檢查）由其他非併發案例（IDOR、own-scope 等）透過 UI 覆蓋，兩邊合起來才是完整覆蓋。
- **acceptance criteria**：上述案例全數綠燈；既有 smoke 維持綠燈。
- **stop conditions**：D11 未定、或 Slice 1–3 未合入 → 停止。

### Slice 5 — Docs 對齊

- **goal**：把 D1–D11 裁定同步進所有現存的 domain source-of-truth 文件，避免任何一份文件與新接線的 transition 矛盾。
- **slice type**：batch（docs-only）。
- **allowed files**：
  - `docs/domain/state-machines.md`：
    - DemandRequest 區塊（既有第 51–64 行的「V1 落地範圍」小節）：把 `matched` 從「保留但不接線」的清單移除，新增一條說明「`published → matched`（跳過 `teacher_responded`，因為 `teacher_responded` 依 teacher-demand-pool-response-plan D11 選擇動態推導、不 persist，本輪沿用同一決定不變更）」。
    - DemandResponse 區塊（第 68–89 行）：仿照 DemandRequest 既有小節的格式，新增一段「V1 落地範圍（`demand-response-selection-and-matching` 已確認）」，列出本輪＋前一輪合計已接線的完整子集：`(none)→submitted`、`submitted→withdrawn`（已出貨）、`submitted→selected`、`submitted→declined`（本輪新增，D1=A 故不經過 `shortlisted`），並註明 `shortlisted`/`expired` enum 值保留但無 transition，`Select` 只有 Organizer（own-scoped），無 Admin（D2）。
  - `docs/domain/state-transition-details.md`：
    - DemandRequest「V1 policy notes」小節（既有第 86–100 行）：新增一列到既有 V1 子集表格（或新增一段落）：`published` → `matched`，Actor 為 Organizer，前置條件「demand 尚無 selected response，且 Organizer 選定一筆屬於自己 demand 的 submitted response」，後置效果「該 response 轉 selected、其餘 submitted 轉 declined」；並明確註記**不是**原表第 80 行的 `teacher_responded → matched`（`teacher_responded` 本輪仍不接線，原因同上）。
    - DemandResponse 區塊（既有第 118–144 行）：仿照 DemandRequest 的雙表格格式（完整設計表格 + V1 子集表格），新增 V1 子集：`submitted → selected`（Actor: Organizer own-scoped，前置：demand 尚無 selected response）、`submitted → declined`（Actor: System，觸發者是同 transaction 內的 select，非 Organizer 手動 decline，見 D3）；並註明 `submitted → shortlisted` 本輪不接線（D1=A）。
  - `docs/domain/permissions-matrix.md`：在既有 DemandResponse 表格（第 112–125 行）下方，比照第 110 行「Cancel demand」的既有註記慣例（保留完整未來設計表格，用文字註記 V1 實際落地範圍，不刪改表格本身），新增一段：「V1 落地範圍（`demand-response-selection-and-matching` 已確認）：`Select response`／`Decline response` 僅 Organizer own-scoped 可執行，Admin **不**介入（D2，上表 Admin 欄位為完整設計，V1 未開放）；`Shortlist response` 本輪不實作（D1），保留於表中作為未來 slice 參考。」
  - `docs/domain/marketplace-rules.md`：第 21 行「Organizer/admin can select one teacher response.」改為「Organizer can select one teacher response in V1 (Admin does not participate in matching decisions; see `permissions-matrix.md` V1 落地範圍 note).」。
  - `docs/specs/demand-response-and-matching-spec.md`：更新既有「落地現況」段落，把 User Flow 第 6–8 步（shortlist 若跳過則不提、select、matched）從「尚未落地」移到「已出貨」，明確標註 shortlist 因 D1 不落地。
  - `docs/product/route-map.md`：若 Slice 3 的 manual smoke 發現既有描述用詞需要微調才補動，非必要不改。
- **forbidden files / areas**：`docs/domain/data-model.md`、`docs/domain/permissions.md`、`docs/domain/roles.md`（本輪未涉及新增欄位或角色，不需要改動；若施工中發現需要改，屬於 stop condition，需回頭確認）。
- **acceptance criteria**：上述每份文件改動後，通讀不再出現與本輪已接線 transition 矛盾的敘述（尤其是「`teacher_responded → matched`」與「Admin 可 select」這兩處已知的既有錯誤描述必須修正）。
- **stop conditions**：D1–D11 未全數拍板 → 停止。

### Slice 順序

```
Slice 1（domain state + 跨 domain helper）
   ↓
Slice 2（select service，原子 transaction）
   ↓
Slice 3（Organizer UI）
   ↓
Slice 4（tests）
   ↓
Slice 5（docs，可與 Slice 4 平行）
```

---

## 9. Verification Planning

- `tsc`/ESLint：所有含 `src/**` 變更的 slice。
- `next build`：Slice 3 之後。
- `npm run test:smoke`：Slice 4 集中執行。
- **必含負向 security cases**：跨 organizer IDOR（B 不能 select A 的 demand 的 response）、併發 select race、對非 submitted response 的 select 被擋、對已 matched demand 的重複 select 被擋。
- **本 planning-only 任務不要求實際執行**；上述為施工時的驗證計畫。

---

## 10. Rollback 總則

- 全部為新增檔案 + 對既有兩個檔案（`ResponseList.tsx`、`organizer/demands/[demandRequestId]/page.tsx`）的最小新增修改，rollback 只需刪除新檔案並還原這兩個檔案的新增部分。
- 無 schema/migration 變更，無資料遺失風險。
- 依相依反序 rollback：Slice 5 → 4 → 3 → 2 → 1。

---

## 11. Planning-only self review

- **變更檔案**：新增本檔 `docs/superpowers/plans/2026-07-25-demand-response-selection-and-matching-plan.md`；修改 `docs/specs/demand-response-and-matching-spec.md`（新增落地現況段落，已於本輪撰寫前完成，非本 plan 文件本身的一部分但同一輪產出）。
- **V1 scope**：符合；明確排除 ClassSession/Enrollment/Notification/AI matching/競標/付款。
- **一致性**：對齊既有 role model、permissions、state machines、data model、route map。
- **安全**：own-scoped、IDOR not-found 語意、併發保護（原子 SQL + transaction）、DTO 最小化，皆列入相關 slice。
- **RWD/brand**：已於第 6、7 節規劃。
- **產品主人決策**：D1–D11 為必要 gate，未全部拍板前不得產出可執行 Builder prompt。本 plan 未附任何可直接施工的 Builder prompt。
- **未修改無關檔案**：無（`docs/specs/demand-response-and-matching-spec.md` 的更新已於上一輪回報）。

<!-- codex-peer-reviewed: 2026-07-25T14:37:39Z rounds=7 verdict=approved -->
