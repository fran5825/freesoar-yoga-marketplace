# Admin Review Workflow Spec

## 目的

Admin review workflow 讓平台能維持老師品質、需求品質、課程資料一致性與基本安全。

V1 Admin 不是大型 CRM 或 enterprise operations system，而是 marketplace 品質閘門。

## User Role

主要角色：

- Admin
- Teacher
- Organizer
- Member

## Problem

Free Soar Yoga 的信任感來自品質管理。老師未審核、需求未 review、課程狀態不一致或 enrollment 超額，都會傷害 marketplace 信任與品牌感。

## User Flow

1. Admin 進入 `/admin/dashboard`。
2. Admin 查看 pending teacher applications、pending demand requests、upcoming class sessions、basic KPIs。
3. Admin 進入 teacher review，approve / reject / suspend。
4. Admin 進入 demand review，publish / reject / cancel。
5. Admin 查看 class sessions，協助確認或取消。
6. Admin 查看 enrollments，協助確認、取消、標記 attended / no_show。
7. 重要管理動作可留下 admin note。

## UI Requirements

- Admin dashboard 要優先呈現待處理事項。
- Review list 要能依 status 篩選。
- 每個 destructive 或 negative action 需確認，例如 reject、suspend、cancel。
- Admin note 不應顯示給一般使用者。
- Admin UI 要清楚但不需要華麗，不做過度複雜的後台。

## Data Requirements

主要資料：

- `TeacherProfile`
- `DemandRequest`
- `DemandResponse`
- `ClassSession`
- `Enrollment`
- `Organization`
- `AdminNote`
- `Notification`

## Permission Requirements

- 只有 Admin 可以進入 `/admin/*`。
- 所有 Admin action 仍需 server-side permission check。
- Admin 可查看管理資料，但不應把敏感資料暴露給不需要的角色。
- Admin action 應符合 state transition rules。

## State Transitions

Admin 可觸發：

- `TeacherProfile`: `submitted → approved/rejected`、`approved → suspended`
- `DemandRequest`: `submitted → under_review → published/rejected`
- `DemandResponse`: `submitted → shortlisted/selected/declined`
- `ClassSession`: `draft → pending_confirmation → open_for_enrollment → confirmed → completed/cancelled`
- `Enrollment`: `pending → confirmed → attended/cancelled/no_show`

## RWD Requirements

- Admin dashboard 至少支援 tablet 與 desktop。
- 重要審核動作在手機上若提供，需避免誤觸。
- Lists 在小螢幕可改為 cards 或簡化欄位。

## Acceptance Criteria

- Admin 可以查看待審老師。
- Admin 可以 approve、reject、suspend teacher。
- Admin 可以查看待 review demand requests。
- Admin 可以 publish 或 reject demand request。
- Admin 可以查看 class sessions 與 enrollments。
- Admin 可以留下 admin note。
- 非 Admin 不可進入 admin routes。
- Admin 狀態變更不可違反 state transition rules。

## Non-goals

- Advanced analytics dashboard
- Full CRM
- Complex enterprise permissions
- Payment/refund operation center
- 多層 admin role
- 自動化 AI 審核

## Risks

- Admin route 若未保護會造成重大安全問題。
- Admin action 若不檢查 state transition，會讓 marketplace 資料不一致。
- Admin dashboard 若太大，會拖慢 V1 開發。
