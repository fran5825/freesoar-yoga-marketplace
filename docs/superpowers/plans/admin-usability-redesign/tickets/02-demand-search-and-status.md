# 02: 需求查找、完整分類與返回

**What to build:** 管理員搜尋需求或聯絡對象，使用完整已落地狀態分類找到資料，進詳情完成既有審核後仍保留原查找條件。

**Blocked by:** 01：沿用已驗證的共用列表與返回模式。

**Status:** implemented-awaiting-owner-review

**Workflow mode:** STANDARD

**Human Gate:** yes（第一批範圍已由產品主人選「1」授權；四票粒度與依賴已確認。每批畫面 gate 仍保留。）

**Risk flags:** ADMIN_FLOW、BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK；只改善既有 admin 查找與導航，不更動 Auth／schema／permissions／state machine。

**來源：** 管理後台第二輪規格與四批計畫；Q1–Q20 及「照這 4 票切」的確認。

## Acceptance criteria

- [x] 依標題、團體、團主、聯絡人與聯絡 email 搜尋，分類與結果數符合條件。
- [x] 待審／已公開／已媒合／已建課／已退回／已取消／全部可用，草稿不可見。
- [x] 返回與成功提示保留原條件，剛離開分類的需求仍可追查。
- [x] desktop／mobile、無結果與清除條件通過；不改狀態規則或表單順序。

## Checks 與完成邊界

沿用第一批核准的 typecheck、lint、build、相關 admin smoke 與雙裝置畫面檢查。不得 commit／push；票完成可接續同一批的下一張票，四票完成後停下讓產品主人看畫面，不自動進第二批。

