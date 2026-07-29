# Admin MVP Spec

## 目的

Admin MVP 的目標是讓 Free Soar Yoga V1 可以安全營運 marketplace，而不是建立大型後台系統。

V1 Admin dashboard 應聚焦審核、狀態管理、資料邊界與基本 KPI，不做複雜 analytics、enterprise permission 或完整 CRM。

## Admin 核心任務

- 審核 teacher application。
- Review demand request，決定 publish 或 reject。
- 查看 demand responses 與 matching 狀態。
- 管理 class session 基本狀態。
- 管理 enrollment 基本狀態。
- 查看、修正 organization 基本資料，並查看其關聯 demand / class。
- 新增 admin note。
- 查看 basic KPIs。

## Admin Pages

| Page | 目的 |
|---|---|
| `/admin/dashboard` | **已落地**（`admin-dashboard` 已確認）：顯示待審事項與 basic KPIs |
| `/admin/teachers` | 管理 teacher profiles |
| `/admin/demands` | 管理 demand requests |
| `/admin/classes` | 管理 class sessions |
| `/admin/enrollments` | 管理 enrollments |
| `/admin/organizations` | 查看與修正 organizations 基本資料，查看關聯 demand / class |

## Basic KPIs

V1 可先包含：

- teacher applications pending count
- approved teachers count
- demand requests pending review count
- published demand requests count
- matched demand requests count
- upcoming class sessions count
- confirmed enrollments count

**落地現況（`admin-dashboard` 已確認）**：7 個數字全部已落地，一律是不分擁有權的平台全域即時計數（`prisma.count()`），沒有互動式圖表或時間區間篩選。其中兩個定義容易被誤解，特別記錄：
- **`matched demand requests count` 只算 `DemandRequest.status = "matched"`，不含 `converted_to_class`**——`converted_to_class` 代表已經進到下一步（已經建立 `ClassSession`），不再是「等待轉換的 matched 需求」。
- **`upcoming class sessions count` 是 `status = "open_for_enrollment"` 且 `startAt` 尚未到達**，不是單純數 `open_for_enrollment` 狀態的總數——一堂 `open_for_enrollment` 但 `startAt` 已經過去、尚未被 Organizer 標記完成的課程不算「即將到來」。

「待審事項」只有 `teacher applications pending count`／`demand requests pending review count` 兩個數字提供連結（分別連到 `/admin/teachers`／`/admin/demands`，兩個既有審核佇列頁面），其餘 5 個 KPI 純顯示數字，不對應任何篩選視圖。

## Teacher Review Actions

Admin 可以：

- 查看 teacher profile。
- approve teacher。
- reject teacher，並填寫 reason。
- suspend teacher，並填寫 reason。
- restore（恢復）已暫停的 teacher。

Admin 不應：

- 代替 teacher 任意美化 profile 內容並發布。
- 繞過必要欄位直接 approve。
- 讓 suspended teacher 回應新需求。

**落地現況（`teacher-profile-suspension` 已確認）**：`suspend teacher，並填寫 reason` 與「Admin 不應：讓 suspended teacher 回應新需求」這兩條原則直到本輪才真正由程式碼落實——`suspendApprovedTeacherProfile` 提供暫停能力（必填 reason），`selectDemandResponseForOrganizer` 新增的 teacher 資格檢查則確保暫停後無法再被選定為新的媒合對象。`restore` 是本輪一併新增的能力，本文件原本沒有列出。

## Demand Review Actions

Admin 可以：

- 查看 demand request。
- move `submitted` to `under_review`。
- publish demand request。
- reject demand request，並填寫 reason。
- cancel 明顯不適合或重複的 demand request。

Admin 不應：

- 將未完整或高風險的需求直接發布。
- 讓未審核需求進入 teacher demand pool。
- 將 demand 改到與 organizer 原意不一致。

## Class Session Actions

Admin 可以：

- 查看 class session。
- 協助補齊必要資訊。
- 變更 status。
- cancel class session，並記錄 reason。

Admin 不應：

