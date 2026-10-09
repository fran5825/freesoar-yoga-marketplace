# Lightweight Payment v0 (Direct-to-Teacher Bank Transfer) — Draft Implementation Plan

> Status: DRAFT — 待 Codex peer review 與產品主人多項決策；未授權 Builder 施工。
> 判定（2026-10-09）：**未做。** `prisma/schema.prisma` 沒有任何付款欄位，程式裡也沒有 `markEnrollmentPaid` 之類的函式。
> Date: 2026-08-03

## 0. 2026-10-10 修訂（產品主人於 `/grill-with-docs` 決定，優先於下方 P4–P6 的原文）

來源：[teacher-showcase-photos 票券總覽](teacher-showcase-photos/ticket-breakdown.md) 票 01。本修訂只覆蓋下列條款，其餘維持原文。尚未授權施工；動 schema、權限與 `Enrollment` 建立流程仍需逐票 Human Gate。

| 條款 | 原文 | 修訂 |
|---|---|---|
| P5 價格來源 | 取自 `DemandResponse.proposedPrice` | 老師開課沒有需求，改為 `ClassSession` 新增可為空的文字欄位 `priceNote`（例如「單堂 600 元」）。團主媒合的課程沿用 `DemandResponse.proposedPrice`；兩者都沒有時顯示「請與老師確認實際金額」。仍不新增金額型別 |
| 繳費規則（新增） | 沒有 | `TeacherProfile` 新增可為空的自由文字 `paymentRulesText`（繳費期限、取消與退費、請假規則）。**報名前**就顯示在課程頁，有填才顯示；編輯框提供可點選插入的範例句。繳費期限只是文字提醒，不自動取消報名（沿用本計畫「不做逾期自動取消」）。收款帳號 `paymentAccountInfo` 維持 P4：報名後才顯示快照 |
| 規則快照（新增） | 沒有 | 與帳號一樣，報名當下把 `paymentRulesText` 複製成 `Enrollment.paymentRulesSnapshot`，學員之後在「我的報名」看到的是當時版本，老師事後修改不回溯 |
| 老師聯絡方式（新增） | 老師資料沒有聯絡方式 | `TeacherProfile` 新增可為空的自由文字 `contactInfo`（Line ID、IG 或電話）。**不出現在公開頁或公開老師頁**，只在學員成功報名後，與收款帳號一起顯示（同樣在報名當下快照為 `Enrollment.contactInfoSnapshot`）。有填才顯示 |
| P6 學員自報 | 刻意不做「後五碼／備註」表單 | **改為做**：已報名的學員可在「我的報名」填一個選填的文字欄位 `Enrollment.transferNote`（轉帳後五碼或備註，上限 100 字，純文字顯示），在 `paymentStatus` 仍為 `unpaid` 時可修改；老師與管理員的名單看得到；老師標記已收款後學員不能再改。仍不新增 `NotificationType`、不寄 email（老師看名單才知道）；團主不顯示此欄位 |
| 其他 | – | 不新增任何狀態機、不改 `EnrollmentStatus`；`transferNote` 不影響報名或付款狀態，僅供老師對帳 |

資料與權限影響：`ClassSession.priceNote`、`TeacherProfile.paymentRulesText`／`contactInfo`、`Enrollment.paymentRulesSnapshot`／`contactInfoSnapshot`／`transferNote`（均可為空，additive migration）。權限：學員只能寫自己報名的 `transferNote`；老師與管理員可讀；團主不可讀。需同步更新 `docs/domain/data-model.md`、`permissions.md`、`permissions-matrix.md`（各自在票 01 內與程式同一變更）。

### 0.1 施工指令覆蓋與必須涵蓋的規則（回應 Codex 審查）

**優先順序**：本節與下方 §4（範圍外）、§5（G3 舊價格來源）、§6（schema）、§7（allowlist）、各 Slice 與 §9 測試矩陣衝突時，一律以本節為準。**票 01 的第一步（規劃）已於 2026-10-10 完成**：本節的決定已逐項併回正文 §1–§13；本節保留作決策紀錄，之後若與正文不一致，以正文為準。正文併入後重新 peer review 通過才可交 Builder；程式施工另須等重新報名長任務（`Enrollment.cancelledBy`）合併進 main（見 §2 最後一點與 G6）。

**價格（`priceNote`）**
- `RecurringClassSeries` 也新增可為空的 `priceNote`，作為系列預設；建立系列與「生成更多」時複製進每一場 `ClassSession.priceNote`；編輯「這場和之後所有場次」時一併更新。單堂課在建課／編輯頁直接填寫。
- 已報名學員看到的金額是報名當下的快照：`Enrollment.priceNoteSnapshot`（報名當下複製自該場 `ClassSession.priceNote`；團主媒合課沿用 `DemandResponse.proposedPrice`）。老師之後改價只影響之後的新報名。

