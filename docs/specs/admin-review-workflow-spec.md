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
3. Admin 進入 teacher review，approve / reject / suspend / restore（`teacher-profile-suspension` 已確認：`suspend`／`restore` 是一組雙向轉換，一起落地）。
4. Admin 進入 demand review，publish / reject（`organizer-demand-request-foundation` V1：demand cancel 不在本輪 scope，見 Non-goals）。
5. Admin 查看 class sessions，協助確認或取消。
6. Admin 查看 enrollments，協助確認或取消；attended / no_show 保留為 future 或 admin-only 後續能力。
7. 重要管理動作可留下 admin note。

## UI Requirements

- Admin dashboard 要優先呈現待處理事項。
- Review list 要能依 status 篩選。
- 每個 destructive 或 negative action 需確認，例如 reject、suspend、cancel。
- Teacher reject 時需填寫**必填**的 rejection reason（trim 後 10–1000 字），且 UI 需明示「此說明會顯示給老師」；此 reason 是 teacher-facing，與內部 admin note 分離。
- Teacher suspend 時同樣需填寫**必填**的 suspension reason（trim 後 10–1000 字），UI 需明示「此說明會顯示給老師」；此 reason 保存於 `TeacherProfile.suspensionReason`，獨立於 `rejectionReason`（`teacher-profile-suspension` 已確認）。restore 不需要填寫原因，只需二次確認。
- Demand reject 時同樣需填寫**必填**的 rejection reason（trim 後 10–1000 字），UI 需明示「此說明會顯示給團主」；此 reason 是 organizer-facing，保存於 `DemandRequest.rejectionReason`，與內部 admin note 分離（`organizer-demand-request-foundation` 已確認）。
- Admin note 不應顯示給一般使用者。（注意：teacher-facing 的 rejection reason 保存於 `TeacherProfile.rejectionReason`、organizer-facing 的 rejection reason 保存於 `DemandRequest.rejectionReason`，兩者皆顯示給對應當事人，不屬於 internal admin note。）
- Admin UI 要清楚但不需要華麗，不做過度複雜的後台。

## Data Requirements

主要資料：

- `TeacherProfile`
- `DemandRequest`
- `DemandResponse`
- `ClassSession`
- `Enrollment`
- `Organization`
- `AdminNote`（`organizer-demand-request-foundation` 本輪不建立此 model；demand reject reason 走 `DemandRequest.rejectionReason` 專用欄位）
- `Notification`（demand 相關通知在 `organizer-demand-request-foundation` V1 延後，見 State Transitions）

## Permission Requirements

- 只有 Admin 可以進入 `/admin/*`。
- 所有 Admin action 仍需 server-side permission check。
- Admin 可查看管理資料，但不應把敏感資料暴露給不需要的角色。
- Admin action 應符合 state transition rules。

## State Transitions

Admin 可觸發：

- `TeacherProfile`: `submitted → approved/rejected`、`approved ↔ suspended`（`teacher-profile-suspension` 已確認：雙向轉換，不是只有 `approved → suspended` 單向）。`submitted → rejected` 需保存 teacher-facing rejection reason 於 `TeacherProfile.rejectionReason`（必填、trim 後 10–1000 字）；`rejected → submitted` 與 `approve` 時清空該 reason。`approved → suspended` 需保存 teacher-facing suspension reason 於 `TeacherProfile.suspensionReason`（必填、trim 後 10–1000 字，獨立欄位）；`suspended → approved` 時清空。兩組 reason 都額外新增獨立的 `Notification` 記錄（`teacher_application_rejected`／`teacher_profile_suspended`／`teacher_profile_restored`），V1 站內顯示，不寄 email。
- `DemandRequest`: 完整最終設計為 `submitted → under_review → published/rejected`；**`organizer-demand-request-foundation` V1 已接線範圍**只有 `submitted → published/rejected`，**跳過 `under_review`**（Admin 直接一次決策，對齊 TeacherProfile 的 `submitted → approved/rejected` 簡化先例）。`submitted → rejected` 需保存 organizer-facing rejection reason 於 `DemandRequest.rejectionReason`（必填、trim 後 10–1000 字）；`rejected` 為**終局狀態**，不提供 resubmit，reason 寫入後永久保留。V1 以站內 status 顯示告知 organizer，email 為後續切片 `organizer-demand-notification`。
- `DemandResponse`: `submitted → shortlisted/selected/declined`
- `ClassSession`: `draft → pending_confirmation → open_for_enrollment → confirmed → completed/cancelled`
- `Enrollment`: `pending → confirmed/cancelled`

`attended` / `no_show` 不作為 V1 完整 Teacher attendance workflow，只保留為 future 或 admin-only 後續能力。

## RWD Requirements

- Admin dashboard 至少支援 tablet 與 desktop。
- 重要審核動作在手機上若提供，需避免誤觸。
- Lists 在小螢幕可改為 cards 或簡化欄位。

## Acceptance Criteria

- Admin 可以查看待審老師。
- Admin 可以 approve、reject、suspend、restore teacher；reject 需填寫必填 rejection reason（trim 後 10–1000 字），reason 保存於 `TeacherProfile.rejectionReason` 並顯示給該老師；suspend 同樣需填寫必填 suspension reason（trim 後 10–1000 字），保存於 `TeacherProfile.suspensionReason` 並顯示給該老師；restore 只需二次確認，會清空 suspension reason（`teacher-profile-suspension` 已確認）。
- Admin 可以查看待 review（`submitted`）demand requests，且每筆可見足以評估的完整內容（demand 全欄位 + 所連 organization + organizer displayName），不只是 title。
- Admin 可以 publish 或 reject demand request；reject 需填寫必填 rejection reason（trim 後 10–1000 字）並經真正的二次確認，reason 保存於 `DemandRequest.rejectionReason` 並顯示給該 organizer。
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
- **`organizer-demand-request-foundation` 這一輪額外明確不做**：demand `under_review` transition、demand cancel/expire flow、`AdminNote` model 落地、demand email/notification（V1 以站內顯示告知）。

## Risks

- Admin route 若未保護會造成重大安全問題。
- Admin action 若不檢查 state transition，會讓 marketplace 資料不一致。
- Admin dashboard 若太大，會拖慢 V1 開發。
