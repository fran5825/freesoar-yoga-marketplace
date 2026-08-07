# Data Model

This is the initial marketplace domain model.

## User

Represents all authenticated users.

Suggested fields:

- id
- name
- email
- phone
- isAdmin
- createdAt
- updatedAt

Role model:

- User is the base account.
- All authenticated users have basic Member capabilities.
- Teacher capabilities are enabled by TeacherProfile.
- Organizer capabilities are enabled by OrganizerProfile.
- Admin is a platform management permission, represented by isAdmin or an equivalent admin permission model.
- V1 does not limit one user to only one identity.

## TeacherProfile

Represents a yoga teacher.

Fields:

- id
- userId
- displayName
- bio
- teachingStyle
- experienceYears
- certifications
- specialties
- serviceAreas
- teachingFormats
- priceRange
- profilePhotoUrl
- status
- rejectionReason
- suspensionReason
- createdAt
- updatedAt

Phase 1 schema notes:

- `TeacherProfile` 是 Teacher capability 的基礎資料，不代表老師已可回應需求。
- 能否回應 demand request 仍必須檢查 `status = approved`。
- Prisma schema 允許 draft profile 先保存部分欄位；submit application 時由 server-side validation 要求必要欄位完整。
- `displayName`、`bio`、`teachingStyle`、`experienceYears`、`specialties`、`serviceAreas`、`teachingFormats` 是 submit application 的必要欄位。
- `certifications`、`priceRange`、`profilePhotoUrl` 是 Phase 1 建議欄位，可留空。
- `specialties`、`serviceAreas`、`teachingFormats`、`certifications` 在 schema 中以 string list 表示，讓 Phase 1 不需要額外建立分類表或複雜 taxonomy。
- 老師聯絡電話在 V1 使用 `User.phone`，不在 `TeacherProfile` 重複存放。
- `rejectionReason` 是 nullable 欄位（`String?`），保存 Admin 在 `submitted → rejected` 時填寫、**面向老師的退回說明**。它與內部 `AdminNote` 語意分離：`rejectionReason` 會顯示給該老師，`AdminNote` 不對外。V1 只保存「最新一次」reason，不保留歷史（audit trail 屬 V1 之外）。reason 由 Admin 動作寫入，非 Teacher 可編輯欄位；lifecycle 見 `state-transition-details.md`（`rejected` 期間保留、`rejected → submitted` 與 `approve` 時清空、再次 reject 覆蓋）。
- **`suspensionReason`（`teacher-profile-suspension` 已確認）**：nullable 欄位（`String?`），保存 Admin 在 `approved → suspended` 時填寫、面向老師的暫停說明。獨立於 `rejectionReason`，不共用同一欄位——兩者代表不同原因（退回 vs. 暫停），共用會讓 UI 文案在其中一種情境下失真（比照 `demand-request-cancellation` D9 已經修過的同類教訓：reuse 一個語意不合的既有欄位/狀態，會讓文案講錯話）。lifecycle：`suspended` 期間保留（供老師查看）、`restore`（`suspended → approved`）時清空，不保留歷史。
- **Edit（`teacher-profile-edit` 已確認）**：approved 老師可以在 `/teacher/profile` 編輯 `displayName`／`bio`／`teachingStyle`／`experienceYears`／`specialties`／`serviceAreas`／`teachingFormats`／`certifications`／`priceRange`／`profilePhotoUrl` 這 10 個欄位，`id`／`userId`／`status`／`rejectionReason`／`suspensionReason`／`createdAt`／`updatedAt` 不可由 Teacher 編輯。編輯重用送審時的必填規則（`validateTeacherProfileSubmit`），且額外要求 `experienceYears` 必須是整數並落在 Postgres `Int4` 範圍內（`0`–`2147483647`），避免超出範圍的數字在寫入資料庫時造成未攔截的例外。`suspended` 老師只能唯讀查看，不能編輯。**編輯不觸發重新審核、不改變 `status`、不新增 notification**——即使改的是會影響公開呈現或媒合判斷的欄位（如 `displayName`、`specialties`），這是本輪明確拍板的 V1 決策，不是遺漏；Admin 可在 `/admin/teachers` 的 approved／suspended 卡片上展開「View profile details」查看老師目前完整的欄位內容與最後更新時間，作為事後發現與判斷的既有補救手段。

Status:

