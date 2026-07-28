# Notification — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D10）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

`demand-response-selection-and-matching`、`class-session-creation`、`enrollment` 三輪已經把「需求 → 媒合 → 課程 → 報名」整條交易流程打通到 `main`（`7894f8e`）。但每一次重要狀態變更（被媒合、被選中、課程建立、報名成功、名額釋出）都是**靜默**的——使用者只能自己回頁面才會看到。這件事在過去三輪 plan 裡都被明確列為 delay（見 `docs/domain/state-transition-details.md` 的「Notification Side Effects」小節，以及 `organizer-demand-request-foundation`／`teacher-application-rejection` 兩輪各自留下的「email 為後續切片」註記）。`docs/product/notification-spec.md` 已經先一步把完整的 V1 notification 規格寫好（event 表、收件人、channel、資料欄位），但**從未落地**：`prisma/schema.prisma` 目前完全沒有 `Notification` model 或任何相關 enum（repo 稽核已確認，見 2.1）。本輪把這筆債清掉。

### 1.2 風險等級

中。本輪**不新增**任何會擋住既有商業邏輯的 gate——notification 純粹是「狀態變更之後的附加動作」，設計原則是它失敗也絕不能讓使用者的報名／建立課程／送出需求等操作跟著失敗（見 D4）。真正的風險在於：觸及的既有 mutation function 有 12 處（跨 5 個 domain module），改動面廣，稍有不慎會在既有 service function 裡引入非預期的 side effect 或效能落差（N+1 query）。

### 1.3 命名澄清

- **`Notification`**：本輪新增的 Prisma model，代表一筆通知記錄（不論最終有沒有真的寄出）。
- **「`inAppNotificationSender`」**：本輪唯一的 `NotificationSender` 實作。對 `channel="in_app"` 而言，資料列成功寫入資料庫就等於已經送達（收件人可在 `/notifications` 讀到），所以這個 sender 不呼叫任何外部服務。刻意設計成可替換（見 D2），未來要接真的 email provider 只需要新增另一個實作同一介面的 adapter。
- **`/notifications`**：本輪新增的頁面路由，任何已登入使用者查看「自己收到的通知」列表。它是 `channel="in_app"`（見 D2）這批資料列在 V1 唯一的投遞終點，不是額外附加的除錯介面（見 D3）。

## 2. 現況核對（Repo Reality Audit；2026-07-27 working tree = committed `main` @ `7894f8e`）

### 2.1 已 committed 的基礎（可直接依賴）

以下由專門的 Explore agent 逐檔核對，非猜測：

- **Schema**：`prisma/schema.prisma` 目前無 `Notification` model，無 `NotificationType`/`NotificationChannel`/`NotificationStatus` enum。`User.isAdmin: Boolean @default(false)` 存在（line 17）。`TeacherProfile.userId`、`OrganizerProfile.userId` 都是唯一索引的直接 FK 欄位，取得 profile 記錄即可直接拿到對應 `User.id`，不需要額外 join。
- **無 admin 名單 helper**：`src/lib/auth/session.ts` 只有 `requireAdmin()`（檢查*目前登入者*是否為 admin），沒有任何「列出所有 admin User」的既有 query。本輪需要新增（D5）。
- **無背景工作／排程機制**：`package.json` 沒有任何 cron/queue 相關套件；`docs/scope/non-goals.md` 明確把「Advanced queue system unless notifications become heavy」列為非目標；`docs/harness/scalability-strategy.md` 把「加 queue + background worker」列為*未來*擴充觸發點，不是現有能力。這代表 `class_reminder_basic`（課前提醒，時間觸發而非狀態觸發）在本輪沒有任何既有機制可掛，見 D1。
- **無 email provider 套件**：`package.json` dependencies 只有 `@auth/prisma-adapter`、`@prisma/client`、`next`、`next-auth`、`prisma`、`react`、`react-dom`；沒有 `resend`/`sendgrid`/`nodemailer` 等任何 email 服務 SDK。這是 D2 的直接依據。
- **12 個既有 trigger 點的逐一稽核**（檔案、函式、目前 scope 內是否已經拿得到收件人 `User.id`、是否在 `$transaction` 內）：

  | # | Trigger | 檔案 | 函式 | 收件人 id 現成？ | 在 `$transaction` 內？ |
  |---|---|---|---|---|---|
  | 1 | Teacher 送審 | `src/domain/teacher-profile/service.ts` | `submitOwnTeacherProfileApplication` | 本人自己有；Admin 名單需新 query | 否 |
  | 2 | Teacher 核准 | `src/domain/teacher-profile/service.ts` | `approveSubmittedTeacherProfileApplication` | 否，select 未含 `user` relation | 否 |
  | 3 | Teacher 退回 | `src/domain/teacher-profile/service.ts` | `rejectSubmittedTeacherProfileApplication` | 否，同上 | 否 |
  | 4 | Demand 送出 | `src/domain/demand-request/service.ts` | `submitOwnDemandRequest` | 本人（`organizerContext.organizerProfile.userId`）有；Admin 需新 query | 否 |
  | 5 | Demand 發布 | `src/domain/demand-request/admin-service.ts` | `publishSubmittedDemandRequest` | 否，成功路徑只回傳 `{ok:true}` | 否 |
  | 6 | Demand 退回 | `src/domain/demand-request/admin-service.ts` | `rejectSubmittedDemandRequest` | 否，同上 | 否 |
  | 7 | Response 送出 | `src/domain/demand-response/__internal__/select-and-submit-core.ts` | `submitDemandResponseForTeacher` | 否，organizer 的 `userId` 需新 query | 是 |
  | 8 | Response 選中 | `src/domain/demand-response/__internal__/select-and-submit-core.ts` | `selectDemandResponseForOrganizer` | 否，teacher 的 `userId` 需新 query | 是 |
  | 9 | ClassSession 建立 | `src/domain/class-session/__internal__/create-class-session-core.ts` | `createClassSessionForOrganizer` | 部分，`teacherProfileId` 在 tx 內已知，但兩邊 `userId` 都需新 query | 是 |
  | 10 | 開放報名 | `src/domain/class-session/service.ts` | `openOwnClassSessionForEnrollment` | 否，成功路徑只回傳 `{ok:true}` | 否（刻意不用 `__internal__`，見 D2 of enrollment plan） |
  | 11 | Enrollment 建立 | `src/domain/enrollment/__internal__/create-enrollment-core.ts` | `createEnrollmentForUser` | 部分，會員 `userId` 是參數；teacher/organizer 需新 query | 是 |
  | 12 | Enrollment 取消 | `src/domain/enrollment/service.ts` | `cancelOwnEnrollment` | 部分，會員 `userId` 有；teacher/organizer 需新 query | 否 |

  結論：**幾乎每個 trigger 通知「行為人以外的第三方」都需要一支新的 resolver query**，因為既有的 `select` 都是為了各自 domain 的既有需求量身打造，沒有預留給 notification 用的欄位。

