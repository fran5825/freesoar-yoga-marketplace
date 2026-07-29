# Class Session and Enrollment Spec

## 目的

Class session and enrollment 將 matched demand 轉為可管理、可報名的課程場次，並讓 Member 完成報名。

V1 的重點是清楚、安全、可追蹤，不做複雜金流、refund automation 或完整會員訂閱。

## 落地現況（2026-07-27 更新）

本 spec 描述的完整 user flow 分批落地：

- **已出貨**（`docs/superpowers/plans/2026-07-26-class-session-creation-plan.md`）：User Flow 第 1–3 步——`DemandRequest` 進入 `matched`（見 `demand-response-and-matching-spec.md`）、Organizer 從自己 `matched` 的 demand 建立 `ClassSession`（own-scoped，Admin 不介入），且必要資訊於建立當下**一次到位**填齊（`title`/`description`（選填）/`serviceType`/`startAt`/`endAt`/`location`/`capacity`/`isPublic`），不是分階段補齊。Teacher 可唯讀查看自己已建立的 class session（不受 approved 狀態限制，比照唯讀查看自己 demand response 的先例）。
- **已出貨**（`docs/superpowers/plans/2026-07-27-enrollment-plan.md`）：User Flow 第 4 步（部分）——Organizer own-scoped 把 `draft` 開放為 `open_for_enrollment`（不經過 `pending_confirmation`，且 `startAt` 已過不可開放）；第 5–8 步——已登入 Member 透過 Organizer 分享的直接連結（`/classes/[classSessionId]`）查看詳情、勾選 basic consent 後報名，系統原子檢查名額與重複報名，成功即直接 `confirmed`（跳過 `pending`）並記錄 `consentedAt`；Member 可在 `startAt` 之前自助取消報名（取消後不可重新報名），取消會釋放名額；Organizer／Teacher 在既有 class session 頁面看到 confirmed 報名的基本 roster。**`ClassSession` 進入 `confirmed`（不同於 Enrollment 的 `confirmed`）未落地**：`open_for_enrollment` 之後沒有更多 ClassSession 狀態轉換，`open_for_enrollment` 本身已足以讓 Member 報名到滿額為止。
- **已出貨**（`docs/superpowers/plans/2026-07-29-class-session-completion-plan.md`）：`ClassSession` 補上 `open_for_enrollment → completed` 這個轉換——Organizer own-scoped，只能在 `endAt` 已經過去之後標記完成（時間方向與「開放報名」／「取消」相反）。不連帶處理 `Enrollment`（`confirmed` 報名維持原狀）。Member 透過既有分享連結（`/classes/[classSessionId]`）與 Organizer／Teacher 兩處既有的報名名單顯示條件都同步擴大為同時允許 `completed`，確保已完成的課程不會因為這個新狀態值而讓既有連結或報名名單消失。標記完成成功時新增了一則 Notification（`class_session_completed`），見下一點。
- **已出貨**（`docs/superpowers/plans/2026-07-29-class-session-review-plan.md`）：`completeOwnClassSession` 成功後補上邀請評價的 Notification（`class_session_completed`，收件人是所有 `confirmed` enrollment 的 Member）；新增 `Review` model（Member 對 `completed` 且自己有 `confirmed` enrollment 的 class session 留下一次性 1–5 星評價與選填評語，`submitOwnReview`／`submitReviewForUser`，`@@unique([classSessionId, reviewerUserId])` 本身就是唯一需要的併發保護），成功寫入後觸發第二則 Notification（`review_submitted`，收件人是該課程的授課老師）。Member 在 `/member/enrollments` 對已完成的報名可留下評價（已留過則顯示唯讀版本，不可編輯或刪除）；Organizer（`/organizer/classes/[classSessionId]`）與 Teacher（`/teacher/classes`）在課程狀態為 `completed` 時各自看得到該課程收到的所有評價。詳見 `docs/domain/data-model.md` 的 Review 小節與 `docs/domain/permissions-matrix.md` 的 Review 小節。
- **未落地**：第 9 步——`attended`/`no_show`，`class-session-and-enrollment-spec.md` 已明確標記為 future 或 admin-only 後續能力，`class-session-completion` 一輪明確不擴大這個範圍。`/classes` 公開列表、未登入 Visitor 可見的 class detail、`/admin/enrollments`、公開的 Review 頁面（Review 沒有 `visibility` 欄位，V1 沒有任何公開頁面可以消費評價）皆維持未落地。

