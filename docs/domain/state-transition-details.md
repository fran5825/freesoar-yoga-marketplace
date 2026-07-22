# State Transition Details

## 目的

本文件補充 V1 marketplace 核心 state machine 的轉換細節，包含觸發者、前置條件、後置效果與禁止條件。

所有狀態變更都應集中在 domain/service layer，避免散落在 page component。

## TeacherProfile

### 狀態

- `draft`
- `submitted`
- `approved`
- `rejected`
- `suspended`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `submitted` | Teacher | 必填 profile 欄位完成 | 通知 Admin review |
| `submitted` | `approved` | Admin | profile 通過審核 | 清空 `rejectionReason`；Teacher 可看 eligible demand requests |
| `submitted` | `rejected` | Admin | profile 不符合要求，且 Admin 已填寫具體 rejection reason（必填） | 保存 `rejectionReason`；Teacher 於 dashboard / join 看見 reason（V1 以站內顯示告知，email 為後續切片） |
| `rejected` | `submitted` | Teacher | Teacher 依 reason 修改資料後重新送審 | 清空 `rejectionReason`（進入審核中不再顯示舊原因）；通知 Admin review |
| `approved` | `suspended` | Admin | 品質、安全或營運原因 | Teacher 不可公開或回應新需求 |
| `suspended` | `approved` | Admin | Admin 確認可恢復 | Teacher 恢復 marketplace 權限；正式 restore UI / API 是否納入 V1 需 product owner 另行批准 |

### V1 policy notes

- Member / Organizer 在 V1 只可看見 `approved` teacher。
- `draft`、`submitted`、`rejected`、`suspended` teacher 都不公開顯示，也不可建立 demand response。
- `submitted` 後核心申請欄位不可由 Teacher 直接編輯；若未來需要 edit-after-submit，需另開 product decision。
- `rejected` teacher 可依 Admin reason 修改後重新送審；V1 不限制重新送審次數，不新增 counter / lockout。
- **Rejection reason（V1）**：Admin 執行 `submitted → rejected` 時**必填** rejection reason，保存於 `TeacherProfile.rejectionReason`（面向老師的退回說明，與內部 `AdminNote` 分離）。reason 以 `normalizedReason = input.trim()` 為準：驗證且持久化 trim 後值，長度 10–1000 字。lifecycle：`rejected` 期間**保留**（供老師邊看邊改）、`rejected → submitted` 與 `approve` 時**清空**、再次 reject **覆蓋**（單欄位、只留最新、不保留歷史）。V1 以站內顯示（dashboard / join）作為對老師的告知，**不寄 email**；email/notification 為後續切片 `teacher-application-rejection-notification`。
- `suspended → approved` 是 allowed policy，但完整 restore flow 可作為 future slice / admin-manual decision，不代表 V1 必須立即實作正式 restore UI / API。

### Admin action matrix

| Current status | V1 Admin actions |
|---|---|
| `submitted` | `approve`, `reject` |
| `approved` | `suspend` |
| `rejected` | view reason / history；Teacher 可重新 submit，不需要 Admin 主動重開 |
| `suspended` | `restore to approved` 可在 policy 上允許；正式 UI / API 是否實作由 product owner 另行批准 |

### 禁止條件

- Teacher 不可 approve 自己。
- `draft` 或 `submitted` teacher 不可回應 demand request。
- `rejected` teacher 不可回應 demand request。
- `suspended` teacher 不可公開顯示或建立新 response。

## DemandRequest

### 狀態

- `draft`
- `submitted`
- `under_review`
- `published`
- `teacher_responded`
- `matched`
- `converted_to_class`
- `completed`
- `cancelled`
- `expired`
- `rejected`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `submitted` | Organizer | 必填需求欄位完成 | 通知 Admin review |
| `submitted` | `under_review` | Admin | Admin 開始審查 | demand 進入審核中 |
| `under_review` | `published` | Admin | 需求清楚且適合平台 | Approved teachers 可見 |
| `under_review` | `rejected` | Admin | 需求不適合或資料不足 | 通知 Organizer |
| `published` | `teacher_responded` | Teacher | approved teacher 提交 response | Organizer 收到通知 |
| `teacher_responded` | `matched` | Organizer / Admin | 選定一個 response | selected teacher 與 organizer 收到通知 |
| `matched` | `converted_to_class` | Organizer / Admin | class session 必要資料可建立 | 建立 ClassSession |
| `converted_to_class` | `completed` | Admin | class session 已完成 | demand flow 結束 |
| Any active state | `cancelled` | Organizer / Admin | 取消原因成立 | 停止 matching 或 class formation |
| `published` / `teacher_responded` | `expired` | System / Admin | 超過有效期限 | 不再接受新 response |