- draft
- submitted
- approved
- rejected
- suspended

## OrganizerProfile

Represents a group leader / organizer.

Fields:

- id
- userId
- organizationId
- displayName
- createdAt
- updatedAt

Phase 1 schema notes（`organizer-demand-request-foundation` D1/D2/D3 已確認）：

- 實際 Prisma schema 以 `displayName`（必填）作為 organizer 顯示名稱／聯絡窗口稱謂，**不新增** `title` / `phone` 欄位（reconcile 早期設計稿）。若未來需要聯絡電話，走 `Organization.contactPhone`（見下）或 `User.phone`，不在 `OrganizerProfile` 重複存放。
- `userId` 為 `@unique`：V1 一個 `User` 至多一個 `OrganizerProfile`。
- `organizationId` 為單一 nullable FK：V1 一個 `OrganizerProfile` 至多一個 `Organization`，不支援多對多。
- **Organizer capability bootstrap 例外**：任何 signed-in user 皆可自助建立自己的 `OrganizerProfile` + `Organization`（比照 `TeacherProfile` 的 onboarding 模式），不需要 Admin 指派或審核；建立後僅能管理自己的 own 資料。詳見 `docs/domain/permissions-matrix.md` 與 `docs/product/route-map.md` 的對應標注。
- 建立流程一律「新建專屬 `Organization`」，V1 不提供搜尋/加入既有組織的協作邀請（non-goal，屬 enterprise 協作範疇）。
- **Edit（`organizer-profile-edit` 已確認）**：已建立 `OrganizerProfile` 的 Organizer 可以在 `/organizer/profile` 編輯 `displayName`（沿用建立時的必填規則）。`id`／`userId`／`organizationId`／`createdAt`／`updatedAt` 不可由 Organizer 編輯。因為 `OrganizerProfile` 沒有狀態機（不像 `TeacherProfile` 需要 Admin 審核才能進入 `approved`），這個編輯能力不需要任何狀態閘門——只要有自己的 `OrganizerProfile` 就能隨時編輯。不新增 notification。

## Organization

Represents a company, club, community, or group.

Fields:

- id
- name
- type
- area
- address
- contactName
- contactEmail
- contactPhone
- createdAt
- updatedAt

Type:

- company
- company_club
- community
- family_group
- other

Phase 1 schema notes（`organizer-demand-request-foundation` D4 已確認）：

- `contactName` / `contactEmail` / `contactPhone` 是提交 `DemandRequest` 前的必填欄位（團體對外聯絡窗口），但 Prisma schema 層級宣告為 `String?`（nullable），以維持 migration additive-safe（既有 `Organization` 資料列不會因新增 `NOT NULL` 欄位而失敗）；必填規則由 application-layer 在 `DemandRequest` submit 時驗證（見下方 `DemandRequest` 說明），不是 schema 層級的資料庫約束。
- `area` / `address` 為 V1 optional / deferred 欄位，可留空，不阻擋任何流程。
- `contactEmail` 只做「非空 + 基本 email 形狀」驗證，不做寄送驗證；`contactPhone` 只做「非空 + 長度界線」驗證，不做電信驗證。

## ServiceType

V1 **不**落地為獨立 Prisma model。`docs/product/form-field-spec.md` 曾規劃獨立 model + seed data，但因 repo 目前無 seed 基礎設施（無 `prisma/seed.ts`，且不可修改 `package.json` 新增 seed script），`organizer-demand-request-foundation` D5 已確認 V1 改採**應用層受控字串**：`DemandRequest.serviceType`（`String?`，見下）由 `src/domain/demand-request/service-types.ts` 常數清單約束允許值，server-side 驗證輸入必須落在清單內。此節保留作為 model 設計稿／未來若需要 Admin 管理類型時的升級參考，**目前不對應任何 Prisma model**。

V1 受控清單（定案，7 項，供 `service-types.ts` 逐字採用）：

- Hatha Yoga
- Yin Yoga
- Stretch Yoga
- Breathwork
- Corporate Relaxation Yoga
- Beginner Yoga
- Parent-child Yoga

## TeacherAvailability

**已落地**（`teacher-availability` 已確認）。Represents regular（每週固定）availability。

Fields:

- id
- teacherProfileId
- dayOfWeek（0–6，0 為週日）
- startTime（`HH:mm`）
- endTime（`HH:mm`，須晚於 `startTime`，不支援跨夜區間）
- locationArea（選填，上限 100 字）
- createdAt

