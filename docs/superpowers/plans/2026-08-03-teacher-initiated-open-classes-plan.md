# Teacher-Initiated Open Classes (Recurring + Fixed-Term, Public Discovery, Unified Calendar) — Draft Implementation Plan

> Status: DRAFT — 產品主人要求先閱讀，暫不啟動 Codex peer review；未授權 Builder 施工。
> Date: 2026-08-03

## 1. Outcome

讓 **approved 老師可以不透過任何 `DemandRequest` / Organizer 媒合，直接自行開課**——單堂、常規週期（例如每週二晚上）或固定期課程（例如連續 4 週）皆可——並讓**任何登入使用者（不需要建立 `OrganizerProfile`）**都能在公開列表看到這些課程，直接報名。老師既有的「團主媒合課程」與新的「自己開的課」會共用同一個 `ClassSession` model，出現在同一份行事曆/列表裡，老師不需要在兩個系統間切換。

Google 日曆雙向同步、完整金流自動化，皆明確排除在本計畫之外，是另案決策（見第 3 節 Explicitly out of scope）。

本計畫是「可施工前的 draft」。產品主人要求先閱讀內容、確認範圍與資料模型決策，暫不啟動 Codex peer review。

## 2. Authority and Repo Reality

- `docs/domain/data-model.md` 的 `ClassSession` 定義下明寫："**Teacher-created classes are future scope / non-V1.**" ——本計畫就是把這個已知、被刻意延後的項目正式排入施工，經產品主人在對話中明確核准啟動，不是自動擴大範圍。
- `docs/product/route-map.md` 的 `/classes` 路由已經預留："公開 class session 列表，optional / later，不作為 V1 必做"；`/classes/[classSessionId]` 也已存在，但 Route Guard 原則寫明**完整未來設計是 Visitor 可看公開課程**，V1 目前刻意只服務已登入 Member、且不檢查 `isPublic`（`enrollment` D4 已確認的既有限制）。本計畫的公開列表 slice，就是把這段文件已經寫好的「未來設計」正式接上，不是發明新行為。
- **實際 schema 現況**（[`prisma/schema.prisma:209-237`](prisma/schema.prisma)）：`ClassSession.demandRequestId`／`organizerProfileId`／`organizationId` 三個欄位目前都是**必填**，且 `demandRequestId` 帶 `@unique`、三個關聯都是 `onDelete: Restrict`。要讓老師脫離 `DemandRequest` 直接建課，這三個欄位都必須改成 nullable——這不是加欄位這麼單純，是放寬一個核心關聯的必填性，必須完整 audit 現有消費端。
- **已確認的既有消費端破壞點**（Builder 開始前必須先修，否則 migration 上線當下就會炸；Codex round 1 審查時把原本只涵蓋 `demandRequest` 的 audit 擴大到 `organization`／`organizerProfile`，以下是完整清單，已逐一開檔驗證）：
  - `demandRequest` 巢狀 select 假設關聯必存在：[`src/domain/class-session/read-service.ts:99`](src/domain/class-session/read-service.ts)、[`admin-service.ts:88,115`](src/domain/class-session/admin-service.ts)（`select`）；渲染端 [`src/app/admin/classes/[classSessionId]/page.tsx:97-99`](src/app/admin/classes/%5BclassSessionId%5D/page.tsx)、[`src/app/organizer/classes/[classSessionId]/page.tsx:101-103`](src/app/organizer/classes/%5BclassSessionId%5D/page.tsx)、[`src/app/teacher/classes/page.tsx:72-78`](src/app/teacher/classes/page.tsx) 三處直接讀 `.demandRequest.targetLevel`，無 null 檢查。
  - `organization`／`organizerProfile` 巢狀 select 同樣假設關聯必存在，且比 `demandRequest` 的破壞面更廣：[`src/domain/enrollment/read-service.ts:95`](src/domain/enrollment/read-service.ts)（`getClassSessionForMember` 的 `organization: { select: { name: true } }`）；渲染端 [`src/app/classes/[classSessionId]/page.tsx:77`](src/app/classes/%5BclassSessionId%5D/page.tsx) 直接讀 `classSession.organization.name`，無 null 檢查。`admin-service.ts` 的 `listAllClassSessionsForAdmin`（[第 42、44、59、61 行](src/domain/class-session/admin-service.ts)）與 `getClassSessionDetailForAdmin`（[第 116、118 行](src/domain/class-session/admin-service.ts)）直接把 `organizerProfile.displayName`／`organization.name` 型別宣告成非 nullable 字串並直接賦值，一旦關聯是 `null`，這是**編譯期就會出錯**的型別衝突，不是執行期例外——TypeScript 會在 Builder 跑 `tsc` 時直接擋下來，等於逼著 Builder 一次性把這兩個 DTO 與其消費端全部改完，不能只改一半。
  - `src/domain/class-session/__internal__/cancel-class-session-core.ts` 的私有 `cancelClassSessionCore(organizerProfileId: string | null, ...)`：目前的擁有權設計只有兩種語意——`null` 代表 Admin（不過濾）、非 `null` 代表 Organizer 擁有權過濾。**這個函式沒有第三種「Teacher 擁有權過濾」的設計空間**，本計畫若要讓老師取消自己開的課，不能直接呼叫或小改這個函式，必須是獨立的核心（見第 7 節修正）。
  - 這是本計畫 Slice A 的強制交付項，不是選項；Builder 開始 Slice A 前必須先用 `rg "\.organization\.|\.organizerProfile\.|\.demandRequest\." src/app src/domain` 之類的搜尋重新確認上述清單是否完整，本文件列出的只是撰寫當下驗證過的結果，不是保證窮舉。
- **既有建課/取消/完成的程式碼形狀**（[`__internal__/create-class-session-core.ts`](src/domain/class-session/__internal__/create-class-session-core.ts)、[`service.ts`](src/domain/class-session/service.ts)）：Organizer 版走「`$transaction` 內 `FOR UPDATE` 鎖 `DemandRequest` → 驗證 `status === matched` → 查 `selected` response → 建立」；取消/完成走「單一 `updateMany` + `count===0` 才分類錯誤」的簡單形狀（因為只有單一 Organizer 操作自己的資源，沒有多方競爭）。本計畫的老師直接建課路徑，**不修改**這些既有函式，而是新增一組平行的 Teacher-owned 函式，理由與 [`2026-08-03-lightweight-payment-v0-plan.md`](2026-08-03-lightweight-payment-v0-plan.md) 一路遵循的「不碰已測試過的既有邏輯」原則一致。
- **既有報名核心**（[`__internal__/create-enrollment-core.ts`](src/domain/enrollment/__internal__/create-enrollment-core.ts)）：`$transaction` 內 `FOR UPDATE` 鎖 `ClassSession`，檢查 `open_for_enrollment` → `startAt` 未到 → `confirmed` 數 < capacity → 無重複報名 → 建立並直接寫入 `status: "confirmed"`（**跳過 `pending`**）。本計畫若要支援「老師審核後才確認」（見 Gate G2/G3），**必須修改這個函式**——這是本計畫唯一一處會動到既有、被高度依賴的核心邏輯的地方，必須用完整既有 regression test 覆蓋。
- `docs/domain/permissions.md` 的 Security Review Required 清單已列出 `teacher approval`、`demand visibility`、`enrollment capacity`——本計畫直接touch 到 `enrollment capacity`（見上一點）與新的 `teacher 直接建課` 權限，必須完整過一輪 security review，不能跳過。
- `AGENTS.md` non-goals 明列 `Teacher SaaS tooling`、`Google Calendar two-way sync`。本計畫**不算**把平台變成 Teacher SaaS——老師仍在同一個 marketplace 資料模型與審核機制內開課，沒有獨立品牌、獨立網域或獨立商業條款；但這條界線值得記錄：若之後有人想把「老師自己的品牌頁」「老師自訂網域」等功能疊上去，那才會真正撞上這條 non-goal，需要重新確認。Google Calendar 同步維持排除，是完全獨立的未來決策。
- **與 [`2026-08-03-lightweight-payment-v0-plan.md`](2026-08-03-lightweight-payment-v0-plan.md) 的交接**：該計畫的付款欄位全部掛在 `Enrollment` 上，與 `ClassSession` 的建立來源（Organizer 媒合或老師自建）無關；`paymentAccountInfoSnapshot` 揭露時機（P4：「只在學生成功報名之後」）對老師自建課程的個人報名者同樣適用，不需要額外設計。**兩個計畫沒有結構性衝突**，但若兩者交付順序重疊，Builder 需注意 `Enrollment` model 的欄位變更（本計畫可能新增 `pending` 狀態的實際使用；付款計畫新增 `paymentStatus` 等欄位）不要在同一次 migration 裡互相打斷對方的欄位順序或 index。
- **與 [`2026-08-02-brand-visual-design-system-plan.md`](2026-08-02-brand-visual-design-system-plan.md) 的交接**：該計畫尚未核准任何色票（Gate B1–B5 待決）。本計畫新增的 `/classes` 公開頁面**一律沿用現有頁面既有元件與 Tailwind class 慣例**，不引入新色票、不預先假設該計畫的 token（比照付款計畫 P8 的既有先例）。視覺對齊留給品牌計畫核准後另案套用。
- 工作樹目前有其他未提交修改（`docs/product/route-map.md`、`next.config.ts`、`package.json`、public trust pages 相關檔案等）。Builder 只能處理本計畫 allowlist，不能清理、覆寫或提交其他變更。

