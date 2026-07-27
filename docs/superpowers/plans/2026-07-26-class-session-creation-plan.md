# Class Session Creation — Implementation Plan

> 狀態：**planning-only**。本輪只產出可逐 slice 執行的規劃，不實作任何 schema / 程式 / 測試。
> 目標 user flow：Organizer 在自己已 `matched` 的 demand detail（`/organizer/demands/[demandRequestId]`）看到「建立課程」入口 → 填寫 startAt/endAt/location/capacity/isPublic 等必要欄位（title/serviceType 已從 demand 帶入可編輯）→ 送出後原子建立 `ClassSession`（`draft` 狀態）並把 `DemandRequest` 轉為 `converted_to_class` → Organizer 在新的 `/organizer/classes` 列表與 `/organizer/classes/[classSessionId]` 詳情頁查看 → Teacher 在新的 `/teacher/classes` 唯讀查看自己授課的 class session。
> 本文件為 **High-risk Planning Gate** 產物（新增 model／新 state machine／新路由）。**在第 5 節產品主人決策（D1–D15）全部拍板前，不得產出可直接執行的 Builder implementation prompt。**

---

## 0. 如何閱讀本 plan（給零背景 Builder）

- 本 plan 目標是自足：Builder 只需讀「本檔 + 目前 repo」即可理解各 slice 設計。
- 第 2 節「現況核對」的敘述以 primary source 為準；Builder 施工前**必須自行再核對一次實際檔案**。
- 「allowed files」為白名單：未列出的檔案一律 forbidden。
- 本 plan 明確**不含** Enrollment、`open_for_enrollment`/`confirmed`/`completed`/`cancelled` 狀態轉換、`/admin/classes`、公開 `/classes` 列表——這些是下一份（或多份）獨立 plan 的範圍（見第 3 節）。

---

## 1. 背景與範圍

### 1.1 產品問題

`docs/superpowers/plans/2026-07-25-demand-response-selection-and-matching-plan.md`（已出貨）完成了 Organizer 選定老師、`DemandRequest` 進入 `matched` 這一步，但 `docs/specs/class-session-and-enrollment-spec.md` 描述的完整 user flow 第 2 步——「Organizer 或 Admin 從 matched DemandRequest 的 selected DemandResponse 建立 ClassSession」——完全沒有落地：`prisma/schema.prisma` 沒有 `ClassSession` model，`matched` 的 demand 永遠卡在 `matched`，marketplace 無法真正形成一堂課。本輪補上「建立」這一步。

### 1.2 風險等級

依 `docs/harness/risk-based-workflow.md`／`mvp-slicing.md`：新增 **全新 model（`ClassSession`）、全新 state machine、新增 migration、新增多個路由**，屬 **High-risk / Heavy**，先 Planning-only。

Risk flags：`PERMISSION_RISK`、`STATE_MACHINE_RISK`、`SCOPE_DRIFT_RISK`、`BRAND_RISK`、`DATA_INTEGRITY_RISK`（新 migration）。

### 1.3 命名澄清

「Class Session Creation」= 建立＋唯讀查看。**不含**開放報名（`open_for_enrollment`）、確認（`confirmed`）、完課（`completed`）、取消（`cancelled`）等後續狀態轉換，也不含 Enrollment。原因見第 3.2 節。

---

## 2. 現況核對（Repo Reality Audit；2026-07-26 working tree = committed `main` @ `168ee6f`）

### 2.1 已 committed 的基礎（可直接依賴）

- `prisma/schema.prisma`：**沒有 `ClassSession` model，沒有 `ClassSessionStatus` enum**。`DemandRequestStatus` enum 已含 `converted_to_class`（保留值，目前無 transition 指向它）。**本輪需要新的 migration**（新增 model + enum + FK），這與前兩輪（純接線既有 enum 值）不同。
- `src/domain/demand-request/service.ts`：`getOwnDemandRequestDetail(demandRequestId)` 回傳 `DemandRequestSnapshot`，含 `title`/`serviceType`/`status`/`organizerProfileId`/`organizationId` 等欄位，**沒有** selected response 資訊。
- `src/domain/demand-request/matching-service.ts`：`markDemandRequestAsMatchedIfPublished(tx, demandRequestId)`——D4（上一輪）的 transaction-aware helper 範例，**本輪的 `markDemandRequestAsConvertedToClassIfMatched(tx, demandRequestId)` 需照同一個 pattern 新增**（同檔案新增 export，不修改既有函式）。
- `src/domain/demand-response/organizer-read-service.ts`：`listResponsesForOwnDemandRequest(demandRequestId)` 回傳 `OrganizerFacingResponse[]`，**只有** `teacherProfile.{displayName,bio,teachingStyle,experienceYears,specialties,serviceAreas,teachingFormats,profilePhotoUrl}`（`teacher-demand-pool-response-plan` D13 的既有 allowlist，與本文件自己的 D13 無關——本文件的 D13 是時區處理，見第 5 節），**沒有 `teacherProfileId` 本身**、也沒有 `TeacherProfile.userId`。本輪建立 ClassSession 需要真正的 `teacherProfileId` 寫入外鍵，**這個既有唯讀 service 不夠用，需要新增一個回傳 `teacherProfileId` 的函式**（見 Slice 2）。
- `src/domain/demand-request/validation.ts`：`EXPECTED_PARTICIPANTS_MIN=1`／`MAX=500`、`CLASS_LENGTH_MINUTES_MIN=30`／`MAX=240` 是既有 V1 定案數值，本輪 `capacity` 沿用 1–500 這組先例（D6）。
- `src/domain/demand-request/service-types.ts`：`SERVICE_TYPES` 是**純字串**受控清單，`DemandRequest.serviceType` 是 `String?`，**不是** FK 到任何 `ServiceType` model（該 model 不存在）。`docs/domain/data-model.md` 對 `ClassSession` 的欄位草稿寫的是 `serviceTypeId`，與現況不符（見 D4）。
- `docs/product/route-map.md`：已列出 `/organizer/classes`（查看自己需求形成的 class sessions）、`/teacher/classes`（查看自己的 class sessions）、`/classes`／`/classes/[classSessionId]`（公開列表/詳情，明確標記「optional/later，不作為 V1 必做」）、`/admin/classes`（管理），但**這些路由目前完全不存在**於 `src/app/`。
- `src/app/organizer/demands/[demandRequestId]/page.tsx`：既有 Organizer demand detail 頁面，`demandRequest.status === "matched"` 時目前**沒有任何後續動作入口**。本輪需要在這個既有頁面上加「建立課程」的最小整合（比照前兩輪「僅新增 import + 一個 JSX 區塊」的既定紀律）。