### 2.2 上游依賴狀態

- Enrollment plan 的 D12 明確寫「V1 以站內狀態顯示（Member 自己在 `/member/enrollments` 看到已確認／已取消）作為告知，不寄 email」——這是**針對 enrollment 這一輪**的決定，不代表全專案永久不做 notification。本輪就是把這個被明確 delay 的項目補上，但補上的方式是**新增**一條獨立的 notification 記錄與站內列表，**不修改** enrollment 既有頁面已經在做的站內狀態顯示（兩者並存，不衝突，見 D3）。
- `docs/domain/state-transition-details.md` 的「Notification Side Effects」小節列出的事件清單，是本輪 D1 決定「哪些落地、哪些延後」的比對基準。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不接真實 email provider（見 D2）。
- 不做 `class_session_changed`／`class_session_cancelled`（因為「編輯課程」「取消課程」本身在 V1 都還沒接線——`docs/domain/permissions-matrix.md` 的 `Edit draft class session`／`Cancel class session` 兩列都標記 D2／D9 不接線）。
- 不做 `class_reminder_basic`（需要排程機制，本輪不新增 cron/queue infra）。
- 不做「未被選中的老師」通知（`demand_response_selected` 只通知 selected 的 teacher 與 organizer——`docs/product/notification-spec.md` 的 event 表本來就沒有列 declined 通知這個事件，不是本輪漏掉，是規格本來就沒要求）。
- 不做 unread/已讀狀態（`Notification` 的欄位清單，見 D6，本來就沒有 `readAt`／`isRead`）。
- 不做 admin dashboard 的 notification 管理介面（`/admin/*` 目前沒有任何 notification 相關路由規劃，本輪也不新增）。
- 不建立 `/admin/dashboard`、`/organizer/dashboard`、`/member/dashboard`、`/teacher/dashboard`（後者已存在，前三者仍是空路由）——本輪的站內列表走獨立的 `/notifications` 路由，不依賴這些尚未建置的 dashboard（見 D3）。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `Notification` Prisma model + `NotificationType`／`NotificationChannel`／`NotificationStatus` enum + migration。
- `src/domain/notification/` 新 domain module：收件人 resolver、文案產生、去重、寫入、`inAppNotificationSender`、`listOwnNotifications()` 讀取服務。
- 在 11 個既有 trigger 點（見 D1 清單）呼叫新 module，建立對應 `Notification` 記錄。
- `/notifications` 頁面（任一已登入使用者，own-scoped，唯讀列表）+ `/account` 頁面的入口連結。
- Playwright smoke 測試。
- 文件對齊（`docs/domain/data-model.md`、`docs/domain/state-transition-details.md`、`docs/domain/permissions-matrix.md`、`docs/product/route-map.md`、`docs/product/notification-spec.md` 的落地現況註記）。

### 3.2 本輪明確不包含

見 2.3。額外重申：不改動 `next.config.ts`／`package.json`／`playwright.config.ts`（這三個檔案在本輪之前就有未提交的本機修改，與本專案任何一輪 plan 都無關，本輪維持不動、不 commit）。

## 4. 安全與權限設計

- `Notification.userId` 是收件人，不是行為人；建立 notification 記錄本身**不需要**收件人的 session（這是系統內部寫入，不是使用者發起的 mutation）。
- `/notifications` 頁面必須嚴格 own-scoped：`requireUser()` 取得 `userId`，`prisma.notification.findMany({ where: { userId, channel: "in_app", status: "sent" } })`（`channel`／`status` 篩選理由見 D3 修正版）。沒有任何跨 user 查詢入口。
- Admin 收件人的 resolver（`prisma.user.findMany({ where: { isAdmin: true } })`）只在 domain/service layer 內部呼叫，不對外暴露成可查詢 API。
- Notification 內容（title/body）不得包含超出既有頁面就會顯示的資訊（例如不把其他人的 email/phone 塞進通知文案）——比照 `enrollment` D9 roster 最小揭露原則。
- 這一輪**不需要** security review 清單裡的「notification recipient logic」以外的項目；但這正是 `docs/domain/permissions-matrix.md` 的 Security Review Required 清單裡明列的一項，本輪完成後不移除這個提醒（收件人邏輯持續受規範）。

