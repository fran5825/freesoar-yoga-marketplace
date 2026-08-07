# Permissions Matrix

## 目的

本文件用矩陣方式整理 Free Soar Yoga V1 的 capability、resource、action 權限。

詳細實作時，所有權限都應在 server-side 檢查。Client UI 只負責隱藏或提示，不可作為安全依據。

## Role Model

V1 採用能力模型，而不是限制一個 `User` 只能有一種身分：

- `User` 是基本帳號。
- 所有登入者預設具備 Member 基本能力。
- Teacher 能力由 `TeacherProfile` 開啟。
- Organizer 能力由 `OrganizerProfile` 開啟。
- Admin 是平台管理權限。
- Teacher 或 Organizer 若要報名課程，是用同一個 `User` 的 Member 能力報名，不是用 Teacher / Organizer 權限報名。

矩陣中的 `Teacher` 與 `Organizer` 代表該 User 已具備對應 profile 能力；`Visitor` 代表未登入使用者。

## Legend

| 符號 | 意義 |
|---|---|
| Yes | 可執行 |
| Own | 僅限自己的資料或所屬資料 |
| Eligible | 僅限符合條件且已公開的資料 |
| Admin | 僅 Admin 可執行 |
| No | 不可執行 |

## Public Pages

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View marketing pages | Yes | Yes | Yes | Yes | Yes |
| View public teacher profile | Yes | Yes | Yes | Yes | Yes |
| View public class session | Yes | Yes | Yes | Yes | Yes |
| Submit public inquiry form | Yes | Yes | Yes | Yes | Yes |

公開資料仍需遵守 visibility policy；不是所有 teacher profile 或 class session 都一定公開。

公開 class session 僅限 `open_for_enrollment` 或 `confirmed`，且已標記可公開。**已落地（`teacher-initiated-open-classes` Slice D 已確認）**：`/classes` 與 `/classes/[id]`，額外要求授課老師 `status = approved`（不在這條規則落地前就已經是完整未來設計的一部分，是這一輪新增的必要條件——沒有這條會讓已被暫停老師的舊公開課程繼續留在列表與可報名狀態）。

## User / Account

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create account | Yes | No | No | No | Admin |
| View own account | No | Own | Own | Own | Own |
| Edit own account | No | Own | Own | Own | Own |
| View all users | No | No | No | No | Admin |
| Grant admin permission | No | No | No | No | Admin |

## TeacherProfile

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public approved profile | Yes | Yes | Yes | Yes | Yes |
| Create teacher profile | No | No | No | Own | Admin |
| Edit teacher profile | No | No | No | Own | Admin |
| Submit for review | No | No | No | Own | Admin |
| Approve profile | No | No | No | No | Admin |
| Reject profile | No | No | No | No | Admin |
| Suspend profile | No | No | No | No | Admin |
| Restore profile | No | No | No | No | Admin |

Teacher 不可 approve 自己。Suspended teacher 不可公開顯示，也不可回應新 demand request。

**V1 落地範圍（`teacher-profile-suspension` 已確認）**：`Suspend profile` 這一列過去長期沒有對應的落地範圍註記，容易被誤讀成早就是 V1 功能——實際上直到本輪之前，整個 repo 沒有任何程式碼會把 `TeacherProfile.status` 寫成 `suspended`。本輪把 `Suspend profile` 與新增的 `Restore profile` 一起接線：兩者都是 Admin-only，`Suspend` 必填 `suspensionReason`（trim 後 10–1000 字，獨立於 `rejectionReason` 的欄位），`Restore` 只能從 `suspended` 觸發並清空該欄位。連帶影響：`demand-response-and-matching-spec.md` 的 `Select response` 動作現在也會檢查該 response 所屬老師是否仍是 `approved`，暫停後既有的 `submitted` response 無法再被選定。

**V1 落地範圍（`teacher-profile-edit` 已確認）**：`Edit teacher profile` 這一列的 `Own`（Teacher）不是無條件的——只有 `approved` 才能編輯（`/teacher/profile`，重用送審時的必填規則）；`suspended` 只能唯讀查看，不能編輯；`draft`／`submitted`／`rejected` 沿用既有 `/teachers/join` 的既有流程，不受這輪影響。`Admin` 欄位仍是上表所描述的完整未來設計，V1 本輪未開放（沒有任何頁面讓 Admin 代編輯老師的 `TeacherProfile`）；Admin 目前只能在 `/admin/teachers` 唯讀查看老師的完整欄位內容與最後更新時間（見 `data-model.md` 的 Edit 說明），不能代為修改。