### 2.2 上游依賴狀態

無平行未拍板的 draft plan。本輪建立在已 committed 的 `demand-response-selection-and-matching`（`matched` 狀態）之上。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- **Enrollment**：`docs/specs/class-session-and-enrollment-spec.md` User Flow 第 5–9 步（Member 報名、capacity 檢查、consent），完全不在本輪範圍——沒有 Enrollment 就不需要 `open_for_enrollment`，見下一點。
- **`draft` 之後的狀態轉換**（`pending_confirmation`／`open_for_enrollment`／`confirmed`／`completed`／`cancelled`）：`open_for_enrollment` 的存在意義是「讓 Member 可以報名」，但 Enrollment 尚未建立，本輪提前實作這些轉換沒有實質使用者價值，只會增加無法測試（因為沒有下游功能可驗證）的程式碼。`ClassSessionStatus` enum 完整 6 值都建，但只接線 `(none)→draft`。
- **`/admin/classes`**：Admin 目前的職責僅止於 demand publish/reject（見 `demand-response-selection-and-matching` D2 的同一先例：本輪 Admin 也不參與 class session 建立），管理介面留待未來。
- **`/classes`、`/classes/[classSessionId]` 公開路由**：`route-map.md` 已明確標記為「optional/later，不作為 V1 必做」，本輪不做。
- **Teacher schedule conflict 檢查**：`state-transition-details.md` 的完整設計禁止條件提到「ClassSession 必須檢查 teacher schedule conflict」，但目前沒有 `TeacherAvailability` 或任何排程資料可供檢查，本輪不做（見 D8）。

---

## 3. Scope Boundary

### 3.1 本輪 in-scope

- 新增 `ClassSession` model + `ClassSessionStatus` enum（完整 6 值，只接線 `(none)→draft`）+ migration。
- Organizer 從自己 `matched` 的 `DemandRequest` 建立 `ClassSession`（own-scoped，D1）。
- 建立時同一 transaction 內把 `DemandRequest.status` 轉為 `converted_to_class`（D2，one-shot 全量建立）。
- Organizer 唯讀查看自己的 class sessions 列表 + 詳情（`/organizer/classes`、`/organizer/classes/[classSessionId]`）。
- Teacher 唯讀查看自己授課的 class sessions 列表（`/teacher/classes`）。
- 安全、RWD、品牌、Playwright smoke 規劃。

### 3.2 本輪明確不包含

- Enrollment（下一份獨立 plan）。
- `draft` 之後的所有 `ClassSession` 狀態轉換（`pending_confirmation`/`open_for_enrollment`/`confirmed`/`completed`/`cancelled`）——enum 值保留但不接線（D9）。
- `/admin/classes`（D10）。
- `/classes`、`/classes/[classSessionId]` 公開路由（D11）。
- Teacher schedule conflict 檢查（D8）。
- 編輯已建立的 `ClassSession`（`draft` 之後不可修改，見 D2 說明；若填錯，V1 無 UI 復原路徑）。
- Notification/email（D12，延續本專案一貫分期）。

---

## 4. 安全與權限設計

1. **建立一律 own-scoped**：Organizer 只能對「自己 `organizerProfile.userId` 對應」的 `matched` `DemandRequest` 建立 ClassSession，`organizerProfileId`/`organizationId`/`teacherProfileId` 一律從伺服器端查詢解析，不信任 client 傳入的任何 id 欄位。
2. **併發保護**：建立必須是原子操作，同時滿足「demand 當下仍是 `matched`」與「這個 demand 尚無 ClassSession」，並在同一 transaction 內把 `DemandRequest.status` 轉 `converted_to_class`。比照既有 `markDemandRequestAsMatchedIfPublished` 的 `updateMany({where:{id,status:"matched"}})` guard + throw-on-zero-count 契約（見 Slice 1）。`ClassSession.demandRequestId` 加 `@unique`，DB 層面雙重保險「一個 demand 只能有一個 class session」。
3. **一次寫入兩張表（ClassSession insert + DemandRequest.converted_to_class）必須是同一個 transaction**，任一步失敗全部 rollback。
4. **對 unauthorized / cross-owner resource 優先使用 not-found semantics**，沿用既有慣例。
5. **Teacher 端唯讀，不得有任何寫入能力**：`/teacher/classes` 只能查看自己 `teacherProfileId` 對應的 class sessions，不提供編輯/取消等動作。
6. **DTO 資料最小化**：Teacher 查看 class session 列表時，Organizer/Organization 的聯絡資訊揭露範圍比照 `teacher-demand-pool-response-plan` D13 既有 allowlist 精神（不外洩 `Organization.contactEmail`/`contactPhone` 給 Teacher；Teacher 已經是「被選中執行這堂課的老師」，可以看到 Organization 名稱與 class session 本身欄位，但聯絡窗口細節留待未來雙方都需要時再開放）。
7. **錯誤訊息不得洩漏內部細節**：中文溫和訊息，discriminated union result。

---

## 5. 產品主人決策 Gate（D1–D15）

### D1 — 誰可以建立 ClassSession？

- **選項 A（推薦）**：僅 **Organizer**（own-scoped）。理由與 `demand-response-selection-and-matching` D2 相同：`/admin/demands` 目前只做 publish/reject，從未涉入 matching／class 形成決策，V1 保持 Admin 職責單純。`class-session-and-enrollment-spec.md` 原文寫「Organizer 或 Admin」，但目前完全沒有 Admin 介入 demand/response 生命週期實際動作的先例。
- **選項 B**：Organizer 或 Admin 皆可。
  - 缺點：需要在 `/admin/demands` 或新的 `/admin/classes` 新增一個目前不存在的建立介面，擴大本輪範圍。
- **推薦：A**。

### D2 — 建立模式：一次到位 vs. 草稿分段？

