# 11: 課程詳情摘要優先與完整課程資料

**What to build:** 管理員打開課程詳情時，先看到時間、地點、老師、來源與報名摘要，再看課程風格、瑜伽類型、報名方式、是否公開與課程說明，最後才是名單與操作。報名摘要分開顯示「已報名」與「待老師確認」，並說明兩者都佔名額。

**Blocked by:** None（第三批內無技術依賴；與票 10、12 修改同一詳情頁，施工順序見 README）。

**Status:** draft（2026-10-05 產品主人已確認切票粒度與依賴；Builder 只放行到 09，本票待 09 完成並回報後依序接續）

**Workflow mode:** STANDARD（擴充 admin 課程詳情 DTO）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、BRAND_RISK、SCOPE_DRIFT_RISK、COMPAT_RISK（舊資料與其他 task 可能新增的 `origin` 值）。

**來源：** 規格第 7、8 節；計畫第三批第 2 點。

## Acceptance criteria

- [ ] 詳情順序：回列表 → 課程名稱／狀態／時間／地點／老師／來源／報名摘要 → 課程內容（課程風格、瑜伽類型、報名方式、公開狀態、說明、程度）→ 次要資料與關聯 → 名單 → 操作。有合法取消時摘要提供頁內跳轉，不重複放表單。
- [ ] Admin 課程詳情 DTO 補讀既有 `serviceTypes`、`yogaStyles`、`origin`、`requiresApproval`，呈現 `isPublic`；沿用既有兼容讀取規則（`serviceTypes` 為空時退回舊 `serviceType`，沿用 `service-types-display.ts`／`yoga-styles.ts` 的顯示 helper）。
- [ ] 用詞統一：「課程風格」「瑜伽類型」「團主團課／老師開課」；報名方式顯示「需老師確認」或「直接報名」；公開狀態顯示「公開」或「不公開」。
- [ ] `origin` 遇到未知值（其他 task 可能新增來源類型）時顯示中性 fallback，不讓頁面錯誤。
- [ ] 報名摘要：已報名（confirmed）與待老師確認（pending）分開；「名額佔用＝pending＋confirmed／capacity」與既有名額規則一致，不以 confirmed 數宣稱剩餘名額。
- [ ] 不新增課程編輯、代建、系列管理能力；取消按鈕的資格與文字不變（沿用票 08）。
- [ ] desktop 1280px／mobile 390px：首屏能看到對象、狀態、時間與報名摘要；多個風格標籤與長說明自然換行，無橫向溢出。

## Security self review 重點

- 只擴充 `getClassSessionDetailForAdmin` 的 select；新增欄位皆為課程本身的資料，不夾帶其他使用者個資。
- 不修改公開或老師／團主端共用的課程 DTO 或 helper 行為；共用顯示 helper 只讀不改。

## 候選檔案

- `src/app/admin/classes/[classSessionId]/page.tsx`
- `src/domain/class-session/admin-service.ts`（只擴充詳情 select／型別）
- 只讀引用：`src/domain/class-session/service-types-display.ts`、`yoga-styles.ts`
- `tests/smoke/admin-class-session-management.spec.ts`

## 不做

不改 schema、課程建立／編輯、名額規則或取消核心。不得 commit／push。

<!-- codex-peer-reviewed: 2026-10-04T22:20:22Z rounds=2 verdict=approved -->
