# Lightweight Payment v0 (Direct-to-Teacher Bank Transfer) — Draft Implementation Plan

> Status: DRAFT — 待 Codex peer review 與產品主人多項決策；未授權 Builder 施工。
> Date: 2026-08-03

## 1. Outcome

在不引入任何金流商（信用卡／LINE Pay／ATM 虛擬帳號／超商代碼）、不讓 Free Soar 飛索代收代付金錢的前提下，為現有 `Enrollment` 報名流程加上一組最小可用的「付款狀態追蹤」機制，讓 3–4 位試營運老師與其學生可以：

1. 學生報名成功後，在站內看到「請轉帳給授課老師」的資訊（老師自填的收款帳戶、課程參考價格），完全不經手 Free Soar 帳戶。
2. 授課老師（或 Admin 支援）在站內把該筆報名手動標記為「已收款」或「已退款」，作為雙方與平台的對帳依據。
3. 組織方（Organizer）可以唯讀查看自己媒合出來的班級中，哪些學生已付款，但不經手金錢也不能修改付款狀態。

本 slice 是純粹的「狀態記錄」層，不做金流串接、不做金額型別、不做通知、不做逾期自動取消。它是為了驗證「媒合＋報名」商業模式是否可行，付款方式本身刻意留在最輕量的手動轉帳，之後有真實使用資料再決定要不要走 [`2026-08-01-transactional-email-plan.md`](2026-08-01-transactional-email-plan.md) 之後的完整金流／自動分潤路線。

## 2. Authority and Repo Reality

- `docs/scope/v1-scope.md`、`docs/scope/non-goals.md`、`docs/adr/0002-marketplace-v1-scope.md` 皆明確把「完整金流／退款自動化」列為 V1 範圍外；`docs/product/PRD.md` 僅把 `PaymentIntent` 列為保留名詞，沒有實際設計。本計畫不牴觸這些文件——它新增的是比 V1 scope 討論範圍更小的「手動記帳」層，而非把付款自動化。
- 目前 `prisma/schema.prisma` 完全沒有 `Order`／`Payment`／`Transaction` model，也沒有任何真正的金額型別；價格只存在 `DemandResponse.proposedPrice`（自由文字，@[schema.prisma:195](prisma/schema.prisma:195)）與 `TeacherProfile.priceRange`（自由文字，@[schema.prisma:74](prisma/schema.prisma:74)）。本計畫延續「價格是文字」的現況，不新增金額/幣別型別。
- `Enrollment` model（[schema.prisma:239](prisma/schema.prisma:239)）目前建立時直接寫入 `status: "confirmed"`（見 `src/domain/enrollment/__internal__/create-enrollment-core.ts:143`），不經過 `pending` 狀態；`EnrollmentStatus` enum 被容量檢查、通知觸發、取消流程等多處依賴。本計畫**不修改 `EnrollmentStatus` 狀態機**，付款狀態必須是獨立欄位，避免任何既有邏輯（容量釋放、取消、審核可評論資格）意外被付款狀態影響。
- 沒有任何地方定義「班級收款帳戶」；`TeacherProfile` 沒有收款帳戶欄位。
- `package.json` 沒有任何金流／付款 SDK；不需要，也不在本 slice 安裝任何。
- Notification 系統（`src/domain/notification/*`）目前的 `NotificationType` 是 exhaustive 列舉，[transactional-email-plan.md](2026-08-01-transactional-email-plan.md) 的 `email-policy.ts` 對每個 type 都要求逐一核准角色。本 slice **不新增 `NotificationType`**，避免同時觸碰兩個 plan 的 exhaustive contract。
- 品牌與文案依據：[`docs/context/brand-rules.md`](../../context/brand-rules.md)（「不能感覺像冷冰冰的交易平台」「避免純折扣市集語氣」）與 [`docs/context/voice-and-tone.md`](../../context/voice-and-tone.md)（溫和但清楚、建立信任、避免緊迫推銷語言）。付款是使用者對平台信任感最敏感的環節之一，本 slice 的所有新文案必須遵守這兩份文件，不能用「立即付款」「逾期取消」這類緊迫語氣。
- 視覺樣式：[`2026-08-02-brand-visual-design-system-plan.md`](2026-08-02-brand-visual-design-system-plan.md) 的品牌色票/字體仍是待產品主人核准的草案，尚未落地。本 slice 的新 UI 一律沿用現有頁面既有的元件與樣式慣例（不引入新色票、不預先假設該計畫的 token），待品牌系統核准後再一併套用。
- 工作樹目前有其他未提交修改（`docs/product/route-map.md`、`next.config.ts`、`package.json` 等）。Builder 只能處理本計畫 allowlist，不能清理、覆寫或提交其他變更。

## 3. Architectural Decisions

### P1 — 金錢完全不經過 Free Soar 帳戶