- **選項 A（推薦）**：**一次到位**。Organizer 在單一表單填齊全部必要欄位（`title`/`serviceType`/`startAt`/`endAt`/`location`/`capacity`/`isPublic`），伺服器端全部驗證通過後，**同一 transaction** 內原子建立 `ClassSession`（`status="draft"`）並把 `DemandRequest.status` 轉 `converted_to_class`。之後**不提供編輯**（見 3.2）。
  - 優點：不需要額外的「編輯草稿」mutation 與權限設計，foundation 最小；`DemandRequest` 轉 `converted_to_class` 的時機明確（欄位一定完整才會發生），不會出現「demand 已轉換但 class session 資料殘缺」的中間態。
- **選項 B**：先建立殘缺的 `draft`（比照 `DemandRequest` 的 draft/submit 兩階段），之後再編輯補齊，`DemandRequest` 轉換時機另外決定。
  - 缺點：需要額外一組「編輯」mutation、額外的「demand 何時真正轉換」決策，且 `permissions-matrix.md` 雖列了「Edit draft class session」，但那是完整未來設計，不是本輪必要範圍。
- **推薦：A**。`ClassSession.status` 建立後恆為 `draft`（因為本輪不接線任何後續 transition），這裡的 `draft` 語意是「已建立、尚未開放報名」，不是「資料不完整」。

### D3 — 表單哪些欄位自動帶入、哪些必須手動輸入？

- **推薦**：
  - 自動帶入且**不可編輯**（伺服器端解析，不信任 client）：`teacherProfileId`（來自 demand 的 selected `DemandResponse`）、`organizerProfileId`、`organizationId`（來自 demand 本身）、`demandRequestId`。
  - 自動帶入且**可編輯**（pre-fill 但送出時仍走完整驗證，且兩者皆為**必填**——本輪是 D2 的一次到位建立，沒有「先存不完整草稿」的中間態，`title`/`serviceType` 空白必須擋在驗證層，不能因為是「帶入值」就假設一定有值）：`title`（預設帶入 `demandRequest.title`；`DemandRequest` 送出審核時已強制 `title` 非空，見既有 `validateDemandRequestSubmit`，故 pre-fill 值理論上必為非空，但驗證仍獨立檢查，不依賴這個假設）、`serviceType`（預設帶入 `demandRequest.serviceType`；同理 `DemandRequest` 送出審核時已強制 `serviceType` 非空且落在 `SERVICE_TYPES` 受控清單內，見既有 `validateDemandRequestSubmit`，故 `matched` demand 保證有值，但 ClassSession 自己的驗證仍必須獨立要求非空+受控清單，不能因為「demand 端已經驗證過」就在 class session 這端省略，畢竟欄位在 UI 上可編輯，Organizer 可能把它清空，見 D4）。
  - **必須手動輸入**（`DemandRequest` 只有偏好欄位如 `preferredStartDate`/`preferredTimeSlots`/`preferredAreas`/`expectedParticipants`，不是精確承諾，不能直接當作 class session 的正式欄位）：`startAt`、`endAt`、`location`、`capacity`、`isPublic`。
  - **必須手動輸入且為選填**：`description`（`docs/domain/data-model.md` 的 `ClassSession` 欄位草稿與 `docs/product/form-field-spec.md` 的「Class Session Form」都已列出這個欄位，標記「建議」而非必填；本 plan 前一版遺漏了這個欄位，現在補上，見 Slice 1/2/3）。`DemandRequest` 沒有對應的「課程說明」欄位可以 pre-fill（`DemandRequest.description` 語意是「需求說明」，面向找老師的階段，與「這堂課的公開說明文字」語意不同，不适合直接帶入），故此欄位不 pre-fill，Organizer 若不填則存 `null`。

### D4 — `serviceType` 欄位型別？

- **選項 A（推薦）**：**Prisma 欄位型別**沿用 `serviceType: String?`（比照 `DemandRequest.serviceType` 的既有 schema pattern，nullable 是 schema 層級的彈性，不代表應用層允許空值），但**應用層驗證要求必填**：`createOwnClassSession` 的驗證與 `DemandRequest` 送出審核時的 `validateDemandRequestSubmit` 用同一套規則——`isBlank` 檢查 + `isValidServiceType` 受控清單檢查，兩者都不通過就擋在驗證層，不允許送出空白或不在清單內的值（見 D3 的必填說明）。這與 `DemandRequest.serviceType` 本身「schema nullable、`draft` 狀態允許空、`submit` 時才強制必填」的既有落差是同一種設計，不是新發明。
- **選項 B**：照 `docs/domain/data-model.md` 草稿新增 `serviceTypeId` FK，需要先新增一個 `ServiceType` model。
  - 缺點：`ServiceType` model 不存在，`DemandRequest` 從未走過正規化路線，本輪臨時新增一個新 model 只服務這一個欄位，範圍外擴且與既有慣例不一致。
- **推薦：A**。本輪同步修正 `docs/domain/data-model.md` 的欄位名稱（`serviceTypeId` → `serviceType`），見 Slice 5。

### D5 — `capacity` 數值範圍？

- **推薦**：`1–500`，沿用 `EXPECTED_PARTICIPANTS_MIN`/`MAX` 既有先例（`src/domain/demand-request/validation.ts`）。不额外參照 `demandRequest.expectedParticipants` 做交叉驗證（避免過度設計；Organizer 可能因場地考量調整實際名額）。

### D6 — `startAt`/`endAt` 驗證？

- **推薦**：`endAt` 必須晚於 `startAt`；`startAt` 必須晚於「現在」（不可建立過去時間的課程，伺服器端以送出當下的 `new Date()` 比較）；不設上限（允許遠期排課）。不做時長（`endAt - startAt`）的最小/最大值檢查（V1 簡化，避免過度設計；`classLengthMinutes` 是 demand 端的偏好欄位，不強制與 class session 實際時長一致）。

### D7 — `location` 欄位型別？

- **推薦**：`String`，純文字（比照 `DemandRequest.preferredAreas` 是自由文字陣列的精神，但 class session 的地點是單一精確地點，不是清單），必填、trim 後 1–200 字。不做地圖/地理編碼整合（V1 簡化）。

### D8 — Teacher schedule conflict 檢查？

