# Teacher Availability Calendar — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D14）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

`docs/scope/v1-scope.md` 的 Teacher Must Have 清單包含「Teacher availability calendar」，`docs/product/route-map.md` 也早就預先規劃了 `/teacher/availability`（「管理固定 availability 與 exception」）——但這個功能完全從零開始：`prisma/schema.prisma` 目前**沒有** `TeacherAvailability`／`AvailabilityException` 兩個 model，`src/domain/`／`src/app/teacher/` 底下也完全沒有任何相關檔案（已用 `grep -rn Availability` 核對整個 repo，零命中）。

### 1.2 這輪跟既有規劃文件的關係

`docs/domain/data-model.md` 已經有這兩個 model 的欄位清單草稿（`TeacherAvailability`：`dayOfWeek`/`startTime`/`endTime`/`locationArea`/`isRecurring`；`AvailabilityException`：`date`/`startTime`/`endTime`/`type`/`reason`），`docs/domain/permissions-matrix.md` 也已經有完整設計的權限表格（尚未標記落地）。本輪的任務是把這份草稿落地，過程中會核對每個欄位是否真的需要（比照 `class-session-review` 一輪拿掉 `Review.teacherProfileId`／`visibility` 的既有先例），發現的修正都記錄在 D 項。

**使用者已經明確決策的範圍邊界**：這一輪只做「老師在站內自己管理可授課時間」的自助工具，**不做 Google Calendar 雙向同步**——`docs/scope/v1-scope.md`／`docs/product/PRD.md`／`docs/domain/marketplace-rules.md`／兩份既有 spec 文件都已經明確把「Google Calendar two-way sync」列為 V1 non-goal，這是既有、一致的既有決策，不是本輪新提出的限制。**也不做媒合流程整合**（Organizer 選老師、建立 class session 時比對老師的可授課時間）——`docs/domain/state-transition-details.md` 的 ClassSession 段落已經明確記載「沒有 `TeacherAvailability` 或任何排程資料可供檢查，`ClassSession 必須檢查 teacher schedule conflict` 這條禁止條件屬完整設計，本輪不接線」，這句話從 `class-session-creation` 一輪就已經預期並延後到「這個資料真的存在的那一輪」——現在這一輪讓資料真的存在，但比對邏輯本身是一個獨立、需要額外設計（要不要硬性擋下衝突、還是只是提示）的後續功能，不在本輪範圍內，這句既有記載繼續成立到下一輪為止。

### 1.3 風險等級

低到中。兩個全新 model、沒有任何既有資料需要遷移。兩個中風險點：(1) `/teacher/dashboard` 的既有文案（「本 slice 不開放 availability、demand pool、response 或 class session 功能」）從更早的 onboarding-only 輪次遺留至今，demand pool／response／class session 其實都已經落地，這句話早就是錯的；本輪讓 availability 也落地後，這句話的最後一項也會變成錯的，需要順手修正（見 D13）。(2) 把 `requireApprovedTeacher()`／`getOwnTeacherProfileId()` 從 `demand-response/capability.ts` 搬到 `teacher-profile/capability.ts`（D10）——純粹是檔案位置搬遷，不改變函式邏輯，但既有 `demand-response`／`teacher/demands` 相關程式碼的 import path 需要同步更新，且必須重跑既有測試確認沒有回歸（見 Slice 1）。

## 2. 現況核對（Repo Reality Audit；working tree = committed `main` @ `88052f6`）

### 2.1 已 committed 的基礎（可直接依賴）

- **`requireApprovedTeacher()` 既有先例**（`src/domain/demand-response/capability.ts`）：`requireUser()` 解析出 `userId`，查 `TeacherProfile.status === "approved"`，回傳 `{ userId, teacherProfileId }`，否則丟出 `Error("Approved teacher profile required")`。**修正（codex round 1 指出的問題，已採納，見 D10）**：這個函式的既有原始碼註解明確寫著「僅適用於『瀏覽新 demand』的 eligibility gate」，不是泛用的共用判斷，本輪不直接從 `demand-response/capability.ts` 匯入，而是把它連同 `getOwnTeacherProfileId()` 一起搬到 `src/domain/teacher-profile/capability.ts`（這個判斷本來就該屬於 `TeacherProfile` 這個 model 的狀態機），`demand-response` 底下既有的匯入處改指向新位置。
- **既有的「approved-only，其餘狀態顯示引導文案」既有版型**：`src/app/teacher/demands/page.tsx` 示範了完整寫法——`getOwnTeacherProfileStatus()` 查 `TeacherProfile.status`，非 `approved` 時顯示對應狀態的引導文案（`nonApprovedCopy` record，含 `missing`/`draft`/`submitted`/`rejected`/`suspended` 五種狀態）與返回 `/teacher/dashboard` 的連結。本輪 `/teacher/availability` 比照同一個版型（獨立複製一份，不抽共用元件——目前只有這一個既有頁面做過這件事，抽共用元件屬於過早抽象，不符合這個專案一貫的既有慣例）。
- **既有的「受控詞彙」既有先例**：`src/domain/demand-request/service-types.ts` 的 `PREFERRED_TIME_SLOTS`（6 個粗粒度時段：平日/週末 × 早上/午間/晚上）是 `DemandRequest.preferredTimeSlots` 使用的既有受控清單——**本輪刻意不沿用這個清單**，理由見 D1（使用者已經明確選擇「照原始設計做完整行事曆」，不是粗粒度時段，這裡記錄下來是為了讓下一個讀者知道這個既有先例存在過、且被有意識地評估後不採用，不是沒注意到）。
- **既有的「選填短文字」既有先例**：`Enrollment.notes`／`TeacherProfile.rejectionReason`／`suspensionReason` 的既有長度上限（`notes` 500 字，`rejectionReason`/`suspensionReason` 10–1000 字）——本輪 `AvailabilityException.reason` 比照 `notes` 的既有先例（選填、簡短備註，見 D5）。
- **`docs/domain/data-model.md` 現有的 `TeacherAvailability`／`AvailabilityException` 欄位清單是規劃草稿，不是已落地的既有 model**——`isRecurring` 這個欄位（原始草稿在 `TeacherAvailability` 上）需要重新檢視，見 D2。
- **`/teacher/dashboard` 現有文案過時**：`src/app/teacher/dashboard/page.tsx` 第 88–91 行（頁首說明）與 `statusCopy.approved.body`（第 45 行）都還寫著「demand pool、availability 與 response flow 尚未在本 slice 開放」——這兩句話在 demand pool／response flow 實際落地的那幾輪就已經變成錯的，本輪讓 availability 也落地後，需要一併修正（見 D13），不是本輪造成的新債務，是接手既有債務。
- **`docs/domain/permissions-matrix.md` 已有完整設計的 `TeacherAvailability` 表格**（`View public availability summary`／`Create`／`Edit`／`Delete`，Admin 與 Organizer 欄位都標記完整未來設計）——本輪只落地 Teacher own-scoped 的 Create／Delete／View own，不落地 Organizer「Eligible」與 Admin 欄位（見 D6）。

