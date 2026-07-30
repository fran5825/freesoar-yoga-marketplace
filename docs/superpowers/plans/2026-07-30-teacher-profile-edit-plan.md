# Teacher Profile Edit — Implementation Plan

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–7 節再開始施工，不要跳著讀。`## 4. 產品主人決策 Gate（D1–D13）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

`TeacherProfile` 目前的完整生命週期是：`draft → submitted → approved`（或 `rejected → submitted`），以及 Admin 專屬的 `approved ⇄ suspended`。整條 `/teachers/join` 表單（`src/app/teachers/join/page.tsx` + `src/app/teachers/join/actions.ts`）只服務 `draft`／`rejected` 這兩種「還能寫」的狀態——一旦 `status` 變成 `approved`，`saveOwnTeacherProfileDraft()` 與 `submitOwnTeacherProfileApplication()` 會分別回傳明確的 `approved_profile_cannot_save_draft`／`approved_profile_cannot_submit_again` 錯誤，UI 上所有欄位也被 `disabled`。

結果是：**一位通過審核的老師，從那一刻起永遠無法修正自己資料裡的任何錯字、更新教學風格描述，或補上原本沒填的服務區域**——除非請 Admin 手動處理（目前也沒有任何 Admin 端編輯 UI）。這是一個真實、明確的落地缺口：`docs/product/route-map.md` 裡其實已經列了 `/teacher/profile`「編輯 teacher profile」這一列，`docs/domain/permissions-matrix.md` 的 TeacherProfile 表格也已經列了「Edit teacher profile：Own（Teacher）」，但兩者都只是「應該要有」的既有規劃紀錄，從未真正落地過（`src/app/` 底下沒有任何 `/teacher/profile` 目錄）。

`docs/specs/teacher-onboarding-spec.md` 也已經預留了這個空間：對 `approved` 狀態明確寫著「Teacher 可維護 profile 與 availability；會影響公開呈現或媒合判斷的重大欄位變更，未來可再定義是否需重新 review」——換句話說，「approved 老師可以編輯自己的資料」本身不是一個新概念，唯一懸而未決的是「要不要因此觸發重新審核」，這份 plan 會明確拍板（見 D3）。

**這輪的目標**：讓 `approved` 老師可以編輯自己 `TeacherProfile` 上除了狀態機／Admin 專屬欄位以外的所有內容，並讓 `suspended` 老師唯讀查看（比照這個 repo 這一整輪一路沿用的既有先例：suspended = 唯讀，approved = 可寫）。

## 2. 範圍界線

### 2.1 本輪要做的事

- 新增 `updateOwnTeacherProfile()` domain service function：`approved` 老師才能呼叫，重用既有的 `validateTeacherProfileSubmit()` 必填規則（跟送審當下要求的必填欄位完全一致——已通過審核的老師資料不應該因為編輯而變得比「送審當下」更不完整）。
- 新增 `/teacher/profile` 頁面 + Server Actions：三種顯示狀態，比照 `/teacher/availability` 已落地的既有版型（引導文案 / suspended 唯讀 / approved 可編輯），不是比照 `/teachers/join` 那個較舊、較重的 client component 版型（理由見 D4）。
- 修正 `/teacher/dashboard` 對 `approved`／`suspended` 兩種狀態的過時連結（目前兩者都指向 `/teachers/join`，approved 的文案還說「查看已保存資料」——這輪要讓它們真的指到新頁面）。
- 文件對齊（見 D13）。

### 2.2 本輪明確不包含（Non-goals，不得偷偷併入本輪）

- **Admin 代編輯任一位老師的資料**：`permissions-matrix.md` 理想表格裡 Edit 這一列的 Admin 欄位維持「應該要有」的完整未來設計，這輪不落地（沒有任何頁面讓 Admin 修改老師的 `TeacherProfile` 內容；Admin 既有的 suspend/restore/reject 能力不受影響）。
- **編輯觸發重新審核**：即使編輯了「會影響公開呈現或媒合判斷的重大欄位」（例如 `displayName`、`specialties`），這輪editing 後 `status` 依然停留在 `approved`，不會被打回 `submitted` 或任何審核佇列。`docs/specs/teacher-onboarding-spec.md` 明確把這個問題留給「未來可再定義」，這輪就此拍板：V1 不做重新審核（理由見 D3）。
- **draft/submitted/rejected 狀態下的任何行為變更**：`/teachers/join` 既有的 draft 儲存、送審、退回重送邏輯完全不動，這輪只服務 `approved`（可寫）與 `suspended`（唯讀）兩種狀態。
- **新的欄位長度上限或格式驗證**：`validateTeacherProfileSubmit()` 目前對 `bio`／`teachingStyle` 等自由文字欄位沒有任何長度上限，`profilePhotoUrl` 沒有 URL 格式驗證——這輪原封不動重用既有規則，不新增任何限制（沒有被要求，也沒有既有 bug 需要修）。
- **公開 teacher profile 頁面**（`/teachers/[id]` 之類）：`permissions-matrix.md` 列的「View public approved profile：Yes（所有角色）」目前唯一的落地方式是 class session 詳情頁上顯示的 `displayName`（`src/app/classes/[classSessionId]/page.tsx`）；這輪不新增任何公開頁面，`bio`／`specialties` 等欄位編輯後依然只有本人、看過自己需求回應的 Organizer、與 Admin 看得到（既有可見範圍不變）。

## 3. 資料模型與既有程式碼盤點（給零背景 Builder）

**沒有任何 schema 變更**——`TeacherProfile` 的所有欄位早就存在（`prisma/schema.prisma:63-87`），這輪純粹是幫既有欄位補上「approved 之後還能寫」這條路徑，不新增／修改／刪除任何 Prisma model 或欄位。

可編輯欄位（10 個，對齊 `TeacherProfileApplicationInput`，`src/domain/teacher-profile/validation.ts:1-12`）：

- `displayName`（送審必填）
- `bio`（送審必填）
- `teachingStyle`（送審必填）
- `experienceYears`（送審必填，數字 ≥ 0）
- `specialties`（送審必填，至少一項，逗號或換行分隔的字串陣列）
- `serviceAreas`（送審必填，至少一項）
- `teachingFormats`（送審必填，至少一項）
- `certifications`（選填，字串陣列）
- `priceRange`（選填）
- `profilePhotoUrl`（選填）

**不可編輯**（這輪完全不碰）：`id`／`userId`／`status`／`rejectionReason`／`suspensionReason`／`createdAt`／`updatedAt`（`updatedAt` 由 Prisma `@updatedAt` 自動維護）。

**可以直接重用、不需要重寫的既有 pure 函式**（全部已存在，簽章不變）：

- `validateTeacherProfileSubmit(input: TeacherProfileApplicationInput)`（`validation.ts:54-123`）——必填欄位規則。
- `TeacherProfileDraftFormInput`（`input.ts:3-14`，全字串的表單輸入形狀）+ `normalizeTeacherProfileDraftInput()`（`input.ts:16-31`，把表單字串正規化成 `TeacherProfileApplicationInput`，含 `experienceYears` 轉數字與清單欄位的逗號/換行切割）。
- `toTeacherProfileDraftData()`（`service.ts:746-759`，私有函式，把 `TeacherProfileApplicationInput` 轉成 Prisma `data` 物件）——因為新函式會加在同一個 `service.ts` 檔案裡，可以直接呼叫，不需要 export。
- `getOwnTeacherProfileApplicationSnapshot()`（`service.ts:204-215`）——回傳呼叫者自己完整的 `TeacherProfile`（或 `null`），**任何狀態**都能拿到（用 `getCurrentUser()`，不套用 approved gate），這正是這輪唯讀頁需要的讀取函式，不需要新增。
- `requireApprovedTeacher()`（`src/domain/teacher-profile/capability.ts`，這輪之前的 `teacher-availability` 一輪才剛從 `demand-response/capability.ts` 搬過來、現在就住在 `teacher-profile` domain 自己家裡）——approved-only 寫入動作的標準把關方式，這輪直接沿用，不需要再搬遷。

## 4. 產品主人決策 Gate（D1–D13）

### D1 — 可編輯欄位與必填規則：完全重用 `validateTeacherProfileSubmit`，並修正一個既有的整數驗證漏洞

編輯時的必填規則跟送審當下完全一致（見 §3 欄位清單）。**理由**：已通過審核的老師資料本來就代表「當初送審時這些欄位都是完整的」，編輯不應該讓它退化成比送審當下更不完整的狀態；重用既有函式也避免維護兩份幾乎一樣的驗證邏輯。不新增任何欄位、不新增任何驗證規則。

**修正（codex round 1 指出的問題，已採納）**：`prisma/schema.prisma` 裡 `TeacherProfile.experienceYears` 是 `Int?`，但既有的 `hasExperienceYears()`（`validation.ts:136-138`）只檢查 `Number.isFinite(value) && value >= 0`，沒有檢查整數——使用者輸入 `1.5` 這種合法小數會通過驗證，接著在 `prisma.teacherProfile.update()`／`create()` 寫入 `Int` 欄位時被 Prisma Client 直接丟出例外，變成未被攔截的 500，不是明確的伺服器端拒絕。這是既有 `saveOwnTeacherProfileDraft()`／`submitOwnTeacherProfileApplication()` 就已經帶著的 bug，不是這輪新引入的，但因為這輪的 `updateOwnTeacherProfile()` 明確承諾重用同一個驗證函式，且這輪的既有先例（`teacher-availability` D9、D5）要求「伺服器端明確拒絕，不是靜默失敗或 500」，所以這輪一併修正：把 `hasExperienceYears()` 改成同時檢查 `Number.isInteger(value)`，這是修正一個共用 pure 函式、讓兩條既有流程與這輪的新流程同時受益，不是引入新規則或新欄位。

**修正（codex round 2 指出的問題，已採納）**：只檢查 `Number.isInteger(value)`還不夠——PostgreSQL `Int4`（Prisma `Int`）的範圍是 `-2147483648` 到 `2147483647`，`2147483648` 這種超出範圍的整數一樣會通過 `Number.isInteger()`，一樣會在寫入時讓 Prisma Client 丟出例外、變成未攔截的 500。`hasExperienceYears()` 要再補上 `value <= 2147483647` 這個上界檢查（用 Postgres `Int4` 的實際上限本身，不是憑空發明一個「合理教學年資」之類的業務規則數字——目的單純是防止資料庫層級的例外，不是新增業務邏輯）。`experienceYears` 只有 `>= 0` 的下界要求維持不變（負數本來就已經被既有規則擋下）。

### D2 — 狀態閘門：approved 可寫，suspended 唯讀，其餘導向既有 `/teachers/join` 流程

`/teacher/profile` 這個新頁面只服務兩種狀態：

- `approved`：完整的讀 + 寫（編輯表單）。
- `suspended`：唯讀顯示既有資料，沒有任何表單（比照 `teacher-availability` D9 對 suspended 的既有處理方式，也比照 `teacher-demand-response.spec.ts` 既有「suspended 可以唯讀查看自己 demand response」的既有先例）。
- `draft`／`submitted`／`rejected`／沒有 `TeacherProfile`：顯示引導文案 + 連到 `/teachers/join`（那裡才是這些狀態的真正操作介面），不是功能本體、不是 404。

`updateOwnTeacherProfile()` 這個 domain function 本身也是 approved-only（用 `requireApprovedTeacher()` 把關），不是只有 UI 端擋。

### D3 — 編輯不觸發重新審核，不改變 `status`

編輯成功後 `status` 依然是 `approved`，**不會**被改回 `submitted` 或進入任何審核佇列，即使改的是 `displayName`／`specialties` 這種會影響公開呈現或媒合判斷的欄位。**理由**：`docs/specs/teacher-onboarding-spec.md` 明確把「重大欄位變更是否需要重新 review」標記成「未來可再定義」的開放問題，不是「這輪必須做」的既定需求；比照這一整輪 session 反覆確認過的 V1 minimalism 原則——沒有被要求、也沒有明確的濫用場景證據，不要為了假設性的未來需求先建立審核機制。若之後真的需要重新審核機制，那是一個獨立、需要另外定義「哪些欄位算重大」「審核期間老師還能不能接單」的產品決策，不是這輪的隱含範圍。

**codex round 1 提出的疑慮**：codex 認為「approved 老師可以無限制編輯已審核欄位、不留審核紀錄、不通知任何人」代表這份已審核資料可以被換成實質不同的內容、Admin 卻毫無感知，要求要嘛加上「保留信任」機制，要嘛由產品主人明確承擔這個風險。Claude 第一輪回應主張「Admin 既有的 `/admin/teachers` 已經會顯示 `updatedAt`，提供被動訊號」，但 codex round 2 指出這個說法**不成立**：`listApprovedAndSuspendedTeacherProfilesForAdmin()` 雖然有 `select` 出 `updatedAt`，但 `src/app/admin/teachers/page.tsx` 的「Approved teachers」／「Suspended teachers」兩個區塊（第 255–353 行）只渲染 `displayName`／`user.email`／`suspensionReason`，`updatedAt` 只拿來 `orderBy`（`service.ts:731`），從未真正顯示在畫面上——已確認 codex 說的沒錯，Claude 這個具體主張是錯的，已收回。

**最終決策（採納 codex 的具體發現，維持 D3 的核心決策——仍然不做重新審核／通知，但補上一個真正存在的被動訊號）**：不做重新審核、不做通知、不建立稽核軌跡的核心決策不變，理由仍然是 (1) `docs/specs/teacher-onboarding-spec.md` 自己標記這是「未來可再定義」的開放問題，不是這輪的隱含範圍；(2) 這個 repo 對自助編輯一貫是「事後由 Admin 用既有 suspend 工具處理」而非「事前審核」，沒有任何其他自助寫入動作有審核閘門，這輪不應該無端建立一個新的例外版型。但 codex 指出「事後處理需要至少有辦法發現」這個前提目前確實不成立，這個落差要補：**在 D9 既有要動的 `/admin/teachers` 頁面上，approved／suspended 兩個區塊的老師卡片各自補上一行 `formatDateTime(teacher.updatedAt)`**（沿用 `listApprovedAndSuspendedTeacherProfilesForAdmin()` 早就查出來、只是沒有渲染的既有資料，不需要新的查詢、新的欄位、新的 domain 邏輯）。這讓「Admin 事後發現、事後用既有 suspend 工具處理」這個既有模式第一次真的具備「發現」的手段，且完全不違反「這輪不做重新審核／通知」的核心決策——純粹是把一個早就查出來、卻被 UI 遺漏的既有欄位補上顯示，屬於 Slice 2 UI 修正的自然延伸（見 D9），不是新增稽核系統。

### D4 — UI 架構：新的 Server Component 頁面 + Server Actions，不是重用/擴充 `/teachers/join` 的 client component

`/teachers/join`（`src/app/teachers/join/page.tsx`）是一個相當重的 `"use client"` 元件：即時欄位驗證、草稿/送審雙軌按鈕、二次確認 modal、`hydrateOwnTeacherProfile` 的 client-side fetch。這輪不在這個既有元件裡加一個「approved 編輯模式」分支——會讓一個已經很複雜的 client component 更複雜，而編輯已通過審核的老師資料所需要的互動其實遠比「從零開始申請」簡單（沒有草稿/送審雙軌、沒有二次確認、就是「改一改、存檔」）。

改採這一輪 session 稍早（`teacher-availability`）已經建立、也已經驗證好用的較新版型：Server Component 頁面直接讀資料，`<form action={serverAction}>` 直接送出，`revalidatePath` + `redirect` 帶查詢字串回傳成功/錯誤訊息。這也讓新頁面跟 `/teacher/availability`、`/admin/classes/[id]` 等既有頁面的寫法一致，降低認知負擔。

### D5 — 並發保護：`updateMany` 帶 `status: "approved"` 條件，不需要 raw SQL 鎖

這是單一使用者編輯自己單一一列資料，沒有像 enrollment capacity 或 demand response selection 那種「多方搶同一份有限資源」的併發不變量需要保護。唯一需要擋的競態是：老師剛打開編輯頁面（此時還是 approved），Admin 在他送出前把他 suspend 了。作法：

```
const updateResult = await prisma.teacherProfile.updateMany({
  where: { id: teacherProfileId, status: "approved" },
  data: { ...toTeacherProfileDraftData(input) },
});