學生直接把錢轉給授課老師本人的帳戶；Free Soar 在這個 slice 不建立、不揭露任何平台帳戶，不代收代付。這個決策已與產品主人確認：試營運老師是志願測試者，錢應該直接、即時到老師手上，且能避免平台提早背負代收代付的合規與資金保管責任。

### P2 — 付款狀態是獨立於 `EnrollmentStatus` 的新欄位

新增 `EnrollmentPaymentStatus`（`unpaid` / `paid` / `refunded`），放在 `Enrollment` 上，預設 `unpaid`。**不變更**現有 `EnrollmentStatus`（`pending`/`confirmed`/`cancelled`/`attended`/`no_show`）的語意或轉換邏輯——報名建立時依然立刻是 `confirmed`（維持現況），付款狀態是平行、獨立的追蹤欄位。

這帶來一個 UX 必須處理的風險：現有介面把 `Enrollment.status === "confirmed"` 顯示為「已確認」，容易讓使用者誤以為報名確認等於付款完成。Builder 必須在所有新增/修改的畫面上，把「報名狀態」與「付款狀態」用清楚分開的標籤呈現（例如「報名：已確認」／「付款：待付款」兩個獨立徽章），不得合併成單一狀態字串。

**狀態轉換必須是原子的 compare-and-set，不得先讀後寫。** `markEnrollmentPaidForTeacher`/`markEnrollmentRefundedForTeacher`/`markEnrollmentPaidForAdmin`/`markEnrollmentRefundedForAdmin` 都必須用「帶舊狀態條件的更新」實作（例如 Prisma `updateMany({ where: { id, paymentStatus: <expected-from-status> }, data: {...} })` 並檢查 `result.count === 1`；或等效的 transaction），不能用「先 `findUnique` 檢查狀態、再另外一次 `update`」的兩步寫法。理由：這組欄位的存在目的是「對帳依據」，如果兩個合法操作者（例如老師與 Admin）在極短時間內幾乎同時操作，先讀後寫會讓其中一次的 `paymentConfirmedByUserId`/時間戳被另一次悄悄覆寫而沒有任何錯誤，稽核紀錄就失去可信度。`count === 0` 時必須回傳「狀態已被其他操作改變，請重新整理」之類的明確 domain error，不能靜默忽略。

### P3 — 誰可以標記付款/退款

- **授課老師**：只能標記自己開設（`classSession.teacherProfileId` 對應自己）班級底下的報名為「已收款」或「已退款」。老師是實際收到錢的人，是最準確的資訊來源。
- **Admin**：可以對任何報名標記已收款/已退款，作為支援/糾紛協調用途，比照既有 `admin-service.ts` 的 override 慣例（例如 [`admin-class-enrollment-management-plan.md`](2026-07-29-admin-class-enrollment-management-plan.md) 的 `cancelEnrollmentForAdmin` 模式）。
- **組織方（Organizer）**：唯讀查看自己媒合出的班級中每筆報名的付款狀態，沒有任何修改權限——組織方在這個金流模型裡不經手錢，不應該有標記權。
- **學生**：唯讀查看自己報名的付款狀態與老師收款資訊，沒有自行回報付款的表單（見 P6，刻意不做，降低本 slice 範圍）。

### P4 — 老師收款帳戶是老師自填的一段文字，在報名當下快照，且只在報名後才揭露

`TeacherProfile` 新增 `paymentAccountInfo`（可為空的自由文字，例如「銀行代碼/帳號/戶名」），比照現有 [`teacher-profile-edit-plan.md`](2026-07-30-teacher-profile-edit-plan.md) 的欄位編輯模式讓老師自行填寫。這個欄位**不出現在公開的老師列表/老師詳情頁**，只在學生成功報名之後、在「我的報名」相關頁面顯示——避免帳戶資訊被公開頁面爬取或暴露給未報名的訪客。若老師尚未填寫，畫面顯示「請直接與老師確認付款方式」，不阻擋報名流程。

**學生看到的帳戶資訊必須是報名當下的快照，不是即時讀取 `TeacherProfile.paymentAccountInfo`。** 因為該欄位老師隨時可能修改（更換銀行帳戶、清空重填），若學生端直接讀 live 值，會出現「已報名但還沒付款的學生，看到的帳戶跟他當初被告知的不一樣」的風險，且系統事後無法稽核「當時到底顯示了什麼帳戶給這個學生」。因此 `Enrollment` 建立當下，把當時的 `TeacherProfile.paymentAccountInfo` 複製一份存成 `paymentAccountInfoSnapshot`；學生端一律顯示這個快照欄位，不讀 live 值。老師之後修改收款帳戶，只影響「之後才建立」的新報名，不回溯改變已存在報名的快照——老師如需通知舊學生帳戶已變更，屬於本 slice 範圍外的人工溝通。

### P5 — 參考金額沿用現有的自由文字價格，不新增金額型別

