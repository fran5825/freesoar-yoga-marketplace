# 04: 團體查找與聯絡資料

**What to build:** 管理員依團體、聯絡人、聯絡 email 或團主搜尋，清楚看到結果數並在手機或電腦找到聯絡資料；無結果時能清除條件再找。

**Blocked by:** 01：沿用已驗證的共用搜尋與空狀態模式。

**Status:** accepted（2026-10-04 畫面驗收通過，見本資料夾 README；之後也包含在票 14 整條工作路徑並於 2026-10-06 驗收。2026-10-09 收尾時同步本欄；原狀態 implemented-awaiting-owner-review）

**Workflow mode:** STANDARD

**Human Gate:** yes（第一批範圍已由產品主人選「1」授權；四票粒度與依賴已確認。每批畫面 gate 仍保留。）

**Risk flags:** ADMIN_FLOW、BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK；只改善既有 admin 查找與導航，不更動 Auth／schema／permissions／state machine。

**來源：** 管理後台第二輪規格與四批計畫；Q1–Q20 及「照這 4 票切」的確認。

## Acceptance criteria

- [x] 搜尋欄位符合核准範圍，團體名稱排序。
- [x] 結果數、關鍵字、無結果及清除入口清楚。
- [x] desktop／mobile 的名稱、email、電話與團主資料不溢出或被遮擋。
- [x] 維持唯讀，不新增團體詳情、編輯能力或第三批關聯入口。

## 驗證補漏紀錄（2026-10-04）

- 團體卡片的「需求數」原本把團主草稿也算進去，違反規格第 2 節「草稿不因搜尋或關聯而出現」；已改成只計算非草稿需求（`src/domain/organizer-profile/admin-service.ts`），並在 `admin-organizations.spec.ts` 加一筆草稿確認數字不變。
- 「團主」清單補上 `<dd>` 包裝，讓螢幕閱讀器把它讀成「團主」欄位的值。
- Codex peer review 指出：沒有空白的長名稱／email 會撐開手機版面（`break-words` 不會縮小最小寬度）。團體名稱、聯絡資料、團主與搜尋關鍵字改用 `wrap-anywhere`，卡片加 `min-w-0`；新增長連續字串測試，desktop／mobile 皆無橫向溢出。

## Checks 與完成邊界

沿用第一批核准的 typecheck、lint、build、相關 admin smoke 與雙裝置畫面檢查。不得 commit／push；票完成可接續同一批的下一張票，四票完成後停下讓產品主人看畫面，不自動進第二批。


<!-- codex-peer-reviewed: 2026-10-03T21:59:58Z rounds=2 verdict=approved -->