if (updateResult.count === 0) {
  // 這個老師已經不再是 approved（多半是被 suspend 了），回傳 approved_teacher_required
}
```

`count === 0` 時回傳跟「一開始就不是 approved」相同的錯誤碼，不需要額外查詢區分原因——這個測試手法（approved 時載入表單、背後改成 suspended、送出過期表單、斷言伺服器端擋下且沒有寫入）跟 `teacher-availability` D9 的既有驗證清單完全一致，Slice 3 直接沿用。

### D6 — 驗證失敗時 UI 只顯示通用訊息（比照 `teacher-availability` 的既有先例，不是新問題）

跟 `teacher-availability` 一輪一樣，`updateOwnTeacherProfile()` 驗證失敗時，Server Action 只會把 `result.message`（一句通用訊息，例如「儲存前，請先確認以上資訊。」）透過 redirect 查詢字串帶回頁面，不會逐欄顯示 `validationErrors` 裡的個別錯誤訊息。這不是這輪的新問題，是這個 repo 這一整輪 Server Action + redirect-with-feedback 版型的既有限制（`validationErrors` 欄位仍然會被回傳、保留給未來想做逐欄顯示的人使用）。跟 `teacher-availability` 一樣，Slice 3 會用「直接呼叫 `validateTeacherProfileSubmit()`」的方式，獨立於 UI 之外證明每一條規則各自對應正確的 error code，不是只驗證了「有沒有被擋下」這個粗粒度行為。

### D7 — 不新增 Notification

`TeacherAvailability` 的新增/刪除、`DemandResponse` 撤回都沒有觸發任何通知——這個 repo 對「自己對自己資源的低風險寫入、不改變 marketplace 可見狀態」這類動作，一貫沒有接通知。編輯自己的 `TeacherProfile`（狀態不變）屬於同一類，這輪不新增任何新的 notification type，也不呼叫 `notifyUsers()`。

### D8 — Admin 代編輯：這輪不做（Non-goal，見 §2.2）

`permissions-matrix.md` 理想表格中 Edit 這一列的 Admin 欄位維持完整未來設計，不落地。

### D9 — Dashboard 連結修正

`/teacher/dashboard`（`src/app/teacher/dashboard/page.tsx`）目前 `statusCopy.approved`／`statusCopy.suspended` 的 `actionHref` 都指向 `/teachers/join`，approved 的 `actionLabel` 是「查看已保存資料」——這句話本身就已經過時（明明是唯讀查看，用詞卻很像可以做什麼）。這輪修正成：

- `approved`：`actionHref: "/teacher/profile"`，`actionLabel: "編輯我的資料"`，`body` 文案補上「編輯你的老師個人資料」這個新能力（比照 `teacher-availability` D13 對 `body` 文案的既有修法）。
- `suspended`：`actionHref: "/teacher/profile"`（新頁面會自己處理 suspended 的唯讀渲染），`actionLabel` 維持「查看目前資料」不變（唯讀查看，用詞本來就對）。
- `draft`／`submitted`／`rejected`：完全不動，繼續指向 `/teachers/join`（那才是這些狀態的真正操作介面）。

**修正（codex round 2 指出的問題，已採納，見 D3 最終決策）**：`src/app/admin/teachers/page.tsx` 的「Approved teachers」／「Suspended teachers」兩個區塊（第 255–353 行）目前只顯示 `displayName`／`user.email`／`suspensionReason`，`listApprovedAndSuspendedTeacherProfilesForAdmin()` 早就 `select` 出來的 `updatedAt` 從未真正渲染。這輪在這兩個區塊各自的老師卡片上補一行「最後更新：`formatDateTime(teacher.updatedAt)`」——`formatDateTime` 這個 helper 本來就已經存在於同一個檔案裡（`src/app/admin/teachers/page.tsx:429`，目前只給 submitted applications 區塊用），直接重用，不需要新寫格式化邏輯。

**修正（codex round 3 指出的問題，已採納）**：只顯示時間戳記還不夠——Admin 看得到「這位老師最近改過資料」，但看不到「改成了什麼」，沒辦法真的判斷內容是否變得不當或誤導，等於「知道有事發生，但無法調查」。這輪一併補上：把 `listApprovedAndSuspendedTeacherProfilesForAdmin()`（`service.ts:724-744`）的 `select` 擴充成跟 `teacherProfileDraftSelect` 一樣完整（`bio`／`teachingStyle`／`experienceYears`／`specialties`／`serviceAreas`／`teachingFormats`／`certifications`／`priceRange`／`profilePhotoUrl`——**修正（codex round 4 指出的問題，已採納）：round 3 這裡漏列了 `experienceYears`，這裡補上，不能只有其他 9 個可編輯欄位看得到，唯獨這個看不到**），並在 `/admin/teachers` 的 approved／suspended 卡片上用這個檔案裡**本來就已經存在**的既有渲染寫法照搬：`bio`／`teachingStyle`／`specialties`／`serviceAreas`／`teachingFormats`／`certifications`／`priceRange`／`profilePhotoUrl` 用 submitted applications 區塊本來就在用的 `ReadOnlyText`／`ReadOnlyList` 兩個既有元件（`page.tsx:218-246`），`experienceYears` 用同一個區塊本來就在用的既有 `dt`/`dd` 寫法（`page.tsx:129-138`，`typeof experienceYears === "number" ? \`${experienceYears} years\` : "Not provided"`），全部放進一個 `<details>` 可收合區塊（比照同一個檔案裡「Suspend…」／「Reject…」既有的 `<details>`／`<summary>` 版型，預設收合、避免每張卡片預設就佔用太多畫面空間）。這不是新增查詢邏輯或新元件，純粹是擴充既有 `select` 的欄位清單、重用既有元件與既有寫法到另一個既有區塊，讓「Admin 事後發現、事後判斷」這個既有模式第一次真的具備「看得到完整內容」這個必要條件。

