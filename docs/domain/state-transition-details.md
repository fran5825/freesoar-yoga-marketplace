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

### V1 落地範圍（`teacher-profile-suspension` 已確認）

上方 Transitions 表格是這個實體的完整最終設計；本文件的 TeacherProfile 小節過去一直沒有像 DemandRequest／DemandResponse／ClassSession／Enrollment 那樣明確劃出「目前只落地哪個子集」，導致 `approved ↔ suspended` 這組雙向轉換長期被文件描述成已經是 V1 admin action，但實際上直到 `teacher-profile-suspension` 這一輪之前，**整個 repo 沒有任何程式碼會把 `TeacherProfile.status` 寫成 `suspended`**（`docs/superpowers/plans/2026-07-29-teacher-profile-suspension-plan.md` 1.1 節已逐字 `grep` 確認）。本輪把這個長期文件債務補上：

```text
draft
  → submitted
  → approved
  → rejected

rejected
  → submitted

approved
  → suspended
suspended
  → approved
```

- `approved → suspended`（暫停）與 `suspended → approved`（恢復）都是 Admin-only，本輪一起接線，不是分兩輪。
- 暫停必填 `suspensionReason`（獨立於 `rejectionReason` 的新欄位，比照既有 rejection reason 的既有驗證形狀：trim 後 10–1000 字），恢復時清空。
- 暫停**不**連帶處理該老師既有的 `DemandResponse`／`ClassSession`——已經 `selected` 的 response 與已經建立的 `ClassSession` 不受影響；但 `selectDemandResponseForOrganizer`（`demand-response` 領域）新增了 teacher 資格檢查，暫停之後 Organizer 無法再選定這位老師既有、還沒被選定的 `submitted` response（見下方 DemandResponse 小節）。

### V1 policy notes

- Member / Organizer 在 V1 只可看見 `approved` teacher。
- `draft`、`submitted`、`rejected`、`suspended` teacher 都不公開顯示，也不可建立 demand response。
- `submitted` 後核心申請欄位不可由 Teacher 直接編輯；若未來需要 edit-after-submit，需另開 product decision。
- `rejected` teacher 可依 Admin reason 修改後重新送審；V1 不限制重新送審次數，不新增 counter / lockout。
- **Rejection reason（V1）**：Admin 執行 `submitted → rejected` 時**必填** rejection reason，保存於 `TeacherProfile.rejectionReason`（面向老師的退回說明，與內部 `AdminNote` 分離）。reason 以 `normalizedReason = input.trim()` 為準：驗證且持久化 trim 後值，長度 10–1000 字。lifecycle：`rejected` 期間**保留**（供老師邊看邊改）、`rejected → submitted` 與 `approve` 時**清空**、再次 reject **覆蓋**（單欄位、只留最新、不保留歷史）。V1 以站內顯示（dashboard / join）作為對老師的告知，**不寄 email**；email/notification 為後續切片 `teacher-application-rejection-notification`。
- **修正：`suspended → approved` 已經在 `teacher-profile-suspension` 一輪落地**，不再是「future slice / admin-manual decision」——`approved → suspended`（Admin-only、必填 `suspensionReason`）與 `suspended → approved`（Admin-only、清空 `suspensionReason`）都已接線於 `/admin/teachers` 頁面。

### Admin action matrix

| Current status | V1 Admin actions |
|---|---|
| `submitted` | `approve`, `reject` |
| `approved` | `suspend`（`teacher-profile-suspension` 已落地，必填 `suspensionReason`） |
| `rejected` | view reason / history；Teacher 可重新 submit，不需要 Admin 主動重開 |
| `suspended` | `restore to approved`（`teacher-profile-suspension` 已落地，清空 `suspensionReason`） |

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

### V1 policy notes（`organizer-demand-request-foundation`、`demand-response-selection-and-matching`、`class-session-creation`、`demand-request-cancellation` 已確認）

