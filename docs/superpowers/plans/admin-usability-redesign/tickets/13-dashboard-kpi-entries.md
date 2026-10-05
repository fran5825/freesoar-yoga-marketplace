# 13: 工作總覽 KPI 精準入口

**What to build:** 工作總覽維持「待你處理」在最上方；下方數字點下去會到與數字條件完全相同的列表：已通過老師、已公開需求、已媒合需求、即將開始課程（開放報名且尚未開始，列表上清楚顯示這個時間條件並可清除）。已確認報名只顯示數字，不連到任何頁。

**Blocked by:** 09：「即將開始」是課程列表的新條件，沿用票 09 擴充後的列表上下文（含顯示／清除條件與返回保留）。

**Status:** draft（2026-10-05 產品主人已確認切票粒度與依賴；Builder 只放行到 09，本票待 09 完成並回報後依序接續）

**Workflow mode:** STANDARD

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

**來源：** 規格第 10 節；計畫第三批第 4 點。

## Acceptance criteria

- [ ] 「待你處理」保持最上方，老師／需求各前 5 筆與總數不變（第一批已建立，本票只回歸）。
- [ ] KPI 對應：已通過老師 → 老師「已通過」分類；已公開需求 → 需求「已公開」（只含 published）；已媒合需求 → 需求「已媒合」（只含 matched，不含已建課）；即將開始課程 → 課程列表 `upcoming` 條件（open_for_enrollment 且 startAt 尚未到達）。
- [ ] 課程列表新增 `upcoming` 條件：清楚顯示「開放報名且尚未開始」與清除入口；可與關鍵字、關聯條件組合；返回／操作成功後保留；開始時間判斷與 KPI core 使用相同規則。
- [ ] 已確認報名只作統計，不新增全站報名路由或近似目的頁，畫面不呈現可點擊樣式。
- [ ] KPI 數字與點進去的列表筆數在同一時間點一致；若資料隨時間或其他管理員操作改變，以列表當下資料為準，不顯示錯誤。
- [ ] desktop 1280px／mobile 390px：KPI 卡片可點擊區明確、鍵盤可聚焦，手機單欄。

## Security self review 重點

- 只連到既有 admin 列表；不新增讀取。`upcoming` 條件經 list-context 白名單 normalize，不接受任意時間參數。

## 候選檔案

- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/classes/page.tsx`、`src/app/admin/_lib/list-context.ts`
- 只讀對照：`src/domain/admin/__internal__/dashboard-kpis-core.ts`（條件不改）
- `tests/smoke/admin-dashboard.spec.ts`、`admin-class-session-management.spec.ts`、`admin-list-context.spec.ts`

## 不做

不改 KPI 計算核心、不新增 KPI、不新增報名列表或匯出。不得 commit／push。

<!-- codex-peer-reviewed: 2026-10-04T22:20:22Z rounds=2 verdict=approved -->
