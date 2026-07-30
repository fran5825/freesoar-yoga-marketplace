# Teacher Availability Edit — Implementation Plan

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–5 節再開始施工，不要跳著讀。`## 3. 產品主人決策 Gate（D1–D7）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

`teacher-availability` 一輪落地了 `/teacher/availability`：approved 老師可以新增／刪除自己每週固定的可授課時段（`TeacherAvailability`）與特定日期例外（`AvailabilityException`），但**沒有編輯**——那一輪的 D7 明確寫著「沒有 `Edit` 這個動作——本輪只提供新增與刪除，沒有編輯既有記錄的功能」，是刻意保留給未來的缺口，不是遺漏。

結果是：老師想把「週六 09:00–10:00」改成「週六 09:00–11:00」，或把地區欄位的錯字修正，唯一的辦法是刪掉整筆重建——刪除後、重建前這段時間，這筆時段完全不存在；如果同時有多筆想調整，使用者體驗也很破碎（要先記住原本的值，刪除，再重新輸入一次）。`docs/domain/permissions-matrix.md` 現有的 TeacherAvailability V1 落地範圍說明也已經明確記載了這個限制。

**這輪的目標**：讓 approved 老師可以直接編輯自己既有的固定時段與日期例外，不需要刪除重建。

## 2. 範圍界線

### 2.1 本輪要做的事

- 新增 `updateOwnTeacherAvailability(availabilityId, input)` domain service function（`src/domain/teacher-availability/service.ts`）。
- 新增 `updateOwnAvailabilityException(exceptionId, input)` domain service function（同一檔案）。
- 在 `/teacher/availability` 既有頁面上，每一筆固定時段／例外旁邊加一個「編輯…」的可收合表單（比照 `src/app/admin/teachers/page.tsx` 既有的 `<details>`／`<summary>` 版型），預填既有值，送出後整筆覆寫（跟建立時同一組必填規則）。

### 2.2 本輪明確不包含（Non-goals，不得偷偷併入本輪）

- **部分欄位更新（PATCH 語意）**：這輪的編輯是「整筆覆寫」（跟 `updateOwnOrganization()` 的既有慣例一致），不是只更新使用者這次有改動的欄位。表單一律送出全部欄位，未填的選填欄位視為清空。
- **狀態閘門變更**：`suspended` 老師依然唯讀、不能編輯或刪除（`teacher-availability` D9 既有規則不變）；這輪新增的編輯動作沿用同一個 `requireApprovedTeacher()` 把關，approved 才能呼叫。
- **變更 `blocked`／`extra_available` 的既有判讀規則**：`teacher-availability` D3 記載的「`blocked` 優先於 `extra_available`」文件層規則不變，這輪不新增任何重疊檢查或強制邏輯。
- **通知／稽核**：`TeacherAvailability`／`AvailabilityException` 的新增、刪除都沒有通知，這輪新增的編輯屬於同一類自助寫入，不新增任何 notification type。

## 3. 產品主人決策 Gate（D1–D7）

### D1 — 可編輯欄位：跟建立時完全一樣，重用既有驗證函式

固定時段：`dayOfWeek`／`startTime`／`endTime`／`locationArea`，驗證重用既有的 `validateTeacherAvailabilityInput()`（`src/domain/teacher-availability/validation.ts`）——跟建立時要求完全一致（`dayOfWeek` 0–6、`HH:mm` 格式且 `startTime < endTime`、`locationArea` 上限 100 字，選填）。

日期例外：`date`／`type`／`startTime`／`endTime`／`reason`，驗證重用既有的 `validateAvailabilityExceptionInput()`——跟建立時要求完全一致（`date` 用 `parseAvailabilityExceptionDate()` 驗證、`type` 必須是 `blocked`/`extra_available`、`startTime`/`endTime` 必須同時提供或同時不提供、`reason` 上限 500 字）。

不重新發明驗證邏輯——這是「整筆覆寫」的編輯，套用的規則跟建立一筆新記錄時應該完全相同，沒有理由分裂成兩份幾乎一樣的驗證函式。

### D2 — 狀態閘門：approved 才能編輯，跟建立/刪除完全一致

`updateOwnTeacherAvailability()`／`updateOwnAvailabilityException()` 都用 `requireApprovedTeacher()`（`src/domain/teacher-profile/capability.ts`）把關，跟既有的 `createOwnTeacherAvailability()`／`deleteOwnTeacherAvailability()`／`createOwnAvailabilityException()`／`deleteOwnAvailabilityException()` 用的是同一個函式。`suspended` 老師唯讀查看、不能編輯（`teacher-availability` D9 既有規則，這輪不變）。

**修正（codex round 1 指出的問題，已採納）**：`/teacher/availability` 頁面目前 suspended 狀態下顯示的既有文案是「帳號目前暫停中，暫時無法新增或刪除可授課時間，但你仍然可以查看既有資料。」——這句話現在少講了一件事：suspended 也不能編輯。這輪要把這句文案改成「暫時無法新增、編輯或刪除可授課時間」，否則畫面上的能力說明會變得不完整、誤導使用者以為編輯可能還開著。既有測試裡斷言這句文案完整字串的地方（`tests/smoke/teacher-availability.spec.ts` 的 suspended 測試）也要跟著更新成新文案，否則會直接測試失敗。

### D3 — Own-scope／IDOR 防護：比照既有 `deleteOwnTeacherAvailability()` 的既有寫法

```ts
const updateResult = await prisma.teacherAvailability.updateMany({
  where: { id: availabilityId, teacherProfileId },
  data: { dayOfWeek, startTime, endTime, locationArea },
});

