# 03: 課程查找、時間排序與取消後返回

**What to build:** 管理員依課程、老師、團主、團體或地點搜尋，依狀態與開始時間找到課程，查看詳情及取消整堂後回原列表；單筆報名取消仍留在課程名單。

**Blocked by:** 01：沿用已驗證的共用列表與返回模式。

**Status:** accepted（2026-10-04 畫面驗收通過，見本資料夾 README；之後也包含在票 14 整條工作路徑並於 2026-10-06 驗收。2026-10-09 收尾時同步本欄；原狀態 implemented-awaiting-owner-review）

**Workflow mode:** STANDARD

**Human Gate:** yes（第一批範圍已由產品主人選「1」授權；四票粒度與依賴已確認。每批畫面 gate 仍保留。）

**Risk flags:** ADMIN_FLOW、BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK；只改善既有 admin 查找與導航，不更動 Auth／schema／permissions／state machine。

**來源：** 管理後台第二輪規格與四批計畫；Q1–Q20 及「照這 4 票切」的確認。

## Acceptance criteria

- [x] 五種搜尋欄位與狀態筆數正確，預設全部。
- [x] 未來場次由近到遠、歷史場次由近到遠，時間相同仍有穩定排序。
- [x] 詳情返回、整堂取消成功保留原條件並可追查結果。
- [x] 單筆報名取消維持留在名單，不提前加入第三批名單功能。
- [x] desktop／mobile 可完成查找與返回；既有取消條件與連帶效果不變。

## Checks 與完成邊界

沿用第一批核准的 typecheck、lint、build、相關 admin smoke 與雙裝置畫面檢查。不得 commit／push；票完成可接續同一批的下一張票，四票完成後停下讓產品主人看畫面，不自動進第二批。
