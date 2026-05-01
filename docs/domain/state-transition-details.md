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
| `submitted` | `approved` | Admin | profile 通過審核 | Teacher 可看 eligible demand requests |
| `submitted` | `rejected` | Admin | profile 不符合要求 | 通知 Teacher 修正方向 |
| `rejected` | `submitted` | Teacher | Teacher 修改資料後重新送審 | 通知 Admin review |
| `approved` | `suspended` | Admin | 品質、安全或營運原因 | Teacher 不可公開或回應新需求 |
| `suspended` | `approved` | Admin | Admin 確認可恢復 | Teacher 恢復 marketplace 權限 |

### 禁止條件

- Teacher 不可 approve 自己。
- `draft` 或 `submitted` teacher 不可回應 demand request。
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
| `confirmed` | `completed` | Admin / Teacher | 課程時間已過且完成 | 可處理 attendance / review |
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
- `attended`
- `cancelled`
- `no_show`

### Transitions

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `pending` | Member | class session 可報名，尚有 capacity，未重複報名 | 建立 enrollment |
| `pending` | `confirmed` | System / Admin | capacity 仍可用 | 通知 Member |
| `confirmed` | `attended` | Admin / Teacher | 課程已完成，會員有出席 | attendance 完成 |
| `confirmed` | `no_show` | Admin / Teacher | 課程已完成，會員未出席 | attendance 完成 |
| `pending` / `confirmed` | `cancelled` | Member / Admin | 符合取消政策 | 釋放名額或保留紀錄 |

### 禁止條件

- 同一 user 不可對同一 class session 建立重複 enrollment。
- Confirmed enrollment 數量不可超過 class capacity。
- `cancelled` enrollment 不可直接轉為 `attended`。
- 已完成課程不應接受新的 enrollment。

## Notification Side Effects

狀態變更可能觸發 notification：

- TeacherProfile submitted / approved / rejected
- DemandRequest submitted / published / rejected
- DemandResponse submitted / selected
- ClassSession created / open_for_enrollment / confirmed / cancelled
- Enrollment confirmed / cancelled

Notification 內容需遵守品牌語氣：清楚、溫和、可信任，不使用焦慮式推銷。