**快照涵蓋所有報名建立路徑**（`paymentAccountInfoSnapshot`、`paymentRulesSnapshot`、`contactInfoSnapshot`、`priceNoteSnapshot`）：
- 單堂：`create-enrollment-core.ts`。
- 整期：`create-series-enrollment-core.ts` 以 `createMany` 建立多筆 `Enrollment`，每筆都要寫入同一份快照。
- 補課與整期併入既有單堂報名：`add-makeup-session-core.ts` 與併入路徑沿用**該整期報名建立當下**的快照，不重新讀老師現在的資料。票 01 規劃步驟要決定快照存放位置（每筆 `Enrollment` 各一份，或存在 `SeriesEnrollment` 由底下報名共用），並對上述每條路徑各寫一個測試。
- §7 allowlist 因此要加入上述三個建立函式與系列／課程編輯相關檔案，不再只限 `create-enrollment-core.ts`。

**欄位權限（欄位級，不是頁面級）**
- `contactInfoSnapshot`、`paymentRulesSnapshot`、`paymentAccountInfoSnapshot`：只有該筆報名的學員、授課老師、管理員可讀；所有 Organizer 的查詢與 DTO 一律不 `select` 這些欄位，並以測試確認團主讀不到。原 P9 的欄位揭露表要加入這些欄位。
- `transferNote`：只有該筆報名學員可寫；老師、管理員可讀；團主不可讀。寫入必須是原子條件更新：`updateMany({ where: { id, userId, status: { in: ["pending", "confirmed"] }, paymentStatus: "unpaid" }, data: { transferNote } })` 並檢查 `count === 1`，取消的報名、已收款或已退款的報名不可寫；`count === 0` 回「付款狀態已更新，無法再修改」。驗證：去頭尾空白、上限 100 字、純文字顯示（不當 HTML 渲染）。
- 測試要涵蓋：學員改別人的報名被拒、團主讀不到三類快照與 `transferNote`、老師標記已收款與學員修改同時發生時不得覆寫、取消的報名不能寫、系列改價不影響既有報名的快照。

## 1. Outcome

在不引入任何金流商（信用卡／LINE Pay／ATM 虛擬帳號／超商代碼）、不讓 Free Soar 飛索代收代付金錢的前提下，為現有 `Enrollment` 報名流程加上一組最小可用的「付款狀態追蹤」機制，讓 3–4 位試營運老師與其學生可以：

1. 學生**報名前**就在課程頁看到價格與老師的繳費規則；**報名成功後**，在站內看到「請轉帳給授課老師」的資訊（老師自填的收款帳戶、聯絡方式、繳費規則與價格的報名當下快照），完全不經手 Free Soar 帳戶。轉帳後學員可自行填寫選填的「轉帳後五碼或備註」，讓老師對帳。
2. 授課老師（或 Admin 支援）在站內把該筆報名手動標記為「已收款」或「已退款」，作為雙方與平台的對帳依據。
3. 組織方（Organizer）可以唯讀查看自己媒合出來的班級中，哪些學生已付款，但不經手金錢也不能修改付款狀態。

本 slice 是純粹的「狀態記錄」層，不做金流串接、不做金額型別、不做通知、不做逾期自動取消。它是為了驗證「媒合＋報名」商業模式是否可行，付款方式本身刻意留在最輕量的手動轉帳，之後有真實使用資料再決定要不要走 [`2026-08-01-transactional-email-plan.md`](2026-08-01-transactional-email-plan.md) 之後的完整金流／自動分潤路線。

## 2. Authority and Repo Reality