顯示給學生的「應付金額」直接取自該班級來源 `DemandRequest` 已選定 `DemandResponse.proposedPrice`（自由文字）。若該欄位為空，顯示「請與老師確認實際金額」，不阻擋報名、不猜測數字。本 slice 不新增 `amount`/`currency` 欄位、不做金額加總、不做多學生不同金額的分帳邏輯——如果之後需要精確金額稽核（例如不同學生付不同折扣價），那是一個需要產品主人另外核准的獨立決策（見第 12 節 Stop Conditions）。

### P6 — 不做學生自報付款、不做通知串接

刻意不新增「學生自行回報已轉帳／備註後五碼」的表單，也不新增任何 `NotificationType` 或站內/email 通知。付款狀態變更只反映在既有頁面的即時查詢結果上，老師/學生/組織方要看最新狀態就重新整理頁面。這兩項都是「先做輕量」的直接體現：先驗證「有沒有人用」，通知與雙向表單留到需求明確後再做。

### P7 — 退款只記錄狀態，不執行金流動作

「標記已退款」只是把 `paymentStatus` 從 `paid` 改成 `refunded`，附一段可選的文字原因（`paymentRefundReason`）與稽核欄位（`paymentRefundedAt`/`paymentRefundedByUserId`）。實際把錢轉回學生帳戶的動作，是老師自己在銀行 App 完成，不由系統觸發、不驗證、不追蹤金流商回條。

### P9 — 已收款後被取消的報名，教師端仍要看得到、改得動

現況 `src/domain/class-session/read-service.ts` 的 `listOwnClassSessionsForTeacher()`（老師端班級列表使用的唯一 roster 來源）對 `enrollments` 子查詢寫死 `where: { status: "confirmed" }`（[read-service.ts:149](../../../src/domain/class-session/read-service.ts:149)）。若學生已付款、報名後才被取消（既有取消流程會把 `Enrollment.status` 改成 `cancelled`，不會刪除該筆紀錄），這筆紀錄會直接從老師的 roster 查詢結果消失——老師既看不到「這位學生已經付款但課程/報名被取消了」，也無法呼叫 `markEnrollmentRefundedForTeacher` 完成退款標記，讓「已付款、應退款」的紀錄永遠卡在系統看不到的地方。

修正：`listOwnClassSessionsForTeacher()` 的 enrollments 子查詢 where 條件改為 `{ OR: [{ status: "confirmed" }, { paymentStatus: { not: "unpaid" } }] }`——保留現有「顯示 confirmed 報名」的行為，另外加上「不論 `EnrollmentStatus` 為何，只要 `paymentStatus` 不是 `unpaid`（代表 `paid` 或 `refunded`）就要出現」。`TeacherFacingClassSession.enrollments[]` 型別需擴充帶出 `status`（比照 Admin roster 既有「需要看到是否已被取消」的理由，見 [`admin-service.ts:66-68`](../../../src/domain/class-session/admin-service.ts:66)）與付款相關欄位，UI 才能正確顯示「報名：已取消／付款：已收款（待退款）」這種組合狀態。

Admin 端既有 roster（`getClassSessionDetailForAdmin`）本來就不過濾 `EnrollmentStatus`（見 [`admin-service.ts:119-124`](../../../src/domain/class-session/admin-service.ts:119)），已經涵蓋這個情境，不需修改。

**Codex round 3 修正**：Organizer 與學生本人同樣需要看到「已取消但已付款/已退款」的紀錄，否則兩個真正在乎退款有沒有完成的利害關係人（付錢的學生、媒合出這堂課的組織方）反而在站內看不到結果，與 Outcome／P3 承諾的「Organizer／學生可唯讀查看付款狀態」互相矛盾。修正如下：

- `src/domain/enrollment/read-service.ts` 的 `listConfirmedEnrollmentsForClassSession()`（Organizer 專用）：where 條件比照上面 Teacher 版本，改成 `{ classSessionId, OR: [{ status: "confirmed" }, { paymentStatus: { not: "unpaid" } }] }`，`ClassSessionRosterEntry` 型別擴充帶出 `status` 與付款欄位。已確認這個函式**只被** `src/app/organizer/classes/[classSessionId]/page.tsx` 呼叫（`src/domain/review/read-service.ts` 只在註解裡提到它的命名慣例，並未 import 或呼叫），所以擴大這個函式的回傳範圍不會影響評價功能的既有資格判斷邏輯，是安全的。函式名稱與既有註解的「confirmed-only」語意會被打破，Builder 需同步更新命名（例如 `listRosterEnrollmentsForClassSession`）與相關註解、呼叫端 import，避免後續讀者誤讀。
- 同檔案的 `listOwnEnrollmentsForMember()`（學生「我的報名」專用）本來就沒有依 `status` 過濾（`where: { userId: currentUser.id }`），已經會回傳學生自己所有狀態的報名；只需要在 `OwnEnrollment` 型別的 select 補上付款相關欄位即可，不需要改 where 條件。

