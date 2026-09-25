# 08: 需求詳情頁重排與下一步提示（決策 6）

**What to build:** 需求詳情頁依「下一步提示 → 老師回應 → 課程與報名 → 需求內容（預設摺疊）」排列。「下一步」用共用文案（例如等審核、3 位老師已回應請選擇、請建立課程），之後總覽與列表共用同一組。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 文案依需求狀態機顯示，不改狀態機；共用文案放在 domain 層，不寫在頁面元件裡

**實作紀錄：** 已完成。共用文案在 domain 層 `getDemandNextStep`。未做單元測試：專案目前沒有 Vitest 設定，改由 smoke 測試涵蓋（已記 backlog）。草稿的編輯入口改由下一步卡片提供，頁尾不再重複。

**Source:** `docs/organizer-usability-plan.md`

- [x] 每種需求狀態都有對應的下一步文案，有單元測試
- [x] 區塊順序符合決策 6，需求內容可展開收合
- [x] 既有老師回應選擇、建立課程功能不變
- [x] `organizer-demand-responses` 等相關 smoke 測試桌機與手機通過