- `docs/scope/v1-scope.md`、`docs/scope/non-goals.md`、`docs/adr/0002-marketplace-v1-scope.md` 皆明確把「完整金流／退款自動化」列為 V1 範圍外；`docs/product/PRD.md` 僅把 `PaymentIntent` 列為保留名詞，沒有實際設計。本計畫不牴觸這些文件——它新增的是比 V1 scope 討論範圍更小的「手動記帳」層，而非把付款自動化。
- 目前 `prisma/schema.prisma` 完全沒有 `Order`／`Payment`／`Transaction` model，也沒有任何真正的金額型別；價格只存在 `DemandResponse.proposedPrice`（自由文字，@[schema.prisma:195](prisma/schema.prisma:195)）與 `TeacherProfile.priceRange`（自由文字，@[schema.prisma:74](prisma/schema.prisma:74)）。本計畫延續「價格是文字」的現況，不新增金額/幣別型別。2026-10-10 修訂：老師開課沒有需求，價格改放 `ClassSession.priceNote` 與 `RecurringClassSeries.priceNote`（第 0 節）。
- `Enrollment` model（[schema.prisma:239](prisma/schema.prisma:239)）目前建立時直接寫入 `status: "confirmed"`（見 `src/domain/enrollment/__internal__/create-enrollment-core.ts:143`），不經過 `pending` 狀態；`EnrollmentStatus` enum 被容量檢查、通知觸發、取消流程等多處依賴。本計畫**不修改 `EnrollmentStatus` 狀態機**，付款狀態必須是獨立欄位，避免任何既有邏輯（容量釋放、取消、審核可評論資格）意外被付款狀態影響。
- 沒有任何地方定義「班級收款帳戶」；`TeacherProfile` 沒有收款帳戶、繳費規則或聯絡方式欄位，`ClassSession` 與 `RecurringClassSeries` 沒有價格欄位。報名建立路徑共有三個程式入口、四種情境：單堂 `create-enrollment-core.ts`；整期 `create-series-enrollment-core.ts`（`createMany` 建立新的整期報名，並以 `updateMany` 把既有單堂報名併入）；補課 `src/domain/class-session/__internal__/add-makeup-session-core.ts`（為整期學員 `createMany`）。
- `package.json` 沒有任何金流／付款 SDK；不需要，也不在本 slice 安裝任何。
- Notification 系統（`src/domain/notification/*`）目前的 `NotificationType` 是 exhaustive 列舉，[transactional-email-plan.md](2026-08-01-transactional-email-plan.md) 的 `email-policy.ts` 對每個 type 都要求逐一核准角色。本 slice **不新增 `NotificationType`**，避免同時觸碰兩個 plan 的 exhaustive contract。
- 品牌與文案依據：[`docs/context/brand-rules.md`](../../context/brand-rules.md)（「不能感覺像冷冰冰的交易平台」「避免純折扣市集語氣」）與 [`docs/context/voice-and-tone.md`](../../context/voice-and-tone.md)（溫和但清楚、建立信任、避免緊迫推銷語言）。付款是使用者對平台信任感最敏感的環節之一，本 slice 的所有新文案必須遵守這兩份文件，不能用「立即付款」「逾期取消」這類緊迫語氣。
- 視覺樣式：[`2026-08-02-brand-visual-design-system-plan.md`](2026-08-02-brand-visual-design-system-plan.md) 的品牌色票/字體仍是待產品主人核准的草案，尚未落地。本 slice 的新 UI 一律沿用現有頁面既有的元件與樣式慣例（不引入新色票、不預先假設該計畫的 token），待品牌系統核准後再一併套用。
- 工作樹常有其他 session 的未提交修改。Builder 只能處理本計畫 allowlist，不能清理、覆寫或提交其他變更。
- **與重新報名長任務的相依**（`docs/specs/enrollment-re-enrollment-spec.md`、ADR 0006）：它新增 `Enrollment.cancelledBy` 並改動同一批報名檔案（`create-enrollment-core.ts` 等）與 roster 查詢。本計畫的程式施工必須等它合併進 main 後再開工，開工時重新 audit 現況行號與函式。重新報名會讓 `cancelled` 的報名回到有效狀態：付款欄位不隨取消清除，重新報名的付款處理（預設規則，2026-10-10 由 Codex 審查補上，產品主人可改）：
  - `paymentStatus = unpaid` 或 `paid`：**保留** `paymentStatus`、付款稽核欄位與既有快照（`paid` 代表錢仍在老師手上，不因學員取消而清除；不重新抓取老師現在的資料）。
  - `paymentStatus = refunded`：款項已退回，重新報名視為新的一筆交易，因為狀態機只允許 `unpaid → paid → refunded`，必須重設：`paymentStatus` 回到 `unpaid`，清除 `paymentConfirmed*`、`paymentRefunded*`、`paymentNote`、`paymentRefundReason`、`transferNote`，並**重新抓取**四個快照（老師的帳號、規則、聯絡方式與該場價格）。**對帳歷史不會因此消失**：每一次付款狀態變更（標記已收款、標記已退款、重新報名重設）都在同一個交易內，在只新增不修改的 `EnrollmentPaymentEvent` 表新增一筆事件（見 §6），重設只清除 `Enrollment` 上「目前這一輪」的欄位，且**清除前先把前一輪的四個快照、`transferNote`、付款狀態與稽核欄位完整寫入該事件的 `previousRound`**，事後仍可查出當時學員看到的帳號、規則、聯絡方式、價格與填寫的備註（符合 P4 的稽核目標）。ADR 0006 只決定不保留取消與重報歷史，沒有決定刪除付款紀錄，所以付款歷史獨立保存。`refunded → unpaid` 只允許由「重新報名／取消請假恢復」的內部流程觸發，不提供老師或 Admin 的手動入口。
  - 取消請假後恢復（整期內單場）比照同一規則。
  實作與測試要明寫此行為，並涵蓋交叉流程：自己取消 → 老師標記已退款 → 學員重新報名 → 老師可再次標記已收款。

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
- **學生**：唯讀查看自己報名的付款狀態與老師收款資訊，可以填寫自己報名的選填備註 `transferNote`（見 P6），但**不能自行把付款狀態改成已付款**。

### P4 — 老師收款帳戶是老師自填的一段文字，在報名當下快照，且只在報名後才揭露

`TeacherProfile` 新增 `paymentAccountInfo`（可為空的自由文字，例如「銀行代碼/帳號/戶名」），比照現有 [`teacher-profile-edit-plan.md`](2026-07-30-teacher-profile-edit-plan.md) 的欄位編輯模式讓老師自行填寫。這個欄位**不出現在公開的老師列表/老師詳情頁**，只在學生成功報名之後、在「我的報名」相關頁面顯示——避免帳戶資訊被公開頁面爬取或暴露給未報名的訪客。若老師尚未填寫，畫面顯示「請直接與老師確認付款方式」，不阻擋報名流程。

