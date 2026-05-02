# Demand Response and Matching Spec

## 目的

Demand response and matching 讓 approved teacher 可以回應 published demand request，並讓 Organizer 或 Admin 選擇一位合適老師。

V1 不做 advanced AI matching，只做清楚、可審核、人工決策為主的 marketplace matching。

## User Role

主要角色：

- Teacher
- Organizer
- Admin

## Problem

團主需要從老師回覆中找到合適人選；老師也需要判斷需求是否符合自己的專長、地區與時間。平台需要讓雙方有足夠資訊做決策，同時保護私人資料與狀態一致性。

## User Flow

1. Approved Teacher 進入 `/teacher/demands`。
2. Teacher 查看 eligible published demand requests。
3. Teacher 進入需求詳情。
4. Teacher 填寫 response，包括 message、proposed time slots、proposed price。
5. Organizer 在自己的 demand detail 查看 responses。
6. Organizer 可 shortlist response。
7. Organizer 或 Admin select 一位 response。
8. DemandRequest 進入 matched。
9. Selected response 可轉成 ClassSession。

## UI Requirements

- Demand detail 要讓老師快速理解課程類型、人數、地區、時間、程度與預算。
- Teacher response form 要鼓勵專業、溫和、具體的回覆。
- Organizer response view 要能比較老師回覆，但避免像低價競標。
- Selected 狀態要清楚，避免多位老師誤以為自己已被選中。

## Data Requirements

主要資料：

- `DemandRequest`
- `DemandResponse`
- `TeacherProfile`
- `OrganizerProfile`
- `Organization`
- `Notification`
- `AdminNote`

`DemandResponse` 必要欄位：

- `demandRequestId`
- `teacherProfileId`
- `message`
- `proposedTimeSlots`
- `status`

建議欄位：

- `proposedPrice`

## Permission Requirements

- 只有 approved teacher 可提交 response。
- Teacher 只能查看 published / eligible demand requests。
- Teacher 只能編輯或 withdraw 自己的 response，且僅限 selected 前。
- Organizer 只能查看自己 demand request 的 responses。
- Admin 可查看與管理所有 responses。
- V1 一個 demand request 只能有一個 selected response。

## State Transitions

`DemandResponse`：

```text
submitted → shortlisted → selected
```

終止狀態：

```text
declined
withdrawn
expired
```

`expired` 必須同步存在於 `DemandResponse` data model enum。

`DemandRequest`：

```text
published → teacher_responded → matched
```

## RWD Requirements

- Teacher demand list 手機版需可快速掃描需求重點。
- Response form 手機版可填寫長文字。
- Organizer 比較 responses 時，手機版應使用 cards，不使用寬表格。

## Acceptance Criteria

- Approved Teacher 可以提交 response。
- 未 approved 或 suspended teacher 不可提交 response。
- Organizer 可以看見自己 demand request 的 responses。
- Organizer 不可看見其他 organizer 的 responses。
- Teacher 可以 withdraw 未 selected 的 response。
- Organizer 或 Admin 可以 select 一位 response。
- 同一 demand request 不可同時有多個 selected response。
- Selected response 會通知 teacher 與 organizer。

## Non-goals

- AI matching
- 自動排名老師
- 競標系統
- 複雜價格談判工具
- 合約自動產生
- 付款 escrow

## Risks

- 如果 response view 太像比價工具，會偏離品牌。
- 如果老師看到太多私人 organizer 資料，會造成資料邊界風險。
- 如果多位 response 同時 selected，會造成 class formation 混亂。