- **推薦：不做**。沒有 `TeacherAvailability` 或既有排程資料可供檢查；`state-transition-details.md` 的這條禁止條件屬於完整未來設計，本輪不接線（比照本專案「完整 enum／規則保留，最小接線」的一貫做法，於 Slice 5 註記）。

### D9 — `ClassSessionStatus` 本輪接線範圍？

- **推薦**：只接線 `(none) → draft`。`pending_confirmation`/`open_for_enrollment`/`confirmed`/`completed`/`cancelled` enum 值保留但無 transition，理由見第 2.3／3.2 節（`open_for_enrollment` 沒有 Enrollment 可用，提前做沒有實質使用者價值也無法測試）。

### D10 — `/admin/classes` 是否納入本輪？

- **推薦：不納入**。同 D1 理由，Admin 本輪不參與 class session 生命週期。

### D11 — 公開 `/classes`、`/classes/[classSessionId]` 是否納入本輪？

- **推薦：不納入**。`route-map.md` 已標記 optional/later；且本輪 `isPublic` 欄位只是資料欄位，沒有下游公開頁面消費它也沒有實質意義驗證，故 D3 的表單仍收集 `isPublic`（供未來使用、避免日後再補欄位遷移），但預設值為 `false`，且本輪不建立任何依賴它的公開路由。

### D12 — Notification／測試策略？

- **Notification 推薦：延後**，對齊本專案一貫分期（D10 系列先例）。
- **測試策略推薦：只用既有 Playwright smoke**，不引入 Vitest、不改 `package.json`。

### D13 — `startAt`/`endAt` 的時區處理？

- **問題**：表單用 `<input type="datetime-local">`，其值（例如 `"2026-08-15T14:00"`）**不含時區資訊**。若伺服器直接用 `new Date(value)` 解析，JS 會用**執行環境當下的系統時區**判讀這個字串——本機開發環境（多半是 `Asia/Taipei`，UTC+8）與正式環境（常見雲端預設 `UTC`）解析結果會相差 8 小時，造成「Organizer 填 14:00，實際存的是 22:00」這種使用者看不出來、卻會讓老師團主約錯時間的嚴重 bug。
- **推薦**：本產品目前只服務台灣單一地區（既有 `serviceAreas` 範例皆為台灣城市），不需要引入完整時區函式庫或使用者時區偏好設定。採用**固定 `Asia/Taipei`（UTC+8，全年無日光節約時間調整）偏移量**：
  - **解析（存入）**：伺服器收到 `datetime-local` 字串後，明確附加 `+08:00` 偏移量再建構 `Date`（例如 `new Date(\`${value}:00+08:00\`)`），使其成為與伺服器執行時區無關、固定對應 UTC 的正確時間點，再交給 Prisma 存成 `DateTime`（Postgres `timestamp`，底層以 UTC 儲存）。
  - **不存在的日期會被 JS `Date` 靜默捲動、必須額外擋下**：`new Date("2026-02-31T14:00:00+08:00")` 不會拋錯，會被 JS 靜默正規化成 3 月的某一天（2 月沒有 31 號）。`parseTaipeiDatetimeLocal` **不能只做字串拼接再交給 `new Date()`**，必須額外做「往返校驗」：用正規表示式先驗證輸入格式是 `YYYY-MM-DDTHH:mm`（拆出年/月/日/時/分），建構 `Date` 後，再用 `Intl.DateTimeFormat` 以 `timeZone: "Asia/Taipei"` 把這個 `Date` 格式化回年/月/日/時/分，逐欄位比對是否與原始輸入完全一致——不一致（例如 31 號被搬到 3 月）就視為解析失敗，回傳 `null`，呼叫方（`validation.ts`）將其視為驗證錯誤，不得讓這種輸入靜默存成一個「看起來合法但其實已經被搬移過」的日期。
  - **顯示（讀出）**：所有顯示 `startAt`/`endAt` 的地方一律使用 `Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", ... })` 格式化，不依賴伺服器或瀏覽器當地時區的預設行為。
  - **測試要求**：Slice 5 的 Playwright 測試需驗證這個轉換與伺服器實際時區設定無關（例如斷言「送出 `14:00` 後，讀回並用 `Asia/Taipei` 格式化顯示仍是 `14:00`」），確保即使 CI／正式環境是 `TZ=UTC` 也不會退化成原本的 bug；另外需要一個案例斷言「送出 `2026-02-31T14:00`（不存在的日期）被驗證層拒絕，不會被靜默存成 3 月的日期」。
  - 此為新增的共用 helper（`parseTaipeiDatetimeLocal`／`formatTaipeiDatetime`，放在 `src/domain/class-session/` 內，見 Slice 2/3），不影響既有 `preferredStartDate`（純日期、無時分，既有的鬆散處理不受本次影響，不在本輪範圍內回頭修正）。

### D14 — Class detail 需要顯示「程度」（`targetLevel`），ClassSession 要不要新增對應欄位？

- **問題**：`class-session-and-enrollment-spec.md` UI Requirements 明確要求「Class detail 要清楚呈現時間、地點、老師、課程類型、**程度**、名額」，但第 2 節的欄位草稿（`docs/domain/data-model.md`）與本 plan 原先的 D3/Slice 1/Slice 2 欄位清單都沒有涵蓋「程度」。
- **選項 A（推薦）**：**不新增欄位**，透過既有的 `demandRequestId` 關聯，在讀取層（Slice 2 的 `read-service.ts`）用 Prisma `include`／`select` 帶出 `demandRequest.targetLevel` 一併回傳，UI 顯示時直接用這個衍生值。
  - 優點：`DemandRequest.targetLevel` 在建立當下就已經是這堂課實際鎖定的程度（selected response 來自這個 demand），不需要重複詢問 Organizer 或新增欄位／migration；`ClassSession` 與其來源 `DemandRequest` 的程度永遠一致，不會有兩份資料不同步的風險。
- **選項 B**：`ClassSession` 新增 `targetLevel` 欄位，建立表單另外收集（可能與 demand 不同，例如 Organizer 事後調整）。
  - 缺點：多一個 migration 欄位與表單輸入，且「class session 的程度可能跟原始 demand 不同」目前沒有產品需求支持，屬於過度設計。
- **推薦：A**。若未來確定 class session 的程度需要獨立於 demand 調整，可另案新增欄位。

