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

**V1 落地範圍（`organizer-demand-request-foundation`，D9 已確認）**：上述完整狀態機是 marketplace 的最終設計，但本輪 foundation feature 只**接線**以下子集：

```text
draft
  → submitted
  → published
  → rejected
```

`under_review`、`teacher_responded`、`matched`、`converted_to_class`、`completed`、`cancelled`、`expired` 這些狀態值在 Prisma enum 中**保留**（避免未來相關 slice 需要再次 enum migration），但本輪**不提供**對應的 transition 或 UI 動作：

- Admin review 直接 `submitted → published | rejected`，V1 **跳過** `under_review` 這一步（對齊 `TeacherProfile` 的 `submitted → approved|rejected` 簡化先例）。
- `rejected` 在 V1 是**終局狀態**：不提供 `rejected → draft/submitted` 的重新送審路徑；organizer 需另建新的 demand。
- Teacher response、matching、class conversion 等下游 transition 屬未來 slice（demand pool、response、matching、class session），不在本輪 scope。

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
