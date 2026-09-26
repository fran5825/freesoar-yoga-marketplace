# 01: 學員外框與共用狀態標籤（決策 7、9）

**What to build:** 學員登入後看到的頁面都有跟老師、團主端一致的導覽列與頁寬，能從任何一頁走到「找課程／我的報名／通知」，不必再按瀏覽器上一頁。三處各自複製的報名狀態標籤改成共用元件。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（只動版面與元件；`/classes` 系列是公開頁，未登入訪客的 header 不能被學員外框影響，實作時確認）

**Source:** `docs/member-usability-plan.md`

- [ ] `/member/dashboard`、`/member/enrollments` 有導覽列，頁寬 `max-w-4xl`，與團主、老師頁一致
- [ ] 導覽選單為「找課程／我的報名／通知」，目前頁面有高亮
- [ ] 未登入訪客看 `/classes` 與課程詳情，header 與現在相同
- [ ] 報名狀態標籤只有一份共用元件，dashboard、我的報名、課程詳情都改用它，文字與樣式不變
- [ ] 手機（375 寬）沒有橫向捲動；學員相關 smoke 測試桌機與手機通過