### D10 — 欄位清單、表單版型比照 `/teachers/join` 既有中文文案，不重新發明

新頁面沿用 `/teachers/join` 既有的欄位中文標籤與三個分組（基本呈現／教學風格與背景／服務範圍與合作形式），只是渲染方式從 client component 的即時互動表單改成單純的 Server Action 表單（見 D4）。不重新設計欄位分組或文案語氣，降低老師在兩個頁面之間切換時的認知落差。

### D11 — 型別與函式命名

- `src/domain/teacher-profile/service.ts` 新增：

  ```ts
  export type TeacherProfileUpdateErrorCode =
    | "authentication_required"
    | "approved_teacher_required"
    | "update_validation_failed"
    | "teacher_profile_update_failed";

  export type TeacherProfileUpdateResult =
    | { ok: true; profile: TeacherProfileApplicationSnapshot }
    | {
        ok: false;
        code: TeacherProfileUpdateErrorCode;
        message: string;
        validationErrors?: TeacherProfileValidationError[];
      };

  export async function updateOwnTeacherProfile(
    input: TeacherProfileApplicationInput,
  ): Promise<TeacherProfileUpdateResult>
  ```

  邏輯順序：先 `validateTeacherProfileSubmit(input)`（驗證失敗直接回傳 `update_validation_failed`，不查資料庫）→ `requireApprovedTeacher()`（catch 區分 `authentication_required` vs `approved_teacher_required`，寫法比照 `teacher-availability/service.ts` 既有的 `isAuthenticationRequiredError` helper）→ `updateMany` 帶 `status: "approved"` 條件（見 D5）→ `count === 0` 回傳 `approved_teacher_required` → 否則 `findUniqueOrThrow` 撈回最新資料回傳 `{ ok: true, profile }`。

  **修正（codex round 1 指出的問題，已採納）**：上面這段邏輯順序只描述了「正常路徑」與 `requireApprovedTeacher()` 失敗的處理，沒有講清楚 `updateMany()`／`findUniqueOrThrow()` 這兩個 Prisma 呼叫本身拋出例外時要怎麼處理——如果不接住，會變成未攔截的例外、變成 500，而不是型別裡承諾的 `teacher_profile_update_failed`。**明確寫法**：整個「`requireApprovedTeacher()` 之後」的區塊（`updateMany` + `count===0` 分支 + `findUniqueOrThrow`）包在同一個 `try { ... } catch { return { ok:false, code:"teacher_profile_update_failed", message:"..." } }` 裡，寫法比照既有 `submitOwnTeacherProfileApplication()`（`service.ts:300-392`）整個函式主體都包在一個 `try/catch` 裡、`catch` 區塊先判斷是不是 `isAuthenticationRequiredError`、否則落回通用失敗訊息的既有結構——不是自己發明新的錯誤處理版型。
