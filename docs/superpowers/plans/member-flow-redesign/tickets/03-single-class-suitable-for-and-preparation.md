# 03: 單堂課的適合對象與準備事項

**What to build:** 老師建立單堂課時，可以在同一頁選填「適合對象／程度」與「準備事項」；學員（訪客與登入者）在課程詳情看到這兩段。沒填的課（含舊課與團主團課）顯示「尚未提供」。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（Prisma schema 新增欄位與 migration；需產品主人確認具體 Builder plan）

**Risk flags:** Prisma schema、migration、老師建課 write path、公開／學員詳情 DTO。

**Source:** `docs/member-flow-redesign-plan.md` Q8、Q11、分批表第 2 批。

## 已決定的規格（Q11，不重問）

- `ClassSession` 新增 nullable `suitableFor`、`preparationNotes`，各最多 500 字；trim 後空字串視為未提供。
- 不做等級 enum，不從課程類型推測內容；舊課與團主團課不回填。
- 只支援建立時填寫；不新增建課後編輯，也不擴充團主建課表單。
- `RecurringClassSeries` 的欄位留給票 04，本票只做單堂。

## Acceptance criteria

- [ ] 開工前提供具體 Builder plan（allowed files、migration 內容、影響、checks），經 Human Gate 確認
- [ ] 老師單堂建課表單新增選填區，不增加步驟；超過 500 字有明確錯誤
- [ ] 送出後資料正確寫入；空白視為未提供
- [ ] 訪客與登入學員詳情都在「介紹」之後顯示兩段；缺值顯示「尚未提供」
- [ ] 舊課、團主團課詳情正常，顯示「尚未提供」
- [ ] `docs/domain/data-model.md` 同步更新
- [ ] `npx prisma validate`、client generation、migration 內容審核；不自行對真實 DB 執行 migration／db push
- [ ] tsc、lint、build；smoke 覆蓋有填／沒填／超長／舊課／團主課，手機 375 與桌機

<!-- codex-peer-reviewed: 2026-10-03T21:19:08Z rounds=3 verdict=approved (reviewed as one unit with ../ticket-breakdown.md) -->
