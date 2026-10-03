# 05：系列管理：逐場資訊與操作

**What to build:** 老師查看系列時能逐場讀取日期、狀態與報名人數，進單堂處理後回到原系列；取消整系列前看懂實際影響。

**Blocked by:** 03 單堂詳情：資訊與報名操作順手；04 我的課程：分類、開課入口與返回位置（沿用確認介面與安全返回機制）。

**Status:** done（2026-10-04）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [x] 系列摘要與單堂頁標題、間距、狀態及操作樣式一致，清楚說明場次不公開且逐堂處理。
- [x] 每場顯示日期、時間、狀態、已確認人數與待確認數，有清楚的單堂詳情連結；取消／過往場次仍可辨識。
- [x] counts 使用本人系列所屬場次的既有報名資料推導，讀取仍有 ownership 限制；不以全部報名或跨老師 query 產生摘要。
- [x] 點進場次、處理報名、返回原系列與位置可完成，人數與狀態反映最新結果；另有我的課程退路。
- [x] 整系列取消前列出真實可影響場次及報名連帶影響；取消視窗不寫入，確認後沿用既有取消 service，不能宣稱刪除系列或停止未來生成。
- [x] 既有每週新增場次能力與資格維持，不提供公開系列、批次開放、批次審核、套裝報名或新增排程政策。
- [x] outcome tests 覆蓋各狀態 counts、跨老師隔離、系列到單堂返回、取消確認前無寫入與原取消結果；手機長場次清單及鍵盤正常。

## 實作與驗證邊界

- 可擴充既有 own-scoped read DTO 的推導 counts，不改 schema、報名定義、permissions 或 mutation policy。
- 不依賴 02：既有系列已足以驗收本票；新系列建課另由 02 完成。
- 執行 diff whitespace、TypeScript、ESLint、build、系列管理／詳情 own-scoped 讀取與返回 smoke，完成三種寬度 QA。
- rollback 僅回復呈現與 read DTO 推導欄位，不還原已取消的業務資料。
- 實作需本票範圍核准；讀取邊界、schema 或取消規則須改時，停止另提 HEAVY decision plan。

## 執行紀錄（2026-10-04）

- Read DTO：`src/domain/class-session/read-service.ts` 的 `getOwnRecurringClassSeriesDetailForTeacher` 每場多帶 `confirmedCount`／`pendingCount`，在原本 `teacherProfileId` 限定的系列查詢裡只讀報名狀態（不讀學員資料）後計數；沒有新增跨老師查詢，schema、報名定義與權限不變。
- 系列頁：返回我的課程、系列說明（逐堂開放、不列公開列表）、每場日期／狀態／已報名／待確認並連到單堂（返回回到同一場）；過往與取消場次淡化但仍可辨識；「生成更多」沿用原規則並加送出中防重按。
- 整系列取消改走票 03 的 `ConfirmActionDialog`：列出實際會取消的場次（尚未開始的草稿／開放報名）、合計報名數與通知影響，說明系列本身保留；確認後沿用既有 `cancelRecurringClassSeriesForTeacher`。
- Checks：`tsc`、`eslint`、`npm run build` 通過；Playwright 5 個檔 70 個測試通過（新增逐場 counts、他人系列 404、系列 → 單堂 → 確認報名 → 返回後人數更新、Escape 不寫入、確認後只取消未開始場次並連帶取消報名、系列保留）。
- RWD：375／768／1440 26 場清單、長系列名稱與地址無橫向捲動；main 內連結、按鈕、輸入框 ≥ 44px；取消視窗內清單可捲動。