**Codex round 4 修正**：上面三個 DTO（Teacher/Admin 的 roster、Organizer 的 roster、學生的 `OwnEnrollment`）都要加「付款相關欄位」，但不是每個欄位都適合對每個角色開放——`paymentNote` 明定是「老師/Admin 標記時的內部備註」，`paymentRefundReason` 也可能包含老師對特定情況的自由文字說明，兩者都不是設計給 Organizer 或學生看的內部/半內部文字。各 DTO 的付款欄位揭露範圍必須精確如下，Builder 不得為了「欄位齊全」而把內部備註一併序列化到唯讀角色的頁面：

| 欄位 | Teacher（自己班級） | Admin（全部） | Organizer（自己媒合的班級，唯讀） | 學生（自己的報名，唯讀） |
|---|---|---|---|---|
| `paymentStatus` | 可見 | 可見 | 可見 | 可見 |
| `paymentAccountInfoSnapshot` | 可見 | 可見 | 不揭露（組織方不經手金錢，不需要看到老師帳戶） | 可見（自己的報名） |
| `paymentConfirmedAt` / `paymentRefundedAt` | 可見 | 可見 | 可見（時間戳本身不含個資/內部評論） | 可見 |
| `paymentConfirmedByUserId` / `paymentRefundedByUserId` | 不對外顯示原始 id，UI 上以「老師標記」/「Admin 標記」文字呈現 | 同左 | 不揭露 | 不揭露 |
| `paymentNote` | 可見（自己寫的備註） | 可見 | **不揭露** | **不揭露** |
| `paymentRefundReason` | 可見 | 可見 | 不揭露 | **可見**（退款理由是對學生本人的必要透明資訊，例如「課程異動」「學生要求」） |

Organizer 與學生的 DTO／查詢的 `select` 必須直接不選取 `paymentNote`（兩者皆然）與 `paymentAccountInfoSnapshot`（僅 Organizer 排除）等欄位，而不是選出來後在畫面上隱藏——避免資料經由 server component props、API response 或除錯輸出間接外洩。

**Codex round 5 修正**：「UI 上以『老師標記』/『Admin 標記』文字呈現」不能事後從 `payment*ByUserId` 推論——`User.isAdmin` 與可選的 `teacherProfile` 允許同一人同時是 Admin 又是某班級的授課老師，若靠「這個 user 是不是這個班級的老師」之類的關聯反推角色，會在「身兼 Admin 的老師，用 Admin 入口操作自己班級」這種情境下判斷錯誤，稽核顯示就不可信。修正：`payment-service.ts` 的四個函式各自都精確知道自己是哪一種入口（`ForTeacher` 或 `ForAdmin`），因此在寫入 `payment*ByUserId` 的同時，直接由呼叫的函式字面寫入一個新增的角色欄位，不做任何事後推論：

```prisma
enum PaymentActorRole {
  teacher
  admin
}
```

`Enrollment` 新增 `paymentConfirmedByRole`／`paymentRefundedByRole`（皆為可選的 `PaymentActorRole?`），分別由 `markEnrollmentPaidForTeacher`/`markEnrollmentPaidForAdmin` 與 `markEnrollmentRefundedForTeacher`/`markEnrollmentRefundedForAdmin` 各自寫死對應的字面值。UI 顯示「老師標記」/「Admin 標記」時一律讀這個角色欄位，不讀取或推論 `payment*ByUserId` 對應的其他身分關聯。這兩個角色欄位比照 `payment*ByUserId` 的揭露規則（Teacher/Admin 可見，Organizer/學生不揭露）。

### P8 — 文案與樣式邊界

所有新文案（老師收款帳戶顯示、參考金額提示、付款狀態徽章文字、標記已收款/已退款的按鈕與確認文案）必須遵守 `voice-and-tone.md`：語氣溫和清楚、避免「立即付款」「逾期作廢」等緊迫用語，也避免任何「折扣」「最低價」語氣。畫面樣式沿用既有頁面元件與既有 Tailwind class 慣例，不引入新色票或字體，等 [`brand-visual-design-system-plan.md`](2026-08-02-brand-visual-design-system-plan.md) 核准後再統一套用。

## 4. Scope

### In scope

- Prisma schema：新增 `EnrollmentPaymentStatus`、`PaymentActorRole` enum；`Enrollment` 新增 `paymentStatus`（預設 `unpaid`）、`paymentAccountInfoSnapshot`（報名建立當下複製自 `TeacherProfile.paymentAccountInfo`，見 P4）、`paymentNote`（老師/Admin 標記時可選填的內部備註，例如「已收到，備註王小明」）、`paymentConfirmedAt`、`paymentConfirmedByUserId`、`paymentConfirmedByRole`、`paymentRefundedAt`、`paymentRefundedByUserId`、`paymentRefundedByRole`、`paymentRefundReason`；`TeacherProfile` 新增 `paymentAccountInfo`。對應 migration。
- `src/domain/teacher-profile/service.ts` 的既有 `updateOwnTeacherProfile()` 擴充可寫入 `paymentAccountInfo`；`src/app/teacher/profile/page.tsx`/`actions.ts` 表單加一個欄位。
- 新檔案 `src/domain/enrollment/payment-service.ts`：
  - `markEnrollmentPaidForTeacher(enrollmentId, note?)` — 驗證呼叫者是該 classSession 的授課老師本人。
  - `markEnrollmentRefundedForTeacher(enrollmentId, reason?)` — 同上，且僅允許從 `paid` 轉為 `refunded`。
  - `markEnrollmentPaidForAdmin(enrollmentId, note?)` / `markEnrollmentRefundedForAdmin(enrollmentId, reason?)` — `requireAdmin()` 把關，比照既有 admin-service 模式。