if (updateResult.count === 0) {
  return { ok: false, code: "not_found", message: "找不到這筆固定時段，或你沒有權限操作。" };
}
```

`updateMany` 帶 `{ id, teacherProfileId }` 雙重篩選——跟既有 `deleteOwnTeacherAvailability()`／`deleteOwnAvailabilityException()` 的既有 IDOR 防護完全同一個模式：另一位老師傳自己的記錄 id 進來，`teacherProfileId` 篩選不會比對到，`count === 0`，回傳跟刪除一致的 `not_found` 訊息（`"找不到這筆固定時段，或你沒有權限操作。"`／`"找不到這筆例外，或你沒有權限操作。"`，原字重用既有訊息，不重新造詞）。不需要額外的鎖——這是單一使用者編輯自己單一一列資料，沒有多方搶同一份資源的併發不變量需要保護（跟 `teacher-availability` D5 對刪除動作的既有判斷理由一致）。

### D4 — UI：每筆記錄旁邊加一個「編輯…」可收合表單，不是獨立頁面

`/teacher/availability` 頁面本身不動既有結構（三種顯示狀態、新增表單、列表），只在既有列表的**每一個項目**裡加一個 `<details>`／`<summary>「編輯…」` 區塊（比照 `src/app/admin/teachers/page.tsx` 既有的 `<details>` 版型，`teacher-profile-edit` 那一輪也用同一個版型幫 Admin 補過可收合的欄位內容，這是這個 repo 已經有的既有慣例），展開後是一個預填既有值的表單（欄位版型直接照抄頁面下方既有的「新增」表單），送出後整筆覆寫。預設收合，避免每筆記錄都攤開一個完整表單、讓列表變得很長很亂。

固定時段的編輯表單欄位：`dayOfWeek`（`<select>`，`defaultValue={entry.dayOfWeek}`）、`startTime`／`endTime`（`<input type="time">`，`defaultValue={entry.startTime}`／`{entry.endTime}`）、`locationArea`（`<input>`，`defaultValue={entry.locationArea ?? ""}`）。

日期例外的編輯表單欄位：`date`（`<input type="date">`，`defaultValue={formatAvailabilityExceptionDate(entry.date)}`——這個函式本來就已經是 `@/domain/teacher-availability/date-format` 既有匯出、頁面本來就已經 import 在用）、`type`（radio，`defaultChecked` 依 `entry.type` 決定，不能像建立表單一樣寫死 `blocked` 預設勾選）、`startTime`／`endTime`（選填，`defaultValue={entry.startTime ?? ""}`／`{entry.endTime ?? ""}`）、`reason`（`<textarea>`，`defaultValue={entry.reason ?? ""}`）。

**修正（codex round 1 指出的問題，已採納）**：新增表單原本的欄位用的是靜態 `id`（例如 `id="dayOfWeek"`、`id="date"`）。編輯表單如果直接照抄同一組靜態 `id`，列表裡每一筆記錄各自的編輯表單就會重複使用同樣的 `id`——多筆記錄同時存在時，`<label htmlFor="dayOfWeek">` 只會對應到 DOM 裡第一個 `id="dayOfWeek"` 的欄位，其餘筆記錄的編輯表單欄位會失去正確的 label 關聯（無障礙缺陷，也會讓依賴 `getByLabel()` 的測試行為不可預期）。每筆編輯表單的欄位 `id`／`htmlFor` 都必須帶上該筆記錄自己的 `id` 讓它唯一，例如 `id={\`edit-dayOfWeek-${entry.id}\`}`／`htmlFor={\`edit-dayOfWeek-${entry.id}\`}`，`date`／`startTime`／`endTime`／`locationArea`／`reason` 等欄位都要套用同一個命名規則。新增表單本身的既有 `id`（`dayOfWeek`、`date` 等）維持不變，只有這輪新增的編輯表單需要這樣做。

**修正（codex round 1 指出的問題，已採納）**：新增這批編輯表單後，頁面上同時會有「新增表單」跟「N 筆記錄各自的編輯表單」，且每筆記錄的刪除表單跟編輯表單都各自帶一個 `name="availabilityId"`／`name="exceptionId"` 的 hidden input——這代表**既有測試檔案裡任何假設「這個 name 的 hidden input 在頁面上只有一個」的 locator，在這輪之後都會變成比對到多個元素**，包含 `tests/smoke/teacher-availability.spec.ts` 既有 IDOR 測試裡用 `page.locator('input[name="availabilityId"]')`／`page.locator('input[name="exceptionId"]')` 鎖定 Teacher B 自己那一筆記錄的既有寫法（原本頁面上只有刪除表單、只有一筆記錄時這樣寫沒問題，這輪之後同一頁面會有「刪除表單的 hidden input」＋「編輯表單的 hidden input」，即使兩者的 `name`相同、值也相同，數量已經不再是 1）。Slice 3 必須把這些既有 locator 改成明確排除編輯表單（例如改用刪除表單特有的 CSS 選擇器範圍，或直接鎖定 `<form action={deleteTeacherAvailabilityAction}>` 這個表單本身），不能假設全頁只有一個符合的 hidden input。同理，既有測試裡用 `page.getByLabel("日期")`／`page.getByLabel("開始時間", { exact: true })` 等鎖定「新增表單」欄位的既有寫法，在有既有記錄（因此有編輯表單）的情境下會失效——**這不是 `id` 是否唯一的問題**：`getByLabel()` 是用 `<label>` 的可見文字（accessible name）比對，不是用 `id`；編輯表單的日期欄位如果沿用同樣的中文標籤文字「日期」，即使 `id`／`htmlFor` 已經照上一段改成每筆記錄唯一，`getByLabel("日期")` 還是會同時比對到新增表單的「日期」跟每一筆編輯表單各自的「日期」——`<details>` 未展開只是視覺上不可見，DOM 節點還在，Playwright 的 `getByLabel()` 在定位階段不看可見性，一樣會判定成多個相符元素而丟出 strict-mode 例外。真正的解法是**測試裡用表單／清單項目本身的容器來限定範圍**（例如先鎖定 `<form action={createTeacherAvailabilityAction}>` 這個新增表單本身，或鎖定特定 `<li>` 項目，再從裡面找欄位），不是依賴欄位標籤文字全站唯一——這跟這一輪 session 稍早（`teacher-availability` 第一次落地時）已經用過的既有技巧一致（用 `form:has(...)`／`li:has-text(...)` 這類容器範圍鎖定，不是假設整頁只有一個符合的欄位）。Slice 3 動工前要先重新檢查 `tests/smoke/teacher-availability.spec.ts` 裡所有既有的 `getByLabel()` 呼叫，確認在「有既有記錄」的測試情境下依然唯一，不唯一的要改成容器範圍鎖定。

隱藏欄位帶 `availabilityId`／`exceptionId`（`entry.id`），比照既有刪除表單的既有寫法。

### D5 — 不新增 Notification

跟既有的新增／刪除一致，這輪不新增任何 notification type，也不呼叫 `notifyUsers()`。

### D6 — 錯誤碼與訊息：比照既有 create/delete 的既有版型

```ts
export type UpdateOwnTeacherAvailabilityErrorCode =
  | "authentication_required"
  | "approved_teacher_required"
  | "validation_failed"
  | "not_found"
  | "update_failed";
```

（`AvailabilityException` 版本同構，只是型別/訊息換成例外的用詞。）驗證失敗訊息沿用「新增前，請先確認以上資訊。」的同一種通用訊息風格，改成「儲存前，請先確認以上資訊。」（比照 `teacher-profile-edit`／`organizer-profile-edit` 兩輪對編輯動作一致採用的措辭）。成功訊息：「已更新固定可授課時段。」／「已更新日期例外。」。所有 Prisma 呼叫包在 `try/catch` 裡，`catch` 落回 `update_failed`，比照既有函式的既有結構。

### D7 — 文件對齊策略

1. `docs/domain/permissions-matrix.md`：TeacherAvailability 表格既有的「沒有 `Edit` 這個動作」這句話已經不成立，補上「Edit 已落地，approved-only，重用建立時的驗證規則」的說明。
2. **修正（codex round 1 指出的問題，已採納）**：`docs/domain/data-model.md` 的 `TeacherAvailability` 段落現在明確寫著「沒有 `updatedAt`：不提供編輯，只有新增／刪除」——這句話這輪之後會變成錯的，不能只在旁邊「補一句」就算對齊，那樣會留下兩句互相矛盾的權威文件（一句說沒有編輯，另一句說支援編輯）。**必須整句改寫**，明確講清楚兩件事：(1) 現在支援整筆覆寫的編輯（approved-only，重用建立時的驗證規則）；(2) `TeacherAvailability`／`AvailabilityException` 這兩個 model 都沒有 `updatedAt` 欄位，這輪也**不新增**（沒有被要求，也沒有任何既有消費端需要用它判斷資料新鮮度）——編輯後看不出「這筆記錄上次是什麼時候被改的」，這是一個刻意接受的限制，不是遺漏，記錄下來是為了讓未來如果真的需要這個資訊時，能一眼看到這是已知的、被評估過的取捨，不用重新調查一次。

## 4. 實作切片（Slice 1–3；施工前提：D1–D7 已拍板）

### Slice 1 — Domain service

- `src/domain/teacher-availability/service.ts`：新增 `updateOwnTeacherAvailability()`、`updateOwnAvailabilityException()`（見 D1/D3/D6）。沒有任何 schema 變更，不需要 migration。
- **驗證**：throwaway `tsx` script 確認理解正確（不需要重新驗證既有的 `validateTeacherAvailabilityInput()`／`validateAvailabilityExceptionInput()`，這輪直接重用）；`updateOwnTeacherAvailability()`／`updateOwnAvailabilityException()` 本身因為需要 `requireApprovedTeacher()`（依賴真正的 request session），驗證延到 Slice 2 的瀏覽器操作，比照 `teacher-availability` Slice 1 對寫入函式驗證時機的既有處理方式。

### Slice 2 — UI

- `src/app/teacher/availability/actions.ts`：新增 `updateTeacherAvailabilityAction(formData)`、`updateAvailabilityExceptionAction(formData)`，比照既有 `createTeacherAvailabilityAction`／`createAvailabilityExceptionAction` 的既有寫法（`normalizeTeacherProfileDraftInput` 這類正規化不適用——這裡直接沿用頁面既有的 FormData 讀取寫法，見 `actions.ts` 既有的 `createTeacherAvailabilityAction` 怎麼讀 `dayOfWeek`/`startTime`/`endTime`/`locationArea`）。
- `src/app/teacher/availability/page.tsx`：每筆固定時段／例外項目補上「編輯…」`<details>` 表單（見 D4）。
- **驗證**：瀏覽器實際操作——
  1. 建立一個 `approved` teacher 帳號，新增一筆固定時段，展開「編輯…」，修改時間與地區，儲存成功、畫面即時反映新值。
  2. 同一帳號新增一筆日期例外，展開「編輯…」，把 `blocked` 改成 `extra_available`、補上時間範圍，儲存成功、畫面即時反映新值。
  3. 確認編輯時留空必填欄位（例如 `dayOfWeek`）被伺服器端擋下，不是只靠瀏覽器原生驗證。
  4. 確認 `suspended` 老師看不到「編輯…」（唯讀畫面本來就不渲染任何表單，這輪不需要額外處理，但要實際驗證一次確認沒有意外露出）。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/teacher-availability.spec.ts`（既有檔案，這輪擴充，不新增檔案）：
  - 成功編輯固定時段：修改多個欄位，確認畫面與資料庫都反映新值。
  - 成功編輯日期例外：包含把 `type` 從 `blocked` 改成 `extra_available`（或反之）並確認正確持久化。
  - **修正（codex round 1 指出的問題，已採納）**：這是「整筆覆寫」的編輯（見 D1／§2.2），必須額外驗證「把選填欄位從有值改成空白」這個方向，不能只測「新增/修改成有值」——如果 action 或 service 不小心用 `input.locationArea ?? existingValue` 這種邏輯保留舊值（而不是照表單送出的空字串正確寫成 `null`），現有規劃的測試（只測有值 → 有值的修改）完全測不出來。至少要涵蓋：固定時段建立時帶 `locationArea`，編輯時把這個欄位清空，確認資料庫寫成 `null`；日期例外建立時帶 `reason` 與時間範圍，編輯時把 `reason` 清空、時間範圍也清空（改成整天），確認資料庫兩者都寫成 `null`。
  - 邊界驗證：編輯時必填欄位留空被伺服器端擋下（繞過瀏覽器原生 `required`，比照既有 `form.noValidate = true` 手法），資料庫沒有被改動。
  - `suspended` 老師：既有的「approved 載入表單、背後改成 suspended、送出過期表單」測試手法套用到編輯表單，確認伺服器端明確拒絕、資料庫沒有變更。
  - IDOR：Teacher A 建立一筆固定時段／例外，取得記錄自己的 `id`；Teacher B（另一位 approved 老師）用這個 id 呼叫編輯，斷言 `not_found` 且 Teacher A 的記錄內容完全沒被改動（比照既有 delete IDOR 測試的既有識別碼寫法，用記錄自己的 `id`，不是 `teacherProfileId`）。
- 更新 `docs/domain/permissions-matrix.md`、`docs/domain/data-model.md`（D7）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 5. Verification Planning

- Domain 層（Slice 1）：因依賴 `requireApprovedTeacher()`，驗證延到 Slice 2。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對，涵蓋固定時段與例外兩種編輯、必填驗證、suspended 不可見。
- 測試層（Slice 3）：Playwright smoke test，涵蓋成功編輯、伺服器端驗證、suspended 拒絕寫入、IDOR。

<!-- codex-peer-reviewed: 2026-07-30T11:00:33Z rounds=2 verdict=approved -->
