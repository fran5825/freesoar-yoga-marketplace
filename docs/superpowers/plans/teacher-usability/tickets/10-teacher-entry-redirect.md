# 10: 已有老師身分的人按「老師合作」直接進總覽（決策 11，原 backlog 第 9 項）

**What to build:** 已通過審核（`approved`）或已暫停（`suspended`）的老師，開 `/teachers/join`（包含 header「老師合作」）時，直接導到 `/teacher/dashboard`，不再看到唯讀的申請表單。草稿（`draft`）、審核中（`submitted`）、被退回（`rejected`）與沒有老師資料的人，仍留在 `/teachers/join`（草稿與退回要繼續填寫，審核中看唯讀摘要）。做法比照團主端 `/organizers/request` 依身分狀態導向。header 連結本身不改。

**Blocked by:** 04（審核中、被退回的畫面定案後，才能確定哪些狀態留在申請頁）

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no（但「哪些狀態導向哪裡」的對應表已於 2026-09-25 確認）

**Risk flags:** 核心使用流程的入口導向，需產品主人確認狀態對應表（建議 `approved`、`suspended` 導向總覽，其餘留在申請頁）；只讀狀態、不改狀態機、不動 schema、不動權限；`admin-teachers` 等測試原本斷言「已通過審核」出現在 `/teachers/join`，要改成斷言導向總覽

**實作紀錄：** `/teachers/join` 在伺服器端判斷：已登入且老師狀態是 `approved` 或 `suspended` → `redirect` 到 `/teacher/dashboard`；其他狀態與未登入維持原樣。header「老師合作」連結沒改。`admin-teachers` 測試改成斷言導向總覽；新增 approved、suspended 兩個導向測試。申請頁裡 approved／suspended 的唯讀畫面程式碼仍保留（防禦用，正常不會再看到）。

**Source:** `docs/teacher-usability-plan.md`

- [x] 產品主人確認狀態對應表（2026-09-25 已確認，照建議：`approved`、`suspended` 導向總覽，其餘留在申請頁）
- [x] `approved`、`suspended` 老師開 `/teachers/join` 被導到 `/teacher/dashboard`，且帶登入狀態不需重新登入
- [x] `draft`、`submitted`、`rejected`、沒有老師資料的人仍看到申請頁，行為不變
- [x] 未登入訪客仍看到導覽介紹頁，登入後回原頁（`callbackUrl`）規則不變
- [x] `/account` 的入口卡片與 header 連結不受影響
- [x] 更新受影響的 smoke 測試（例如 `admin-teachers`、`teacher-join`），桌機與手機通過
