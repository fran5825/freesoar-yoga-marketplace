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

### V1 policy notes（`organizer-demand-request-foundation`、`demand-response-selection-and-matching`、`class-session-creation` 已確認）

上方 Transitions 表格是 marketplace 的完整最終設計；目前**只落地**以下子集，其餘列為未來 slice（Enrollment 之後的 class conversion）的設計參考：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `submitted` | Organizer | 必填需求欄位完成（`title`/`serviceType`/`description`/`targetLevel`/`expectedParticipants`/`preferredAreas`≥1/`preferredTimeSlots`≥1/`classLengthMinutes`/`frequency`），且所連 `Organization` 的 `contactName`/`contactEmail`/`contactPhone` 皆已填寫 | demand 進入待審核；V1 以站內 status 顯示告知 Organizer，不寄 email |
| `submitted` | `published` | Admin | 需求清楚且適合平台 | Approved teacher 可在 demand pool 看見 |
| `submitted` | `rejected` | Admin | 需求不適合或資料不足，且 Admin 已填寫具體 rejection reason（必填，trim 後 10–1000 字） | 保存 `rejectionReason`；Organizer 於自己 dashboard / demand detail 看見 reason（V1 以站內顯示告知，email 為後續切片） |
| `published` | `matched` | Organizer | demand 尚無 selected response，且 Organizer 對一筆屬於自己 demand 的 `submitted` response 執行 select | 該 response 轉 `selected`、同 demand 其餘 `submitted` response 轉 `declined`（同一 transaction） |
| `matched` | `converted_to_class` | Organizer | demand 尚無 `ClassSession`，且 Organizer 已於建立表單一次到位填齊 `ClassSession` 必要欄位並通過驗證 | 同一 transaction 內原子建立 `ClassSession`（`status="draft"`） |

- **V1 跳過 `under_review`**：Admin review 直接 `submitted → published | rejected`，不提供「開始審查」的中間狀態或動作（對齊 `TeacherProfile` 的 `submitted → approved|rejected` 簡化先例）。`under_review` 的 enum 值保留，但無對應 transition。
- **`rejected` 在 V1 是終局狀態**：不提供 `rejected → draft/submitted` 的重新送審路徑；organizer 需依 reason 另建新的 `DemandRequest`。因此 reason 寫入後**永久保留**於該（終局）demand，不需要清空邏輯（與 `TeacherProfile.rejectionReason` 的「清空/覆蓋」lifecycle不同，因為 demand 沒有 resubmit 路徑）。
- **Rejection reason（V1）**：與 `TeacherProfile.rejectionReason` 相同慣例——`normalizedReason = input.trim()`，驗證且持久化 trim 後值，長度 10–1000 字；`rejectionReason` 是面向該 demand 所屬 organizer 的退回說明，與內部 `AdminNote` 語意分離（不建 `AdminNote`）。
- **`cancelled` / `expired` 不在目前範圍**：enum 值保留，V1 不實作 organizer 撤回 draft/submitted 或系統過期的 UI/flow。
- **`published → matched` 不經過 `teacher_responded`**：與上方完整設計表格第 79 列不同——`teacher-demand-pool-response-plan` D11 選擇動態推導、不 persist `teacher_responded`，`demand-response-selection-and-matching` 沿用同一決定，因此實際接線的來源狀態是 `published`，不是 `teacher_responded`。
- **`matched → converted_to_class` 僅 Organizer own-scoped，Admin 不介入**（`class-session-creation` D1，比照 `demand-response-selection-and-matching` D2 的同一先例）。Class conversion 之後的所有 transition（`converted_to_class → completed`／`cancelled`）不在目前 scope。

### Admin action matrix（`organizer-demand-request-foundation` V1）

| Current status | V1 Admin actions |
|---|---|
| `submitted` | `publish`, `reject` |
| `published` | 無（本輪不提供 cancel/expire） |
| `rejected` | 唯讀（終局狀態，無 Admin 後續動作） |

