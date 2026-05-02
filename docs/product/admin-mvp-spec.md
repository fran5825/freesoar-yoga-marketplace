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
| `/admin/dashboard` | 顯示待審事項與 basic KPIs |
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

## Teacher Review Actions

Admin 可以：

- 查看 teacher profile。
- approve teacher。
- reject teacher，並填寫 reason。
- suspend teacher，並填寫 reason。

Admin 不應：

- 代替 teacher 任意美化 profile 內容並發布。
- 繞過必要欄位直接 approve。
- 讓 suspended teacher 回應新需求。

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

## Enrollment Actions

Admin 可以：

- 查看 enrollment。
- 協助確認或取消 enrollment。
- 保留 admin-only 後續能力標記 attended 或 no_show；V1 主要支援 confirmed / cancelled。

Admin 不應：

- 讓 enrollment 超過 class capacity。
- 建立同一會員對同一課程的重複 enrollment。
- 對非必要人員揭露會員私人資料。

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