**學生看到的帳戶資訊必須是報名當下的快照，不是即時讀取 `TeacherProfile.paymentAccountInfo`。** 因為該欄位老師隨時可能修改（更換銀行帳戶、清空重填），若學生端直接讀 live 值，會出現「已報名但還沒付款的學生，看到的帳戶跟他當初被告知的不一樣」的風險，且系統事後無法稽核「當時到底顯示了什麼帳戶給這個學生」。因此 `Enrollment` 建立當下，把當時的 `TeacherProfile.paymentAccountInfo` 複製一份存成 `paymentAccountInfoSnapshot`；學生端一律顯示這個快照欄位，不讀 live 值。老師之後修改收款帳戶，只影響「之後才建立」的新報名，不回溯改變已存在報名的快照——老師如需通知舊學生帳戶已變更，屬於本 slice 範圍外的人工溝通。

**繳費規則與聯絡方式比照辦理（2026-10-10）**：`TeacherProfile` 另新增可為空的自由文字 `paymentRulesText`（繳費期限、取消與退費、請假規則；編輯框提供可點選插入的範例句）與 `contactInfo`（Line ID、IG 或電話）。`paymentRulesText` 在**報名前**就顯示於課程頁（有填才顯示，不是敏感資料）；`contactInfo` 與 `paymentAccountInfo` 一樣只在報名後顯示，不進任何公開頁、公開老師頁或公開 API。三者在報名建立當下各複製一份快照（`paymentRulesSnapshot`、`contactInfoSnapshot`、`paymentAccountInfoSnapshot`）。繳費期限只是文字提醒，系統不自動取消報名、不自動釋放名額。

### P5 — 價格沿用自由文字，放在課程與系列上；報名當下快照

2026-10-10 修訂（取代原本取自 `DemandResponse.proposedPrice` 的做法，因為老師開課沒有需求）：

- `ClassSession` 與 `RecurringClassSeries` 各新增可為空的自由文字 `priceNote`（例如「單堂 600 元」「整期 2400 元，單堂 300 元」）。系列的 `priceNote` 是預設值：建立系列與「生成更多」時複製進每一場；編輯「這場和之後所有場次」時一併更新；單堂課在建課／編輯頁直接填寫。團主媒合的課程（`organizer_matched`、`organizer_direct`）若 `ClassSession.priceNote` 為空，沿用來源 `DemandResponse.proposedPrice`。
- 兩者都沒有時顯示「請與老師確認實際金額」，不阻擋報名、不猜測數字。
- 學員看到的金額是**報名當下的快照** `Enrollment.priceNoteSnapshot`（單堂與持續開課取該場 `priceNote`；期班 `kind = term` 取系列 `priceNote`），老師之後改價只影響之後的新報名。
- 本 slice 仍不新增 `amount`/`currency`、不做金額加總、不做多學生不同金額分帳；若需要精確稽核，是需產品主人另行核准的獨立決策（見第 12 節）。

### P6 — 學員可填轉帳後五碼；仍不做自報已付款與通知串接

2026-10-10 修訂（取代原本「不做學生自報」）：已報名的學員可在「我的報名」填一個選填的純文字欄位 `Enrollment.transferNote`（轉帳後五碼或備註，去頭尾空白、上限 100 字）。規則：

- 只有該筆報名的學員本人可寫；老師與 Admin 可讀；Organizer 不可讀，也不出現在任何公開頁。
- 寫入必須是原子條件更新：`updateMany({ where: { id, userId, status: { in: ["pending", "confirmed"] }, paymentStatus: "unpaid" }, data: { transferNote } })`，檢查 `count === 1`；取消的報名、已收款或已退款的報名不可寫；`count === 0` 時回「付款狀態已更新，無法再修改」。
- 填寫 `transferNote` 不改變 `paymentStatus` 或 `EnrollmentStatus`，只供老師對帳。畫面一律以純文字顯示，不當 HTML 渲染。
- 仍不新增任何 `NotificationType` 或站內／email 通知：老師看名單才知道學員填了備註。付款狀態變更只反映在既有頁面的即時查詢結果上，要看最新狀態就重新整理頁面。

### P7 — 退款只記錄狀態，不執行金流動作

「標記已退款」只是把 `paymentStatus` 從 `paid` 改成 `refunded`，附一段可選的文字原因（`paymentRefundReason`）與稽核欄位（`paymentRefundedAt`/`paymentRefundedByUserId`）。實際把錢轉回學生帳戶的動作，是老師自己在銀行 App 完成，不由系統觸發、不驗證、不追蹤金流商回條。

### P9 — 已收款後被取消的報名，教師端仍要看得到、改得動

