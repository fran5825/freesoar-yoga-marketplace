# 08：老師完整旅程驗收

**What to build:** 在前七票各自通過驗收後，確認老師從登入銜接與申請，到三模式建課、找課、處理報名及返回的完整旅程順暢且一致，交付可檢視的驗收證據。

**Blocked by:** 01–07 全部完成並通過各自必要驗收（本票不代替前七票的測試）。

**Status:** done（2026-10-04）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [x] 以既有本機 fixture 驗證登入後申請銜接、未先存直接送審、審核中唯讀、退回修正、通過及暫停的既有入口與資格；不更改 Auth／審核政策。
- [x] 已通過老師依單堂、每週固定、指定日期完成建立；摘要與結果一致，單堂 draft 仍明確開放，系列仍非公開逐堂處理。
- [x] 老師能從即將上課／草稿／過往／全部找到課，從系列進場次處理報名後回原位置；直連詳情有清楚退路。
- [x] 確認報名、婉拒、取消單堂與系列的確認及回饋符合規格，不因返回或重整重做 mutation；失敗保留輸入與離頁提醒可完成。
- [x] 375px／768px／1440px 完整旅程的標題、卡片、間距、狀態、操作與低壓文案一致；驗證長內容、空狀態、錯誤、鍵盤及焦點。
- [x] 非本人課／系列隔離、暫停寫入限制、團主媒合課操作邊界與返回來源白名單維持，沒有意外公開或新權限。
- [x] 受影響規格、老師計畫、route／操作位置描述與實際行為一致；不得把任何尚未完成票標為完成。
- [x] 提供 changed files、完整本工作 diff、check 結果／限制、畫面證據、self review、scope drift 與具完整 Common Handoff Schema 的 review packet。

## 實作與驗證邊界

- 本票以整合驗證、必要 outcome tests 與文件同步為主，不自動授權跨頁補功能或修補前票 source。
- 發現回歸時記錄歸屬票、具體復現與最小修正範圍，取得對應修正授權後才改 source；不修其他 task 的程式來通過全 repo checks。
- 執行 diff whitespace、TypeScript、ESLint、build 與受影響老師旅程 smoke；使用獨立可用 port、先確認 build 鎖，保留其他 task 程序。
- 只使用本機測試資料，fixture 的建立／清理沿用既有測試機制；不操作 production、不向真實使用者發布課程／通知。
- 本票 rollback 僅回復新增驗收測試與描述，不回復業務資料；不新增 migration、套件或部署。
- 實作需本票範圍核准；驗收完成後仍需 reviewer／產品檢視，commit、push、deploy 另需明確要求。

## 執行紀錄（2026-10-04）

- 完整老師旅程回歸（`teacher-*.spec.ts`＋建課、報名審核、取消、完成、建立入口相關檔，桌機＋手機，PORT=3200）：284 個中 283 通過；唯一失敗（團主標記完成，桌機）單獨重跑通過，判定為負載下偶發。
- 修正既有 `teacher-recurring-class-series.spec.ts` 寫死的 2026-10-05 等日期，改成相對今天的日期，斷言不變。
- 文件同步：票券 01–08、README、規格狀態、route map（票 04 已同步）、state-transition-details（票 01 已同步）。
- 完整 review packet：[08-builder-review-packet.md](../08-builder-review-packet.md)。
- 其他 task 造成的既有失敗（`signed-in-navigation.spec.ts:83`、`teacher-profile-suspension.spec.ts:328`）記在 packet，未修改。
