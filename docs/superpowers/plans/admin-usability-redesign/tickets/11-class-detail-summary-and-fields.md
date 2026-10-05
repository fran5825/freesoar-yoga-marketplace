# 11: 課程詳情摘要優先與完整課程資料

**What to build:** 管理員打開課程詳情時，先看到時間、地點、老師、來源與報名摘要，再看課程風格、瑜伽類型、報名方式、是否公開與課程說明，最後才是名單與操作。報名摘要分開顯示「已報名」與「待老師確認」，並說明兩者都佔名額。

**Blocked by:** None（第三批內無技術依賴；與票 10、12 修改同一詳情頁，施工順序見 README）。

**Status:** accepted（2026-10-05 產品主人回覆「10 通過，開始做 11」放行；同日實作後回覆「11 通過」，畫面驗收通過）

**Workflow mode:** STANDARD（擴充 admin 課程詳情 DTO）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、BRAND_RISK、SCOPE_DRIFT_RISK、COMPAT_RISK（舊資料與其他 task 可能新增的 `origin` 值）。

**來源：** 規格第 7、8 節；計畫第三批第 2 點。

## Acceptance criteria

- [x] 詳情順序：回列表 → 課程名稱／狀態／時間／地點／老師／來源／報名摘要 → 課程內容（課程風格、瑜伽類型、報名方式、公開狀態、說明、程度）→ 次要資料與關聯 → 名單 → 操作。有合法取消時摘要提供頁內跳轉，不重複放表單。
- [x] Admin 課程詳情 DTO 補讀既有 `serviceTypes`、`yogaStyles`、`origin`、`requiresApproval`，呈現 `isPublic`；沿用既有兼容讀取規則（`serviceTypes` 為空時退回舊 `serviceType`，沿用 `service-types-display.ts`／`yoga-styles.ts` 的顯示 helper）。
- [x] 用詞統一：「課程風格」「瑜伽類型」「團主團課／老師開課」；報名方式顯示「需老師確認」或「直接報名」；公開狀態顯示「公開」或「不公開」。
- [x] `origin` 遇到未知值（其他 task 可能新增來源類型）時顯示中性 fallback，不讓頁面錯誤。
- [x] 報名摘要：已報名（confirmed）與待老師確認（pending）分開；「名額佔用＝pending＋confirmed／capacity」與既有名額規則一致，不以 confirmed 數宣稱剩餘名額。
- [x] 不新增課程編輯、代建、系列管理能力；取消按鈕的資格與文字不變（沿用票 08）。
- [x] desktop 1280px／mobile 390px：首屏能看到對象、狀態、時間與報名摘要；多個風格標籤與長說明自然換行，無橫向溢出。

## 實作紀錄（2026-10-05）

- 讀取：`getClassSessionDetailForAdmin` 補 `serviceTypes`、`yogaStyles`、`origin`、`requiresApproval`（`isPublic` 原本就有），都是課程本身的欄位。沒有改公開或其他角色的 DTO／helper。
- 頁首摘要：時間（開始–結束）、地點、授課老師、來源、報名（「已報名 N 人・待老師確認 N 人・名額佔用 N／名額」＋「已報名與待老師確認都會佔用名額。」）。報名數用完整名單計算，已取消不佔名額。可取消時提供「前往取消操作」跳到取消區塊。
- 課程內容區：課程風格（`getClassServiceTypes`，`serviceTypes` 為空退回舊 `serviceType`）、瑜伽類型、報名方式（需老師確認／直接報名）、公開狀態（公開／不公開）、程度、課程說明。原本的「課程類型」改稱「課程風格」；時間、地點、名額上限移到頁首摘要，不重複顯示。
- 順序：頁首摘要 → 課程內容 → 團主、老師與團體（聯絡方式）→ 相關資料（票 10）→ 報名名單 → 取消課程。
- 來源用詞與公開課程頁一致：團主團課／老師開課；不認得的值顯示「其他來源」。用詞抽成純函式 `src/app/admin/classes/origin-labels.ts`（`adminClassOriginLabel`），在 `admin-list-context.spec.ts` 直接測已知值與 `organizer_direct`、空字串、`toString`、`__proto__` 等未知值。資料庫 enum 與限制擋住任意值，所以沒有用 e2e 製造未知來源。
- 驗證：tsc、lint、build、`git diff --check` 通過；3100 執行新增 `admin-class-detail-summary`（多風格／瑜伽類型／需確認／公開、舊資料退回單一風格／直接報名／不公開、2 已報名＋1 待確認＋1 已取消的摘要、區塊順序、頁內跳轉、已結束課程沒有取消入口、無橫向溢出）＋`admin-detail-links`＋`admin-class-session-management` 通過。截圖 `.ai-runs/admin-usability/*-class-summary.png`，已親看 390px。名單的「處理中」標籤屬票 12。
- Codex peer review 第 1 輪指出：(1) 沒有長說明、首屏只用 `toContainText` 不能證明 RWD；(2) 未知來源 fallback 沒有測試。已補：測試課程加入含 160 字無空白長字串的長說明；一進頁面、還沒捲動前就斷言課程名稱、狀態、時間與報名摘要在畫面內（`toBeInViewport`），並檢查無橫向溢出（desktop／390px）；fallback 改為純函式並補測試。`admin-class-detail-summary`＋`admin-list-context` 14/14 通過。

- 2026-10-06 用詞調整：合併團主 redesign 後，課程詳情頁首同時出現團主端加的來源標籤（「團主媒合」）與本票摘要（「團主團課」）。產品主人選擇統一用團主端的管理員用詞：`adminClassOriginLabel` 改讀 `classOriginLabelsForAdmin`（團主媒合／老師開課／團主直接開團，未知值仍顯示「其他來源」），並移除重複的頁首標籤；規格第 7 節同步更新。

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

<!-- codex-peer-reviewed: 2026-10-05T08:50:21Z rounds=2 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T21:19:50Z rounds=2 verdict=approved -->