### 2.2 上游依賴狀態

- 不依賴任何已落地或進行中的其他輪次（這是一個全新、獨立的自助工具，不需要 demand-response／class-session 任何既有資料）。
- 跟目前另一個 session 正在進行中、尚未 commit 的 `docs/superpowers/plans/2026-07-28-role-dashboards-plan.md`（`src/app/member/page.tsx`／`src/app/organizer/page.tsx`）沒有交集——本輪只碰 `src/app/teacher/`，不碰 `src/app/member/`／`src/app/organizer/`。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做 Google Calendar 雙向同步（1.2 已說明，既有、一致的 V1 non-goal）。
- 不做媒合流程整合／schedule conflict 檢查（1.2 已說明，`state-transition-details.md` 既有記載延後到「資料存在的那一輪」，本輪只是讓資料存在，比對邏輯是獨立後續）。
- 不對 Organizer 或 Admin 開放任何檢視畫面（見 D6）。
- 不做編輯——只有新增／刪除（比照這個系列一貫的 V1 最小化原則：`ClassSession`／`Enrollment`／`Review` 都不可編輯，見 D7）。
- 不做時段重疊檢查或警告（見 D3）。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `prisma/schema.prisma`：新增 `TeacherAvailability`、`AvailabilityExceptionType` enum、`AvailabilityException` 三者（不含 `isRecurring` 欄位，見 D2；`AvailabilityException.startTime`/`endTime` 為 nullable，見 D4；完整定義見 D11）；`TeacherProfile` 新增兩個反向關聯。
- `src/domain/teacher-profile/capability.ts`（新檔案）：從 `demand-response/capability.ts` 搬遷過來的 `requireApprovedTeacher()`／`getOwnTeacherProfileId()`（D10）；同步更新 `demand-response` 底下既有的匯入處。
- `src/domain/teacher-availability/date-format.ts`（新檔案）：`parseAvailabilityExceptionDate`／`formatAvailabilityExceptionDate`，比照既有 `class-session/timezone.ts` 的既有寫法，明確帶 `timeZone: "UTC"` 的 `Intl.DateTimeFormat`（見 D11 最終版）。
- `src/domain/teacher-availability/validation.ts`：`validateTeacherAvailabilityInput`（`dayOfWeek` 0–6、`startTime`/`endTime` 為 `HH:mm` 格式且 `startTime < endTime`，見 D3/D11）、`validateAvailabilityExceptionInput`（`date` 必填且用 `parseAvailabilityExceptionDate` 驗證合法性、`type` 必填、`startTime`/`endTime` 皆有或皆無、`reason` 選填 ≤500 字，見 D11）。
- `src/domain/teacher-availability/service.ts`：`createOwnTeacherAvailability`／`deleteOwnTeacherAvailability`／`createOwnAvailabilityException`／`deleteOwnAvailabilityException`，皆 `requireApprovedTeacher()` 把關（own-scoped，見 D6/D7/D9）。
- `src/domain/teacher-availability/read-service.ts`：`getOwnAvailabilityOverview()`（一次查詢回傳 `{ availability, exceptions }`，`requireUser()` 把關、不要求 approved，見 D8/D9）。
- `src/app/teacher/availability/page.tsx`／`actions.ts`：三種顯示狀態（比照既有版型，見 D7 的表單細節）。
- `src/app/teacher/dashboard/page.tsx`：修正過時文案 + 新增前往 `/teacher/availability` 的連結（D13）。
- Playwright smoke 測試（見 Slice 3）。
- 文件對齊（見 D14）：`docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`、`docs/product/route-map.md`、`docs/domain/state-transition-details.md`。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- **修正（codex round 1 指出的問題，已採納，完整理由見 D9/D10）**：四個寫入函式（`createOwnTeacherAvailability`／`deleteOwnTeacherAvailability`／`createOwnAvailabilityException`／`deleteOwnAvailabilityException`）都用 `requireApprovedTeacher()`（D10 修正版：從新位置 `src/domain/teacher-profile/capability.ts` 匯入）解析出受信任的 `teacherProfileId`，刪除動作的 `deleteMany` 一律用 `{ id, teacherProfileId }` 雙重過濾（比照既有 `cancelOwnEnrollment` 的既有 IDOR 防護寫法）——猜測別人的 row id 也刪不到，`count === 0` 回傳明確的 `not_found` 錯誤碼。
- `getOwnAvailabilityOverview()` **不用** `requireApprovedTeacher()`，改用 `requireUser()` + 直接查自己的 `TeacherProfile`（D9 修正版：任何狀態皆可查看自己的資料，包含 `suspended`），只回傳呼叫者自己的資料，沒有任何跨使用者查詢路徑。
- `/teacher/availability` 頁面比照既有 `/teacher/demands` 的既有寫法：非 approved 且非 suspended 顯示引導文案，不是直接 404 或跳轉登入（因為使用者已登入，只是還不是 approved teacher，這是既有的、比 404 更友善的既有先例）；`suspended` 顯示唯讀版本（D9 修正版）。

## 5. 產品主人決策 Gate（D1–D14）

### D1 — 時間表達方式：完整行事曆，不是粗粒度時段（使用者已明確決策）

- **已確認：照 `docs/domain/data-model.md` 原始設計，`TeacherAvailability` 用「星期幾 + 精確起訖時間」表達固定時段，不沿用 `DemandRequest.preferredTimeSlots` 的 6 格粗粒度詞彙。** 這是產品主人在規劃過程中被明確告知兩個選項（粗粒度沿用既有詞彙 vs. 完整行事曆）後做出的選擇，權衡是：完整行事曆的開發量比粗粒度版本大（需要新的時間輸入驗證、無法沿用既有受控清單），且目前沒有任何比對邏輯會消費這個精確度（見 1.2），但使用者判斷「行事曆」這個功能名稱本身就該長這樣，選擇不要為了眼前用不到而閹割掉未來的精確度。

