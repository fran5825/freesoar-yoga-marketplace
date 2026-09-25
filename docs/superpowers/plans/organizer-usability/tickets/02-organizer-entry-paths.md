# 02: 團主入口路徑（決策 1 修訂、13）

**What to build:** 每種身分狀態按下「發起團課」都有合理去處：已是團主直接進新需求表單；首頁對已是團主者的主按鈕變「發起新需求」（總覽保留在下方卡片）；沒登入者按「登入／建立帳號並開始」登入後直接到建立團主資料，不再回招募頁。沒有團主身分的已登入者仍先看招募頁。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** 核心使用者流程；只改連結與導向參數，不改登入機制本身（若實作時需要動 auth 設定，立即停下回報並升級為 HEAVY）

**實作紀錄：** 已完成。header「發起團課」保持連到 `/organizers/request`，由該頁對已是團主者 redirect 到新需求表單（不多查資料庫）；未登入者登入後帶到 `/organizer/demands/new`（沒有團主身分會自動轉到建立團主資料）。沒有動登入機制本身。

**Source:** `docs/organizer-usability-plan.md`

- [x] 已是團主開 `/organizers/request` 會導向新需求表單（取代第 1 批導向總覽）
- [x] 首頁主按鈕：團主顯示「發起新需求」，其他人維持「我想發起團課 →」
- [x] 沒登入者登入後落在建立團主資料頁；已是團主者登入後落在新需求表單
- [x] 已登入但沒團主身分者仍看到招募頁與單一「建立團主資料」按鈕
- [x] 更新 `organizers-request` 與首頁相關 smoke 測試，桌機與手機通過
- [x] 更新計畫文件與 handoff 中的路徑描述