### D15 — `/teacher/classes` 是否要求 `TeacherProfile.status === "approved"`？

- **問題**：既有 `requireApprovedTeacher()` 是「瀏覽新 demand」這種**新機會**的 eligibility gate（見 `capability.ts` 既有註解），但 `/teacher/classes` 顯示的是**已經存在的、已經指派給這位老師的承諾**（class session 建立當下，這位老師必然是 `approved`，否則不可能被 select），語意上與「查看自己既有 response」（既有 D12：suspended teacher 仍可讀，但不可 withdraw）更接近，而不是「申請新機會」。
- **選項 A（推薦）**：`listOwnClassSessionsForTeacher()` **不**透過 `requireApprovedTeacher()` 把關，只需要 `requireUser()` + 查出對應的 `TeacherProfile`（任何 status 皆可）。理由：老師之後若被 suspend，仍需要知道自己已承諾要教的課程時間地點（避免真的缺席造成營運事故），這是「唯讀查看已存在的承諾」，不是「新增能力」，直接比照 D12 的既有先例。
- **選項 B**：要求 `status === "approved"`，suspended teacher 完全看不到 `/teacher/classes`。
  - 缺點：若老師被 suspend 後看不到自己已排定的課程時間，反而增加「忘記/缺席已排定課程」的營運風險，與 suspend 機制本意（停止接新工作，不是抹除既有承諾）不符。
- **推薦：A**。Slice 5 需新增一個測試案例：suspended teacher 仍可在 `/teacher/classes` 看到自己既有的 class session（比照既有 `teacher-demand-response.spec.ts` 的 suspended-teacher 測試手法）。

> **Gate 狀態**：D1–D15 **尚未拍板** → High-risk Planning Gate **未解除**。在 PO 逐項裁定前，第 8 節各施工 slice **不得**產出可執行 Builder implementation prompt。

---

## 6. 品牌與 UX 規則

- 「建立課程」的表單語氣延續品牌「Gentle, Trustworthy」：說明文字強調「這會把需求轉為正式課程，之後無法修改」而非強制性的警告語氣。
- 建立後的 class session 詳情頁需清楚呈現時間、地點、老師、課程類型、**程度**（衍生自 demand，見 D14）、名額（比照 spec UI Requirements），避免密集表格，卡片式呈現。
- Teacher 端的 class session 列表沿用 `/teacher/demands` 既有的卡片視覺語言，不重新發明樣式系統。

## 7. RWD Requirements

- 建立表單（日期時間、地點、名額輸入）在 360px/390px 需可操作，date/time input 使用原生 `<input type="datetime-local">`。
- class session 詳情頁在手機版採卡片分區呈現，不使用密集表格（比照 spec RWD Requirements）。

---

## 8. 實作切片（Slice 1–6；施工前提：D1–D15 已拍板）

### Slice 1 — Schema + Migration

- **goal**：新增 `ClassSession` model + `ClassSessionStatus` enum；新增 `markDemandRequestAsConvertedToClassIfMatched(tx, demandRequestId)` transaction-aware helper。
- **slice type**：micro（schema + migration + 跨 domain 介面）。
- **allowed files**：
  - `prisma/schema.prisma`：新增 `ClassSession` model（欄位：`id`/`demandRequestId`(`@unique`)/`teacherProfileId`/`organizerProfileId`/`organizationId`/`title`/`description`(`String?`，選填，見 D3)/`serviceType`(`String?`)/`startAt`/`endAt`/`location`/`capacity`(`Int`)/`isPublic`(`Boolean` `@default(false)`)/`status`(`ClassSessionStatus` `@default(draft)`)/`createdAt`/`updatedAt`；relations 到 `DemandRequest`/`TeacherProfile`/`OrganizerProfile`/`Organization`，`onDelete: Restrict`（class session 是重要營運紀錄，不應隨關聯資料刪除而連帶消失——這點與既有 `DemandResponse` 的 `onDelete: Cascade` 不同，需在 migration 中明確）；`ClassSessionStatus` enum 完整 6 值（`draft`/`pending_confirmation`/`open_for_enrollment`/`confirmed`/`completed`/`cancelled`）；`TeacherProfile`/`OrganizerProfile`/`Organization`/`DemandRequest` 加 `classSessions ClassSession[]` 反向 relation（僅新增，不修改既有欄位）。
  - `prisma/migrations/`：新增 migration（純新增：`CREATE TYPE`、`CREATE TABLE`、索引、外鍵）。
  - `src/domain/demand-request/matching-service.ts`（既有檔案，僅新增 export）：新增 `markDemandRequestAsConvertedToClassIfMatched(tx, demandRequestId)`，簽章與 `markDemandRequestAsMatchedIfPublished` 一致（接受外部 `Prisma.TransactionClient`，`updateMany({where:{id,status:"matched"},data:{status:"converted_to_class"}})`，`count===0` 時 `throw`，不修改既有函式）。
- **forbidden files / areas**：`src/app/**`、`tests/**`、`matching-service.ts` 內既有函式的簽章與行為。
- **acceptance criteria**：`npx prisma migrate dev` 成功套用；`markDemandRequestAsConvertedToClassIfMatched` 對非 `matched` 的 demand 呼叫會 throw；`ClassSession.demandRequestId` 的 `@unique` 約束在 DB 層面阻擋重複建立。
- **checks**：`tsc`/ESLint、`prisma migrate dev` 實際套用成功。
- **stop conditions**：D1/D2/D4–D9 未拍板 → 停止。

### Slice 2 — Class Session 建立 domain service