### D2 — 修正：`TeacherAvailability` 不需要 `isRecurring` 欄位

- **推薦：拿掉原始草稿裡的 `isRecurring` 欄位。** 這個 model 的既有定義本身就是「Represents regular availability」（`data-model.md` 原文），跟 `AvailabilityException`（「Represents blocked or special availability」）是兩個獨立的 model，用不同的 table 區分「固定」與「例外」——`TeacherAvailability` 底下的每一筆記錄天生就是「固定、重複出現」的，`isRecurring` 欄位不管填 `true` 還是 `false` 都不會影響任何查詢或顯示邏輯（沒有規劃任何「非重複但存在於 TeacherAvailability」的情境），是一個永遠等於 `true`、沒有實際用途的欄位，屬於照抄原始草稿、沒有驗證是否真的用得到的多餘欄位（比照 `class-session-review` 一輪拿掉 `Review.teacherProfileId` 的同一種判斷）。

### D3 — 不做時段重疊檢查，但 `AvailabilityException` 的 `blocked`／`extra_available` 衝突要有明確判讀規則

- **推薦：允許同一位老師在同一天新增多筆、甚至重疊的時段，不做伺服器端重疊檢查或警告（`TeacherAvailability` 內部重疊、或 `TeacherAvailability` 與 `AvailabilityException` 之間的重疊皆同）。** 時段重疊本身不會破壞任何既有邏輯（沒有下游會因為「同一天有兩筆重疊的可授課時段」而出錯或產生矛盾資料），檢查重疊需要額外的區間比對邏輯（同一天多筆記錄兩兩比較起訖時間），這個複雜度換來的唯一好處是「防止使用者不小心填錯」，屬於 UX 優化而非正確性需求，V1 不做。驗證只確認單筆記錄本身合法（`startTime < endTime`，格式正確），不比較跨記錄的關係。
- **修正（codex round 1 指出的問題，已採納）：`AvailabilityException` 本身也不做寫入時的衝突檢查（同一天同一個時段可以同時存在 `blocked` 與 `extra_available` 兩筆記錄），但這會產生語意上矛盾的資料（「這位老師這個時段到底能不能上課」沒有單一答案），如果放著不管，日後任何真的需要讀取這份資料做判斷的消費者（例如媒合流程的排程比對，見 1.2 的既有 non-goal 說明）都會被迫各自猜測怎麼處理，不同消費者可能各自做出不一致的判讀。**本輪明確訂下判讀規則（只是文件層級的規則，不是資料庫約束或程式碼強制執行）：`blocked` 的優先權高於 `extra_available`——同一天同一個時段如果兩種記錄都存在，任何未來的消費者都必須把這個時段判讀為「不可授課」。** 這條規則寫進 `docs/domain/data-model.md`（見 D13），確保「這筆資料存在但沒人知道怎麼解讀」的情況不會發生；不做成資料庫約束或寫入時擋下衝突，因為目前沒有任何消費者，強制執行一個沒有人使用的約束沒有實質效益，且會讓「老師想要記錄一個原本規劃額外開放、後來又要請假封鎖同一個時段」這種修改歷程的意圖被迫用刪除重建表達，增加不必要的摩擦。

### D4 — `AvailabilityException` 的 `startTime`/`endTime` 改成選填（可以整天）

- **推薦：原始草稿的 `startTime`/`endTime` 是必填欄位，本輪改成選填（nullable），兩者皆為 `null` 代表「整天」。** 這是本輪對原始草稿的一個真實改善，不是照抄：「老師今天請假一整天」是這個功能最直覺的使用情境之一（`type = blocked` 且沒有特定時段），如果 `startTime`/`endTime` 是必填，使用者得自己填一個涵蓋全天的區間（例如 `00:00`–`23:59`），這是一個不必要的摩擦，而且容易跟「這位老師真的只在 00:00–23:59 這個精確區間被封鎖」的語意混淆。驗證規則：`startTime`／`endTime` 必須同時提供或同時不提供（不允許只填一個），同時提供時 `startTime < endTime`。

### D5 — `AvailabilityException.reason` 的長度上限

- **推薦：選填，trim 後上限 500 字，比照既有 `Enrollment.notes` 的既有先例（見 2.1）。** 這是簡短備註（例如「請假」「臨時加開」），不是正式文件等級的欄位，這個 repo 目前沒有其他「使用者對自己資料的簡短備註」欄位可以參考，`notes` 是最接近的既有精神。

### D6 — 不對 Organizer／Admin 開放檢視

- **推薦：`docs/domain/permissions-matrix.md` 完整設計表格裡 Organizer「Eligible」與 Admin「Admin」兩欄，本輪都不落地。** Organizer 要在什麼情境下才算「Eligible」看到老師的可授課時間，完整設計沒有明確定義（可能是媒合過程中、或已經 matched 之後），這個判斷條件本身需要額外設計，且目前 Organizer 端沒有任何既有頁面有「查看老師時段」的插入點（`/organizer/demands/[demandRequestId]` 顯示的是 response 內容，不是老師的排程）；Admin 端同理，`/admin/teachers` 目前顯示的是申請審核用的欄位，不是排程資料。這兩者都屬於「需要額外設計消費情境」的獨立後續功能，不是本輪「先讓老師自己能管理」這個範圍。

### D7 — UI 放哪裡：新路由，不可編輯，刪除不需要二次確認

