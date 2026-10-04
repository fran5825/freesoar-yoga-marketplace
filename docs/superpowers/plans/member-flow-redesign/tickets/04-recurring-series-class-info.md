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
- 生成場次時複製到每場 `ClassSession`；之後不同步、不回寫。
- 保留既有系列規則：系列場次 `isPublic = false`、逐場報名、生成規則不變；不新增整期報名。

## Acceptance criteria

- [ ] 開工前提供具體 Builder plan，經 Human Gate 確認
- [ ] 「每週固定」與「指定日期」兩種表單都有同一個選填區，限制與單堂一致
- [ ] 兩種模式各自驗證：系列本身與生成的每一場都保存正確內容；沒填的系列每場顯示「尚未提供」
- [ ] 學員從分享連結開兩種系列中任一場，都看得到兩段資訊
- [ ] 系列場次仍為 `isPublic = false`，報名仍是逐場
- [ ] `docs/domain/data-model.md` 同步
- [ ] prisma validate、client generation、migration 審核；不自行套用真實 DB migration
- [ ] tsc、lint、build；兩種系列生成相關 smoke 與新增案例通過

<!-- codex-peer-reviewed: 2026-10-03T21:19:08Z rounds=3 verdict=approved (reviewed as one unit with ../ticket-breakdown.md) -->