- **goal**：新增 `src/domain/class-session/` domain，提供驗證、建立 service（比照 `demand-response-selection-and-matching` Slice 2 已驗證過的「auth-resolving 外層 + 不依賴 request context 的 pure 內層」架構，讓 Slice 5 能用同一套 hooks 確定性鎖測試手法），以及讀取函式。
- **slice type**：micro（core flow + 跨 domain 讀取 + 併發保護 + 可測試性）。
- **allowed files**：
  - `src/domain/class-session/validation.ts`（新增）：欄位驗證（`title` 必填 trim 後 1–200 字；`description` **選填**，若提供 trim 後上限 2000 字（比照 `DemandRequest.description` 的 `DESCRIPTION_MAX_LENGTH`，但不套用其 20 字下限，因為此欄位是選填，見 D3）；`serviceType` **必填**且須通過 `isValidServiceType`（D3/D4，空白或不在受控清單內一律拒絕，不因為 pre-fill 帶有預設值就放寬）；`location` 必填 trim 後 1–200 字（D7）；`capacity` 整數 1–500（D5）；`startAt`/`endAt` 用 D13 的 `parseTaipeiDatetimeLocal` 解析，解析失敗（含 D13 提到的行事曆滾動校正情形）直接視為驗證錯誤；`startAt` 必須晚於送出當下、`endAt` 必須晚於 `startAt`（D6））。
  - `src/domain/class-session/timezone.ts`（新增）：D13 的 `parseTaipeiDatetimeLocal(value: string): Date | null`（明確附加 `+08:00` 偏移量後建構 `Date`）與 `formatTaipeiDatetime(date: Date): string`（`Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", ... })`），不依賴伺服器或瀏覽器當地時區。
  - `src/domain/class-session/service.ts`（新增），export：`createOwnClassSession(demandRequestId, input)`：`requireUser()` 解析目前使用者、查出對應的 `organizerProfileId` 並確認自己擁有這筆 `demandRequestId`（own-scoped，不存在/非自己回 not-found），然後呼叫下面的內層函式。
  - `src/domain/class-session/__internal__/create-class-session-core.ts`（新增；`__internal__` 命名沿用前一輪的「genuinely restricted boundary」信號）：`createClassSessionForOrganizer(organizerProfileId, demandRequestId, input, hooks?: { onBeforeLock?: () => void | Promise<void>; onLockAcquired?: () => void | Promise<void> })`——**不呼叫 `requireUser()`**，但不代表信任呼叫方身分：整段包在 `prisma.$transaction(async (tx) => {...})`：
    - (a) `await hooks?.onBeforeLock?.()` → 執行 `SELECT dr."id", dr."status", dr."organizationId" FROM "DemandRequest" dr WHERE dr."id" = ${demandRequestId} AND dr."organizerProfileId" = ${organizerProfileId} FOR UPDATE`（同時鎖住 demand、驗證擁有權、**一併取回後續步驟需要的 `status`／`organizationId`**——鎖查詢只回傳 `id`會導致 (b)/(d) 拿不到判斷/寫入所需的欄位，必須在同一句一起選取，不得另外開一句非鎖定的查詢，否則會在鎖之外讀到可能過期的值；0 列 → throw not-found）→ `await hooks?.onLockAcquired?.()`。
    - (b) **在檢查 `status` 之前**，先查這個 demand 是否已經有 `ClassSession`（`tx.classSession.findUnique({ where: { demandRequestId }, select: { id: true } })`，此查詢在鎖之下執行，讀到的是即時狀態）：若已存在，直接 throw `class_session_already_exists`。**這個順序是刻意的**：demand 一旦成功建立過 class session，`status` 就會是 `converted_to_class`（非 `matched`），如果檢查順序反過來（先檢查 `status === matched`），重試或併發的第二次呼叫永遠會先撞到「demand 非 matched」而回傳語意錯誤的 `demand_not_matched`，`class_session_already_exists` 這個錯誤碼就永遠不可能被觸發到。
    - (c) 檢查鎖住的 demand `status === "matched"`（否則 throw `demand_not_matched`）。
    - (d) 查出這個 demand 的 selected `DemandResponse.teacherProfileId`（`where: { demandRequestId, status: "selected" }`，找不到 throw `demand_not_ready`——理論上 `matched` demand 必有一筆 selected response，屬防禦性分支，見既有 `selectDemandResponseForOrganizer` 已保證的不變量）。
    - (e) `tx.classSession.create({...})`（用 (a) 取回的 `organizationId`；`@unique` 約束是 defense-in-depth 的資料庫層保險，正常路徑下 (b) 已經先擋掉重複，這裡的 catch unique violation 只處理理論上的極端競態，同樣轉譯為 `class_session_already_exists`）。
    - (f) 呼叫 `markDemandRequestAsConvertedToClassIfMatched(tx, demandRequestId)`（count===0 throw → transaction rollback）。
    - `hooks` 僅供 Slice 5 的鎖測試使用，正式路徑（`createOwnClassSession`）呼叫時不傳，兩個 await 在生產路徑上恆為 no-op。
  - `src/domain/class-session/read-service.ts`（新增）：`listOwnClassSessionsForOrganizer()`、`getOwnClassSessionDetailForOrganizer(classSessionId)`、`listOwnClassSessionsForTeacher()`（D14：三者皆透過 `include: { demandRequest: { select: { targetLevel: true } } }` 一併帶出程度；Teacher 版本的 DTO 不含 `Organization.contactEmail`/`contactPhone`，見第 4 節第 6 點；`listOwnClassSessionsForTeacher()` 依 D15 只用 `requireUser()` + 查自己的 `TeacherProfile`（任何 status），**不**呼叫 `requireApprovedTeacher()`）。
- **forbidden files / areas**：`src/domain/demand-request/**`（僅可能透過既有 export 呼叫，不修改）、`src/domain/demand-response/**`（唯讀 import 現有 export，不修改）、`prisma/**`。
- **domain and permission rules**：own-scoped 擁有權驗證直接內建在 (a) 步驟的 `WHERE` 子句本身（比照前一輪 `selectDemandResponseForOrganizer` 的設計，不透過額外的預先 SELECT 判斷擁有權，避免 TOCTOU 縫隙）；建立失敗時區分：demand 不存在/非自己（not-found）、demand 非 `matched`（`demand_not_matched`）、已有 class session（`class_session_already_exists`）、驗證失敗（`validation_failed`）。
- **acceptance criteria**：成功建立後 `ClassSession.status === "draft"`，`DemandRequest.status === "converted_to_class"`；對非 own demand 建立被擋（not-found）；對 `matched` 之外狀態的 demand 建立被擋（`demand_not_matched`）；**對已經有 class session 的 demand 再次呼叫，必須回傳 `class_session_already_exists`，不是 `demand_not_matched`**（驗證 (b)/(c) 的檢查順序真的照上面的順序執行，這是本 slice 的關鍵不變量）；`createOwnClassSession`／`createClassSessionForOrganizer` 的行為、錯誤碼、回傳型別與抽出 pure 核心前的設計完全一致；`parseTaipeiDatetimeLocal`／`formatTaipeiDatetime` 對已知輸入的往返轉換與執行環境的 `TZ` 設定無關（見 D13）；讀取函式回傳的 DTO 含 `targetLevel`（D14）、Teacher 版本不含 Organization 聯絡資訊。
- **checks**：`tsc`/ESLint。
- **stop conditions**：D3–D7 未拍板 → 停止。