## 3. Scope

### In scope

- **Prisma schema**：`ClassSession.demandRequestId`／`organizerProfileId`／`organizationId` 改為 nullable；新增 `ClassSessionOrigin` enum（`organizer_matched` / `teacher_initiated`）與 `ClassSession.origin` 欄位（`@default(organizer_matched)`，既有資料自動落在正確值，不需回填 script）；新增 `RecurringClassSeries` model；`ClassSession` 新增 `recurringClassSeriesId`（nullable FK）與 `requiresApproval`（`Boolean @default(false)`）欄位。
- **雙重預約衝突檢查**：新增共用的 conflict-check，Organizer 既有建課路徑與老師新建課路徑都必須呼叫，檢查同一 `teacherProfileId` 是否已有時間重疊的非取消 `ClassSession`。
- **老師直接建課**：單堂或常規/固定期系列，own-scoped，重用既有 `TeacherAvailability`/`AvailabilityException` 顯示邏輯提示老師目前已宣告的可授課時段（不強制限制在該時段內建課，只做提示，避免範圍膨脹）。
- **常規/固定期課程**：`RecurringClassSeries` + 實際生成多筆獨立 `ClassSession` row（見第 6 節資料模型與 Gate G1 的理由）；支援單堂例外（取消/調整其中一場不影響系列其餘場次，因為每一場本來就是獨立 row）。
- **老師取消/開放報名/標記完成 own-scoped 版本**：平行於既有 Organizer 版本，鏈結到 `teacherProfileId` 而非 `organizerProfileId`。
- **可選的報名審核**：`requiresApproval = true` 的課程，新報名先落在 `pending`（既有保留但未接線的 enum 值），老師需明確確認/拒絕才會變成 `confirmed`/`cancelled`。
- **跨角色公開瀏覽**：正式啟用 `/classes`（依既有 route-map 預留）與放寬 `/classes/[classSessionId]` 給 Visitor（依既有 route-map「完整未來設計」），依風格/形式/星期幾篩選，重用先前已驗證過的老師目錄排版邏輯。
- **老師統一列表**：`listOwnClassSessionsForTeacher()` 本來就是 `where: { teacherProfileId }`，不分來源——本計畫只需修正 null-safety 與新增來源徽章／系列資訊顯示，不需要新查詢。
- 更新 `docs/domain/data-model.md`、`state-machines.md`、`permissions.md`、`permissions-matrix.md`、`docs/product/route-map.md`、`docs/product/current-functional-architecture.md`。

### Explicitly out of scope

- **Google Calendar 雙向同步**——`AGENTS.md` 明列的 V1 non-goal，維持排除，是完全獨立的未來決策，不在本計畫討論範圍。
- **完整金流自動化**——維持 `2026-08-03-lightweight-payment-v0-plan.md` 現有的手動記帳模型，本計畫不新增任何金流邏輯。
- **候位（waitlist）機制**——課程滿額後不提供候位，維持現有「額滿即不可報名」行為。
- **團課餘位開放給公開個人報名**——上次對話中提出的延伸想法，本計畫刻意不處理，留待未來另案決策。
- **老師自建課程的 Admin 審核流程**——沿用既有「只有 `approved` 老師才能操作」的資格檢查，不新增逐堂課程內容審核。
- **常規課程自動延伸（背景排程）**——V1 只提供老師手動觸發「生成更多場次」的動作，不做 cron/queue。
- **時區顯示邏輯**——沿用現有 UTC 錨定的日期處理慣例，不新增時區轉換 UI。
- **個人以「一人組織」提需求的既有路徑**——這條路徑今天已經可行（見本對話前段分析），本計畫不修改 `DemandRequest`/`OrganizerProfile` 任何邏輯。
- **DemandRequest／DemandResponse 狀態機**——完全不變更；老師建課路徑與既有媒合路徑在 domain 層是平行、獨立的兩組函式。

## 4. Product Owner Decision Gates

| Gate | 選項 | 建議預設 | 為什麼重要 |
|---|---|---|---|
| G1 常規課程資料模型 | A：預先生成多筆獨立 `ClassSession` row（materialize） / B：範本 + 動態展開 | **A** | A 可以讓 Enrollment、取消、完成、公開列表、老師行事曆的既有邏輯完全不用理解「範本」概念，只需要處理已經很熟悉的單筆 `ClassSession`；B 會讓每一個既有消費端都要重新學會「範本 + 例外」的判讀規則，回歸風險高很多 |
| G2 是否支援報名需老師審核 | A：所有老師自建課程都是秒確認 / B：老師可在建課時選擇「需要我確認才算報名成功」 | **B**，重用既有保留但未接線的 `pending` enum 值 | 陌生人可以直接報名老師自建的課，跟團主媒合（參與者通常已被團主篩過）在信任層級上不同；老師應該有選擇要不要保留篩選權，但不強制每堂課都要審核，避免造成不必要的操作負擔 |
| G3 `pending` 報名是否佔用名額 | A：佔用（保留席位等老師確認） / B：不佔用（先搶先贏，審核只是事後個資篩選） | **A** | 多數使用者對「已送出報名」的直覺理解是名額已經保留；若不佔用，老師確認前名額可能被別人搶走，體驗矛盾。之後若要做「pending 逾時自動釋放」，是可以疊加的後續優化，不影響本輪決策 |
| G4 常規課程生成範圍 | A：老師建立時明確選擇「這次生成幾場」（例如未來 8 場），之後手動點擊「生成更多」 / B：自動無上限延伸（需要背景排程） | **A** | 沒有 queue/cron 基礎設施是既有 `docs/scope/non-goals.md` 的 Technical Non-goals；A 不需要任何新 infra，符合現有技術原則 |
| G5 雙重預約衝突檢查的嚴重程度 | A：硬擋（回傳明確錯誤，不可建立） / B：警告但allow | **A** | 現有程式碼對所有狀態/容量檢查都是硬擋（見 `create-enrollment-core.ts` 的 capacity 檢查），沒有「警告但allow」的先例；老師被同時排兩堂課是純粹的正確性錯誤，不該給例外 |
| G6 `/classes` 公開頁視覺樣式 | A：沿用現有預設樣式，等品牌視覺計畫核准後再套用 / B：等品牌視覺計畫先核准，兩案綁在一起交付 | **A** | 兩個計畫都是獨立、尚待核准的大範圍變更，綁在一起交付會讓任何一邊卡住都拖累另一邊 |
| G7 舊有 Organizer 建課路徑要不要一起補上衝突檢查 | A：一起補（新 conflict-check 由 Organizer 與 Teacher 兩條建課路徑共用） / B：只套用在新的老師路徑，Organizer 路徑維持現狀 | **A** | 現有 Organizer 建課路徑其實從來沒有檢查過老師是否被排重複時段——這是既有系統的潛在正確性漏洞，一旦老師同時能被兩條路徑預約，這個漏洞的實際發生機率會提高，一次修好比留著兩套不一致的保護邏輯更安全 |

Builder 開始 Slice B（常規課程）與 Slice C（審核機制）前，G1–G4 必須先由產品主人確認；Slice A（schema + 單堂建課 + null-safety 修復 + 衝突檢查）可以先依上表建議預設開始，因為即使之後 G1 選 B，Slice A 的 schema 變更（nullable FK、`origin` 欄位）不會被推翻，只是 `RecurringClassSeries` 的內部設計要重做。

## 5. Data Model Changes

```prisma
enum ClassSessionOrigin {
  organizer_matched
  teacher_initiated
}

// G1 = A：常規／固定期課程的「範本」，實際可報名的單位仍是下面的 ClassSession 逐筆記錄。
// dayOfWeek 只在「每週固定」模式使用；固定期課程（例如連續 4 週的特定日期組合）由
// Builder 在生成時直接寫入每筆 ClassSession 的 startAt/endAt，series 本身不需要記錄
// 每一個具體日期。
model RecurringClassSeries {
  id               String   @id @default(cuid())
  teacherProfileId String
  title            String
  description      String?
  serviceType      String?
  dayOfWeek        Int?     // 0（週日）–6，對齊既有 TeacherAvailability 慣例；固定期課程可為 null
  startTime        String   // "HH:mm"
  endTime          String   // "HH:mm"
  location         String
  capacity         Int
  requiresApproval Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  teacherProfile TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
  classSessions  ClassSession[]

  @@index([teacherProfileId])
}

model ClassSession {
  id                     String              @id @default(cuid())
  demandRequestId        String?             @unique // 改為 nullable；Postgres 唯一索引允許多筆 NULL，既有「一個 demand 最多一個 class」語意不受影響
  teacherProfileId       String              // 不變：一律必填，任何來源的課程都一定有授課老師
  organizerProfileId     String?             // 改為 nullable
  organizationId         String?             // 改為 nullable
  origin                 ClassSessionOrigin  @default(organizer_matched)
  recurringClassSeriesId String?
  requiresApproval       Boolean             @default(false)
  title                  String
  description            String?
  serviceType            String?
  startAt                DateTime
  endAt                  DateTime
  location               String
  capacity               Int
  isPublic               Boolean             @default(false)
  status                 ClassSessionStatus  @default(draft)
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt

  demandRequest        DemandRequest?         @relation(fields: [demandRequestId], references: [id], onDelete: Restrict)
  teacherProfile       TeacherProfile         @relation(fields: [teacherProfileId], references: [id], onDelete: Restrict)
  organizerProfile     OrganizerProfile?      @relation(fields: [organizerProfileId], references: [id], onDelete: Restrict)
  organization         Organization?          @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  recurringClassSeries RecurringClassSeries?  @relation(fields: [recurringClassSeriesId], references: [id], onDelete: SetNull)
  enrollments          Enrollment[]
  reviews              Review[]

  @@index([teacherProfileId])
  @@index([organizerProfileId])
  @@index([status])
  @@index([recurringClassSeriesId])
  @@index([origin])
}
```