沒有 `isRecurring` 欄位——這個 model 本身就只代表「每週固定」的規律可授課時段，`isRecurring` 永遠是 `true`、不影響任何邏輯，落地時判斷為多餘欄位而拿掉；例外（單次的封鎖或額外開放）改由下方 `AvailabilityException` 另外表達。**Edit（`teacher-availability-edit` 已確認）**：approved 老師可以整筆覆寫編輯既有記錄（重用建立時的必填規則），不再只有新增／刪除兩種操作。**仍然沒有 `updatedAt` 欄位，這輪也刻意不新增**——沒有被要求，也沒有任何既有消費端需要用它判斷資料新鮮度；編輯後看不出「這筆記錄上次是什麼時候被改的」，這是刻意接受的限制，不是遺漏。

## AvailabilityException

**已落地**（`teacher-availability` 已確認）。Represents blocked or special availability（單一日期的例外）。

Fields:

- id
- teacherProfileId
- date（`@db.Date`，純日期、無時分概念，以 UTC 為錨點解析與格式化，見 `src/domain/teacher-availability/date-format.ts`）
- startTime（選填，`HH:mm`）
- endTime（選填，`HH:mm`）—— `startTime`／`endTime` 必須同時提供或同時不提供；兩者皆空代表「整天」
- type
- reason（選填，上限 500 字）
- createdAt

Type:

- blocked（封鎖：這天無法授課）
- extra_available（額外開放：原本沒有排班，但這天可以授課）

**判讀規則（文件記載，非資料庫層強制）**：同一天／同一時段可以同時存在 `blocked` 與 `extra_available` 兩筆記錄（不做重疊檢查），若兩者衝突，`blocked` 優先於 `extra_available`。這條規則目前沒有任何消費端（沒有排程衝突檢查邏輯），先在此記錄供未來需要判讀時依循。

**Edit（`teacher-availability-edit` 已確認）**：approved 老師可以整筆覆寫編輯既有記錄（重用建立時的必填規則，含 `type`／`startTime`／`endTime`／`reason` 都可以改），不再只有新增／刪除兩種操作。同樣沒有 `updatedAt` 欄位，理由跟 `TeacherAvailability` 一致（見上方說明）。

## DemandRequest

Represents an organizer's group-class demand request.

Fields:

- id
- organizerProfileId
- organizationId
- title
- serviceType
- description
- targetLevel
- expectedParticipants
- preferredAreas
- preferredTimeSlots
- preferredStartDate
- classLengthMinutes
- frequency
- budgetRange
- status
- rejectionReason
- createdAt
- updatedAt

Status（`DemandRequestStatus`，`organizer-demand-request-foundation` D9 已確認）：

- draft
- submitted
- under_review
- published
- teacher_responded
- matched
- converted_to_class
- completed
- cancelled
- expired
- rejected

Phase 1 schema notes（`organizer-demand-request-foundation` D5–D11 已確認）：