## User Role

主要角色：

- Organizer
- Teacher
- Member
- Admin

## Problem

當團主與老師媒合後，需要形成具體課程：時間、地點、名額、老師、團主與報名狀態都必須一致。會員報名時，系統要避免重複報名與超過 capacity。

## User Flow

1. DemandRequest 進入 matched。
2. Organizer 或 Admin 從 matched DemandRequest 的 selected DemandResponse 建立 ClassSession。
3. ClassSession 補齊 teacher、organizer、time、location、capacity 等必要資訊。
4. ClassSession 進入 open_for_enrollment 或 confirmed。
5. Member 查看 class detail。
6. Member 提交 enrollment。
7. 系統檢查 capacity 與 duplicate enrollment。
8. Enrollment confirmed。
9. V1 主要支援 enrollment confirmed / cancelled；attended / no_show 保留為 future 或 admin-only 後續能力。

## UI Requirements

- Class detail 要清楚呈現時間、地點、老師、課程類型、程度、名額與報名狀態。
- Enrollment CTA 在手機上要清楚可見。
- 報名成功後要顯示狀態與提醒資訊。
- ClassSession 管理畫面要避免把團主、老師、會員資料混在同一個不清楚頁面。

## Data Requirements

主要資料：

- `ClassSession`
- `DemandRequest`
- `DemandResponse`
- `TeacherProfile`
- `OrganizerProfile`
- `Organization`
- `Enrollment`
- `Notification`

`ClassSession` 必要欄位：

- `teacherProfileId`
- `organizerProfileId`
- `organizationId`
- `title`
- `serviceType`
- `startAt`
- `endAt`
- `location`
- `capacity`
- `isPublic`
- `status`

`Enrollment` 必要欄位：

- `classSessionId`
- `userId`
- `status`

V1 Enrollment 需記錄 basic consent：使用者確認「我了解此課程非醫療行為，會依自身身體狀況參與。」此 consent 不代表收集醫療資料，也不建立健康問卷。

## Permission Requirements

- Member 只能建立與查看自己的 enrollments。
- Teacher 或 Organizer 若要報名課程，使用同一個 User 的 Member 能力，不使用 Teacher / Organizer 權限建立 enrollment。
- Organizer 可查看自己 class session 的 roster basics。
- Teacher 可查看自己授課 class session 的基本 roster。
- Admin 可管理所有 class sessions 與 enrollments。
- Visitor 是否可看 class detail 依 class visibility policy。

## State Transitions

`ClassSession`：

```text
draft → pending_confirmation → open_for_enrollment → confirmed → completed
```

終止狀態：

```text
cancelled
```

`Enrollment`：

```text
pending → confirmed
```

終止狀態：

```text
cancelled
```

Future / admin-only 後續能力：

```text
attended
no_show
```

`attended` / `no_show` 保留為 future 或 admin-only 後續能力，V1 不做完整 Teacher attendance workflow。

## RWD Requirements

- Class detail 與 enrollment flow 必須在 360px 手機寬度可用。
- 課程資訊在手機上要分區呈現，不使用密集表格。
- 報名按鈕可使用 sticky CTA，但不可遮擋內容。
- Admin class management 可優先支援 tablet / desktop。

## Acceptance Criteria

- Matched demand 可以建立 ClassSession。
- ClassSession 必要欄位完整後才能 open_for_enrollment。
- Member 可以報名 open_for_enrollment 或 confirmed 的 class session。
- Member 報名時需勾選 basic consent。
- 同一 Member 不可重複報名同一 class session。
- Enrollment confirmed 數量不可超過 capacity。
- Cancelled class session 不可接受新 enrollment。
- Completed class session 不可任意修改核心資訊。

## Non-goals

- Full payment automation
- Refund automation
- Complex membership subscription
- Advanced attendance analytics
- Google Calendar two-way sync
- LINE reminder integration

## Risks

- capacity 檢查若不嚴謹，可能超收。
- class session 與 demand request 資料不同步，會造成營運混亂。
- 報名流程若太像電商搶購，會偏離品牌。
- 未處理時間衝突會造成老師排程問題。