上方 Transitions 表格是 marketplace 的完整最終設計；目前**只落地**以下子集，其餘列為未來 slice（Enrollment 之後的 class conversion）的設計參考：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `submitted` | Organizer | 必填需求欄位完成（`title`/`serviceType`/`description`/`targetLevel`/`expectedParticipants`/`preferredAreas`≥1/`preferredTimeSlots`≥1/`classLengthMinutes`/`frequency`），且所連 `Organization` 的 `contactName`/`contactEmail`/`contactPhone` 皆已填寫 | demand 進入待審核；V1 以站內 status 顯示告知 Organizer，不寄 email |
| `submitted` | `published` | Admin | 需求清楚且適合平台 | Approved teacher 可在 demand pool 看見 |
| `submitted` | `rejected` | Admin | 需求不適合或資料不足，且 Admin 已填寫具體 rejection reason（必填，trim 後 10–1000 字） | 保存 `rejectionReason`；Organizer 於自己 dashboard / demand detail 看見 reason（V1 以站內顯示告知，email 為後續切片） |
| `published` | `matched` | Organizer | demand 尚無 selected response，且 Organizer 對一筆屬於自己 demand 的 `submitted` response 執行 select | 該 response 轉 `selected`、同 demand 其餘 `submitted` response 轉 `declined`（同一 transaction） |
| `matched` | `converted_to_class` | Organizer | demand 尚無 `ClassSession`，且 Organizer 已於建立表單一次到位填齊 `ClassSession` 必要欄位並通過驗證 | 同一 transaction 內原子建立 `ClassSession`（`status="draft"`） |
| `draft`／`submitted`／`published`／`matched` | `cancelled` | Organizer | own-scoped，demand 尚未是 `cancelled`，且不是 `converted_to_class`／`rejected`（`demand-request-cancellation` D1/D2） | 同一 transaction 內把該 demand 底下所有 `status IN ('submitted','selected')` 的 `DemandResponse` 一併轉為 `declined`（D4，不新增新的 `DemandResponseStatus` 值）；Organizer 與每一位受影響 Teacher 收到 `demand_request_cancelled` 通知（D9） |

- **`converted_to_class` 明確排除取消**（`demand-request-cancellation` D1）：這個狀態已經有 `ClassSession` 存在（`ClassSession.demandRequestId` 為 `@unique`、`onDelete: Restrict` 外鍵），允許取消會產生「`ClassSession` 存在但所屬 `DemandRequest` 卻是 `cancelled`」的語意矛盾資料；這個狀態下要取消，Organizer 應改用 `class-session-cancellation` 取消對應的 `ClassSession`。
- **取消併發設計**：取消動作與既有的 `submitDemandResponseForTeacher`／`selectDemandResponseForOrganizer`／`createClassSessionForOrganizer` 三個 mutation 搶同一把 `DemandRequest` 的 `SELECT ... FOR UPDATE` 鎖，正確加入既有的鎖序列（D5）。
- **不做取消原因欄位**（D7，比照 `class-session-cancellation` D6 的既有先例）。
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
- `converted_to_class` 之後不可取消 `DemandRequest`（`ClassSession.demandRequestId` 為 `onDelete: Restrict` 外鍵，取消會產生語意矛盾資料，`demand-request-cancellation` D1）。
- `rejected`／已是 `cancelled` 的 `DemandRequest` 不可再取消（前者是既有終局狀態；後者回傳明確錯誤碼，非 no-op）。

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

### V1 policy notes（`teacher-demand-pool-response-plan`、`demand-response-selection-and-matching`、`demand-request-cancellation`、`teacher-profile-suspension` 已確認）

上方 Transitions 表格是 marketplace 的完整最終設計；目前**只落地**以下子集：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `submitted` | Teacher | Teacher approved，DemandRequest published | Organizer 可在自己 demand detail 查看 |
| `submitted` | `withdrawn` | Teacher | 尚未 selected；suspended teacher 不可執行（仍可查看） | response 結束，不可再重新提交 |
| `submitted` | `selected` | Organizer | own-scoped，demand 尚無 selected response | DemandRequest 同一 transaction 內轉 `matched` |
| `submitted` | `declined` | System（select 觸發，非 Organizer 手動） | 同 demand 有另一筆 response 被 select | 與上一列同一 transaction 內完成，非獨立動作 |
| `submitted`／`selected` | `declined` | System（`DemandRequest` cancel 觸發，非 Organizer 手動） | 所屬 `DemandRequest` 執行取消（`demand-request-cancellation` D4） | 與 `DemandRequest → cancelled` 同一 transaction 內完成，非獨立動作；reuse 既有 `declined` 值，不新增新狀態 |