**應用層不變量（非資料庫 CHECK 約束，比照現有 `serviceType` 應用層受控字串的既有慣例，不新增 DB 層約束基礎設施）**：`origin = organizer_matched` 時，`demandRequestId`／`organizerProfileId`／`organizationId` 三者必須同時非 null；`origin = teacher_initiated` 時，三者必須同時是 null。這個不變量只由兩條建課路徑各自的核心函式保證（各自寫死正確的欄位組合，不共用同一個泛用 create 函式），不做資料庫層防呆——若 Builder 之後發現有第三條建課路徑，必須回頭補這個不變量的檢查，不能預設「反正只有兩條路徑」。

`Enrollment` model **不新增欄位**——`pending` 已是既有 `EnrollmentStatus` 保留值（[`schema.prisma:341`](prisma/schema.prisma)），本計畫是第一次真正接線它。

**Codex round 1 修正新增**：`NotificationType` enum（[`schema.prisma:349-369`](prisma/schema.prisma)）新增一項 `enrollment_pending_review`，供第 8 節「報名建立為 `pending` 時通知會員審核中，而非誤發已確認通知」使用；理由與影響範圍見第 8 節。這是本計畫唯一一處 enum 新增（不含上面已列出的 `ClassSessionOrigin`）。

## 6. Conflict Check (shared by both creation paths)

**Codex round 1 修正**：原始草稿只在 transaction 內「查詢是否已有重疊 row」，這不足以防止併發——兩個幾乎同時對同一位老師建課的 transaction，若當下都還查不到任何既有重疊 row（因為對方尚未 commit），會**兩個都通過檢查並成功插入**，產生真正的重複預約。純粹的「查詢 → 判斷 → 插入」無法自我序列化，必須有一個共同的鎖點讓第二個 transaction 等待第一個 commit 之後才能繼續。

修正後的設計：新增 `src/domain/class-session/conflict-check.ts`：

```ts
export async function lockTeacherScheduleAndCheckConflict(
  tx: PrismaTransactionClient,
  teacherProfileId: string,
  startAt: Date,
  endAt: Date,
  excludeClassSessionId?: string,
): Promise<{ id: string; title: string } | null>
```

邏輯（**必須依此順序**，理由見下）：

1. `SELECT id FROM "TeacherProfile" WHERE id = ${teacherProfileId} FOR UPDATE`——鎖住這位老師的 `TeacherProfile` row。這一步是防止 race 的關鍵：任何兩個「對同一位老師建課」的 transaction，不論走 Organizer 路徑還是 Teacher 路徑，都會在這裡排隊，第二個必須等第一個 transaction commit（或 rollback）才能繼續往下查詢重疊——因此當第二個 transaction 真正執行重疊查詢時，第一個 transaction 已經寫入的 `ClassSession` row 保證可見，不會出現「兩者都查不到對方」的競態窗口。
2. 鎖到之後，查詢該 `teacherProfileId` 底下所有 `status NOT IN ('cancelled')` 的 `ClassSession`（排除 `excludeClassSessionId`，供未來若有編輯情境使用），`startAt < :newEndAt AND endAt > :newStartAt`（標準區間重疊判斷），若有結果則回傳第一筆供錯誤訊息引用。

**兩條建課路徑都必須呼叫，且鎖定順序必須一致**（Gate G7 = A）：

- `createClassSessionForOrganizer`（既有函式，[`create-class-session-core.ts:75`](src/domain/class-session/__internal__/create-class-session-core.ts)）：目前既有邏輯先鎖 `DemandRequest`（步驟 a）。本計畫要求**在鎖 `DemandRequest` 之後、建立 `ClassSession` 之前**呼叫本函式（此時已經在同一個 transaction 內，鎖 `TeacherProfile` 是額外多鎖一個 row，不影響既有 `DemandRequest` 鎖的語意）。若衝突則新增錯誤碼 `teacher_schedule_conflict`，回傳給 Organizer「這位老師在這個時段已經有其他課程」。這是本計畫對既有、已測試通過的 Organizer 路徑做的**唯一一處修改**——純新增一個檢查步驟，不改變既有任何成功路徑的行為，且既有 smoke test 中沒有任何情境本來就依賴「老師被排重複時段仍然成功建課」，因此不會破壞既有測試。
- 新的 `createClassSessionForTeacher` 核心函式（見第 7 節）：同一個檢查函式，同一個錯誤碼，**一律先鎖 `TeacherProfile` 再進行其他任何查詢/寫入**。
- **鎖定順序規則**：兩條路徑都必須是「先鎖 `TeacherProfile`，其他鎖（`DemandRequest`／未來若有的 `ClassSession`）在之後」——若兩條路徑對多個鎖的取得順序不一致，會產生真正的資料庫死鎖（transaction A 先鎖 X 再等 Y，transaction B 先鎖 Y 再等 X，兩者永久互相等待）。這條規則必須寫進兩個核心檔案的程式碼註解，不能只留在本文件。

**新增測試（Test Matrix 同步更新，見第 12 節）**：兩個併發請求（一個 Organizer 媒合建課、一個老師自建課，或兩者皆為老師自建）對同一位老師建立時間重疊的課程，只有一個成功、另一個收到明確的 `teacher_schedule_conflict` 錯誤，且資料庫最終只有一筆對應的 `ClassSession`——比照 `create-enrollment-core.ts` 既有併發測試（兩個使用者搶最後一個名額）的既有測試手法（用 `hooks.onLockAcquired` 讓其中一個 transaction 暫停，確保測試能重現真正的鎖等待，而不是僥倖沒撞上競態窗口）。

## 7. Teacher-Owned Service Functions（平行於既有 Organizer 版本，不修改既有函式本體）

新增 `src/domain/class-session/__internal__/create-teacher-class-session-core.ts`，形狀比照既有 `create-class-session-core.ts`，差異：

- 不鎖 `DemandRequest`，改為直接驗證呼叫者的 `TeacherProfile.status === 'approved'`（比照既有 demand-response 資格檢查慣例）。
- 呼叫第 6 節的 conflict-check。
- 建立時 `origin: 'teacher_initiated'`、`demandRequestId`／`organizerProfileId`／`organizationId` 皆為 `null`、`teacherProfileId` 為呼叫者自己。
- 若帶有 `recurringClassSeriesId`，額外驗證該 series 屬於同一位老師。

新增 `src/domain/class-session/__internal__/generate-recurring-occurrences-core.ts`：接受 `RecurringClassSeries` 與「生成幾場」的數量（Gate G4），依 `dayOfWeek`/`startTime`/`endTime` 計算未來對應日期（固定期課程則由呼叫端直接帶入明確日期清單，這個函式只負責常規週期的日期推算），逐筆呼叫上面的建立邏輯（含 conflict-check——常規課程生成也要檢查每一場是否跟老師既有其他課程衝突，若某一場衝突，該場**跳過**並在回傳結果中列出「哪幾場因衝突未生成」，不讓整批生成因為一場衝突而全部失敗）。

`service.ts` 新增對外函式，命名與既有 Organizer 版本對稱：

- `createOwnClassSessionForTeacher(input)` — 單堂。
- `createOwnRecurringClassSeriesForTeacher(input)` — 建立 series 並首次生成（数量依 G4）。
- `generateMoreOccurrencesForTeacher(recurringClassSeriesId, count)` — 手動延伸。
- `openOwnClassSessionForEnrollmentForTeacher(classSessionId)` — own-scope 判斷改成 `teacherProfileId` 的單一 `updateMany`，邏輯與既有 Organizer 版本（[`service.ts:149`](src/domain/class-session/service.ts) 的 `openOwnClassSessionForEnrollment`）幾乎一致，可以放心比照複製，因為那個函式本身就是單一 `updateMany` + 分類錯誤，沒有共用的核心檔案需要顧慮。

**Codex round 1 修正 — 取消／完成不能直接比照或小改既有核心**：[`__internal__/cancel-class-session-core.ts`](src/domain/class-session/__internal__/cancel-class-session-core.ts) 內部私有的 `cancelClassSessionCore(organizerProfileId: string | null, ...)` 的擁有權過濾只支援兩種語意——參數 `null` 代表 Admin（不過濾擁有權）、非 `null` 代表用該值過濾 `organizerProfileId`。這個函式**沒有第三種「用 `teacherProfileId` 過濾」的設計空間**，直接傳入 teacherProfileId 會被誤判成 organizerProfileId 去比對錯誤的欄位。因此：