## 5. 產品主人決策 Gate（D1–D10）

### D1 — V1 落地哪些事件？

- **推薦：落地 11 個事件**，全部要求「已經有既有、已出貨的 code path 可以掛」這個條件：
  - `teacher_application_submitted`（收件人：Teacher 自己 + 所有 Admin）
  - `teacher_application_approved`（Teacher）
  - `teacher_application_rejected`（Teacher）
  - `demand_request_submitted`（Organizer 自己 + 所有 Admin）
  - `demand_request_published`（Organizer）
  - `demand_request_rejected`（Organizer）
  - `demand_response_submitted`（該 demand 的 Organizer + 所有 Admin）
  - `demand_response_selected`（被選中的 Teacher + Organizer）
  - `class_session_created`（Teacher + Organizer）
  - `enrollment_confirmed`（Member 自己）
  - `enrollment_cancelled`（Member 自己）

  以上共 **11 個**事件（`notification-spec.md` 原表 14 個事件中，扣掉 `class_session_changed`／`class_session_cancelled`／`class_reminder_basic` 這 3 個無 code path 可掛的，剩 11 個）。
- **明確不做**（理由見 2.3）：`class_session_changed`、`class_session_cancelled`、`class_reminder_basic`。
- Builder 施工時請以本 D1 的 11 個事件清單為準，不要自己對照 `notification-spec.md` 的原表去補齊那 3 個缺的——那 3 個缺的是刻意排除，不是遺漏。

### D2 — Channel 與寄送機制？

- **背景**：`notification-spec.md` 寫「V1 以 email notification 為主」，但這個 repo 完全沒有接任何 email provider（無套件、無 API key、無設定）。真的去接一個外部 email 服務需要使用者提供帳號／API key，超出本輪能自主完成的範圍；而且讓系統自動對真實使用者寄出正式 email，屬於「代使用者發送訊息」的動作，不適合在沒有人工核准每一封信的情況下自動化執行。
- **修正後推薦（codex round 1 指出原推薦會製造假的遞送紀錄，已採納並修改）**：V1 實際寫入的 `channel` 是 `"in_app"`，不是 `"email"`。理由：如果 `channel="email"` 但從未真的呼叫任何 email 服務，`status="sent"` 就是一筆不實紀錄——未來若有人依賴這個 status 做遞送稽核，會被誤導成「這封信已經寄出」。改成 `channel="in_app"` 之後，`status="sent"` 的意義是「已寫入且可在 `/notifications`（見 D3）被收件人讀到」——這對 in_app channel 而言就是完整、真實的投遞，不是假象。`email` 這個 enum 值繼續保留在 schema 裡（見 D6），留給未來真的接 email provider 的切片使用；本輪不寫入這個值。
- `NotificationSender` 抽象（輸入一筆 notification 記錄，回傳成功或丟出例外）本輪的唯一實作是 `inAppNotificationSender`：對 in_app channel 而言，「送達」等同於「這筆記錄已經 commit 進資料庫、且 `/notifications` 的查詢看得到它」，所以這個 sender 不做任何額外網路呼叫，只需確認寫入已完成即可回傳成功；它會丟出例外的唯一情況是底層 DB 操作本身失敗。未來要接真的 email provider，只需要新增一個 `emailNotificationSender` 實作同一個介面（內部才會真的呼叫外部 API、才會有機會回傳真正的失敗），呼叫端與 `notifyUsers` 的邏輯完全不用改。
- 這件事必須在使用者驗收時說清楚：本輪之後，通知**不會寄到任何人的實體信箱**，只會出現在 `/notifications` 這個站內頁面。

### D3 — 使用者怎麼看到通知？

- **推薦：新增 `/notifications` 頁面**，任何已登入使用者可查看「自己收到的通知」列表（`userId` own-scoped），純讀取、依 `createdAt` 倒序、不分頁（V1 通知量小）、不做「標記已讀」（`Notification` 沒有 read 狀態欄位，見 D6）。
- 承 D2 的修正：`/notifications` 不是「一個額外的 UI 去顯示 email 型別的資料」，它就是 `channel="in_app"` 這個真實 channel 唯一的投遞終點——沒有這個頁面，這個 channel 就沒有送達使用者，`status="sent"` 就會失真。所以本輪**必須**把這個頁面的連結放進使用者實際會經過的既有頁面，否則使用者無從發現通知存在（codex round 1 指出的可發現性問題）：在 `/account` 頁面（所有角色都會用到、已存在，見 route-map）加一個到 `/notifications` 的連結。`/notifications` 本身放在 route-map 的 Auth Routes 區塊（比照 `/account`）。
- **修正（codex round 2 指出的問題，已採納）**：`listOwnNotifications()` 不能只用 `userId` 篩選——如果 `status="pending"`（尚未送達，理論上極短暫但仍是合法狀態）或 `status="failed"`（sender 失敗，依 D2 的定義代表「這個 in_app channel 根本沒有送達」）的記錄也顯示在列表裡，就會跟「`/notifications` 就是 in_app channel 的送達終點、`status="sent"` = 真的已送達」這個核心主張自相矛盾——使用者會看到自己「收到」了實際上從未送達的通知。`listOwnNotifications()` 必須額外篩選 `status: "sent"`，只有真正送達的記錄才會出現在使用者看到的列表裡。`pending`／`failed` 的記錄仍然完整保留在資料庫裡（供未來 debug 或 admin 稽核用），只是不出現在使用者自己的 `/notifications`。
- **修正（codex round 3 指出的問題，已採納）**：同一個理由也適用於 `channel`——`listOwnNotifications()` 除了 `status: "sent"` 之外，也必須篩選 `channel: "in_app"`（`where: { userId, channel: "in_app", status: "sent" }`）。這不只是本輪的技術細節：未來一旦真的接上 `email` channel（見 D2 的 `emailNotificationSender` 延伸），寄出成功的 email 型別記錄也會是 `status="sent"`，但那是透過信箱送達的，不該再透過 `/notifications` 這個 in_app 專屬的終點重複顯示一次——否則同一個邏輯事件會在兩個 channel 各自顯示，使用者會看到重複通知。現在就把 `channel` 篩選寫進查詢，可以避免未來加 email channel 時才發現這個 UI 需要回頭補課。