- `src/app/teacher/profile/page.tsx`（新）、`src/app/teacher/profile/actions.ts`（新，`updateTeacherProfileAction(formData: FormData)`，比照 `src/app/teacher/availability/actions.ts` 的 `redirectWithFeedback` 既有寫法）。

### D12 — Route Guard

`/teacher/profile` 沿用 `docs/product/route-map.md` 既有的 Route Guard 原則：其他 `/teacher/*` workspace routes 必須只允許 Teacher 或 Admin（實際上這裡只用 `requireUser()` + 頁面內部依 `TeacherProfile` 狀態分流，跟 `/teacher/availability`、`/teacher/demands` 的既有寫法一致，不是額外規則）。

### D13 — 文件對齊策略

1. `docs/domain/data-model.md`：`TeacherProfile` 段落補上「Edit 已落地」的說明，列出可編輯欄位清單與 D3 的「不觸發重新審核」決策。
2. `docs/domain/permissions-matrix.md`：TeacherProfile 表格的「Edit teacher profile」這一列補上 V1 落地範圍說明——`Own`（Teacher）= `approved` 專屬（`suspended` 唯讀、其餘狀態走 `/teachers/join`），`Admin` 欄位仍是未落地的完整未來設計（比照 Suspend/Restore 那一段的既有寫法慣例）。
3. `docs/product/route-map.md`：`/teacher/profile` 該列從「編輯 teacher profile」補充成「已落地」；同時修正 `/teacher/dashboard` 那一列裡已經過時的「本 status slice 不開放 demand、availability、response 或 class session 功能」這句話（這句話早在更早的 slice 就已經不成立，這次一併修正，不是這輪新引入的問題，但既然要動這個檔案就一併修掉，避免文件繼續累積過時陳述）。
4. `docs/specs/teacher-onboarding-spec.md`：把 `approved` 狀態列「Teacher editability」那句話裡「Teacher 可維護 profile 與 availability」補上「已落地」標記，並明確保留「會影響公開呈現或媒合判斷的重大欄位變更，未來可再定義是否需重新 review」這句話本身（呼應 D3——這個問題這輪明確拍板成「不做」，但拍板本身也是一種答案，不是刪掉這個開放問題，而是註記它目前的解）。