- **`shortlisted` 不接線**：V1 跳過候選階段，Organizer 直接對任一 `submitted` response 執行 select（`demand-response-selection-and-matching` D1）；enum 值保留供未來使用。
- **Select 僅 Organizer own-scoped，Admin 不介入**（D2）：與上方完整設計表格「Organizer / Admin」不同，V1 未開放 Admin 執行 select。
- **Decline 不是獨立的 Organizer 手動動作**：select 成功時，同一 transaction 內自動把同 demand 其餘 `submitted` response 轉為 `declined`（D3），沒有對應的手動 decline UI/API。
- **`expired` 不接線**：無 demand 過期機制，enum 值保留。
- **修正（`teacher-profile-suspension` 已確認）：`submitted → selected` 現在也要求該 response 所屬的 `TeacherProfile.status = 'approved'`**——`selectDemandResponseForOrganizer` 的原子 `UPDATE` 陳述式追加了這個檢查（比照 `submitDemandResponseForTeacher` 既有的對稱檢查），暫停一位老師之後，Organizer 無法再選定他既有、還沒被選定的 `submitted` response（回傳 `response_teacher_not_approved`）。已經 `selected` 的 response 不受影響——這條檢查只在「選定」這個動作發生的當下生效，不會回溯處理已經成立的 response。

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

### V1 policy notes（`class-session-creation`、`enrollment`、`class-session-cancellation`、`class-session-completion` 已確認）

上方 Transitions 表格是最終設計；目前**落地** `(none) → draft`（由 `DemandRequest: matched → converted_to_class` 同一 transaction 觸發建立，見上方 DemandRequest V1 policy notes）、`draft → open_for_enrollment`（Organizer own-scoped 明確觸發，`enrollment` D2）、`draft`／`open_for_enrollment → cancelled`（Organizer own-scoped 明確觸發，`class-session-cancellation` D1），以及 `open_for_enrollment → completed`（Organizer own-scoped 明確觸發，`class-session-completion` D1/D2）。

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| `draft` | `open_for_enrollment` | Organizer | own-scoped，且 `startAt` 尚未到達（D14） | Member 可透過分享連結查看並報名 |
| `draft`／`open_for_enrollment` | `cancelled` | Organizer / Admin | Organizer own-scoped 或 Admin（不檢查擁有權），且 `startAt` 尚未到達（`class-session-cancellation` D2，與 D14 同一精神；Admin 版由 `admin-class-enrollment-management` D1/D5 新增，資格條件完全相同） | 該 ClassSession 底下所有 `confirmed` Enrollment 在同一 transaction 內一併轉成 `cancelled`（連帶取消，D4）；Organizer/Teacher/受影響 Member 收到 `class_session_cancelled` 通知（D7），不論觸發者是 Organizer 還是 Admin，收件人解析邏輯完全相同 |
| `open_for_enrollment` | `completed` | Organizer | own-scoped，且 `endAt` 已經過去（`class-session-completion` D2，與 D14/D2 的時間方向相反——完成需要「已經發生」，取消/開放需要「尚未發生」） | 標記課程已完成；不連帶處理 `Enrollment`（D3，`attended`/`no_show` 仍不接線）；不觸發新的 Notification（D5） |