- `serviceTypeId` 更名為 `serviceType`：因 `ServiceType` 在 V1 不落地為獨立 model（見上），此欄位改為受控字串 `String?`，值須落在 `service-types.ts` 的 7 項定案清單內。
- `organizerProfileId` / `organizationId` 一律由 server 端從登入使用者的 organizer capability 解析帶入，**不接受 client 傳入值決定 own 資源**（IDOR 防護）。
- `title` / `serviceType` / `description` / `targetLevel` / `expectedParticipants` / `preferredAreas`（至少一項）/ `preferredTimeSlots`（至少一項）/ `classLengthMinutes` / `frequency` 是 submit 的必填欄位；`preferredStartDate` / `budgetRange` 為建議欄位，可留空。
- `preferredAreas`、`preferredTimeSlots` 在 schema 中以 `String[] @default([])` 表示（對齊 `TeacherProfile.specialties` 等既有慣例），不建立正規化 relation 或 Json。`preferredTimeSlots` 值須落在受控清單內；`preferredAreas` 為自由輸入 + trim，上限 10 項、單項 ≤50 字。
- `targetLevel`、`frequency` 為應用層受控字串（`String?`），`frequency` 固定 4 值（`single`/`weekly`/`biweekly`/`monthly`，不含 `other`）。
- **V1 已接線的狀態轉換為** `draft → submitted → published | rejected`（Organizer 建立/送出、Admin publish/reject）、`published → matched`（Organizer select，見 `demand-response-selection-and-matching`）、`matched → converted_to_class`（Organizer 建立 ClassSession，見 `class-session-creation`）、`draft`／`submitted`／`published`／`matched` → `cancelled`（Organizer own-scoped 取消，明確排除 `converted_to_class`，見 `demand-request-cancellation`）。`under_review`、`teacher_responded`、`completed`、`expired` 這些 enum 值**保留但仍未接線**，避免未來相關 slice 需要再次 enum migration；細節與各狀態的觸發者/前置/後置見 `state-transition-details.md`。
- `rejected` 為**終局狀態**：本輪不提供 `rejected → draft/submitted` 的重新送審路徑；organizer 若要再提需求，需另建新的 `DemandRequest`。
- `rejectionReason` 是 nullable 欄位（`String?`），保存 Admin 在 `submitted → rejected` 時填寫、**面向該 demand 所屬 organizer 的退回說明**，與內部 `AdminNote` 語意分離（本輪不建 `AdminNote`）；必填、trim 後長度 10–1000 字。因 `rejected` 為終局狀態，reason 寫入後即永久保留於該 demand，不需清空邏輯。
- 只有 `status = published` 的 `DemandRequest` 才是未來 approved teacher demand pool 的 eligible 資料前提；`draft`/`submitted`/`rejected` 一律不對 Teacher 或其他 Organizer 可見。Teacher demand pool 查詢本身不在本輪 scope。

## DemandResponse

Represents a teacher's response to a demand request.

Fields:

- id
- demandRequestId
- teacherProfileId
- message
- proposedPrice
- proposedTimeSlots
- status
- createdAt
- updatedAt

Status:

- submitted
- shortlisted
- selected
- declined
- withdrawn
- expired

## ClassSession

Represents a class session. **已落地並擴充**（`docs/superpowers/plans/2026-08-03-teacher-initiated-open-classes-plan.md` 已確認）：原本只能由「已媒合的 `DemandRequest`」轉換產生（Organizer 建課路徑），這一輪新增老師直接建課路徑（單堂、或屬於下方 `RecurringClassSeries` 系列底下的一場），兩條路徑產生的 `ClassSession` row 完全同構、共用同一套取消/開放報名/標記完成/報名邏輯，只有擁有權欄位是否為 `null` 不同。

Fields:

- id
- demandRequestId（**nullable**——老師自建課程沒有對應的 `DemandRequest`）
- teacherProfileId（不變：一律必填，任何來源的課程都一定有授課老師）
- organizerProfileId（**nullable**——老師自建課程沒有團主）
- organizationId（**nullable**，理由同上）
- origin（新欄位，`ClassSessionOrigin`：`organizer_matched`／`teacher_initiated`，`@default(organizer_matched)`，見下方 enum）
- recurringClassSeriesId（新欄位，nullable FK，指向下方 `RecurringClassSeries`；`onDelete: SetNull`——系列被刪除不會連帶刪除已經生成的獨立場次）
- requiresApproval（新欄位，`Boolean @default(false)`；`true` 時新報名先落在 `Enrollment.status = "pending"`，需要老師確認才轉為 `confirmed`，見下方 `Enrollment` 說明與 Gate G2/G3）
- title
- description
- serviceType
- startAt
- endAt
- location
- capacity
- isPublic
- status
- createdAt
- updatedAt

`ClassSessionOrigin`（新 enum）：

- organizer_matched（既有路徑：由已媒合的 `DemandRequest` 轉換產生）
- teacher_initiated（新路徑：老師直接建課，不需要團主媒合）

Phase 2 schema notes（`teacher-initiated-open-classes` 已確認）：

- `demandRequestId`／`organizerProfileId`／`organizationId` 三個外鍵的 nullable 化是**additive-safe** migration：既有資料列的這三個欄位本來就有值，不受影響；PostgreSQL 的 `@unique` 索引允許多筆 `NULL`，`demandRequestId` 原本「一個 demand 最多一個 class」的語意不受影響。
- **雙重預約衝突檢查**：任何建課路徑（Organizer 媒合或老師自建）都必須通過共用的 conflict-check（`src/domain/class-session/conflict-check.ts`）——鎖定同一位老師的 `TeacherProfile` row（`FOR UPDATE`，避免 TOCTOU），檢查該老師是否已有時間重疊、非 cancelled 的其他 `ClassSession`。這是本輪修的一個既有正確性缺口：舊的 Organizer 建課路徑從來沒有檢查過老師是否被同時排了兩堂課。
- 老師自建課程的取消/標記完成走平行的 own-scoped 核心（`__internal__/*-core-for-teacher.ts`），不修改既有 Organizer/Admin 核心本體，只在既有核心新增前述 conflict-check 呼叫與 nullable 化後的通知解析修正。

