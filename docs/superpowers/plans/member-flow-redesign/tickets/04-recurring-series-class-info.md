# 04: 系列課（每週固定與指定日期）沿用課程資訊

**What to build:** 老師建立系列課時，不論用「每週固定」或「指定日期」，都可以填同樣的「適合對象」與「準備事項」；系列生成的每一場課都帶著這兩段，學員打開任何一場都看得到。

**Blocked by:** 03（共用欄位定義、validation 與詳情顯示）

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（Prisma schema 新增欄位、系列生成核心）

**Risk flags:** Prisma schema、migration、系列建立 service、逐場生成 core。

**Source:** `docs/member-flow-redesign-plan.md` Q11、分批表第 2 批（「單堂／兩種系列」）；名詞見 `docs/context/glossary.md`「每週固定」「指定日期」。

## 已決定的規格（不重問）

- `RecurringClassSeries` 新增與票 03 相同的兩個 nullable 欄位與限制。
- 兩種排程模式（`weekly`、`fixed_dates`）的建課表單都要有這個選填區，並共用同一套 validation。
- 生成場次時複製到每場 `ClassSession`；本票不做同步或回寫。建立後的修改（含「改這場和之後所有場次」更新系列上的這兩段）由老師排課票 05 負責。
- 條件式責任：開工時先查 main。若老師排課票 05（系列改課）**已完成**，本票必須在既有系列改課表單與寫入路徑一併加上這兩段：「只改這場」只改該場；「改這場和之後所有場次」改該場與之後未開始、未取消的場次並更新系列上的值；不發通知。尚未完成則由該票補上。
- 本票不改系列的公開設定、報名方式與生成規則。系列公開設定由老師排課票 06 負責；期班與整期報名由老師排課票 07～12 負責，都不在本票範圍。
- 若老師排課票 07（期班建立）或 11（追加補課）先完成，本票要一併覆蓋那些新的建立／追加路徑，讓期班與補課場次也帶著這兩段；若本票先完成，則由那些票沿用系列上的值。

## Acceptance criteria

- [ ] 開工前提供具體 Builder plan，經 Human Gate 確認
- [ ] 「每週固定」與「指定日期」兩種表單都有同一個選填區，限制與單堂一致
- [ ] 兩種模式各自驗證：系列本身與生成的每一場都保存正確內容；沒填的系列每場顯示「尚未提供」
- [ ] 學員從分享連結開兩種系列中任一場，都看得到兩段資訊
- [ ] 本票沒有改變系列的公開設定與報名方式（與實作當下的 main 行為一致）
- [ ] 僅在老師排課票 07／11 已完成時：期班建立與追加補課產生的場次都帶著系列上的這兩段
- [ ] 僅在老師排課票 05 已完成時：兩種套用範圍都能修改、清空這兩段，500 字限制一致，之後生成／追加的場次沿用新值，不發通知
- [ ] `docs/domain/data-model.md` 同步
- [ ] prisma validate、client generation、migration 審核；不自行套用真實 DB migration
- [ ] tsc、lint、build；兩種系列生成相關 smoke 與新增案例通過


<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