## TeacherAvailability

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public availability summary | No | No | Eligible | Own | Admin |
| Create availability | No | No | No | Own | Admin |
| Edit availability | No | No | No | Own | Admin |
| Delete availability | No | No | No | Own | Admin |

Organizer 只能在已媒合或合適流程中看到必要的可約時間，不應看到老師完整私人排程。

**V1 落地範圍（`teacher-availability`、`teacher-availability-edit` 已確認）**：目前只落地 Teacher 欄位這一直行，且比上表更細緻——`View own` 不分 `TeacherProfile` 狀態，任何狀態（含 `suspended`）都可以查看自己既有的固定時段與例外（比照既有 `suspended` 可唯讀查看自己 demand response 的先例）；`Create`／`Edit`／`Delete` 僅限 `approved` 才能操作（`suspended` 只能看不能寫）。`Edit` 已落地（`teacher-availability-edit` 已確認）：整筆覆寫，驗證規則跟 `Create` 完全一致，own-scope 防護（`updateMany` 帶 `teacherProfileId` 篩選）也跟 `Delete` 完全同一個模式。Organizer 的「Eligible」與 Admin 欄位仍是上表所描述的完整未來設計，V1 本輪未開放（沒有任何頁面讓 Organizer 或 Admin 查看老師的 availability）。

## Organization / OrganizerProfile

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create organization | No | No | Own | No | Admin |
| View organization | No | No | Own | Eligible | Admin |
| Edit organization | No | No | Own | No | Admin |
| Create organizer profile | No | No | Own | No | Admin |
| Edit organizer profile | No | No | Own | No | Admin |

Teacher 只有在 published demand 或 matched class 需要時，才可看到必要的 organization 資訊。

**Organizer capability bootstrap 例外**（`organizer-demand-request-foundation` D1 已確認）：`Create organizer profile` 這一列的「Organizer=Own」在建立當下有一個先天的循環——建立前這位 user 還不具備 Organizer 能力。比照 `TeacherProfile` 既有的 onboarding 模式，V1 明確允許：**任何 signed-in user（Member 基本能力）皆可自助建立自己的 `OrganizerProfile` + `Organization`**（不需要 Admin 指派或審核），建立後即具備 Organizer 能力，且僅能管理自己的 own 資料。此例外只適用於「建立」動作本身；建立後的 `View` / `Edit organization` / `Edit organizer profile` 仍嚴格限定 Own。對應的 route 層例外見 `docs/product/route-map.md` 的 `/organizer/profile` 標注。

**V1 落地範圍（`organizer-profile-edit` 已確認）**：`Edit organizer profile` 這一列的 `Own`（Organizer）已落地——只有 `displayName` 這一個欄位，沒有狀態機也沒有狀態閘門（`OrganizerProfile` 不像 `TeacherProfile` 有 draft/approve/suspend，建立當下就是可用狀態），任何已建立 `OrganizerProfile` 的使用者都能隨時編輯。`Admin` 欄位仍是完整未來設計，V1 未開放（沒有任何頁面讓 Admin 代編輯 Organizer 的 `displayName`）。

**V1 落地範圍（`admin-organizations` 已確認）**：`View organization` 這一列的 `Admin` 已落地，但只是**唯讀**——`/admin/organizations` 讓 Admin 查看全平台所有 organization（名稱、類型、聯絡資訊、所屬 organizer 清單、需求與課程數量），依名稱字母排序。`Edit organization` 這一列的 `Admin` 仍是明確 Non-goal，V1 未開放（沒有任何頁面讓 Admin 編輯或代管 organization 資料）。

## DemandRequest

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create demand request | No | No | Own | No | Admin |
| View draft demand request | No | No | Own | No | Admin |
| View submitted demand | No | No | Own | No | Admin |
| View published demand | No | No | Own | Eligible | Admin |
| Edit draft demand | No | No | Own | No | Admin |
| Submit demand | No | No | Own | No | Admin |
| Publish demand | No | No | No | No | Admin |
| Reject demand | No | No | No | No | Admin |
| Cancel demand | No | No | Own | No | Admin |

Organizer 不可查看其他 organizer 的私人 demand request。

**V1 落地範圍**（`organizer-demand-request-foundation`、`demand-request-cancellation` 已確認）：`under_review` 狀態本輪不接線（見 `state-transition-details.md`），故上表已將原「View submitted / under review demand」併為「View submitted demand」。**`Cancel demand` 僅 Organizer own-scoped 可執行**（`demand-request-cancellation` D1，Admin 不介入——修正原本標記為不接線的敘述，這條動作已在 `demand-request-cancellation` 落地；可從 `draft`/`submitted`/`published`/`matched` 觸發，明確排除 `converted_to_class`，並連帶取消該 demand 底下所有 `submitted`／`selected` 的 `DemandResponse`，見 `state-transition-details.md`）。