### Slice 3 — Organizer 建立 UI（整合進既有 demand detail）

- **goal**：在既有 `/organizer/demands/[demandRequestId]` 頁面，`demandRequest.status === "matched"` 時顯示「建立課程」表單（pre-fill title/serviceType，手動輸入 startAt/endAt/location/capacity/isPublic/description（選填））；新增 `/organizer/classes`（列表）與 `/organizer/classes/[classSessionId]`（詳情）路由。
- **slice type**：standard（新路由 + 既有頁面最小整合）。
- **allowed files**：
  - `src/app/organizer/demands/[demandRequestId]/page.tsx`（既有檔案，僅新增：`matched` 狀態時的建立表單區塊 + import）。
  - `src/app/organizer/demands/[demandRequestId]/actions.ts`（既有檔案，新增 `createClassSessionAction`，比照既有 `selectDemandResponseAction` 的 `revalidatePath`+`redirect`+encoded-feedback pattern；成功後 redirect 到新建立的 `/organizer/classes/[classSessionId]`，不是留在 demand detail 頁）。
  - `src/app/organizer/classes/page.tsx`（新增，列表）。
  - `src/app/organizer/classes/[classSessionId]/page.tsx`（新增，詳情）。
- **forbidden files / areas**：`src/app/teacher/**`、`src/domain/**`（只 import）、`_components/ResponseList.tsx`（本輪不需要改）。
- **acceptance criteria**：Organizer 只在 `matched` demand 看到建立表單；送出成功後導向新 class session 詳情頁並顯示成功 feedback；`/organizer/classes` 列表只顯示自己的 class sessions；跨 organizer 存取 `/organizer/classes/[classSessionId]` 回 404。
- **RWD/brand review**：依第 6/7 節。
- **stop conditions**：Slice 1/2 未合入 → 停止。

### Slice 4 — Teacher 唯讀查看

- **goal**：新增 `/teacher/classes`（列表，唯讀，DTO 不含 Organization 聯絡資訊）。
- **slice type**：micro（新路由，純讀取）。
- **allowed files**：`src/app/teacher/classes/page.tsx`（新增）。
- **forbidden files / areas**：`src/app/organizer/**`、`src/domain/**`（只 import）。
- **acceptance criteria**：Teacher 只看到自己授課的 class sessions；未登入導向 sign-in；DTO 檢查通過（不含 Organization contactEmail/contactPhone）；suspended teacher 仍可看到自己既有的 class session（D15）。
- **stop conditions**：Slice 1/2 未合入、D15 未拍板 → 停止。

### Slice 5 — Tests + Docs 對齊