- 老師端：`src/app/teacher/classes/page.tsx`（或依 Builder audit 結果新增 `[classSessionId]` 詳情頁，若目前老師端沒有可承載 roster 的既有頁面）顯示自己班級的報名名單與付款狀態，並提供標記已收款/已退款按鈕（需二次確認）。
- Admin 端：擴充既有 `src/app/admin/classes/[classSessionId]/page.tsx`/`actions.ts`，在既有 roster 呈現旁加上付款狀態徽章與 Admin 標記按鈕。
- Organizer 端：擴充既有 `src/app/organizer/classes/[classSessionId]/page.tsx`，加上唯讀付款狀態徽章，不加任何操作按鈕。
- 學生端：擴充既有 `src/app/member/enrollments/page.tsx`（或依 Builder audit 結果的報名詳情頁），在任一筆 `status === "confirmed"` 或 `paymentStatus !== "unpaid"` 的報名項目顯示「付款方式」區塊：老師收款帳戶快照 `paymentAccountInfoSnapshot`（不是 live 的 `TeacherProfile.paymentAccountInfo`，見 P4）、參考金額（P5）、付款狀態徽章與報名狀態徽章（見 P9，已取消但曾付款/已退款的報名同樣要顯示）。
- Smoke test 覆蓋權限邊界（老師只能改自己班級、組織方無法修改、非登入者無法存取）與狀態轉換邊界。
- 更新 `docs/product/current-functional-architecture.md` 反映新增的付款狀態追蹤層。

### Explicitly out of scope

- 信用卡、LINE Pay、ATM 虛擬帳號、超商代碼、街口支付、金流商（綠界/藍新等）串接。
- Free Soar 代收代付、平台帳戶、資金保管、分潤/抽成計算與自動撥款。
- `amount`/`currency` 型別、多學生不同金額稽核、發票/電子發票整合。
- 任何 `NotificationType` 新增或 email/站內通知串接（見 P6）。
- 學生自行回報付款的表單/欄位。
- 逾期未付款自動取消報名、容量自動釋放（若要做，需另案並確認會不會與既有 `EnrollmentStatus` 取消流程衝突）。
- 退款金流動作本身（系統不觸發、不驗證實際轉帳）。
- 品牌視覺重新設計（沿用現有元件樣式，見 P8）。
- Auth、角色模型、`EnrollmentStatus`/`ClassSessionStatus` 狀態機變更。

## 5. Product Owner Decision Gates

| Gate | Recommended default | Blocking point |
|---|---|---|
| G1 誰能標記已收款/已退款 | 授課老師（自己班級）＋ Admin（override）；組織方唯讀 | Builder 開始前需產品主人確認，尤其確認組織方不需要修改權 |
| G2 付款帳戶揭露時機 | 只在學生成功報名之後顯示，不出現在公開老師頁面 | 影響 [public-trust-pages-plan.md](2026-08-01-public-trust-pages-plan.md) 的公開頁面是否要排除此欄位；需交叉確認不會意外洩漏 |
| G3 參考金額來源 | 沿用 `DemandResponse.proposedPrice` 文字，缺值時提示「請與老師確認」 | 若產品主人希望改用其他價格來源（例如 `TeacherProfile.priceRange`），需在此確認 |
| G4 文案審核 | 依 `voice-and-tone.md`／`brand-rules.md` 起草，外部 pilot 前需產品主人逐句核稿 | 外部 pilot 開始前必須完成 |
| G5 老師端 roster 頁面是否新增 | 若現況老師端沒有可承載 roster 的頁面，需新增 `[classSessionId]` 詳情頁；否則沿用既有頁面加區塊 | Builder audit 現況後回報，若需要新增頁面需確認資訊揭露範圍是否比照 admin/organizer 現有 detail 頁 |

## 6. Data Model Changes

```prisma
enum EnrollmentPaymentStatus {
  unpaid
  paid
  refunded
}

enum PaymentActorRole {
  teacher
  admin
}

model Enrollment {
  // ...existing fields unchanged...
  paymentStatus              EnrollmentPaymentStatus @default(unpaid)
  paymentAccountInfoSnapshot String?
  paymentNote                String?
  paymentConfirmedAt         DateTime?
  paymentConfirmedByUserId   String?
  paymentConfirmedByRole     PaymentActorRole?
  paymentRefundedAt          DateTime?
  paymentRefundedByUserId    String?
  paymentRefundedByRole      PaymentActorRole?
  paymentRefundReason        String?

  @@index([paymentStatus])
}

model TeacherProfile {
  // ...existing fields unchanged...
  paymentAccountInfo String?
}
```