現況（2026-10-10 核對）老師端 roster 的查詢定義在 `src/domain/class-session/__internal__/class-session-detail-core-for-teacher.ts` 的 `teacherFacingClassSessionSelect`（`listOwnClassSessionsForTeacher()` 與老師單堂詳情共用），`enrollments` 子查詢是 `where: { status: { in: ["confirmed", "pending"] } }`（含待審，讓老師能審核報名）；型別在 `src/domain/class-session/read-service.ts`。若學生已付款、報名後才被取消（既有取消流程會把 `Enrollment.status` 改成 `cancelled`，不會刪除該筆紀錄），這筆紀錄會直接從老師的 roster 查詢結果消失——老師既看不到「這位學生已經付款但課程/報名被取消了」，也無法呼叫 `markEnrollmentRefundedForTeacher` 完成退款標記，讓「已付款、應退款」的紀錄永遠卡在系統看不到的地方。

修正：`teacherFacingClassSessionSelect` 的 enrollments 子查詢 where 條件改為 `{ OR: [{ status: { in: ["confirmed", "pending"] } }, { paymentStatus: { not: "unpaid" } }] }`——**保留現有 confirmed 與 pending（待審）的行為**，另外加上「不論 `EnrollmentStatus` 為何，只要 `paymentStatus` 不是 `unpaid`（代表 `paid` 或 `refunded`）就要出現」。`TeacherFacingClassSession.enrollments[]` 型別需擴充帶出 `status`（比照 Admin roster 既有「需要看到是否已被取消」的理由，見 [`admin-service.ts:66-68`](../../../src/domain/class-session/admin-service.ts:66)）與付款相關欄位，UI 才能正確顯示「報名：已取消／付款：已收款（待退款）」這種組合狀態。

測試矩陣須加入回歸：未付款的 `pending` 報名仍出現在老師名單且可審核。

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

- Prisma schema：新增 `EnrollmentPaymentStatus`、`PaymentActorRole` enum；`Enrollment` 新增 `paymentStatus`（預設 `unpaid`）、四個快照欄位 `paymentAccountInfoSnapshot`、`paymentRulesSnapshot`、`contactInfoSnapshot`、`priceNoteSnapshot`（報名建立當下複製，見 P4、P5）、學員備註 `transferNote`（P6）、`paymentNote`（老師/Admin 標記時可選填的內部備註，例如「已收到，備註王小明」）、`paymentConfirmedAt`、`paymentConfirmedByUserId`、`paymentConfirmedByRole`、`paymentRefundedAt`、`paymentRefundedByUserId`、`paymentRefundedByRole`、`paymentRefundReason`；`TeacherProfile` 新增 `paymentAccountInfo`、`paymentRulesText`、`contactInfo`；`ClassSession` 與 `RecurringClassSeries` 新增 `priceNote`。對應 migration（皆 additive、可為空）。
- `src/domain/teacher-profile/service.ts` 的既有 `updateOwnTeacherProfile()` 擴充可寫入 `paymentAccountInfo`、`paymentRulesText`、`contactInfo`；老師資料編輯頁（`src/app/teacher/profile/info/`）表單加三個欄位，`paymentRulesText` 附可點選插入的範例句。
- 老師建課、編輯課程與建立／編輯系列的表單加 `priceNote`；系列的 `priceNote` 依 P5 複製或更新到各場；公開課程頁、系列頁、期班頁在報名前顯示價格（`priceNote`）與老師的繳費規則（`paymentRulesText`），有填才顯示。
- 報名建立的各條路徑（單堂、整期新建、整期併入既有單堂、補課）在建立當下寫入四個快照；整期併入保留原快照，補課沿用該整期既有快照（見 §6）。
- 學員「我的報名」新增 `transferNote` 填寫（P6）；老師與 Admin 名單顯示。
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
- 學員自行把付款狀態改成「已付款」（`transferNote` 只是備註，不改狀態）。
- 逾期未付款自動取消報名、容量自動釋放（若要做，需另案並確認會不會與既有 `EnrollmentStatus` 取消流程衝突）。
- 退款金流動作本身（系統不觸發、不驗證實際轉帳）。
- 品牌視覺重新設計（沿用現有元件樣式，見 P8）。
- Auth、角色模型、`EnrollmentStatus`/`ClassSessionStatus` 狀態機變更。

## 5. Product Owner Decision Gates

| Gate | Recommended default | Blocking point |
|---|---|---|
| G1 誰能標記已收款/已退款 | 授課老師（自己班級）＋ Admin（override）；組織方唯讀 | Builder 開始前需產品主人確認，尤其確認組織方不需要修改權 |
| G2 付款帳戶揭露時機 | 只在學生成功報名之後顯示，不出現在公開老師頁面 | 影響 [public-trust-pages-plan.md](2026-08-01-public-trust-pages-plan.md) 的公開頁面是否要排除此欄位；需交叉確認不會意外洩漏 |
| G3 價格來源 | **已決定（2026-10-10）**：`ClassSession.priceNote`／`RecurringClassSeries.priceNote` 文字，媒合課程缺值時沿用 `DemandResponse.proposedPrice`，兩者皆無則提示「請與老師確認」 | – |
| G6 與重新報名長任務的先後 | 程式施工等重新報名（`Enrollment.cancelledBy`）合併進 main 後再開工 | 避免同時改 `Enrollment` 與報名建立檔案造成衝突；開工前重新 audit |
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
  paymentRulesSnapshot       String?
  contactInfoSnapshot        String?
  priceNoteSnapshot          String?
  transferNote               String?
  paymentEvents              EnrollmentPaymentEvent[]

  @@index([paymentStatus])
}

