# 13: 工作總覽 KPI 精準入口

**What to build:** 工作總覽維持「待你處理」在最上方；下方數字點下去會到與數字條件完全相同的列表：已通過老師、已公開需求、已媒合需求、即將開始課程（開放報名且尚未開始，列表上清楚顯示這個時間條件並可清除）。已確認報名只顯示數字，不連到任何頁。

**Blocked by:** 09：「即將開始」是課程列表的新條件，沿用票 09 擴充後的列表上下文（含顯示／清除條件與返回保留）。

**Status:** accepted（2026-10-06 產品主人回覆「1」放行；實作後再回覆「1」，選擇執行「13 通過，commit + push」，畫面驗收通過）

**Workflow mode:** STANDARD

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

**來源：** 規格第 10 節；計畫第三批第 4 點。

## Acceptance criteria

- [x] 「待你處理」保持最上方，老師／需求各前 5 筆與總數不變（第一批已建立，本票只回歸）。
- [x] KPI 對應：已通過老師 → 老師「已通過」分類；已公開需求 → 需求「已公開」（只含 published）；已媒合需求 → 需求「已媒合」（只含 matched，不含已建課）；即將開始課程 → 課程列表 `upcoming` 條件（open_for_enrollment 且 startAt 尚未到達）。
- [x] 課程列表新增 `upcoming` 條件：清楚顯示「開放報名且尚未開始」與清除入口；可與關鍵字、關聯條件組合；返回／操作成功後保留；開始時間判斷與 KPI core 使用相同規則。
- [x] 已確認報名只作統計，不新增全站報名路由或近似目的頁，畫面不呈現可點擊樣式。
- [x] KPI 數字與點進去的列表筆數在同一時間點一致；若資料隨時間或其他管理員操作改變，以列表當下資料為準，不顯示錯誤。
- [x] desktop 1280px／mobile 390px：KPI 卡片可點擊區明確、鍵盤可聚焦，手機單欄。

## 實作紀錄（2026-10-06）

- 總覽：「待你處理」維持最上方（沒改）。數字概況四張卡片改成整張可點的連結，並加「查看列表 →」：已通過的老師 → `/admin/teachers?status=approved`、已公開的需求 → `/admin/demands?status=published`、已媒合的需求 → `/admin/demands?status=matched`、即將開始的課程 → `/admin/classes?when=upcoming`（卡片寫明「開放報名中，且還沒到開始時間」）。已確認的報名維持一般卡片、寫「全平台統計」，沒有連結。KPI 計算核心沒改。
- 課程列表：`list-context.ts` 新增只限課程列表的 `when=upcoming`（白名單，其他值丟掉），與 KPI core 同一規則（`open_for_enrollment` 且 `startAt` 尚未到達）。顯示「只看即將開始的課程：開放報名中，且還沒到開始時間。」與「清除這個條件」（保留關鍵字、分類與關聯限定）；分類、搜尋、解除限定都保留這個條件，「清除全部條件」一併清掉。返回與操作成功導向經 `safeAdminReturnTo` 自動保留。新增 `adminConditionParams`（關聯＋即將開始）給篩選列與搜尋表單用。
- 同時處理（2026-10-06 產品主人選 1）：課程來源用詞改用團主端的 `classOriginLabelsForAdmin`，見票 11。
- 驗證：tsc、lint、build 通過；3100 執行新增 `admin-dashboard-kpi`（待你處理在上、四張卡片連結精準、已確認報名無連結、四組數字與列表數量一致、鍵盤進入、即將開始只含開放且未開始、與關鍵字／老師限定組合、切分類保留、清除這個條件保留老師限定、取消整堂後回同一條件列表並可查看、重新整理不遺失、清除全部條件）＋`admin-list-context`（即將開始條件純函式）＋既有 `admin-dashboard` 32/32（desktop＋mobile）。截圖 `.ai-runs/admin-usability/*-dashboard-kpi.png`，已親看 390px。
- Codex peer review 第 1 輪指出：(1) 即將開始與其他條件一起保留（詳情返回、單筆取消、清除關鍵字、解除限定）沒有組合測試；(2) 「待你處理」前 5 筆與總數、手機單欄沒有斷言。已補兩條測試：即將開始＋老師限定＋關鍵字＋開放中同時成立，進詳情返回、取消單筆報名後返回都保留四個條件，清除關鍵字保留其餘三個，解除限定只拿掉老師限定；建立 6 筆極舊的待審老師與需求，斷言兩組都只列最久的 5 筆且順序正確、標題總數等於全平台待審數，390px 時五張 KPI 卡片左緣對齊、由上往下排。`admin-dashboard-kpi` 6/6 通過。完整回歸 `admin-*`＋`role-switch`＋`enrollment*`＋`notification`＋`class-session-cancellation`＋`organizer-direct-class` 232 項 230 項首輪通過；2 項失敗（`admin-class-session-management` 篩選列、`admin-related-lists` 長流程，皆 desktop）單獨重跑時其中一次遇到資料庫連線初始化錯誤，再次重跑雙裝置 4/4 通過。

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

<!-- codex-peer-reviewed: 2026-10-05T21:19:50Z rounds=2 verdict=approved -->
