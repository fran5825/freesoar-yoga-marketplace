# Admin Organizations — Implementation Plan

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–5 節再開始施工，不要跳著讀。`## 3. 產品主人決策 Gate（D1–D7）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

`docs/product/route-map.md` 早就列了 `/admin/organizations`（「查看與管理 organizations」），但這個路由從未真正落地——`src/app/admin/` 底下沒有 `organizations` 目錄。Admin 目前唯一能看到 `Organization` 資料的地方是 `/admin/demands` 需求卡片裡附帶顯示的組織名稱，沒有任何獨立、完整的地方可以看到平台上有哪些組織、它們的聯絡資訊、對應哪位團主。

`Organization` 現在已經有完整的 Organizer 自助編輯能力（`organizer-profile-edit`／既有 `updateOwnOrganization()` 已確認），但 Admin 端完全沒有對應的可見度——這正是這一輪 session 反覆處理的同一類「Admin 完整性」缺口，形狀跟已經落地的 `/admin/teachers`、`/admin/classes`、`/admin/demands` 幾乎一樣（Admin-only 唯讀列表）。

**這輪的目標**：讓 Admin 可以在 `/admin/organizations` 查看全平台所有 Organization 的基本資訊、聯絡資訊、對應的 Organizer，以及各自的需求/課程數量。

## 2. 範圍界線

### 2.1 本輪要做的事

- 新增 `listOrganizationsForAdmin()` domain service function（`src/domain/organizer-profile/admin-service.ts`，新檔案）。
- 新增 `/admin/organizations` 頁面：Admin-only 唯讀列表。
- `AdminNav`（`src/app/admin/_components/admin-nav.tsx`）補上「Organizations」連結。

### 2.2 本輪明確不包含（Non-goals，不得偷偷併入本輪）

- **Admin 編輯或代管 Organization**：route-map.md 原本寫的「查看與管理」裡的「管理」是什麼意思沒有清楚定義（編輯聯絡資訊？合併重複組織？停用？都沒有被要求，也沒有任何既有先例可以套用），這輪只做「查看」，「管理」維持完整未來設計，V1 不落地。`permissions-matrix.md` 的 `Edit organization` 這一列的 Admin 欄位這輪不動。
- **獨立的 detail route**（例如 `/admin/organizations/[organizationId]`）：這輪規劃的欄位（聯絡資訊、對應 Organizer、需求/課程數量）在列表頁的卡片上就能完整顯示，不需要額外的詳情頁——比照 `organizer-demand-request-foundation` 對 `/admin/demands/[demandRequestId]` 的既有判斷（只有在需要展開比卡片能承載更多的內容時才落地 detail route，目前不需要）。
- **搜尋／篩選**：這輪只做一個排序好的完整列表，不做搜尋框或篩選器（沒有被要求，且平台目前的 Organization 數量規模不需要）。
- **孤兒 Organization 的特殊處理**：`OrganizerProfile.organizationId` 是 nullable FK（`onDelete: SetNull`），理論上可能存在完全沒有任何 `OrganizerProfile` 關聯的 Organization（例如關聯的 `OrganizerProfile` 被刪除後留下的孤兒記錄）。這輪不特別處理這種情況成一個獨立區塊，就正常顯示在列表裡、對應 Organizer 那一欄顯示「無」，不視為錯誤或需要警示的異常狀態。

## 3. 產品主人決策 Gate（D1–D7）

### D1 — 唯讀列表，不是可編輯頁面

比照 `/admin/teachers`、`/admin/classes`、`/admin/demands` 的既有 Admin-only 唯讀列表版型：`requireAdmin()` 把關（非 Admin 一律 `notFound()`，比照既有三個 Admin 頁面的既有寫法），頁面上沒有任何表單或寫入動作。

### D2 — 顯示欄位：Organization 基本資訊 + 對應 Organizer + 需求/課程數量

每張卡片顯示：

- `name`／`type`（`OrganizationType` enum，沿用 `/organizer/profile` 既有的中文標籤對照，見 D5）
- `contactName`／`contactEmail`／`contactPhone`（選填，缺值顯示「未提供」，比照既有 Admin 頁面對缺值欄位的既有寫法）
- 對應的 `OrganizerProfile`（`displayName` + `user.email`）——`Organization.organizerProfiles` 是一對多關聯，理論上可能有多筆（見 §2.2 孤兒案例），逐筆列出；目前 `organizer-demand-request-foundation` D1 的既有規則是「建立流程一律新建專屬 Organization」，所以實務上幾乎都是剛好一筆，但 domain 層的型別跟畫面渲染都要用陣列處理，不能假設剛好一筆
- `demandRequestCount`／`classSessionCount`（`Organization.demandRequests`／`Organization.classSessions` 關聯的筆數，用 Prisma `_count` 查詢，比照 `class-session/admin-service.ts` 既有 `listAllClassSessionsForAdmin()` 用 `_count` 帶出 `confirmedEnrollmentCount` 的既有寫法）
- `updatedAt`（比照 `teacher-profile-edit` 一輪幫 `/admin/teachers` 補上的「Last updated」既有慣例，讓 Admin 對「這個組織最近有沒有被 Organizer 自己改過聯絡資訊」有被動訊號）

不顯示 `id`／`createdAt`（對 Admin 判斷沒有實際用途，比照既有 Admin 頁面只顯示對決策有幫助的欄位的既有取捨）。

### D3 — 排序：依名稱字母排序，不是依最近更新排序

這輪跟其他既有 Admin 列表頁不同——`/admin/teachers`／`/admin/classes` 都是 `orderBy: updatedAt desc`（「最近有異動的排在前面」，因為那些列表本質上是行動佇列，Admin 要優先處理最新的）。`/admin/organizations` 是一份**參考用的完整名冊**，不是待處理佇列，沒有「最近異動的比較該優先看」這回事；Admin 比較可能的使用情境是「找某個特定組織」，字母排序（`orderBy: { name: "asc" }`）比時間排序更好找。

### D4 — 新檔案：`src/domain/organizer-profile/admin-service.ts`

比照這個 repo 每個 domain 資料夾用獨立 `admin-service.ts` 檔案放 Admin 專屬查詢/動作的既有慣例（`class-session/admin-service.ts`、`demand-request/admin-service.ts`、`enrollment/admin-service.ts` 都是這個模式），不加進既有的 `organizer-profile/service.ts`（那個檔案目前放的都是 Organizer own-scoped 的函式，混進 Admin-only 查詢會模糊掉這個既有邊界）。

```ts
export type AdminOrganizationSummary = {
  id: string;
  name: string;
  type: OrganizationType;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: Date;
  organizers: { id: string; displayName: string; email: string | null }[];
  demandRequestCount: number;
  classSessionCount: number;
};