## DemandResponse

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create response | No | No | No | Eligible | Admin |
| View own response | No | No | No | Own | Admin |
| View responses to own demand | No | No | Own | No | Admin |
| Edit response before selected | No | No | No | Own | Admin |
| Withdraw response before selected | No | No | No | Own | Admin |
| Shortlist response | No | No | Own | No | Admin |
| Select response | No | No | Own | No | Admin |
| Decline response | No | No | Own | No | Admin |

V1 一個 demand request 只能有一個 selected response。

**V1 落地範圍**（`demand-response-selection-and-matching`、`teacher-profile-suspension` 已確認）：`Select response` 僅 Organizer own-scoped 可執行，**Admin 不介入**（D2，上表 Admin 欄位為完整未來設計，V1 未開放）；`Decline response` 在 V1 不是獨立的 Organizer 手動動作，而是 select 成功時同一 transaction 內自動處理（D3），沒有對應的手動操作入口；`Shortlist response` 本輪不實作（D1），保留於表中作為未來 slice 參考（對齊上方 `Cancel demand` 的既有註記慣例）。`Select response` 額外要求該 response 所屬的 `TeacherProfile.status = 'approved'`（`teacher-profile-suspension` 已確認）——暫停中的老師既有的 `submitted` response 無法再被選定。

## ClassSession

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public class session | Yes | Yes | Yes | Yes | Yes |
| View private class session | No | Own | Own | Own | Admin |
| Create class session from matched demand | No | No | Own | No | Admin |
| Create own class session directly（不需媒合） | No | No | No | Own | No |
| Edit draft class session | No | No | Own | No | Admin |
| Open for enrollment | No | No | Own | Own | Admin |
| Cancel class session | No | No | Own | Own | Admin |
| Complete class session | No | No | Own | Own | Admin |

Teacher 可查看自己的 class session；下方「V1 落地範圍」對 Complete/Cancel 兩列有修正說明。

**V1 落地範圍**（`class-session-creation`、`enrollment`、`class-session-cancellation`、`class-session-completion` 已確認）：`Create class session from matched demand` 僅 Organizer own-scoped 可執行，**Admin 不介入**（D1，上表 Admin 欄位為完整未來設計，V1 未開放）；`Edit draft class session` 本輪不實作（D2，一次到位建立、建立後不可編輯）；**`Open for enrollment` 僅 Organizer own-scoped 可執行**（`enrollment` D2，Admin 不介入，且 `startAt` 已過不可開放，D14）；**`Cancel class session` Organizer own-scoped 或 Admin 皆可執行**（`class-session-cancellation` D1；`startAt` 已過不可取消，D2；取消可從 `draft` 或 `open_for_enrollment` 觸發，並連帶取消該課程底下所有 `confirmed` 的 Enrollment，見 `state-transition-details.md`——**修正（`admin-class-enrollment-management` 已確認）：Admin 版取消已落地**，`/admin/classes/[classSessionId]` 提供跟 Organizer own-scoped 版本完全相同資格條件的取消能力，只是不檢查擁有權；不記錄取消原因、不做「協助補齊必要資訊」或泛用的「變更 status」，這兩項刻意窄於 `docs/product/admin-mvp-spec.md` 原始描述的範圍，理由見該文件的落地現況說明）；**`Complete class session` 僅 Organizer own-scoped 可執行**（`class-session-completion` D1，Admin 不介入——修正原本標記為不接線、且誤寫成 Admin-only 的敘述，這條動作已落地；只能從 `open_for_enrollment` 觸發，且 `endAt` 必須已經過去，時間方向與 Cancel／Open for enrollment 相反；不連帶處理 Enrollment，也不觸發新的 Notification）。`View private class session` 的 Teacher 欄位在 V1 不受 approved 狀態限制（`class-session-creation` D15，比照 View own response 的既有唯讀先例）。**`admin-class-enrollment-management` 一輪同時新增了 Admin 唯讀查看全平台所有 class session（含完整 roster）的能力**，不在上表的動作清單裡（上表只列會員資格檢查的動作，純讀取沒有獨立一列），見 `/admin/classes`／`/admin/classes/[classSessionId]`。

