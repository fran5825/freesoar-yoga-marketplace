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

沒有 `isRecurring` 欄位——這個 model 本身就只代表「每週固定」的規律可授課時段，`isRecurring` 永遠是 `true`、不影響任何邏輯，落地時判斷為多餘欄位而拿掉；例外（單次的封鎖或額外開放）改由下方 `AvailabilityException` 另外表達。沒有 `updatedAt`：不提供編輯，只有新增／刪除。

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

Represents a class session created from a matched demand request in V1.

Teacher-created classes are future scope / non-V1.

Fields:

- id
- demandRequestId
- teacherProfileId
- organizerProfileId
- organizationId
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

## Enrollment

Represents member enrollment in a class session.

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

## Notification

Represents notification record。**已落地**（`docs/superpowers/plans/2026-07-27-notification-plan.md` 已確認）：V1 只寫入 `channel="in_app"`，`email`/`line`/`sms` 保留為未來 channel 的 reserved enum 值（D2/D6）；`status` 生命週期是 `pending → sent`／`pending → failed`，V1 站內列表（`/notifications`）只顯示 `status="sent"` 的記錄。

Fields:

- id
- userId
- type（`NotificationType`，19 個 enum 值——原始 14 個事件表（`class-session-cancellation` 一輪把保留的 `class_session_cancelled` 接上，共接線 12 個）之外，`demand-request-cancellation` 一輪新增第 15 個全新值 `demand_request_cancelled`、`teacher-profile-suspension` 一輪再新增第 16、17 個全新值 `teacher_profile_suspended`／`teacher_profile_restored`、`class-session-review` 一輪再新增第 18、19 個全新值 `class_session_completed`（`completeOwnClassSession` 成功後通知 `affected_member` 角色）／`review_submitted`（`submitReviewForUser` 成功後通知 `counterpart` 角色，即授課老師）（五者都真的執行過 `ALTER TYPE ... ADD VALUE` migration，不是接上原本保留的值），V1 目前共接線 17 個；`class_session_changed`／`class_reminder_basic` 保留未接線）
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
