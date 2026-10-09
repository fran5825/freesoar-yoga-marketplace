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
- 2026-10-03：送審不需要先儲存草稿。還沒有任何申請資料的人直接按「送出審核」，系統視同從 `draft` 出發，通過送審必填檢查後直接建立一筆 `submitted` 的資料（`submitOwnTeacherProfileApplication`）。狀態轉換規則本身不變。

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

**老師自建課程（`teacher_initiated`）沿用完全相同的狀態機（`teacher-initiated-open-classes` 已確認）**：`origin` 欄位只影響擁有權（誰能操作、鎖查詢的 WHERE 過濾條件是 `teacherProfileId` 而不是 `organizerProfileId`），**不是**第二套狀態機——`draft → open_for_enrollment → completed`、`draft`／`open_for_enrollment → cancelled` 這兩條路徑對兩種 origin 完全同構，Teacher own-scoped 版本走平行的核心檔案（`__internal__/*-core-for-teacher.ts`），不修改既有 Organizer/Admin 版本本體。連帶取消的 Enrollment 條件也同步涵蓋 `pending`（見下方 Enrollment Status 的 Gate G2/G3 說明）。老師自建課程額外多了「建立」這一步的資格檢查（`TeacherProfile.status = 'approved'`）與跨 origin 共用的雙重預約衝突檢查（見 `docs/domain/data-model.md` 的 `ClassSession` 說明），但這些都是建立/報名這一層的規則，不影響狀態機本身。

**課程系列的批次開放（`teacher-class-scheduling` 票 01，2026-10-04）**：沒有新增狀態或轉換，只多了兩種觸發既有 `draft → open_for_enrollment` 的方式：(1) 建立系列或「生成更多」時選「建立後全部開放報名」，場次直接以 `open_for_enrollment` 建立（`startAt` 一律在未來）；(2) 系列頁「全部開放報名」把本人系列底下尚未開始的 `draft` 場次一次轉成 `open_for_enrollment`，須為已通過審核的老師。兩者都先鎖 `RecurringClassSeries` 列再處理場次（`docs/specs/teacher-class-scheduling-spec.md` 第 6 節鎖定順序：系列 → 場次 → 老師）；「生成更多」的日期計算、建立與鎖都在同一個 transaction，通知在 commit 後才發。單場「開放報名」仍未檢查老師狀態，補強排在票 04。

**改課（`teacher-class-scheduling` 票 04，已落地 2026-10-05）**：取代上方「建立後不提供編輯」與 Rules「Completed sessions cannot be edited」之外的限制——老師自己開的課（`origin = teacher_initiated`）在 `draft`／`open_for_enrollment` 且 `startAt` 尚未到達時，可以修改內容、時間、地點與人數上限。**不是新的狀態或轉換**：改課不改變 `status`，也不改變任何 `Enrollment.status`；已報名（`pending`／`confirmed`）的報名在改時間、地點後原樣保留，由學員自行決定是否取消。其他狀態（已開始、`completed`、`cancelled`）與團主媒合的課（`organizer_matched`）一律不可改。人數上限不得低於當下 `pending + confirmed` 數。改時間須重跑雙重預約衝突檢查（排除自己）。鎖定順序：先 `FOR UPDATE` 鎖該 `ClassSession`，再鎖 `TeacherProfile`（與單場報名相同，見 `docs/specs/teacher-class-scheduling-spec.md` 第 6 節），鎖內確認老師為 `approved`。票 04 先開放單堂課；票 05 起系列場次也可以改（見下一段）。「是否需要確認報名」本次不開放修改（推導規則 6）。

**系列改課（`teacher-class-scheduling` 票 05，已落地 2026-10-05）**：同樣不新增狀態或轉換。老師改系列中的某一場時選擇範圍：(1)「只改這場」——規則與票 04 單堂改課相同，只改這一場，系列設定不變；(2)「改這場和之後所有場次」——套用到這一場與之後所有尚未開始、未取消的場次，每一場維持原本的日期、只套用新的上課時段，並同步更新 `RecurringClassSeries` 的設定，之後「生成更多」與追加的場次沿用。批次中任一場撞課，或新的人數上限低於任一場的 `pending + confirmed`，整批都不改（推導規則 4）。批次鎖定順序：`RecurringClassSeries` → 各場 `ClassSession`（依 id 排序）→ `TeacherProfile`；「只改這場」沿用票 04 的「場次 → 老師」。不能改星期幾。

**期班（`teacher-class-scheduling` 票 07，已落地 2026-10-09）**：`ClassSession` 不新增狀態或轉換。系列多了型態（持續開課／期班）與期班報名方式，兩者建立後都不能改（推導規則 7），沒有轉換。期班不能「生成更多」（server 端拒絕）。期班的公開設定整期一致（推導規則 8）：期班場次改 `isPublic`（不論「只改這場」或「改這場和之後」），都套用到這一期所有尚未開始的 `draft`／`open_for_enrollment` 場次與系列本身；此時「只改這場」也先鎖 `RecurringClassSeries`，再依 id 鎖這一期的場次，最後鎖 `TeacherProfile`。整期報名的狀態在票 08 起記於下方 `SeriesEnrollment`。

**已落地（票 09）：團主直接開團（`organizer_direct`，organizer-usability-redesign）**：新增 `(none) → open_for_enrollment` 這條建立路徑。團主對已確認的 `OrganizerClassProposal` 按「開放報名」時，在同一個 transaction 建立課程並直接開放，不先建 `draft`。建立之後沿用同一套狀態機（`open_for_enrollment → completed`、`open_for_enrollment → cancelled`），由團主 own-scoped 操作；老師端的開放、取消、完成在 server 端限定 `origin = teacher_initiated`（票 09 已補上）。細節見 `docs/specs/organizer-usability-redesign-spec.md` 第 13.5–13.6 節。

