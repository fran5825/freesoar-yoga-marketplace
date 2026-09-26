# 04: 課程列表：篩選、名額與來源標籤（決策 6、8、10）

**What to build:** 學員在 `/classes` 用 tag-chip 點選即時篩選（課程類型、星期幾、只看還有名額），每張卡片顯示剩餘名額、狀態與「團主團課／老師開課」來源標籤。沒有符合的課時顯示說明與下一步。

**Blocked by:** 01

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（`/classes` 為公開頁；不動 schema）

**Source:** `docs/member-usability-plan.md`

- [ ] 篩選改為 tag-chip，點選即時更新，不需要送出按鈕
- [ ] 有「只看還有名額」選項
- [ ] 每張卡片顯示剩餘名額、狀態、來源標籤
- [ ] 無結果時顯示空狀態說明
- [ ] 手機單手可操作；未登入訪客可正常瀏覽；smoke 測試通過