export async function listOrganizationsForAdmin(): Promise<AdminOrganizationSummary[]> {
  await requireAdmin();

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      updatedAt: true,
      organizerProfiles: {
        select: { id: true, displayName: true, user: { select: { email: true } } },
      },
      _count: { select: { demandRequests: true, classSessions: true } },
    },
    orderBy: { name: "asc" },
  });

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    type: organization.type,
    contactName: organization.contactName,
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    updatedAt: organization.updatedAt,
    organizers: organization.organizerProfiles.map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      email: profile.user.email,
    })),
    demandRequestCount: organization._count.demandRequests,
    classSessionCount: organization._count.classSessions,
  }));
}
```

沒有任何 schema 變更，不需要 migration——`Organization`／`OrganizerProfile`／`DemandRequest`／`ClassSession` 的關聯早就存在，這裡純粹是新增一個查詢函式。

### D5 — UI：新頁面 + AdminNav 補一個連結

`src/app/admin/organizations/page.tsx`：比照 `src/app/admin/classes/page.tsx` 的既有版型（`requireAdmin()` → `notFound()`、`AdminNav`、卡片列表，只是這裡不需要依狀態分組，見 D3）。

**修正（codex round 1 指出的問題，已採納）**：`OrganizationType` 的中文標籤目前已經有**兩份**重複的既有拷貝——`src/app/organizer/profile/page.tsx` 的 `organizationTypeOptions`（陣列，給 `<select>` 用）與 `src/app/admin/demands/page.tsx` 的 `organizationTypeLabels`（`Record<string, string>`，給查表顯示用）。原本規劃「這裡再建一份內容相同的區域常數」會變成**第三份**重複來源——兩份已經是能接受的區域重複量，第三份就會變成真正的技術債：未來 `OrganizationType` enum 新增值或中文文案要改時，很容易漏改其中一處，讓同一個 type 在不同頁面顯示不一致的文案。

正確做法：新增 `src/domain/organizer-profile/organization-type-labels.ts`（共用模組，放在既有 `Organization`/`OrganizerProfile` domain 邏輯所在的資料夾），匯出：

```ts
import type { OrganizationType } from "@prisma/client";