- **不修改**這個既有私有函式的擁有權過濾設計（比照本計畫其他地方「不碰已測試過的既有邏輯」的一致原則），但**必須修正一個因 nullable 化直接觸發的既有 bug**（見下方「Codex round 2 修正」）。
- 新增獨立的 `src/domain/class-session/__internal__/cancel-class-session-core-for-teacher.ts`，複製同一段 transaction 形狀（鎖 `ClassSession` → 檢查未取消 → 檢查可取消狀態集合 → 檢查 `startAt` 未到 → 轉為 `cancelled` → 連帶取消 `Enrollment`），差異只是鎖查詢的 `WHERE` 用 `teacherProfileId` 過濾而不是 `organizerProfileId`。**連帶取消的 `Enrollment` where 條件必須同步套用第 8 節的 `pending` 修正**（`status IN ('confirmed', 'pending')`，不是既有核心目前寫的 `status = 'confirmed'`），否則老師自建課程被取消時，等待審核中的報名會被遺留成孤兒資料。
- 同理新增 `complete-class-session-core-for-teacher.ts`，複製 `completeOwnClassSession`（[`service.ts:347`](src/domain/class-session/service.ts)）的單一 `updateMany` 形狀，過濾條件改為 `teacherProfileId`。**Codex round 2 修正**：`completeOwnClassSession` 成功後不只是單一 `updateMany`——[第 393-424 行](src/domain/class-session/service.ts) 在 tx commit 之後還會查出所有 `confirmed` enrollment 並發送 `class_session_completed` 通知（邀請留下評價）。teacher 版必須複製這整段 post-commit 通知邏輯，不能只複製 `updateMany`，否則同一個 `ClassSession` model 的「完成」行為會依來源不同而不一致——老師自建課程完成後，學生完全不會收到邀請評價的通知。
- **取消整個系列**是額外動作 `cancelRecurringClassSeriesForTeacher(recurringClassSeriesId)`，只取消該系列底下 `startAt` 尚未到達、狀態為 `draft`/`open_for_enrollment` 的場次（已開始或已完成的場次不受影響），逐筆呼叫上面新增的 teacher 版取消核心，比照既有單堂取消的時間限制邏輯。

**Codex round 2 修正 — `cancel-class-session-core.ts` 既有的通知解析邏輯在 nullable 化之後會整批吞掉例外**：該檔案[第 165-174 行](src/domain/class-session/__internal__/cancel-class-session-core.ts) 的 post-commit 通知解析目前無條件呼叫 `prisma.organizerProfile.findUnique({ where: { id: resolvedOrganizerProfileId }, ... })`。`resolvedOrganizerProfileId` 是從資料庫讀回的 `classSession.organizerProfileId`——本計畫讓這個欄位可以是 `null`（老師自建課程）。Prisma 的 `findUnique({ where: { id: null } })` 會拋出驗證例外，而這個查詢包在 `Promise.all` 裡、外層又被 `try { ... } catch (notifyError) { console.error(...) }` 整段吞掉（比照既有「通知失敗不影響已成功的狀態轉換」的設計原則）——結果是：**當 Admin 透過既有 `cancelClassSessionForAdmin` 取消一堂老師自建課程時，取消本身會成功，但老師與所有受影響會員的取消通知會整批悄悄消失，且不會有任何錯誤紀錄能追查**（`console.error` 會印，但沒有人在看 log 就等於沒發生）。修正：把這段改成條件式查詢——

```ts
const [organizerProfile, teacherProfile] = await Promise.all([
  resolvedOrganizerProfileId
    ? prisma.organizerProfile.findUnique({
        where: { id: resolvedOrganizerProfileId },
        select: { userId: true },
      })
    : Promise.resolve(null),
  prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { userId: true },
  }),
]);
```

`teacherProfileId` 一律非 null（不論課程來源），不受影響。既有 `if (organizerProfile) { recipients.push(...) }` 判斷不需要更動，`null` 本來就會被正確跳過。這是本計畫對 `cancel-class-session-core.ts` 的**第二處**修改（第一處是第 8 節的 cascade SQL 加入 `pending`），第 10 節檔案邊界需同步更新。

是的，這代表老師自建課程的取消/完成邏輯會跟 Organizer 版本有一定程度的程式碼重複，而不是共用一份。這是刻意的取捨：複製一段已經被完整測試過的 transaction 形狀，比重構共用核心去容納第三種擁有權語意，對既有 Organizer/Admin 取消流程的回歸風險小得多——跟本計畫在建課邏輯上做的選擇（獨立的 `create-teacher-class-session-core.ts`，而非修改 `create-class-session-core.ts`）是同一個原則。

## 8. Enrollment Approval (Gate G2/G3)

修改 [`__internal__/create-enrollment-core.ts`](src/domain/enrollment/__internal__/create-enrollment-core.ts)：

- 鎖 `ClassSession` 時多讀 `requiresApproval` 與 `teacherProfileId`。
- **新增資格檢查**（Codex round 2 提出，見第 9 節的完整討論）：多查一次 `teacherProfile.status`，非 `approved` 時新增錯誤碼 `teacher_not_approved`，阻擋新報名——不論報名者是透過 `/classes` 公開瀏覽還是既有 `getClassSessionForMember()` 直連進來，統一在這唯一入口把關，避免兩條路徑各自重複判斷、或其中一條被遺漏。
- **Codex round 3 修正 — 這個檢查本身有 TOCTOU 併發漏洞**：單純在鎖住 `ClassSession` 之後才做一次性讀取 `teacherProfile.status`，跟 Admin 執行 suspend 的那個獨立 `UPDATE` **不會互相序列化**——報名 transaction 讀到 `approved` 之後，Admin 的 suspend `UPDATE` 完全可以在報名 transaction commit 之前先行 commit，讓報名 transaction 帶著一個已經過期的「approved」判斷繼續把 enrollment 寫入成功。修正：在同一個 transaction 內，讀取 `teacherProfile.status` 之前先 `SELECT id FROM "TeacherProfile" WHERE id = ${teacherProfileId} FOR UPDATE`——PostgreSQL 的列鎖是通用機制，不論鎖的取得方是哪個函式，任何對同一列的 `UPDATE`（包括 Admin suspend 動作的 `UPDATE`，不論它是否包在明顯的 `$transaction` 裡）在執行期間都會持有同一把列鎖；報名 transaction 的 `FOR UPDATE` 會正確排在該 `UPDATE` 之後（或之前，視實際執行順序），讀到的一定是該 `UPDATE` commit 後的最終狀態，不會有讀到中間過期值的窗口。這是本計畫**第三次**用同一個「鎖 `TeacherProfile` 列」手法解決 TOCTOU 問題（第一次是第 6 節的建課衝突檢查），Builder 應該把這個模式視為本計畫處理「跟老師狀態相關的併發正確性」的統一手法，不是三個各自發明的小修補。**Codex round 4 修正 — 上一版的測試斷言本身是錯的**：「最終不會出現 suspended 老師 + 成功新報名」不是正確的不變量——鎖只保證兩個 transaction 正確排隊，不保證誰先誰後；如果報名 transaction 先取得 `TeacherProfile` 鎖，它會合法讀到 `approved` 並成功建立報名，*之後* Admin 的 suspend 才 commit，最終狀態就是「這位老師已被 suspend，且存在一筆在 suspend 生效前合法建立的報名」——這正是本文件自己引用的「暫停不回溯影響既有承諾」原則所要求的正確結果，不是 bug。正確的測試斷言必須依鎖的先後順序分別描述：
- 若 suspend 的 `UPDATE` 先取得鎖並 commit：等待中的報名 transaction 接下來讀到 `suspended`，回傳 `teacher_not_approved`，不建立報名。
- 若報名的 `SELECT ... FOR UPDATE` 先取得鎖：報名成功建立並 commit；等待中的 suspend `UPDATE` 之後照常成功，老師變成 `suspended`，但剛才那筆報名維持有效（不被追溯撤銷）。
兩種順序都要各寫一個測試驗證，不能只驗證其中一種、也不能假設兩者互斥的「絕不共存」不變量。
- 容量檢查改為 `count({ where: { classSessionId, status: { in: ["confirmed", "pending"] } } })`（Gate G3 = A，pending 佔用名額）。
- 建立時：`requiresApproval === true` 則 `status: "pending"`；否則維持現況 `status: "confirmed"`（既有行為零改變）。

新增 `src/domain/enrollment/service.ts` 函式：

- `confirmPendingEnrollmentForTeacher(enrollmentId)` — 驗證該 enrollment 所屬 classSession 的 teacherProfileId 是自己，且目前是 `pending`，且該 classSession 的 `startAt` 尚未到達（見下方時間邊界說明），原子轉換為 `confirmed`（沿用既有 compare-and-set 風格，不先讀後寫）。
- `declinePendingEnrollmentForTeacher(enrollmentId)` — 同上條件（含時間邊界），轉換為 `cancelled`（reuse 既有值，不新增 enum）。

**Codex round 1 修正 — 原始草稿完全沒處理 `pending` 的下游生命週期，以下四處既有程式碼都假設報名只有 `confirmed`／已被硬刪除到不存在兩種情況，逐一列出並修正**：

