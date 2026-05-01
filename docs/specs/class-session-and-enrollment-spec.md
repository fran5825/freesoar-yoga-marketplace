# Class Session and Enrollment Spec

## 目的

Class session and enrollment 將 matched demand 轉為可管理、可報名的課程場次，並讓 Member 完成報名。

V1 的重點是清楚、安全、可追蹤，不做複雜金流、refund automation 或完整會員訂閱。

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
2. Organizer 或 Admin 從 selected DemandResponse 建立 ClassSession。
3. ClassSession 補齊 teacher、organizer、time、location、capacity 等必要資訊。
4. ClassSession 進入 open_for_enrollment 或 confirmed。
5. Member 查看 class detail。
6. Member 提交 enrollment。
7. 系統檢查 capacity 與 duplicate enrollment。
8. Enrollment confirmed。
9. 課後 Admin 或 Teacher 可依政策標記 attended / no_show。

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
- `serviceTypeId`
- `startAt`
- `endAt`
- `location`
- `capacity`
- `status`

`Enrollment` 必要欄位：

- `classSessionId`
- `userId`
- `status`

## Permission Requirements

- Member 只能建立與查看自己的 enrollments。
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
pending → confirmed → attended
```

終止狀態：

```text
cancelled
no_show
```

## RWD Requirements

- Class detail 與 enrollment flow 必須在 360px 手機寬度可用。
- 課程資訊在手機上要分區呈現，不使用密集表格。
- 報名按鈕可使用 sticky CTA，但不可遮擋內容。
- Admin class management 可優先支援 tablet / desktop。

## Acceptance Criteria

- Matched demand 可以建立 ClassSession。
- ClassSession 必要欄位完整後才能 open_for_enrollment。
- Member 可以報名 open_for_enrollment 或 confirmed 的 class session。
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