**V1 落地範圍（`teacher-initiated-open-classes` 已確認）**：新增 `Create own class session directly` 這一列——approved 老師可以自己開單堂、常規（每週固定星期）或固定期課程，不需要團主媒合，own-scoped，Admin 不介入（沒有 Admin 專用的老師建課入口）；建立時檢查自己的 `TeacherProfile.status = 'approved'`，並套用跨 origin 共用的雙重預約衝突檢查（見 `data-model.md` 的 `ClassSession` 說明）。`Open for enrollment`／`Cancel class session`／`Complete class session` 這三列的 **Teacher 欄位從 No 改為 Own**——但只對自己 `origin = teacher_initiated` 的課程有實際 UI 入口（`/teacher/classes` 只在來源是老師自建時才顯示對應按鈕），底層 own-scoped 函式本身不分來源（用 `teacherProfileId` 過濾，即使誤呼叫也不會動到別人或團主媒合的課程，只是刻意不在 UI 上對團主媒合課程顯示這些按鈕，避免混淆兩種來源的操作邊界）。老師自建課程額外支援「需要老師確認才算報名成功」（`requiresApproval`），見下方 `Enrollment` 表的 `Confirm enrollment`／`Decline enrollment` 兩列。

## RecurringClassSeries

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create series（常規或固定期） | No | No | No | Own | No |
| View own series detail | No | No | No | Own | No |
| Generate more occurrences（僅常規模式） | No | No | No | Own | No |
| Cancel entire series | No | No | No | Own | No |

**V1 落地範圍（`teacher-initiated-open-classes` Slice B 已確認，Gate G1/G4）**：全部 own-scoped，Organizer／Admin 完全不介入（沒有團主或 Admin 專用的常規課程管理入口）。`Generate more occurrences` 只對「每週固定」模式的系列有意義（`dayOfWeek` 不是 `null`）；固定期課程（明確日期清單）的日期在建立當下一次到位，沒有「延伸」的概念，UI 上也不會顯示這個動作。`Cancel entire series` 只影響該系列底下尚未開始、狀態為 `draft`／`open_for_enrollment` 的場次，已開始或已完成的場次不受影響；series 這一列本身不會被刪除，之後仍可用 `Generate more occurrences` 生成新的未來場次。三個動作的 own-scope 檢查方式跟 `ClassSession` 一致：查詢的 `WHERE` 子句本身帶 `teacherProfileId` 過濾，不是先讀後比對。

## Enrollment

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create enrollment | No | Own | Member capability only | Member capability only | Admin |
| View own enrollment | No | Own | Member capability only | Member capability only | Admin |
| View class roster basics | No | No | Own | Own | Admin |
| Cancel own enrollment | No | Own | Member capability only | Member capability only | Admin |
| Confirm enrollment | No | No | No | Own | Admin |
| Decline enrollment | No | No | No | Own | Admin |
| Mark attended / no_show | No | No | No | No | Admin |

同一 user 不可重複報名同一 class session。Confirmed enrollments 不可超過 capacity——**已擴充（Gate G3 = A）：`pending` 與 `confirmed` 合計不可超過 capacity**，不是只算 `confirmed`。

V1 不做完整 Teacher attendance workflow；`attended` / `no_show` 可保留為 future 或 admin-only 後續能力。

**V1 落地範圍**（`enrollment` 已確認）：`Create enrollment`／`View own enrollment`／`Cancel own enrollment` 皆 Member own-scoped（任何登入使用者皆有 Member 能力，不需要額外的 profile model，D2 精神延續自既有 route-map 慣例）；`View class roster basics` Organizer／Teacher own-scoped，只回傳 `confirmed`／`pending` enrollment 的最小必要識別資訊（`User.name` 為 null 時 fallback 至 `email`）與 `notes`，不含 `phone`/`image`；`Mark attended / no_show`（D11）本輪不接線；~~Admin 不介入（D10，上表 Admin 欄位為完整未來設計，V1 未開放）~~——**修正（`admin-class-enrollment-management` 已確認）：Admin 現在可以取消任何一筆 `confirmed`／`pending` enrollment**，資格條件跟 Member 自助取消完全相同（`classSession.startAt` 尚未到達），只是不檢查 `userId` 擁有權；`/admin/classes/[classSessionId]` 的 roster 額外顯示 `status`（含 `cancelled`），比 Organizer own-scoped 版本的 roster 更完整，讓 Admin 能看到歷史取消紀錄；`Mark attended / no_show` 仍然不接線，`/admin/enrollments` 這個獨立路由本輪決定不建（見 `route-map.md`）。