- **推薦**：
  - 新路由 `/teacher/availability/page.tsx`（比照 `docs/product/route-map.md` 早就規劃好的路由名稱），三種顯示狀態（**修正**：原本只有「approved／非 approved」兩種，這裡已修正成三種，跟 D9 的存取權限設計一致）：
    1. **`missing`／`draft`／`submitted`／`rejected`**：顯示引導文案（比照 `/teacher/demands` 的既有版型，見 2.1），不顯示任何 availability 內容。
    2. **`suspended`**：顯示兩個區塊的**唯讀版本**（可以看到既有的固定時段與例外，但不顯示新增表單、也不顯示刪除按鈕），並在頁首提示「帳號目前暫停中，暫時無法新增或刪除可授課時間」（理由見 D9）。
    3. **`approved`**：顯示兩個區塊的完整版本：
       1. **固定可授課時段**：依星期幾分組列出既有記錄（每筆顯示起訖時間 + 選填地區 + 刪除按鈕），下方是新增表單（星期幾下拉選單、`<input type="time">` 起訖時間、選填地區文字欄位）。
       2. **特殊日期例外**：依日期排序列出既有記錄（每筆顯示日期 + 類型徽章「封鎖」/「額外開放」+ 選填起訖時間 + 選填原因 + 刪除按鈕），下方是新增表單（`<input type="date">`、類型單選、選填起訖時間、選填原因文字區）。
  - **不提供編輯**：只有新增／刪除，比照這個系列一貫的既有原則（`ClassSession`／`Enrollment`／`Review` 都不可編輯，一次到位或整筆刪除重建）。
  - **刪除不需要二次確認 checkbox**：這跟這個 app 其他需要二次確認的破壞性動作（取消課程、取消報名、退回申請、暫停老師）性質不同——那些動作會影響**別人**（觸發通知、連帶取消、揭露給其他角色），這裡刪除自己的一筆可授課時段或例外，**不影響任何其他使用者、不觸發任何通知、沒有連帶效果**，而且可以立刻重新新增回來，是單純的個人設定調整。維持跟既有「破壞性動作」同一套二次確認慣例，會是不必要的摩擦，本輪明確採用比照既有「新增類」動作（沒有二次確認）而非「取消/退回類」動作的既有版型。

### D9 — 修正（codex round 1 指出的問題，已採納）：Suspended teacher 可以查看但不可新增／刪除自己的 availability

- 原始草稿把四個寫入函式**與**讀取函式全部用 `requireApprovedTeacher()` 把關，代表一位老師只要被 Admin 暫停，就連查看或刪除自己既有的 availability 資料都做不到——這跟這個系統既有的暫停語意不一致。核對 `docs/domain/permissions-matrix.md` 的 `TeacherProfile` 落地現況說明（`teacher-profile-suspension` 已確認）：暫停只限制「公開顯示」與「回應新 demand request」，沒有提到限制查看或刪除自己既有的資料；核對既有測試（`tests/smoke/teacher-demand-response.spec.ts` 的「lets a suspended teacher still view their own existing response, but blocks withdraw」）確認既有先例的實際行為是**「suspended 老師可以唯讀查看自己既有的資料，但不能新增新的承諾、也不能做任何刪除/撤回類的動作」**——本輪的 availability 應該比照同一套既有先例，不是自己發明一套更嚴格的新規則。
- **推薦**：
  - **查看**（`getOwnAvailabilityOverview`）：只要有 `TeacherProfile`（任何狀態，`draft`/`submitted`/`approved`/`rejected`/`suspended` 皆可）就能查看，不要求 `approved`——用 `requireUser()` + 直接查 `TeacherProfile`（own-scoped，沒有 `TeacherProfile` 時回傳空清單），不透過 `requireApprovedTeacher()`。
  - **新增**（`createOwnTeacherAvailability`／`createOwnAvailabilityException`）：維持 `requireApprovedTeacher()`（只有 `approved` 可以新增）——新增可授課時段是「對外的新承諾」，跟既有「suspended 不能回應新 demand request」是同一種性質的限制。
  - **刪除**（`deleteOwnTeacherAvailability`／`deleteOwnAvailabilityException`）：**同樣要求 `approved`**（用 `requireApprovedTeacher()`），不是「suspended 也能刪除」——比照既有 `demand-response` 的「suspended 可以查看既有 response，但不能 withdraw」既有先例，withdraw 在語意上等同這裡的「刪除」，兩者都是「反悔/撤回」類動作，既有先例已經明確決定這類動作也要擋下，不只有「新增新承諾」被擋。
  - 這代表 `TeacherAvailability`／`AvailabilityException` 恢復 `approved` 狀態後，之前被暫停期間看得到但改不動的資料會自然恢復可以新增／刪除，不需要任何額外的復原邏輯——資料本身從未被鎖住或標記，只是操作權限跟著 `TeacherProfile.status` 走。
  - `docs/domain/permissions-matrix.md` 的 `TeacherAvailability` 表格需要反映這個 Teacher own-scoped 內部的細緻權限（View own 任何狀態皆可、Create/Delete own 僅 approved），不是簡單的「Own」一個字帶過（見 D13）。

### D10 — 修正（codex round 1 指出的問題，已採納）：不直接重用 `demand-response/capability.ts` 的 `requireApprovedTeacher()`，改成把這個判斷搬到 `teacher-profile` domain

- 原始草稿規劃直接從 `src/domain/demand-response/capability.ts` 匯入既有的 `requireApprovedTeacher()`。核對這個函式的既有原始碼註解：「僅適用於『瀏覽新 demand』的 eligibility gate（pool/detail）」——這是原作者明確寫下的既有契約，只承諾給「瀏覽新 demand」這一種情境使用，不是一個泛用的「這個使用者是不是 approved teacher」共用判斷。把它匯入到完全不相關的 `teacher-availability` domain，一方面製造了一個新 domain 依賴 `demand-response` domain 的耦合（`teacher-availability` 邏輯上不需要知道 `demand-response` 的存在），另一方面違背了原作者對這個函式的既有承諾——如果之後 `demand-response` 那邊因為「瀏覽新 demand」這個情境本身的需求而調整這個函式的行為，會意外波及完全不相關的 `teacher-availability`。
- **推薦：把「是不是 approved teacher」這個判斷搬到它真正應該屬於的地方——`teacher-profile` domain（`TeacherProfile.status` 本來就是這個 domain 的欄位）。** 新增 `src/domain/teacher-profile/capability.ts`，把 `requireApprovedTeacher()`／`getOwnTeacherProfileId()` 兩個函式從 `demand-response/capability.ts` **搬過去**（不是複製一份，是真正搬遷，避免兩份重複邏輯之後各自漂移），`demand-response` 底下所有既有匯入處（`src/app/teacher/demands/[demandRequestId]/page.tsx`、`src/domain/demand-response/demand-read-service.ts`、`src/domain/demand-response/service.ts`）改成從新位置匯入，這是單純的搬檔案 + 改 import path，不改變任何函式本身的邏輯或行為，不影響既有測試。本輪的 `teacher-availability` domain 直接從 `teacher-profile/capability.ts` 匯入，語意上正確：這個判斷本來就屬於 `TeacherProfile` 這個 model 的狀態機，不是 `demand-response` 專屬的東西。