1. **通知內容錯誤**：[`create-enrollment-core.ts`](src/domain/enrollment/__internal__/create-enrollment-core.ts) 目前建立成功後一律呼叫 `notifyOverride("enrollment_confirmed", ...)`（[第 162 行](src/domain/enrollment/__internal__/create-enrollment-core.ts)）。若這次建立的其實是 `pending`，繼續發送「已確認」通知會誤導會員。修正：新增 `NotificationType` 列舉值 `enrollment_pending_review`（[`schema.prisma:349-369`](prisma/schema.prisma) 的 `NotificationType` enum 新增一項），建立時依 `status` 分流通知類型：`confirmed` 才發 `enrollment_confirmed`（既有行為不變），`pending` 改發 `enrollment_pending_review`。`confirmPendingEnrollmentForTeacher` 成功後才真正發送 `enrollment_confirmed`（語意上完全對應「現在才是真的確認了」，不需要另外新增一個「已核准」的通知類型）；`declinePendingEnrollmentForTeacher` 成功後 reuse 既有 `enrollment_cancelled`。`src/domain/notification/copy.ts` 的 `COPY_TABLE` 需要補上 `enrollment_pending_review` 的文案（型別是 `Partial<Record<...>>`，沒補不會編譯失敗，但會讓通知內容空白，Builder 不得省略）。
2. **無法自助取消**：`cancelOwnEnrollment`（[`enrollment/service.ts:160-168`](src/domain/enrollment/service.ts)）的 `updateMany` where 條件寫死 `status: "confirmed"`。修正為 `status: { in: ["confirmed", "pending"] }`——會員應該能取消自己還在等待審核的報名，不需要等老師處理。
3. **Admin 無法介入**：`cancelEnrollmentForAdminCore`（[`cancel-enrollment-for-admin-core.ts:35-42`](src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core.ts)）同樣寫死 `status: "confirmed"`，需同步放寬為 `{ in: ["confirmed", "pending"] }`，讓 Admin 能處理卡住的審核爭議。
4. **課程取消時遺留孤兒報名**：`cancel-class-session-core.ts` 的連帶取消原始 SQL（[第 147-152 行](src/domain/class-session/__internal__/cancel-class-session-core.ts)）只更新 `"status" = 'confirmed'::"EnrollmentStatus"` 的列。整堂課被取消時，`pending` 報名必須一併轉為 `cancelled`，否則永遠卡在等待一個已經不存在的課程審核。此修正同時適用於既有 Organizer/Admin 版本（`cancel-class-session-core.ts`）與第 7 節新增的 teacher 版本，兩處都要改。

**Codex round 2 修正 — 老師端完全看不到 `pending` 報名，審核機制形同虛設**：`listOwnClassSessionsForTeacher()`（[`class-session/read-service.ts:148-151`](src/domain/class-session/read-service.ts)）的 `enrollments` 子查詢寫死 `where: { status: "confirmed" }`，且 `TeacherFacingClassSession.enrollments[]` 型別（[第 101-105 行](src/domain/class-session/read-service.ts)）沒有 `status` 欄位。上面新增的 `confirmPendingEnrollmentForTeacher`／`declinePendingEnrollmentForTeacher` 雖然存在，但老師端的 roster 頁面（`/teacher/classes`）根本查不到任何 `pending` 報名，等於這兩個函式沒有 UI 可以觸發——審核機制在寫入端做完了，讀取端完全沒接上。修正：`enrollments` 子查詢改為 `where: { status: { in: ["confirmed", "pending"] } } }`，型別擴充 `status: EnrollmentStatus`，`/teacher/classes/page.tsx` 對 `pending` 報名顯示確認/拒絕按鈕，對 `confirmed` 維持現況。

**Codex round 2 修正 — 會員端已有 `pending` 標籤，但取消按鈕沒有跟上**：實際開檔驗證（不是本文件先前標記的「audit item」，這次真的讀了）：[`src/app/member/enrollments/page.tsx:13-17`](src/app/member/enrollments/page.tsx) 的 `enrollmentStatusLabels` 已經包含 `pending: "處理中"`（推測是既有程式碼已經預留但從未真正產生 `pending` 資料，本計畫是第一次讓這個標籤真正顯示出來）；但[第 93 行](src/app/member/enrollments/page.tsx)的取消表單只在 `enrollment.status === "confirmed"` 時渲染（`{enrollment.status === "confirmed" ? (<取消表單>) : null}`）。修正：改為 `enrollment.status === "confirmed" || enrollment.status === "pending"`，讓會員能對 `pending` 報名觸發同一個 `cancelEnrollmentAction`（其底層 `cancelOwnEnrollment` 已在修正 2 放寬支援 `pending`）。這取代本文件第 10 節先前對這個檔案標記的「audit 是否存在同構問題」，現在是明確、已驗證的修正項，不是待查項。

**時間邊界（比照既有 `startAt`／`endAt` guard 慣例，不新增例外規則）**：`confirmPendingEnrollmentForTeacher`／`declinePendingEnrollmentForTeacher` 都必須要求 `classSession.startAt` 尚未到達，逾時回傳 `class_session_already_started`——課程已經開始後，「確認」一筆從未被確認過的報名沒有實際意義（無法回溯讓對方變成已確認的參與者），為了跟既有取消/報名的時間 guard 保持一致的心智模型，確認與拒絕採用同一條規則，不做不對稱設計。

**會員端顯示修正**：[`src/app/classes/[classSessionId]/page.tsx:117`](src/app/classes/%5BclassSessionId%5D/page.tsx) 目前把 `ownEnrollment.status !== "confirmed"` 一律顯示為「已取消」（`{classSession.ownEnrollment.status === "confirmed" ? "已報名" : "已取消"}`）。這對 `pending` 是錯誤訊息——正在等待審核的報名顯示成「已取消」會讓會員誤以為報名失敗。修正為三態顯示：`confirmed` → 「已報名」、`pending` → 「審核中」、`cancelled` → 「已取消」。`src/app/member/enrollments/page.tsx`（若存在同構的既有二態判斷邏輯）需要 Builder 比照同一修正方式 audit 並修正，本文件不假設其現況細節，但要求 Builder 在 Slice C 完成時明確回報是否找到、是否修正。

## 9. Public Discovery（正式接上既有 route-map 的「完整未來設計」）

**Codex round 1 修正 — 原始草稿的兩個關鍵缺陷**：(a) 描述「放寬既有 `/classes/[classSessionId]` 頁面給 Visitor」，但該頁面實際的資料來源 [`getClassSessionForMember()`](src/domain/enrollment/read-service.ts:78) 內部**無條件呼叫 `requireUser()`**（[第 81 行](src/domain/enrollment/read-service.ts)），且頁面本身在呼叫這個函式之前就已經 `await requireUser()` 並在失敗時 `redirect("/sign-in")`（[`src/app/classes/[classSessionId]/page.tsx:20-23`](src/app/classes/%5BclassSessionId%5D/page.tsx)）——這代表 Visitor 連進頁面的第一步就會被導去登入，原始描述的「放寬」根本無法只靠調整條件達成，必須換一條資料路徑。(b) 公開列表與詳情頁的查詢條件都沒有排除 `suspended` 老師的課程，直接違反本文件第 12/13 節自己承諾的「suspended 老師課程不出現在公開列表」。兩點修正如下：

- 新增 `src/domain/class-session/public-read-service.ts`，內含 `getPublicClassSessionListItems(filters)` 與 `getPublicClassSessionDetail(classSessionId)` 兩個函式，**皆不呼叫 `requireUser()`**，查詢條件一律是 `{ isPublic: true, status: { in: ["open_for_enrollment", "confirmed"] }, teacherProfile: { status: "approved" } }`——`teacherProfile.status: "approved"` 是本輪新增的必要條件（比照既有「suspended 老師不可公開顯示」規則），沒有這個條件會讓已被暫停的老師的舊公開課程繼續留在列表與可報名狀態。Select 只挑選訪客該看到的最小欄位集合（比照既有 Organizer/Teacher facing DTO 的窄選欄位慣例，不得用整包序列化的寫法），不揭露 `organizerProfileId`／`organizationId`／`demandRequestId` 這些內部關聯 id（即使值是 `null`，也不該讓型別結構暗示內部設計給未登入訪客）。
- `/classes`（新增 `src/app/classes/page.tsx`；上一版草稿誤寫成 `src/app/app/classes/page.tsx`，已修正——Builder 開始前仍需先確認實際 route group 結構）：Server Component，呼叫 `getPublicClassSessionListItems()`，依風格（`serviceType`）／教學形式／星期幾（若有 `recurringClassSeriesId` 則從 series 取 `dayOfWeek`，否則從 `startAt` 推算）篩選；視覺沿用 Gate G6 = A 的現有樣式慣例，資訊架構參考本對話先前驗證過的老師目錄卡片排版。
- `/classes/[classSessionId]`（既有頁面）：修改為依登入狀態分支，而不是單純放寬既有函式——
  1. 先嘗試 `requireUser()`，若成功，呼叫既有 `getClassSessionForMember()`（該函式與其消費頁面仍需套用第 2 節列出的 `organization` null-safety 修正，因為登入會員一樣可能點進一堂老師自建、`organization` 為 `null` 的課程），顯示 `ownEnrollment` 狀態、報名表單等既有內容。**Codex round 2 提出「已登入者仍可查看/報名 `isPublic=false` 或 suspended 老師的課程」——這裡拆成兩點分別回應，不是一次性接受或拒絕**：
     - **`isPublic=false` 的課程仍可被已登入會員查看**：這是**既有、本計畫之前就存在的行為**（`getClassSessionForMember()` 從來沒有檢查過 `isPublic` 或「這位會員是否真的被邀請」，只檢查 session status），本質是「share link」模式——任何 Organizer 媒合課程today 也一樣可以被知道連結的任何登入會員看到/報名，不是本計畫新引入的漏洞。把這個既有設計改掉是一個獨立、影響既有分享連結模式的產品決策，不在本計畫範圍內處理，也不應該在這裡順手改掉。
     - **suspended 老師的課程仍可被已登入會員「新報名」，這才是本計畫必須解決的部分**：這不是查看權限問題，是**報名**（寫入）該不該被允許的問題。修正位置不是 `getClassSessionForMember()` 的查詢條件（那會連帶破壞「suspension 不回溯影響既有 ClassSession 的既有查看權限」這條已經確認過的 V1 決策，見 [`state-machines.md`](docs/domain/state-machines.md) 的 `teacher-profile-suspension` 落地說明：「暫停不連帶處理既有的 `DemandResponse`／`ClassSession`」），而是**報名建立本身**：`createEnrollmentForUser`（[`create-enrollment-core.ts`](src/domain/enrollment/__internal__/create-enrollment-core.ts)）新增一步，鎖 `ClassSession` 後多讀 `teacherProfile.status`，非 `approved` 時回傳新錯誤碼 `teacher_not_approved`，阻擋任何來源（公開或已登入直連）的**新**報名——已經存在的報名（不論何時建立）不受影響，只擋新的。這條檢查與 `isPublic`／來源完全無關，統一套用在唯一的報名建立入口，不需要在 Visitor／Member 兩條路徑分別重複判斷。
  2. 若未登入，改呼叫新的 `getPublicClassSessionDetail()`；若回傳 `null`（不符合公開條件，包含 `isPublic=false`／狀態不符／老師已被暫停），一律 `notFound()`，不揭露存在性差異（比照既有 `draft` class session 的既有慣例）。頁面對 Visitor 顯示課程詳情與一個「登入後報名」的連結（帶 callback 導回本頁），不渲染報名表單本身，因為報名動作最終仍會在 `createOwnEnrollment` 這一層要求登入（Visitor "Cannot enroll without required identity flow"，`permissions.md` 既有規則不變，這裡是提早在 UI 層给出明確引導，不是改變底層權限）。