## RecurringClassSeries

**已落地**（`teacher-initiated-open-classes` Slice B 已確認，Gate G1 = A：materialize）。代表老師自建的常規（每週固定星期）或固定期（明確日期清單）課程系列的「範本」——實際可報名、可取消、可完成的單位永遠是逐筆獨立生成的 `ClassSession` row，不是這個範本本身；建立系列時（與之後手動「生成更多」時）依範本立刻生成對應的 `ClassSession`，取消其中一場不影響系列其餘場次。

Fields:

- id
- teacherProfileId
- title
- description（選填）
- serviceType（選填）
- dayOfWeek（0–6，比照 `TeacherAvailability` 慣例；**只在「每週固定」模式使用**，固定期課程此欄位為 `null`）
- startTime（`HH:mm`）
- endTime（`HH:mm`）
- location
- capacity
- requiresApproval（`Boolean @default(false)`，套用到這個系列底下生成的每一場）
- createdAt
- updatedAt

Phase 2 schema notes：

- 固定期課程（例如連續 4 週的特定日期組合）不在這個 model 記錄每一個具體日期——生成時由呼叫端直接提供明確日期清單，逐筆寫入對應 `ClassSession.startAt`/`endAt`，系列本身只保留 `startTime`/`endTime` 這組共用的時鐘時間。
- 沒有 `status`／`isPublic` 欄位：「取消系列」等同於「取消它底下所有還來得及取消的場次」，series 這一列本身仍會保留，之後仍可用「生成更多」再生成新的未來場次（僅限每週固定模式）；`isPublic` 只存在於每一筆獨立 `ClassSession`，系列生成的每一場目前一律預設 `isPublic = false`（V1 的刻意簡化，系列本身沒有能設定公開性的欄位/UI，且 `ClassSession` 建立後無法事後修改可見性）。
- `onDelete: Cascade` 從 `TeacherProfile` 指向這個 model；`onDelete: SetNull` 從這個 model 指向底下生成的 `ClassSession`（見上方 `ClassSession.recurringClassSeriesId`）。

## Enrollment

Represents member enrollment in a class session. **已擴充**（`teacher-initiated-open-classes` Slice C 已確認，Gate G2/G3）：`pending` 這個既有保留但原本從未真正寫入的 enum 值，這一輪第一次被實際使用。

Fields:

- id
- classSessionId
- userId
- status
- notes
- consentedAt
- createdAt
- updatedAt

`consentedAt`（`enrollment` 已確認）：非 nullable，記錄使用者確認「了解此課程非醫療行為」的時間點；V1 唯一的建立路徑必定顯式寫入，不是選填的 UX 防誤觸欄位。

Phase 2 schema notes（`teacher-initiated-open-classes` 已確認）：

- 新報名的初始 `status` 依所屬 `ClassSession.requiresApproval` 決定：`false`（既有行為，維持不變）→ 直接 `confirmed`；`true` → 先落在 `pending`，需要授課老師明確確認才轉為 `confirmed`，或老師拒絕/會員自助取消/課程被整堂取消時轉為 `cancelled`。
- 容量計算（Gate G3 = A）：`pending` 與 `confirmed` **合計**佔用名額（保留席位等老師確認），不是只算 `confirmed`。
- `pending` 報名的資格檢查與 `teacher_initiated` 課程的建立資格檢查共用同一個手法：在同一個 transaction 內先鎖定 `TeacherProfile` row（`FOR UPDATE`）才讀取 `status`，避免跟 Admin 執行 suspend 的獨立 `UPDATE` 產生 TOCTOU 競態；`teacher_not_approved` 錯誤碼阻擋任何來源（公開瀏覽或已登入直連）對非 `approved` 老師課程的**新**報名，不回溯撤銷已經合法建立的既有報名。

## PaymentIntent