### D11 — 明確的 schema 與驗證邊界（給零背景 Builder 的完整規格，見 3.1 補充）

- **修正（codex round 1 指出的問題，已採納）：原始草稿只列了欄位清單，沒有給出精確的 Prisma schema 定義、外鍵刪除行為、索引，也沒有給 `locationArea` 上限與完整的時間/日期驗證規則，對零背景 Builder 來說不足以直接施工。** 完整定義如下（Slice 1 逐字採用）：

```prisma
model TeacherAvailability {
  id               String   @id @default(cuid())
  teacherProfileId String
  dayOfWeek        Int      // 0（週日）–6（週六），對齊 JS Date.getDay() 慣例
  startTime        String   // "HH:mm"，24 小時制，00:00–23:59
  endTime          String   // "HH:mm"，24 小時制，必須嚴格大於 startTime（不支援跨夜區間）
  locationArea     String?  // 選填，上限 100 字（比照下方驗證規則）
  createdAt        DateTime @default(now())

  teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)

  @@index([teacherProfileId])
}

enum AvailabilityExceptionType {
  blocked
  extra_available
}

model AvailabilityException {
  id               String                     @id @default(cuid())
  teacherProfileId String
  date             DateTime                   @db.Date // 只存日期，不含時間，避免時區造成的日期偏移（比照本專案既有 Asia/Taipei 固定偏移量的既有原則）
  startTime        String?                    // "HH:mm"，與 endTime 必須同時提供或同時不提供（D4）
  endTime          String?                    // "HH:mm"，必須嚴格大於 startTime
  type             AvailabilityExceptionType
  reason           String?                    // 選填，上限 500 字（D5）
  createdAt        DateTime                   @default(now())

  teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)

  @@index([teacherProfileId])
  @@index([date])
}
```

  - `TeacherProfile` 新增兩個反向關聯：`teacherAvailabilities TeacherAvailability[]`、`availabilityExceptions AvailabilityException[]`。
  - **驗證規則（`validateTeacherAvailabilityInput`）**：`dayOfWeek` 必須是 0–6 的整數；`startTime`／`endTime` 必須符合 `/^([01]\d|2[0-3]):[0-5]\d$/`（拒絕 `24:00`、`9:00`（少前導零）、`12:60` 等格式）；`startTime` 必須嚴格小於 `endTime`（字串比較即可，因為零填補的 `HH:mm` 字典序等同時間序，但只在同一天內成立，這正是為什麼不支援跨夜區間）；`locationArea` 若提供，trim 後不可超過 100 字。
  - **驗證規則（`validateAvailabilityExceptionInput`）**：`date` 必須是合法日期字串（`<input type="date">` 原生格式 `YYYY-MM-DD`），不限制只能是未來日期（沒有既有先例限制這類欄位只能填未來，且允許補記過去的例外沒有壞處）；`type` 必須是 `blocked`／`extra_available` 其中之一；`startTime`／`endTime` 必須同時提供或同時不提供，同時提供時比照上方時間格式規則且 `startTime < endTime`；`reason` 選填，trim 後不可超過 500 字（D5）。
  - **修正（codex round 2 指出的問題，已採納；round 4 進一步修正）：`date` 字串轉換成 `Date` 物件、以及讀回顯示的規則必須明確寫出來，且要用「設定明確擋不掉」的寫法，不是「記得用對 getter」這種容易被未來維護者不小心寫錯的手寫慣例。** 原本 round 2/3 的版本要求「一律用 `getUTCFullYear()`／`getUTCMonth()`／`getUTCDate()`，不要用本地時區 getter」——round 4 codex 指出這個規則本身雖然正確，但**沒辦法被可靠測試**：這個系統目前執行環境（開發機、CI、Playwright test runner）都是正時區偏移（例如台灣 UTC+8），UTC 午夜在正偏移環境下用本地 getter 讀回來仍然是同一天（只是時分不同），不會露出「用錯 getter」這個錯誤——真正會露出這個錯誤的是負偏移環境（例如 `America/Los_Angeles`，UTC-8），但這個專案這個 session 從未在任何一輪的測試裡刻意切換過 `process.env.TZ`，容易被漏掉、也容易讓人誤以為測試過了其實沒測到。
  - **推薦（最終版）**：不要求「記得用對 getter」，改成建一個**明確帶 `timeZone: "UTC"` 選項的 `Intl.DateTimeFormat`**，把時區安全性做進函式本身的設定裡，讓函式的正確性不依賴呼叫端或執行環境的系統時區——這正是這個 repo 既有 `src/domain/class-session/timezone.ts`（`parseTaipeiDatetimeLocal`／`formatTaipeiDatetime`）已經驗證過的既有解法，只是那份既有程式碼固定用 `timeZone: "Asia/Taipei"`（因為那是給使用者看的實際上課時間，跟真實地區有關），這裡改用 `timeZone: "UTC"`（因為 `AvailabilityException.date` 是 `@db.Date` 純日期欄位，沒有時分概念，UTC 才是這個欄位型別本身的正確錨點——`Date.UTC` 建構、透過 Prisma 寫入 `@db.Date` 欄位時，底層驅動程式本身就是用 UTC 年/月/日決定要存哪一天，如果錨定在 Asia/Taipei 午夜反而會因為時區偏移造成 UTC 年/月/日跟輸入的年/月/日不一致，見下方）。新增 `src/domain/teacher-availability/date-format.ts`，比照 `class-session/timezone.ts` 的既有寫法：
    ```ts
    const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

    const utcPartsFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // 明確用 Date.UTC 建構、再往返校驗，理由與既有 parseTaipeiDatetimeLocal 完全相同：
    // JS Date 對不存在的日期（例如 2/31）會靜默捲動成別的日期而不拋錯。
    export function parseAvailabilityExceptionDate(value: string): Date | null {
      const match = isoDatePattern.exec(value.trim());
      if (!match) return null;

      const [, year, month, day] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

      if (utcPartsFormatter.format(date) !== `${year}-${month}-${day}`) {
        return null;
      }

      return date;
    }

    export function formatAvailabilityExceptionDate(date: Date): string {
      return utcPartsFormatter.format(date);
    }
    ```
    （`en-CA` locale 的既有理由跟 `class-session/timezone.ts` 一樣：`Intl.DateTimeFormat` 用這個 locale 搭配 `year`/`month`/`day` 選項時輸出剛好是 `YYYY-MM-DD`，不需要另外組字串。）這兩個函式**不管呼叫時 `process.env.TZ` 是什麼值都會得到同樣的結果**，因為 `timeZone: "UTC"` 是寫死在 `Intl.DateTimeFormat` 的設定裡，不會去讀取執行環境的系統時區——這是這個修正版比 round 2/3「记得用 UTC getter」更根本的地方：正確性是這個函式的既有設計保證，不是呼叫端的自律。
  - `service.ts` 寫入時呼叫 `parseAvailabilityExceptionDate`（拒絕格式錯誤或不存在的日期），`read-service.ts`／頁面顯示時呼叫 `formatAvailabilityExceptionDate`，兩處都不直接使用 `new Date(dateString)` 或任何 `getFullYear()`/`getUTCFullYear()` 手寫呼叫。
  - **索引理由**：兩個 model 的所有讀取／刪除都會用 `teacherProfileId` 過濾（own-scoped），`AvailabilityException` 額外依 `date` 排序顯示，比照既有 `Enrollment`／`DemandResponse` 等 model 對常用查詢欄位建索引的既有慣例。
  - **外鍵刪除行為**：兩者都 `onDelete: Cascade`（跟著 `TeacherProfile` 被刪除，比照既有 `TeacherAvailability`／`DemandResponse` 等既有 model 對 `teacherProfileId` 外鍵的既有慣例——雖然目前沒有任何刪除 `TeacherProfile` 的既有路徑，維持慣例一致性）。