### D4 — Notification 寫入失敗時，可不可以讓主要商業邏輯跟著失敗？可不可以讓一個收件人的失敗擋住其他收件人？

- **推薦：兩者都不行。** Notification 是附加動作，不是業務不變量；同一事件的多個收件人之間也互相獨立。設計規則：
  1. 所有 notification 的建立與寄送呼叫，一律發生在「主要狀態變更已經確定成功」**之後**（已經在 `$transaction` 內成功 commit，或 `updateMany`/`update` 已確認影響筆數 > 0 之後），且一律用 `prisma`（不是 `tx`）執行，與主要商業邏輯的連線／交易完全脫鉤。
  2. `notifyUsers(type, recipients, payload)` 內部**逐一收件人**處理，每個收件人各自獨立 try/catch：寫入一筆 `status="pending"` 記錄 → 呼叫 sender → 成功則更新為 `status="sent"`／`sentAt`；若 sender 丟出例外，該筆記錄更新為 `status="failed"`（這個更新本身也包 try/catch，只 log 不 re-throw）。單一收件人失敗**不得**中斷迴圈，其餘收件人必須繼續處理。
  3. `notifyUsers` 呼叫本身，在每個 trigger 呼叫端外層仍然包一層 try/catch 防禦（避免收件人解析或 `notifyUsers` 本身的非預期例外外溢），但因為第 2 點已經把每個收件人的例外都吞掉，這層外層 catch 預期不會被觸發到——它是防禦最外層意外狀況，不是常規失敗處理路徑。
  4. 因此本輪**不會**把 notification 寫入或收件人解析查詢塞進既有的 4 個 `$transaction`（trigger #7/8/9/11）裡面——即使技術上可以，塞進去代表「收件人解析查詢」或「notification 寫入」若失敗，會讓整個 enrollment/response/class session 一起 rollback，這是不能接受的耦合，也會延長既有 `FOR UPDATE` 鎖的持有時間（codex round 1 指出的問題，已採納：D7 原本允許在既有 tx 內做 resolver 查詢的例外已取消，見 D7 修正）。全部改成主要 tx commit 成功之後，另外用 `prisma` 跑一次獨立、被 try/catch 包住的解析 + 寫入。
  5. 代價：主要狀態變更成功、但 notification 沒寫成功（例如 process 剛好在兩步之間掛掉）的極小機率窗口，V1 接受，不做 outbox/retry（明列為 non-goal）。
- 為了讓「notification 失敗不影響主流程」這個保證可以被**決定性測試**驗證（而不是只靠讀 code 相信），`notifyUsers` 簽章額外接受一個第四個可選參數 `sender?: NotificationSender`（預設 `inAppNotificationSender`）。這個參數只給測試用：測試可以直接從測試檔案 import `notifyUsers`，傳入一個保證丟出例外的假 sender，同時混入一個正常收件人，斷言（a）呼叫不會拋出、（b）失敗收件人那筆記錄變成 `status="failed"`、（c）正常收件人那筆記錄變成 `status="sent"`。見 D9、Slice 6。
- **修正（codex round 2 指出只測 `notifyUsers` 不夠，round 3 進一步指出 round 2 的修法本身不可行、也沒測到真正的邊界，已重新設計並採納）**：只測 `notifyUsers` 本身有沒有吞掉 sender 例外還不夠——這無法證明「當某個真正的業務 trigger 呼叫完 resolver query + `notifyUsers` 之後，即使中間出了意外，trigger 回傳給使用者的結果仍然不受影響」。round 2 原本提案直接呼叫 `createOwnEnrollment`（`service.ts` 的 auth wrapper）來測，但這個函式內部呼叫 `requireUser()`，需要真正的 NextAuth session／cookie，測試檔案沒有瀏覽器 session 的情況下無法直接呼叫它——這點 codex round 3 正確指出是不可行的（比照本專案既有慣例：auth wrapper 一律透過瀏覽器整合測試驗證，只有不呼叫 `requireUser()` 的 `__internal__` pure-core 才能被測試檔案直接呼叫，這正是既有 `enrollment` 併發鎖測試選擇直接呼叫 `createEnrollmentForUser`——`__internal__` core，而不是 `createOwnEnrollment` 的原因）。另外，即使能呼叫，讓 sender 對其中一個收件人丟出例外，這個例外會被 `notifyUsers` 自己的逐收件人 try/catch 吞掉（D4 第 2 點），永遠不會傳到 trigger 呼叫端外層那層 try/catch（D4 第 3 點）——所以這種測法就算能執行，也只是把「`notifyUsers` 層級隔離」重測一次，沒有真正碰到「trigger 外層 catch」這個獨立的保護層。
- **重新設計**：改成直接呼叫 `createEnrollmentForUser`（`src/domain/enrollment/__internal__/create-enrollment-core.ts`，不呼叫 `requireUser()`，本來就是既有併發測試會直接呼叫的函式），並把測試專用的可選參數改成 `notifyOverride?: (type, recipients, payload) => Promise<void>`（預設值是「解析收件人 + 呼叫 `notifyUsers`」這一整段真正的邏輯），而不是只覆蓋 `notifyUsers` 內部的 `sender`。測試傳入 `async () => { throw new Error("boom"); }` 作為 `notifyOverride`——這個例外會在 trigger 呼叫端外層的 try/catch（D4 第 3 點）被吞掉，而不是在 `notifyUsers` 內部被吞掉，因此才是真正測到「trigger 外層 catch」這個獨立邊界，而不是 `notifyUsers` 內部邊界的重複測試。斷言（a）回傳值仍是 `{ok:true, ...}`、（b）DB 裡的 `Enrollment` 記錄確實是 `confirmed`（主要商業邏輯完全沒受影響）。因為這次連 `notifyUsers` 都沒被呼叫到，這次不會有對應的 `Notification` 記錄產生，這是預期行為，不是缺陷。這個測試涵蓋的路徑（resolver query + `notifyUsers` 呼叫都在 tx commit 之後、被同一層 try/catch 保護）跟其餘 10 個 trigger 的結構完全相同，故視為代表性測試，不要求對 11 個 trigger 都各做一次端到端測試。