**V1 落地範圍（`teacher-initiated-open-classes` 已確認，Gate G2/G3）**：新增 `Decline enrollment` 這一列；`Confirm enrollment` 的 Teacher 欄位從 No 改為 Own——老師只能確認/拒絕**自己課程**收到的 `pending` 報名（own-scoped，透過 `classSession.teacherProfileId` 過濾，不分課程來源），且受 `startAt` 時間邊界限制（跟既有取消/報名的時間 guard 保持一致的心智模型）；`Admin` 欄位仍是完整未來設計，V1 未開放 Admin 代為確認/拒絕。這兩個動作只在 `ClassSession.requiresApproval = true` 時才有意義——`false`（既有行為）的課程新報名一律直接 `confirmed`，沒有 `pending` 狀態可以確認/拒絕。

## Review

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Submit review | No | Own | No | No | No |
| View class session's reviews | No | Own | Own | Own | Admin |

同一 Member 對同一 class session 只能留下一次評價（`@@unique([classSessionId, reviewerUserId])`）。

**V1 落地範圍**（`class-session-review` 已確認）：`Submit review` 僅 Member own-scoped 可執行，且僅限於自己有 `confirmed` enrollment、且該 class session 目前是 `completed` 的情況（D1，兩個資格條件不合都收斂成同一個 `review_not_eligible` 錯誤碼，不細分原因）；不可編輯或刪除已送出的評價（D3）。`View class session's reviews`：Member 只看得到自己在該 class session 留下的那一則（透過 `listOwnEnrollmentsForMember` 的 nested `reviews` select，用 `reviewerUserId` 二次過濾）；Organizer／Teacher 看得到該 class session 的**所有**評價（own-scoped，Organizer 透過 `listReviewsForClassSession` 檢查 `organizerProfileId` 屬於自己，Teacher 透過既有 `listOwnClassSessionsForTeacher` 的 `teacherProfileId` own-scoping 天生取得），評價作者顯示既有 `name`/`email` fallback 的顯示名稱，不匿名化（D4）；**Admin 不介入逐筆評價檢視**（上表 Admin 欄位對應的是**逐筆**評價內容——評語、評價者身分——這部分仍是完整未來設計，V1 未開放任何 Admin 專用的逐筆評價檢視介面）。

**V1 額外落地（`review-average-rating-display` 已確認，與上表 `View class session's reviews` 的 Admin 欄位是不同顆粒度的能力）**：Admin 在 `/admin/teachers` 可以看到每位老師的**衍生彙整值**（平均分數＋評價則數），不是逐筆評價檢視——看不到任何評語內容或評價者身分，也沒有對應的資料檢視介面，純粹是一個計算後的信號數字。Teacher 本來就看得到自己所有課程的完整評價（既有 `Own`），這一輪只是把同一批已經允許看到的資料多做一個彙整摘要顯示在 `/teacher/profile`，不是新增可見範圍。

## Notification

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View own notifications | No | Own | Own | Own | Own |
| Create system notification | No | No | No | No | Admin |
| Send notification | No | No | No | No | Admin |

通知建立可由 domain/service layer 觸發；一般使用者不可任意建立 system notification。

**V1 落地範圍**（`notification`、`class-session-cancellation`、`demand-request-cancellation` 已確認）：`View own notifications` 透過 `/notifications` 頁面實現，own-scoped，任何登入使用者（含 Admin 自己）皆可查看自己收到的通知；`Create system notification`／`Send notification` 由各 domain/service layer 的 13 個既有 trigger 點（見 `state-transition-details.md` 的「Notification Side Effects」）內部呼叫 `notifyUsers`，不對外開放任何可手動建立或發送通知的 API 或 UI 入口，也沒有 Admin 專用的 notification 管理介面。收件人解析邏輯（誰會收到通知）持續受本文件 Security Review Required 清單規範。

## AdminNote

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View admin note | No | No | No | No | Admin |
| Create admin note | No | No | No | No | Admin |
| Edit admin note | No | No | No | No | Admin |

AdminNote 只供內部管理使用，不應顯示給一般角色。

## Security Review Required

以下變更必須做 security review：

- auth provider 或 session 邏輯
- admin permission assignment
- teacher approval
- demand visibility
- response selection
- enrollment capacity
- admin routes
- notification recipient logic
- payment-related placeholder 轉為實作

**`teacher-initiated-open-classes` 直接 touch 到 `teacher approval` 與 `enrollment capacity` 兩項（已過一輪 review，非跳過）**：見 `permissions.md` 同一節的說明。
