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
- **View public class session（已落地，`teacher-initiated-open-classes` Slice D 已確認）**：`/classes` 公開列表與 `/classes/[id]` 詳情，僅限 `isPublic=true`、狀態符合、且授課老師 `status=approved` 的課程；不符合公開條件（含 `isPublic=false`／`draft`／老師已被暫停）不揭露存在性差異：organizer-usability-redesign 票 13 起，`/classes/[id]` 對這些情況（以及不存在的 id、已取消）一律顯示同一個通用登入引導，不再回 not-found；登入後依 Member 規則讀取。可見範圍不變。看到的欄位是窄選過的 visitor-safe DTO，不含任何內部關聯 id。
- Submit public forms if allowed
- **已落地（`teacher-showcase-photos` 票 06，2026-10-10）：View a public teacher page**：不用登入即可看老師自己選擇公開、且審核通過的老師頁（`/teachers/[id]`）；不會看到任何私人欄位（email、電話、收款資訊、聯絡方式、價格區間）

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
- **已落地（`lightweight-payment-v0`，2026-10-10）：Write own transfer note**：已報名且尚未付款的學員可填寫自己報名的「轉帳後五碼或備註」（單行、最多 100 字、純文字；原子條件更新，老師標記已收款後不能再改）；只能寫自己的報名，也只能看到自己報名的付款狀態與報名當下快照，看不到老師的內部收款備註
- **已落地（`teacher-class-scheduling` 票 08，2026-10-09）：Enroll in a whole term（報名整期）**：學員本人（userId 由 session 解析，不接受表單傳入）可以報名期班整期。期班頁可見性比照單堂：訪客只看得到公開、老師已通過審核且有已開放場次的期班；已登入學員拿到連結就能看（至少一場已開放或已完成），或自己已有整期報名。期班頁只逐場列出已開放、已完成的場次，草稿只計入堂數。報名規則與鎖都在 server 端（見 `data-model.md` 的 `SeriesEnrollment`）；「只收整期」的期班，單場報名 server 端拒絕。
- **已落地（`teacher-class-scheduling` 票 09，2026-10-09）：Take leave / withdraw from own term**：整期學員取消其中一堂（請假）沿用既有本人取消規則；退出整期只能由本人操作（整期報名的 userId 寫在鎖查詢 WHERE），取消尚未開始的場次，已開始或完成的紀錄保留；不另外通知老師。

Cannot:

- Manage demand requests
- Respond as teacher
- View other members' private data
- **Self-mark payment as paid（`lightweight-payment-v0`）**：學員只能填轉帳備註，不能自行把付款狀態改成已付款

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
- **已核准・未實作（organizer-usability-redesign，Q18：A）**：建立並管理多個自己擁有的團體（owner 判斷）；為自己的團體建立合作邀請、選平台 approved 老師、修改／撤回尚未轉課的邀請；老師確認後直接開放報名（`organizer_direct`）。本人也是 approved 老師時，可以在團主表單明確確認由自己授課。細節見 `permissions-matrix.md` 的 OrganizerClassProposal 表。

Cannot:

- **已落地（`lightweight-payment-v0`，2026-10-10）：Change payment status**：團主對自己課程報名的付款狀態**唯讀**（只看得到報名狀態、付款狀態與時間，含已取消但有付款紀錄的報名），不能標記，也看不到收款備註、轉帳備註、收款帳號、聯絡方式、繳費規則快照與操作者；這些欄位的查詢與 DTO 一律不選取

