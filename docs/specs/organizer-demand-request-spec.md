# Organizer Demand Request Spec

## 目的

Organizer demand request 讓團主可以用清楚、安心的方式提出瑜伽團課需求，並讓 Admin review 後發布到 demand pool。

V1 的重點是收集足夠形成媒合的資訊，不是建立複雜企業採購系統。

## User Role

主要角色：

- Visitor
- Organizer
- Admin
- Teacher

## Problem

團主通常知道自己想要「幫一群人安排瑜伽課」，但不一定知道如何描述課程類型、程度、時間、地點與預算。平台需要引導團主把需求說清楚，同時避免需求未審核就公開造成品質風險。

## User Flow

1. Visitor 進入 `/organizers/request`。
2. Visitor 了解 Free Soar Yoga 如何協助團體開課。
3. Visitor 註冊或登入成為 Organizer。
4. Organizer 建立或確認 `Organization` 與 `OrganizerProfile`。
5. Organizer 填寫 demand request form。
6. Organizer 儲存 draft 或 submit demand request。
7. Admin review submitted demand request。
8. Admin publish 或 reject。
9. Published demand request 進入 teacher demand pool。

## UI Requirements

- 表單語氣要像被引導，不像填公文。
- 表單需分段：團體資訊、課程需求、時間地點、預算與備註。
- 需提供清楚的送出後狀態，例如「已收到，待平台審核」。
- Organizer dashboard 要能看見每個 demand request 的 status。

## Data Requirements

主要資料：

- `User`
- `OrganizerProfile`
- `Organization`
- `DemandRequest`
- `ServiceType`
- `AdminNote`
- `Notification`

`DemandRequest` 必要欄位：

- `organizerProfileId`
- `organizationId`
- `title`
- `serviceTypeId`
- `description`
- `targetLevel`
- `expectedParticipants`
- `preferredAreas`
- `preferredTimeSlots`
- `classLengthMinutes`
- `frequency`
- `status`

## Permission Requirements

- Visitor 可看 organizer request entry。
- Organizer 只能建立與查看自己的 demand requests。
- Organizer 可編輯 draft；submitted 後是否可編輯需依 policy。
- Admin 可 review、publish、reject demand request。
- Teacher 只能看 published 且 eligible 的 demand request。

## State Transitions

`DemandRequest`：

```text
draft → submitted → under_review → published
published → teacher_responded → matched → converted_to_class
```

終止狀態：

```text
cancelled
expired
rejected
completed
```

## RWD Requirements

- 手機版可以完成 demand request form。
- 長欄位需有清楚 label、helper text 與錯誤訊息。
- 日期、時間、地區選擇需避免手機操作困難。
- Organizer dashboard 在手機上以 list / cards 呈現，不使用難讀的大表格。

## Acceptance Criteria

- Organizer 可以建立 draft demand request。
- Organizer 可以 submit demand request。
- Submitted demand request 會出現在 Admin review list。
- Admin 可以 publish demand request。
- Admin 可以 reject demand request 並填寫 reason。
- Published demand request 才能被 approved teacher 看見。
- Organizer 可以看見自己需求的所有狀態。
- Organizer 不可看見其他 organizer 的私人 demand request。

## Non-goals

- 複雜企業採購流程
- 多層 organization hierarchy
- enterprise approval workflow
- 自動 AI matching
- 付款與報價合約自動化
- Google Calendar two-way sync

## Risks

- 需求欄位太少會讓老師無法判斷是否回應。
- 欄位太多會讓團主放棄填寫。
- 未審核需求公開會造成品質與安全問題。
- 預算呈現若太強調價格，會讓產品偏向 discount marketplace。