- **一次到位建立，無編輯**：`title`/`description`（選填）/`serviceType`/`startAt`/`endAt`/`location`/`capacity`/`isPublic` 皆於建立當下一次填齊並通過驗證，建立後不提供編輯（D2）；因此不存在「資料不完整的 draft」，`draft` 語意純粹是「已建立、尚未開放報名」。
- **`draft → open_for_enrollment` 不經過 `pending_confirmation`**：對齊 D2 的一次到位建立，沒有需要「初步完整」與「必要欄位完整」分兩階段確認的理由。
- **`pending_confirmation`/`confirmed` 不接線**：`open_for_enrollment → confirmed` 沒有明確、機械式的觸發條件（不像 capacity 那樣可自動判斷），`enrollment` 沿用 `class-session-creation` D9 的判斷不提前接線；`open_for_enrollment` 本身已足以讓 Member 報名到滿額為止。
- **修正：`completed` 已經在 `class-session-completion` 一輪落地**，不再是「還沒接線」——Organizer own-scoped，只能從 `open_for_enrollment` 觸發（`draft` 從未開放過，沒有人可能出席；`pending_confirmation`/`confirmed` 從未接線，不可能是實際來源狀態），且 `endAt` 必須已經過去。不連帶處理 `Enrollment`（已經 `confirmed` 的報名維持原狀，代表「這位會員確實報名了這堂已完成的課程」這個歷史事實）；不新增 Notification（理由見 D5：「已完成」本身資訊價值有限，更有價值的「邀請留下評價」通知留給未來的 Review 一輪一次做好）。連帶影響：`getClassSessionForMember`（Member 端公開連結）與 Organizer／Teacher 兩處既有的 roster 顯示條件都同步擴大為同時允許 `completed`，否則過期課程一旦真的被標記完成，既有連結／roster 會第一次因此消失（`class-session-completion` D6/D7）。
- **取消（`cancelled`）的併發設計**：取消動作會跟 `createEnrollmentForUser` 搶同一個 `ClassSession` 資源，用跟 enrollment 建立完全一致的 `SELECT ... FOR UPDATE` 手法序列化，確保「會員剛好在取消瞬間報名成功」的情境仍然會被正確連帶取消，不會殘留一筆狀態與課程矛盾的 `confirmed` Enrollment（`class-session-cancellation` D3）。
- **修正：Admin 版取消已經在 `admin-class-enrollment-management` 一輪落地**——`cancelClassSessionForOrganizer`（Organizer own-scoped）與 `cancelClassSessionForAdmin`（Admin，不檢查擁有權）共用同一段鎖 + 連帶取消 + 通知的交易邏輯，只有鎖查詢的 `WHERE` 子句要不要帶 `organizerProfileId` 不同。取消一律是單向動作，這個系統目前沒有任何「恢復已取消 ClassSession」的 transition，`git revert` 部署層級的程式碼變更也不會復原任何已經透過這個能力被取消的真實資料——這點對 Organizer own-scoped 版本一直都成立，Admin 版本沒有讓它變得更差。
- **取消不影響 DemandRequest**：`converted_to_class` 是媒合流程走到這一步的歷史事實，不因為之後那堂課被取消而回頭改變（`class-session-cancellation` D5）。
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

### V1 policy notes（`enrollment` 已確認）

上方 Transitions 表格是最終設計；目前**只落地**以下子集：

| From | To | Actor | 前置條件 | 後置效果 |
|---|---|---|---|---|
| none | `confirmed` | Member | class session 為 `open_for_enrollment`、`startAt` 尚未到達（D14）、尚有 capacity、未曾對這個 class session 建立過 enrollment（不分狀態，D8） | 同一 transaction 內原子建立 enrollment，寫入 `consentedAt`（D6） |
| `confirmed` | `cancelled` | Member / Admin | Member own-scoped，或 Admin（不檢查擁有權）；皆需 `startAt` 尚未到達（D14；Admin 版由 `admin-class-enrollment-management` D4 新增，資格條件完全相同） | 釋放名額（不計入 capacity COUNT），但**不可**重新報名（D8）；通知該筆 enrollment 的 Member 本人（`enrollment_cancelled`／`self`），不論觸發者是 Member 自己還是 Admin |

- **跳過 `pending`**（D1）：建立當下的原子檢查（capacity／重複報名）已經涵蓋完整設計裡 `pending → confirmed` 的唯一前置條件，沒有獨立業務動作需要一個中繼狀態，對齊本專案一貫的簡化先例。
- **`consentedAt` 非 nullable**（D6）：spec 明確要求「記錄」basic consent，這不是本專案其他確認 checkbox（`confirmReject`/`confirmSelect`/`confirmCreate`）那種純 UX 防誤觸，是需要留存的紀錄。
- **取消也受 `startAt` 限制**（D14，與建立、開放報名一致）：取消一堂已經開始的課程的報名會抹除歷史報名紀錄，且讓這筆 enrollment 永遠無法銜接未來的 `confirmed → attended/no_show`，V1 課程開始後不提供自助取消。
- **取消後不可重新報名**（D8）：`@@unique([classSessionId, userId])` 是資料庫層面唯一約束，只認這個組合本身是否已存在過，不分狀態。
- ~~**Admin 不介入**（D10）：本輪 Enrollment 生命週期完全是 Member 與 Organizer/Teacher（唯讀 roster）的範圍。~~ **修正：`admin-class-enrollment-management` 一輪已經打破這個限制**——Admin 現在可以取消任何一筆 `confirmed` enrollment，資格條件跟 Member 自助取消完全相同（D4），只是不檢查 `userId` 擁有權。`Confirm enrollment`（`pending → confirmed`）與 `attended`/`no_show` 標記仍然完全不接線，這部分的「Admin 不介入」維持成立；只有「取消」這一種轉換打破了原本 D10 的範圍。
- `pending`/`attended`/`no_show` 不接線，enum 值保留。