### 禁止條件

- 未 published demand 不可被 Teacher demand pool 看見。
- `converted_to_class` 後不可修改會破壞 ClassSession 的核心欄位。
- V1 不允許一個 demand 同時 matched 多位 teacher。

## DemandResponse

### 狀態

- `submitted`
- `shortlisted`
- `selected`
- `declined`
- `withdrawn`
- `expired`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `submitted` | Teacher | Teacher approved，DemandRequest published | 通知 Organizer |
| `submitted` | `shortlisted` | Organizer / Admin | response 屬於自己的 demand 或 Admin action | response 標記為候選 |
| `submitted` / `shortlisted` | `selected` | Organizer / Admin | demand 尚未有 selected response | DemandRequest 可進入 matched |
| `submitted` / `shortlisted` | `declined` | Organizer / Admin | 不選擇此 response | response 結束 |
| `submitted` / `shortlisted` | `withdrawn` | Teacher | 尚未 selected | response 結束 |
| `submitted` / `shortlisted` | `expired` | System / Admin | demand expired 或過期 | response 結束 |

### 禁止條件

- `selected` response 不可由 Teacher 自行 withdraw，需走取消或 Admin 流程。
- 同一 demand request 不可有多個 `selected` response。
- 未 approved teacher 不可建立 response。

## ClassSession

### 狀態

- `draft`
- `pending_confirmation`
- `open_for_enrollment`
- `confirmed`
- `completed`
- `cancelled`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `pending_confirmation` | Organizer / Admin | teacher、organizer、service type、時間、地點、capacity 初步完整 | 等待確認 |
| `pending_confirmation` | `open_for_enrollment` | Organizer / Admin | 必要欄位完整，無明顯排程衝突 | Member 可報名 |
| `open_for_enrollment` | `confirmed` | Organizer / Admin | 開課條件成立 | 課程確認 |
| `confirmed` | `completed` | Admin | 課程時間已過且完成 | 可處理後續管理紀錄 |
| Any active state | `cancelled` | Organizer / Admin | 取消原因成立 | 停止 enrollment，通知相關人員 |

### 禁止條件

- 缺少 time、location、capacity 的 class session 不可 open_for_enrollment。
- `cancelled` class session 不可接受新 enrollment。
- `completed` class session 不可任意修改核心欄位。
- ClassSession 必須檢查 teacher schedule conflict。

## Enrollment

### 狀態

- `pending`
- `confirmed`
- `cancelled`

Future / admin-only 後續能力：

- `attended`
- `no_show`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `pending` | Member | class session 可報名，尚有 capacity，未重複報名 | 建立 enrollment |
| `pending` | `confirmed` | System / Admin | capacity 仍可用 | 通知 Member |
| `pending` / `confirmed` | `cancelled` | Member / Admin | 符合取消政策 | 釋放名額或保留紀錄 |

Future / admin-only 後續能力：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `confirmed` | `attended` | Admin | 課程已完成，會員有出席 | attendance 完成 |
| `confirmed` | `no_show` | Admin | 課程已完成，會員未出席 | attendance 完成 |

### 禁止條件

- 同一 user 不可對同一 class session 建立重複 enrollment。
- Confirmed enrollment 數量不可超過 class capacity。
- `cancelled` enrollment 不可直接轉為 `attended`。
- 已完成課程不應接受新的 enrollment。
- V1 不做完整 Teacher attendance workflow。

## Notification Side Effects

狀態變更可能觸發 notification：

- TeacherProfile submitted / approved / rejected（**V1 落地範圍**：`submitted → rejected` 對老師的告知在 V1 以站內顯示 `rejectionReason` 實現，email 為後續切片 `teacher-application-rejection-notification`）
- DemandRequest submitted / published / rejected
- DemandResponse submitted / selected
- ClassSession created / open_for_enrollment / confirmed / cancelled
- Enrollment confirmed / cancelled

Notification 內容需遵守品牌語氣：清楚、溫和、可信任，不使用焦慮式推銷。