## 5. 品牌與 UX 規則

- 表單文案沿用 `/teachers/join` 既有中文語氣，溫和、清楚，不製造審核焦慮（比照既有「已通過審核的老師資料」用詞）。
- 唯讀（suspended）畫面要清楚說明「為什麼現在不能編輯」，不是單純把表單變灰階disabled（比照 `/teacher/availability` D7 的既有處理：唯讀列表 + 一句說明文字，不是 disabled 表單）。

## 6. RWD Requirements

`/teacher/profile` 是 Teacher 端既有頁面的同類頁面，必須 mobile-first。**修正（codex round 1 誤刪、round 2 指出並改回，已採納）**：`docs/product/PRD.md` 第 237 行明確要求「Mobile 360px、390px、tablet、desktop 版面可用」，360px 是真實存在的產品要求，round 1 把它整段刪掉、只留 390px 是錯的，已經改回。實際驗證手法比照這個 session 一路的既有慣例（`organizer-demand-request-foundation`、`teacher-demand-pool-response` 等多輪 plan 皆同）：**390px 由 Playwright `chromium-mobile` 專案自動涵蓋**（`playwright.config.ts` 裡明確設定 `devices["Pixel 5"]` + `viewport: { width: 390, height: 900 }`，Slice 3 全套 `npm run test:smoke` 跑過就等於驗證過 390px）；**360px 沒有對應的 Playwright project，這個 repo 目前一律靠 Slice 2 瀏覽器手動操作時額外用 `resize_window` 縮到 360px 人工確認一次不溢出**，不是自動化測試涵蓋的範圍——這是既有慣例，不是這輪新發明的驗證缺口。