### D5 — Admin 收件人怎麼決定？

- **推薦：`prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } })`**，對每一個回傳的 admin `userId` 各建立一筆獨立的 `Notification` 記錄（fan-out）。預期 admin 數量很小（個位數），不需要 batch/queue 優化。這支 query 封裝成 `src/domain/notification/` 內部的 `listAdminUserIds()` helper，不對外匯出。
- **收件人去重（codex round 1 指出的問題，已採納新增）**：本專案採能力模型，同一個 `User` 可以同時具備 Member／Organizer／Teacher／Admin 能力（見 `docs/domain/permissions-matrix.md` 的 Role Model 說明）。這代表某次事件解析出的收件人清單（例如「自己 + 所有 Admin」「Teacher + Organizer」）有可能包含重複的 `userId`（例如一個 Organizer 本身也是 Admin，或是同一使用者同時是某堂課的 Teacher 又是該堂課的 Organizer）。`notifyUsers` 在建立記錄之前，必須先以 `userId` 去重，且**必須保留第一次出現的角色，不是最後一次**。**修正（codex round 2 指出的問題，已採納）**：原本寫的 `Array.from(new Map(recipients.map(r => [r.userId, r])).values())` 實際上會保留**最後一次**出現的項目（`Map` 對同一個 key 的後續 `set` 會覆蓋前一次），跟「自己」放最前面、優先保留自己角色文案的政策正好相反。正確寫法必須是保留**第一次**出現，例如：
  ```ts
  const seen = new Set<string>();
  const deduped = recipients.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  ```
  確保同一使用者對同一事件只收到**一筆** `Notification` 記錄，且內容是第一次出現那個角色（例如「自己」）對應的文案。每個呼叫端組裝 `recipients` 陣列時，把「自己」放在陣列最前面，確保去重後優先保留「自己」角色對應的文案（而不是被覆蓋成 admin 版文案）。去重測試（見 D9）除了斷言只產生一筆記錄，也必須斷言那筆記錄的文案是「自己」角色的版本，不是「admin」角色的版本——否則測試無法抓到「保留錯了角色」這種 bug。

### D6 — Schema 設計？

- **推薦**：完全比照 `docs/domain/data-model.md` 現有欄位清單，`Notification`：
  ```prisma
  model Notification {
    id        String               @id @default(cuid())
    userId    String
    type      NotificationType
    channel   NotificationChannel
    title     String
    body      String
    status    NotificationStatus   @default(pending)
    createdAt DateTime             @default(now())
    sentAt    DateTime?

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
    @@index([status])
  }

  enum NotificationType {
    teacher_application_submitted
    teacher_application_approved
    teacher_application_rejected
    demand_request_submitted
    demand_request_published
    demand_request_rejected
    demand_response_submitted
    demand_response_selected
    class_session_created
    class_session_changed
    class_session_cancelled
    enrollment_confirmed
    enrollment_cancelled
    class_reminder_basic
  }

  enum NotificationChannel {
    email
    in_app
    line
    sms
  }

  enum NotificationStatus {
    pending
    sent
    failed
    cancelled
  }
  ```
- `NotificationType` 保留全部 14 個值（含 D1 明確不接線的 3 個：`class_session_changed`／`class_session_cancelled`／`class_reminder_basic`），比照本專案一貫做法（`EnrollmentStatus` 也保留 `pending`/`attended`/`no_show` 等未接線的值）——這樣未來要接這 3 個事件時不用動 schema。`NotificationChannel` 保留 `email`/`line`/`sms`，V1 寫入時一律用 `in_app`（見 D2 修正版）。
- `User` model 新增反向關聯 `notifications Notification[]`。
- `sentAt` 允許 `null`（`pending`/`failed` 狀態時尚未寄出）；`consentedAt`（enrollment 那個必填不可 null 的欄位）不是同類案例，不要比照——這裡 `sentAt` 本質上就是可能不存在的時間點。

