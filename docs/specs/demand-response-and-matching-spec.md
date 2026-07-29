# Demand Response and Matching Spec

## 目的

Demand response and matching 讓 approved teacher 可以回應 published demand request，並讓 Organizer 或 Admin 選擇一位合適老師。

V1 不做 advanced AI matching，只做清楚、可審核、人工決策為主的 marketplace matching。

## 落地現況（2026-07-26 更新）

本 spec 描述的完整 user flow 分批落地：

- **已出貨**（`docs/superpowers/plans/2026-07-21-teacher-demand-pool-response-plan.md`，D1–D16 已拍板、Codex 16 rounds 通過、已 commit + push 進 `main`）：User Flow 第 1–5 步——Teacher 瀏覽 published demand pool、查看 detail、提交/撤回 response，以及 Organizer 唯讀查看自己 demand 收到的 responses。
- **已出貨**（`docs/superpowers/plans/2026-07-25-demand-response-selection-and-matching-plan.md`）：User Flow 第 7–8 步——Organizer 對自己 demand 底下的 response 執行 select（own-scoped，**Admin 不介入**，與本文件 Permission Requirements 原文「Admin 可查看與管理所有 responses」不同——V1 Admin 僅維持既有的 publish/reject 職責，未涉入 matching 決策）；select 成功時同一 transaction 內把同 demand 其餘 `submitted` response 轉 `declined`，並把 `DemandRequest` 轉 `matched`。**第 6 步（shortlist）未落地**：V1 跳過候選階段，Organizer 直接對任一 `submitted` response 一步到位 select；`shortlisted` enum 值保留但不接線。`DemandResponseStatus` enum（完整 6 值）已全數接線除 `shortlisted`/`expired` 外的狀態；`DemandRequestStatus` 的 `matched` 已接線（來源狀態是 `published`，不經過未接線的 `teacher_responded`）。
- **尚未落地**（下一份獨立 plan 的範圍）：User Flow 第 9 步——selected response 轉成 `ClassSession`（`DemandRequest: matched → converted_to_class`）。本文件其餘章節（Permission/State Transitions/Acceptance Criteria）仍是這個剩餘範圍的產品層 source of truth。
- **修正（`docs/superpowers/plans/2026-07-29-teacher-profile-suspension-plan.md` 已確認）**：select 這個動作現在額外要求該 response 所屬的 `TeacherProfile.status = 'approved'`——如果這位老師在提交回應之後、被選定之前被 Admin 暫停，select 會回傳明確的 `response_teacher_not_approved` 錯誤，不會讓暫停後才成立的新媒合承諾繼續生效。已經 `selected` 的 response 不受影響。

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