## 10. Proposed File Boundary

Expected allowlist（Builder 開始時需先重新 audit 現況檔案內容與行號；本計畫所有行號皆為撰寫當下的快照，非保證）：

- `prisma/schema.prisma`（含 `NotificationType` 新增 `enrollment_pending_review`）、`prisma/migrations/<timestamp>_teacher_initiated_open_classes/`（新）
- `src/domain/class-session/conflict-check.ts`（新，含第 6 節的 `TeacherProfile` 鎖）
- `src/domain/class-session/public-read-service.ts`（新，第 9 節的 visitor-safe 查詢）
- `src/domain/class-session/__internal__/create-teacher-class-session-core.ts`（新）
- `src/domain/class-session/__internal__/generate-recurring-occurrences-core.ts`（新）
- `src/domain/class-session/__internal__/cancel-class-session-core-for-teacher.ts`（新，第 7 節修正）
- `src/domain/class-session/__internal__/complete-class-session-core-for-teacher.ts`（新，第 7 節修正）
- `src/domain/class-session/__internal__/create-class-session-core.ts`：**僅限**插入第 6 節的 conflict-check 呼叫（含 `TeacherProfile` 鎖，鎖定順序見第 6 節），不得更動既有函式簽章、既有成功路徑邏輯或既有錯誤碼列舉之外的行為。
- `src/domain/class-session/__internal__/cancel-class-session-core.ts`：**僅限兩處**修改——(1) 連帶取消 `Enrollment` 的 SQL 條件從 `status = 'confirmed'` 改為 `status IN ('confirmed','pending')`（第 8 節修正 4）；(2) post-commit 通知解析的 `organizerProfile.findUnique` 改為條件式查詢，避免 `resolvedOrganizerProfileId` 為 `null` 時拋出例外（第 7 節 Codex round 2 修正）。不得更動其他任何邏輯或既有 `organizerProfileId: string | null` 的擁有權設計。
- `src/domain/class-session/service.ts`：新增第 7 節列出的老師版對外函式；既有 Organizer 函式維持不變。
- `src/domain/class-session/read-service.ts`：`TeacherFacingClassSession` 型別擴充 `origin`／`recurringClassSeriesId`／`requiresApproval`／`enrollments[].status`（第 8 節 Codex round 2 修正，讓老師端看得到 `pending` 報名）；`demandRequest` 欄位型別改為可 null，且 select 條件需能正確回傳 null（Prisma 對 optional relation 的既有行為，不需要特殊處理，只需更新型別標註）；`enrollments` 子查詢的 `where` 由 `{ status: "confirmed" }` 放寬為 `{ status: { in: ["confirmed", "pending"] } } }`。
- `src/domain/class-session/admin-service.ts`：`AdminClassSessionSummary`（`organizerDisplayName`／`organizationName`）與 `AdminClassSessionDetail`（`demandRequest`／`organizerProfile`／`organization`）三個型別與其 select/mapping 邏輯，全部改為可 null 並提供中性 fallback 顯示值（例如「（老師自建課程）」），這是**編譯期**必須修正的項目，見第 2 節說明。
- `src/domain/enrollment/read-service.ts`：`getClassSessionForMember()` 的 `MemberFacingClassSession.organization` 型別改為可 null；**不**新增 `isPublic`／`teacherProfile.status` 過濾條件（第 9 節已說明理由：會破壞既有 share-link 查看模式與既有 suspension 不回溯決策）。
- `src/domain/enrollment/__internal__/create-enrollment-core.ts`：第 8 節描述的容量計算條件、`status` 指派邏輯、依 `status` 分流通知類型調整，**加上第 9 節新增的 `teacherProfile.status === 'approved'` 資格檢查與 `teacher_not_approved` 錯誤碼**，不得更動鎖定/交易結構或既有錯誤碼。
- `src/domain/enrollment/__internal__/cancel-enrollment-for-admin-core.ts`：where 條件的 `status` 由 `"confirmed"` 放寬為 `{ in: ["confirmed", "pending"] }`（第 8 節修正 3）。
- `src/domain/enrollment/service.ts`：`cancelOwnEnrollment()` 的 `status` 條件同上放寬（修正 2）；新增 `confirmPendingEnrollmentForTeacher`／`declinePendingEnrollmentForTeacher`（含 `startAt` 時間邊界）。
- `src/domain/notification/copy.ts`：`COPY_TABLE` 新增 `enrollment_pending_review` 文案。
- `src/app/admin/classes/[classSessionId]/page.tsx`（null-guard 修正：`demandRequest`／`organizerProfile`／`organization` 三者）
- `src/app/admin/classes/page.tsx`（Builder audit 是否同樣直接渲染 `organizerDisplayName`／`organizationName` 而未處理 null，若是則同步修正）
- `src/app/organizer/classes/[classSessionId]/page.tsx`（`demandRequest` null-guard 修正）
- `src/app/teacher/classes/page.tsx`（`demandRequest` null-guard 修正 + `pending` 報名確認/拒絕操作（第 8 節 Codex round 2 修正）+ 來源/系列資訊顯示 + 建課入口連結）
- `src/app/teacher/classes/new/page.tsx` / `actions.ts`（新，單堂與常規/固定期建課表單）
- `src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx` / `actions.ts`（新，管理單一系列）
- `src/app/classes/page.tsx`（新，公開列表；確切路徑需 Builder audit 現有 route group 結構後確認）
- `src/app/classes/[classSessionId]/page.tsx`（既有頁面：`organization` null-guard 修正 + 登入狀態分支邏輯，見第 9 節；`ownEnrollment` 三態顯示修正，見第 8 節）
- `src/app/member/enrollments/page.tsx`（**已驗證、非待查項**：[第 93 行](src/app/member/enrollments/page.tsx) 的取消表單顯示條件由 `enrollment.status === "confirmed"` 放寬為 `=== "confirmed" || === "pending"`，見第 8 節 Codex round 2 修正；既有的 `enrollmentStatusLabels` 已含 `pending` 標籤，不需要新增）
- `tests/smoke/teacher-initiated-open-classes.spec.ts`（新）
- `docs/domain/data-model.md`、`docs/domain/state-machines.md`、`docs/domain/permissions.md`、`docs/domain/permissions-matrix.md`、`docs/product/route-map.md`、`docs/product/current-functional-architecture.md`

Forbidden without new approval：`src/domain/demand-request/**`、`src/domain/demand-response/**`（整個 Organizer 媒合流程的狀態機與服務層完全不動）、Auth/session/permission helper、`src/domain/enrollment/**` 中付款相關欄位（屬 `2026-08-03-lightweight-payment-v0-plan.md` 範圍）、任何 Google Calendar 或第三方日曆 API 依賴、`package.json` 新增依賴（除非 Builder audit 後發現日期運算確實需要新函式庫，需先回報）。

## 11. Incremental Build Plan

### Slice A — Schema、null-safety 修復、衝突檢查、單堂老師建課