### 禁止條件

- 同一 user 不可對同一 class session 建立重複 enrollment。
- Confirmed enrollment 數量不可超過 class capacity。
- `cancelled` enrollment 不可直接轉為 `attended`。
- 已完成課程不應接受新的 enrollment。
- V1 不做完整 Teacher attendance workflow。

## Notification Side Effects

狀態變更可能觸發 notification。**已落地**（`docs/superpowers/plans/2026-07-27-notification-plan.md`、`2026-07-28-class-session-cancellation-plan.md`、`2026-07-28-demand-request-cancellation-plan.md`、`2026-07-29-teacher-profile-suspension-plan.md` 已確認）：以下 15 個事件會在對應狀態變更**成功之後**建立 `Notification` 記錄（`channel="in_app"`，見 notification 一輪 D2），失敗（收件人解析或寫入本身出錯）絕不影響觸發它的主要商業邏輯（notification 一輪 D4）：

- TeacherProfile submitted（Teacher 自己 + Admin）/ approved（Teacher 自己）/ rejected（Teacher 自己，含 `rejectionReason`）——沿用既有的站內 `rejectionReason` 顯示（`teacher-application-rejection-notification` 一輪已確認），本輪額外新增 `Notification` 記錄與 `/notifications` 列表這個獨立管道，兩者並存。
- TeacherProfile **suspended**（Teacher 自己，含 `suspensionReason`）／**restored**（Teacher 自己）——`teacher-profile-suspension` 一輪新增，原始事件表沒有規劃過這兩個事件，`NotificationType` enum 也沒有預先保留（真的跑了一次 migration）。收件人只有 Teacher 自己（`self`），不通知其他角色。發通知前有 best-effort 的過期抑制：若狀態在原子寫入之後、發通知之前又被另一次操作改變（例如暫停後幾乎同時被恢復），就跳過這則已經過期的通知，避免老師先看到「已恢復」又看到過期的「已暫停」。
- DemandRequest submitted（Organizer 自己 + Admin）/ published（Organizer 自己）/ rejected（Organizer 自己，含 `rejectionReason`）/ **cancelled**（Organizer 自己 + 每一位因連帶取消而受影響的 Teacher，`demand-request-cancellation` D9 已確認；受影響 Teacher 用第五種收件人角色 `affected_responder`——不沿用 `class-session-cancellation` 的 `affected_member`，因為那個角色的既有文案是 Enrollment／Member 語境的措辭，套用在 Teacher／DemandResponse 語境下文法與情境都不對）——沿用既有的站內 status 顯示（`organizer-demand-request-foundation` D14 已確認），本輪同樣新增獨立的 `Notification` 記錄。
- DemandResponse submitted（該 demand 的 Organizer + Admin）/ selected（Organizer 自己 + 被選中的 Teacher）
- ClassSession created（Organizer 自己 + Teacher）／**cancelled**（Organizer 自己 + Teacher + 每一位因連帶取消而受影響的 Member，`class-session-cancellation` D7 已確認；受影響 Member 用第四種收件人角色 `affected_member`，不跟 Member 自助取消的 `enrollment_cancelled` 共用，見下方 Enrollment 小節）——`open_for_enrollment` 本輪確認**不**新增獨立事件（D10，理由：`class_session_created` 已涵蓋通知價值，避免重複通知）；`confirmed` 狀態本身尚未接線（見上方 ClassSession V1 範圍），對應的通知事件保留未接線。
- Enrollment confirmed（Member 自己）/ cancelled（Member 自己——僅限 Member 透過 `/member/enrollments` 自助取消這個觸發來源；Organizer 取消 ClassSession 造成的連帶取消改發 `class_session_cancelled`／`affected_member`，不是這個事件，見 `class-session-cancellation` D7/D8）

Notification 內容需遵守品牌語氣：清楚、溫和、可信任，不使用焦慮式推銷。