Placeholder for future payment support.

Fields:

- id
- enrollmentId
- amount
- currency
- status
- provider
- providerRef
- createdAt
- updatedAt

## Review

Represents review after class. **已落地**（`docs/superpowers/plans/2026-07-29-class-session-review-plan.md` D2/D4）：Member 對已完成（`status="completed"`）且自己有 `confirmed` enrollment 的 class session 留下一次性評價，`@@unique([classSessionId, reviewerUserId])` 本身就是唯一需要的併發保護，不需要額外的鎖。不含 `teacherProfileId`（授課老師一律透過 `classSession` 關聯取得，避免沒有 DB 一致性保證的冗餘欄位）與 `visibility`（V1 沒有任何公開頁面可以消費這個欄位；評價只在 Member／Organizer／Teacher 各自的既有 own-scoped 頁面顯示，作者顯示既有 name/email fallback 的顯示名稱，不匿名化）。

Fields:

- id
- classSessionId
- reviewerUserId
- rating（1–5 的整數，必填）
- comment（選填，上限 500 字，比照 `Enrollment.notes` 的既有先例）
- createdAt

**已落地**（`docs/superpowers/plans/2026-07-31-review-average-rating-display-plan.md` 已確認）：老師的平均評分與評價則數是**即時計算的衍生值**，不是新欄位——透過 `Review` → `ClassSession.teacherProfileId` 的關聯即時聚合（own 用 `prisma.review.aggregate()`，Admin 列表用資料庫端 `JOIN`＋`GROUP BY`，兩者都不把逐筆評價撈進應用層）。老師本人可在 `/teacher/profile` 看到自己的彙整值；Admin 可在 `/admin/teachers` 看到每位老師的彙整值（僅平均分數與則數，不含評語或評價者身分）。

## Notification

Represents notification record。**已落地**（`docs/superpowers/plans/2026-07-27-notification-plan.md` 已確認）：V1 只寫入 `channel="in_app"`，`email`/`line`/`sms` 保留為未來 channel 的 reserved enum 值（D2/D6）；`status` 生命週期是 `pending → sent`／`pending → failed`，V1 站內列表（`/notifications`）只顯示 `status="sent"` 的記錄。

Fields:

- id
- userId
- type（`NotificationType`，20 個 enum 值——原始 14 個事件表（`class-session-cancellation` 一輪把保留的 `class_session_cancelled` 接上，共接線 12 個）之外，`demand-request-cancellation` 一輪新增第 15 個全新值 `demand_request_cancelled`、`teacher-profile-suspension` 一輪再新增第 16、17 個全新值 `teacher_profile_suspended`／`teacher_profile_restored`、`class-session-review` 一輪再新增第 18、19 個全新值 `class_session_completed`（`completeOwnClassSession` 成功後通知 `affected_member` 角色）／`review_submitted`（`submitReviewForUser` 成功後通知 `counterpart` 角色，即授課老師）、`teacher-initiated-open-classes` 一輪再新增第 20 個全新值 `enrollment_pending_review`（`requiresApproval=true` 課程的新報名發送給會員 `self` 與授課老師 `counterpart` 兩者，取代該筆報名原本會發的 `enrollment_confirmed`；老師確認後才真正發送 `enrollment_confirmed`）（六者都真的執行過 `ALTER TYPE ... ADD VALUE` migration，不是接上原本保留的值），V1 目前共接線 18 個；`class_session_changed`／`class_reminder_basic` 保留未接線）
- channel（`NotificationChannel`：`email`／`in_app`／`line`／`sms`，V1 只寫入 `in_app`）
- title
- body
- status（`NotificationStatus`：`pending`／`sent`／`failed`／`cancelled`，V1 只會出現 `sent`／`failed`）
- createdAt
- sentAt（nullable，`pending`／`failed` 狀態時為 null）

## AdminNote

Internal admin note.

`AdminNote` 是**內部備註**，不對一般使用者顯示。它與 `TeacherProfile.rejectionReason` 是不同概念：teacher-facing 的退回說明用 `TeacherProfile.rejectionReason` 保存並顯示給老師；`AdminNote` 仍維持不對外。V1 的 teacher rejection reason **不**使用 `AdminNote`。此 model 目前仍是設計稿，尚未落地到 Prisma schema。

Fields:

- id
- entityType
- entityId
- adminUserId
- note
- createdAt
