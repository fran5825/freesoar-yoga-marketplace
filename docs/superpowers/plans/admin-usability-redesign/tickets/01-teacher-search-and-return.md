# 01: 老師查找與返回脈絡

**What to build:** 管理員依老師顯示名稱、帳號姓名或 email 搜尋，搭配狀態分類進入詳情，完成既有操作後回原條件；同步建立五區導覽與可重用的列表模式。

**Blocked by:** None (can start immediately)

**Status:** accepted（2026-10-04 畫面驗收通過，見本資料夾 README；之後也包含在票 14 整條工作路徑並於 2026-10-06 驗收。2026-10-09 收尾時同步本欄；原狀態 implemented-awaiting-owner-review）

**Workflow mode:** STANDARD

**Human Gate:** yes（第一批範圍已由產品主人選「1」授權；四票粒度與依賴已確認。每批畫面 gate 仍保留。）

**Risk flags:** ADMIN_FLOW、BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK；只改善既有 admin 查找與導航，不更動 Auth／schema／permissions／state machine。

**來源：** 管理後台第二輪規格與四批計畫；Q1–Q20 及「照這 4 票切」的確認。

## Acceptance criteria

- [x] 搜尋、分類筆數與結果一致，草稿不出現。
- [x] 重新整理、詳情返回與成功導向保留搜尋／分類，結果能追查老師。
- [x] 非法返回值不能導向外站或其他角色專區。
- [x] desktop 與 390px mobile 查找、空狀態、清除條件與返回通過。
- [x] 既有審核資格、guard、原因驗證與狀態轉換不變。

## Checks 與完成邊界

沿用第一批核准的 typecheck、lint、build、相關 admin smoke 與雙裝置畫面檢查。不得 commit／push；票完成可接續同一批的下一張票，四票完成後停下讓產品主人看畫面，不自動進第二批。

