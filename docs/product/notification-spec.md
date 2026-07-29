# Notification Spec

## 目的

本文件定義 Free Soar Yoga V1 的 basic notification 規格。V1 以 email notification 為主，保留未來擴充 channel 的資料模型空間，但不做 LINE deep integration 或複雜自動化。

## 落地現況（2026-07-28 更新）

`docs/superpowers/plans/2026-07-27-notification-plan.md`、`2026-07-28-class-session-cancellation-plan.md`、`2026-07-28-demand-request-cancellation-plan.md`、`2026-07-29-teacher-profile-suspension-plan.md` 已把本文件描述的 notification 資料模型與**大部分** event 落地，但實際落地方式跟本文件原本規劃的「V1 以 email 為主」有一個重要落差，記錄如下：

- **Channel（跟原規劃不同）**：這個 repo 目前沒有接任何 email provider（無套件、無 API key），真的去接一個外部 email 服務超出單輪能自主完成的範圍。V1 實際寫入的 `channel` 是 `in_app`，不是本文件原本規劃的 `email`；`/notifications` 頁面是這個 channel 唯一的投遞終點。`email`／`line`／`sms` 三個 channel 仍然保留在 `NotificationChannel` enum 裡（供未來真的接 email provider 的切片使用），只是 V1 不會寫入這些值。
- **Events（大部分落地）**：下方「Notification Events」表列出的 14 個事件中，已落地 12 個：`teacher_application_submitted`／`teacher_application_approved`／`teacher_application_rejected`／`demand_request_submitted`／`demand_request_published`／`demand_request_rejected`／`demand_response_submitted`／`demand_response_selected`／`class_session_created`／`class_session_cancelled`／`enrollment_confirmed`／`enrollment_cancelled`。**未落地**：`class_session_changed`（「編輯課程」這個動作本身在 V1 還沒接線，見 `docs/domain/permissions-matrix.md` 的 ClassSession 範圍註記）、`class_reminder_basic`（需要排程/背景工作機制，這個 repo 目前沒有 cron/queue infra，屬於未來擴充）。
- **`demand_request_cancelled`（`demand-request-cancellation` 一輪新增，原始 14 個事件表沒有規劃過）**：下方「Notification Events」表是原始規劃，從未包含「demand 被取消」這個事件——`NotificationType` enum 裡也沒有預先保留這個值（不像 `class_session_cancelled` 當初就已經保留），本輪是真的執行了一次 `ALTER TYPE "NotificationType" ADD VALUE 'demand_request_cancelled'` migration。收件人為 Organizer 自己與每一位因連帶取消而受影響的 Teacher（見下一點）；不更動原始表格本身，只在此記錄落地事實。
- **`class_session_cancelled` 的收件人角色（`class-session-cancellation` D7 已確認）**：這個事件同時要通知 Teacher 與被連帶取消的 Member，兩者需要不同文案，既有的 `NotificationRecipientRole`（`self`/`admin`/`counterpart`）不夠用（`counterpart` 原本假設一個事件最多一種對象）。因此新增了第四種角色 `affected_member` 專門用於這個事件；Member 自助取消報名（`enrollment_cancelled`）跟 Organizer 連帶取消（`class_session_cancelled`／`affected_member`）刻意保持成兩個獨立事件，不共用同一份文案。
- **`demand_request_cancelled` 的收件人角色（`demand-request-cancellation` D9 已確認）**：同一類站內落地細節——新增第五種角色 `affected_responder`，代表因連帶取消而受影響的 Teacher（回應被連帶轉為 `declined`）。不沿用 `affected_member`：那份文案是 Enrollment／Member 語境的措辭（「你的報名也一併取消了」），套用在 Teacher／DemandResponse 語境下文法與情境都不對，因此新增一個語意精確的角色名稱，延續 `affected_member` 開始建立的「角色名稱要精確描述受影響對象」慣例。
- **`teacher_profile_suspended`／`teacher_profile_restored`（`teacher-profile-suspension` 一輪新增，原始 14 個事件表沒有規劃過）**：跟 `demand_request_cancelled` 同一類情況——`NotificationType` enum 沒有預先保留這兩個值，本輪真的執行了兩次 `ALTER TYPE ... ADD VALUE` migration。收件人只有 Teacher 自己（`self`），不新增收件人角色、也不通知任何其他角色（跟這個系列其他「連帶取消」事件不同，暫停/恢復不影響其他人已經成立的承諾，見 `docs/domain/state-transition-details.md` TeacherProfile 小節）。發通知前有 best-effort 的過期抑制：暫停與恢復是雙向操作，若狀態在原子寫入之後、發通知之前又被另一次操作改變，就跳過這則已經過期的通知（例如暫停後幾乎同時被恢復，不會讓老師看到一則過期的「已暫停」通知出現在「已恢復」通知之後）。
- **Notification Data／Status**：`Notification` 的欄位清單與 Status 清單（下方兩節）已經照原樣落地，沒有變動。