## 7. 實作切片（Slice 1–3；施工前提：D1–D13 已拍板）

### Slice 1 — Domain service

- `src/domain/teacher-profile/service.ts`：新增 `updateOwnTeacherProfile()`（見 D11）。沒有任何 schema 變更，不需要 migration。
- **驗證**：throwaway `tsx` script 直接呼叫 `validateTeacherProfileSubmit()` 確認既有必填規則行為不變（不需要重新驗證，純粹確認理解正確）；`updateOwnTeacherProfile()` 本身因為需要 `requireApprovedTeacher()`（依賴真正的 request session），驗證延到 Slice 2 的瀏覽器操作，比照 `teacher-availability` Slice 1 對寫入函式驗證時機的既有處理方式。

### Slice 2 — UI

- `src/app/teacher/profile/page.tsx`／`actions.ts`：三種顯示狀態（D2/D4/D10）。
- `src/app/teacher/dashboard/page.tsx`：修正 approved/suspended 的連結與文案（D9）。
- `src/app/admin/teachers/page.tsx`：approved／suspended 老師卡片補上 `updatedAt` 顯示（D9 最後一段、對應 D3 最終決策）。
- **驗證**：瀏覽器實際操作——
  1. 建立一個 `approved` teacher 帳號（含既有資料），確認 `/teacher/profile` 顯示完整表單並預填既有值，修改後儲存成功、畫面即時反映新值。
  2. 確認送出必填欄位留空時被伺服器端擋下（不是只靠瀏覽器原生驗證）。
  3. 建立一個 `suspended` teacher 帳號（含既有資料），確認 `/teacher/profile` 顯示唯讀版本（看得到資料，沒有表單）。
  4. 確認 `draft`／`submitted`／`rejected`／沒有 `TeacherProfile` 顯示引導文案，連到 `/teachers/join`。
  5. 確認 `/teacher/dashboard` 的 approved／suspended 連結都正確導到 `/teacher/profile`。
  6. 確認 `/admin/teachers` 的 approved／suspended 卡片上看得到 `updatedAt`與完整欄位內容（含 `experienceYears`，展開 `<details>` 後），且編輯過 profile 的老師時間與內容都確實反映最新值。
  7. 用 `resize_window` 把 `/teacher/profile` 縮到 360px，確認表單與唯讀版面都不水平溢出（見第 6 節，這是 PRD 的既有要求，靠人工這一步涵蓋，不是自動化測試）。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/teacher-profile-edit.spec.ts`：
  - 直接呼叫 `validateTeacherProfileSubmit()` 確認各欄位必填規則各自對應正確 error code（D6，比照 `teacher-availability` Slice 3 的既有手法），包含 D1 新增的 `experienceYears` 整數與範圍規則：`1.5`（非整數）必須被擋下，`2147483648`（超出 Postgres `Int4` 上限）也必須被擋下——不能只驗證 `Number.isInteger()`，兩個邊界都要各自有一條斷言，證明上限檢查真的有接上，不是只加了型別註解沒接邏輯。
  - 未登入直接造訪 `/teacher/profile` 會被導到 `/sign-in`（比照既有 `/teacher/availability`／`/teacher/dashboard` 的既有測試慣例，這輪之前漏寫，這裡補上）。
  - `missing`／`draft`／`submitted`／`rejected` 四種狀態看到引導文案，連到 `/teachers/join`。
  - `suspended`：唯讀顯示既有資料，沒有表單；且伺服器端真的會擋下寫入，不是只有 UI 隱藏——測試手法比照 `teacher-availability` D9（`approved` 狀態載入表單、背後改成 `suspended`、送出過期表單、斷言伺服器端明確拒絕且資料庫沒有變更）。
  - `approved`：成功編輯（修改多個欄位，確認畫面與資料庫都反映新值）；必填欄位留空時的邊界驗證（繞過瀏覽器原生 `required`，比照既有 `form.noValidate = true` 手法）。
  - 確認編輯後 `status` 依然是 `approved`（D3）。
  - **修正（codex round 1 指出的問題，已採納）**：確認沒有觸發任何 notification 時，**不可以**用 `prisma.notification.count()` 這種未限定範圍的全域計數做編輯前後比對——這個 repo 的 Playwright 測試共用同一個資料庫，`chromium-desktop`／`chromium-mobile` 兩個 project 會並行跑，其他測試檔案也可能同時在建立/處理各自的 notification，未限定範圍的全域計數在併發下不安全（這正是 `admin-dashboard` 一輪已經踩過、也已經解決過的同一類問題）。正確做法：**限定在這個測試自己建立的 fixture user 身上**——用這個測試自己的 `userId`（每個測試都用獨一無二的 email 建立，天生互相隔離）查 `prisma.notification.count({ where: { userId } })`，編輯前後比對這個限定範圍的計數不變即可，不需要比對全站計數。
  - `/teacher/dashboard` 的 approved／suspended 連結正確性（D9）。
  - `/admin/teachers` 的 approved 卡片顯示 `updatedAt` 與完整欄位內容（含 `experienceYears`，D9 最後兩段），且編輯 profile 後時間戳記與展開後的欄位內容都確實反映新值（斷言畫面上顯示的時間跟內容跟編輯後的 `TeacherProfile` 一致，不是只確認欄位存在）。
- 更新 `docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`、`docs/product/route-map.md`、`docs/specs/teacher-onboarding-spec.md`（D13）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 8. Verification Planning

- Domain 層（Slice 1）：throwaway script 確認既有 pure 函式行為不變；`updateOwnTeacherProfile()` 因依賴 `requireApprovedTeacher()`，驗證延到 Slice 2。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對，涵蓋 approved／suspended／非 approved 三種狀態。
- 測試層（Slice 3）：Playwright smoke test，涵蓋三種狀態顯示、伺服器端驗證與權限、D3/D7 的行為斷言。

<!-- codex-peer-reviewed: 2026-07-29T23:24:45Z rounds=5 verdict=approved -->