### D7 — 收件人 `User.id` 解析：改既有 `select` 還是另外查？

- **背景**：2.1 的稽核表顯示，12 個 trigger 裡有 10 個現在拿不到收件人 `userId`。
- **推薦：一律另外用小型獨立 query 解析，不修改既有的 production `select`。** 例如 `approveSubmittedTeacherProfileApplication` 成功後，另外執行 `prisma.teacherProfile.findUnique({ where: { id: teacherProfileId }, select: { userId: true } })`。理由：既有的 `select` 是專門為各自 domain 的既有回傳型別設計的，牽動它有機會影響其他呼叫端或既有測試對回傳形狀的假設（例如 `TeacherProfileApproveResult` 的型別、既有頁面對回傳值的解構）；本輪多一支小查詢的成本遠低於重構既有已上線邏輯的風險。
- **修正（codex round 1 指出的問題，已採納）**：原本考慮讓已經在 `$transaction` 內的 4 個 trigger（#7/8/9/11）的 resolver query 複用同一個 `tx` 執行——這個想法已經取消。即使 resolver query 本身沒有寫入副作用，把它留在既有的鎖定交易內執行，仍然代表這支 query 若失敗（連線問題、逾時等）會讓整個 enrollment/response/class session 交易一起 rollback，直接違反 D4「notification 相關動作絕不可拖累主要商業邏輯」的保證；額外的 query 也會延長 `FOR UPDATE` 鎖的持有時間，增加其他併發請求等鎖的時間。**一律**在主要 tx commit 成功之後，用 `prisma`（不是 `tx`）執行 resolver query + `notifyUsers`，兩者都在 D4 描述的「主要邏輯已確定成功之後」這個時間點之後才發生，沒有例外。

### D8 — 文案怎麼寫、放哪裡？

- **推薦**：`src/domain/notification/copy.ts`，每個 `NotificationType` 對應一個純函式 `(payload) => { title: string; body: string }`，`payload` 是呼叫端已經有的資料（例如課程標題、demand 標題、退回原因）。文案語氣依 `notification-spec.md` 的「Email Copy 原則」：繁體中文、清楚溫和、不用「立即搶購」等焦慮式用語，需要 action 時給清楚 CTA 文字（V1 不做真的超連結，因為還沒有真的寄信）。
- Admin 收到的通知（例如 `teacher_application_submitted` 給 Admin）文案與給當事人的文案內容不同（給 Admin 的版本要提示「請前往審核」），所以 copy 函式簽章是 `(type, recipientRole: "self" | "admin" | "counterpart", payload) => {...}`，而不是每個 type 只有一種文案。

### D9 — 測試策略？

- **推薦：只用既有 Playwright smoke**，比照 `enrollment` D13，不引入 Vitest、不改 `package.json`。因為沒有真的寄信（D2），測試驗證的是：對應的 `Notification` 資料列有沒有被正確建立（type/收件人/status="sent"），以及 `/notifications` 頁面有沒有正確顯示 own-scoped 資料，不驗證任何 email 遞送行為。
- **`notifyUsers` 層級的失敗隔離測試（必做）**：比照本專案既有的「Playwright 測試檔案本身就是一個 Node 程式，可以直接 `import` domain 函式並在同一個 process 內呼叫，不必透過瀏覽器」這個既有慣例（`enrollment` 併發鎖測試已經用同樣手法直接呼叫 `__internal__` core 並傳入 `hooks`），`tests/smoke/notification.spec.ts` 必須包含至少一個測試：直接從測試檔案 `import { notifyUsers } from "@/domain/notification/create"`，組出一個包含 2 個收件人的 `recipients` 陣列，傳入一個第四參數 `sender`——這個假 sender 對其中一個收件人的呼叫刻意丟出例外、對另一個收件人正常回傳成功——斷言：（a）`notifyUsers` 呼叫本身不會拋出例外、（b）失敗那位收件人的 `Notification` 記錄 `status="failed"`、（c）正常那位收件人的記錄 `status="sent"`。
- **端到端的失敗隔離測試（必做，見 D4 修正說明——round 2 提議直接呼叫 `createOwnEnrollment` 因需要 session 而不可行，且無法真正碰到 trigger 外層 catch，round 3 已重新設計）**：直接呼叫 `createEnrollmentForUser(userId, classSessionId, input, hooks, notifyOverride)`（`__internal__` core，不需要 session，比照既有併發鎖測試的呼叫方式），`notifyOverride` 傳入一個保證同步丟出例外的函式，斷言（a）回傳 `{ok:true,...}`、（b）`Enrollment` 記錄確實 `confirmed`。這個測試證明的是「即使 notification 呼叫整條路徑（resolver query + `notifyUsers`）出錯，enrollment 這個主要商業結果完全不受影響」，且因為例外是在 `notifyOverride` 這一層丟出，會被 trigger 呼叫端外層的 try/catch 接住，不是被 `notifyUsers` 內部的逐收件人 try/catch 接住，所以測到的是跟上一項不同的、真正獨立的保護邊界。
- 另外必須有一個測試驗證 D5 的收件人去重邏輯：直接呼叫 `notifyUsers`，`recipients` 陣列刻意包含兩筆相同 `userId`（角色不同，「自己」排在陣列最前面），斷言（a）最終只產生一筆 `Notification` 記錄，不是兩筆，（b）那筆記錄的文案是「自己」角色的版本，不是後面那個角色的版本（codex round 2 指出的「保留錯誤角色」風險，見 D5 修正）。
- **另外必須有一個測試驗證 D2/D3 修正後 `listOwnNotifications()` 的過濾邏輯（codex round 2 指出的問題，已採納新增）**：透過 `notifyUsers` 的 `sender?` 參數製造一筆刻意失敗的記錄（`status="failed"`），斷言該筆記錄不會出現在 `listOwnNotifications()` 的回傳結果、也不會顯示在 `/notifications` 頁面上，而同一次呼叫中另一筆正常成功的記錄會正常出現。