// 只新增、不修改、不刪除的付款事件紀錄；`Enrollment` 上的付款欄位只代表「目前這一輪」。
enum EnrollmentPaymentEventType {
  marked_paid
  marked_refunded
  reset_on_re_enrollment
}

model EnrollmentPaymentEvent {
  id           String                     @id @default(cuid())
  enrollmentId String
  type         EnrollmentPaymentEventType
  actorUserId  String? // reset_on_re_enrollment 為學員本人；其他為標記者
  actorRole    PaymentActorRole? // 學員重新報名時為空
  note         String? // 已收款備註或退款原因（沿用 `paymentNote`／`paymentRefundReason` 的內容）
  // reset_on_re_enrollment 專用：重設前「前一輪」的完整內容（四個快照、transferNote、paymentStatus、paymentConfirmed*／paymentRefunded* 欄位），純 JSON 快照，不可修改
  previousRound Json?
  createdAt    DateTime                   @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@index([enrollmentId, createdAt])
}

model TeacherProfile {
  // ...existing fields unchanged...
  paymentAccountInfo String?
  paymentRulesText   String?
  contactInfo        String?
}

model ClassSession {
  // ...existing fields unchanged...
  priceNote String?
}

model RecurringClassSeries {
  // ...existing fields unchanged...
  priceNote String?
}
```

`paymentConfirmedByUserId`/`paymentRefundedByUserId` 存 `User.id`（不建立正式 relation，比照現有 `Notification`/`Review` 對 actor 的處理慣例，Builder audit 後確認是否需要外鍵）。狀態轉換只允許 `unpaid → paid → refunded`；不允許 `unpaid → refunded` 或任何跳躍，違反時回傳既有慣例的 domain error（比照現有 `__internal__` core 函式的 error 慣例，不新增例外的 error 型別系統）。所有轉換必須以原子 compare-and-set 實作（見 P2 最後一段），不得先讀後寫。

`paymentAccountInfoSnapshot` 在 `Enrollment` 建立當下、於既有建立交易內，從當時的 `TeacherProfile.paymentAccountInfo` 複製寫入（P4）；之後老師修改 `paymentAccountInfo` 不回溯更新已存在的快照。

**四個快照（`paymentAccountInfoSnapshot`、`paymentRulesSnapshot`、`contactInfoSnapshot`、`priceNoteSnapshot`）在每條報名建立路徑都要寫入**，快照存放位置定案為「每筆 `Enrollment` 各一份」（不另放 `SeriesEnrollment`）：
- 單堂：`create-enrollment-core.ts` 在既有建立交易內讀取老師資料與該場價格寫入。
- 整期新建：`create-series-enrollment-core.ts` 的 `createMany` 每一筆都寫入同一份快照（價格取系列 `priceNote`）。
- 整期併入既有單堂：同檔 `updateMany` 只是把原有單堂報名掛到整期，**保留該報名原本的快照**，不覆寫。
- 補課：`add-makeup-session-core.ts` 的 `createMany` 沿用該整期報名**建立當下的快照**，來源固定為：同一 `seriesEnrollmentId` 底下 `seriesEnrollmentSource = term_created` 的報名列中，依 `createdAt`、`id` 升冪的第一筆；若沒有 `term_created` 的列（整期建立時所有場次都已有單堂報名被併入），改取同一整期報名底下 `createdAt`、`id` 升冪最早的一列。不重新讀老師現在的資料；找不到任何列時快照留空並顯示「請與老師確認」。因為併入的單堂保留較早的快照，同一期內可能出現不同版本，這是刻意的（每筆報名顯示它自己報名當下的資訊）。
- 重新報名（`cancelled` 回到有效，見 §2）：`unpaid`／`paid` 保留既有快照與付款欄位；`refunded` 依 §2 重設為 `unpaid`、清除「目前這一輪」的付款欄位與 `transferNote`、重抓四個快照，並新增一筆 `reset_on_re_enrollment` 事件。

`EnrollmentPaymentEvent` 的讀取權限：老師（自己班級）與 Admin 可讀；學員、Organizer 與所有公開頁不讀。標記已收款、標記已退款與重設都在同一個 `$transaction` 內「條件更新 `Enrollment` 並 `count === 1` 才新增事件」，更新失敗不留事件。

## 7. Proposed File Boundary

Expected allowlist（Builder 需先重新 audit 現況檔案內容與行號）：

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_lightweight_payment_v0/`（新）
- `src/domain/teacher-profile/service.ts`
- `src/app/teacher/profile/page.tsx` / `actions.ts`
- `src/domain/enrollment/payment-service.ts`（新）
- `src/domain/enrollment/__internal__/`（若 payment-service 需要共用 core 邏輯，Builder audit 後決定是否新增 core 檔，比照既有 `__internal__` 慣例）
- `src/domain/enrollment/__internal__/create-enrollment-core.ts`、`create-series-enrollment-core.ts`、`src/domain/class-session/__internal__/add-makeup-session-core.ts`：**僅限**在既有建立交易內寫入四個快照欄位（P4、P5、§6）與下一點列出的重新報名分支付款處理，不得更動容量檢查、`EnrollmentStatus` 指派或既有 signature/回傳值。
- `src/domain/class-session/` 與系列相關 service（Builder 先 audit 現況位置）中建立、編輯課程與系列的 service 與輸入驗證：加入 `priceNote` 的寫入與系列到各場的複製。
- 老師建課／編輯／系列表單（`src/app/teacher/classes/new/`、`src/app/teacher/classes/[classSessionId]/edit/`、`src/app/teacher/classes/series/`）、老師資料編輯頁（`src/app/teacher/profile/info/`）。
- 公開課程頁、系列頁、期班頁（`src/app/classes/[classSessionId]/`、`src/app/classes/series/[recurringClassSeriesId]/`、`src/app/classes/terms/[recurringClassSeriesId]/`）及其 read service：報名前顯示 `priceNote` 與 `paymentRulesText`；`paymentAccountInfo`、`contactInfo` 不得被這些查詢選出。
- `src/domain/enrollment/service.ts`（或新檔）：學員寫入 `transferNote` 的函式（P6）。
- 重新報名相關（重新報名長任務合併後的現況檔案，開工時重新 audit）：`create-enrollment-core.ts` 的重新報名分支、`src/domain/enrollment/__internal__/restore-leave-core.ts`（取消請假恢復）：**僅限**依 §2 的付款處理規則（保留或重設付款欄位、重抓快照、新增 `reset_on_re_enrollment` 事件），不得更動容量、名額占用或 `cancelledBy` 規則。
- `src/domain/class-session/__internal__/class-session-detail-core-for-teacher.ts`：`teacherFacingClassSessionSelect` 的 enrollments where 條件與 select 擴充（P9、付款與 `transferNote` 欄位）；`src/domain/class-session/read-service.ts`：對應的回傳型別擴充，不得更動函式簽章或既有欄位。
- `src/domain/class-session/admin-service.ts`：Admin roster 的 select 與型別加入付款欄位與 `transferNote`。
- 文件（與程式同一變更更新）：`docs/domain/data-model.md`、`docs/domain/permissions.md`、`docs/domain/permissions-matrix.md`、`docs/product/current-functional-architecture.md`。
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
2. 各條報名建立路徑寫入快照（§6），不動既有容量與狀態邏輯；新增 `ClassSession`／`RecurringClassSeries.priceNote` 欄位與系列複製規則（P5）；新增學員 `transferNote` 的 service（P6，原子條件更新）；`payment-service.ts` 的標記與重新報名重設都在同一交易內寫入 `EnrollmentPaymentEvent`；重新報名分支與取消請假恢復依 §2 處理付款欄位。
3. 實作 `src/domain/enrollment/payment-service.ts` 四個函式（P3），一律用原子 compare-and-set 實作狀態轉換（P2 最後一段），含擁有權驗證（老師只能動自己班級）。
4. 單元/整合測試：非擁有者老師呼叫被拒、Admin 可跨班級操作、非法狀態轉換被拒、成功轉換寫入正確 timestamp/actor、**兩個併發呼叫對同一筆 enrollment 做互斥合法轉換時，只有一個成功、另一個收到明確的「狀態已變更」錯誤，且最終欄位值來自成功的那一次而非被覆寫**。