### D12 — 一次查詢同時回傳固定時段與例外，避免 N+1

- **推薦：`getOwnAvailabilityOverview()` 用 `Promise.all` 平行查兩個 model（`teacherAvailability.findMany`／`availabilityException.findMany`），不是兩個獨立呼叫由頁面各自呼叫一次。** 頁面本身一次就需要兩份資料同時渲染，沒有理由拆成兩次獨立呼叫（比照既有 `enrollment` domain D9「一次隨列表帶出，避免 N+1」的既有精神，雖然這裡不是 nested select 而是兩個獨立 model，但「一次拿齊頁面需要的所有資料」的原則相同）。

### D13 — 修正 `/teacher/dashboard` 的過時文案 + 新增可發現的連結

- 這不是本輪造成的新問題，是接手既有債務：`src/app/teacher/dashboard/page.tsx` 第 88–91 行與 `statusCopy.approved.body`（第 45 行）都還寫著「demand pool、availability 與 response flow 尚未在本 slice 開放」——demand pool／response flow 早就落地，這句話已經是錯的；本輪讓 availability 也落地後，這句話的最後一項也會變成錯的，繼續留著會誤導使用者以為這些功能都還沒做。
- **推薦**：
  1. 修正頁首說明（第 88–91 行）：拿掉「本 slice 不開放...」這句過時聲明。
  2. 修正 `statusCopy.approved.body`（第 45 行）：拿掉「Demand pool、availability 與 response flow 尚未在本 slice 開放」，改成中性描述目前已經開放的能力。
  3. **在 `approved` 狀態的操作區塊新增一個前往 `/teacher/availability` 的連結**（跟既有 `actionHref` 並列，不是取代）——這是延續 `admin-dashboard` 一輪 codex review 學到的教訓：一個功能如果沒有任何既有頁面連過去，等於使用者只能靠手動輸入網址才找得到，`/teacher/availability` 目前完全沒有任何既有頁面連結它（已用 `grep -rn "teacher/availability"` 核對過，只有文件裡提到，沒有任何 `<Link>` 或 `href` 指向它）。

### D14 — 文件對齊策略

- **推薦**：
  1. `docs/domain/data-model.md`：`TeacherAvailability`／`AvailabilityException` 兩節補上「已落地」標記與修正後的欄位清單（拿掉 `isRecurring`，`AvailabilityException.startTime`/`endTime` 標註為選填），並記錄 D3 訂下的 `blocked` 優先於 `extra_available` 判讀規則。
  2. `docs/domain/permissions-matrix.md`：`TeacherAvailability` 表格補上落地現況說明——`View own`（任何 `TeacherProfile` 狀態皆可，D9 修正版）／`Create`／`Delete`（僅 `approved`，D9 修正版）已落地，不可 `Edit`（D7），Organizer「Eligible」與 Admin 欄位仍是完整未來設計，V1 未開放（D6）。
  3. `docs/product/route-map.md`：`/teacher/availability` 該列的說明從「管理固定 availability 與 exception」補充成「已落地」。
  4. **修正（codex round 1 指出的問題，已採納）：`docs/domain/state-transition-details.md` 需要更新，不是排除在外。** 原始草稿誤把這份文件歸類成「規劃輸入文件」而跳過——它其實是既有 ClassSession 段落已經明確記載「沒有 `TeacherAvailability` 或任何排程資料可供檢查」（見 2.1）這句話的**前提**在本輪之後會變成不成立（資料確實存在了），如果不修正，這份「落地現況追蹤文件」會變成不準確，跟這份文件本身的既有定位矛盾。修正方式：把這句話改成「`TeacherAvailability`／`AvailabilityException` 資料已經存在（`teacher-availability` 一輪已落地），但媒合流程／`ClassSession` 建立時是否要比對這份資料、要用擋下還是提示的方式呈現衝突，是一個需要額外設計的獨立決策，本輪不接線」——保留「不接線」這個結論本身（1.2 已說明理由），只修正「資料不存在」這個現在已經不成立的前提。
  5. **不修改 `docs/scope/v1-scope.md`／`docs/domain/marketplace-rules.md`／`docs/product/PRD.md`**：延續本專案一貫只更新落地現況追蹤文件、不回頭改規劃輸入文件本身的既有慣例——這三份文件裡「Google Calendar two-way sync」的既有 non-goal 記載也不需要修改，本輪本來就沒有要做這件事。

## 6. 品牌與 UX 規則

- 表單文案清楚、溫和，星期幾用中文（週日／週一…週六），類型徽章用中文（封鎖／額外開放）。
- 兩個區塊的空狀態（還沒有任何固定時段／例外）要有清楚的引導文字，不是空白一片。

## 7. RWD Requirements

