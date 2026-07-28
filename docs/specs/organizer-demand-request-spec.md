# Organizer Demand Request Spec

## 目的

Organizer demand request 讓團主可以用清楚、安心的方式提出瑜伽團課需求，並讓 Admin review 後發布到 demand pool。

V1 的重點是收集足夠形成媒合的資訊，不是建立複雜企業採購系統。

## 落地現況（2026-07-28 更新）

本 spec 原始描述的 `organizer-demand-request-foundation` 這一輪明確**不做** demand cancel/expire flow（見下方 Non-goals；`under_review`/`cancelled`/`expired` 皆不在該輪 scope）。這件事後來由 `docs/superpowers/plans/2026-07-28-demand-request-cancellation-plan.md` 補上：

- **已出貨**：Organizer own-scoped 可從 `draft`/`submitted`/`published`/`matched` 四個狀態取消自己的 demand request，**明確排除** `converted_to_class`（已有 `ClassSession` 存在，`onDelete: Restrict` 外鍵會產生語意矛盾資料，該狀態下要取消應改用 `class-session-cancellation` 取消對應的 `ClassSession`）；Admin 不介入。取消時，同一 transaction 內把該 demand 底下所有 `submitted`／`selected` 的 `DemandResponse` 一併轉為 `declined`（連帶取消，reuse 既有值，不新增新的 `DemandResponseStatus`），Organizer 自己與每一位受影響的 Teacher 都會收到站內通知（`demand_request_cancelled` 事件，見 `docs/product/notification-spec.md`）。不做取消原因欄位。
- 詳細狀態轉換、前置條件與併發設計見 `docs/domain/state-transition-details.md`、`docs/domain/state-machines.md`、`docs/domain/permissions-matrix.md`。

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
4. Organizer 於 `/organizer/profile` 建立或確認 `Organization` 與 `OrganizerProfile`（任何 signed-in user 皆可自助建立，見 Permission Requirements）。
5. Organizer 於 `/organizer/demands/new` 填寫 demand request form，或於 `/organizer/demands/[id]/edit` 重新開啟既有 draft 續填。
6. Organizer 儲存 draft 或 submit demand request。
7. Admin 於 `/admin/demands` review submitted demand request。
8. Admin publish 或 reject（reject 需填 organizer-facing reason）。
9. Published demand request **未來**才進入 teacher demand pool——**`organizer-demand-request-foundation` 這一輪 foundation 只保證「published 才是 eligible 前提」這個資料/狀態事實，不建立任何 teacher-facing 查詢介面**；demand pool 查詢本身是後續獨立 slice 的 scope。

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
- `Notification`（V1 foundation 延後，見 Non-goals）

`organizer-demand-request-foundation` 已確認：`ServiceType` **不**落地為獨立 model，V1 改採應用層受控字串（`DemandRequest.serviceType`，見 `docs/domain/data-model.md`）；`AdminNote` 本輪**不建立**，reject reason 走 `DemandRequest.rejectionReason` 專用欄位（teacher-facing 語意，與內部 admin note 分離）。

`DemandRequest` 必要欄位（submit 時）：

- `organizerProfileId`（server 解析，不接受 client 傳入）
- `organizationId`（server 解析，不接受 client 傳入）
- `title`
- `serviceType`
- `description`
- `targetLevel`
- `expectedParticipants`
- `preferredAreas`
- `preferredTimeSlots`
- `classLengthMinutes`
- `frequency`
- `status`
- `rejectionReason`（admin 於 reject 時寫入，organizer 不可自行編輯）

## Permission Requirements

- Visitor 可看 organizer request entry（`/organizers/request`，唯讀導引，不含表單提交）。
- 任何 signed-in user 可自助建立自己的 `OrganizerProfile` + `Organization`（`organizer-demand-request-foundation` D1 已確認，見 `docs/domain/permissions.md`）。
- Organizer 只能建立與查看自己的 demand requests；不可藉由傳入他人 `organizerProfileId`/`organizationId` 存取他人資料。
- Organizer 可編輯 `draft` demand（含重新開啟續編）；**submitted 後不可編輯**（V1 policy，非 policy TBD）。
- Admin 可 review、publish、reject demand request；只有 Admin 可執行 publish/reject。
- Teacher 只能看 published 且 eligible 的 demand request——**本輪 foundation 不建立此查詢介面**，屬未來 demand pool slice scope。
- draft / submitted / rejected 的 demand 不可被其他 Organizer 或 Teacher 看見。

## State Transitions

`DemandRequest` 完整最終設計：

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

**`organizer-demand-request-foundation` V1 已接線範圍**（詳見 `docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`）：

```text
draft → submitted → published | rejected
```

V1 **跳過** `under_review`（Admin 直接 publish 或 reject，不設「審查中」中間狀態）；`rejected` 為**終局狀態**，不提供重新送審路徑，organizer 需另建新 demand；`teacher_responded` 之後的所有 transition 與 `cancelled`/`expired` 皆不在本輪 scope，enum 值保留供未來 slice 使用。

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
- Admin 可以 reject demand request 並填寫必填的 organizer-facing reason（trim 後 10–1000 字）；`rejected` 為終局狀態，reason 永久保留、不提供 resubmit。
- Published demand request 才是未來 approved teacher 可見的資料前提（本輪不建 teacher 查詢介面本身）。
- Organizer 可以看見自己需求的所有狀態。
- Organizer 不可看見其他 organizer 的私人 demand request。

## Non-goals

- 複雜企業採購流程
- 多層 organization hierarchy
- enterprise approval workflow
- 自動 AI matching
- 付款與報價合約自動化
- Google Calendar two-way sync
- **`organizer-demand-request-foundation` 這一輪額外明確不做**：Teacher demand pool 查詢介面、`DemandResponse`/teacher matching、`ClassSession`、`Enrollment`、email/notification（V1 以站內 status 顯示告知，見 D14）、`under_review` transition、demand cancel/expire flow、`AdminNote`。

## Risks

- 需求欄位太少會讓老師無法判斷是否回應。
- 欄位太多會讓團主放棄填寫。
- 未審核需求公開會造成品質與安全問題。
- 預算呈現若太強調價格，會讓產品偏向 discount marketplace。
