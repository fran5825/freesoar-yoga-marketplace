# 04: 共用列表元件：狀態篩選列、整張可點卡片、成功提示（決策 9、11、12）

**What to build:** 做出三個列表頁共用的積木：狀態篩選列（預設停在待審並顯示筆數）、整張可點的兩行卡片（名稱＋狀態標籤／多久前＋地區）、審核後的成功提示。先套在一個頁面驗證，後續票直接沿用。

**Blocked by:** 01

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 只讀取現有資料；篩選只是讀取，不動結構

**Source:** `docs/admin-usability-plan.md`

- [x] 篩選列可用網址參數保留狀態，重新整理不掉
- [x] 卡片整張可點、手機版兩行不擠
- [x] 成功提示可由 Server Action 導回後顯示（沿用團主端做法）
- [x] 元件樣式與團主需求列表一致

**實作紀錄：** 三個共用元件放在 `src/app/admin/_components/`：`AdminFilterBar`（篩選列，網址參數 `?status=`，第一個 tab 當預設、網址亂填退回預設，附 `resolveActiveTab`）、`AdminListCard`（整張可點的兩行卡片，補充資訊用「・」串起）、`AdminFlash`（沿用既有的 `?result=&message=` 做法）。**先套在課程列表 `/admin/classes` 驗證**：原本依狀態分組的長頁改成篩選列（全部／開放中／已完成／已取消／草稿）加卡片；因為課程沒有「待審」概念，預設停在「全部」。卡片內容縮成兩行：老師・團體、開始時間・已報名人數（詳細資料留在詳情頁）。票 06、07、08 直接沿用這三個元件。測試：`admin-class-session-management` 新增篩選、亂填網址退回預設、卡片進詳情、提示橫幅共 2 支；5 支 admin 測試共 60 支通過（`PORT=3100`）。