- See other organizers' private demand requests
- Manage organizations owned by other organizers, or transfer / co-manage organizations（V1 不做）
- Confirm a proposal on behalf of the invited teacher
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
- **Read own data for dashboard/form defaults（`teacher-usability` 第 07、09 票，2026-09-26）**：建課表單帶入自己最近一堂自建課的地點、名額、是否需確認報名；總覽列出自己「已被選定、等待團主建課」的回應（只有需求 id 與標題）。兩者都是 own-scoped 讀取（`teacherProfileId` 寫在 WHERE），沒有新增能力或可讀的他人資料。
- **View own single class session detail（`teacher-usability` 第 05 票，產品主人 2026-09-25 放行）**：老師只能讀自己的單堂課詳情（範圍與上方列表完全相同，未新增可讀欄位：只含 confirmed／pending 報名的學員姓名、email、備註，評價者姓名與 email，Organization 只有名稱、無團主聯絡資料，無學員電話與頭像）；別人的課、不存在、沒有老師資料一律回傳找不到；suspended 老師仍可查看自己既有的課。own-scope 寫在查詢 WHERE，不是事後比對。
- View own calendar
- **已落地（`teacher-showcase-photos` 票 06，2026-10-10）：Publish own teacher page**：approved 老師可以自己開啟或關閉公開老師頁（預設關閉，隨時可關，立即生效）；suspended 老師不能變更，且暫停期間公開頁一律看不到
- **已落地（`teacher-showcase-photos` 票 04，2026-10-10）：Set cover photo on own classes**：老師可在建課與改課時，為自己的單堂課選一張自己的有效照片當封面（或直接上傳新照片，新照片進入照片庫並算在 5 張上限內）；系列的封面是整個系列共用。只能用自己的照片、只能改自己的課，伺服器端檢查；封面失敗不會讓課程建立失敗，只在訊息後補一句說明
- **已落地（`teacher-showcase-photos` 票 02、03，2026-10-10）：Manage own photos**：approved 老師可上傳、刪除、排序自己的照片（最多 5 張有效照片）並指定頭像；只能操作自己的照片；suspended 老師只能查看；其他狀態看不到上傳區。檔案存放與規則見 ADR 0007
- **已落地（`lightweight-payment-v0`，2026-10-10）：Manage own payment settings**：approved／suspended 老師在 `/teacher/profile/payment` 維護自己的收款帳號、繳費規則與聯絡方式（獨立於個人資料審核流程）
- **已落地（`lightweight-payment-v0`，2026-10-10）：Mark own class enrollments paid / refunded**：老師只能對**自己班級**（`classSession.teacherProfileId`）底下的報名標記已收款或已退款（含整期學員一次標記整期）；已取消的報名只能標記已退款，不能標記已收款；金錢不經過飛索，標記只是記錄
- Enroll in class sessions only through the same User's Member capability
- **已落地（`teacher-class-scheduling` 票 04，2026-10-05）：Edit own single class session（改課）**：approved 老師可以修改自己開的單堂課（`origin = teacher_initiated`、不屬於系列、`draft`／`open_for_enrollment`、`startAt` 尚未到達）的標題、說明、課程風格、瑜伽類型、時間、地點與人數上限。所有條件都在 server 端檢查（own-scope 寫在鎖查詢的 WHERE、origin 與狀態在鎖內確認、老師狀態在鎖內讀取），不只靠 UI 隱藏。改時間或地點時通知該場 `pending`／`confirmed` 學員；不能改「是否需要確認報名」；不能改團主媒合的課；暫停中的老師不能改。系列場次的改課在票 05，公開設定的修改在票 06。
- **已落地（`teacher-class-scheduling` 票 05，2026-10-05）：Edit own series class sessions（系列改課）**：approved 老師可以改自己系列中尚未開始的場次，選「只改這場」或「改這場和之後所有場次」（後者同時更新自己的 `RecurringClassSeries` 設定）。系列 own-scope 寫在系列鎖查詢的 WHERE，每一場的條件（屬於這個系列、`teacher_initiated`、`draft`／`open_for_enrollment`、未開始）在鎖內重新檢查；不能改星期幾與「是否需要確認報名」。（票 05 當時也不能改公開設定；**票 06 起可以改公開設定**，持續開課依改課範圍套用；**票 07 起期班的公開設定整期一致**，不論範圍都套用到這一期所有尚未開始的草稿／開放場次與系列，先鎖系列再依 id 鎖場次。）
- **已落地（`teacher-class-scheduling` 票 10，2026-10-09）：Confirm / decline own term enrollments（整期報名）**：老師只能讀、確認、婉拒自己期班的整期報名（系列 `teacherProfileId` 寫在讀取與鎖查詢的 WHERE）。整期名單只含學員姓名或 email、狀態、備註、請假日期，與單場名單同一範圍。屬於整期的逐場報名不能在單場個別確認／婉拒。
- **已核准・未實作（organizer-usability-redesign）**：查看自己收到的團主合作邀請，確認最新版本或附原因婉拒；確認需要 `approved` 且排課無衝突。確認授課不會取得團主課程的開放、修改、取消、完成或名單管理權。同一個帳號可以另外建立團主資料與團體，approved 資格只限制授課、不限制建團。