// canonical source：用 `satisfies Record<OrganizationType, string>`（不是型別斷言 `as`）
// 讓 TypeScript 強制檢查這個物件字面量的 key 剛好等於 OrganizationType enum 的全部成員，
// 一個不缺、也不能多——未來 enum 新增值時，這裡沒有跟著補上會直接編譯錯誤，不會變成
// 編譯通過、卻在畫面上顯示 `undefined` 的靜默 bug（`as` 型別斷言只是強迫 TypeScript 相信
// 型別對，不會真的檢查完整性，這正是 codex round 2 指出的問題）。
export const organizationTypeLabels = {
  company: "公司",
  company_club: "公司社團",
  community: "社區",
  family_group: "親友揪團",
  other: "其他",
} satisfies Record<OrganizationType, string>;

// 給 `<select>` 用的陣列形式，從上面的 canonical source 衍生，維持宣告順序。
export const ORGANIZATION_TYPE_OPTIONS: { value: OrganizationType; label: string }[] =
  Object.entries(organizationTypeLabels).map(([value, label]) => ({
    value: value as OrganizationType,
    label,
  }));
```

這輪順手把既有的兩份重複改成從這個共用模組匯入（`organizer/profile/page.tsx` 改用 `ORGANIZATION_TYPE_OPTIONS`、`admin/demands/page.tsx` 改用 `organizationTypeLabels`）——這是零行為變更的單純替換（陣列/物件內容逐字相同，只是搬到共用檔案），不是重新設計；這輪新增的 `/admin/organizations` 頁面直接 import `organizationTypeLabels` 顯示，不再新增第三份拷貝。

`src/app/admin/_components/admin-nav.tsx`：在既有的 Dashboard／Teachers／Demands／Classes 連結後面補一個「Organizations」連結，指到 `/admin/organizations`。**既有的 `tests/smoke/admin-dashboard.spec.ts`「the shared admin nav links to all four admin pages, and works from each of them」這個測試名稱與斷言範圍都是寫死「四個」**，這輪加了第五個之後這個測試會變成描述失真（沒有真的測到新連結，也沒有更新到「五個」）——Slice 3 要把這個既有測試也一併擴充成五個 routes，不是只在新的 `admin-organizations.spec.ts` 裡另外測。

**修正（codex round 2 指出的問題，已採納）**：頁面必須明確實作空狀態分支——`organizations.length === 0` 時顯示一句清楚的引導文字（例如「目前平台上還沒有任何組織。」），不是讓 `.map()` 在空陣列上直接跑出空白區塊，比照 `/admin/classes` 既有的 `classSessions.length === 0` 分支寫法（`page.tsx:47-50`）。這輪 round 1 討論「拿掉自動化空狀態測試」時只講清楚了「為什麼不能自動化斷言」，沒有明確要求 D5 的頁面實作本身要包含這個分支，也沒有給出可執行的驗證方式——這裡補上：實作面直接照抄既有 `/admin/classes` 的既有版型（本來就已經在做同一件事），驗證面見 Slice 2 新增的第 0 步。

### D6 — 不新增 Notification，不影響任何既有寫入流程

這是純讀取功能，不涉及任何寫入、不新增 notification type。

### D7 — 文件對齊策略

1. `docs/product/route-map.md`：`/admin/organizations` 該列的描述從「查看與管理 organizations」補充成「已落地（唯讀）；`管理`維持完整未來設計，V1 未開放編輯或代管」。
2. `docs/domain/permissions-matrix.md`：Organization / OrganizerProfile 表格補上 V1 落地範圍說明——`View organization` 的 Admin 欄位已落地（`/admin/organizations`，唯讀列表），`Edit organization` 的 Admin 欄位仍是完整未來設計，V1 未開放。

## 4. 實作切片（Slice 1–3；施工前提：D1–D7 已拍板）

### Slice 1 — Domain service

- `src/domain/organizer-profile/organization-type-labels.ts`（新檔案，見 D5）：`ORGANIZATION_TYPE_OPTIONS`／`organizationTypeLabels`。改用這個共用模組的既有兩個消費點：`src/app/organizer/profile/page.tsx`、`src/app/admin/demands/page.tsx`（零行為變更，純粹替換 import 來源）。
- `src/domain/organizer-profile/admin-service.ts`（新檔案）：新增 `listOrganizationsForAdmin()`（見 D4）。
- **驗證**：throwaway `tsx` script 直接查 DB 確認 `_count`／`organizerProfiles` 關聯查詢語法正確（不需要真的呼叫 `listOrganizationsForAdmin()` 本身，因為依賴 `requireAdmin()`）；`listOrganizationsForAdmin()` 本身因為需要 `requireAdmin()`（依賴真正的 request session），驗證延到 Slice 2 的瀏覽器操作。回歸確認：`organizer/profile/page.tsx`／`admin/demands/page.tsx` 改用共用模組後，既有的 `tests/smoke/organizer-demand.spec.ts`／`tests/smoke/organizer-profile-edit.spec.ts`／`tests/smoke/admin-demands.spec.ts` 這幾個既有測試檔案要重跑一次，確認純替換 import 沒有改變任何畫面行為。

### Slice 2 — UI

- `src/app/admin/organizations/page.tsx`（新檔案，見 D5）。
- `src/app/admin/_components/admin-nav.tsx`：補上 Organizations 連結。
- **驗證**：瀏覽器實際操作——
  1. 建立至少兩個 Organizer 帳號（各自建立自己的 Organization），用 Admin 帳號造訪 `/admin/organizations`，確認兩個組織都顯示、依名稱字母排序、聯絡資訊與對應 Organizer 正確。
  2. 建立一個有已建立 `DemandRequest`／`ClassSession` 的組織，確認數量正確反映。
  3. **修正（codex round 1 指出的問題，已採納）**：直接用 Prisma 把第二筆 `OrganizerProfile` 的 `organizationId` 指到第一筆的 `Organization`（模擬一個 Organization 對應多個 Organizer 的情境），確認畫面上兩位 Organizer 都列出來，不是只顯示第一位。
  4. **修正（codex round 1 指出的問題，已採納）**：建立一個 `Organization`，然後把唯一關聯到它的 `OrganizerProfile.organizationId` 改成 `null`（模擬孤兒 Organization），確認畫面上這個組織正常顯示、對應 Organizer 那一欄顯示「無」，頁面不會因為空陣列而壞掉或整頁噴錯。
  0.（在步驟 1 之前執行）**修正（codex round 2 指出的問題，已採納）**：空狀態的正確性沒辦法用 Playwright 自動化斷言（理由見 Slice 3），但**可以**在 Slice 2 這種單一開發者手動操作、沒有其他平行 worker 同時寫入的情境下人工驗證一次——這跟「Playwright 全套平行測試套件執行中途」是完全不同的併發情境，不是同一個問題。手法：先跑一次 throwaway 查詢腳本確認本機 dev DB 目前 `Organization` 筆數是不是 0（照這一輪 session 一路的既有慣例，每個功能收工前都會把自己建立的測試資料清乾淨，正常情況下應該是 0）；如果是 0，先造訪一次 `/admin/organizations` 確認空狀態文案正確顯示，再開始下面的步驟 1–7 建立測試資料；如果不是 0（代表前面某個環節忘記清乾淨），就先處理乾淨或誠實記錄「這次沒能驗證真正的空狀態，只驗證了非空情境」，不要略過這一步也不要假裝驗證過。
  5. 確認非 Admin 造訪 `/admin/organizations` 得到 404（`notFound()`）。
  6. 確認 `AdminNav` 上的「Organizations」連結能在全部五個 Admin 頁面之間正確導航（`Dashboard`／`Teachers`／`Demands`／`Classes`／`Organizations`，比照 `admin-dashboard` 一輪對 `AdminNav` 的既有驗證項目，這輪擴充成五個）。
  7. **修正（codex round 1 指出的問題，已採納）**：`resize_window` 到 360px／390px（比照這一輪 session 對 Admin 頁面的既有 RWD 要求，見 `docs/product/PRD.md`），確認名稱、email、電話、多位 Organizer 這些長度不固定的欄位不會讓卡片或整頁水平溢出。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/admin-organizations.spec.ts`（新檔案）：
  - 未登入或非 Admin 造訪 `/admin/organizations` 得到 404。
  - 列出多個組織，確認聯絡資訊、對應 Organizer（`displayName` + email）、需求數量、課程數量都正確顯示，且依名稱字母排序。
  - **修正（codex round 1 指出的問題，已採納）**：一個 Organization 對應多個 `OrganizerProfile` 時，畫面上要列出全部（不能只取第一筆）——建立一筆 Organization，讓兩個不同的 `OrganizerProfile` 都指向它，斷言兩位的 `displayName` 都出現在同一張卡片裡。
  - **修正（codex round 1 指出的問題，已採納）**：孤兒 Organization（沒有任何 `OrganizerProfile` 指向它）要能正常顯示、對應 Organizer 顯示「無」，不能讓頁面噴錯——建立一筆沒有任何 `OrganizerProfile` 關聯的 Organization，斷言頁面正常渲染且該卡片顯示「無」。
  - **修正（codex round 2 指出的問題，已採納）**：上面這兩個情境會刻意打破既有 `cleanupOrganizerDemandFixtures()`（`tests/smoke/_helpers/organizer-demand-fixtures.ts`）用 `organizerProfiles: { some: { user: { email } } } }` 找 Organization 的既有假設——多 Organizer 測試把第二筆 `OrganizerProfile` 轉走後，它原本自己建立的 Organization 會變成孤兒；孤兒測試本身刻意製造的孤兒 Organization，兩者都不會再被這個既有 helper 的 email 關聯查詢找到，會變成兩個 Playwright project 每次執行都新增、永遠不會被清掉的永久殘留資料。這兩個測試必須**自己額外記錄所有建立過的 organization id**（不只是靠 email 反查），在測試結束時（或共用的 `afterAll`）直接用 `prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } })` 補刪，不能只依賴既有 helper 的 email 關聯查詢。
  - **修正（codex round 1 指出的問題，已採納）**：拿掉「沒有任何 Organization 時顯示空狀態」這個斷言。這個 repo 的 Playwright 測試共用同一個資料庫，`chromium-desktop`／`chromium-mobile` 兩個 project 平行執行，其他測試檔案會持續建立新的 `Organization`（例如每一個 `organizer-demand-request-foundation`／`organizer-profile-edit` 相關測試都會建立至少一個），全域「目前是不是恰好零筆」這個前提在這個測試環境下不成立、也無法可靠重現（這正是 `admin-dashboard` 一輪已經踩過、也已經解決過的同一類全域狀態併發問題，這次直接採用同一個結論：不寫這種測試，而不是想辦法讓它變得可靠——因為沒有安全的方式讓「全站掃描」在共用、持續有其他 worker 寫入的資料庫裡精確判斷零筆）。空狀態文案本身的正確性由 Slice 2 的人工瀏覽器操作、閱讀程式碼判斷即可，不需要也不能勉強做成自動化斷言。
  - `AdminNav` 的「Organizations」連結存在且 `href` 正確；同步擴充既有 `tests/smoke/admin-dashboard.spec.ts` 裡「the shared admin nav links to all four admin pages...」這個測試，把斷言範圍與名稱都改成五個 routes（不能讓這個既有測試繼續宣稱「four」卻沒有真的涵蓋新加的第五個）。
- 更新 `docs/product/route-map.md`、`docs/domain/permissions-matrix.md`（D7）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 5. Verification Planning

- Domain 層（Slice 1）：因依賴 `requireAdmin()`，驗證延到 Slice 2；共用標籤模組的既有消費點改用後要重跑既有回歸測試。
- UI 層（Slice 2）：瀏覽器手動驅動，涵蓋多組織排序、一對多 Organizer 關聯、孤兒 Organization、關聯資料正確性、非 Admin 阻擋、AdminNav 連結、360px/390px RWD。
- 測試層（Slice 3）：Playwright smoke test，涵蓋權限、資料正確性（含一對多與孤兒情境）、AdminNav（含既有測試擴充），不含無法可靠重現的全域空狀態斷言。

<!-- codex-peer-reviewed: 2026-07-30T15:56:31Z rounds=3 verdict=approved -->