## Notification 原則

- 通知要清楚、溫和、可信任。
- 通知只提醒重要狀態變更，不製造焦慮或推銷壓力。
- 通知內容不可包含不必要的私人資料。
- 通知事件應由 domain/service layer 觸發，不應散落在 page component。

## Channels

V1 預設：

- `email`

未來可擴充：

- `in_app`
- `line`
- `sms`

未來 channel 不屬於 V1 必做範圍。

## Notification Events

| Event | 收件者 | 觸發時機 | 目的 |
|---|---|---|---|
| `teacher_application_submitted` | Teacher, Admin | 老師送出申請 | 確認申請已收到，提醒 Admin 審核 |
| `teacher_application_approved` | Teacher | Admin approve teacher | 通知老師可開始回應需求 |
| `teacher_application_rejected` | Teacher | Admin reject teacher | 說明審核未通過與下一步 |
| `demand_request_submitted` | Organizer, Admin | 團主送出 demand request | 確認需求已收到，提醒 Admin review |
| `demand_request_published` | Organizer | Admin publish demand | 通知需求已進入 demand pool |
| `demand_request_rejected` | Organizer | Admin reject demand | 說明需求未發布與可修正方向 |
| `demand_response_submitted` | Organizer, Admin | Teacher 提交 response | 通知團主有新的老師回覆 |
| `demand_response_selected` | Teacher, Organizer | response 被選中 | 通知雙方 matching 成立 |
| `class_session_created` | Teacher, Organizer | class session 建立 | 確認課程已形成 |
| `class_session_changed` | Member, Teacher, Organizer | class session 重要資訊變更 | 通知時間、地點或狀態等重要變更 |
| `class_session_cancelled` | Member, Teacher, Organizer | class session 取消 | 通知相關人員課程取消 |
| `enrollment_confirmed` | Member | Member 報名成功 | 確認報名狀態 |
| `enrollment_cancelled` | Member | Member 或 Admin 取消 enrollment | 確認報名已取消 |
| `class_reminder_basic` | Member, Teacher | 課前提醒 | 提醒課程時間與地點 |

Organizer 會收到 class created / changed / cancelled 類通知；V1 課前提醒先發給 Member 與 Teacher，不一定發給 Organizer。

## Email Copy 原則

- 使用繁體中文。
- 語氣清楚、溫和、專業。
- 避免「立即搶購」、「最後機會」、「保證療癒」等語氣。
- 需要 action 時，使用清楚 CTA，例如「查看需求」、「查看課程」、「完成資料補充」。

## Notification Data

`Notification` 建議包含：

- `id`
- `userId`
- `type`
- `channel`
- `title`
- `body`
- `status`
- `createdAt`
- `sentAt`

## Status

建議狀態：

- `pending`
- `sent`
- `failed`
- `cancelled`

## V1 不做

- 複雜行銷 automation
- LINE deep integration
- SMS 付費通知
- 多語系通知
- 個人化 AI 推薦通知
- 大量通知 queue，除非通知量明顯超過 V1 需求