### 禁止條件

- 未 published demand 不可被 Teacher demand pool 看見。
- `converted_to_class` 後不可修改會破壞 ClassSession 的核心欄位。
- V1 不允許一個 demand 同時 matched 多位 teacher。
- `draft`/`submitted`/`rejected` 的 `DemandRequest` 不可被其他 Organizer 或 Teacher 看見（own-only / not-yet-eligible）。
- 非 Admin 不可執行 `publish` / `reject`。

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

### V1 policy notes（`teacher-demand-pool-response-plan`、`demand-response-selection-and-matching` 已確認）

上方 Transitions 表格是 marketplace 的完整最終設計；目前**只落地**以下子集：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `submitted` | Teacher | Teacher approved，DemandRequest published | Organizer 可在自己 demand detail 查看 |
| `submitted` | `withdrawn` | Teacher | 尚未 selected；suspended teacher 不可執行（仍可查看） | response 結束，不可再重新提交 |
| `submitted` | `selected` | Organizer | own-scoped，demand 尚無 selected response | DemandRequest 同一 transaction 內轉 `matched` |
| `submitted` | `declined` | System（select 觸發，非 Organizer 手動） | 同 demand 有另一筆 response 被 select | 與上一列同一 transaction 內完成，非獨立動作 |

- **`shortlisted` 不接線**：V1 跳過候選階段，Organizer 直接對任一 `submitted` response 執行 select（`demand-response-selection-and-matching` D1）；enum 值保留供未來使用。
- **Select 僅 Organizer own-scoped，Admin 不介入**（D2）：與上方完整設計表格「Organizer / Admin」不同，V1 未開放 Admin 執行 select。
- **Decline 不是獨立的 Organizer 手動動作**：select 成功時，同一 transaction 內自動把同 demand 其餘 `submitted` response 轉為 `declined`（D3），沒有對應的手動 decline UI/API。
- **`expired` 不接線**：無 demand 過期機制，enum 值保留。

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

### V1 policy notes（`class-session-creation` 已確認）

上方 Transitions 表格是最終設計；目前**只落地** `(none) → draft`，由 `DemandRequest: matched → converted_to_class` 同一 transaction 觸發建立（見上方 DemandRequest V1 policy notes）。

- **一次到位建立，無編輯**：`title`/`description`（選填）/`serviceType`/`startAt`/`endAt`/`location`/`capacity`/`isPublic` 皆於建立當下一次填齊並通過驗證，建立後不提供編輯（D2）；因此不存在「資料不完整的 draft」，`draft` 語意純粹是「已建立、尚未開放報名」。
- **`pending_confirmation`/`open_for_enrollment`/`confirmed`/`completed`/`cancelled` 不接線**：`open_for_enrollment` 的存在意義是讓 Member 報名，但 Enrollment 屬未來獨立 plan，提前接線沒有實質使用者價值也無法驗證（D9）。
- **Teacher schedule conflict 檢查目前不做**：沒有 `TeacherAvailability` 或任何排程資料可供檢查，`ClassSession 必須檢查 teacher schedule conflict` 這條禁止條件屬完整設計，本輪不接線（D8）。
- **時區**：`startAt`/`endAt` 一律以固定 `Asia/Taipei`（UTC+8，無 DST）偏移量解析與顯示，不依賴伺服器或瀏覽器當地時區設定（D13）。

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
- DemandRequest submitted / published / rejected（**V1 落地範圍**：`organizer-demand-request-foundation` D14 已確認延後 email/notification，V1 只以 organizer 自己 dashboard 的站內 status 顯示告知；email 為後續切片 `organizer-demand-notification`）
- DemandResponse submitted / selected
- ClassSession created / open_for_enrollment / confirmed / cancelled
- Enrollment confirmed / cancelled

Notification 內容需遵守品牌語氣：清楚、溫和、可信任，不使用焦慮式推銷。
