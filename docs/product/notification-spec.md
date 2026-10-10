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
- **`teacher_photo_removed`（`teacher-showcase-photos` 票 07 新增，2026-10-10）**：管理員下架老師的一張照片時，通知該老師本人（收件人角色 `self`；文案含下架原因，連到 `/teacher/profile/photos`）。**只發站內通知**：`EMAIL_POLICY.teacher_photo_removed` 為空陣列，不寄 email，避免管理動作變成打擾。下架成功之後才發，通知失敗只記錄，不撤銷已完成的下架。migration `20261010045913_teacher_photo_removed_notification`（`ALTER TYPE ... ADD VALUE`）。
- **`teacher_profile_suspended`／`teacher_profile_restored`（`teacher-profile-suspension` 一輪新增，原始 14 個事件表沒有規劃過）**：跟 `demand_request_cancelled` 同一類情況——`NotificationType` enum 沒有預先保留這兩個值，本輪真的執行了兩次 `ALTER TYPE ... ADD VALUE` migration。收件人只有 Teacher 自己（`self`），不新增收件人角色、也不通知任何其他角色（跟這個系列其他「連帶取消」事件不同，暫停/恢復不影響其他人已經成立的承諾，見 `docs/domain/state-transition-details.md` TeacherProfile 小節）。發通知前有 best-effort 的過期抑制：暫停與恢復是雙向操作，若狀態在原子寫入之後、發通知之前又被另一次操作改變，就跳過這則已經過期的通知（例如暫停後幾乎同時被恢復，不會讓老師看到一則過期的「已暫停」通知出現在「已恢復」通知之後）。
- **`class_session_completed`／`review_submitted`（`class-session-review` 一輪新增，原始 14 個事件表沒有規劃過）**：跟 `demand_request_cancelled`、`teacher_profile_suspended`／`teacher_profile_restored` 同一類情況——`NotificationType` enum 沒有預先保留這兩個值，本輪真的執行了一次含兩個新值的 `ALTER TYPE ... ADD VALUE` migration。`class_session_completed` 由 `completeOwnClassSession` 成功後觸發，收件人是該課程所有 `confirmed` enrollment 的 Member（角色 `affected_member`，沿用 `class_session_cancelled` 已建立的角色），目的是邀請留下評價；沒有任何 `confirmed` enrollment 時不觸發（不寄空收件人清單）。`review_submitted` 由 `submitReviewForUser`（`src/domain/review/__internal__/submit-review-core.ts`）成功寫入評價後觸發，收件人只有該課程的授課老師一人（角色 `counterpart`），刻意不通知 Organizer 或 Admin（V1 沒有任何評價管理／審核介面，見 `docs/domain/permissions-matrix.md` 的 Review 小節）。兩者都在寫入成功之後才執行、try/catch 隔離失敗，不影響已經成功的狀態轉換或評價寫入本身（比照既有先例）。
- **Notification Data／Status**：`Notification` 的欄位清單與 Status 清單（下方兩節）已經照原樣落地，沒有變動。

## Email 落地（2026-10-09）

依 `docs/superpowers/plans/2026-08-01-transactional-email-plan.md` 實作，產品主人 2026-10-09 確認 M1–M6 照 plan 建議。上一節「V1 只寫 in_app」的描述已不再完整：

- **兩個 channel 並存**：`notifyUsers()` 先照舊寫站內通知，再依寄送規則另建一筆 `channel="email"` 記錄並寄出。`/notifications` 只顯示 `in_app`，不會重複。
- **寄送規則**：`src/domain/notification/email-policy.ts` 是唯一依據，列出 25 種 `NotificationType` 各自要寄給哪些收件角色；目前已接線的「類型 × 角色」都寄，`review_submitted` 寄給授課老師，`class_reminder_basic` 未接線不寄。新增通知類型而沒補這張表時編譯會失敗。
- **寄送模式** `EMAIL_DELIVERY_MODE`：`disabled`（預設，不寄）／`allowlist`（只寄 `EMAIL_ALLOWED_RECIPIENTS`）／`live`（全部寄，網址須為 https 且不可是 localhost）。設定缺漏一律不寄，只記一次不含值的錯誤 log。
- **寄信出口**：Resend 官方 HTTPS API＋Node `fetch`（未安裝 SDK），逾時預設 5 秒並中斷請求；`Idempotency-Key` 為 `notification-<Notification.id>`。
- **信件內容**：沿用站內通知文案，繁中，HTML＋純文字，品牌色票；所有插值 escape。按鈕連到 `/sign-in?callbackUrl=<目標頁>`：已登入直接進目標頁，未登入登入後回到目標頁；目標頁沿用站內通知的連結規則（`link.ts`），進頁面時照原本規則檢查權限。這點取代 plan E5「一律連 `/notifications`」：產品主人選了「按鈕直連目標頁」，而連結規則本來就只用白名單路徑。
- **失敗處理**：每位收件人獨立；寄信失敗只把該筆 email 標 `failed`，站內通知與原本的操作照常成功，不自動重寄。沒有信箱的使用者略過。
- **尚未完成**：產品主人還沒有 Resend 帳號與驗證網域，所以目前只以假的寄信出口完成自動化測試（`tests/smoke/transactional-email.spec.ts`），沒有真實寄送。啟用步驟見 plan 的「啟用步驟」。

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

## 合作邀請通知（organizer-usability-redesign 票 12，2026-10-05 已落地）

- 事件與收件人：邀請送出／重送 → 受邀老師（`class_proposal_invited`）；等待確認中修改內容 → 受邀老師（`class_proposal_revised`）；老師確認／婉拒 → 團主（`class_proposal_confirmed`／`class_proposal_declined`，婉拒附原因）；撤回或換老師 → 曾看到邀請的原老師（`class_proposal_withdrawn`，撤回附說明）；團主開放報名 → 老師（`class_session_created`）。本人授課不寄給自己。
- 直達單筆：通知帶 `targetType`＋`targetId`，連到團主或老師端的邀請頁／課程頁；舊通知照舊連到列表頁。
- 防重複：`eventKey` 唯一，同一次轉換重試只會有一則；不同步驟（例如送出 → 婉拒 → 不修改重送 → 再婉拒）各自發送。
- 通知在 domain transaction commit 之後發送，失敗只記 log，不回滾已完成的轉換。仍只寫 in_app，不寄 email、不加未讀數。
