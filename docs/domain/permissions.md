# Permissions

## Permission Principles

- Users can only access their own private data unless role permits otherwise.
- Admin can access all management data.
- Teachers only see eligible demand requests.
- Organizers only manage their own demands/classes.
- Members only manage their own enrollments.
- User is the base account, and every authenticated user has basic Member capabilities.
- Teacher capabilities are enabled by TeacherProfile.
- Organizer capabilities are enabled by OrganizerProfile.
- Admin is a platform management permission.
- V1 does not restrict one user to only one identity.

## Visitor

Can:

- View public marketing pages
- View public teacher profile if enabled
- **View public class session（已落地，`teacher-initiated-open-classes` Slice D 已確認）**：`/classes` 公開列表與 `/classes/[id]` 詳情，僅限 `isPublic=true`、狀態符合、且授課老師 `status=approved` 的課程；不符合公開條件（含 `isPublic=false`／`draft`／老師已被暫停）一律回傳 not-found，不揭露存在性差異。看到的欄位是窄選過的 visitor-safe DTO，不含任何內部關聯 id。
- Submit public forms if allowed

Cannot:

- Access dashboards
- **Enroll without required identity flow**：即使能看到公開課程詳情，頁面上不渲染報名表單，只提供「登入後報名」導向登入（帶 callback 導回原頁面）；報名建立本身（`createOwnEnrollment`）仍無條件要求登入，這條規則沒有被放寬。
- View private demand requests

## Member

Can:

- View own profile
- Enroll in class sessions
- View own enrollments
- Cancel own enrollment if policy allows

Cannot:

- Manage demand requests
- Respond as teacher
- View other members' private data

## Organizer

`organizer-demand-request-foundation` D1 已確認：任何 signed-in user（Member 基本能力）皆可自助建立自己的 `OrganizerProfile` + `Organization` 以取得 Organizer 能力，不需要 Admin 指派或審核（比照 Teacher 的 onboarding 模式）；建立後即受下列規則約束，僅能管理自己的 own 資料。

Can:

- Create own OrganizerProfile / Organization（bootstrap，任何 signed-in user）
- Create demand requests
- View own demand requests
- Edit own draft/submitted demand requests if allowed
- View teacher responses to own demand requests
- Manage own class roster basics
- Enroll in class sessions only through the same User's Member capability

Cannot:

- See other organizers' private demand requests
- Approve teachers
- Modify teacher profiles
- Manage platform-wide data

## Teacher

Can:

- Edit own teacher profile
- Set own availability
- View published/eligible demand requests
- Respond to eligible demand requests
- **Create own class sessions directly（已落地，`teacher-initiated-open-classes` 已確認）**：approved 老師不需要等團主媒合，可以自己開單堂、常規（每週固定星期）或固定期課程；own-scoped 取消/開放報名/標記完成，走平行於既有 Organizer 版本的核心，不共用擁有權過濾邏輯。任何建課路徑（自建或團主媒合）都會檢查是否跟自己其他課程時段衝突。
- **Optionally require approval for new enrollments on own-created classes（已落地，Gate G2/G3）**：可在建課時選擇「需要我確認才算報名成功」，對應的 `pending` 報名需要老師在 `/teacher/classes` 明確確認或拒絕，受 `startAt` 時間邊界限制。
- View own class sessions（含團主媒合與自建兩種來源，統一列表顯示來源徽章）
- View own calendar
- Enroll in class sessions only through the same User's Member capability

Cannot:

- View private organizer data unless tied to a matched demand/class
- Manage enrollments outside own class sessions
- Approve self
- Access admin dashboard
- Create class sessions while own `TeacherProfile.status` is not `approved`（含 `suspended`）——資格檢查與既有 demand-response 資格檢查同等嚴格

## Admin

Can:

- Approve/reject/suspend teachers
- Review/publish/reject demand requests
- Manage class sessions
- Manage enrollments
- View basic KPIs
- Add admin notes

## Security Review Required

Security review required when changing:

- Auth
- Roles
- Permissions
- Demand visibility
- Admin actions
- Teacher approval
- Enrollment capacity
- Payment-related code

**`teacher-initiated-open-classes` 直接 touch 到其中兩項（已過一輪 review，非跳過）**：`enrollment capacity`（`pending`＋`confirmed` 合計佔用名額的計算條件變更）、`teacher approval`（新增的老師自建課程資格檢查，與既有 demand-response 資格檢查同等嚴格，suspended 老師無法繞過；資格檢查用 `TeacherProfile` row 鎖避免跟 Admin suspend 的 TOCTOU 競態）。