- `/teacher/availability` 是 Teacher 端既有頁面的同類頁面，必須 mobile-first（`docs/product/route-map.md` 既有 RWD 原則），比照既有 `/teacher/demands`／`/teacher/dashboard` 的既有版型與 360px 手機寬度要求。

## 8. 實作切片（Slice 1–3；施工前提：D1–D14 已拍板）

### Slice 1 — `teacher-profile/capability.ts` 搬遷 + Schema + domain service

- `src/domain/teacher-profile/capability.ts`（新檔案）：從 `demand-response/capability.ts` **搬遷**（不是複製）`requireApprovedTeacher()`／`getOwnTeacherProfileId()`（D10）；更新 `demand-response` 底下既有匯入處（`src/app/teacher/demands/[demandRequestId]/page.tsx`、`src/domain/demand-response/demand-read-service.ts`、`src/domain/demand-response/service.ts`）指向新位置；**先跑一次既有 `tests/smoke/teacher-demand-response.spec.ts`／`teacher-demand-pool.spec.ts` 確認搬遷沒有破壞既有行為**（純搬檔案 + 改 import path，不應該有任何測試斷言改變）。
- `prisma/schema.prisma`：`TeacherAvailability`（D1/D2/D3/D11）、`AvailabilityExceptionType` enum、`AvailabilityException`（D3/D4/D5/D11）、`TeacherProfile` 新增兩個反向關聯；跑 `npx prisma migrate dev`，核對 migration SQL——**修正（codex round 2 指出的問題，已採納）**：D11 的 schema 本身就含外鍵與索引，migration 不會只有 `CREATE TABLE`／`CREATE TYPE`，還會有 `ALTER TABLE ... ADD CONSTRAINT`（`teacherProfileId` 外鍵）與 `CREATE INDEX`（`@@index` 宣告的三個索引）——核對標準是「這些陳述式全部是新增性質（`CREATE TYPE`／`CREATE TABLE`／`CREATE INDEX`／新增的 `ADD CONSTRAINT` 外鍵），沒有任何一行修改或刪除既有 table／column／constraint」，不是「只能出現 `CREATE TABLE`／`CREATE TYPE` 兩種陳述式」。
- `src/domain/teacher-availability/date-format.ts`：`parseAvailabilityExceptionDate`／`formatAvailabilityExceptionDate`（D11 最終版）。
- `src/domain/teacher-availability/validation.ts`：`validateTeacherAvailabilityInput`／`validateAvailabilityExceptionInput`（D3/D4/D5/D11）。
- `src/domain/teacher-availability/service.ts`：四個寫入函式（D6/D7/D9），皆用 `requireApprovedTeacher()`（從新位置 `teacher-profile/capability.ts` 匯入）。
- `src/domain/teacher-availability/read-service.ts`：`getOwnAvailabilityOverview()`（D8/D9，`requireUser()` 把關，不要求 approved）。
- **驗證**：
  1. throwaway `tsx` script 直接呼叫 `validateTeacherAvailabilityInput`／`validateAvailabilityExceptionInput`／`parseAvailabilityExceptionDate`／`formatAvailabilityExceptionDate` 這幾個不需要 `requireApprovedTeacher()` 的純函式（涵蓋邊界：`dayOfWeek` 超出 0–6、`startTime`/`endTime` 格式錯誤、`startTime >= endTime`、`AvailabilityException` 只填一個時間、`reason`/`locationArea` 超過長度上限、**`date` 是不存在的日期如 `2026-02-31`（斷言 `parseAvailabilityExceptionDate` 回傳 `null`，不是被 `Date.UTC` 悄悄捲成 3 月，見 D11 最終版）**）。
  2. 四個寫入函式與 `getOwnAvailabilityOverview()` 因為呼叫 `requireApprovedTeacher()`／`requireUser()` 而無法在 Node context 直接呼叫（本專案這個 session 已反覆確認過的既有限制），驗證延到 Slice 2 的瀏覽器操作。

### Slice 2 — UI