## OrganizerClassProposal Status

**已核准・未實作**（organizer-usability-redesign，Q18：A；票 05–09）。

```text
(none)
  → draft
  → pending_confirmation
  → confirmed
  → converted

draft（本人授課）
  → confirmed

pending_confirmation
  → declined
  → pending_confirmation（團主修改，version +1）

declined
  → pending_confirmation（直接重送）
  → draft（團主修改內容，version +1）
  → draft（改成由團主本人授課；不寄邀請給自己，之後再本人確認）

confirmed
  → draft（團主修改內容：確認失效、釋放時段）

draft / pending_confirmation / declined / confirmed
  → withdrawn
```

Terminal states：

```text
withdrawn
converted
```

Rules:

- 只有 `confirmed` 且尚未轉課的邀請占用老師時段；pending、declined、draft 不占。
- 老師確認的必須是最新 `version`；舊版本不能被接受。
- 已送出的邀請不能換團體（以永不清空的 `submittedAt` 判斷，退回 draft 也一樣）；`converted` 之後不能修改，只能沿用課程的取消流程。
- 超過 `startAt` 不能送出、確認或開放；不新增 `expired` 狀態或 cron。
- 每個轉換的 actor、guard、時段與通知見 `state-transition-details.md` 的 OrganizerClassProposal 段落。

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

**V1 落地範圍（`enrollment` D1/D6/D8/D14、`teacher-initiated-open-classes` Gate G2/G3 已確認）**：上述完整狀態機是最終設計，目前接線 `(none) → confirmed`、`(none) → pending → confirmed`，以及 `confirmed`／`pending → cancelled`。

- **`(none) → confirmed`（原始行為，`requiresApproval = false` 時維持不變）**：建立時同一 transaction 內原子檢查 capacity 與重複報名，成功即直接寫入 `confirmed`，並寫入 `consentedAt`（D6，非 nullable）。
- **`(none) → pending → confirmed`（`teacher-initiated-open-classes` 第一次真正接線 `pending`，Gate G2/G3）**：所屬 `ClassSession.requiresApproval = true` 時，新報名先落在 `pending`（而不是 `confirmed`），需要授課老師明確按「確認」才轉為 `confirmed`；容量計算把 `pending` 與 `confirmed` **合計**佔用名額（Gate G3 = A，保留席位等老師確認，不是先搶先贏）。老師「確認」／「拒絕」都受 `startAt` 時間邊界限制，跟既有取消/報名的時間 guard 保持一致的心智模型。
- **`confirmed`／`pending → cancelled`**：與建立、開放報名一樣受 `startAt` 時間限制（D14）：課程開始後不提供自助取消，因為取消會抹除歷史報名紀錄，且讓這筆 enrollment 永遠無法銜接未來的 `confirmed → attended/no_show`。會員可自助取消自己還在 `pending` 的報名，不需要等老師處理；Admin 也可以取消任何人的 `pending` 報名（兩者原本都寫死只接受 `confirmed`，這一輪放寬為 `{ confirmed, pending }`）。老師「拒絕」`pending` 報名也會轉為 `cancelled`（reuse 既有值，不新增新的 enum）。課程整堂被取消時，該課程底下所有 `pending` 報名也一併轉為 `cancelled`（連帶取消同步涵蓋 `pending`，不只 `confirmed`）。
- 取消後**不可**對同一 class session 重新報名（D8，`@@unique([classSessionId, userId])` 不分狀態）。
- **資格檢查（`teacher-initiated-open-classes` 第 9 節）**：不論 `requiresApproval` 為何，建立新報名前都會檢查授課老師 `TeacherProfile.status = 'approved'`，非 approved（含 `suspended`）回傳 `teacher_not_approved`，阻擋任何來源（公開瀏覽或已登入直連）的新報名；已經合法建立的既有報名不受影響（暫停不回溯）。這個檢查在同一個 transaction 內先鎖定 `TeacherProfile` row 才讀取 `status`，避免跟 Admin 執行 suspend 的獨立 `UPDATE` 產生 TOCTOU 競態。
- `attended`/`no_show` enum 值保留但無對應 transition。

Rules:

- User cannot enroll twice in same class.
- Enrollment cannot exceed class capacity.
- Cancel rules depend on policy.
- V1 primarily supports confirmed and cancelled.
- Full teacher attendance workflow is not V1.
- **整期報名的逐場報名（`teacher-class-scheduling` 票 08 起）**：狀態轉換與單堂相同，但 `pending → confirmed`／`pending → cancelled` 不能由老師逐場操作（server 端拒絕），只能透過整期確認／婉拒（票 10）一次套用；學員取消其中一場（請假）沿用 `→ cancelled`。

## SeriesEnrollment Status

**已落地（票 08 建立；票 09 退出、票 10 確認／婉拒）**，`teacher-class-scheduling`，設計見 ADR 0005。

```text
(none) → pending → confirmed        （需確認的期班；老師整期確認一次）
(none) → confirmed                   （不需確認的期班）
pending → declined                   （老師整期婉拒，票 10）
pending／confirmed → withdrawn       （學員退出整期，票 09）
```

- `declined`、`withdrawn` 為終態；同一學員對同一期班不能再建立第二筆（推導規則 5）。
- 與逐場報名的連動：整期確認 → 底下尚未開始的 `pending` 逐場改 `confirmed`；整期婉拒 → `term_created` 的未開始逐場改 `cancelled`、`merged_single` 脫離整期恢復為單堂並保留狀態（推導規則 9）；退出整期 → 底下尚未開始的逐場改 `cancelled`，已開始或完成的不變。所有轉換都先鎖 `RecurringClassSeries`。
