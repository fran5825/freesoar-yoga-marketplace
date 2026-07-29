# State Machines

Marketplace state transitions must be explicit.

## TeacherProfile Status

```text
draft
  → submitted
  → approved
  → rejected

approved
  ↔ suspended
```

Rules:

- Only approved teachers can respond to demand requests.
- Rejected teachers may resubmit if allowed by admin.
- Suspended teachers cannot appear publicly or respond to new demands.

**V1 落地範圍（`teacher-profile-suspension` 已確認）**：這是這個檔案裡第一次替 TeacherProfile 補上「V1 落地範圍」子集說明（DemandRequest／DemandResponse／ClassSession／Enrollment 都已經有這個格式，TeacherProfile 之前一直沒有，導致 `approved ↔ suspended` 長期被誤讀成早就是 V1 功能）。`draft → submitted → approved|rejected`、`rejected → submitted` 都已落地（`teacher-onboarding-spec.md` 已確認）；`approved ↔ suspended` 這組雙向轉換直到 `teacher-profile-suspension` 一輪才真正接線——Admin-only，`approved → suspended` 必填 `suspensionReason`（獨立欄位，不與 `rejectionReason` 共用），`suspended → approved` 清空該欄位。暫停不連帶處理既有的 `DemandResponse`／`ClassSession`，但 `DemandResponse` 的 `submitted → selected` 轉換（見下方 DemandResponse Status）新增了 teacher 資格檢查，暫停後無法再被選定。

## DemandRequest Status

```text
draft
  → submitted
  → under_review
  → published
  → teacher_responded
  → matched
  → converted_to_class
  → completed
```

Alternative terminal states:

```text
cancelled
expired
rejected
```

Rules:

- Organizer can create draft/submitted demand.
- Admin can move submitted → under_review → published.
- Teacher response can move published → teacher_responded.
- Organizer/admin can select teacher and move to matched.
- Matched demand can become ClassSession.
- Converted demands should not be edited in ways that invalidate ClassSession.

**V1 落地範圍（`organizer-demand-request-foundation` D9、`demand-response-selection-and-matching` D1/D2/D4、`class-session-creation` D1/D2、`demand-request-cancellation` D1/D2 已確認）**：上述完整狀態機是 marketplace 的最終設計，但目前只**接線**以下子集：

```text
draft
  → submitted
  → published
  → matched
  → converted_to_class
  → rejected

draft / submitted / published / matched
  → cancelled
```

`under_review`、`teacher_responded`、`completed`、`expired` 這些狀態值在 Prisma enum 中**保留**（避免未來相關 slice 需要再次 enum migration），但**不提供**對應的 transition 或 UI 動作：

- Admin review 直接 `submitted → published | rejected`，V1 **跳過** `under_review` 這一步（對齊 `TeacherProfile` 的 `submitted → approved|rejected` 簡化先例）。
- `rejected` 在 V1 是**終局狀態**：不提供 `rejected → draft/submitted` 的重新送審路徑；organizer 需另建新的 demand。
- **`published → matched` 跳過 `teacher_responded`**：`teacher-demand-pool-response-plan` D11 選擇動態推導、不 persist `teacher_responded`，`demand-response-selection-and-matching` 沿用同一決定不變更，因此實際接線的是 `published → matched`，Actor 為 **Organizer**（own-scoped，D2；Admin 不介入 select）。
- **`matched → converted_to_class`**：Organizer 從自己 `matched` 的 demand 建立 `ClassSession` 時，同一 transaction 內把 demand 轉為 `converted_to_class`（`class-session-creation` D1/D2，Admin 不介入，比照 D2 select 的同一先例）。Class conversion 之後（`converted_to_class → completed`／`cancelled`）不在目前 scope。
- **`draft`／`submitted`／`published`／`matched` → `cancelled`**（`demand-request-cancellation` D1/D2）：Organizer own-scoped，明確**排除** `converted_to_class`（已有 `ClassSession` 存在，`onDelete: Restrict` 外鍵會產生語意矛盾資料，該狀態下要取消應改用 `class-session-cancellation`）；`matched` 狀態下取消（D2，選定老師之後、建立課程之前這段期間唯一能回頭的窗口）與 `draft`/`submitted`/`published` 狀態下取消，同一 transaction 內都會把該 demand 底下所有 `status IN ('submitted','selected')` 的 `DemandResponse` 一併轉為 `declined`（連帶取消，D4）。取消動作與既有 `submitDemandResponseForTeacher`／`selectDemandResponseForOrganizer`／`createClassSessionForOrganizer` 搶同一把 `DemandRequest` 鎖（D5）。

詳細前置條件、後置效果與各狀態的 Actor，見 `state-transition-details.md`。

## DemandResponse Status

```text
submitted
  → shortlisted
  → selected
```

Alternative terminal states:

```text
declined
withdrawn
expired
```

Rules:

- Only approved teachers can submit.
- Teacher can withdraw before selected.
- Organizer/admin can shortlist/select.
- Only one selected response per demand in V1.

**V1 落地範圍（`teacher-demand-pool-response-plan`、`demand-response-selection-and-matching` D1/D2/D3、`demand-request-cancellation` D4、`teacher-profile-suspension` 已確認）**：上述完整狀態機是 marketplace 的最終設計，目前接線的子集為：

```text
(none)
  → submitted
  → selected
  → declined
```