- **goal**：Playwright smoke 覆蓋建立流程（含 D5–D7 驗證邊界、D13 時區正確性、D5 併發保護）+ docs 對齊。
- **slice type**：batch（測試 + docs-only）。
- **allowed files**：
  - `tests/smoke/class-session-creation.spec.ts`（新增，可 import Slice 2 的 `src/domain/class-session/__internal__/create-class-session-core.ts`、`src/domain/class-session/timezone.ts`，比照前一輪 Slice 4 的既定作法——這是**唯一**允許本 slice import 的 `src/**` 路徑，不得 import 或修改其他 `src/**`/`prisma/**` 檔案）：
    - **UI 全流程**：Organizer 建立 class session、`DemandRequest` 轉 `converted_to_class`、非 matched demand 不顯示建立表單、成功後導向詳情頁並顯示 feedback、class detail 顯示程度（D14）。
    - **驗證邊界**（每條至少一個被拒絕的案例，直接呼叫 domain service 驗證錯誤碼，不必每個都走 UI）：`capacity` 為 0 與 501 被拒；`startAt` 為過去時間被拒；`endAt` 等於或早於 `startAt` 被拒；`location` 空字串被拒；`serviceType` 給不在受控清單內的值被拒；`serviceType`／`title` 送出空字串被拒（即使該欄位是從 demand pre-fill 帶入，見 D3/D4）。
    - **重複建立的錯誤碼順序**：對已經成功建立過 class session 的 demand 再次呼叫 `createClassSessionForOrganizer`，斷言回傳 `class_session_already_exists`，而不是 `demand_not_matched`（驗證 Slice 2 (b)/(c) 的檢查順序，見該 slice 說明）。
    - **D13 時區正確性**：對已知輸入（例如送出 `"2026-08-15T14:00"`）建立後，直接用 `formatTaipeiDatetime` 讀回並斷言仍是 `14:00`；測試執行時明確設定 `process.env.TZ = "UTC"`（或確認 CI 預設就是 UTC）以證明結果與伺服器系統時區無關，不是恰好在 `Asia/Taipei` 環境才正確；另外斷言 `"2026-02-31T14:00"` 這種不存在的日期會被驗證層拒絕，不會被靜默存成 3 月的日期。
    - **併發保護**：比照前一輪 Slice 4 的 hooks 確定性鎖測試手法（`hooks.onBeforeLock`/`onLockAcquired` + deferred + `waitUntil`），直接呼叫 `createClassSessionForOrganizer` 兩次，證明第一個呼叫真的持有鎖、第二個呼叫真的被擋住，鎖釋放後才繼續，且只有一個成功。
    - **IDOR／Teacher 唯讀**：跨 organizer 建立被擋（not-found）；Teacher 唯讀查看且看不到其他 teacher 的 class session；Teacher DTO 不含 Organization 聯絡資訊；suspended teacher 仍可看到自己既有的 class session（D15）。
  - `docs/domain/data-model.md`：`ClassSession` 欄位草稿 `serviceTypeId` → `serviceType`（D4，`description` 欄位維持不動，本輪確實有實作，見 Slice 1/2/3）；同時修正既有第 217 行「`matched`、`converted_to_class`...保留但本輪不接線」的敘述——`matched` 已由 `demand-response-selection-and-matching` 接線（該輪的 Slice 5 未涵蓋 `data-model.md`，遺留至今的既知落差，本輪順手修正），`converted_to_class` 由本輪接線，兩者都需要從「保留不接線」清單移除。
  - `docs/product/form-field-spec.md`：「Class Session Form」表格的 `serviceTypeId` → `serviceType`（D4，同一個既知落差，這份文件也有一份，需要一併修正，不能只改 `data-model.md`）；`description` 欄位維持「建議」（選填）不動，與本輪實作一致。
  - `docs/product/route-map.md`：
    - Organizer 區塊的 `/organizer/classes` 那一列補充新增的 `/organizer/classes/[classSessionId]` 詳情路由描述（目前只列了列表路由，本輪新增的詳情路由需要一併補上，否則 route-map 與實際路由不同步）。
    - 「Route Guard 原則」小節既有一行「其他 `/teacher/*` workspace routes 必須只允許 Teacher 或 Admin；未 approved 的 Teacher 只能進入 onboarding / profile 相關頁。Demand response、eligible demand pool、availability 與 class session 能力必須另外檢查 TeacherProfile status 與 service-layer permission。」——這句話目前的字面意思與 D15（`/teacher/classes` 不檢查 approved 狀態）矛盾，需要在這句後面補充明確例外：「`/teacher/classes` 是例外：查看**已經指派給自己的既有 class session**不受此限，任何曾建立 `TeacherProfile` 的使用者皆可查看（比照既有唯讀查看自己 demand response 的權限模式），因為這是查看既有承諾而非申請新機會（D15）。」
  - `docs/domain/state-machines.md`：DemandRequest V1 落地範圍新增 `matched → converted_to_class`（Actor: Organizer，見 D1/D2）；新增 ClassSession Status 的 V1 落地範圍小節（只接線 `(none)→draft`，其餘保留不接線，D9）。
  - `docs/domain/state-transition-details.md`：DemandRequest V1 policy notes 新增一列；新增 ClassSession 的 V1 policy notes 小節。
  - `docs/domain/permissions-matrix.md`：ClassSession 表格下方新增 V1 落地範圍註記（比照既有 Cancel demand／Select response 註記慣例）：僅 Organizer own-scoped 建立，Admin 不介入（D1/D10）。
  - `docs/specs/class-session-and-enrollment-spec.md`：
    - 「`ClassSession` 必要欄位」清單的 `serviceTypeId` → `serviceType`（D4——這是第三份、也是最初被發現落差的那份文件裡的同一個欄位名稱，`data-model.md`／`form-field-spec.md`／這份 spec 三處都要改，缺一處都會讓下游文件互相矛盾）。
    - 頂部新增「落地現況」段落（比照 `demand-response-and-matching-spec.md` 的既定格式），**精確標註**：User Flow 第 1–3 步（demand matched、Organizer 建立 ClassSession、必要資訊於建立當下一次到位補齊）已出貨；第 4 步（`ClassSession` 進入 `open_for_enrollment`/`confirmed`）**未落地**（本輪只接線到 `draft`，見 D9）；第 5–9 步（Enrollment）未落地。**不得**寫成「第 1–4 步已出貨」——第 4 步明確不在本輪範圍。
- **forbidden files / areas**：`src/**`（除上方明列的兩個可 import 路徑外）、`prisma/**`、`package.json`、既有 spec/test 檔案（預設不改）。
- **acceptance criteria**：上述測試全數綠燈；既有 smoke 維持綠燈；docs 通讀不再與實際接線矛盾（含修正 `data-model.md` 第 217 行的既有落差）。
- **stop conditions**：D12 未定、或 Slice 1–4 未合入 → 停止。

### Slice 順序

```
Slice 1（schema + migration + 跨 domain helper）
   ↓
Slice 2（建立 domain service）
   ↓
Slice 3（Organizer UI）─┬─→ Slice 4（Teacher 唯讀）
                        │
                        ↓
                    Slice 5（tests + docs，待 3、4 都合入後執行）
```

---

## 9. Verification Planning

- `tsc`/ESLint：所有含 `src/**` 變更的 slice。
- `prisma migrate dev`：Slice 1 完成後立即套用並確認 schema 符合預期。
- `next build`：Slice 3/4 之後。
- `npm run test:smoke`：Slice 5 集中執行。
- **必含負向 security cases**：跨 organizer IDOR、非 matched demand 建立被擋、併發建立 race（僅一個成功）、Teacher 看不到其他 teacher 的 class session、Teacher DTO 不含 Organization 聯絡資訊。
- **本 planning-only 任務不要求實際執行**；上述為施工時的驗證計畫。

---

## 10. Rollback 總則

- Slice 1 有 migration（新增 model/enum/FK，純新增不影響既有資料），rollback 需要 `prisma migrate resolve` 或新的 down migration 移除新增的 table/enum/FK；其餘 slice 皆為新增檔案 + 對既有兩個檔案（`page.tsx`、`actions.ts`）的最小新增修改。
- 依相依反序 rollback：Slice 5 → 4 → 3 → 2 → 1。

---

## 11. Planning-only self review

- **變更檔案**：新增本檔 `docs/superpowers/plans/2026-07-26-class-session-creation-plan.md`。本輪未預先修改任何其他檔案。
- **V1 scope**：符合；明確排除 Enrollment/`open_for_enrollment` 之後狀態/`/admin/classes`/公開 `/classes` 路由/schedule conflict 檢查。
- **一致性**：對齊既有 role model、permissions、state machines、data model（含修正 `serviceTypeId`→`serviceType` 的既知落差）、route map。
- **安全**：own-scoped、IDOR not-found 語意、併發保護（demand-level lock，沿用前一輪已驗證手法）、DTO 最小化，皆列入相關 slice。
- **RWD/brand**：已於第 6、7 節規劃。
- **產品主人決策**：D1–D15 為必要 gate，未全部拍板前不得產出可執行 Builder prompt。本 plan 未附任何可直接施工的 Builder prompt。
- **未修改無關檔案**：無。

<!-- codex-peer-reviewed: 2026-07-26T14:35:22Z rounds=6 verdict=approved -->