1. Migration：`ClassSession` 三欄位改 nullable，新增 `origin`／`recurringClassSeriesId`／`requiresApproval`；新增 `ClassSessionOrigin` enum；`NotificationType` 新增 `enrollment_pending_review`；新增空的 `RecurringClassSeries` model（先建表，Slice B 才實際使用）。
2. 修正 `class-session/read-service.ts`（`demandRequest`）、`class-session/admin-service.ts`（`demandRequest`／`organizerProfile`／`organization`）、`enrollment/read-service.ts`（`organization`）的型別，以及對應消費頁面（`admin/classes/page.tsx`、`admin/classes/[id]/page.tsx`、`organizer/classes/[id]/page.tsx`、`teacher/classes/page.tsx`、`classes/[id]/page.tsx`）的 null-guard（見第 2/10 節完整清單）。
3. 實作 `conflict-check.ts`（含 `TeacherProfile` `FOR UPDATE` 鎖，見第 6 節），插入既有 Organizer 建課核心（鎖 `TeacherProfile` 在鎖 `DemandRequest` 之後）。
4. 實作 `create-teacher-class-session-core.ts` 與 `createOwnClassSessionForTeacher`，含資格檢查（`approved` 老師）、conflict-check（一律先鎖 `TeacherProfile`）、`/teacher/classes/new` 單堂建課表單。
5. 實作 `cancel-class-session-core-for-teacher.ts`／`complete-class-session-core-for-teacher.ts` 與對應 service 函式。

Acceptance：既有 Organizer 建課/取消/完成/報名全套既有 smoke test 全數通過（證明 nullable 化與 null-guard 修復沒有破壞既有行為）；`tsc --noEmit` 通過（含 admin-service.ts 的型別修正）；老師可建立單堂公開或私人課程並自行取消/標記完成；老師被排重複時段時，無論是 Organizer 媒合或老師自建，都會被 conflict-check 擋下並收到明確錯誤；兩個併發建課請求對同一位老師的重疊時段只有一個成功（見第 12 節併發測試）。

### Slice B — 常規/固定期課程

1. `RecurringClassSeries` 建立表單（`/teacher/classes/new` 擴充為單堂/常規/固定期三選項）與 `generate-recurring-occurrences-core.ts`。
2. `generateMoreOccurrencesForTeacher`、`cancelRecurringClassSeriesForTeacher`。
3. 系列管理頁 `/teacher/classes/series/[id]`：列出已生成場次、生成更多、整系列取消。

Acceptance：常規課程生成的每一場都是獨立 `ClassSession`，取消其中一場不影響其餘場次；生成範圍受 Gate G4 限制，需要老師手動觸發才能延伸；生成過程中若某場次撞到既有排程，該場跳過且明確列出，不讓整批失敗。

### Slice C — 報名審核機制

1. `create-enrollment-core.ts` 依 Gate G2/G3 調整（容量計算含 `pending`，依 `requiresApproval` 決定初始狀態與通知類型：`pending` 發 `enrollment_pending_review`、`confirmed` 維持既有 `enrollment_confirmed`），並加入 `teacherProfile.status === 'approved'` 資格檢查（`teacher_not_approved` 錯誤碼，見第 9 節）。
2. `confirmPendingEnrollmentForTeacher`／`declinePendingEnrollmentForTeacher`（含 `startAt` 時間邊界）；`class-session/read-service.ts` 的 `listOwnClassSessionsForTeacher()` 放寬 enrollments 查詢涵蓋 `pending` 並帶出 `status`；老師端 UI（roster 上對 `pending` 報名顯示確認/拒絕按鈕，這是老師端第一次真正看得到 `pending` 報名）；confirm 成功後發送 `enrollment_confirmed`，decline 成功後發送既有 `enrollment_cancelled`。
3. 放寬 `cancelOwnEnrollment()`（`enrollment/service.ts`）與 `cancelEnrollmentForAdminCore()` 的 `status` 條件為 `{ in: ["confirmed", "pending"] }`；放寬 `cancel-class-session-core.ts`（既有 organizer/admin 版）與新增的 teacher 版連帶取消 SQL 同步涵蓋 `pending`；`cancel-class-session-core.ts` 同步修正 post-commit 通知解析對 `resolvedOrganizerProfileId` 為 `null` 時的條件式查詢（第 7 節 Codex round 2 修正）。
4. 修正 `classes/[classSessionId]/page.tsx` 的 `ownEnrollment` 顯示為三態（`confirmed`／`pending`／`cancelled`）；`member/enrollments/page.tsx` 第 93 行的取消表單顯示條件放寬為涵蓋 `pending`（已驗證存在，非待查項）。
5. `notification/copy.ts` 補上 `enrollment_pending_review` 文案。
6. `complete-class-session-core-for-teacher.ts` 複製既有 `completeOwnClassSession` 的完整 post-commit 通知邏輯（`class_session_completed` 通知所有 `confirmed` 會員），不只複製 `updateMany`（第 7 節 Codex round 2 修正）。

Acceptance：`requiresApproval = false` 的課程行為與現況完全一致（回歸測試）；`requiresApproval = true` 的課程，新報名落在 `pending`、佔用名額、收到「審核中」通知而非「已確認」；老師端 roster 能看到並操作 `pending` 報名；老師確認/拒絕受時間邊界限制；會員與 Admin 皆可取消 `pending` 報名；課程被取消時 `pending` 報名一併轉為 `cancelled`，且 Admin 取消老師自建課程時通知不會因 `organizerProfileId` 為 `null` 而整批遺失；`suspended` 老師的課程無法被新報名（不論來源）；老師自建課程完成後，`confirmed` 會員收到跟 Organizer 媒合課程完成時一致的通知；併發測試：兩位學生同時報名最後一個名額的 `requiresApproval` 課程，只有一人成功進入 `pending`，另一人收到滿額錯誤。

### Slice D — 公開瀏覽

1. 實作 `public-read-service.ts`（`getPublicClassSessionListItems`／`getPublicClassSessionDetail`，查詢條件含 `teacherProfile.status = "approved"`，見第 9 節）。
2. `/classes` 公開列表 + 篩選器，呼叫 `getPublicClassSessionListItems()`。
3. 修改 `/classes/[classSessionId]` 為登入狀態分支：已登入沿用既有 `getClassSessionForMember()`（已在 Slice A 修過 `organization` null-safety）；未登入改用 `getPublicClassSessionDetail()`，不渲染報名表單，改顯示登入導引。
4. 未登入使用者點擊「登入後報名」導向登入並帶回原頁面。

Acceptance：Visitor 看得到 `isPublic=true`、狀態符合、且授課老師 `approved` 的課程詳情，看不到任何非公開欄位；未登入不能報名；不符合公開條件（含老師已被 suspend）的課程對 Visitor 一律回傳 not-found，不揭露存在性（比照既有 `draft` class session 的既有慣例）；已登入會員的既有報名體驗（含 `ownEnrollment` 三態顯示）不受影響。

### Slice E — 老師統一列表與文件

1. `/teacher/classes` 顯示來源徽章（團主媒合／自己開課／常規課程系列名稱）。
2. 更新第 2 節列出的所有 domain 文件，反映新資料模型、狀態機與權限矩陣異動。

### Slice F — Verification

```text
npx tsc --noEmit
npm run lint
npm run build
npx playwright test tests/smoke/teacher-initiated-open-classes.spec.ts
npm run test:smoke
```

人工驗證：老師建立單堂／常規／固定期課程各一次並實際生成場次；老師與團主分別建立會互相衝突的時段，確認雙向都會被擋；一位學生報名 `requiresApproval` 課程，老師確認後學生看到狀態變化；Visitor 身分（未登入）瀏覽 `/classes` 並點擊報名，確認導向登入流程；手機版 360/390 寬度排版檢查。

## 12. Test Matrix

