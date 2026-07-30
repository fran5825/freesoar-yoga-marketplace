# Organizer Profile Edit (displayName) — Implementation Plan

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–5 節再開始施工，不要跳著讀。`## 3. 產品主人決策 Gate（D1–D6）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

`/organizer/profile`（`src/app/organizer/profile/page.tsx`）目前已經是一個完整的 Organizer 自助管理頁：尚未建立 `OrganizerProfile` 時提供建立表單（`createOrganizerProfileAction`），已建立後提供一個**隨時可用的組織資訊編輯表單**（`updateOrganizationAction` → `updateOwnOrganization()`，`src/domain/organizer-profile/service.ts:207-285`），可以編輯 `name`／`type`／`contactName`／`contactEmail`／`contactPhone`。

唯獨 `OrganizerProfile.displayName`（團主顯示名稱本身，不是組織名稱）沒有對應的編輯路徑——`page.tsx:150-155` 建立後直接把它渲染成靜態文字，旁邊寫著「團主顯示名稱建立後暫不開放於此頁編輯；如需調整，請聯繫平台管理者」。這句 UI 文案**不是任何 plan 或 spec 裡記載過的產品決策**（已 grep 全部 `docs/`，只有這輪的教師端功能提到類似措辭，`organizer-demand-request-foundation` 的既有 D1 只講「建立」這個動作的例外，完全沒提到「建立後 displayName 永久鎖定」），純粹是一個從未補上的實作缺口。

這正是 `teacher-profile-edit`（上一輪）在 Teacher 端補的同一類缺口，這輪對稱地補上 Organizer 端——但範圍**明顯更小**：`OrganizerProfile` 完全沒有 `status` 欄位（已確認 `prisma/schema.prisma:131-143`），沒有 draft/approve/suspend 這種狀態機，本來就是任何 signed-in user 自助建立即可用（`organizer-demand-request-foundation` D1），所以這輪**不需要**像 Teacher 那樣處理「哪些狀態可以編輯」「suspended 要不要唯讀」「要不要讓 Admin 事後看得到改了什麼」這些問題——這些問題的前提（狀態機、審核流程、Admin 需要事後補救的信任落差）在 Organizer 這邊根本不存在。

**這輪的目標**：讓已經建立 `OrganizerProfile` 的 Organizer 可以編輯自己的 `displayName`。

## 2. 範圍界線

### 2.1 本輪要做的事

- 新增 `updateOwnOrganizerProfile()` domain service function（`src/domain/organizer-profile/service.ts`）：任何已建立 `OrganizerProfile` 的使用者都能呼叫，驗證規則跟建立時的 `displayName` 必填規則一致。
- 在既有 `/organizer/profile` 頁面上，把目前寫死的「團主顯示名稱建立後暫不開放於此頁編輯」那段靜態文字改成一個可編輯的小表單（**不新增路由**——跟 Teacher 端不同，這裡本來就已經有一個現成的、輕量的 Server Component 頁面在做同一類事情，直接在上面加一個表單即可，見 D4）。

### 2.2 本輪明確不包含（Non-goals，不得偷偷併入本輪）

- **狀態閘門／唯讀模式**：`OrganizerProfile` 沒有 `status` 欄位，這輪不新增一個（沒有被要求，也沒有既有的 suspend-analog 概念可以套用）。
- **Admin 代編輯**：`permissions-matrix.md` 理想表格裡 `Edit organizer profile` 的 Admin 欄位維持完整未來設計，這輪不落地。
- **Organization 欄位的編輯規則變更**：`updateOwnOrganization()` 既有的編輯能力與驗證規則完全不動，這輪只新增 `displayName` 這一個獨立的、屬於 `OrganizerProfile` 本身的欄位。
- **重新命名限制／濫用防範（例如改名頻率限制、歷史紀錄）**：沒有被要求，也沒有任何既有先例支持這種機制（`updateOwnOrganization()` 對 `name` 欄位也沒有這類限制）。

## 3. 產品主人決策 Gate（D1–D6）

### D1 — 可編輯欄位：只有 `displayName`

`OrganizerProfile` 只有 `id`／`userId`／`organizationId`／`displayName`／`createdAt`／`updatedAt`（`prisma/schema.prisma:131-143`）。`id`／`userId`／`createdAt`／`updatedAt` 不可編輯；`organizationId` 是建立時由 transaction 決定的關聯，不透過這個表單改變。唯一有意義、值得開放編輯的欄位就是 `displayName`。

### D2 — 沒有狀態閘門：任何已建立 `OrganizerProfile` 的使用者都能編輯

`OrganizerProfile` 沒有狀態機，建立當下就是「可用」狀態，不像 `TeacherProfile` 需要 Admin 審核才能進入 `approved`。因此 `updateOwnOrganizerProfile()` 只需要「這個使用者有沒有自己的 `OrganizerProfile`」這個檢查，不需要額外的狀態判斷。

### D3 — 驗證規則：重用建立時的必填規則

`validateCreateOrganizerProfileInput()`（`validation.ts:31-74`）對 `displayName` 的規則是「非空白字串」（`isBlank` 檢查）。編輯時沿用同一條規則——已建立的團主資料不應該因為編輯而被清空成空字串。新增一個小的 `validateUpdateOwnOrganizerProfileInput()`，只驗證 `displayName` 這一個欄位（不像 `validateCreateOrganizerProfileInput` 還要驗證 `organizationName`／`organizationType`，那兩個欄位屬於建立當下的 `Organization`，跟這裡無關）。

### D4 — UI：在既有 `/organizer/profile` 頁面上加一個小表單，不新增路由

跟 Teacher 端不同：`/teachers/join` 是一個複雜的 client component，服務的是完全不同的申請/審核生命週期，所以上一輪選擇新開一個 `/teacher/profile` 路由。這裡的 `/organizer/profile`（`src/app/organizer/profile/page.tsx`）本來就已經是一個簡單的 Server Component + Server Action 頁面，而且已經在同一個頁面上用同樣的版型編輯 `Organization` 資訊——直接在「已建立」那個 section 裡，把目前的靜態文字段落換成一個小的 inline 表單（單一欄位 `displayName` + 一個「儲存」按鈕），比照同一個檔案裡 `updateOrganizationAction` 表單的既有寫法（`inputClassName`、`Field` 元件、`redirectWithFeedback` 版型），不需要新的頁面或新的元件庫。

### D5 — 不新增 Notification

`updateOwnOrganization()`（既有的 Organization 編輯）沒有觸發任何通知，這輪新增的 `displayName` 編輯屬於同一類「自己對自己資源的低風險寫入」，不新增任何 notification type，也不呼叫 `notifyUsers()`。

### D6 — 文件對齊策略

1. `docs/domain/data-model.md`：`OrganizerProfile` 段落補上「`displayName` 可由 Organizer 自助編輯」的說明。
2. `docs/domain/permissions-matrix.md`：Organization / OrganizerProfile 表格的 `Edit organizer profile` 這一列補上 V1 落地範圍說明——`Own`（Organizer）已落地（只有 `displayName`，任何已建立 `OrganizerProfile` 的狀態都能編輯，因為沒有狀態機），`Admin` 欄位仍是完整未來設計。
3. `docs/product/route-map.md`：`/organizer/profile` 該列的既有描述（「管理 organizer profile 與 organization 基本資料」）已經涵蓋這個新能力，不需要修改文字，只需確認沒有變得不準確。

## 4. 實作切片（Slice 1–3；施工前提：D1–D6 已拍板）

### Slice 1 — Domain service

- `src/domain/organizer-profile/validation.ts`：新增 `validateUpdateOwnOrganizerProfileInput()`（見 D3）。
- **修正（codex round 1 指出的問題，已採納）**：`src/domain/organizer-profile/input.ts` 也要新增對應的表單輸入正規化——`UpdateOwnOrganizerProfileFormInput`（`{ displayName: string }`）與 `normalizeUpdateOwnOrganizerProfileInput()`，比照同一個檔案裡既有的 `UpdateOwnOrganizationFormInput`／`normalizeUpdateOwnOrganizationInput()` 的既有寫法（重用其中已有的 `normalizeOptionalString()` helper：trim 前後空白，純空白字串轉成 `null`）。原本的規劃只提到 Slice 2 的 action 要「比照既有正規化」，卻沒有明確要求新增這個可匯入的 normalizer，會讓零背景 Builder 不知道要建立它，或直接把前後帶空白的原始字串寫入 `displayName`。
- `src/domain/organizer-profile/service.ts`：新增 `updateOwnOrganizerProfile()`——驗證失敗直接回傳；`requireUser()` 找自己的 `OrganizerProfile`（`findUnique({where:{userId}}`），不存在回傳 `organizer_profile_required`；`updateMany({where:{userId}, data:{displayName}})`（比照 `updateOwnOrganization()` 的既有 `updateMany` + `count===0` 檢查寫法，即使這裡沒有併發風險，維持同一套錯誤處理版型，也讓 `organizer_profile_required` 這個 race 情境——理論上不會發生，因為 `userId` 是自己的 session，但保持與既有函式一致的防禦寫法）；成功後 `findUniqueOrThrow` 撈回最新資料回傳。所有 Prisma 呼叫包在 `try/catch` 裡，`catch` 落回一個通用失敗 error code，比照既有 `updateOwnOrganization()` 的既有結構。
- **驗證**：throwaway `tsx` script 直接呼叫 `validateUpdateOwnOrganizerProfileInput()`（空白字串被擋下、正常字串通過）與 `normalizeUpdateOwnOrganizerProfileInput()`（純空白轉成 `null`、前後空白被 trim）；`updateOwnOrganizerProfile()` 本身因依賴 `requireUser()`，驗證延到 Slice 2 的瀏覽器操作。

### Slice 2 — UI

- `src/app/organizer/profile/actions.ts`：新增 `updateOrganizerProfileAction(formData)`，比照既有 `updateOrganizationAction` 的既有寫法（呼叫 Slice 1 新增的 `normalizeUpdateOwnOrganizerProfileInput()` + `redirectWithFeedback`）。
- `src/app/organizer/profile/page.tsx`：把「已建立」section 裡的靜態文字段落（`page.tsx:153-155`）換成一個 inline 編輯表單（`displayName` 輸入框 + 儲存按鈕），移除「暫不開放於此頁編輯」這句過時文案。
- **驗證**：瀏覽器實際操作——
  1. 建立一個已有 `OrganizerProfile` 的帳號，確認 `/organizer/profile` 顯示可編輯的 `displayName` 欄位並預填既有值，修改後儲存成功、畫面即時反映新值。
  2. 確認送出空白 `displayName` 時被伺服器端擋下（不是只靠瀏覽器原生 `required`）。
  3. 確認既有的 `Organization` 編輯表單（name/type/contact*）行為完全不受影響。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/organizer-profile-edit.spec.ts`：
  - 直接呼叫 `validateUpdateOwnOrganizerProfileInput()` 確認空白字串被擋下、正常字串通過（比照這一輪其他 plan 的既有手法，獨立於 UI 驗證正確的規則）。
  - **修正（codex round 1 指出的問題，已採納）**：成功編輯測試必須**同時建立第二位 Organizer 作為 sentinel**，編輯第一位的 `displayName` 後，額外查詢第二位的 `OrganizerProfile.displayName` 確認完全沒被改動。**理由**：`updateOwnOrganizerProfile()` 用 `updateMany({where:{userId}, ...})` 實作 own-scope 限制，如果 Builder 把 `where` 條件寫錯（例如漏掉 `userId` 篩選，或篩選錯欄位），原本規劃的測試（只確認「目標帳號成功更新」＋「沒有 profile 時被拒絕」）完全測不出來——兩種情境即使 `where` 條件錯到「更新所有 OrganizerProfile」也照樣會通過。沒有 sentinel 帳號，就不是真正的 own-scope 回歸測試。
  - 成功編輯：修改 `displayName`，確認畫面與資料庫都反映新值。
  - 邊界驗證：留空 `displayName` 時伺服器端擋下（繞過瀏覽器原生 `required`，比照既有 `form.noValidate = true` 手法），資料庫沒有被改成空字串。
  - 沒有 `OrganizerProfile` 的使用者呼叫這個 action 會被擋下（`organizer_profile_required`），不會意外建立一筆新資料。
  - 既有 `Organization` 編輯表單在同一頁面上仍然正常運作（回歸確認，證明新表單沒有破壞既有表單）。
- 更新 `docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`（D6）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 5. Verification Planning

- Domain 層（Slice 1）：throwaway script 確認純驗證函式行為；`updateOwnOrganizerProfile()` 因依賴 `requireUser()`，驗證延到 Slice 2。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 測試層（Slice 3）：Playwright smoke test，涵蓋成功編輯、伺服器端驗證、無 profile 情境、既有 Organization 表單回歸。

<!-- codex-peer-reviewed: 2026-07-30T01:53:37Z rounds=2 verdict=approved -->