- 忽略 teacher schedule conflict。
- 讓 capacity 缺失的 class session 開放 enrollment。
- 任意修改 completed session 的核心資料。

**落地現況（`admin-class-enrollment-management` 已確認）**：`/admin/classes`（總覽，依狀態分組）與 `/admin/classes/[classSessionId]`（詳情 + 取消）已落地，但範圍窄於上方描述——只做「查看」與「取消」兩項：
- **「協助補齊必要資訊」不做**：`class-session-creation` D2 本來就規定建立後不可編輯（一次到位），這是 model 本身的設計限制，不是 Organizer 專屬的限制，Admin 也不例外。
- **「變更 status」只落地「取消」這一種轉換，不是泛用能力**：真正落地的狀態只有 `draft`/`open_for_enrollment`/`completed`/`cancelled`，中繼狀態（`pending_confirmation`/`confirmed`）從未接線；讓 Admin 代替 Organizer 觸發「開放報名」或「標記完成」沒有已知的營運需求，只有「資料出錯需要緊急介入停損」明確對應「取消」。
- **不記錄取消 reason**：這個系統目前沒有任何地方會顯示 ClassSession 的取消原因（不像 `TeacherProfile.rejectionReason`／`suspensionReason` 有明確的下游消費者），既有 Organizer 版取消本身也從來沒有 reason 欄位，只有 Admin 路徑新增一個純裝飾性、沒有任何頁面會顯示的欄位不符合這個專案一貫的最小化原則。
- 取消資格條件跟 Organizer own-scoped 版本完全相同（狀態在 `draft`/`open_for_enrollment` 內，且 `startAt` 尚未到達），只是不檢查擁有權；取消是單向動作，這個系統完全沒有「恢復已取消 class session」的能力，`admin-mvp-spec.md` 的「Admin 不應：任意修改 completed session 的核心資料」與這個限制一致。

## Enrollment Actions

Admin 可以：

- 查看 enrollment。
- 協助確認或取消 enrollment。
- 保留 admin-only 後續能力標記 attended 或 no_show；V1 主要支援 confirmed / cancelled。

Admin 不應：

- 讓 enrollment 超過 class capacity。
- 建立同一會員對同一課程的重複 enrollment。
- 對非必要人員揭露會員私人資料。

**落地現況（`admin-class-enrollment-management` 已確認）**：「取消」已落地（`/admin/classes/[classSessionId]` 的 roster 逐筆提供），資格條件跟既有 Member 自助取消完全相同（`status="confirmed"` 且 `classSession.startAt` 尚未到達），只是不檢查 `userId` 擁有權。**「協助確認 enrollment」不適用**：V1 建立當下就直接是 `confirmed`（跳過 `pending`，`enrollment` D1），沒有 `pending` 狀態需要 Admin 確認。`attended`／`no_show` 仍然不接線（延續既有 `enrollment` D11 的既有決定，本輪不擴大範圍）。roster 額外顯示每一筆 enrollment 的 `status`（含已經自己取消過的），比 Organizer own-scoped 版本的 roster 更完整，讓 Admin 能看到歷史狀態再判斷要不要介入。沒有獨立的 `/admin/enrollments` 路由（見 `docs/product/route-map.md`）。

## Organization Actions

Admin V1 可以：

- 查看 organization 基本資料。
- 修正 organization 基本資料。
- 查看 organization 關聯的 demand requests。
- 查看 organization 關聯的 class sessions。

Admin V1 不做：

- CRM
- 銷售流程
- 複雜 organization management
- 多層 organization hierarchy

## Security Requirements

- `/admin/*` 必須 admin-only。
- Admin action 必須做 server-side permission check。
- 狀態變更必須符合 state transition rules。
- 拒絕、暫停、取消等動作建議記錄 reason。
- 不可在 client 暴露 secret 或敏感管理資料。

## V1 不做

- Advanced analytics dashboard
- 多層企業權限
- 完整 CRM
- 客服 ticket system
- 複雜 financial reporting
- Payment/refund automation
- 複雜 organization management
- 銷售流程
