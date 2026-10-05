# 07：建立期班

**What to build:** 老師建立每週固定課時選「持續開課」或「期班，共 N 堂」；指定日期一律建立為期班；期班建立時設定報名方式（只收整期／整期和單堂都收）。期班不能生成更多，系列頁標示型態與報名方式。

**Blocked by:** 01 系列全部開放報名（建立時的開放報名勾選框）；02 生成更多提醒（本票要把提醒改成只針對持續開課）；06 公開設定（本票要套用期班整期一致的公開規則）

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** PRISMA_SCHEMA、MIGRATION（系列型態、期班報名方式欄位與舊資料轉換）、STATE_MACHINE

規格：[4.1](../../../../specs/teacher-class-scheduling-spec.md)（Q18、Q20、Q21）；[ADR 0005](../../../../adr/0005-term-class-series-enrollment.md)；推導規則 7。

- [ ] 實作前更新 `docs/domain/data-model.md`、`state-machines.md`，說明欄位、轉換與 rollback。
- [ ] Additive migration：既有每週固定 → 持續開課；既有指定日期 → 期班、整期和單堂都收（目前無正式上線資料）。
- [ ] 建立表單：每週固定增加型態選擇；期班輸入堂數 N（1–26）；期班選報名方式；建立摘要顯示實際堂數（含撞課跳過）。
- [ ] 期班不提供生成更多（server 端也拒絕）；票 02 的提醒改為只針對持續開課。
- [ ] 系列型態與報名方式建立後不能改（推導規則 7，放行時確認）。
- [ ] 期班的公開設定整期一致（推導規則 8）：改公開設定時不提供「只改這場」，套用到所有未開始、未取消的場次與系列預設；測試覆蓋。
- [ ] 本票只建立期班，學員端仍是逐場報名（整期報名在 08）。
- [ ] Smoke 測試覆蓋三種建立路徑、期班拒絕生成更多、舊資料轉換結果；tsc、lint、build、受影響 smoke 通過；RWD 檢查。

## 跨計畫註記：適合對象／準備事項（2026-10-04）

學員流程票 04（`docs/superpowers/plans/member-flow-redesign/tickets/04-recurring-series-class-info.md`）會在系列新增 `suitableFor`／`preparationNotes`。期班建立的表單與生成路徑要包含這兩段，以後做的一方為準：本票若晚於學員流程票 04，需讓期班建立表單與生成的每一場帶著系列上的這兩段並驗證；若早於，由學員流程票 04 覆蓋本票的路徑。銜接規則見 `docs/superpowers/plans/member-flow-redesign/ticket-breakdown.md`。

<!-- codex-peer-reviewed: 2026-10-04T00:20:22Z rounds=4 verdict=approved -->

<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