Acceptance：不改動任何 `EnrollmentStatus` 既有行為；既有 enrollment 相關 smoke test 全部維持通過；新建立的 `Enrollment.paymentAccountInfoSnapshot` 與建立當下的 `TeacherProfile.paymentAccountInfo` 一致。

### Slice B — Teacher self-service fields and pre-enrollment display

1. `updateOwnTeacherProfile()` 擴充 `paymentAccountInfo`、`paymentRulesText`、`contactInfo`。
2. 老師資料編輯頁加三個欄位，含空值/清空的處理與範例句；建課、編輯與系列表單加 `priceNote`。
3. 公開課程頁、系列頁、期班頁在報名前顯示價格與繳費規則（有填才顯示）。

Acceptance：`paymentAccountInfo`、`contactInfo` 不出現在任何現有公開頁面，`paymentRulesText` 只出現在課程相關頁面（依 G2，Builder 需搜尋所有讀取 `TeacherProfile` 公開欄位的地方，確認未被意外序列化進公開 API/頁面）。

### Slice C — Teacher/Admin roster payment UI

1. 依 G5 結果，確認或新增老師端可看到自己班級 roster 的頁面；依 P9 擴充 `listOwnClassSessionsForTeacher()` 的 enrollments where 條件與回傳型別，讓已取消但 `paymentStatus !== "unpaid"` 的報名仍會出現。
2. Roster 每列加報名狀態與付款狀態兩個獨立徽章（見 P2）、標記已收款/已退款按鈕（二次確認），呼叫 Slice A 的 service；已取消的報名只顯示付款狀態與退款按鈕（若適用），不得顯示任何暗示可以「重新確認報名」的操作。
3. Admin 端比照擴充，唯一差異是可跨老師操作；Admin roster 既有查詢已涵蓋所有 `EnrollmentStatus`（[`admin-service.ts:119`](../../../src/domain/class-session/admin-service.ts:119)），只需加上付款欄位的 select 與徽章/按鈕。