- `src/app/teacher/availability/page.tsx`／`actions.ts`：三種顯示狀態（D7/D9）。
- `src/app/teacher/dashboard/page.tsx`：修正過時文案 + 新增連結（D13）。
- **驗證**：瀏覽器實際操作——
  1. 建立一個 `approved` teacher 帳號，新增固定時段（含邊界：星期六、`23:00`–`23:59` 這種跨到當天最後一分鐘的合法區間）、新增例外（整天封鎖、部分時段額外開放兩種情境都要試）、刪除各一筆，確認畫面即時反映。
  2. 建立一個 `suspended` teacher 帳號（含既有的固定時段／例外資料），確認 `/teacher/availability` 顯示唯讀版本（看得到資料，但沒有新增表單、沒有刪除按鈕）。
  3. 確認 `missing`／`draft`／`submitted`／`rejected` 狀態顯示引導文案而非功能本體或 500 錯誤。
  4. 確認 `/teacher/dashboard` 的連結能正確導到 `/teacher/availability`。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/teacher-availability.spec.ts`：
  - `missing`／`draft`／`submitted`／`rejected` 四種狀態看到引導文案而非功能本體。
  - **`suspended` 看得到既有資料，但看不到新增表單／刪除按鈕，且伺服器端真的會擋下寫入，不是只有 UI 隱藏**（見 D9）。**修正（codex round 2 指出的問題，已採納）：不能「直接呼叫 Server Action」測試——Playwright 沒有辦法脫離真正的表單提交去呼叫一個綁在 `action={fn}` 上的 Next.js Server Action，且 `suspended` 頁面本來就刻意不渲染任何寫入表單，沒有表單可以送。可行的測試手法：先用 `approved` 狀態載入 `/teacher/availability`（這時頁面上真的有新增表單），接著直接用 Prisma 把這個老師的 `TeacherProfile.status` 改成 `suspended`（不重新整理頁面，瀏覽器裡還留著剛剛載入時、approved 狀態下渲染出來的表單），然後提交這個「已經過期」的表單，斷言伺服器回傳明確的拒絕（不是靜默失敗或 500），且資料庫裡沒有新增任何記錄——這證明伺服器端權限檢查是真正的防線，不是只靠 UI 隱藏表單來擋，即使有人繞過 UI（例如瀏覽器分頁在狀態被改變前後保留了舊的表單）也擋得住。
  - 建立固定時段成功、邊界驗證（`dayOfWeek`/`startTime`/`endTime` 格式與大小關係、`locationArea` 超長）——**這些邊界驗證的表單輸入需要繞過瀏覽器原生的 `<select>`/`<input type="time">` 限制才能真正送到伺服器端驗證**（比照既有 `tests/smoke/teacher-demand-response.spec.ts` 「rejects a message that is too short」測試用 `form.noValidate = true` 繞過原生驗證的既有手法，證明伺服器端才是權威，不是只驗證了瀏覽器擋下的行為）。
  - 建立例外成功（含整天與部分時段兩種）、邊界驗證（`reason` 超長、只填一個時間）。
  - **修正（codex round 3 指出的問題，已採納；round 4 進一步修正）：`date` 邊界驗證需要明確涵蓋不存在的日期（如 `2026-02-31`）與儲存/讀回的往返正確性，且測試手法本身要能真的露出時區 bug，不能只是「這個環境剛好沒事」。** D11 最終版把日期處理集中到 `parseAvailabilityExceptionDate`／`formatAvailabilityExceptionDate` 兩個直接可測、不依賴 `requireApprovedTeacher()` 的純函式（`Intl.DateTimeFormat` 明確帶 `timeZone: "UTC"`）。這裡新增一個**獨立於 UI、直接呼叫這兩個函式**的永久測試（不透過瀏覽器頁面重新整理去驗證，理由見下）：
    1. `parseAvailabilityExceptionDate("2026-02-31")` 斷言回傳 `null`（不是被 `Date.UTC` 悄悄捲成 3 月）。
    2. 呼叫 `parseAvailabilityExceptionDate("2026-02-28")` 取得 `Date`，**在呼叫 `formatAvailabilityExceptionDate` 之前，把 `process.env.TZ` 暫時設成 `"America/Los_Angeles"`**（測試結束後或 `try/finally` 裡還原成原始值，避免污染同一個 worker 之後跑的其他測試），斷言格式化結果仍然是 `"2026-02-28"`，不是 `"2026-02-27"`。**這一步刻意選一個負時區偏移的環境，理由是這個專案目前所有既有執行環境（開發機、CI、Playwright test runner）都是正時區偏移，UTC 午夜在正偏移環境下即使不小心用了本地時區 getter，讀回來的日期通常還是同一天（只有時分不同），沒辦法真的露出「用錯 getter」這個錯誤；只有在負偏移環境下，這個錯誤才會讓日期真的偏移一整天，變成可以被斷言抓到的具體錯誤**（codex round 4 指出的既有測試設計問題，原本規劃「建立後重新整理頁面比對顯示」這個手法即使實作真的用錯了 getter，在這個專案目前的執行環境下也不會測出來，是一個看似驗證了、其實沒驗證到的假安全感）。
    3. 額外用一次瀏覽器 E2E（Slice 2 既有驗證的延伸）確認整條路徑真的有串起來（建立例外 → 頁面顯示正確日期），但這一步的目的是「接線正確」，不是「時區安全」——時區安全的精確保護由上面兩點的直接函式呼叫負責。
  - 刪除自己的記錄成功。
  - **修正（codex round 3 指出的問題，已採納）：IDOR 測試的識別碼寫法有歧義，容易被誤讀成用 `teacherProfileId` 呼叫刪除，那樣即使完全沒有擁有權檢查也會回傳 `not_found`（因為 `teacherProfileId` 本來就不會等於任何一筆記錄自己的 `id`），變成一個測不出真正漏洞的假陽性測試。** 正確做法：Teacher A 建立一筆固定時段／例外，取得這筆記錄**自己的 `id`**（不是 `teacherProfileId`）；Teacher B（另一位 approved teacher）用這個**記錄 id** 呼叫 `deleteOwnTeacherAvailability`／`deleteOwnAvailabilityException`，斷言回傳明確的 `not_found` 錯誤碼，且 Teacher A 的這筆記錄在資料庫裡仍然存在、內容不變。
  - 完整 UI E2E 流程（新增 → 顯示 → 刪除 → 消失）。
- 更新 `docs/domain/data-model.md`（D14 第 1 點）、`docs/domain/permissions-matrix.md`（D14 第 2 點）、`docs/product/route-map.md`（D14 第 3 點）、`docs/domain/state-transition-details.md`（D14 第 4 點）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`（含重跑既有 `teacher-demand-response.spec.ts`／`teacher-demand-pool.spec.ts` 確認 `capability.ts` 搬遷沒有回歸）。

### Slice 順序

Slice 1 必須先完成（`capability.ts` 搬遷 + domain service 先於 UI）。Slice 3 排最後。

## 9. Verification Planning

- Domain 層（Slice 1）：`capability.ts` 搬遷後的既有測試回歸 + throwaway `tsx` script 只驗證不需要 `requireApprovedTeacher()` 的純驗證函式；寫入函式與讀取函式的驗證延到 Slice 2 的瀏覽器操作（理由見 Slice 1 驗證清單）。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對，涵蓋 approved／suspended／非 approved 三種狀態。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process，含 `capability.ts` 搬遷的既有測試回歸）。

## 10. Rollback 總則

- Slice 1 的 migration 只新增兩個新 model 與一個新 enum，本機開發資料庫可用 `prisma migrate reset` 復原，不影響任何已部署環境（本專案目前沒有已部署環境）。
- 本輪觸碰既有已出貨程式碼的地方有兩處：(1) `/teacher/dashboard` 的文案修正（D13）——純文字內容變更，不改變任何既有的狀態轉換或資料邏輯；(2) `requireApprovedTeacher()`／`getOwnTeacherProfileId()` 從 `demand-response/capability.ts` 搬到 `teacher-profile/capability.ts`（D10）——純粹是檔案位置與 import path 變更，函式本身的邏輯與行為完全不變，回歸驗證要求見 Slice 1（重跑既有 `teacher-demand-response.spec.ts`／`teacher-demand-pool.spec.ts`）。兩者都不改變任何既有的狀態轉換或資料邏輯，回滾任一部分都不影響任何既有資料的可見性或正確性，可以安全整批 `git revert`。
- 刪除自己的 `TeacherAvailability`／`AvailabilityException` 是單向動作（沒有「復原已刪除記錄」的能力），但這跟這個 app 其他刪除動作的既有性質一致（見 D7），且刪除的是使用者自己的資料、不影響任何其他人，重新建立即可，不需要特別的回滾機制。

<!-- codex-peer-reviewed: 2026-07-29T13:46:39Z rounds=5 verdict=approved -->