- Nullable 化後，既有 Organizer 建課全流程（媒合 → 建課 → 開放報名 → 取消／完成）行為零變化。
- `demandRequest`／`organizerProfile`／`organization` 為 `null` 的 `ClassSession`（老師自建）在老師/Admin/Organizer/Member 相關頁面渲染不拋錯、`tsc --noEmit` 通過，且對應區塊顯示中性 fallback 文案（Builder 決定文案但不得留空白區塊造成排版跳動）。
- **Conflict-check 併發正確性**（Codex round 1 新增）：兩個併發請求（老師自建 vs 老師自建、或老師自建 vs Organizer 媒合）對同一位老師建立時間重疊的課程，只有一個成功、另一個收到 `teacher_schedule_conflict`，資料庫最終只有一筆對應 `ClassSession`——比照 `create-enrollment-core.ts` 既有併發測試手法，用 hook 強制其中一個 transaction 在鎖定後暫停，確保測出真正的鎖等待而非僥倖不撞車。
- Conflict-check（非併發情境）：老師已有一堂 Organizer 媒合課程時，自建重疊時段課程被擋；反之，老師已有自建課程時，Organizer 嘗試媒合出重疊時段課程也被擋；不重疊的時段兩者皆可成功。
- 常規課程生成：`dayOfWeek` 對應計算的每個日期皆正確落在該星期幾；單場取消不影響其他已生成場次的 `status`；`cancelRecurringClassSeriesForTeacher` 只影響未開始且未取消的場次。
- Enrollment：`requiresApproval=false` 的課程與現況行為逐項比對零差異（回歸）；`requiresApproval=true` 的課程，`pending` 計入容量，`confirmPendingEnrollmentForTeacher`／`declinePendingEnrollmentForTeacher` 皆為 own-scoped 原子轉換且受 `startAt` 時間邊界限制，跨老師操作被拒。
- **Pending 生命週期**（Codex round 1 新增）：建立 `pending` 報名時發送 `enrollment_pending_review`（不是 `enrollment_confirmed`）；老師 confirm 後才發送 `enrollment_confirmed`；老師 decline 後發送既有 `enrollment_cancelled`。會員可自助取消自己的 `pending` 報名；Admin 可取消任何人的 `pending` 報名。課程被取消時，該課程底下所有 `pending` 報名一併轉為 `cancelled`（含 teacher 版與既有 organizer/admin 版取消核心）。`/classes/[classSessionId]` 對 `pending` 顯示「審核中」，不是「已取消」。
- 公開列表：非 `isPublic`、狀態不符、或**授課老師非 `approved`（含 `suspended`）**的課程都不出現在 `/classes`，**未登入 Visitor** 也不能透過直接輸入 URL 存取 `/classes/[id]` 取得任何欄位（`getPublicClassSessionDetail()` 回傳 `null`）。**已登入會員**持有既有分享連結時，仍可依既有 share-link 模式查看 `isPublic=false` 的課程詳情（第 9 節已定案的既有行為，不受本計畫改變）——這條測試**不要求**已登入情境下的查看也被擋下，只要求 suspended 老師的課程對已登入會員**不可再被新報名**（見下方 Suspended 老師測試項），查看權限與 `isPublic` 無關。
- 已登入 Member（不論是否有 `TeacherProfile`/`OrganizerProfile`）可以直接在 `/classes` 報名老師自建課程，不需要建立 `OrganizerProfile`；未登入 Visitor 可以看到 `/classes/[id]` 詳情但點擊報名會被導向登入。
- Suspended 老師：不可建立新的老師自建課程，既有課程不出現在 `/classes` 公開列表與公開詳情頁（這條規則由 `public-read-service.ts` 的查詢條件保證，不是頁面層級的事後過濾）；**不可被新報名**（`teacher_not_approved`），不論報名者是透過公開瀏覽還是已登入直連既有連結——但**既有**（暫停前建立）的報名與 `getClassSessionForMember()` 的查看權限不受影響，這是延續既有「暫停不回溯」決策，不是本計畫引入的例外。
- **Admin 取消老師自建課程**（Codex round 2 新增）：Admin 透過既有 `cancelClassSessionForAdmin` 取消一堂 `organizerProfileId = null` 的老師自建課程時，取消成功且老師與所有受影響會員都收到 `class_session_cancelled` 通知（驗證 `organizerProfile.findUnique` 的條件式查詢確實避免了 null id 例外，而不是被 try/catch 悄悄吞掉）。
- **老師端 pending 報名可見性**（Codex round 2 新增）：`requiresApproval=true` 課程收到的 `pending` 報名，會出現在老師的 `/teacher/classes` roster 上並可操作確認/拒絕；`confirmed` 報名的既有顯示不受影響。
- **老師自建課程完成通知一致性**（Codex round 2 新增）：老師自建課程標記完成後，所有 `confirmed` 會員收到 `class_session_completed` 通知（含評價邀請），行為與 Organizer 媒合課程完成時一致。

## 13. Security, Privacy, and Brand Review

- 本計畫直接 touch `docs/domain/permissions.md` 列出的兩項 Security Review Required 事項：`enrollment capacity`（第 8 節的計算條件變更）、`teacher approval`（新增的老師自建課程資格檢查必須與既有 demand-response 資格檢查同等嚴格，suspended 老師無法繞過）。這兩項在 Slice C 完成後必須明確過一輪 security review，不能只靠 smoke test 綠燈判斷完成。
- 公開頁面（`/classes`、`/classes/[id]`）的 select 必須是白名單欄位，不得意外序列化 `organizationId`、`organizerProfileId`（即使值是 null 也不該作為型別線索暗示內部結構給未登入訪客）、或任何內部 admin 相關欄位。
- 老師自建課程開放給不特定陌生人報名，屬性上比團主媒合（參與者通常已被團主篩過）風險更高——文案與版面需比照 `docs/harness/brand-review-checklist.md`：不做價目表/比價式排版（呼應 founder-intent.md「不把老師商品化」），優先呈現老師專業與課程內容，非單純列表比價。
- `RecurringClassSeries` 與老師自建 `ClassSession` 皆掛在 `teacherProfileId` 下，own-scope 檢查必須跟既有 Organizer 版本一樣嚴格（`updateMany` 帶 `teacherProfileId` 篩選，不先讀後寫）。

## 14. Rollout, Rollback, and Stop Conditions

Rollout：Slice A 完成且既有全套 smoke test 綠燈後才能繼續 Slice B/C；Slice D（公開瀏覽）建議在 Slice A–C 都穩定後才上線，避免陌生人報名功能與尚不穩定的常規課程/審核機制同時暴露風險。

Rollback：schema 變更是 additive + nullable 化，理論上可回退程式碼但保留欄位；若需要真正回滾 nullable 化本身（例如發現既有資料已經有大量 null 值造成回退困難），需另案評估，不在本計畫的 rollback 範圍內假設可逆。

Stop and request direction if：

- Audit 發現既有 Organizer 建課流程之外，還有其他未被本計畫列出的程式碼路徑也依賴 `ClassSession.demandRequestId`／`organizerProfileId`／`organizationId` 必填的假設——需先完整列出，不能邊做邊補。
- `admin-service.ts` 現有的 Admin 取消/完成 class session 邏輯，若審計後發現隱含依賴 Organizer 專屬欄位（而非單純以 `classSessionId` 操作），需要額外的 Admin 版老師自建課程處理邏輯，超出本計畫預估範圍，需回報重新評估。
- 產品主人在完成本計畫前決定要優先做 Google 日曆同步或完整金流——停工，改走對應的獨立規劃，不要讓三個大型變更同時進行中。
- 常規課程的「固定期課程」實際需求（例如老師想要的日期組合不是單純每週固定星期）比預期更複雜（例如兩週一次、跳過假日），需要重新設計 `RecurringClassSeries` 的欄位，而不是硬塞進現有的 `dayOfWeek` 欄位。

## 15. Definition of Done

- Gate G1–G7 已由產品主人確認（G5/G6/G7 若採用本文件建議預設，仍需明確記錄核准，不能視為預設生效）。
- Schema migration、conflict-check、老師建課/取消/完成服務、常規課程生成、報名審核機制、公開瀏覽頁面皆完成，且既有 Organizer 媒合全流程 smoke test 維持全綠。
- 三個既有 null-guard 破壞點已修復並有對應測試覆蓋。
- Security review 完成，聚焦 `enrollment capacity` 與 `teacher approval` 兩項。
- 所有新文案通過 `voice-and-tone.md`／`brand-rules.md` 檢查，不做比價式排版。
- TypeScript、ESLint、build、完整 smoke test 全部通過。
- `docs/domain/data-model.md`、`state-machines.md`、`permissions.md`、`permissions-matrix.md`、`docs/product/route-map.md`、`docs/product/current-functional-architecture.md` 皆更新反映實際落地範圍。
- 無不相關檔案變更、無 DemandRequest/DemandResponse 狀態機改動、未 commit/push/deploy。

## 16. Human Decision Record — 2026-08-07

產品主人已核准第 4 節全部七個 Gate 的建議預設，Builder 可依下表施工；此核准不等同於 commit/push/deploy 授權。

| Gate | 核准選項 | 施工邊界 |
|---|---|---|
| G1 常規課程資料模型 | A：預先生成多筆獨立 `ClassSession` row | `RecurringClassSeries` 只是生成用的範本，不承載動態展開邏輯；既有 Enrollment/取消/完成/公開列表邏輯不需要理解「範本」概念 |
| G2 報名是否需老師審核 | B：老師可在建課時選擇「需要我確認才算報名成功」 | 重用既有保留的 `pending` enum 值；預設仍是秒確認，審核是老師的可選設定，不強制 |
| G3 `pending` 是否佔用名額 | A：佔用 | 容量計算納入 `pending`；之後若要做逾時自動釋放屬另案 |
| G4 常規課程生成範圍 | A：老師手動選擇生成場次數，之後手動「生成更多」 | 不引入 queue/cron；不做自動無上限延伸 |
| G5 雙重預約衝突嚴重程度 | A：硬擋 | 衝突一律回傳明確錯誤，不提供「警告但allow」路徑 |
| G6 `/classes` 視覺樣式 | A：沿用現有預設樣式 | 不等待、不綁定 `2026-08-02-brand-visual-design-system-plan.md` 的核准進度；視覺對齊留待該計畫核准後另案套用 |
| G7 舊 Organizer 建課路徑是否一併補衝突檢查 | A：一起補 | `conflict-check.ts` 由 Organizer 與 Teacher 兩條建課路徑共用，修正既有系統原本就存在的漏洞 |

**Next allowed action：** 可進入本計畫的 Slice A（schema、null-safety 修復、衝突檢查、單堂老師建課）；G1–G4 已確認，Slice B（常規課程）與 Slice C（審核機制）亦可依上表建議預設施工。**Commit / push / deploy：**未核准。

<!-- codex-peer-reviewed: 2026-08-06T12:51:59Z rounds=5 verdict=approved -->