### D10 — `open_for_enrollment` 要不要新增一個對應的 notification 事件？

- **推薦：不要。** `notification-spec.md` 的 event 表本來就沒有把「開放報名」列為一個獨立事件（`class_session_created` 已經涵蓋「課程成立」這個時間點的通知；開放報名只是同一個 `ClassSession` 內部狀態的後續轉換，收件人跟 `class_session_created` 一樣是同一批 Teacher/Organizer，重複通知沒有額外資訊價值）。本輪不新增規格沒有要求的事件類型，避免範圍蔓延。

## 6. 品牌與 UX 規則

- 文案語氣延續 `notification-spec.md` 的「Email Copy 原則」（見 D8）。
- `/notifications` 頁面純資訊呈現，不做任何互動 CTA（V1 沒有「標記已讀」「刪除」等操作）。
- 通知內容不得洩漏超出既有頁面本來就會顯示的資料（比照既有 roster 最小揭露原則）。

## 7. RWD Requirements

- `/notifications` 需在 360px 手機寬度可用，列表卡片式呈現（比照 `/member/enrollments` 既有版型），不使用密集表格。

## 8. 實作切片（Slice 1–6；施工前提：D1–D10 已拍板）

### Slice 1 — Schema + Migration

- 新增 `Notification` model + 3 個 enum（D6），`User` 反向關聯。
- `npx prisma migrate dev` 產生 migration，核對 SQL 內容符合 D6（FK `onDelete: Cascade`、索引、`sentAt` nullable）。

### Slice 2 — Notification domain module（核心）

- `src/domain/notification/types.ts`：`NotificationRecipientRole`、内部 payload 型別。
- `src/domain/notification/copy.ts`：D8 的文案函式，涵蓋 11 個落地事件 × 對應角色（self/admin/counterpart）組合。
- `src/domain/notification/sender.ts`：`NotificationSender` 介面 + `inAppNotificationSender`（D2）。
- `src/domain/notification/create.ts`：核心寫入函式 `notifyUsers(type, recipients: {userId, role}[], payload, sender: NotificationSender = inAppNotificationSender)`——先以 `userId` 去重 `recipients`（D5），逐一收件人各自獨立處理：產生文案、插入 `pending` 記錄、呼叫 `sender`，成功則更新為 `sent`，失敗則更新為 `failed`；單一收件人的例外不得中斷其他收件人（D4）。不 export 給 UI 層直接呼叫，只給其他 domain module 的 trigger 呼叫端與測試檔案用。
- `src/domain/notification/admin-recipients.ts`：`listAdminUserIds()`（D5）。
- `src/domain/notification/read-service.ts`：`listOwnNotifications()`（`requireUser()` + `where: { userId, channel: "in_app", status: "sent" }`，D3 修正版——只回傳真正送達的 in_app 記錄，不含 `pending`／`failed`，也預先排除未來 email channel 記錄重複顯示）。
- **驗證**：用 throwaway `tsx` script 直接呼叫 `notifyUsers` 對一個測試 user 寫入一筆、確認 `Notification` 資料列與 `status="sent"`／`sentAt` 正確，事後清除測試資料。

### Slice 3 — 掛載 trigger（teacher-profile + demand-request，6 個事件）

- `src/domain/teacher-profile/service.ts`：`submitOwnTeacherProfileApplication`（→ self + admin）、`approveSubmittedTeacherProfileApplication`（→ self，用 D7 的 resolver 查 `userId`）、`rejectSubmittedTeacherProfileApplication`（→ self，同上，帶 `rejectionReason`）。
- `src/domain/demand-request/service.ts`：`submitOwnDemandRequest`（→ self + admin）。
- `src/domain/demand-request/admin-service.ts`：`publishSubmittedDemandRequest`（→ organizer，D7 resolver）、`rejectSubmittedDemandRequest`（→ organizer，D7 resolver，帶 `rejectionReason`）。
- 全部依 D4：在既有 `update`/`updateMany` 確認成功之後才呼叫，try/catch 包住。
- **驗證**：透過既有 UI 流程（teacher 送審/admin 核准/退回、organizer 送出/admin 發布/退回）在瀏覽器實際跑一次，用 `tsx` 直接查 DB 確認對應 `Notification` 記錄產生、內容正確。

### Slice 4 — 掛載 trigger（demand-response + class-session + enrollment，5 個事件）