（另外獨立接線 `submitted → withdrawn`，見下方禁止條件。`selected → declined` 也可能發生，見下方連帶取消說明。）

- `shortlisted` enum 值**保留但不接線**：V1 跳過候選階段，Organizer 直接對任一 `submitted` response 執行 select（`demand-response-selection-and-matching` D1）。
- `Select` 僅 **Organizer own-scoped** 可執行，**Admin 不介入**（D2，與上表 Rules 所寫的「Organizer/admin」不同，V1 未開放 Admin）。
- `Decline` 在 V1 不是 Organizer 手動動作，而是 select 成功時**同一 transaction 內**自動把同 demand 其餘 `submitted` response 轉為 `declined`（D3）。
- **連帶取消也會產生 `declined`**（`demand-request-cancellation` D4）：所屬 `DemandRequest` 被 Organizer 取消時，該 demand 底下所有 `submitted`／`selected` 的 response 同一 transaction 內一併轉為 `declined`——reuse 既有值，不新增新的 `DemandResponseStatus`。Teacher 端文案會依「demand 被取消」與「選了別人」區分（見 `docs/domain/permissions-matrix.md`／`state-transition-details.md`）。
- **`submitted → selected` 新增 teacher 資格檢查**（`teacher-profile-suspension` 已確認）：select 的原子 UPDATE 現在也要求該 response 所屬 `TeacherProfile.status = 'approved'`，暫停中的老師既有的 `submitted` response 無法再被選定（回傳 `response_teacher_not_approved`），但已經 `selected` 的 response 不受影響。
- `expired` enum 值保留但不接線（無 demand 過期機制）。

## ClassSession Status

```text
draft
  → pending_confirmation
  → open_for_enrollment
  → confirmed
  → completed
```

Alternative terminal states:

```text
cancelled
```

Rules:

- ClassSession should have teacher, organizer, time, location, capacity.
- Enrollment only allowed when open_for_enrollment or confirmed, depending on policy.
- Completed sessions cannot be edited except admin notes/reviews.

**V1 落地範圍（`class-session-creation` D1/D2/D9、`enrollment` D2/D3/D14、`class-session-cancellation` D1/D2/D3/D4、`class-session-completion` D1/D2/D3/D5 已確認）**：上述完整狀態機是最終設計，目前**接線** `(none) → draft → open_for_enrollment`、`draft`／`open_for_enrollment → cancelled`，以及 `open_for_enrollment → completed`：Organizer 從自己 `matched` 的 demand 一次到位建立 `ClassSession`（必要欄位皆於建立當下填齊，不是分階段補齊的殘缺 `draft`），建立後不提供編輯；Organizer own-scoped 明確按鈕觸發 `draft → open_for_enrollment`，且 `startAt` 已過的 class session 不可開放（D14）。Organizer own-scoped 也可以把 `draft` 或 `open_for_enrollment` 明確取消為 `cancelled`，同樣要求 `startAt` 尚未到達（`class-session-cancellation` D2）；取消會在同一個 transaction 內把該課程底下所有 `confirmed` 的 Enrollment 一併轉成 `cancelled`（連帶取消，D4），且跟 `createEnrollmentForUser` 搶同一把 `ClassSession` 鎖以避免併發下殘留矛盾資料（D3）。**修正：`completed` 已經接線（`class-session-completion` 已確認）**——Organizer own-scoped 明確按鈕觸發 `open_for_enrollment → completed`，時間方向與取消/開放相反：`endAt` 必須**已經**過去才能標記完成。不連帶處理 `Enrollment`（D3，`confirmed` 報名維持原狀）、不新增 Notification（D5，理由與範圍留給未來 Review 一輪一起做）；沒有 `SELECT ... FOR UPDATE` 鎖序列，跟 `draft → open_for_enrollment` 同一種單一 organizer、單一狀態欄位翻轉的形狀。`pending_confirmation`/`confirmed` enum 值仍然保留但無對應 transition——`open_for_enrollment → confirmed` 沒有明確、機械式的觸發條件（不像 capacity 那樣可自動判斷），V1 不接線；`open_for_enrollment` 本身已足以讓 Member 報名到滿額為止。

## Enrollment Status

```text
pending
  → confirmed
```

Alternative terminal states:

```text
cancelled
```

Future / admin-only states:

```text
attended
no_show
```

**V1 落地範圍（`enrollment` D1/D6/D8/D14 已確認）**：上述完整狀態機是最終設計，目前只**接線** `(none) → confirmed`（跳過 `pending`，`pending → confirmed` 沒有獨立於 capacity 檢查之外的業務動作）與 `confirmed → cancelled`。建立時同一 transaction 內原子檢查 capacity 與重複報名，成功即直接寫入 `confirmed`，並寫入 `consentedAt`（D6，非 nullable）。取消（`confirmed → cancelled`）與建立、開放報名一樣受 `startAt` 時間限制（D14）：課程開始後不提供自助取消，因為取消會抹除歷史報名紀錄，且讓這筆 enrollment 永遠無法銜接未來的 `confirmed → attended/no_show`。取消後**不可**對同一 class session 重新報名（D8，`@@unique([classSessionId, userId])` 不分狀態）。`pending`/`attended`/`no_show` enum 值保留但無對應 transition。

Rules:

- User cannot enroll twice in same class.
- Enrollment cannot exceed class capacity.
- Cancel rules depend on policy.
- V1 primarily supports confirmed and cancelled.
- Full teacher attendance workflow is not V1.