`paymentConfirmedByUserId`/`paymentRefundedByUserId` 存 `User.id`（不建立正式 relation，比照現有 `Notification`/`Review` 對 actor 的處理慣例，Builder audit 後確認是否需要外鍵）。狀態轉換只允許 `unpaid → paid → refunded`；不允許 `unpaid → refunded` 或任何跳躍，違反時回傳既有慣例的 domain error（比照現有 `__internal__` core 函式的 error 慣例，不新增例外的 error 型別系統）。所有轉換必須以原子 compare-and-set 實作（見 P2 最後一段），不得先讀後寫。

`paymentAccountInfoSnapshot` 在 `Enrollment` 建立當下、於既有建立交易內，從當時的 `TeacherProfile.paymentAccountInfo` 複製寫入（P4）；之後老師修改 `paymentAccountInfo` 不回溯更新已存在的快照。

## 7. Proposed File Boundary

Expected allowlist（Builder 需先重新 audit 現況檔案內容與行號）：

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_lightweight_payment_v0/`（新）
- `src/domain/teacher-profile/service.ts`
- `src/app/teacher/profile/page.tsx` / `actions.ts`
- `src/domain/enrollment/payment-service.ts`（新）
- `src/domain/enrollment/__internal__/`（若 payment-service 需要共用 core 邏輯，Builder audit 後決定是否新增 core 檔，比照既有 `__internal__` 慣例）
- `src/domain/enrollment/__internal__/create-enrollment-core.ts`：**僅限**在既有建立交易內新增一行「讀取該老師 `TeacherProfile.paymentAccountInfo` 並寫入新欄位 `paymentAccountInfoSnapshot`」（P4/P9），不得更動容量檢查、`EnrollmentStatus` 指派或既有 signature/回傳值。
- `src/domain/class-session/read-service.ts`：`listOwnClassSessionsForTeacher()` 的 enrollments where 條件與回傳型別擴充（P9），不得更動函式簽章或既有欄位。
- `src/domain/enrollment/read-service.ts`：`listConfirmedEnrollmentsForClassSession()`（Organizer）where 條件與型別擴充，含函式更名（P9）；`listOwnEnrollmentsForMember()`（學生）的 `OwnEnrollment` select 加付款欄位，where 條件不變。呼叫端（`src/app/organizer/classes/[classSessionId]/page.tsx`）的 import 需同步更新新函式名稱。
- `src/app/teacher/classes/page.tsx`，或新增 `src/app/teacher/classes/[classSessionId]/page.tsx`/`actions.ts`（依 G5 決定）
- `src/app/admin/classes/[classSessionId]/page.tsx` / `actions.ts`
- `src/app/organizer/classes/[classSessionId]/page.tsx`
- `src/app/member/enrollments/page.tsx` / `actions.ts`
- `tests/smoke/lightweight-payment-v0.spec.ts`（新）
- `docs/product/current-functional-architecture.md`

Forbidden without new approval：`src/domain/notification/*`（不新增 NotificationType）、`EnrollmentStatus`/`ClassSessionStatus` 的狀態機邏輯、Auth/session/permission helper、任何金流 SDK 依賴、`package.json` 新增依賴。

## 8. Incremental Build Plan

### Slice A — Schema and domain service

1. 新增 `EnrollmentPaymentStatus`/`PaymentActorRole` enum 與 `Enrollment`/`TeacherProfile` 欄位（含 `paymentAccountInfoSnapshot`、`paymentConfirmedByRole`、`paymentRefundedByRole`），跑 migration。
2. `create-enrollment-core.ts` 加一行快照寫入（P4/P9），不動既有邏輯。
3. 實作 `src/domain/enrollment/payment-service.ts` 四個函式（P3），一律用原子 compare-and-set 實作狀態轉換（P2 最後一段），含擁有權驗證（老師只能動自己班級）。
4. 單元/整合測試：非擁有者老師呼叫被拒、Admin 可跨班級操作、非法狀態轉換被拒、成功轉換寫入正確 timestamp/actor、**兩個併發呼叫對同一筆 enrollment 做互斥合法轉換時，只有一個成功、另一個收到明確的「狀態已變更」錯誤，且最終欄位值來自成功的那一次而非被覆寫**。

Acceptance：不改動任何 `EnrollmentStatus` 既有行為；既有 enrollment 相關 smoke test 全部維持通過；新建立的 `Enrollment.paymentAccountInfoSnapshot` 與建立當下的 `TeacherProfile.paymentAccountInfo` 一致。

### Slice B — Teacher self-service payment account field

1. `updateOwnTeacherProfile()` 擴充 `paymentAccountInfo`。
2. Profile 編輯頁加欄位，含空值/清空的處理。

Acceptance：欄位不出現在任何現有公開頁面（依 G2，Builder 需搜尋所有讀取 `TeacherProfile` 公開欄位的地方，確認未被意外序列化進公開 API/頁面）。

### Slice C — Teacher/Admin roster payment UI

1. 依 G5 結果，確認或新增老師端可看到自己班級 roster 的頁面；依 P9 擴充 `listOwnClassSessionsForTeacher()` 的 enrollments where 條件與回傳型別，讓已取消但 `paymentStatus !== "unpaid"` 的報名仍會出現。
2. Roster 每列加報名狀態與付款狀態兩個獨立徽章（見 P2）、標記已收款/已退款按鈕（二次確認），呼叫 Slice A 的 service；已取消的報名只顯示付款狀態與退款按鈕（若適用），不得顯示任何暗示可以「重新確認報名」的操作。
3. Admin 端比照擴充，唯一差異是可跨老師操作；Admin roster 既有查詢已涵蓋所有 `EnrollmentStatus`（[`admin-service.ts:119`](../../../src/domain/class-session/admin-service.ts:119)），只需加上付款欄位的 select 與徽章/按鈕。

Acceptance：老師看不到、也無法操作非自己班級的報名；Admin 可以；操作後頁面立即反映最新狀態；已付款後被取消的報名仍出現在老師與 Admin 的 roster 上，且雙方都能將其標記為已退款。

### Slice D — Organizer read-only + student-facing payment info

1. 依 P9 修正後的 `listConfirmedEnrollmentsForClassSession()`（已更名，見第 7 節），Organizer 班級詳情頁加報名狀態＋付款狀態兩個唯讀徽章，不含任何操作按鈕/表單；已取消但曾付款/已退款的報名同樣要顯示，讓組織方能看到完整的對帳結果。
2. 學生端「我的報名」頁面，**任一筆自己的報名，只要 `status === "confirmed"` 或 `paymentStatus !== "unpaid"`**，都要顯示「付款方式」區塊：老師收款帳戶快照 `paymentAccountInfoSnapshot`（缺值時的 fallback 文案）、參考金額（P5 邏輯）、目前付款狀態徽章與報名狀態徽章；已退款的報名要清楚顯示「已退款」而不是消失或看起來像未處理。

Acceptance：組織方頁面沒有任何可以改變 `paymentStatus` 的互動元素（含檢查是否存在被停用但仍存在 DOM 的按鈕）；學生看不到其他學生的付款資訊；已取消但有付款歷史的報名，在 Organizer 與學生兩側都看得到最終狀態（`paid` 或 `refunded`），不會因為報名被取消就從畫面上消失。

### Slice E — Verification

Automated：

```text
npx tsc --noEmit
npm run lint
npm run build
npx playwright test tests/smoke/lightweight-payment-v0.spec.ts
npm run test:smoke
```

Manual：以 3 個角色（Teacher/Admin/Organizer）各自登入，走一遍「報名 → 學生看到收款資訊 → 老師標記已收款 → 組織方看到唯讀狀態 → 老師標記已退款」全流程；確認手機版排版正常、文案通過 voice-and-tone 檢查。

### Slice F — Docs

更新 `docs/product/current-functional-architecture.md`，清楚標註「付款狀態為手動記錄，金流不經過平台，未串接任何金流商」，避免之後被誤讀成已有自動化金流。

## 9. Test Matrix

- Payment status 只能 `unpaid → paid → refunded`，任何其他轉換被拒且不改變資料。
- 老師只能操作自己 `classSession.teacherProfileId` 名下的報名；跨老師操作回傳權限錯誤且不改變資料。
- Admin 可跨老師操作。
- Organizer 對付款狀態的請求（若有 API/action 層）一律唯讀，任何嘗試修改的呼叫被拒。
- 學生視角只能看到自己報名的付款資訊，看不到其他學生。
- `TeacherProfile.paymentAccountInfo` 未被任何既有公開頁面/公開查詢意外回傳。
- `paymentAccountInfo`/`proposedPrice` 為空時，UI 顯示合理 fallback，不拋錯、不阻擋報名。
- 標記已收款/已退款會寫入正確的 `*ConfirmedAt`/`*ConfirmedByUserId`/`*ConfirmedByRole`/`*RefundedAt`/`*RefundedByUserId`/`*RefundedByRole`/`paymentRefundReason`；`*ByRole` 一律等於呼叫的是 `ForTeacher` 或 `ForAdmin` 版本，即使操作者同時是該班級老師又是 Admin，也不得依其他關聯反推。
- 既有 enrollment 建立/取消/容量檢查流程行為不變（回歸測試）。
- 學生看到的收款帳戶資訊來自 `paymentAccountInfoSnapshot`；老師在學生報名後修改 `paymentAccountInfo`，既有報名顯示的資訊不變，新報名才會看到新值。
- 已付款（`paid`）的報名被既有取消流程（會員自行取消或 Admin/Organizer 取消）改成 `cancelled` 後，仍出現在老師、Admin 與 Organizer 的 roster，且老師/Admin 可將其標記為 `refunded`；已取消但從未付款（`unpaid`）的報名維持既有行為，不出現在老師/Organizer roster（沿用現況篩選）。
- 學生「我的報名」頁面：已取消但曾經 `paid`/已 `refunded` 的報名仍會顯示付款方式區塊與最終狀態；已取消且從未付款的報名不顯示付款方式區塊。
- Organizer 與學生兩側的 server 回應（含 server component props/序列化輸出）不包含 `paymentNote`；Organizer 側額外不包含 `paymentAccountInfoSnapshot`；兩側皆不包含 `paymentConfirmedByUserId`/`paymentRefundedByUserId` 原始值（P9 欄位揭露表）。
- 學生自己的報名若為 `refunded`，`paymentRefundReason` 對該學生本人可見；Organizer 側不論任何狀態都看不到 `paymentRefundReason`。
- 對同一筆 `Enrollment` 併發呼叫合法的狀態轉換（例如老師與 Admin 同時標記已收款），只有一次成功，另一次收到明確錯誤，不發生欄位被靜默覆寫。

## 10. Security, Privacy, and Brand Review

- `paymentAccountInfo`（老師個人設定）與 `paymentAccountInfoSnapshot`（單筆報名快照）都是敏感的個人金融資訊性質欄位，只能 server-side 依 P4 規則揭露給該筆報名的學生本人、該老師本人、Admin；不得出現在任何公開頁面、公開 API response、或搜尋引擎可索引的頁面。
- 付款狀態變更的 actor（`*ByUserId`）僅供站內稽核顯示必要角色（例如「Admin 標記」而非曝露 Admin 個人資料），不對學生/組織方顯示內部 user id。
- 所有新文案需通過 `voice-and-tone.md`／`brand-rules.md` 檢查：不用「立即付款」「逾期」等緊迫語氣，不用折扣/促銷語氣。
- 本 slice 不引入任何新的第三方請求、不新增外部網路呼叫，因此沒有 timeout/webhook/簽章驗證的攻擊面。
- 需明確在學生看到的頁面加一句中性免責文字，例如「付款由雙方直接完成，飛索目前不經手款項」，讓使用者清楚知道平台的角色邊界（呼應 P1 與先前討論的責任界定需求）。

## 11. Rollout, Rollback, and Observability

Rollout：Preview 先跑完整 Slice A–D 驗證 → 3–4 位試營運老師實際使用一輪 → 依使用回饋決定是否推進到更完整金流（另案規劃）。

Rollback：`paymentStatus` 欄位新增是 additive schema 變更，不影響既有查詢；如需回滾，程式碼可直接回退，資料庫欄位保留不需要 migration rollback。UI 區塊可用 feature 層級的條件渲染快速關閉，不需要移除欄位。

Observability：V1 沒有自動化監控；老師/Admin 若發現付款狀態與實際情況不符，只能透過既有 support/人工方式回報，本 slice 不新增 dashboard 或告警。

## 12. Stop Conditions

Stop and request direction if：

- 需要精確金額稽核（不同學生不同金額、需要加總報表）——這需要新增 `amount`/`currency` 型別的獨立決策，不在本 slice 範圍內硬做。
- 老師端目前完全沒有任何可承載 roster 的頁面基礎（G5 需要從零蓋一整套老師端班級管理），工作量可能超出「輕量」範疇，需回報產品主人重新評估切分。
- Audit 發現 `TeacherProfile` 現有欄位已經在某個公開頁面被整包序列化輸出（例如 `SELECT *` 風格的 server component props），導致新增 `paymentAccountInfo` 有意外外洩風險——需先處理既有序列化方式，不能直接疊加新欄位。
- 產品主人在完成本 slice 前決定要提前導入金流商——立即停工，改走完整金流規劃路線，不要讓兩個模型並存造成資料/狀態混亂。
- 需要通知（email/站內）串接才能達成可用性——需另案評估是否值得先破壞 P6 的範圍邊界。

## 13. Definition of Done

- G1–G5 已由產品主人確認並記錄。
- Schema migration、`payment-service.ts`、老師/Admin/Organizer/學生四種視角的 UI 皆完成且權限邊界通過測試。
- `paymentAccountInfo` 未在任何公開頁面/API 洩漏，經 audit 確認。
- 所有新文案通過 `voice-and-tone.md`／`brand-rules.md` 檢查。
- TypeScript、ESLint、build、smoke test 全部通過。
- `docs/product/current-functional-architecture.md` 準確反映「手動付款記錄、無金流商串接」的現況，避免誤讀。
- 無不相關檔案變更、無 schema 以外的狀態機改動、未 commit/push/deploy。

<!-- codex-peer-reviewed: 2026-08-03T02:30:09Z rounds=6 verdict=approved -->
