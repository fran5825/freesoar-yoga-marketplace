# Notification Spec

## 目的

本文件定義 Free Soar Yoga V1 的 basic notification 規格。V1 以 email notification 為主，保留未來擴充 channel 的資料模型空間，但不做 LINE deep integration 或複雜自動化。

## 落地現況（2026-07-28 更新）

`docs/superpowers/plans/2026-07-27-notification-plan.md` 已把本文件描述的 notification 資料模型與**部分** event 落地，但實際落地方式跟本文件原本規劃的「V1 以 email 為主」有一個重要落差，記錄如下：

- **Channel（跟原規劃不同）**：這個 repo 目前沒有接任何 email provider（無套件、無 API key），真的去接一個外部 email 服務超出單輪能自主完成的範圍。V1 實際寫入的 `channel` 是 `in_app`，不是本文件原本規劃的 `email`；`/notifications` 頁面是這個 channel 唯一的投遞終點。`email`／`line`／`sms` 三個 channel 仍然保留在 `NotificationChannel` enum 裡（供未來真的接 email provider 的切片使用），只是 V1 不會寫入這些值。
- **Events（部分落地）**：下方「Notification Events」表列出的 14 個事件中，已落地 11 個：`teacher_application_submitted`／`teacher_application_approved`／`teacher_application_rejected`／`demand_request_submitted`／`demand_request_published`／`demand_request_rejected`／`demand_response_submitted`／`demand_response_selected`／`class_session_created`／`enrollment_confirmed`／`enrollment_cancelled`。**未落地**：`class_session_changed`／`class_session_cancelled`（因為「編輯課程」「取消課程」這兩個動作本身在 V1 都還沒接線，見 `docs/domain/permissions-matrix.md` 的 ClassSession 範圍註記）、`class_reminder_basic`（需要排程/背景工作機制，這個 repo 目前沒有 cron/queue infra，屬於未來擴充）。
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