Cannot:

- View private organizer data unless tied to a matched demand/class
- Manage enrollments outside own class sessions
- Approve self
- Access admin dashboard
- Create class sessions while own `TeacherProfile.status` is not `approved`（含 `suspended`）——資格檢查與既有 demand-response 資格檢查同等嚴格
- **已落地（`teacher-class-scheduling` 票 04，推導規則 11）**：Open own class sessions for enrollment while own `TeacherProfile.status` is not `approved`——老師端單場「開放報名」的 `updateMany` 條件已帶老師 `approved`，暫停中的老師無法開放。（系列的「全部開放報名」在票 01 已檢查。）
- **已落地（`teacher-class-scheduling` 票 04）**：Edit class sessions that are not own `teacher_initiated`, have started, are `completed`／`cancelled`, or change `requiresApproval`
- **organizer-usability-redesign 票 09**：Open / cancel / complete class sessions whose `origin` is not `teacher_initiated` through teacher-side services——open、cancel、complete 都已在 server 端檢查 origin（已落地，系列的全部開放與從這場起取消也一併限定）

## Admin

Can:

- **已落地（`teacher-showcase-photos` 票 07，2026-10-10）：Remove any teacher photo**：管理員可以下架任何老師的任何一張有效照片（原因必填），立即從所有頁面消失、頭像與課程封面一併拿掉，老師收到站內通知（不寄 email）；V1 沒有「恢復照片」，老師可以重新上傳
- **已落地（`lightweight-payment-v0`，2026-10-10）：Mark any enrollment paid / refunded**：Admin 可跨老師標記已收款或已退款，作為支援與糾紛協調；操作者角色記為 `admin`，與老師標記分開
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

**`teacher-class-scheduling` 票 07–08 touch 到 `Permissions`、`Enrollment capacity`（2026-10-09，產品主人一次性放行）**：票 07 只新增系列型態與期班報名方式（own-scoped 建立，期班拒絕生成更多在系列鎖內檢查），期班公開設定整期一致的批次更新沿用老師 own-scope 鎖查詢。票 08 新增學員 own-scoped 整期報名：名額在場次鎖內檢查（`pending + confirmed` 合計）、鎖順序系列 → 場次 → 老師、老師資格在鎖內讀取；屬於整期的逐場報名老師不能個別確認／婉拒（`seriesEnrollmentId IS NULL` 寫在 updateMany 條件）。

**`teacher-class-scheduling` 票 04 touch 到 `Permissions`、`Teacher approval`、`Enrollment capacity` 三項（2026-10-05 開工前 review，見 `docs/superpowers/plans/teacher-class-scheduling/tickets/04-single-class-edit.md` 的「開工前安全檢查」）**：新增老師 own-scoped 改課；單場開放報名補上 approved 檢查；人數上限調小時須在課程鎖內與報名數比對，不得低於 `pending + confirmed`。

**`teacher-initiated-open-classes` 直接 touch 到其中兩項（已過一輪 review，非跳過）**：`enrollment capacity`（`pending`＋`confirmed` 合計佔用名額的計算條件變更）、`teacher approval`（新增的老師自建課程資格檢查，與既有 demand-response 資格檢查同等嚴格，suspended 老師無法繞過；資格檢查用 `TeacherProfile` row 鎖避免跟 Admin suspend 的 TOCTOU 競態）。
