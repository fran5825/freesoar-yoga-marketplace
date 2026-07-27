# State Machines

Marketplace state transitions must be explicit.

## TeacherProfile Status

```text
draft
  → submitted
  → approved
  → rejected
  → suspended
```

Rules:

- Only approved teachers can respond to demand requests.
- Rejected teachers may resubmit if allowed by admin.
- Suspended teachers cannot appear publicly or respond to new demands.

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

**V1 落地範圍（`organizer-demand-request-foundation` D9、`demand-response-selection-and-matching` D1/D2/D4、`class-session-creation` D1/D2 已確認）**：上述完整狀態機是 marketplace 的最終設計，但目前只**接線**以下子集：

```text
draft
  → submitted
  → published
  → matched
  → converted_to_class
  → rejected
```

`under_review`、`teacher_responded`、`completed`、`cancelled`、`expired` 這些狀態值在 Prisma enum 中**保留**（避免未來相關 slice 需要再次 enum migration），但**不提供**對應的 transition 或 UI 動作：

- Admin review 直接 `submitted → published | rejected`，V1 **跳過** `under_review` 這一步（對齊 `TeacherProfile` 的 `submitted → approved|rejected` 簡化先例）。
- `rejected` 在 V1 是**終局狀態**：不提供 `rejected → draft/submitted` 的重新送審路徑；organizer 需另建新的 demand。
- **`published → matched` 跳過 `teacher_responded`**：`teacher-demand-pool-response-plan` D11 選擇動態推導、不 persist `teacher_responded`，`demand-response-selection-and-matching` 沿用同一決定不變更，因此實際接線的是 `published → matched`，Actor 為 **Organizer**（own-scoped，D2；Admin 不介入 select）。
- **`matched → converted_to_class`**：Organizer 從自己 `matched` 的 demand 建立 `ClassSession` 時，同一 transaction 內把 demand 轉為 `converted_to_class`（`class-session-creation` D1/D2，Admin 不介入，比照 D2 select 的同一先例）。Class conversion 之後（`converted_to_class → completed`／`cancelled`）不在目前 scope。

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

**V1 落地範圍（`teacher-demand-pool-response-plan`、`demand-response-selection-and-matching` D1/D2/D3 已確認）**：上述完整狀態機是 marketplace 的最終設計，目前接線的子集為：

```text
(none)
  → submitted
  → selected
  → declined
```

（另外獨立接線 `submitted → withdrawn`，見下方禁止條件。）

- `shortlisted` enum 值**保留但不接線**：V1 跳過候選階段，Organizer 直接對任一 `submitted` response 執行 select（`demand-response-selection-and-matching` D1）。
- `Select` 僅 **Organizer own-scoped** 可執行，**Admin 不介入**（D2，與上表 Rules 所寫的「Organizer/admin」不同，V1 未開放 Admin）。
- `Decline` 在 V1 不是 Organizer 手動動作，而是 select 成功時**同一 transaction 內**自動把同 demand 其餘 `submitted` response 轉為 `declined`（D3）。
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

**V1 落地範圍（`class-session-creation` D1/D2/D9 已確認）**：上述完整狀態機是最終設計，目前只**接線** `(none) → draft`：Organizer 從自己 `matched` 的 demand 一次到位建立 `ClassSession`（必要欄位皆於建立當下填齊，不是分階段補齊的殘缺 `draft`），建立後不提供編輯。`pending_confirmation`/`open_for_enrollment`/`confirmed`/`completed`/`cancelled` enum 值保留但無對應 transition——`open_for_enrollment` 需要 Enrollment 才有實質意義，Enrollment 屬未來獨立 plan，本輪不提前接線。

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

Rules:

- User cannot enroll twice in same class.
- Enrollment cannot exceed class capacity.
- Cancel rules depend on policy.
- V1 primarily supports confirmed and cancelled.
- Full teacher attendance workflow is not V1.
