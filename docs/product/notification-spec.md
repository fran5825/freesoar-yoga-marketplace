# Notification Spec

## 目的

本文件定義 Free Soar Yoga V1 的 basic notification 規格。V1 以 email notification 為主，保留未來擴充 channel 的資料模型空間，但不做 LINE deep integration 或複雜自動化。

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
