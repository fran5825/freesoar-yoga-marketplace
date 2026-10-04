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
- 本票只做建立時填寫；不新增建課後編輯，也不擴充團主建課表單。
- 2026-10-04 修訂（產品主人選 A，配合 `docs/specs/teacher-class-scheduling-spec.md` Q7）：這兩段屬於「內容類欄位」，之後由老師排課票 04（單堂改課）、05（系列改課）提供建立後修改，規則與課程介紹相同（隨時可改、不通知）。欄位與 validation 要能讓改課票直接重用。
- 條件式責任：開工時先查 main。若老師排課票 04（單堂改課）**尚未完成**，本票不實作修改，由該票之後補上；若**已完成**，本票必須在既有單堂改課表單與寫入路徑一併加上這兩段（隨時可改、不通知），並納入下方驗收。
- `RecurringClassSeries` 的欄位留給票 04，本票只做單堂。

## Acceptance criteria

- [ ] 開工前提供具體 Builder plan（allowed files、migration 內容、影響、checks），經 Human Gate 確認
- [ ] 老師單堂建課表單新增選填區，不增加步驟；超過 500 字有明確錯誤
- [ ] 送出後資料正確寫入；空白視為未提供
- [ ] 訪客與登入學員詳情都在「介紹」之後顯示兩段；缺值顯示「尚未提供」
- [ ] 舊課、團主團課詳情正常，顯示「尚未提供」
- [ ] 僅在老師排課票 04 已完成時：單堂改課可修改、清空這兩段，500 字限制一致，修改後不發通知，學員詳情顯示新內容
- [ ] `docs/domain/data-model.md` 同步更新
- [ ] `npx prisma validate`、client generation、migration 內容審核；不自行對真實 DB 執行 migration／db push
- [ ] tsc、lint、build；smoke 覆蓋有填／沒填／超長／舊課／團主課，手機 375 與桌機


<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