- `src/domain/demand-response/__internal__/select-and-submit-core.ts`：`submitDemandResponseForTeacher`（→ organizer + admin）、`selectDemandResponseForOrganizer`（→ teacher + organizer）——resolver 查詢與 `notifyUsers` 呼叫都在 `prisma.$transaction(...)` commit **之後**才用 `prisma` 執行，不進入既有的 `tx`（D4/D7 修正版）。
- `src/domain/class-session/__internal__/create-class-session-core.ts`：`createClassSessionForOrganizer`（→ teacher + organizer）。
- `src/domain/enrollment/__internal__/create-enrollment-core.ts`：`createEnrollmentForUser`（→ member 自己）。
- `src/domain/enrollment/service.ts`：`cancelOwnEnrollment`（→ member 自己）。`createEnrollmentForUser`（`__internal__/create-enrollment-core.ts`）額外新增一個測試專用可選參數 `notifyOverride?: (type, recipients, payload) => Promise<void>`（預設是真正的 resolver + `notifyUsers` 邏輯），供 D4/D9/Slice 6 的端到端失敗隔離測試使用——**不要**加在 `createOwnEnrollment`（`service.ts` 的 auth wrapper）上，因為那個函式呼叫 `requireUser()`，測試檔案無法在沒有 session 的情況下直接呼叫它（codex round 3 已指出）。
- **驗證**：同 Slice 3，走既有 UI 流程 + `tsx` 直接查 DB 核對。特別注意併發測試（enrollment 的 hooks-based 併發 Playwright 測試）在加入 notification 呼叫後是否仍然通過——notification 呼叫必須在 lock 釋放之後才發生，不能延長鎖定時間。

### Slice 5 — `/notifications` UI

- `src/app/notifications/page.tsx`：`requireUser()` + `listOwnNotifications()`，卡片列表（type 對應的顯示標籤、title、body、`createdAt`）。
- Route guard：任何已登入使用者皆可存取（比照 `/account`），不需要額外角色檢查。
- **可發現性（D3 修正，必做）**：在 `src/app/account/page.tsx` 加一個到 `/notifications` 的連結，確保任何登入使用者都能從既有會經過的頁面找到通知列表。
- **驗證**：瀏覽器實際操作——用一個測試帳號觸發至少 3 種不同事件（例如送出 demand、被選中、報名成功），確認 `/notifications` 依序顯示正確筆數與內容，並確認能從 `/account` 點連結進入。

### Slice 6 — Tests + Docs 對齊

- `tests/smoke/notification.spec.ts`：涵蓋至少 D1 清單中每一類事件各一個案例的資料建立驗證（可直接查 DB 或透過 `/notifications` 頁面斷言文字出現）、admin fan-out（多個 admin 都收到）、own-scoped 隔離（user A 看不到 user B 的通知）、`notifyUsers` 層級（直接呼叫，`sender?` 覆蓋）與 trigger 層級（直接呼叫 `createEnrollmentForUser`，`notifyOverride?` 覆蓋）兩個各自獨立的失敗隔離決定性測試（必做，見 D9/D4）、D5 描述的收件人去重決定性測試（必做，含角色文案斷言，見 D9）、D2/D3 描述的 `listOwnNotifications()` 過濾 `failed` 記錄與 `channel` 測試（必做，見 D9）。
- 更新 `docs/domain/data-model.md`（`Notification` 欄位改為已落地，補上 enum 值）、`docs/domain/state-transition-details.md`（「Notification Side Effects」小節標記各事件已落地/延後）、`docs/domain/permissions-matrix.md`（Notification 那一列的 V1 落地範圍註記）、`docs/product/route-map.md`（新增 `/notifications`）、`docs/product/notification-spec.md`（補上落地現況段落，說明 D1/D2/D3 的範圍與延後項目）。

### Slice 順序

Slice 1 → 2 必須先完成（schema + 核心 module）。Slice 3、4 彼此獨立，可任意順序，但都依賴 Slice 2。Slice 5 依賴 Slice 2（`listOwnNotifications`）但不依賴 3/4 是否完成（可以先用手動塞測試資料驗證頁面本身）。Slice 6 排最後。

## 9. Verification Planning

- Domain 層（Slice 2–4）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 5）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 併發相關（Slice 4 對 enrollment/demand-response 兩個既有 `$transaction`）：重跑既有的 `tests/smoke/enrollment.spec.ts` 與 `tests/smoke/demand-response.spec.ts`（正確檔名以 repo 現況為準）確認全數仍通過，確認新增的 notification 呼叫沒有破壞既有鎖定行為或延長鎖定時間。
- 最終：跑 `npm run lint`（本專案的強制 ESLint gate，之前三輪 plan 皆需通過）與全套 `npm run test:smoke`，確認新舊測試與 lint 全數通過。

## 10. Rollback 總則

- 若 Slice 1 的 migration 有問題，`prisma migrate reset` 僅限本機開發資料庫，不影響任何已部署環境（本專案目前沒有已部署環境）。
- 若任何 Slice 3/4 的 trigger 掛載後發現破壞既有測試，優先 revert 該筆 commit（每個 Slice 是獨立 commit），不做 hotfix 疊加。

## 11. Planning-only self review

- 已核對：12 個既有 trigger 點的檔案路徑、函式名稱、`$transaction` 使用情形全部由 Explore agent 逐行讀取確認，不是猜測。
- 已核對：`package.json` 沒有任何 email provider 依賴，`Notification` model 目前不存在於 schema。
- 已核對：本輪新增的 `/notifications` 路由未與現有 route-map 任何路由衝突。
- 待 codex 檢查：D1 的 11 個事件清單是否有遺漏既有 code path、D4 的「絕不阻塞主流程」設計是否有遺漏的邊界情況、D7 的「另開 resolver query 而非改既有 select」在效能上是否可接受（尤其 admin fan-out 的 N+1 疑慮）。

<!-- codex-peer-reviewed: 2026-07-27T13:09:01Z rounds=4 verdict=approved -->