Acceptance：老師看不到、也無法操作非自己班級的報名；Admin 可以；操作後頁面立即反映最新狀態；已付款後被取消的報名仍出現在老師與 Admin 的 roster 上，且雙方都能將其標記為已退款。

### Slice D — Organizer read-only + student-facing payment info

1. 依 P9 修正後的 `listConfirmedEnrollmentsForClassSession()`（已更名，見第 7 節），Organizer 班級詳情頁加報名狀態＋付款狀態兩個唯讀徽章，不含任何操作按鈕/表單；已取消但曾付款/已退款的報名同樣要顯示，讓組織方能看到完整的對帳結果。
2. 學生端「我的報名」頁面，**任一筆自己的報名，只要 `status === "confirmed"` 或 `paymentStatus !== "unpaid"`**，都要顯示「付款方式」區塊：老師收款帳戶快照 `paymentAccountInfoSnapshot`、聯絡方式快照 `contactInfoSnapshot`、繳費規則快照 `paymentRulesSnapshot`（缺值時各自 fallback）、價格快照 `priceNoteSnapshot`（P5）、`transferNote` 填寫欄（P6，僅 `unpaid` 且未取消時可編輯）、目前付款狀態徽章與報名狀態徽章；已退款的報名要清楚顯示「已退款」而不是消失或看起來像未處理。

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
- 各條建立路徑（單堂、整期新建、整期併入、補課）都寫入四個快照：併入保留原快照、補課沿用整期既有快照；老師之後改帳號、規則、聯絡方式或價格，已存在報名的顯示不變。
- 系列 `priceNote` 複製到生成與追加的場次；系列改價只影響之後的新報名。
- 報名前（含訪客）的課程、系列、期班頁看得到價格與繳費規則，看不到 `paymentAccountInfo`、`contactInfo`、任何快照。
- `transferNote`：學員改別人的報名被拒、取消／已收款／已退款的報名不可寫、超過 100 字被拒、老師標記已收款與學員修改同時發生時不得覆寫（原子條件更新）、團主與公開頁讀不到、以純文字顯示（含 `<script>` 字串不被當 HTML）。
- 團主的所有查詢與 DTO 不選取 `paymentRulesSnapshot`、`contactInfoSnapshot`、`paymentAccountInfoSnapshot`、`transferNote`。
- 重新報名：`unpaid`／`paid` 保留付款狀態與快照；`refunded` 重設為 `unpaid`、清除付款稽核與 `transferNote`、重抓四個快照；交叉流程「自己取消 → 老師標記已退款 → 重新報名 → 老師可再次標記已收款」；取消請假後恢復比照。
- 付款事件：標記已收款、已退款、重新報名重設各寫一筆事件，更新未成功（`count === 0`）時不留事件；重設後 `Enrollment` 的目前欄位清空，但 `reset_on_re_enrollment` 事件的 `previousRound` 含前一輪完整快照與 `transferNote`，老師與 Admin 查得到；學員與 Organizer 讀不到事件。
- 老師名單的回歸：未付款的 `pending` 報名仍出現且可審核；已付款後取消的報名仍出現。
- 補課快照來源：`term_created` 列最早一筆；情境「先報單堂 → 改價或換帳號 → 併入整期 → 追加補課」中，併入的單堂保留舊快照、補課沿用整期建立時的快照。
- 對同一筆 `Enrollment` 併發呼叫合法的狀態轉換（例如老師與 Admin 同時標記已收款），只有一次成功，另一次收到明確錯誤，不發生欄位被靜默覆寫。

## 10. Security, Privacy, and Brand Review

- `paymentAccountInfo`（老師個人設定）與 `paymentAccountInfoSnapshot`（單筆報名快照）都是敏感的個人金融資訊性質欄位，只能 server-side 依 P4 規則揭露給該筆報名的學生本人、該老師本人、Admin；不得出現在任何公開頁面、公開 API response、或搜尋引擎可索引的頁面。
- `contactInfo`／`contactInfoSnapshot` 與 `transferNote` 是個人資料：欄位級權限依 §0.1；`transferNote` 為學員輸入，一律純文字輸出並限制長度，避免注入內容。
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
- 無不相關檔案變更、無 schema 以外的狀態機改動、未 deploy；commit 與 push 依產品主人 2026-10-10 長任務放行（測試通過才 commit，push 前重查）。

<!-- codex-peer-reviewed: 2026-08-03T02:30:09Z rounds=6 verdict=approved -->
<!-- codex-peer-reviewed (2026-10-10 正文併入): 2026-10-09T22:24:24Z rounds=6 verdict=approved -->
